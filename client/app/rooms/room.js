import {observable, action, computed, ObservableMap} from 'mobx';
import {ROLES_INVERSE} from './constants';
import _ from 'lodash';

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

    @computed get isSelf() {
        return this.uid === this.room.memberships.selfId;
    }

    @computed get recordings() {
        return this.room.recordings.filter(u => u.uid == this.uid);
    }

    @computed get roleName() {
        return ROLES_INVERSE[this.role].toLowerCase();
    }

    constructor({uid, room, name, currentRecordingId, role, status, peer, peerId}) {
        this.uid = uid;
        this.room = room;
        this.name = name;
        this.role = role;
        this.status = status;
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
    }

    update(data) {
        _.extend(this, data);
    }
}

class RoomMembershipsMap extends ObservableMap {
    @observable selfId = null;
    @computed get self() {
        return this.get(this.selfId);
    }
    @computed get others() {
        return this.values().filter(m => m.id != this.selfId);
    }
    constructor(...args) {
        return super(...args);
    }
}

export default class Room {
    @observable memberships = new RoomMembershipsMap;
    @observable.ref messageStore = null;
    @observable.ref recordingStore = null;
    id = null;
    ownerId = null;

    constructor({messageStore, recordingStore, id, ownerId, selfId}) {
        this.messageStore = messageStore;
        this.recordingStore = recordingStore;
        this.id = id;
        this.ownerId = ownerId;
        this.memberships.selfId = selfId;
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