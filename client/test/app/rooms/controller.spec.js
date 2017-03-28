import RoomController from 'app/rooms/controller';
import {RecordingStore, MessageStore, UserStore} from 'app/stores';
import Room from 'app/rooms/room';
import MemFS from 'lib/fs/memfs';

describe("RoomController", function() {
    let rc = null;
    context('Event handlers', () => {
        beforeEach( () => {
            let fs = new MemFS;
            let {recordingStore, messageStore, userStore} = fixtures.setupStores({fs: fs});
            rc = new RoomController({
                fs: fs,
                room: new Room({
                    id: 2,
                    recordingStore,
                    messageStore,
                    userStore,
                    owner: userStore.get(42),
                })
            });
        });

        it('On start recording request, attempt to start recording.', () => {
            sinon.stub(rc.recorder, 'start');
            rc.connection.emit('event.startRecordingRequest');
            expect(rc.recorder.start.calledOnce).to.be.true;
        });

        it('On stop recording request, attempt to stop recording.', () => {
            sinon.stub(rc.recorder, 'stop');
            rc.connection.emit('event.stopRecordingRequest');
            expect(rc.recorder.stop.calledOnce).to.be.true;
        });

        it('When send message called, add message to store and send through connection', () => {
            let promise = new Promise( () => null );
            sinon.stub(rc.connection, 'sendMessage').returns(promise);
            sinon.stub(rc.room.messageStore, 'addMessage');
            let testMessage = {type: 'message', payload: {foo: 'bar'}};
            rc.sendMessage(testMessage);
            expect(rc.connection.sendMessage).to.have.been.calledWith(testMessage);
            expect(rc.room.messageStore.addMessage).to.have.been.calledWith(testMessage, {sendPromise: promise});
        });

        it('On receiving a message event from connection, adds received messages to the message store', () => {
            sinon.stub(rc.room.messageStore, 'addMessage');
            let testMessage = {type: 'test', payload: {foo: 'bar'}};
            rc.connection.emit('message', testMessage);
            expect(rc.room.messageStore.addMessage).to.have.been.calledWith(testMessage);
        });

        it("When a peer joins, updates everything correctly", () => {
            sinon.stub(rc.room.userStore, 'update');
            sinon.stub(rc.room.recordingStore, 'update');
            sinon.stub(rc.room, 'updateUserConnection');
            let peer = {
                id: 2,
                uid: 22,
                info: {
                    userInfo: {
                        name: "Test user",
                        id: 22,
                    },
                    role: 'guest',
                    currentRecordingId: "test-rec-22",
                    recordings: [{
                        id: "test-rec-22",
                        type: 'audio/wav',
                        filesize: 5552,
                        started: +( new Date() ),
                        ended: null,
                        userId: 22,
                        roomId: 2,
                    }]
                }
            };
            rc.connection.emit('peerAdded', peer);
            expect(rc.room.userStore.update).calledWith([peer.info.userInfo]);
            expect(rc.room.recordingStore.update).calledWith(peer.info.recordings);
            expect(rc.room.updateUserConnection).calledWith(peer.uid, {
                status: 'connected',
                role: peer.info.role,
                currentRecordingId: peer.info.currentRecordingId,
                peer: peer,
            });
        });

        it('When a peer leaves, dispatch to room user connection', () => {
            sinon.stub(rc.room, 'updateUserConnection');
            rc.connection.emit('peerRemoved', {userId: 123});
            expect(rc.room.updateUserConnection).calledWith(123, {
                status: 'disconnected',
                peerId: null,
                peer: null,
            });
        });

        it('Dispatches status updates from connection to room user connection', () => {
            sinon.stub(rc.room, 'updateUserConnection');
            rc.connection.emit('event.updateStatus', {
                data: {foo: 'bar'},
                userId: 42,
            });
            expect(rc.room.updateUserConnection).to.have.been.calledWith(
                42, {foo: 'bar'}
            );
        });
    });
});
