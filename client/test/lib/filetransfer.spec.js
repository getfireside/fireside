import FileReceiver from 'lib/rtc/filetransfer/receiver';
import FileSender from 'lib/rtc/filetransfer/sender';
import {default as FileTransferManager, CHUNK_SIZE, CHUNKS_PER_BLOCK, STATUSES} from 'lib/rtc/filetransfer';
import MemFS from 'lib/fs/memfs';
import {action} from 'mobx';
import {blobToString} from 'lib/util';
import {stringToArrayBuffer} from 'lib/fs/util';
import {fileToArrayBuffer} from 'lib/fs/util';
import {clock} from 'lib/util';

clock.start();

async function sendChunks(receiver, start, end) {
    for (let i = start; i < end; ++i) {
        let iStr = i.toString();
        let chunkSize;
        if (i == receiver.numChunks - 1) {
            chunkSize = receiver.metadata.size % CHUNK_SIZE;
        }
        else {
            chunkSize = CHUNK_SIZE;
        }
        receiver.channel.onmessage({
            data: await FileSender.encodeChunk(i, stringToArrayBuffer(
                iStr + " ".repeat(chunkSize - iStr.length),
            ))
        });
    }
}

function whenTrue(cond, every=50) {
    return new Promise((resolve) => {
        let _t = setInterval(() => {
            if (cond()) {
                clearInterval(_t);
                resolve();
            }
        }, every);
    });
}

describe.only("FileReceiver", () => {
    context('Initial setup', () => {

    });
    context('Resume from localStorage', () => {

    });
    context('Request-receive', () => {
        let receiver;
        beforeEach( async () => {
            localStorage.clear();
            receiver = new FileReceiver({
                channel: {readyState: 'open', send: function() {}, close: function() {}},
                uid: 2,
                fs: new MemFS(),
                fileId: 'test-file',
            });
            action(() => {
                receiver.metadata = {
                    name: 'test.wav',
                    size: Math.ceil(CHUNK_SIZE * CHUNKS_PER_BLOCK * 2.65),
                    type: 'audio/wav'
                };
            })();
        });
        it('The initial requestNextBlock works.', function(done) {
            let stub = sinon.stub(receiver.channel, 'send');
            let wasStarted = false;
            let receiveChunkEvents = [];
            let progressEvents = [];
            receiver.on('started', () => wasStarted = true);
            receiver.on('receiveChunk', (...args) => receiveChunkEvents.push(args));
            receiver.on('progress', (...args) => progressEvents.push(args))

            let wasWritten = new Promise(resolve => receiver.on('write', () => resolve()));

            receiver.startTransfer().then( () =>
                setTimeout(async () => {
                    try {
                        expect(stub.callCount).to.equal(1);
                        expect(stub).to.have.been.calledWith(JSON.stringify({
                            type: "requestChunks",
                            index: 0
                        }));
                        expect(wasStarted).to.be.true;
                        expect(receiver.downloadedBytes).to.equal(0);

                        sendChunks(receiver, 0, CHUNKS_PER_BLOCK);

                        await wasWritten;

                        _.each(receiveChunkEvents,
                            async ([receiverRef, chunkIndex, chunkBlob], index) => {
                                try {
                                    let iStr = chunkIndex.toString();
                                    let chunkSize = (
                                        chunkIndex == receiver.numChunks - 1 ?
                                        receiver.metadata.size % CHUNK_SIZE :
                                        CHUNK_SIZE
                                    );
                                    expect(receiverRef).to.equal(receiver);
                                    expect(chunkBlob.size).to.equal(chunkSize);
                                    expect(chunkIndex).to.equal(index);
                                    expect(await blobToString(chunkBlob)).to.equal(
                                        iStr + " ".repeat(chunkSize - iStr.length)
                                    );
                                }
                                catch (err) {
                                    done(err);
                                }
                            })
                        _.each(progressEvents, ([receiverRef, info], index) => {
                            let chunkSize = (
                                index == receiver.numChunks - 1 ?
                                receiver.metadata.size % CHUNK_SIZE :
                                CHUNK_SIZE
                            );
                            expect(receiverRef).to.equal(receiver);
                            expect(info.total).to.equal(receiver.metadata.size);
                            expect(info.bytes).to.equal((index + 1) * chunkSize);
                        })
                        expect(receiver.downloadedBytes).to.equal(
                            CHUNK_SIZE * CHUNKS_PER_BLOCK
                        );

                        expect(JSON.parse(localStorage.getItem(`filetransfer:${receiver.fileId}`))).to.deep.equal({
                            numSavedChunks: CHUNKS_PER_BLOCK,
                            metadata: receiver.metadata
                        })
                        expect(receiver.block).to.have.lengthOf(0);
                        expect(receiver.fs.db['transfers/test-file'][0].size).to.equal(
                            CHUNK_SIZE * CHUNKS_PER_BLOCK
                        );
                        expect(stub.callCount).to.equal(2);
                        expect(stub).to.have.been.calledWith(JSON.stringify({
                            type: "requestChunks",
                            index: CHUNKS_PER_BLOCK
                        }));
                        receiver.channel.readyState = false;
                        done();
                    }
                    catch (err) {
                        done(err);
                    }
                }, 50)
            );
        });
        it('The last requestNextBlock works.', function(done) {
            let stub = sinon.stub(receiver.channel, 'send');
            let closeStub = sinon.stub(receiver.channel, 'close');
            this.timeout(5000);
            receiver.startTransfer().then( async () => {
                for (let i = 0; i < 2; ++i) {
                    let wasWritten = new Promise(resolve => receiver.on('write', () => resolve()));
                    sendChunks(receiver, i*CHUNKS_PER_BLOCK, (i+1)*CHUNKS_PER_BLOCK);
                    await wasWritten;
                    await new Promise(resolve => setTimeout(resolve, 10));
                }
                console.log("WRITTEN TWICE");
                setTimeout(async () => {
                    try {
                        expect(stub).to.have.been.calledWith(JSON.stringify({
                            type: "requestChunks",
                            index: CHUNKS_PER_BLOCK * 2
                        }));

                        let receiveChunkEvents = [];
                        let progressEvents = [];
                        let completeEvent;
                        let wasWritten = false;

                        let numChunksInLastBlock = Math.ceil(0.65 * CHUNKS_PER_BLOCK);

                        receiver.on('receiveChunk', (...args) => receiveChunkEvents.push(args));
                                    receiver.on('progress', (...args) => progressEvents.push(args))
                        receiver.on('write', () => wasWritten = true);
                        receiver.on('complete', (...args) => completeEvent = args);

                        sendChunks(receiver, CHUNKS_PER_BLOCK*2, receiver.numChunks);
                        await whenTrue(() => receiveChunkEvents.length == numChunksInLastBlock);

                        expect(receiveChunkEvents).to.have.lengthOf(numChunksInLastBlock);
                        expect(progressEvents).to.have.lengthOf(numChunksInLastBlock);

                        expect(receiver.numDownloadedChunks).to.equal(receiver.numChunks);
                        expect(receiver.numSavedChunks).to.equal(receiver.numChunks);

                        expect(JSON.parse(localStorage.getItem(`filetransfer:${receiver.fileId}`))).to.deep.equal({
                            numSavedChunks: receiver.numChunks,
                            metadata: receiver.metadata
                        });

                        expect(receiver.fs.db['transfers/test-file']).to.have.lengthOf(3);
                        expect(receiver.fs.db['transfers/test-file'][2].size).to.equal(
                            receiver.metadata.size % (CHUNK_SIZE * CHUNKS_PER_BLOCK)
                        );

                        expect(closeStub.callCount).to.equal(1);
                        expect(receiver.status).to.equal(STATUSES.COMPLETED);

                        done();
                    }
                    catch (err) {
                        done(err);
                    }
                }, 0);
            });
        });
    });
});