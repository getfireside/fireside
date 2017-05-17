import _ from 'lodash';
import {fileToArrayBuffer} from 'lib/fs/util';
import WildEmitter from 'wildemitter';
import {observable, action, runInAction, computed} from 'mobx';
import uuid from 'node-uuid';
import Logger from 'lib/logger';
import {clock} from 'lib/util';

let CHUNK_SIZE = 16000;
let CHUNK_STATES = {
    EMPTY: 0,
    REQUESTED: 1,
    COMPLETED: 2,
};

let STATUSES = {
    DISCONNECTED: 0,
    INPROGRESS: 1,
    COMPLETED: 2,
};


export default class FileTransferManager {
    @observable.shallow receivers = [];
    constructor(connection) {
        this.room = connection.room;
        this.fs = connection.fs;
        this.receivers = this.loadReceiversFromLocalStorage();
        this.senders = [];
    }
    sendFile(peer, file) {
        let channel = peer.getDataChannel('filetransfer:' + uuid(), {ordered:false});
        let sender = new FileSender({peer, channel, file});
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
            receiver = new FileReceiver({channel, uid: peer.uid, fileId, fs: this.fs});
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
            return _.map(JSON.parse(res), data => new FileReceiver({fs: this.fs, ...data}));
        }
        else {
            return [];
        }
    }
    receiverForFileId(fileId) {
        return _.find(this.receivers, r => r.fileId == fileId);
    }
}


class FileReceiver extends WildEmitter {
    @observable.ref metadata;
    @observable downloadedBytes;
    @observable status;
    @observable bitrate = 0;

    constructor({channel, uid, fileId, fs, logger, status}) {
        super();
        this.chunks = {};
        this.fileId = fileId;
        this.channel = channel;
        this.chunkSize = CHUNK_SIZE;
        this.fromUid = uid;
        this.numberConnections = 64;
        this.fs = fs;
        this.status = false;
        this.logger = logger != null ? logger : new Logger(null, 'FileReceiver');
        this.loadFromLocalStorage();
        this.downloadedBytes = this.getTotalBytesWritten() || null;
        this.downloadSamples = []; // for measuring bitrate;
        if (channel) {
            this.status = STATUSES.INPROGRESS;
            this.channel.onmessage = this.onChannelMessage.bind(this);
        }
        else {
            this.status = status != null ? status : STATUSES.DISCONNECTED;
        }
    }

    @action setChannel(channel) {
        this.channel = channel;
        this.channel.onmessage = this.onChannelMessage.bind(this);
        this.channel.onclose = action(() => {
            this.status = STATUSES.DISCONNECTED;
        });
        this.status = STATUSES.INPROGRESS;
    }

    requestMetadata() {
        this.sendMessage('requestMetadata');
        this.logger.info('Metadata requested');
    }

    onChannelMessage(evt) {
        if (typeof evt.data === 'string') {
            this.setMetadata(JSON.parse(evt.data));
        }
        else {
            this.receiveChunk(evt.data);
        }
    }

    start() {
        if (this.channel.readyState == 'open') {
            this.requestMetadata();
        }
        else {
            this.channel.onopen = () => {this.requestMetadata();};
        }
    }

    @action
    setMetadata({metadata}) {
        this.metadata = metadata;
        this.logger.info(['Metadata received', metadata, ' - starting transfer.']);
        this.startTransfer();
    }

    async getBlobURL() {
        if (this.file == null) {
            this.file = await this.fs.getFile(`transfers/${this.fileId}`);
        }
        let blob = await this.file.read();
        return URL.createObjectURL(blob);
    }

    async startTransfer() {
        if (_.isEmpty(this.chunks)) {
            // new transfer
            this.logger.info(`Preallocating ${this.metadata.size} bytes...`);
            await this.preallocateFile(`transfers/${this.fileId}`, this.metadata.size);
            this.logger.info(`Preallocated.`);
            this.initializeChunks();
            runInAction( () => { this.downloadedBytes = 0; });
        }
        else {
            this.file = await this.fs.getFile(`transfers/${this.fileId}`);
            this.logger.info('Got existing transfer file.');
        }
        this.emit('started', this);
        this.runTransfer();
    }

    @computed get isComplete() {
        return this.status == STATUSES.COMPLETED;
    }

    runTransfer() {
        this.logger.log('Chunk transfer started...');
        let startThread = async () => {
            while (!this.isComplete && this.channel.readyState == "open") {
                await this.requestNextChunk();
            }
        };
        for (let n = 0; n < this.numberConnections; ++n) {
            startThread();
        }
        clock.on('tick', this.updateBitrate);
        this.once('complete', () => clock.off('tick', this.updateBitrate));
    }

    sendMessage(type, data) {
        return this.channel.send(JSON.stringify({type, ...data}));
    }

    requestNextChunk() {
        return new Promise((resolve, reject) => {
            let chunkIndex = _.findKey(this.chunks,
                v => v == CHUNK_STATES.EMPTY
            );
            if (chunkIndex === undefined) {
                setTimeout(1000, resolve);
                return;
            }
            this.logger.info(`Requested chunk ${parseInt(chunkIndex, 10)+1} of ${Math.ceil(this.metadata.size / this.chunkSize)}`);
            this.updateChunkStatus(chunkIndex, CHUNK_STATES.REQUESTED);
            this.sendMessage('requestChunk', {
                index: chunkIndex,
            });
            let requested = new Date();
            let fn = (r, receivedChunkIndex) => {
                if (receivedChunkIndex == chunkIndex) {
                    resolve();
                }
            };
            this.on('receiveChunk', fn);
            setTimeout(() => {
                if (this.chunks[chunkIndex] == CHUNK_STATES.EMPTY) {
                    this.off('receiveChunk', fn);
                    resolve();
                }
            }, 20000);
        });
    }

    updateChunkStatus(chunkIndex, status) {
        this.chunks[chunkIndex] = status;
        this.saveToLocalStorage();
    }

    saveToLocalStorage() {
        localStorage.setItem(`filetransfer:${this.fileId}`, JSON.stringify({
            chunks:this.chunks,
            metadata:this.metadata
        }));
    }

    loadFromLocalStorage() {
        let res = localStorage.getItem(`filetransfer:${this.fileId}`);
        if (res) {
            res = JSON.parse(res);
            this.chunks = res.chunks;
            this.metadata = res.metadata;
        }
        else {
            this.chunks = {};
        }
    }

    async decodeChunk(buffer) {
        let chunkIndex = new DataView(buffer).getUint32();
        return {index: chunkIndex, blob: new Blob([buffer.slice(4)], {type: this.metadata.type})};
    }

    async receiveChunk(buffer) {
        let {index: chunkIndex, blob: chunkBlob} = await this.decodeChunk(buffer);
        await this.writeNthChunk(chunkIndex, chunkBlob);
        this.updateChunkStatus(chunkIndex, CHUNK_STATES.COMPLETED);
        this.logger.log(`Received chunk ${chunkIndex + 1} of ${Math.ceil(this.metadata.size / this.chunkSize)}`);
        runInAction(() => { this.downloadedBytes = this.getTotalBytesWritten(); });
        this.emit('receiveChunk', this, chunkIndex, chunkBlob);
        this.emit('progress', this, {
            bytes: this.downloadedBytes,
            total: this.metadata.size,
        });
        this.addDownloadSample(chunkBlob.size);
        if (_.every(_.values(this.chunks), v => v == CHUNK_STATES.COMPLETED)) {
            this.logger.log('Complete!');
            runInAction(() => {
                this.status = STATUSES.COMPLETED;
                this.channel.close();
                this.chunks = {};
                this.saveToLocalStorage();
                this.emit('complete', this);
            });
        }
    }

    addDownloadSample(size) {
        this.downloadSamples.push([new Date(), size]);
    }

    @action.bound
    updateBitrate() {
        let now = new Date();
        let samples = _.filter(this.downloadSamples.slice(-20), x => (now - x[0]) < 10000);
        if (samples.length) {
            this.bitrate = _.sumBy(samples, x => x[1]) / ((now - samples[0][0]) / 1000);
        }
        else {
            this.bitrate = 0;
        }
    }

    getTotalBytesWritten() {
        if (this.metadata == null) {
            return null;
        }
        let lastChunkSize = this.metadata.size % this.chunkSize;
        let lastChunkIndex = Math.ceil(this.metadata.size / this.chunkSize) - 1;
        return _.sum(_.map(this.chunks, (v, k) => {
            if (v == CHUNK_STATES.COMPLETED) {
                return k == lastChunkIndex ? lastChunkSize : this.chunkSize;
            }
            else {
                return 0;
            }
        }));
    }

    writeNthChunk(n, blob) {
        return this.file.write(blob, n*this.chunkSize);
    }

    initializeChunks() {
        for (let n = 0; n < Math.ceil(this.metadata.size / this.chunkSize); n++) {
            this.chunks[n] = CHUNK_STATES.EMPTY;
        }
    }

    async preallocateFile(filename, size) {
        this.file = await this.fs.getFile(filename);
        let writtenBytes = 0;
        try {
            while (writtenBytes < size) {
                let numBytes = Math.min(this.chunkSize, size - writtenBytes);
                await this.file.append(new Blob([new Uint8Array(numBytes)], {type: this.metadata.type}));
                writtenBytes += numBytes;
            }
            this.emit('preallocated', this);
            return this.file;
        }
        catch (e) {
            this.file.remove();
            throw e;
        }
    }
}

class FileSender {
    async encodeChunk(index, blob) {
        let buffer = new ArrayBuffer(4 + blob.size);
        let dataview = new DataView(buffer);
        dataview.setUint32(0, index);
        dataview = new Uint8Array(buffer);
        let blobBuffer = await fileToArrayBuffer(blob);
        let blobBufferView = new Uint8Array(blobBuffer);
        dataview.set(blobBufferView, 4);
        return buffer;
    }

    constructor({file, channel}) {
        // split file into chunks
        this.file = file;
        this.channel = channel;
        this.chunkSize = CHUNK_SIZE;
        this.channel.onmessage = this.onChannelMessage.bind(this);
    }

    sendMetadata() {
        this.channel.send(JSON.stringify({
            'metadata': {
                name: this.file.filename,
                size: this.file.filesize,
                type: this.file.type,
            },
        }));
    }

    onChannelMessage(evt) {
        this.onJSONMessage(JSON.parse(evt.data));
    }

    onJSONMessage(msg) {
        if (msg.type == 'requestMetadata') {
            this.sendMetadata();
        }
        if (msg.type == 'requestChunk') {
            this.sendNthChunk(msg.index);
        }
    }

    async sendNthChunk(n) {
        let chunk = await this.getNthChunk(n);
        let encoded = await this.encodeChunk(n, chunk);
        this.channel.send(encoded);
    }

    getNthChunk(n) {
        return this.file.readFileAt(n * this.chunkSize, this.chunkSize);
    }
}