import _ from 'lodash';
import {observable, action, runInAction} from 'mobx';
import WildEmitter from 'wildemitter';
import Logger from 'lib/logger';
import {sleep} from 'lib/util/async';
import {clock} from 'lib/util';
import {fetchPost, fetchPutBlob, fetchJSON} from 'lib/http';
import {STATUSES} from '../index';


export class HttpFileSender extends WildEmitter {
    @observable bitrate = 0;
    @observable numUploadedChunks = 0;
    @observable uploadedBytes = 0;
    @observable status = null;

    constructor({uploadId, fileId, file, logger, getFileById, status}) {
        super();
        // uploadId: an ID that identifies this particular upload
        // on the server
        this.uploadId = uploadId || null;
        // file ID: identifies the file on the client
        this.fileId = fileId;
        this.file = file || getFileById(fileId);
        this.chunkSize = this.getChunkSize();
        this.numChunks = Math.ceil(this.file.filesize / this.chunkSize);
        this.numUploadedChunks = 0;
        this.timeUntilNextRetry = 100;
        this.maxTimeUntilNextRetry = 30000;
        this.uploadSamples = []; // for measuring bitrate
        this.logger = new Logger(logger, `${this.constructor.name}:${this.fileId}`);
        this.status = status != null ? status : STATUSES.DISCONNECTED;
        this.uploadSamples = [];
        this.loadFromLocalStorage();
    }

    // TO BE DEFINED BY SUBCLASS
    async getNthChunkUploadUrl(n) {}
    getInitiateUploadUrl() {}
    getAbortUploadUrl() {}
    getCompleteUploadUrl() {}
    getChunkSize() {}

    async initiateUpload() {
        let url = this.getInitiateUploadUrl();
        let result = await fetchPost(url);
        return result.uploadId;
    }

    async startUpload() {
        runInAction(() => {
            this.status = STATUSES.INPROGRESS;
            this.emit('started', this);
        });
        if (!this.uploadId) {
            this.uploadId = await this.initiateUpload();
        }
        this.saveToLocalStorage();
        clock.on('tick', this.updateBitrate);
        this.once('complete', () => clock.off('tick', this.updateBitrate));
        // declare these outside the loop,
        // so that we don't have to repeatedly get the chunk from the FS
        // in case of HTTP upload failure.
        let chunk;
        let index;
        while (!this.isAborted) {
            this.saveToLocalStorage();
            try {
                if (this.numUploadedChunks == this.numChunks) {
                    await this.notifyComplete();
                    break;
                }
                else {
                    if (this.numUploadedChunks != index) {
                        index = this.numUploadedChunks;
                        chunk = await this.getNthChunk(index);
                    }
                    await this.sendNthChunk(index, chunk);
                    this.timeUntilNextRetry = 100;
                    this.numUploadedChunks++;
                }
            }
            catch (err) {
                if (err instanceof TypeError) {
                    await sleep(this.timeUntilNextRetry);
                    this.timeUntilNextRetry = Math.min(
                        this.timeUntilNextRetry * 1.5,
                        this.maxTimeUntilNextRetry
                    );
                }
                else {
                    this.emit('error', err);
                    throw err;
                }
            }
        }
    }

    async notifyComplete() {
        this.saveToLocalStorage();
        let url = this.getCompleteUploadUrl();
        let fileUrl = await fetchPost(url);
        runInAction(() => this.status = STATUSES.COMPLETED);
        this.completionTime = new Date();
        this.emit('complete', this, fileUrl);
    }

    async sendNthChunk(n, chunk) {
        let url = await this.getNthChunkUploadUrl(n);
        await fetchPutBlob(url, chunk, {
            onProgress: action(e => {
                let uploadedBytes = this.chunkSize * this.numUploadedChunks + e.loaded;
                let delta = uploadedBytes - this.uploadedBytes;
                this.uploadedBytes = uploadedBytes;
                this.emit('progress', this, {
                    bytes: uploadedBytes,
                    total: this.file.filesize
                });
                this.uploadSamples.push([new Date(), delta]);
            })
        });
    }

    @action.bound
    updateBitrate() {
        let now = new Date();
        let samples = _.filter(this.uploadSamples.slice(-20), x => (now - x[0]) < 10000);
        if (samples.length) {
            this.bitrate = _.sumBy(samples, x => x[1]) / ((now - samples[0][0]) / 1000);
        }
        else {
            this.bitrate = 0;
        }
    }

    getNthChunk(n) {
        let bytesLeft = this.file.filesize - n * this.chunkSize;
        return this.file.readFileAt(
            n * this.chunkSize,
            Math.min(this.chunkSize, bytesLeft)
        );
    }

    saveToLocalStorage() {
        localStorage.setItem(`filetransfer:${this.fileId}`, JSON.stringify({
            numUploadedChunks: this.numUploadedChunks,
            uploadId: this.uploadId,
        }));
    }
    loadFromLocalStorage() {
        let res = localStorage.getItem(`filetransfer:${this.fileId}`);
        if (res) {
            res = JSON.parse(res);
            this.numUploadedChunks = res.numUploadedChunks;
            this.uploadedBytes = Math.min(res.numUploadedChunks * this.chunkSize, this.file.filesize);
            this.uploadId = res.uploadId;
        }
    }
}

const MIN_CHUNK_SIZE = 5*1024*1024;
const MAX_CHUNKS = 10000;

export class FrSdFileSender extends HttpFileSender {
    getNthChunkUploadUrl(n) {
        return fetchPost(`/rooms/${window.fireside.room.id}/uploads/${this.fileId}/${this.uploadId}/chunks/${n}/`);
    }
    getInitiateUploadUrl() {
        return `/rooms/${window.fireside.room.id}/uploads/${this.fileId}/`;
    }
    getAbortUploadUrl() {
        return `/rooms/${window.fireside.room.id}/uploads/${this.fileId}/${this.uploadId}/abort/`;
    }
    getCompleteUploadUrl() {
        return `/rooms/${window.fireside.room.id}/uploads/${this.fileId}/${this.uploadId}/complete/`;
    }
    getChunkSize() {
        return Math.max(Math.ceil(this.file.filesize / MAX_CHUNKS), MIN_CHUNK_SIZE);
    }
}