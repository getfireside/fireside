import WildEmitter from 'wildemitter';
import moment from 'moment';
import WAVAudioRecorder from './lib/wavrecorder/recorder.js';
import Logger from './logger.js';

function isVideo(stream) {
    let isVideo = (stream.getVideoTracks().length > 0);
}

/**
 * Manages the recording of a single stream. 
 */
export default class Recorder extends WildEmitter {
    /**
     * @param  {obj} opts - options for this instance
     * @param {FileSystem} opts.fs - an opened filesystem instance, to write the filesystems to
     * @param {Store} opts.store - a store instance that will be used to create new recordings
     */
    constructor(opts) {
        let defaults = 
            {recordingPeriod: 1000};

        opts = _.extend({}, defaults, opts);

        this.fs = opts.fs;
        this.store = opts.store;
        this.recordingPeriod = opts.recordingPeriod;
        // this.roomId = opts.roomId;

        this.logger = opts.logger != null ? opts.logger : new Logger;
        
        super(...arguments);
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
        this.currentRecording.set('started', new Date);
        this.logger.info('Recording started.');
        this.emit('started', this.currentRecording);
    }

    onDataAvailable(e) {
        this.logger.info(`Recorded ${e.data.size} bytes.`);
        this.currentRecording.appendBlob(e.data, err => {
            if (err) {
                this.logger.error(err);
                this.emit('error', {message: err.userMessage || err.name, details: err.message, err});
                this.stop();
            }
        });
    }

    onStop(e) {
        if (this.mediaRecorder instanceof WAVAudioRecorder) {
            this.mediaRecorder.fixWaveFile(this.currentRecording, (err) => {
                if (!err) {
                    this.logger.log("fixed wave file!");
                    this.emit('stopped', this.currentRecording);
                } else {
                    this.logger.error("problem writing wavefile header");
                    this.emit('error', {message: "Problem writing wavefile header", details: err.message, err});
                    this.emit('stopped', this.currentRecording);
                }
            });
        } 
        else {
            this.emit('stopped', this.currentRecording);
        }
        this.currentRecording.set('stopped', new Date);
        this.logger.info(`Recording completed - length: ${this.currentRecording.duration()} secs; size: ${this.currentRecording.get('filesize')} bytes`);
        this.status = 'ready';
        this.emit('ready');
    }

    /**
     * If everything is set up, then start recording. 
     * If not, wait and poll until it's ready, and then start.
     */
    start() {
        if (this.status === 'ready') {
            this.currentRecording = this.createRecording({
                type: this.mediaRecorder instanceof WAVAudioRecorder ? 'audio/wav' : 'video/webm'
            })
            this.mediaRecorder.start(this.config.recordingPeriod);
            this.status = 'started';
        } 
        else {
            this.logger.warn("Not ready to start.");
            setTimeout(this.start, 250)
        }
    }

    /**
     * If there's currently a recording, stop.
     */
    stop() {
        if (this.status === 'started') {
            this.emit('stopping');
            this.status = 'stopping';
            this.mediaRecorder.stop();
        } 
        else {
            this.logger.warn("Not started!");
        }
    }


    /**
     * Create a new recording instance using the store.
     */
    createRecording() {
        this.store.create({
            type: this.mediaRecorder instanceof WAVAudioRecorder ? 'audio/wav' : 'video/webm'
        });
    }
}