import _ from 'lodash';
import FileMixin from 'lib/fs/filemixin.js'
import {observable, computed, action} from 'mobx';
import uuid from 'node-uuid'

let mimesMap = {
    'audio/wav': 'wav',
    'video/webm': 'webm',
    'audio/ogg': 'ogg'
}

export class Recording extends FileMixin {
    @observable started = null;
    @observable ended = null;
    type = null;
    userId = null;

    @computed get duration() {
        return ((this.stopped || new Date()) - this.started) / 1000;
    }

    @computed get bitrate() {
        return this.filesize * 8 / this.duration;
    }

    getFileExt() {
        return mimesMap[this.type];
    }

    generateFilename() {
        return `${this.directory}/${this.id}.${this.getFileExt()}`
    }

    constructor(attrs, opts) {
        super(attrs, opts)
        _.extend(this, attrs);
        if (opts != null) {
            this.directory = opts.directory;
            this.store = opts.store;
        }
        if (this.filename == null && this.id != null && this.directory != null) {
            this.filename = this.generateFilename();
        }
    }
}

export class RecordingStore {
    @observable recordings = [];
    fs;
    directory;

    constructor({recordings, fs, directory}) {
        this.recordings = [];
        if (recordings) {
            this.recordings = recordings;
        }
        this.fs = fs;
        this.directory = directory;
    }

    @action
    create(attrs) {
        console.log(this.recordings)
        let recording = new Recording(attrs, {store: this, directory: this.directory, fs: this.fs})
        recording.id = uuid.v4();
        this.recordings.push(recording);
        return recording;
    }

    get(id) {
        return _.find(this.recordings, (x) => x.id == id);
    }

    delete(id) {
        this.recordings = _.filter(this.recordings, (x) => x.id != id);
    }
}