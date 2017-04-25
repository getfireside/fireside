import _ from 'lodash';
import fileMixin from 'lib/fs/filemixin';
import {ListStore} from 'lib/store';
import {observable, computed} from 'mobx';
import uuid from 'node-uuid';
import config from 'app/config';

let mimesMap = {
    'audio/wav': 'wav',
    'video/webm': 'webm',
    'audio/ogg': 'ogg'
};

export class Recording {
    @observable started = null;
    @observable ended = null;
    @observable filesize = null;
    type = null;
    userId = null;
    room = null;

    @computed get duration() {
        return ((this.stopped || new Date()) - this.started) / 1000;
    }

    @computed get bitrate() {
        return this.filesize * 8 / this.duration;
    }

    @computed get directory() {
        return `${config.recordings.baseDir}${this.roomId}`;
    }

    getFileExt() {
        return mimesMap[this.type];
    }

    generateFilename() {
        return `${this.directory}/${this.id}.${this.getFileExt()}`;
    }

    constructor(attrs, opts) {
        _.extend(this, attrs);
        if (opts != null) {
            this.store = opts.store;
        }
        if (this.filename == null && this.id != null && this.directory != null) {
            this.filename = this.generateFilename();
        }
    }
}

export class LocalRecording extends fileMixin(Recording) {
    constructor(attrs, opts) {
        super(attrs, opts);
        this.fs = opts.store.fs;
    }
}

export default class RecordingStore extends ListStore {
    fs;
    directory;

    constructor({recordings, fs} = {}) {
        super();
        this.fs = fs;
        if (recordings) {
            this.update(recordings);
        }
    }

    createItemInstance(data) {
        let recording;
        if (!data.id) {
            recording = new LocalRecording({...data, id: uuid.v4()}, {store: this});
        }
        else {
            recording = new Recording(data, {store: this});
        }
        return recording;
    }

    forRoom(room) {
        return _.filter(this.items, m => m.room == room);
    }
}