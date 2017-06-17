import _ from 'lodash';
import {observable, action, runInAction, computed} from 'mobx';
import WildEmitter from 'wildemitter';
import Logger from 'lib/logger';

import {CHUNK_SIZE, CHUNKS_PER_BLOCK, STATUSES} from '../index';
import {clock} from 'lib/util';
import {formatBytes} from 'app/ui/helpers';

export default class FileReceiver extends WildEmitter {
    @observable.ref metadata;
    @observable status;
    @observable bitrate = 0;
    @observable numDownloadedChunks = 0;
    @observable numSavedChunks = 0;

    constructor({channel, uid, fileId, fs, logger, status}) {
        super();
        this.fileId = fileId;
        this.channel = channel;
        this.chunkSize = CHUNK_SIZE;
        this.fromUid = uid;
        this.fs = fs;
        this.logger = new Logger(logger, `FileReceiver:${fileId}`);
        this.loadFromLocalStorage();
        this.numDownloadedChunks = 0;
        this.downloadSamples = []; // for measuring bitrate
        this.block = [];
        if (channel) {
            this.status = STATUSES.INPROGRESS;
            this.channel.onmessage = this.onChannelMessage.bind(this);
        }
        else {
            this.status = status != null ? status : STATUSES.DISCONNECTED;
        }
        this.on('receiveChunk',
            //_.throttle(
                (r, chunkIndex) => {
                    this.logger.log(`Received chunk ${chunkIndex + 1} of ${this.numChunks} (@ ${formatBytes(this.bitrate)}/s)`);
                }
            // , 500)
        );
    }

    @computed get numChunks() {
        return Math.ceil(this.metadata.size / this.chunkSize);
    }

    @action setChannel(channel) {
        this.channel = channel;
        this.channel.onmessage = this.onChannelMessage.bind(this);
        this.channel.onclose = action(() => {
            if (this.status == STATUSES.INPROGRESS) {
                this.status = STATUSES.DISCONNECTED;
            }
            this.emit('disconnect', this);
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
        this.logger.info("Metadata received - starting transfer", metadata);
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
        this.file = await this.fs.getFile(`transfers/${this.fileId}`);
        this.emit('started', this);
        this.runTransfer();
    }

    @computed get isComplete() {
        return this.status == STATUSES.COMPLETED;
    }

    @action complete() {
        this.logger.log('Complete!');
        this.status = STATUSES.COMPLETED;
        this.channel.close();
        this.saveToLocalStorage();
        this.emit('complete', this);
    }

    runTransfer() {
        this.logger.log('Chunk transfer started...');
        clock.on('tick', this.updateBitrate);
        this.once('complete', () => clock.off('tick', this.updateBitrate));
        let start = async () => {
            while (!this.isComplete && this.channel.readyState == "open") {
                let block = await this.requestNextBlock();
                if (block.length) {
                    let chunksInBlock = block.length;
                    await this.appendBlock(block);
                    this.block = [];
                    runInAction(() => {
                        this.numSavedChunks += chunksInBlock;
                        this.logger.log(`Wrote ${block.length} chunks to filesystem (total: ${this.numSavedChunks})`);
                        this.saveToLocalStorage();
                        this.emit("write", this);
                        if (this.numSavedChunks == this.numChunks) {
                            this.complete();
                        }
                    });
                }
            }
        };
        start();
    }

    sendMessage(type, data) {
        return this.channel.send(JSON.stringify({type, ...data}));
    }

    requestNextBlock() {
        return new Promise((resolve, reject) => {
            let chunkIndex = this.numDownloadedChunks;
            let lastChunk = Math.min(chunkIndex + CHUNKS_PER_BLOCK, this.numChunks);

            let fn = () => {
                let blockFull = this.block.length == CHUNKS_PER_BLOCK || this.numDownloadedChunks == this.numChunks;
                if (blockFull || this.numDownloadedChunks == this.numChunks) {
                    this.logger.info('Block filled')
                    this.off('receiveChunk', fn);
                    resolve(this.block);
                }
            };
            this.on('receiveChunk', fn);
            this.on('disconnect', () => {
                this.off('receiveChunk', fn);
                this.off('disconnect', fn)
                resolve(this.block);
            })

            this.sendMessage('requestChunks', {
                index: chunkIndex,
            });
            this.logger.info(`Requested chunks ${parseInt(chunkIndex, 10)+1}-${lastChunk} of ${this.numChunks}`);
        });
    }

    async receiveChunk(buffer) {
        let {index: chunkIndex, blob: chunkBlob} = await this.decodeChunk(buffer);
        if (this.numDownloadedChunks != chunkIndex) {
            // sanity check - the messages should arrive in order as long
            // as we're using a reliable channel
            return;
        }
        runInAction(() => {
            this.block.push(chunkBlob);
            ++this.numDownloadedChunks;
            this.emit('receiveChunk', this, chunkIndex, chunkBlob);
            this.emit('progress', this, {
                bytes: this.downloadedBytes,
                total: this.metadata.size,
            });
            this.addDownloadSample(chunkBlob.size);
        });
    }

    saveToLocalStorage() {
        localStorage.setItem(`filetransfer:${this.fileId}`, JSON.stringify({
            numSavedChunks:this.numSavedChunks,
            metadata:this.metadata
        }));
    }

    @action loadFromLocalStorage() {
        let res = localStorage.getItem(`filetransfer:${this.fileId}`);
        if (res) {
            res = JSON.parse(res);
            this.numDownloadedChunks = this.numSavedChunks = res.numSavedChunks;
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

    @computed get downloadedBytes() {
        if (this.metadata == null) {
            return null;
        }
        if (this.numDownloadedChunks == this.numChunks) {
            return this.metadata.size;
        }
        else {
            return this.numDownloadedChunks * CHUNK_SIZE;
        }
    }

    appendBlock(block) {
        let blob = new Blob(block, {type: this.metadata.type});
        return this.file.append(blob);
    }
}

