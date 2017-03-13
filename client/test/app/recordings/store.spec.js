import {Recording, RecordingStore} from 'app/recordings/store';
import MemFS from 'lib/fs/memfs';

describe("RecordingStore", function() {
    context('#create', () => {
        let store = null;

        beforeEach(() => {
            store = new RecordingStore({fs: new MemFS(), directory: 'test'});
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
            let attrs1 = {type: 'audio/wav'}
            let attrs2 = {started: new Date(), ended: new Date(), userId: 5}
            let recording1 = store.create(attrs1);
            let recording2 = store.create(attrs2);
            expect(recording1).to.contain(attrs1);
            expect(recording2).to.contain(attrs2);
        });
    });

    context('#get', () => {
        let store, rec1, rec2;

        beforeEach( () => {
            rec1 = new Recording({id: 'test-id-1', type: 'audio/wav'});
            rec2 = new Recording({id: 'test-id-2', type: 'video/webm'});
            store = new RecordingStore({recordings: [
                rec1,
                rec2,
            ], fs: new MemFS(), directory: 'test'})
        });

        it('Fetches recordings', () => {
            expect(store.get('test-id-1')).to.deep.equal(rec1);
            expect(store.get('test-id-2')).to.deep.equal(rec2);
        });

        it('Returns undefined if the recording does not exist', () => {
            expect(store.get('fake-id-3')).to.equal(undefined);
        });
    });

    context('#delete', () => {
        it("Correctly removes recordings", () => {
            let rec1 = new Recording({id: 'test-id-1', type: 'audio/wav'});
            let rec2 = new Recording({id: 'test-id-2', type: 'video/webm'});
            let store = new RecordingStore({recordings: [
                rec1,
                rec2,
            ], fs: new MemFS(), directory: 'test'})
            store.delete(rec1.id);
            expect(store.get('test-id-1')).to.equal(undefined);
            expect(store.get('test-id-2')).to.deep.equal(rec2);
        })
    })
});

describe('Recording', () => {
    it('Has a duration property that returns the length in seconds', () => {
        let rec = new Recording({
            started: new Date('2017-01-01 00:00:00'),
            stopped: new Date('2017-01-01 00:01:00'),
        });
        expect(rec.duration).to.equal(60);
    });

    it('Has a bitrate property that returns the average bitrate', () => {
        let rec = new Recording({
            started: new Date('2017-01-01 00:00:00'),
            stopped: new Date('2017-01-01 00:01:00'),
            filesize: 5*1024*1024
        });
        expect(rec.bitrate).to.equal(5*1024*1024 * 8 / 60);
    });

    it('Generates a new filename from the directory and id on instantiation', () => {
        let rec = new Recording({
            id: 'my-id'
        }, {
            directory: 'test'
        });
        expect(rec).to.have.property('filename');
        expect(rec.directory).to.be.a('string');
    });
})
