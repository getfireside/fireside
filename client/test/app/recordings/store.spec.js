import RecordingStore, {Recording} from 'app/recordings/store';
import MemFS from 'lib/fs/memfs';
import config from 'app/config';

describe("RecordingStore", function() {
    context('#create', () => {
        let store = null;

        beforeEach(() => {
            store = fixtures.generateRecordingStore(new MemFS());
        });

        it('Creates Recordings', () => {
            let recording = store.create({type: 'audio/wav'});
            expect(recording).to.be.an.instanceOf(Recording);
        });

        it('Sets the ID on creation', () => {
            let recording = store.create({type: 'audio/wav'});
            expect(recording).to.have.property('id');
            // id should be a uuid
            let uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
            expect(recording.id).to.match(uuidRegex);
        });

        it('Adds the created recording to the store', () => {
            let recording = store.create({type: 'audio/wav'});
            expect(store.get(recording.id)).to.deep.equal(recording);
        });

        it("Passes through any attrs to the resulting recording", () => {
            let attrs1 = {type: 'audio/wav'};
            let attrs2 = {started: new Date(), ended: new Date(), userId: 5};
            let recording1 = store.create(attrs1);
            let recording2 = store.create(attrs2);
            expect(recording1).to.contain(attrs1);
            expect(recording2).to.contain(attrs2);
        });
    });

    context('#get', () => {
        let store, rec1, rec2;

        beforeEach( () => {
            rec1 = {id: 'test-id-1', type: 'audio/wav'};
            rec2 = {id: 'test-id-2', type: 'video/webm'};
            store = fixtures.generateRecordingStore(new MemFS(), [
                rec1,
                rec2,
            ]);
        });

        it('Fetches recordings', () => {
            expect(store.get('test-id-1')).to.containSubset(rec1);
            expect(store.get('test-id-2')).to.containSubset(rec2);
        });

        it('Returns undefined if the recording does not exist', () => {
            expect(store.get('fake-id-3')).to.be.undefined;
        });
    });

    context('#delete', () => {
        it("Correctly removes recordings", () => {
            const rec1 = {id: 'test-id-1', type: 'audio/wav'};
            const rec2 = {id: 'test-id-2', type: 'video/webm'};
            const store = fixtures.generateRecordingStore(new MemFS(), [
                rec1,
                rec2,
            ]);
            store.delete(rec1.id);
            expect(store.get('test-id-1')).to.equal(undefined);
            expect(store.get('test-id-2')).to.containSubset(rec2);
        });
    });
});

describe('Recording', () => {
    it('Has a duration property that returns the length in seconds', () => {
        const rec = new Recording({
            started: new Date('2017-01-01 00:00:00'),
            stopped: new Date('2017-01-01 00:01:00'),
        });
        expect(rec.duration).to.equal(60);
    });

    it('Has a bitrate property that returns the average bitrate', () => {
        const rec = new Recording({
            started: new Date('2017-01-01 00:00:00'),
            stopped: new Date('2017-01-01 00:01:00'),
            filesize: 5*1024*1024
        });
        expect(rec.bitrate).to.equal(5*1024*1024 * 8 / 60);
    });

    it('Generates a new filename from the directory and id on instantiation', () => {
        fixtures.setConfig('recordings.baseDir', 'testdir/');
        let rec = new Recording({
            id: 'my-id',
            roomId: 22,
            type: 'audio/wav'
        });
        expect(rec).to.have.property('filename');
        expect(rec.directory).to.equal('testdir/22');
        expect(rec.filename).to.equal('testdir/22/my-id.wav');
    });
});
