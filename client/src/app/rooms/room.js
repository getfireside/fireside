import {observable, action, computed, ObservableMap} from 'mobx';
import {ROLES_INVERSE, ROLES} from './constants';
import _ from 'lodash';
import {calculateBitrate, camelizeKeys} from 'lib/util';

export class RoomMembership {
    @observable.ref currentRecording = null;
    @observable role = null;
    @observable status = null;
    @observable peerId = null;
    @observable name = null;
    @observable.ref peer = null;
    @observable diskUsage = null;
    @observable resources = null;
    @observable recorderStatus = null;
    @observable peerStatus = null;
    @observable stream = null;
    @observable isNew;
    @observable onboardingComplete;

    @computed get isOwner() {
        return this.role == 'o';
    }

    @computed get isSelf() {
        return this.uid === this.room.memberships.selfId;
    }

    @computed get recordings() {
        return this.room.recordings.filter(u => u.uid == this.uid);
    }

    @computed get roleName() {
        return ROLES_INVERSE[this.role].toLowerCase();
    }

    @computed get approxMinutesLeft() {
        if (!this.diskUsage) {
            return null;
        }
        let freeSpace = this.diskUsage.quota - this.diskUsage.usage;
        let bitrate;
        if (this.room.config.mode == 'audio') {
            bitrate = 176375; // stereo wav @ 44.1khz
        }
        else {
            if (this.room.config.videoBitrate == null) {
                let numPixels;
                if (this.resources && this.resources.video && this.resources.video.width) {
                    numPixels = this.resources.video.width * this.resources.video.height;
                }
                else {
                    numPixels = 1280 * 720;
                }
                bitrate = 16000 + calculateBitrate(numPixels);
            }
            else {
                bitrate = 16000 + this.room.config.videoBitrate;
            }
        }
        return (freeSpace / bitrate) / 60;

    }

    constructor({
        uid,
        room,
        currentRecordingId,
        peer,
        peerId,
        ...data
    }) {
        this.uid = uid;
        this.room = room;
        if (currentRecordingId != null) {
            this.currentRecording = this.room.recordingStore.get(currentRecordingId);
        }
        if (peer) {
            this.peer = peer;
            this.peerId = peer.id;
        }
        else {
            this.peerId = peerId;
        }
        _.extend(this, data);
    }

    @action update(data) {
        _.extend(this, data);
    }
}

class RoomMembershipsMap extends ObservableMap {
    @observable selfId = null;
    @computed get self() {
        return this.get(this.selfId);
    }
    @computed get owner() {
        return this.values().find(m => m.role == ROLES.OWNER);
    }
    @computed get others() {
        return this.values().filter(m => m.id != this.selfId);
    }
    @computed get connected() {
        return this.values().filter(m => m.peerId != null);
    }
    constructor(...args) {
        return super(...args);
    }
}

export default class Room {
    @observable memberships = new RoomMembershipsMap;
    @observable.ref messageStore = null;
    @observable.ref recordingStore = null;
    @observable config = {
        videoBitrate: null,
        mode: null,
        debugMode: null,
        uploadMode: null,
    };
    id = null;
    ownerId = null;

    constructor({
        messageStore,
        recordingStore,
        id,
        owner,
        self,
        config,
    }) {
        this.messageStore = messageStore;
        this.recordingStore = recordingStore;
        this.id = id;
        if (self.id) {
            this.updateMembership(self.id, self);
        }
        this.updateMembership(owner.id, owner);
        this.memberships.selfId = self.id;
        this.config = camelizeKeys(config);
    }

    @computed get recordings() {
        return this.recordingStore.forRoom(this);
    }

    @computed get messages() {
        return this.messageStore.forRoom(this);
    }

    updateMessagesFromServer(updates) {
        this.messageStore.updateFromServer(updates, this);
    }

    @computed get url() {
        return `${window.location.origin}/${this.id}/`;
    }

    @action updateMembership(uid, data) {
        let membership = this.memberships.get(uid);
        if (membership == null) {
            this.memberships.set(uid, new RoomMembership({
                room: this,
                uid,
                ...data,
            }));
        }
        else {
            membership.update(data);
        }
    }
}