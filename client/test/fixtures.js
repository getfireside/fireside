import RecordingStore from 'app/recordings/store';
import UserStore from 'app/users/store';
import MessageStore from 'app/messages/store';
import Room, {RoomMembership} from 'app/rooms/room';
import config from 'app/config';
import _ from 'lodash';

export function roomWithStores({fs, messages, recordings}) {
    let room = new Room({id: '6UQbFa', ownerId: 42, selfId: 42});

    room.memberships.set(22, new RoomMembership({
        room: room,
        name: 'Dave Bowman',
        uid: 22,
    }));
    room.memberships.set(42, new RoomMembership({
        room: room,
        name: 'HAL 9000',
        uid: 42,
    }));
    room.memberships.set(132, new RoomMembership({
        room: room,
        name: 'Frank Poole',
        uid: 132,
    }));

    room.messageStore = new MessageStore({messages: messages || [
        {
            type: 'event',
            payload: {
                type: 'chat',
                data: 'Open the pod bay doors, HAL',
            },
            uid: 22,
            room: room,
            timestamp: 1045477223000,
        },
        {
            type: 'event',
            payload: {
                type: 'chat',
                data: "I'm sorry, Dave. I'm afraid I can't do that.",
            },
            uid: 42,
            room: room,
            timestamp: 1045477225132,
        }
    ]});

    room.recordingStore = new RecordingStore({
        recordings: recordings || [
            {id: 'test-id-1', type: 'audio/wav', room: room, uid: 22},
            {id: 'test-id-2', type: 'video/webm', room: room, uid: 42},
        ],
        fs: fs
    });

    return room;
}

export const generateRecordingStore = (fs, recordings) => roomWithStores({fs, recordings}).recordingStore;
export const generateMessageStore = (fs, messages) => roomWithStores({fs, messages}).messageStore;
export const setConfig = (path, value) => _.set(config, path, value);