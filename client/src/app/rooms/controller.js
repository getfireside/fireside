import { observable, action, runInAction } from "mobx";
import { bindEventHandlers, on} from 'lib/actions';
import { throttle } from 'lodash-decorators';

import RoomConnection from './connection';
import Recorder from 'app/recordings/recorder';
import {MESSAGE_TYPES, MEMBER_STATUSES} from 'app/rooms/constants';
import _ from 'lodash';
import Logger from 'lib/logger';
import {camelizeKeys} from 'lib/util';
import {sleep} from 'lib/util/async';

export default class RoomController {
    constructor(opts = {}) {
        this.room = opts.room;
        this.logger = new Logger(opts.logger, 'controller');
        this.fs = opts.fs;

        this.recorder = new Recorder({
            store: this.room.recordingStore,
            fs: this.fs,
            extraAttrs: {room: this.room, uid: this.room.memberships.selfId},
            videoBitrate: this.room.config.videoBitrate,
        });
        this.connection = new RoomConnection({
            room: this.room,
            urls: opts.urls,
            fs: this.fs,
            logger: opts.logger,
            getFileById: (fileId) => this.getFileById(fileId),
        });

        bindEventHandlers(this);
    }

    /* ---- RECORDING EVENTS ---- */

    @on('recorder.*')
    @action.bound
    updateRecorderStatus(eventName) {
        // TESTS EXIST
        if (_.includes(['ready', 'started', 'stopping', 'stopped'], eventName)) {
            this.room.memberships.self.recorderStatus = this.recorder.status;
            this.sendEvent('updateStatus', {
                'recorderStatus': eventName,
            });
        }
    }

    @on('recorder.started')
    @action.bound
    notifyCreatedRecording(recording) {
        // TESTS EXIST
        this.room.memberships.self.currentRecordingId = this.recorder.currentRecording.id;
        this.room.memberships.self.currentRecording = this.recorder.currentRecording;
        this.room.messageStore.addMessage({
            type: MESSAGE_TYPES.EVENT,
            payload: {
                type:'startRecording',
                data: recording.serialize(),
            },
            room: this.room,
            uid: this.room.memberships.selfId
        });
        this.connection.notifyCreatedRecording(recording.serialize());
    }

    @on('recorder.blobWritten')
    @action.bound
    notifyRecordingUpdate() {
        // TESTS EXIST
        this.connection.sendEvent('updateRecording', {
            filesize: this.recorder.currentRecording.filesize,
            id: this.recorder.currentRecording.id
        }, {http: false});
    }

    @on('recorder.stopped')
    @action.bound
    async notifyRecordingComplete(recording) {
        // TESTS EXIST
        let message = this.sendEvent('stopRecording', {
            id: recording.id,
            filesize: recording.filesize,
            ended: +(recording.ended)
        });
        if (this.room.config.uploadMode == 'http') {
            await message.sendPromise;
            await sleep(1000);
            this.connection.uploadFile(recording, {
                fileId: 'recording:' + recording.id
            });
        }
    }

    @on('connection.event.requestStartRecording')
    @action.bound
    startRecording() {
        this.recorder.start();
    }

    @on('connection.event.requestStopRecording')
    @action.bound
    stopRecording() {
        this.recorder.stop();
    }

    @on('connection.event.startRecording',
        'connection.event.updateRecording',
        'connection.event.stopRecording')
    @action.bound
    handleRecordingStatusUpdate(change) {
        // TESTS EXIST
        let update = camelizeKeys(change);
        update.room = this.room;
        this.room.recordingStore.update([update]);
        let rec = this.room.recordingStore.get(change.id);
        rec.membership.currentRecording = rec;
    }

    /* ---- PEER AND JOIN EVENTS ---- */

    @on('connection.peerAdded')
    @action.bound
    handlePeerAdded(peer) {
        // TESTS EXIST
        this.room.recordingStore.update(_.map(peer.info.recordings, r => {
            r = camelizeKeys(r);
            r.room = this.room;
            return r;
        }));
        this.room.updateMembership(peer.uid, {
            status: MEMBER_STATUSES.CONNECTED,
            role: peer.info.role,
            currentRecordingId: peer.info.currentRecordingId,
            peer: peer,
            peerId: peer.id,
            name: peer.info.name,
            diskUsage: peer.info.diskUsage,
            resources: peer.info.resources,
        });
        let copyStatus = action(() => {
            this.room.memberships.get(peer.uid).peerStatus = peer.status;
        });
        copyStatus();
        peer.on('connected', copyStatus);
        peer.on('disconnected', copyStatus);

        peer.on('streamAdded', action((stream) => this.room.memberships.get(peer.uid).stream = stream));
        peer.on('streamRemoved', action(() => this.room.memberships.get(peer.uid).stream = null));
        this.room.memberships.get(peer.uid).stream = peer.stream;
    }

    @on('connection.peerRemoved')
    @action.bound
    handlePeerRemoved({uid}) {
        // TESTS EXIST
        this.room.updateMembership(uid, {
            status: MEMBER_STATUSES.DISCONNECTED,
            peerId: null,
            peer: null,
        });
    }

    @on('connection.join')
    @action.bound
    async handleJoinRoom(data, message) {
        // TESTS EXIST
        for (let m of data.members) {
            if (m.uid != this.room.memberships.selfId) {
                this.room.updateMembership(m.uid, {
                    status: m.peerId ? MEMBER_STATUSES.CONNECTED : MEMBER_STATUSES.DISCONNECTED,
                    role: m.info.role,
                    name: m.info.name,
                    uid: m.uid,
                    diskUsage: m.info.diskUsage,
                    resources: m.info.resources,
                    recorderStatus: m.info.recorderStatus,
                });
                this.room.recordingStore.update(_.map(m.info.recordings, r => {
                    r = camelizeKeys(r);
                    r.room = this.room;
                    return r;
                }));
            }
        }

        this.room.updateMembership(this.room.memberships.selfId, {
            status: MEMBER_STATUSES.CONNECTED,
            role: data.self.info.role,
            peerId: data.self.peerId,
            name: data.self.info.name,
            uid: data.self.uid,
        });
        let messagesData;
        try {
            messagesData = await this.connection.getMessages({until: message.timestamp});
        }
        catch (err) {
            this.logger.error(err);
            this.connection.restart();
            return;
        }
        this.room.updateMessagesFromServer(messagesData);
        this.connection.updateRecordings(_.map(
            this.room.memberships.self.recordings,
            r => r.serialize()
        ));
        if (this.room.memberships.self.onboardingComplete) {
            this.openFS();
        }
    }

    @on('connection.requestFileTransfer')
    @action.bound
    handleRequestFileTransfer(peer, {fileId, mode}) {
        if (!this.fs.isOpen) {
            // re-call once FS is open
            this.fs.once('open', () => this.handleRequestFileTransfer(peer, {fileId}));
        }
        else {
            let recordingId = fileId.split(':')[1];
            let rec = this.room.recordingStore.get(recordingId);
            if (rec == null || !rec.filesize) {
                this.sendEvent('error', {
                    type: 'recordingDoesNotExist',
                    message: "The requested recording is not present on this client's disk"
                });
            }

            if (mode == 'p2p') {
                this.connection.fileTransfers.sendFileToPeer(peer, rec);
            }
            else {
                this.connection.fileTransfers.uploadFile(rec, {mode});
            }
        }
    }

    @on('connection.fileTransfer.progress')
    @action.bound
    handleFileTransferProgress(transfer, progress) {
        // moved to separate function due to issues with combining all
        // 3 decorators
        return this.throttledFileTransferProgress(transfer, progress);
    }

    @throttle(500)
    throttledFileTransferProgress(transfer, progress) {
        this.connection.sendEvent('updateUploadProgress', {
            id: transfer.fileId.split(':')[1],
            ...progress,
        }, {http: false});
    }

    @on('connection.fileTransfer.complete')
    @action.bound
    handleFileTransferComplete(transfer, fileUrl) {
        if (fileUrl) {
            transfer.file.url = fileUrl;
            transfer.file.deleteFile();
        }
        this.sendEvent('uploadComplete', {
            id: transfer.fileId.split(':')[1]
        });
    }

    @on('connection.fileTransfer.started')
    @action.bound
    handleFileTransferStarted(transfer) {
        this.sendEvent('uploadStarted', {
            id: transfer.fileId.split(':')[1]
        });
    }

    @action.bound
    requestRecordingTransfer(recording) {
        this.connection.requestFileTransfer(`recording:${recording.id}`, recording.membership.peer);
    }

    /* ---- MESSAGES AND EVENTS ---- */

    @on('connection.event.updateStatus')
    @action.bound
    handleStatusUpdate(change, message) {
        this.room.updateMembership(message.uid, change);
    }

    @on('connection.event.uploadStarted')
    @action.bound
    handleUploadStarted({id}) {
        // needs test
        let rec = this.room.recordingStore.get(id);
        rec.fileTransfer = {isComplete: false, transferredBytes: 0};
    }

    @on('connection.event.updateUploadProgress')
    @action.bound
    handleUpdateUploadProgress({id, bytes, total}) {
        // needs test
        let rec = this.room.recordingStore.get(id);
        rec.fileTransfer = {isComplete: false, transferredBytes: bytes};
    }

    @on('connection.event.uploadComplete')
    @action.bound
    handleUploadComplete({id}) {
        // needs test
        let rec = this.room.recordingStore.get(id);
        rec.fileTransfer = {isComplete: true};
    }

    @on('connection.event.updateConfig')
    @action.bound
    handleUpdateConfig(newConfig) {
        let oldConfig = {...this.room.config};
        this.room.config = _.extend({}, oldConfig, newConfig);
        if (this.room.config.mode != oldConfig.mode) {
            this.stopRecording();
            if (this.connection.stream) {
                // restart local media if started
                this.setupLocalMedia();
            }
        }
        else if (this.room.config.videoBitrate != oldConfig.videoBitrate) {
            this.logger.log(`Dispatching bitrate change to recorder`);
            this.stopRecording();
            this.recorder.setVideoBitrate(this.room.config.videoBitrate);
        }
    }

    @on('connection.message')
    @action.bound
    receiveMessage(message) {
        if (message.type != MESSAGE_TYPES.SIGNALLING) {
            this.room.messageStore.addMessage(message);
        }
        // TODO: if it's an update event, don't add it to the message store -
        // instead look for the last one
    }

    @on('fs.diskUsageUpdate')
    @action.bound
    handleLocalDiskUsageUpdate(diskUsage) {
        this.room.memberships.self.diskUsage = diskUsage;
        this.connection.sendEvent('updateStatus', {diskUsage}, {http: false});
    }

    /* ---- ACTIONS ---- */

    @action.bound
    sendEvent(type, data) {
        let promise = this.connection.sendEvent(type, data, {http:true});
        return this.room.messageStore.addMessage({
            type: MESSAGE_TYPES.EVENT,
            payload: {type, data},
            room: this.room,
            uid: this.room.memberships.selfId
        }, {sendPromise: promise});
    }

    @action.bound
    requestStartRecording(user) {
        return this.connection.runAction('startRecording', {peerId:user.peerId});
    }

    @action.bound
    requestStopRecording(user) {
        return this.connection.runAction('stopRecording', {peerId:user.peerId});
    }

    @action.bound
    updateConfig(config) {
        this.connection.runAction('updateConfig', config);
        this.handleUpdateConfig(config);
    }

    openFS() {
        return this.fs.open();
    }

    async initialize() {
        if (this.room.memberships.selfId && !this.room.memberships.self.isNew) {
            this.logger.debug('Connecting to room...');
            await this.connect();
        }
    }

    @action
    async initialJoin(data) {
        let res = await this.connection.initialJoin(data);
        this.logger.debug('Initial join complete.');
        runInAction(() => {
            this.room.memberships.self.isNew = false;
            this.room.memberships.selfId = res.uid;
            this.recorder.extraAttrs.uid = res.uid;
            this.room.recordingStore.selfId = res.uid;
        });
        await this.initialize();
    }

    @action
    async changeName(member, data) {
        runInAction(() => {
            member.name = data.name;
        });
        await this.connection.changeName(member.uid, data);
    }

    @action.bound
    updateResources(data) {
        this.room.memberships.self.resources = data;
        this.connection.sendEvent('updateStatus', {resources:data}, {http:false});
    }

    @action
    completeOnboarding() {
        this.room.memberships.self.onboardingComplete = true;
        this.connection.sendEvent('updateStatus', {onboardingComplete:true})
    }

    @action
    async setupLocalMedia() {
        let audio = {deviceId: _.get(this.room.memberships.self, 'selectedAudioDeviceId')};
        let video = undefined;
        if (this.room.config.mode == 'video') {
            video = {deviceId: _.get(this.room.memberships.self, 'selectedVideoDeviceId')};
            if (_.includes(navigator.userAgent, 'Firefox')) {
                video.height = {
                    min: 240,
                    ideal: 2160,
                    max: 2160
                }
            }
            else {
                video.optional = [
                    {minHeight: 240},
                    {minHeight: 480},
                    {minHeight: 576},
                    {minHeight: 720},
                    {minHeight: 1080},
                    {minHeight: 1440},
                    {minHeight: 2160},
                ]
            }
        }
        let mediaStream = await navigator.mediaDevices.getUserMedia({
            audio,
            video
        });
        runInAction( () => {
            audio.label = mediaStream.getAudioTracks()[0].label;
            if (video) {
                video.label = mediaStream.getVideoTracks()[0].label;
            }
            this.recorder.setStream(mediaStream);
            this.connection.connectStream(mediaStream);
            this.updateResources({audio, video});
        });
        for (let track of mediaStream.getTracks()) {
            track.addEventListener('ended', action(() => {
                if (_.every(mediaStream.getTracks(), t => t.readyState == "ended")) {
                    this.updateResources({audio: null, video: null});
                }
            }));
        }
        return mediaStream;
    }

    @action stopLocalMedia() {
        if (this.connection.stream) {
            _.each(this.connection.stream.getTracks(), t => t.stop());
        }
        this.connection.stream = null;
    }

    async connect() {
        await this.connection.connect();
    }

    get self() {
        return this.room.userStore.self;
    }

    getFileById(fileId) {
        let [type, id] = fileId.split(':');
        if (type == 'recording') {
            return this.room.recordingStore.get(id);
        }
        throw new Error('Invalid file ID supplied');
    }
}