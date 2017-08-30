import _ from 'lodash';
import fileMixin from 'lib/fs/filemixin';
import {ListStore} from 'lib/store';
import {autorun, observable, computed, action, whyRun} from 'mobx';
import uuid from 'node-uuid';
import config from 'app/config';
import moment from 'moment';
import {formatDuration} from 'lib/util';
import {clock} from 'lib/util';
import { serverTimeNow } from 'lib/timesync';

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
    @observable url = null;
    @observable lastBitrate;
    @observable _fileTransfer;
    @observable duration = 0;
    @observable lastPausedAt = null;
    @observable isPaused = false;

    @computed get niceFilename() {
        let name = this.membership.name;
        let niceDuration = formatDuration(this.duration);
        let niceDate = this.startDate.format('YYYY-MM-DD');
        return `${name} - ${niceDuration} - ${niceDate}.${this.getFileExt()}`;
    }

    @computed get membership() {
        return this.room.memberships.get(this.uid);
    }

    @computed get isVideo() {
        return this.type.split('/')[0] == 'video';
    }

    @computed get startDate() {
        return moment(this.started);
    }

    @computed get endDate() {
        return moment(this.ended);
    }

    @computed get currentDuration() {
        if (this.ended || this.isPaused) {
            return this.duration;
        }
        else {
            return this.duration + Math.max(0, this.store.time - this.started) / 1000;
        }
    }

    @computed get bitrate() {
        return this.filesize / this.currentDuration;
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
        return (
            this._fileTransfer ||
            // getting the lengths here might not be strictly necessary.
            // added to make sure it recomputes when a sender or receiver is added.
            this.store.fileTransfers && (
                this.store.fileTransfers.senders.length ||
                this.store.fileTransfers.receivers.length
            ) && (
                this.store.fileTransfers.receiverForFileId(`recording:${this.id}`) ||
                this.store.fileTransfers.senderForFileId(`recording:${this.id}`)
            )
        );
    }

    set fileTransfer(obj) {
        this._fileTransfer = obj;
    }
 
    serialize({forLocal = false} = {}) {
        let res = {
            started: this.started && +(this.started),
            ended: this.ended && +(this.ended),
            filesize: this.filesize,
            type: this.type,
            uid: this.uid,
            id: this.id,
            roomId: this.room.id,
            duration: this.duration,
            isPaused: this.isPaused,
            lastPaused: this.lastPaused && +(this.lastPaused)
        };
        if (forLocal) {
            res.deleted = this.deleted;
        }
        return res;
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
        this.autosaveInitialRun = true;
        this.autoSaveDisposer = autorun(() => this.saveToLocalStorage(room));
    }

    saveToLocalStorage(room) {
        let toSave = _.map(
            _.filter(this.items.slice(), (r) => (
                r.room == room &&
                r.uid == this.selfId
            )),
            r => r.serialize({forLocal: true})
        );
        if (!this.autosaveInitialRun) {
            console.log('Saved items to local storage!');
            localStorage.setItem(
                `recordings:forRoom:${room.id}`,
                JSON.stringify(toSave)
            )
            this.autosaveInitialRun = false;
        }
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
        this.time = serverTimeNow();
        this.selfId = selfId;
        if (recordings) {
            this.update(recordings);
        }
        clock.on('tick', this.tick);
    }

    @action.bound tick() {
        this.time = serverTimeNow();
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