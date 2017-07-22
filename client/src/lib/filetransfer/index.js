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
import {FrSdFileSender} from './http/sender.js';

export default class FileTransferManager {
    @observable.shallow receivers = []; // p2p receivers
    @observable.shallow senders = []; // both p2p and http senders

    constructor(connection, {getFileById}) {
        this.getFileById = getFileById;
        this.room = connection.room;
        this.fs = connection.fs;
        this.logger = connection.logger || new Logger(null, 'FileTransferManager');
    }

    sendFileToPeer(peer, file) {
        let channel = peer.getDataChannel('filetransfer:' + uuid(), {ordered: true});
        let sender = new FileSender({peer, channel, file, logger: this.logger});
        this.senders.push(sender);
    }

    get numActive() {
        let iteratee = x => x.status == 1
        return _.sumBy(this.senders, iteratee) + _.sumBy(this.receivers, iteratee);
    }

    get hasActive() {
        return this.numActive > 0;
    }

    @action uploadFile(file, {fileId}) {
        let sender = new FrSdFileSender({
            fileId: fileId,
            file: file,
            logger: this.logger
        });
        sender.on('complete', () => this.saveToLocalStorage());
        sender.startUpload();
        this.senders.push(sender);
        this.saveToLocalStorage();
        return sender;
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
            this.saveToLocalStorage();
        }
        receiver.on('complete', () => this.saveToLocalStorage());
        receiver.start();
        return receiver;
    }
    receiversForUid(uid) {
        return _.filter(this.receivers, (r) => r.fromUid == uid && !r.isComplete);
    }
    saveToLocalStorage() {
        let instances = _.concat(
            _.map(this.receivers, r => ({
                fileId: r.fileId,
                uid: r.fromUid,
                status: r.status == STATUSES.COMPLETED ? r.status : STATUSES.DISCONNECTED,
                type: 'p2pReceiver'
            })),
            _.map(_.filter(this.senders, x => x instanceof FrSdFileSender), s => ({
                status: s.status == STATUSES.COMPLETED ? s.status : STATUSES.DISCONNECTED,
                type: 'httpSender',
                fileId: s.fileId,
            }))
        );
        console.log('Instances:');
        console.log(instances);
        localStorage.setItem(
            `filetransfer:forRoom:${this.room.id}`, JSON.stringify(instances)
        );
    }
    @action loadFromLocalStorage() {
        let res = localStorage.getItem(`filetransfer:forRoom:${this.room.id}`);
        this.receivers = [];
        this.senders = [];
        if (!res) {
            return;
        }
        for (let data of JSON.parse(res)) {
            if (data.type == 'p2pReceiver') {
                this.receivers.push(new FileReceiver({
                    fs: this.fs,
                    logger: this.logger,
                    ...data,
                }));
            }
            else if (data.type == 'httpSender') {
                this.senders.push(new FrSdFileSender({
                    getFileById: this.getFileById,
                    ...data,
                    logger: this.logger
                }));
            }
        }
        this.loadedFromLocalStorage = true;
    }
    receiverForFileId(fileId) {
        return _.find(this.receivers, r => r.fileId == fileId);
    }
}

