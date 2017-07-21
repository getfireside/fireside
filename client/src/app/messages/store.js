import {observable, action, runInAction, computed} from 'mobx';
import {ListStore} from 'lib/store';
import _ from 'lodash';
import {MESSAGE_ENCODING_KEYS, MESSAGE_TYPES_INVERSE} from 'app/rooms/constants';
import moment from 'moment';
import {camelizeKeys, camelize} from 'lib/util';

export class Message {
    room = null;
    type = null;
    payload = null;
    store = null;
    @observable id = null;
    @observable uid = null;
    @observable peerId = null;
    @observable timestamp = null;
    @observable err = null;
    @observable status = null;

    constructor(attrs={}) {
        _.extend(this, attrs);
    }

    static decode(encoded) {
        return _.fromPairs(_.map(MESSAGE_ENCODING_KEYS, (v, k) => [v, encoded[k]]));
    }

    @computed get typeName() {
        return MESSAGE_TYPES_INVERSE[this.type].toLowerCase();
    }

    @computed get time() {
        return moment(this.timestamp);
    }

    @computed get member() {
        return this.room.memberships.get(this.uid);
    }

    @computed get memberDisplayName() {
        if (this.member != null) {
            return this.member.isSelf ? "You" : this.member.name;
        }
        return null;
    }

    @computed get recording() {
        if (
            _.includes([
                "uploadStarted",
                "uploadComplete",
                "startRecording",
                "stopRecording",
            ], this.payload.type)
        ) {
            return this.room.recordingStore.get(this.payload.data.id);
        }
    }
}

export default class MessageStore extends ListStore {
    @action addMessage(message, {sendPromise = null} = {}) {
        message = new Message({...message, store: this});
        if (message.timestamp == null) {
            message.timestamp = +(new Date);
        }
        if (sendPromise) {
            // we're sending the message
            message.status = 'pending';
            this.items.push(message);
            this.sendPromise = sendPromise;
            sendPromise
                .then(action(() => {
                    message.status = 'sent';
                }))
                .catch(action(err => {
                    message.err = err;
                    message.status = 'error';
                }));
        }
        else {
            message.status = 'received';
            this.items.push(message);
        }
        this.emit('message', message);
        return message;
    }

    forRoom(room) {
        return _.sortBy(
            _.filter(this.items, m => m.room == room),
            x => x.timestamp
        );
    }

    createItemInstance(data) {
        return new Message({...data, store: this});
    }

    updateFromServer(updates, room) {
        updates = _.map(updates, u => {
            u = camelizeKeys(u);
            if (u.type == 'e') {
                u.payload.type = camelize(u.payload.type);
            }
            if (room) {
                u.room = room;
            }
            return u;
        });
        if (room) {
            updates = _.map(updates, x => _.set(x, 'room', room));
        }
        return this.update(updates);
    }

    constructor({messages}) {
        super();
        if (messages) {
            this.update(messages);
        }
    }
}