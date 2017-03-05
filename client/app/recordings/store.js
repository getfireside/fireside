import _ from 'lodash';
import FileMixin from 'lib/fs/filemixin.js'
import {observable, computed} from 'mobx';

let mimesMap = {
    'audio/wav': 'wav',
    'video/webm': 'webm',
    'audio/ogg': 'ogg'
}

export class Recording extends FileMixin {
    @observable started = null;
    @observable ended = null;
    @observable type = null;
    @observable userId = null;

    @computed get duration() {
        return ((this.stopped || new Date()) - this.started) / 1000;
    }

    @computed get bitrate() {
        return this.duration / this.filesize;
    }

    getFileExt() {
        return mimesMap[this.type];
    }

    generateFilename() {
        return `${this.directory}/${this.id}.${this.getFileExt()}`
    }

    constructor(attrs, opts) {
        super(attrs, opts)
        this.directory = opts.directory;
        if (this.filename == null) {
            this.filename = this.generateFilename();
        }
    }
}