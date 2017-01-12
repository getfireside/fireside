/**
 * TODO NEXT TIME
 * =============
 *  - check over code written for recorder and RTC
 *  - use https://github.com/marcuswestin/store.js for storage
 *  - write abstract store, model, collection objects
 *  - start writing actions to hook everything up
 *  - once done, IT'S UI TIME :D
 */




import {observable} from "mobx";
import { bindActionsToObject } from 'lib/actions'

import UserManager from 'app/users/manager';
import RecordingManager from 'app/recordings/manager';
import MessagesManager from 'app/messages/manager';

import RoomConnection from './connection';
import initFS from 'lib/fs/initfs';

import {recorderActions, messagesActions, usersActions, connectionActions} from './actions'

class Store() {

}

class RoomController {
    @observable status = {
        room: 'initialising',
        recording: 'initialising'
    }

    constructor(data, opts = {}) {
        this.store = opts.store || Store(data)
        this.fs = this.initFS();

        this.users = new UserManager(this.store.users);
        this.recordings = new RecordingManager(this.store.recordings, fs);
        this.messages = new MessagesManager(this.store.messages);

        this.connection = new RoomConnection();
        this.recorder = new Recorder(this.store.recordings, fs);

        this.logger = opts.logger;

        bindActionsToObject(recorderActions, this);
        bindActionsToObject(messagesActions, this);
        bindActionsToObject(usersActions, this);
        bindActionsToObject(connectionActions, this);
    }

    initFS() {
        return initFS({dbname: 'fireside-fs'});
    }

    async openFS() {
        /**
         * Open the filesystem.
         */
        return await this.fs.open();
    }

    async initialise() {
        /**
         * Open the filesystem and storages, then connect to the server
         */
        try {
            await this.openFS();
            // set up the storage here 
            await this.connect()
        }
        catch 
    }

    async connect() {
        this.connection.connect()
    }

    get self() {
        return this.users.self;
    }
}