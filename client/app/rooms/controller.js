import { observable, action, runInAction } from "mobx";
import { bindEventHandlers, on } from 'lib/actions';

import RoomConnection from './connection';
import Recorder from 'app/recordings/recorder';
import {MESSAGE_TYPES, MEMBER_STATUSES} from 'app/rooms/constants';
import _ from 'lodash';
import {camelizeKeys} from 'lib/util';

export default class RoomController {
    constructor(opts = {}) {
        this.room = opts.room;
        this.logger = opts.logger;
        this.fs = opts.fs;

        this.recorder = new Recorder({
            store: this.room.recordingStore,
            fs: this.fs,
            extraAttrs: {room: this.room, uid: this.room.memberships.selfId}
        });
        this.connection = new RoomConnection({
            room: this.room,
            urls: opts.urls,
            fs: this.fs,
        });

        bindEventHandlers(this);
    }

    /* ---- RECORDING EVENTS ---- */

    @on('recorder.*')
    @action.bound
    updateRecorderStatus(eventName) {
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
        this.room.memberships.self.currentRecordingId = this.recorder.currentRecording.id;
        this.room.memberships.self.currentRecording = this.recorder.currentRecording;
        this.connection.notifyCreatedRecording(recording.serialize());
    }

    @on('recorder.blobWritten')
    @action.bound
    notifyRecordingUpdate() {
        this.connection.sendEvent('updateRecording', {
            filesize: this.recorder.currentRecording.filesize,
            id: this.recorder.currentRecording.id
        }, {http: false});
    }

    @on('recorder.stopped')
    @action.bound
    notifyRecordingComplete(recording) {
        this.sendEvent('stopRecording', {
            id: recording.id,
            filesize: recording.filesize,
            ended: +(recording.ended)
        });
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
        this.room.updateMembership(uid, {
            status: MEMBER_STATUSES.DISCONNECTED,
            peerId: null,
            peer: null,
        });
    }

    @on('connection.join')
    @action.bound
    async handleJoinRoom(data, message) {
        _.each(
            data.members,
            (m) => {
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
        );
        this.room.updateMembership(this.room.memberships.selfId, {
            status: MEMBER_STATUSES.CONNECTED,
            role: data.self.info.role,
            peerId: data.self.peerId,
            name: data.self.info.name,
            uid: data.self.uid,
        });
        let messagesData = await this.connection.getMessages({until: message.timestamp});
        this.room.updateMessagesFromServer(messagesData);
        this.openFS();
    }

    @on('connection.requestFileTransfer')
    @action.bound
    handleRequestFileTransfer(peer, {fileId}) {
        if (!this.fs.fs) {
            // FIXME - FSes need a state attribute
            // re-call once FS is open
            this.fs.on('open', () => this.handleRequestFileTransfer(peer, {fileId}));
        }
        else {
            let recordingId = fileId.split(':')[1];
            this.connection.fileTransfers.sendFile(peer, this.room.recordingStore.get(recordingId));
        }
    }

    @on('connection.startReceivingFile')
    @action.bound
    handleStartReceivingFile() {

    }

    @action.bound
    requestRecordingTransfer(recording) {
        this.connection.requestFileTransfer(`recording:${recording.id}`, recording.membership.peer);
    }

    // @on('connection.event.uploadRecordingRequest')
    // @action.bound
    // async uploadRecordingToHost(recordingId) {
    //     let blob = await this.room.recordingStore.get(recordingId).getFileBlob();
    //     this.connection.startFileUpload(this.room.owner, blob);
    // }

    /* ---- MESSAGES AND EVENTS ---- */

    @on('connection.event.updateStatus')
    @action.bound
    handleStatusUpdate(change, message) {
        this.room.updateMembership(message.uid, change);
    }

    @on('connection.event.updateConfig')
    @action.bound
    handleUpdateConfig(newConfig) {
        let oldConfig = {...this.room.config};
        this.room.config = newConfig;
        if (this.room.config.mode != oldConfig.mode) {
            this.stopRecording();
            if (this.connection.stream) {
                // restart local media if started
                this.setupLocalMedia();
            }
        }
        if (this.room.config.videoBitrate != oldConfig.videoBitrate) {
            this.stopRecording();
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
        return this.connection.runAction('updateConfig', config);
    }

    async openFS() {
        /**
         * Open the filesystem.
         */
        await this.fs.open();
    }

    async initialize() {
        // set up the storage here
        if (this.room.memberships.selfId != null) {
            await this.connect();
        }
    }

    @action
    async initialJoin(data) {
        let res = await this.connection.initialJoin(data);
        runInAction(() => {
            this.room.memberships.selfId = res.uid;
            this.recorder.extraAttrs.uid = res.uid;
            this.room.recordingStore.selfId = res.uid;
        });
        await this.initialize();
    }

    @action.bound
    updateResources(data) {
        this.room.memberships.self.resources = data;
        this.connection.sendEvent('updateStatus', {resources:data}, {http:false});
    }

    @action
    async setupLocalMedia() {
        let audio = true;
        let video = this.room.config.mode == 'video';
        let mediaStream;
        if (_.includes(navigator.userAgent, 'Firefox')) {
            mediaStream = await navigator.mediaDevices.getUserMedia({
                audio,
                video: {
                    height: {
                        min: 240,
                        ideal: 2160,
                        max: 2160
                    }
                }
            });
        }
        else {
            mediaStream = await navigator.mediaDevices.getUserMedia({
                audio,
                video: video && {
                    optional: [
                        {minHeight: 240},
                        {minHeight: 480},
                        {minHeight: 576},
                        {minHeight: 720},
                        {minHeight: 1080},
                        {minHeight: 1440},
                        {minHeight: 2160},
                    ]
                }
            });
        }
        runInAction( () => {
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
}