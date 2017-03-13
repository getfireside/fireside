import IDBFS from 'lib/fs/idbfs';
import {blobToString} from 'lib/util';

let test64string = "Here's a test 64-byte string to ensure IDBFS works correctly. :)"

const generateHugeBlob = (mb=1000) => new Blob([new Uint8Array(mb*1024*1024)]);

describe.only('IDBFile', () => {
    // TODO write a blob content generator
    let fs;
    beforeEach( async function() {
        fs = new IDBFS({dbname: 'testdb'})
        await fs.open();
    });

    afterEach( async function() {
        await fs.clear();
    })

    context('#append', () => {

        it('Works for non-existent paths', async function() {
            let file = await fs.getFile('/test/new/file');
            await file.append(new Blob(['abcd']));
            let blob = await file.read();
            let blobContents = await blobToString(blob);
            expect(blobContents).to.equal('abcd');
        });

        it('Works for existing paths', async function() {
            let file = await fs.getFile('/test/new/file2');
            await file.append(new Blob(['abcd']));
            await file.append(new Blob(['efgh']));
            let blob = await file.read();
            let blobContents = await blobToString(blob);
            expect(blobContents).to.equal('abcdefgh');
        });

        it("Throws an error if there's not enough space", async function() {
            this.timeout(0);
            let file = await fs.getFile('/test/file2');
            console.log("Writing a series of large blobs...")
            let writes = 0;
            while (true) {
                await file.append(generateHugeBlob(5));
                writes++;
                console.log(writes*5, 'MB written');
            }
        });
    });

    context('#remove', () => {
        it('Deletes blobs successfully');
        it("Throws an error if the file doesn't exist")
    });

    context("#readEach", () => {
        it('For each stored chunk, calls the provided function')
        it("Throws an error if the file doesn't exist")
    });

    context('#read', () => {
        it('Gets a blob from the chunks of the file')
        it("Throws an error if the file doesn't exist")
    });

    context('#write', () => {
        it('Correctly overwrites the beginning chunk');
        it("Throws an error if the file doesn't exist")
    })

    it('Works reliably for large files');

    it('Works after the idbfs instance has been closed');
})