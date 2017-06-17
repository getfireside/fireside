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

import FileReceiver from './p2p/receiver';
import FileSender from './p2p/sender';

export default class FileTransferManager {
    @observable.shallow receivers = []; // p2p receivers
    @observable.shallow senders = []; // both p2p and http senders

    constructor(connection) {
        this.room = connection.room;
        this.fs = connection.fs;
        this.receivers = this.loadFromLocalStorage();
        this.logger = connection.logger || new Logger(null, 'FileTransferManager');
    }
    sendFileToPeer(peer, file) {
        let channel = peer.getDataChannel('filetransfer:' + uuid(), {ordered: true});
        let sender = new FileSender({peer, channel, file, logger: this.logger});
        this.senders.push(sender);
    }
    uploadFile(file, {mode = 'http'}) {

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
        receiver.on('complete', () => this.saveToLocalStorage());
        receiver.start();
        return receiver;
    }
    receiversForUid(uid) {
        return _.filter(this.receivers, (r) => r.fromUid == uid && !r.isComplete);
    }
    saveToLocalStorage() {
        localStorage.setItem(
            `filetransfer:forRoom:${this.room.id}`,
            JSON.stringify(
                _.map(this.receivers, r => ({
                    fileId: r.fileId,
                    uid: r.fromUid,
                    status: r.status == STATUSES.COMPLETED ? r.status : STATUSES.DISCONNECTED,
                    type: 'p2pReceiver'
                })) +
                _.map(_.filter(this.senders, x => x instanceof HTTPFileSender), s => ({
                    status: s.status == STATUSES.COMPLETED ? s.status : STATUSES.DISCONNECTED,
                    type: 'httpSender',
                }))
            ),
        );
    }
    loadFromLocalStorage() {
        let res = localStorage.getItem(`filetransfer:forRoom:${this.room.id}`);
        if (res) {
            return _.map(JSON.parse(res), data => {
                if (data.type == 'p2pReceiver') {
                    return new FileReceiver({fs: this.fs, ...data, logger: this.logger});
                }
                else if (data.type == 'httpSender') {
                    return new HTTPFileSender({fs: this.fs, ...data, logger: this.logger});
                }
            });
        }
        else {
            return [];
        }
    }
    receiverForFileId(fileId) {
        return _.find(this.receivers, r => r.fileId == fileId);
    }
}

