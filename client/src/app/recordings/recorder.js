import WildEmitter from 'wildemitter';
// import moment from 'moment';
import WAVAudioRecorder from 'lib/wavrecorder/recorder';
import { Logger } from 'lib/logger';
import { observable, action } from 'mobx';
import _ from 'lodash';
import { isVideo, calculateBitrate } from 'lib/util';

/**
 * Manages the recording of a single stream.
 */
export default class Recorder extends WildEmitter {
    /**
     * @param  {obj} opts - options for this instance
     * @param {Store} opts.store - a store instance that will be used to create new recordings,
     * attached to a filesystem instance
     */
    @observable status = null;
    @observable currentRecording = null;
    @observable lastBitrate = null;
    @observable lastChunkTime = null;
    @observable diskUsage = null;

    constructor(opts) {
        let defaults = {recordingPeriod: 1000};

        opts = _.extend({}, defaults, opts);

        super();

        this.store = opts.store;
        this.recordingPeriod = opts.recordingPeriod;
        this.extraAttrs = opts.extraAttrs || {};
        this.videoCodecs = [
            'video/webm;codecs=avc1',
            'video/webm;codecs=vp9',
            'video/webm;codecs=vp8',
        ];
        this.supportedVideoCodecs = _.filter(this.videoCodecs, c => MediaRecorder.isTypeSupported(c));
        // this.roomId = opts.roomId;

        this.logger = new Logger(opts.logger, 'Recorder');
    }

    getVideoMimeType() {
        return this.supportedVideoCodecs[0];
    }

    getVideoBitrate() {
        if (this.videoBitrate == null) {
            return calculateBitrate(this.videoResolution[0] * this.videoResolution[1]);
        }
        else {
            return this.videoBitrate;
        }
    }

    getVideoResolution(stream) {
        return new Promise( (resolve) => {
            let v = document.createElement('video');
            v.srcObject = stream;
            v.onloadedmetadata = () => {
                resolve([v.videoWidth, v.videoHeight]);
            };
        });
    }

    /**
     * Attaches a recorder to a stream and bind the events,
     * then marks the instance as ready to record.
     *
     * @private
     * @param {MediaStream} stream - the stream to record
     */
    async setupMediaRecorder(stream) {
        if (isVideo(stream)) {
            this.videoResolution = await this.getVideoResolution(stream);
            this.mediaRecorder = new MediaRecorder(stream, {
                mimeType: this.getVideoMimeType(),
                videoBitsPerSecond: this.getVideoBitrate(),
                audioBitsPerSecond: 320*1024,
            });
        }
        else {
            this.mediaRecorder = new WAVAudioRecorder(stream, {
                logger: this.logger
            });
        }

        this.mediaRecorder.ondataavailable = this.onDataAvailable.bind(this);
        this.mediaRecorder.onstart = this.onStart.bind(this);
        this.mediaRecorder.onstop = this.onStop.bind(this);

        this.logger.info('STATUS = "ready"');
        this.status = 'ready';

        this.emit('ready');

        this.logger.info('Stream added- ready to record!');
    }

    /**
     * Sets the stream that will be recorded, tearing down any existing recording instance.
     * @param {MediaStream} stream - the stream to record
     */
    setStream(stream) {
        this.stream = stream;
        if (((this.mediaRecorder != null) && this.status === 'recording') || this.status === 'stopping') {
            // tear down
            this.mediaRecorder.stop();
            this.once('stopped', function() {
                this.status = null;
                if (this.mediaRecorder.destroy) {
                    this.mediaRecorder.destroy();
                }
                this.setupMediaRecorder(stream);
            });
        }

        this.setupMediaRecorder(stream);
    }

    onStart(e) {
        this.logger.info('Recording started.');
        if (this.currentRecording.started == null) {
            this.currentRecording.started = new Date;
        }
        this.emit('started', this.currentRecording);
    }

    onDataAvailable(e) {
        this.currentRecording.appendBlobToFile(e.data).then( () => {
            this.emit('blobWritten', e.data.size);
            this.logger.info(`Recorded ${e.data.size} bytes to ${this.currentRecording.filename}`);
            this.logger.info(`(New filesize: ${this.currentRecording.filesize})`);
            let now = new Date();
            this.lastBitrate = e.data.size / ((now - this.lastChunkTime) / 1000);
            this.lastChunkTime = now;
        }).catch(err => {
            this.logger.error(err);
            this.logger.error(err.stack);
            this.emit('error', {
                message: err.userMessage || err.name,
                details: err.message,
                err
            });
            this.stop();
        });
    }

    @action onStop(e) {
        if (this.currentRecording.ended == null) {
            this.currentRecording.ended = new Date;
        }
        if (this.mediaRecorder instanceof WAVAudioRecorder && this.currentRecording.filesize) {
            this.mediaRecorder.fixWaveFile(this.currentRecording).then( () => {
                this.logger.log("fixed wave file!");
                this.status = 'ready';
                setTimeout(() => {
                    this.emit('stopped', this.currentRecording);
                    this.logger.info(`Recording ${this.currentRecording.filename} completed\n\tlength: ${this.currentRecording.duration} secs;\n\tsize: ${this.currentRecording.filesize} bytes`);
                    setTimeout(() => {
                        this.setStream(this.stream);
                    }, 250);
                }, 250);
            }).catch( (err) => {
                this.logger.error("problem writing wavefile header");
                this.logger.error(err);
                this.logger.error(err.stack);
                this.emit('error', {message: "Problem writing wavefile header", details: err.message, err});
                this.status = 'ready';
                setTimeout(() => {
                    this.emit('stopped', this.currentRecording);
                    this.logger.info(`Recording ${this.currentRecording.filename} completed\n\tlength: ${this.currentRecording.duration} secs;\n\tsize: ${this.currentRecording.filesize} bytes`);
                    setTimeout(() => {
                        this.setStream(this.stream);
                    }, 250);
                }, 250);
            });
        }
        else {
            setTimeout(() => {
                this.status = 'ready';
                this.emit('stopped', this.currentRecording);
                this.logger.info(`Recording ${this.currentRecording.filename} completed\n\tlength: ${this.currentRecording.duration} secs;\n\tsize: ${this.currentRecording.filesize} bytes`);
                setTimeout(() => {
                    this.setStream(this.stream);
                }, 250);
            }, 250);
        }
    }

    /**
     * If everything is set up, then start recording.
     * If not, wait and poll until it's ready, and then start.
     */
    @action
    start() {
        if (this.status === 'ready') {
            this.currentRecording = this.createRecording({
                type: this.mediaRecorder instanceof WAVAudioRecorder ? 'audio/wav' : this.mediaRecorder.mimeType
            });
            this.status = 'started';
            this.logger.info('STATUS = "started"');
            this.mediaRecorder.start(this.recordingPeriod);
            this.currentRecording.started = new Date();
        }
        else {
            this.logger.warn("Not ready to start.");
            setTimeout(this.start, 250);
        }
    }

    /**
     * If there's currently a recording, stop.
     */
    @action
    stop() {
        if (this.status === 'started') {
            this.emit('stopping');
            this.status = 'stopping';
            this.mediaRecorder.stop();
            this.currentRecording.ended = new Date;
        }
        else {
            this.logger.warn("Not started!");
        }
    }

    async destroy() {
        console.warn('Destroying...')
        if (this.mediaRecorder instanceof WAVAudioRecorder) {
            await this.mediaRecorder.destroy();
        }
        return;
    }


    /**
     * Create a new recording instance using the store.
     */
    createRecording(attrs) {
        return this.store.create(_.extend({}, attrs, this.extraAttrs));
    }
}