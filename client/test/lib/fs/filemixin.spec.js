import FileMixin from 'lib/fs/filemixin';
import {MemFS, LookupError} from 'lib/fs/memfs';
import {blobToString} from 'lib/util';
import _ from 'lodash';

describe('FileMixin', () => {
    let fs;

    before( async () => {
        fs = new MemFS();
        await fs.open();
    })

    const genFileMixin = (filename, filesize) => {
        class File extends FileMixin {
            constructor(attrs, opts) {
                super(attrs, opts);
                _.extend(this, attrs);
            }
        }
        return new File({filename, filesize}, {fs})
    }

    beforeEach( async () => {
        fs.clear();
        await fs.appendToFile('test/file', new Blob(['0000test']));
    });

    context('#getFileBlob', () => {
        it('Reads an existing blob correctly', async () => {
            let m = genFileMixin('test/file', 8);
            let blob = await m.getFileBlob();
            let blobContents = await blobToString(blob);
            expect(blobContents).to.equal('0000test');
        });
        it("Throws the underlying FSError if the file doesn't exist", async () => {
            let m = genFileMixin('test/file/does/not/exist', 523);
            try {
                let blob = await m.getFileBlob();
                throw new Error('Did not throw');
            }
            catch (e) {
                expect(e).to.be.an.instanceOf(LookupError);
                return e;
            }
        })
    })

    context('#getFileBlobURL', () => {
        it('Creates a URL to the blob', async () => {
            let m = genFileMixin('test/file', 8);
            let blob = await m.getFileBlob();
            let blobContents = await blobToString(blob);

            let blobURL = await m.getFileBlobURL();

            let response = await fetch(blobURL);
            let responseBlob = await response.blob();
            let responseBlobContents = await blobToString(responseBlob);

            expect(blobContents).to.equal(responseBlobContents);
        })
    })

    context('#appendBlobToFile', () => {
        it('Works for non-existent files', async () => {
            let m = genFileMixin('test/file2', 0);
            await m.appendBlobToFile(new Blob(['101010test']));
            let blob = await fs.readFile('test/file2');
            let blobContents = await blobToString(blob);
            expect(blobContents).to.equal('101010test');
        })
        it('Appends to existing files', async () => {
            let m = genFileMixin('test/file', 8);
            await m.appendBlobToFile(new Blob(['2020']));
            // TODO check the blob contents
            let blob = await fs.readFile('test/file');
            let blobContents = await blobToString(blob);
            expect(blobContents).to.equal('0000test2020');
        })
        it('Sets the filesize property correctly', async() => {
            let m = genFileMixin('test/file', 8);
            await m.appendBlobToFile(new Blob(['1234567890']));
            expect(m.filesize).to.equal(18);
        })
    })

    context('#writeToFile', () => {
        it("Overwrites the file's contents", async () => {
            let m = genFileMixin('test/file', 8);
            await m.writeBlobToFile(new Blob(['1111']));
            let blob = await fs.readFile('test/file');
            let blobContents = await blobToString(blob);
            expect(blobContents).to.equal('1111test');
            expect(m.filesize).to.equal(8);
        });
    })

    context('#deleteFile', () => {
        it('Correctly deletes existing files', async () => {
            let m = genFileMixin('test/file', 8);
            await m.deleteFile();
            try {
                let blob = await fs.readFile('test/file');
                throw new Error('Did not throw correct error');
            }
            catch (err) {
                return;
            }
        });
        it("Throws an error if the file doesn't exist", async () => {
            let m = genFileMixin('test/file22', 8);
            try {
                await m.deleteFile();
                throw new Error('Did not throw correct error');
            }
            catch (err) {
                expect(e).to.be.an.instanceOf(LookupError);
            }
        });
        it("Sets the filesize to null");
    })
})