import RoomController from 'app/rooms/controller';
import {RecordingStore, MessageStore, UserStore} from 'app/stores';
import MemFS from 'lib/fs/memfs';

window.fs = new MemFS();
window.stores = {};
window.stores.recordings = new RecordingStore({
    fs: window.fs,
    directory: 'rctest',
});
window.stores.messages = new MessageStore();
window.stores.users = new UserStore();

describe("RoomController", function() {
    let rc = null;
    context('Event handlers', () => {
        beforeEach( () => {
            rc = new RoomController({
                recordingStore: window.stores.recordings,
                messageStore: window.stores.messages,
                userStore: window.stores.users,
                fs: window.fs,
                room: {}
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
            sinon.stub(rc.connection, 'sendMessage');
            sinon.stub(rc.messageStore, 'addSendingMessage');
            let testMessage = {type: 'message', payload: {foo: 'bar'}};
            rc.sendMessage(testMessage);
            expect(rc.connection.sendMessage).to.have.been.calledWith(testMessage);
            expect(rc.messageStore.addSendingMessage).to.have.been.calledWith(testMessage);
        });

        it('On receiving a message event from connection, adds received messages to the message store', () => {
            sinon.stub(rc.messageStore, 'addReceivedMessage');
            let testMessage = {type: 'test', payload: {foo: 'bar'}};
            rc.connection.emit('message', testMessage);
            expect(rc.messageStore.addReceivedMessage).to.have.been.calledWith(testMessage);
        });

        it('When a peer joins or leaves, dispatch to user store', () => {
            sinon.stub(rc.userStore, 'handlePeerAdded');
            sinon.stub(rc.userStore, 'handlePeerRemoved');
            rc.connection.emit('peerAdded', {foo: 'bar'});
            rc.connection.emit('peerRemoved', 123);
            expect(rc.userStore.handlePeerAdded).calledWith({foo: 'bar'});
            expect(rc.userStore.handlePeerRemoved).calledWith(123);
        });

        it('Dispatches status updates from connection to user store', () => {
            sinon.stub(rc.userStore, 'handleStatusUpdate');
            rc.connection.emit('event.updateStatus', {foo: 'bar'});
            expect(rc.userStore.handleStatusUpdate).to.have.been.calledWith({foo: 'bar'});
        });
    });
});
