import { observable, action, runInAction } from "mobx";
import { bindEventHandlers, on } from 'lib/actions';

import RoomConnection from './connection';
import Recorder from 'app/recordings/recorder';
import {MESSAGE_TYPES, MEMBER_STATUSES} from 'app/rooms/constants';
import _ from 'lodash';

export default class RoomController {
    constructor(opts = {}) {
        this.room = opts.room;
        this.logger = opts.logger;
        this.fs = opts.fs;

        this.recorder = new Recorder({
            store: this.room.recordingStore,
            fs: this.fs
        });
        this.connection = new RoomConnection({
            room: this.room,
            urls: opts.urls,
        });

        bindEventHandlers(this);
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

    @on('connection.peerAdded')
    @action.bound
    handlePeerAdded(peer) {
        this.room.recordingStore.update(peer.info.recordings);
        this.room.updateMembership(peer.uid, {
            status: MEMBER_STATUSES.CONNECTED,
            role: peer.info.role,
            currentRecordingId: peer.info.currentRecordingId,
            peer: peer,
            name: peer.info.name,
            diskUsage: peer.info.diskUsage,
        });
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

    // @on('connection.event.uploadRecordingRequest')
    // @action.bound
    // async uploadRecordingToHost(recordingId) {
    //     let blob = await this.room.recordingStore.get(recordingId).getFileBlob();
    //     this.connection.startFileUpload(this.room.owner, blob);
    // }

    @on('connection.message')
    @action.bound
    receiveMessage(message) {
        this.room.messageStore.addMessage(message);
        // TODO: if it's an update event, don't add it to the message store -
        // instead look for the last one
    }

    @action.bound
    sendEvent(type, data) {
        let promise = this.connection.sendEvent(type, data, {http:true});
        return this.room.messageStore.addMessage({
            type: MESSAGE_TYPES.EVENT,
            payload: {type, data},
            room: this.room,
        }, {sendPromise: promise});
    }

    @on('connection.event.updateStatus')
    @action.bound
    handleStatusUpdate(change, message) {
        this.room.updateMembership(message.uid, change);
    }

    @on('connection.join')
    @action.bound
    async handleJoinRoom(data, message) {
        _.each(
            data.members,
            (m) => this.room.updateMembership(m.uid, {
                status: m.peerId ? MEMBER_STATUSES.CONNECTED : MEMBER_STATUSES.DISCONNECTED,
                role: m.info.role,
                name: m.info.name,
                uid: m.uid,
                diskUsage: m.info.diskUsage,
            })
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

    @on('connection.event.updateRecordingStatus')
    @action.bound
    handleRecordingStatusUpdate(change) {
        this.room.recordingStore.update([change]);
    }

    @action.bound
    requestStartRecording(user) {
        return this.connection.runAction('startRecording', {id:user.id});
    }

    @action.bound
    requestStopRecording(user) {
        return this.connection.runAction('stopRecording', {id:user.id});
    }

    @on('fs.diskUsageUpdate')
    @action.bound
    handleLocalDiskUsageUpdate(diskUsage) {
        this.room.memberships.self.diskUsage = diskUsage;
        this.connection.sendEvent('updateStatus', {diskUsage}, {http: false});
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
        });
        await this.initialize();
    }

    @action
    async setupLocalMedia({audio = true, video = true} = {}) {
        let mediaStream = await navigator.mediaDevices.getUserMedia({
            audio,
            video: video && {
                optional: [
                    {minWidth: 320},
                    {minWidth: 640},
                    {minWidth: 1024},
                    {minWidth: 1280},
                    {minWidth: 1920},
                    {minWidth: 2560},
                    {minWidth: 3840},
                ]
            }
        });
        runInAction( () => {
            this.recorder.setStream(mediaStream);
            this.connection.connectStream(mediaStream);
        });
    }

    async connect() {
        await this.connection.connect();
    }

    get self() {
        return this.room.userStore.self;
    }
}