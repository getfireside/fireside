import {observable, action, computed} from 'mobx';
import _ from 'lodash';

export class UserRoomConnection {
    userId = null;
    @observable.ref currentRecording = null;
    @observable role = null;
    @observable status = null;

    constructor({room, userId, currentRecordingId, role, status}) {
        this.room = room;
        this.user = this.room.userStore.get(userId);
        this.role = role;
        this.status = status;
        this.currentRecording = this.room.recordingStore.get(currentRecordingId);
        this.role = role;
    }

    update(data) {
        _.extend(this, data);
    }
}

export default class Room {
    @observable userConnections = observable.map();
    userStore = null;
    messageStore = null;
    recordingStore = null;
    id = null;
    owner = null;

    constructor({userStore, messageStore, recordingStore, id, owner}) {
        this.userStore = userStore;
        this.messageStore = messageStore;
        this.recordingStore = recordingStore;
        this.id = id;
        this.owner = owner;
    }

    @computed get recordings() {
        return this.recordingStore.forRoom(this);
    }

    @computed get messages() {
        return this.messageStore.forRoom(this);
    }

    @action updateUserConnection(userId, data) {
        const user = this.userStore.get(userId);
        let userConnection = this.userConnections.get(userId);
        if (userConnection == null) {
            this.userConnections.set(userId, new UserRoomConnection({...data, room: this, userId}));
        }
        else {
            userConnection.update(data);
        }
    }
}