import {HTML5FS, HTML5FSFile, DiskSpaceError, LookupError, FSError} from 'lib/fs/html5fs';
import {blobToString} from 'lib/util';
import {testDiskUsageEvents} from './quota.spec.js';

const generateHugeBlob = (mb=1000) => new Blob([new Uint8Array(mb*1024*1024)]);

describe('HTMLFS', function() {
    if (window.webkitRequestFileSystem == null) {
        this.skip();
    }
    context('#open', () => {
        it('Opens the DB and creates stores and indices as necessary', async () => {
            let fs = new HTML5FS();
            await fs.open();
            expect(fs).to.have.property('fs');
        });
        it('Fulfils immediately if already open', async () => {
            let fs = new HTML5FS();
            await fs.open();
            let open = false;
            fs.open().then(() => {
                open = true;
            });
            await (new Promise((fulfil, reject) => {
                setTimeout(() => {
                    if (open) {
                        fulfil();
                    }
                    else {
                        reject(new Error('Promise did not resolve quickly enough'));
                    }
                }, 10);
            }));
        });
    });
    context('#getFile', () => {
        it('Returns a promise that fulfils to an HTML5FSFile instance', async () => {
            let fs = new HTML5FS();
            await fs.open();
            let file = await fs.getFile('/test/2222');
            expect(file).to.be.an.instanceOf(HTML5FSFile);
        });
    });
    it('Watches disk usage correctly', function(done) {
        let fs = new HTML5FS();
        this.timeout(10000);
        testDiskUsageEvents(fs).then(() => done()).catch(done);
    });
});

describe('HTML5FSFile', function() {
    if (window.webkitRequestFileSystem == null) {
        this.skip();
    }
    let fs;
    beforeEach( async function() {
        fs = new HTML5FS();
        await fs.open();
        await fs.clear();
    });

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
            let file = await fs.getFile('/test/file2');
            console.log("Writing a series of large blobs...");
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
        });
    });

    context("#readEach", () => {
        it('For each stored chunk, calls the provided function', async () => {
            let file = await fs.getFile('/test/new/file');
            await file.append(new Blob(['1']));
            await file.append(new Blob(['2']));
            await file.append(new Blob(['3']));
            let spy = sinon.spy();
            await file.readEach(spy);
            let blobContents = await blobToString(spy.args[0][0]);
            expect(blobContents).to.equal('123');
        });
        it("Throws an error if the file doesn't exist", async () => {
            try {
                let file = await fs.getFile('/test/new/file');
                await file.readEach(() => null);
                throw(new Error('Did not throw error!'));
            }
            catch (e) {
                expect(e).to.be.an.instanceOf(LookupError);
            }
        });
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
        });
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
            let file = await fs.getFile('/test33/new/file');
            try {
                await file.write(new Blob(['1111']), 0);
                throw(new Error('Did not throw error!'));
            }
            catch (e) {
                expect(e).to.be.an.instanceOf(LookupError);
            }
        });
    });

    it('Works reliably for large files'); // TODO: figure out the best tests for really big files
});