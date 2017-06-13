import _ from 'lodash';
import {fileToArrayBuffer} from 'lib/fs/util';
import WildEmitter from 'wildemitter';
import {observable, action, runInAction, computed} from 'mobx';
import uuid from 'node-uuid';
import Logger from 'lib/logger';
import {clock} from 'lib/util';

export const CHUNK_SIZE = 16000;
export const CHUNKS_PER_BLOCK = 64;

export const STATUSES = {
    DISCONNECTED: 0,
    INPROGRESS: 1,
    COMPLETED: 2,
};

import FileReceiver from './receiver';
import FileSender from './sender';

export default class FileTransferManager {
    @observable.shallow receivers = [];
    constructor(connection) {
        this.room = connection.room;
        this.fs = connection.fs;
        this.receivers = this.loadReceiversFromLocalStorage();
        this.senders = [];
        this.logger = connection.logger || new Logger(null, 'FileTransferManager');
    }
    sendFile(peer, file) {
        let channel = peer.getDataChannel('filetransfer:' + uuid(), {ordered:true});
        let sender = new FileSender({peer, channel, file, logger: this.logger});
        this.senders.push(sender);
    }
    @action receiveFile({channel, peer, fileId}) {
        let receiver = this.receiverForFileId(fileId);
        if (receiver) {
            receiver.fromUid = peer.uid;
            receiver.setChannel(channel);
            receiver.fs = this.fs;
        }
        else {
            receiver = new FileReceiver({channel, uid: peer.uid, fileId, fs: this.fs, logger: this.logger});
            this.receivers.push(receiver);
            this.saveReceiversToLocalStorage();
        }
        receiver.on('complete', () => this.saveReceiversToLocalStorage());
        receiver.start();
        return receiver;
    }
    receiversForUid(uid) {
        return _.filter(this.receivers, (r) => r.fromUid == uid && !r.isComplete);
    }
    saveReceiversToLocalStorage() {
        localStorage.setItem(
            `filetransfer:forRoom:${this.room.id}`,
            JSON.stringify(_.map(this.receivers, r => ({
                fileId: r.fileId,
                uid: r.fromUid,
                status: r.status == STATUSES.COMPLETED ? r.status : STATUSES.DISCONNECTED,
            }))),
        );
    }
    loadReceiversFromLocalStorage() {
        let res = localStorage.getItem(`filetransfer:forRoom:${this.room.id}`);
        if (res) {
            return _.map(JSON.parse(res), data => new FileReceiver({fs: this.fs, ...data, logger: this.logger}));
        }
        else {
            return [];
        }
    }
    receiverForFileId(fileId) {
        return _.find(this.receivers, r => r.fileId == fileId);
    }
}

