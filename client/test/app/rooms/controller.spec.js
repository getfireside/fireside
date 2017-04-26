import RoomController from 'app/rooms/controller';
import {MESSAGE_TYPES, MEMBER_STATUSES} from 'app/rooms/constants';
import MemFS from 'lib/fs/memfs';

describe("RoomController", function() {
    let rc = null;
    beforeEach( () => {
        let fs = new MemFS;
        let room = fixtures.roomWithStores({fs: fs});
        rc = new RoomController({
            fs: fs,
            room: room
        });
    });

    context('Actions', () => {
        it('When sendEvent called, add message to store and send through connection', () => {
            let promise = new Promise( () => null );
            sinon.stub(rc.connection, 'sendEvent').returns(promise);
            let spy = sinon.spy(rc.room.messageStore, 'addMessage');
            let testEvent = {type: 'testEvent', data: {foo: 'bar'}};
            let result = rc.sendEvent(testEvent.type, testEvent.data);
            expect(rc.connection.sendEvent).to.have.been.calledWith(
                testEvent.type,
                testEvent.data,
                {http: true}
            );

            var messageData = spy.args[0][0];
            expect(messageData.type).to.equal(MESSAGE_TYPES.EVENT);
            expect(messageData.payload).to.deep.equal(testEvent);
            expect(messageData.room).to.equal(rc.room);
            expect(spy.args[0][1]).to.deep.equal({sendPromise: promise});

            expect(result.type).to.equal(MESSAGE_TYPES.EVENT);
            expect(result.payload).to.deep.equal(testEvent);
            expect(result.room).to.equal(rc.room);
            expect(result.status).to.equal('pending');
        });
    });

    context('Event handlers', () => {
        it('On start recording request, attempt to start recording.', () => {
            sinon.stub(rc.recorder, 'start');
            rc.connection.emit('event.requestStartRecording');
            expect(rc.recorder.start.calledOnce).to.be.true;
        });

        it('On stop recording request, attempt to stop recording.', () => {
            sinon.stub(rc.recorder, 'stop');
            rc.connection.emit('event.requestStopRecording');
            expect(rc.recorder.stop.calledOnce).to.be.true;
        });

        context('On join', () => {
            it('Adds members');
            it('Updates self');
            it('Gets and updates messages from server');
            it('Tries to open the FS');
        });

        it('On receiving a message event from connection, adds received messages to the message store', () => {
            sinon.stub(rc.room.messageStore, 'addMessage');
            let testMessage = {type: 'test', payload: {foo: 'bar'}};
            rc.connection.emit('message', testMessage);
            expect(rc.room.messageStore.addMessage).to.have.been.calledWith(testMessage);
        });

        it("When a peer joins, updates everything correctly", () => {
            sinon.stub(rc.room.recordingStore, 'update');
            sinon.stub(rc.room, 'updateMembership');
            let peer = {
                id: 2,
                uid: 22,
                info: {
                    name: "Test user",
                    role: 'guest',
                    diskUsage: {usage: 0, quota: 3}
                },
                currentRecordingId: "test-rec-22",
                recordings: [{
                    id: "test-rec-22",
                    type: 'audio/wav',
                    filesize: 5552,
                    started: +( new Date() ),
                    ended: null,
                    uid: 22,
                    roomId: 2,
                }]
            };
            rc.connection.emit('peerAdded', peer);
            expect(rc.room.recordingStore.update).calledWith(peer.info.recordings);
            expect(rc.room.updateMembership).calledWith(peer.uid, {
                status: MEMBER_STATUSES.CONNECTED,
                role: peer.info.role,
                currentRecordingId: peer.info.currentRecordingId,
                peer: peer,
                name: peer.info.name,
                diskUsage: peer.info.diskUsage,
            });
        });

        it('When a peer leaves, dispatch to room membership', () => {
            sinon.stub(rc.room, 'updateMembership');
            rc.connection.emit('peerRemoved', {uid: 123});
            expect(rc.room.updateMembership).calledWith(123, {
                status: MEMBER_STATUSES.DISCONNECTED,
                peerId: null,
                peer: null,
            });
        });

        it('Dispatches status updates from connection to room user connection', () => {
            sinon.stub(rc.room, 'updateMembership');
            rc.connection.emit('event.updateStatus', {
                foo: 'bar'
            }, {uid: 42});
            expect(rc.room.updateMembership).to.have.been.calledWith(
                42, {foo: 'bar'}
            );
        });

        it('When a disk usage update is trigged, send it through to the connection and update self', () => {
            sinon.stub(rc.connection, 'sendEvent');
            let diskUsage = {usage: 0, quota: 1024};
            rc.fs.emit('diskUsageUpdate', diskUsage);
            expect(rc.room.memberships.self.diskUsage).to.deep.equal(diskUsage);
            expect(rc.connection.sendEvent).to.have.been.calledWith(
                'updateStatus', {diskUsage}, {http:false}
            );
        });
    });
});
