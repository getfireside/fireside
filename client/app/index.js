import ReactDOM from 'react-dom';
import React from 'react';

import initFS from 'lib/fs/initfs';
import {LoggingController} from 'lib/logger';

import {RecordingStore, MessageStore, UserStore} from 'app/stores';
import Room from 'app/rooms/room';
import RoomController from 'app/rooms/controller';
import UIApp from 'app/ui/components/app';
import UIStore from 'app/ui/store';
import {useStrict} from 'mobx';

useStrict(true);

export default class FiresideApp {
    constructor({roomData, opts}) {
        this.opts = opts;
        this.setupLogger();
        this.setupFS();
        this.setupStores();
        this.setupRoom(roomData);
    }

    setupLogger() {
        this.logger = new LoggingController();
    }

    setupRoom(roomData) {
        this.room = new Room({
            messageStore: this.messageStore,
            recordingStore: this.recordingStore,
            ...roomData,
        });

        this.roomController = new RoomController({
            room: this.room,
            logger: this.logger,
            fs: this.fs,
            urls: this.opts.urls,
        });
    }

    setupStores() {
        this.recordingStore = new RecordingStore({
            fs: this.fs,
            userStore: this.userStore
        });
        this.messageStore = new MessageStore({
            userStore: this.userStore
        });
        this.uiStore = new UIStore({app: this})
    }

    setupFS() {
        this.fs = initFS({dbname: 'fireside-fs'});
    }

    getRootElement() {
        return <UIApp app={this} />;
    }

    connectUI(el) {
        return new Promise( (fulfil, reject) => {
            try {
                ReactDOM.render(this.getRootElement(), el, fulfil);
            }
            catch (err) {
                reject(err);
            }
        });
    }
}