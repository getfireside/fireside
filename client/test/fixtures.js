import RecordingStore from 'app/recordings/store';
import UserStore from 'app/users/store';
import MessageStore from 'app/messages/store';
import config from 'app/config';
import _ from 'lodash';

export function setupStores({fs, users, messages, recordings}) {
    let userStore = new UserStore({users: users || [
        {name: 'HAL 9000', id: 42},
        {name: 'Dave Bowman', id: 22},
        {name: 'Frank Poole', id: 132},
    ]});

    let messageStore = new MessageStore({messages: messages || [
        {
            type: 'message',
            text: 'Open the pod bay doors, HAL',
            userId: 22,
            roomId: 2,
            timestamp: 1045477223000,
        },
        {
            type: 'message',
            text: "I'm sorry, Dave. I'm afraid I can't do that.",
            userId: 42,
            roomId: 2,
            timestamp: 1045477225132,
        }
    ], userStore: userStore});
    let recordingStore = new RecordingStore({
        recordings: recordings || [
            {id: 'test-id-1', type: 'audio/wav', roomId: 2, userId: 22},
            {id: 'test-id-2', type: 'video/webm', roomId: 2, userId: 42},
        ],
        userStore: userStore,
        fs: fs
    });
    return {
        userStore,
        messageStore,
        recordingStore
    };
}

export const generateRecordingStore = (fs, recordings) => setupStores({fs, recordings}).recordingStore;
export const generateUserStore = (fs, users) => setupStores({fs, users}).userStore;
export const generateMessageStore = (fs, messages) => setupStores({fs, messages}).messageStore;
export const setConfig = (path, value) => _.set(config, path, value);