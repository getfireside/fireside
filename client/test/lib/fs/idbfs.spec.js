import {IDBFS, DiskSpaceError, LookupError, FSError} from 'lib/fs/idbfs';
import {blobToString} from 'lib/util';

let test64string = "Here's a test 64-byte string to ensure IDBFS works correctly. :)"

const generateHugeBlob = (mb=1000) => new Blob([new Uint8Array(mb*1024*1024)]);

describe('IDBFS', () => {
    context('#open', () => {
        it('Opens the DB');
        it('Fulfils immediately if already open');
        it('Works after the DB has been closed');
    })
    it('Has a close method that runs without error');
    context('#getFile', () => {
        it('Returns a promise that fulfils to an IDBFile instance');
    })
})

describe('IDBFile', () => {
    let fs;
    beforeEach( async function() {
        fs = new IDBFS({dbname: 'testdb'})
        await fs.clear();
        await fs.open();
    });

    afterEach( function() {
        fs.close();
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
                let hugeBlob = generateHugeBlob(50);
                try {
                    await file.append(hugeBlob);
                    writes++;
                    console.log(writes*50, 'MB written');
                }
                catch (e) {
                    expect(e).to.be.an.instanceOf(DiskSpaceError);
                    return;
                }
            }
        });
    });

    context('#remove', () => {
        it('Deletes blobs successfully', async () => {
            let file = await fs.getFile('/test/new/file');
            await file.append(new Blob(['test1']));
            await file.append(new Blob(['test2']));
            await file.remove();
            try {
                await file.read();
                throw(new Error('Did not throw error!'));
            }
            catch (e) {
                expect(e).to.be.an.instanceOf(LookupError);
            }
        });
        it("Throws an error if the file doesn't exist", async () => {
            let file = await fs.getFile('/test/new/file3');
            try {
                await file.remove();
                throw(new Error('Did not throw error!'));
            }
            catch (e) {
                expect(e).to.be.an.instanceOf(LookupError);
            }

        })
    });

    context("#readEach", () => {
        it('For each stored chunk, calls the provided function', async () => {
            let file = await fs.getFile('/test/new/file');
            await file.append(new Blob(['1']));
            await file.append(new Blob(['2']));
            await file.append(new Blob(['3']));
            let spy = sinon.spy();
            await file.readEach(spy);
            expect(spy).to.have.callCount(3);
            let blob1Contents = await blobToString(spy.args[0][0]);
            let blob2Contents = await blobToString(spy.args[1][0]);
            let blob3Contents = await blobToString(spy.args[2][0]);
            expect(blob1Contents).to.equal('1');
            expect(blob2Contents).to.equal('2');
            expect(blob3Contents).to.equal('3');
        })
        it("Throws an error if the file doesn't exist", async () => {
            try {
                let file = await fs.getFile('/test/new/file');
                await file.readEach(() => null);
                throw(new Error('Did not throw error!'));
            }
            catch (e) {
                expect(e).to.be.an.instanceOf(LookupError);
            }
        })
    });

    context('#read', () => {
        it('Gets a well-formed blob from the chunks of the file', async () => {
            let file = await fs.getFile('/test/new/file');
            await file.append(new Blob(['1a'], {type: 'text/plain'}));
            await file.append(new Blob(['2b'], {type: 'text/plain'}));
            await file.append(new Blob(['3c'], {type: 'text/plain'}));
            let blob = await file.read();
            let blobContents = await blobToString(blob);
            expect(blobContents).to.equal('1a2b3c');
            expect(blob.type).to.equal('text/plain');
        });
        it("Throws an error if the file doesn't exist", async () => {
            try {
                let file = await fs.getFile('/test/new/file');
                await file.read();
                throw(new Error('Did not throw error!'));
            }
            catch (e) {
                expect(e).to.be.an.instanceOf(LookupError);
            }
        })
    });

    context('#write', () => {
        it('Correctly overwrites the beginning chunk', async () => {
            let file = await fs.getFile('/test2/new/file');
            file.append(new Blob(['0000test']));
            await file.write(new Blob(['1111']), 0);
            let blob = await file.read();
            let blobContents = await blobToString(blob);
            expect(blobContents).to.equal('1111test');
        });
        it('Works when the overwritten area exceeds the first chunk');
        it('Works when pos != 0');
        it("Throws an error if the file doesn't exist", async () => {
            let file = await fs.getFile('/test3/new/file');
            try {
                await file.write(new Blob(['1111']), 0);
                throw(new Error('Did not throw error!'));
            }
            catch (e) {
                expect(e).to.be.an.instanceOf(LookupError);
            }
        });
    })

    it('Works reliably for large files'); // TODO: figure out the best tests for really big files
})