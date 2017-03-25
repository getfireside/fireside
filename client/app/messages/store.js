import {observable, action} from 'mobx';

export default class MessageStore {
    @observable messages = [];

    @action addReceivedMessage() {

    }

    @action addSendingMessage() {

    }
}