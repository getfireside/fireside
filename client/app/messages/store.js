import {observable, action, runInAction} from 'mobx';
import {ListStore} from 'lib/store';
import _ from 'lodash';

export class Message {
    roomId = null;
    type = null;
    user = null;
    message = null;
    store = null;
    @observable status = null;

    constructor(attrs={}) {
        _.extend(this, attrs);
        this.user = this.store.userStore.get(this.userId);
    }
}

export default class MessageStore extends ListStore {
    @action async addMessage(message, {sendPromise = null}) {
        message = new Message({...message, store: this});
        if (sendPromise) {
            // we're sending the message
            message.status = 'pending';
            this.items.push(message);
            try {
                await sendPromise;
                runInAction( () => {
                    message.status = 'sent';
                });
            }
            catch (err) {
                runInAction( () => {
                    message.err = err;
                    message.status = 'error';
                });
            }
        }
        else {
            message.status = 'received';
            this.items.push(message);
        }
    }

    forRoom(room) {
        return _.filter(this.items, m => m.roomId === room.id);
    }

    createItemInstance(data) {
        return new Message({...data, store: this});
    }

    constructor({userStore, messages}) {
        super();
        this.userStore = userStore;
        if (messages) {
            this.update(messages);
        }
    }
}