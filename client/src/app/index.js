import ReactDOM from 'react-dom';
import React from 'react';

import initFS from 'lib/fs/initfs';
import {clock} from 'lib/util';
import {LoggingController} from 'lib/logger';

import {RecordingStore, MessageStore} from 'app/stores';
import Room from 'app/rooms/room';
import RoomController from 'app/rooms/controller';
import UIApp from 'app/ui/components/app';
import UIStore from 'app/ui/store';
import {useStrict} from 'mobx';

useStrict(true);

export default class FiresideApp {
    constructor({roomData, opts}) {
        this.opts = opts;
        this.clock = clock;
        clock.start();

        this.setupLogger();
        this.setupFS();
        this.setupStores({selfId: roomData.self.id});
        this.setupRoom(roomData, opts);
    }

    setupLogger() {
        this.logger = new LoggingController();
    }

    setupRoom(roomData, opts) {
        this.room = new Room({
            messageStore: this.messageStore,
            recordingStore: this.recordingStore,
            ...roomData,
        });

        this.roomController = new RoomController({
            room: this.room,
            logger: this.logger,
            fs: this.fs,
            ...opts,
        });

        // load recording data from local storage
        this.recordingStore.loadFromLocalStorage(this.room);
        this.recordingStore.setupAutoSaveForRoom(this.room);

        // shortcut to make debugging a bit easier
        this.roomConnection = this.roomController.connection;

        // make file transfers accessible from recordings
        this.recordingStore.fileTransfers = this.roomConnection.fileTransfers;
    }

    setupStores({selfId}) {
        this.recordingStore = new RecordingStore({
            fs: this.fs,
            userStore: this.userStore,
            selfId,
        });
        this.messageStore = new MessageStore({
            userStore: this.userStore
        });
        this.uiStore = new UIStore({app: this});
    }

    setupFS() {
        this.fs = initFS({dbname: 'fireside-fs', logger: this.logger});
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