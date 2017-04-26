import WildEmitter from 'wildemitter';
import moment from 'moment';
import WAVAudioRecorder from 'lib/wavrecorder/recorder';
import { Logger } from 'lib/logger';
import { observable, action } from 'mobx';
import _ from 'lodash';
import { isVideo } from 'lib/util';

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
        let defaults =
            {recordingPeriod: 1000};

        opts = _.extend({}, defaults, opts);

        super();

        this.store = opts.store;
        this.recordingPeriod = opts.recordingPeriod;
        this.extraAttrs = opts.extraAttrs || {};
        // this.roomId = opts.roomId;

        this.logger = opts.logger != null ? opts.logger : new Logger(null, 'Recorder');
    }

    /**
     * Attaches a recorder to a stream and bind the events,
     * then marks the instance as ready to record.
     *
     * @private
     * @param {MediaStream} stream - the stream to record
     */
    setupMediaRecorder(stream) {
        if (isVideo(stream)) {
            this.mediaRecorder = new MediaRecorder(stream);
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
        if (((this.mediaRecorder != null) && this.status === 'recording') || this.status === 'stopping') {
            // tear down
            this.mediaRecorder.stop();
            this.once('stopped', function() {
                this.status = null;
                this.setupMediaRecorder(stream);
            });
        }

        this.setupMediaRecorder(stream);
    }

    onStart(e) {
        console.log(this)
        console.log(this.currentRecording)
        this.logger.info('Recording started.');
        this.emit('started', this.currentRecording);
        if (this.currentRecording.started == null) {
            this.currentRecording.started = new Date;
        }
    }

    onDataAvailable(e) {
        this.currentRecording.appendBlobToFile(e.data).then( () => {
            this.emit('blobWritten', e.data.size);
            this.logger.info(`Recorded ${e.data.size} bytes to ${this.currentRecording.filename}`);
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

    onStop(e) {
        if (this.currentRecording.stopped == null) {
            this.currentRecording.stopped = new Date;
        }
        if (this.mediaRecorder instanceof WAVAudioRecorder && this.currentRecording.filesize) {
            this.mediaRecorder.fixWaveFile(this.currentRecording).then( () => {
                this.logger.log("fixed wave file!");
                this.status = 'ready';
                this.emit('stopped', this.currentRecording);
                this.emit('ready');
            }).catch( (err) => {
                this.logger.error("problem writing wavefile header");
                this.logger.error(err);
                this.logger.error(err.stack);
                this.emit('error', {message: "Problem writing wavefile header", details: err.message, err});
                this.status = 'ready';
                this.emit('stopped', this.currentRecording);
                this.emit('ready');
            });
        }
        else {
            this.status = 'ready';
            this.emit('stopped', this.currentRecording);
            this.emit('ready');
        }
        this.logger.info(`Recording ${this.currentRecording.filename} completed\n\tlength: ${this.currentRecording.duration} secs;\n\tsize: ${this.currentRecording.filesize} bytes`);
    }

    /**
     * If everything is set up, then start recording.
     * If not, wait and poll until it's ready, and then start.
     */
    @action
    start() {
        if (this.status === 'ready') {
            this.currentRecording = this.createRecording({
                type: this.mediaRecorder instanceof WAVAudioRecorder ? 'audio/wav' : 'video/webm'
            })
            this.status = 'started';
            this.logger.info('STATUS = "started"')
            this.mediaRecorder.start(this.recordingPeriod);
            this.currentRecording.started = new Date();
        }
        else {
            this.logger.warn("Not ready to start.");
            setTimeout(this.start, 250)
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
            this.currentRecording.stopped = new Date;
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