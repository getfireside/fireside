import {observable, action} from "mobx";
import { bindEventHandlers, on } from 'lib/actions'

import RoomConnection from './connection';
import Recorder from 'app/recordings/recorder';

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
        });

        bindEventHandlers(this);
    }

    @on('connection.event.startRecordingRequest')
    @action.bound
    startRecording() {
        this.recorder.start();
    }

    @on('connection.event.stopRecordingRequest')
    @action.bound
    stopRecording() {
        this.recorder.stop();
    }

    @on('connection.peerAdded')
    @action.bound
    handlePeerAdded(peer) {
        this.room.userStore.update([peer.info.userInfo]);
        this.room.recordingStore.update(peer.info.recordings);
        this.room.updateUserConnection(peer.uid, {
            status: 'connected',
            role: peer.info.role,
            currentRecordingId: peer.info.currentRecordingId,
            peer: peer
        });
    }

    @on('connection.peerRemoved')
    @action.bound
    handlePeerRemoved({userId}) {
        this.room.updateUserConnection(userId, {
            status: 'disconnected',
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
    }

    @action.bound
    sendMessage(message) {
        let promise = this.connection.sendMessage(message);
        this.room.messageStore.addMessage(message, {sendPromise: promise});
    }

    @on('connection.event.updateStatus')
    @action.bound
    handleStatusUpdate(change) {
        this.room.updateUserConnection(change.userId, change.data);
    }

    @on('connection.event.updateRecordingStatus')
    @action.bound
    handleRecordingStatusUpdate(change) {
        this.room.recordingStore.update([change]);
    }

    @action.bound
    requestStartRecording(user) {
        this.connection.sendEvent('requestStartRecording', {id:user.id});
    }

    @action.bound
    requestStopRecording(user) {
        this.connection.sendEvent('requestStopRecording', {id:user.id});
    }

    async openFS() {
        /**
         * Open the filesystem.
         */
        return await this.fs.open();
    }

    async initialise() {
        /**
         * Open the filesystem and storages, then connect to the server
         */
        await this.openFS();
        // set up the storage here
        await this.connect()
    }

    async connect() {
        this.connection.connect();
    }

    get self() {
        return this.room.userStore.self;
    }
}