import _ from 'lodash';
import fileMixin from 'lib/fs/filemixin';
import {ListStore} from 'lib/store';
import {autorun, observable, computed, action, whyRun} from 'mobx';
import uuid from 'node-uuid';
import config from 'app/config';
import moment from 'moment';
import {formatDuration} from 'lib/util';
import {clock} from 'lib/util';

let mimesMap = {
    'audio/wav': 'wav',
    'video/webm': 'webm',
    'video/x-matroska': 'mkv',
    'audio/ogg': 'ogg',
};

export class Recording {
    @observable started = null;
    @observable ended = null;
    @observable filesize = null;
    type = null;
    uid = null;
    room = null;
    id = null;
    @observable blobUrl = null;
    @observable lastBitrate;

    @computed get niceFilename() {
        let name = this.membership.name;
        let niceDuration = formatDuration(this.duration);
        let niceDate = this.startDate.format('YYYY-MM-DD');
        return `${name} - ${niceDuration} - ${niceDate}.${this.getFileExt()}`;
    }

    @computed get membership() {
        return this.room.memberships.get(this.uid);
    }

    @computed get startDate() {
        return moment(this.started);
    }

    @computed get endDate() {
        return moment(this.ended);
    }

    @computed get duration() {
        return ((this.ended || this.store.time) - this.started) / 1000;
    }

    @computed get bitrate() {
        return this.filesize / this.duration;
    }

    @computed get directory() {
        return `${config.recordings.baseDir}${this.room.id}`;
    }

    getFileExt() {
        return mimesMap[this.type.split(';')[0]];
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

    @computed get fileTransfer() {
        return this.store.fileTransfers && this.store.fileTransfers.receiverForFileId(`recording:${this.id}`);
    }
 
    serialize() {
        return {
            started: this.started && +(this.started),
            ended: this.ended && +(this.ended),
            filesize: this.filesize,
            type: this.type,
            uid: this.uid,
            id: this.id,
            roomId: this.room.id,
        };
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
    @observable time = null;
    @observable.ref fileTransfers = null;

    setupAutoSaveForRoom(room) {
        this.autoSaveDisposer = autorun(() => this.saveToLocalStorage(room));
    }

    saveToLocalStorage(room) {
        console.log('Saved items to local storage!');
        localStorage.setItem(
            `recordings:forRoom:${room.id}`,
            JSON.stringify(_.map(
                _.filter(this.items.slice(), (r) => (
                    r.room == room &&
                    r.uid == this.selfId
                )),
                r => r.serialize()
            ))
        );
    }

    loadFromLocalStorage(room) {
        let json = localStorage.getItem(`recordings:forRoom:${room.id}`);
        if (json) {
            this.update(_.map(
                JSON.parse(json),
                (x) => {
                    x.room = room;
                    return x;
                }
            ));
        }
    }

    constructor({recordings, fs, selfId} = {}) {
        super();
        this.fs = fs;
        this.time = new Date();
        this.selfId = selfId;
        if (recordings) {
            this.update(recordings);
        }
        clock.on('tick', this.tick);
    }

    @action.bound tick() {
        this.time = new Date();
    }

    isLocal(data) {
        return (data.uid == this.selfId || !data.id);
    }

    createItemInstance(data) {
        let recording;
        if (this.isLocal(data)) {
            recording = new LocalRecording({...data, id: data.id || uuid.v4()}, {store: this});
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