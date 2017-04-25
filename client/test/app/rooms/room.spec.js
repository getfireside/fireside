import MemFS from 'lib/fs/memfs';
import Room from 'app/rooms/room';
import {ROLES, MEMBER_STATUSES} from 'app/rooms/constants';

describe("Room", function() {
    it('Has a constructor that sets up all the stores and properties correctly');
    context('instance properties', () => {
        let room;

        beforeEach(() => {
            room = fixtures.roomWithStores({
                fs: new MemFS()
            });
        });

        it('Has a computed messages attribute that calls messageStore.forRoom', () => {
            sinon.spy(room.messageStore, 'forRoom');
            let messages = room.messages;
            expect(room.messageStore.forRoom).calledWith(room);
            expect(messages).to.deep.equal([...room.messageStore.items]);
        });
        it('Has a computed recordings attribute that calls recordingStore.forRoom', () => {
            sinon.spy(room.recordingStore, 'forRoom');
            let recordings = room.recordings;
            expect(room.recordingStore.forRoom).calledWith(room);
            expect(recordings).to.deep.equal([...room.recordingStore.items]);
        });

    });
    context('#memberships', () => {
        let room;
        beforeEach(() => {
            room = fixtures.roomWithStores({
                fs: new MemFS()
            });
        });
        it('exists after instantiation', () => {
            expect(room).to.have.property('memberships');
        });
        it('can be updated with updateMembership', () => {
            room.updateMembership(22, {
                currentRecordingId: null,
                status: MEMBER_STATUSES.CONNECTED,
                role: ROLES.GUEST,
                name: "Test",
            });
            let mem = room.memberships.get(22);
            expect(mem).to.exist;
            expect(mem.currentRecording).to.not.exist;
            expect(mem.status).to.equal(MEMBER_STATUSES.CONNECTED);
            expect(mem.role).to.equal(ROLES.GUEST);
            expect(mem.name).to.equal('Test');
        });
        it('updateMembership updates as well as creates data correctly', () => {
            room.updateMembership(22, {
                currentRecordingId: null,
                status: MEMBER_STATUSES.CONNECTED,
                role: ROLES.GUEST,
            });
            room.updateMembership(22, {
                status: MEMBER_STATUSES.DISCONNECTED,
            });
            let mem = room.memberships.get(22);
            expect(mem).to.exist;
            expect(mem.currentRecording).to.not.exist;
            expect(mem.status).to.equal(MEMBER_STATUSES.DISCONNECTED);
            expect(mem.role).to.equal(ROLES.GUEST);
        });
        it('self and owner work correctly');
    });
});
