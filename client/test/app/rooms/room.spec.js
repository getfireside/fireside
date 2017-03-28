import MemFS from 'lib/fs/memfs';
import Room from 'app/rooms/room';

describe("Room", function() {
    let userStore, messageStore, recordingStore;
    beforeEach(() => ({
        userStore,
        messageStore,
        recordingStore
    } = fixtures.setupStores({fs: new MemFS()})));
    it('Has a constructor that sets up all the stores and properties correctly', () => {
        let room = new Room({
            userStore: userStore,
            messageStore: messageStore,
            recordingStore: recordingStore,
            id: 2,
            owner: userStore.get(22),
        });
        expect(room.userStore).to.deep.equal(userStore);
        expect(room.messageStore).to.deep.equal(messageStore);
        expect(room.recordingStore).to.deep.equal(recordingStore);
        expect(room.id).to.equal(2);
        expect(room.owner).to.deep.equal(userStore.get(22));
    });
    context('instance properties', () => {
        let room;
        beforeEach( () => {
            room = new Room({
                userStore: userStore,
                messageStore: messageStore,
                recordingStore: recordingStore,
                id: 2,
                owner: userStore.get(42),
            });
        });
        it('Has a computed messages attribute that calls messageStore.forRoom', () => {
            sinon.spy(room.messageStore, 'forRoom');
            let messages = room.messages;
            expect(room.messageStore.forRoom).calledWith(room);
            expect(messages).to.deep.equal([...messageStore.items]);
        });
        it('Has a computed recordings attribute that calls recordingStore.forRoom', () => {
            sinon.spy(room.recordingStore, 'forRoom');
            let recordings = room.recordings;
            expect(room.recordingStore.forRoom).calledWith(room);
            expect(recordings).to.deep.equal([...recordingStore.items]);
        });
    });
    context('#userConnections', () => {
        let room;
        beforeEach( () => {
            room = new Room({
                userStore: userStore,
                messageStore: messageStore,
                recordingStore: recordingStore,
                id: 2,
                owner: userStore.get(42),
            });
        });
        it('exists after instantiation', () => {
            expect(room).to.have.property('userConnections');
        });
        it('can be updated with updateUserConnection', () => {
            room.updateUserConnection(22, {
                currentRecordingId: null,
                status: "connected",
                role: "guest"
            });
            let userConn = room.userConnections.get(22);
            expect(userConn).to.exist;
            expect(userConn.currentRecording).to.not.exist;
            expect(userConn.status).to.equal('connected');
            expect(userConn.role).to.equal('guest');
        });
        it('updateUserConnection updates as well as creates data correctly', () => {
            room.updateUserConnection(22, {
                currentRecordingId: null,
                status: "connected",
                role: "guest"
            });
            room.updateUserConnection(22, {
                status: "disconnected",
            });
            let userConn = room.userConnections.get(22);
            expect(userConn).to.exist;
            expect(userConn.currentRecording).to.not.exist;
            expect(userConn.status).to.equal('disconnected');
            expect(userConn.role).to.equal('guest');
        });
    });
});
