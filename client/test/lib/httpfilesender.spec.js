import * as http from 'lib/http';
import {sleep} from 'lib/util/async';
import {HttpFileSender} from 'lib/filetransfer/http/sender';

describe.only('HttpFileSender', () => {
    let sender;
    let sandbox;
    before(() => {
        sinon.stub(HttpFileSender.prototype, 'getChunkSize').returns(1000);
    });
    beforeEach(() =>  {
        sender = new HttpFileSender({
            fileId: 'testFileId',
            getFileById: () => ({
                readFileAt: () => null,
                filesize: 4096,
            }),
        });
        sandbox = sinon.sandbox.create();
    });
    afterEach( () => {
        sandbox.restore();
    });
    it('has a method initiateUpload, which starts the upload on the server and gets the upload ID', async () => {
        sandbox.stub(sender, 'getInitiateUploadUrl').returns('testUrl');
        sandbox.stub(http, 'fetchPost').resolves({uploadId: 'testUploadId'});
        let result = await sender.initiateUpload();
        expect(sender.getInitiateUploadUrl).to.have.been.calledOnce;
        expect(http.fetchPost).to.have.been.calledWith('testUrl');
        expect(result).to.equal('testUploadId')
    });
    context('#startUpload', () => {
        it('calls initiateUpload only when upload ID is not set', () => {
            sandbox.stub(sender, 'initiateUpload');
            sender.startUpload();
            expect(sender.initiateUpload).to.have.been.calledOnce;
            sender.initiateUpload.reset();
            sender.uploadId = 4;
            sandbox.stub(sender, 'getNthChunk');
            sender.startUpload();
            expect(sender.initiateUpload).has.not.been.called;
        });
        context('upload loop', () => {
            let sendingChunkIndex,
                sendingChunk,
                resolveSendingChunk,
                rejectSendingChunk;
            beforeEach( () => {
                sandbox.stub(sender, 'initiateUpload').resolves('testUploadId');
                sandbox.stub(sender, 'getNthChunk', n => new Promise(
                    (resolve, reject) => resolve({fakeBlob: true, index: n})
                ));
                sandbox.stub(sender, 'notifyComplete').resolves();
                sandbox.stub(sender, 'sendNthChunk', (n, chunk) => new Promise(
                    (resolve, reject) => {
                        sendingChunkIndex = n;
                        sendingChunk = chunk;
                        resolveSendingChunk = resolve;
                        rejectSendingChunk = reject;
                    }
                ));
            });
            it('loops getting the next chunk until complete', async () => {
                let result = sender.startUpload();
                await sleep(10);
                for (let i = 0; i < 5; ++i) {
                    expect(sender.getNthChunk).to.have.callCount(i+1);
                    expect(sender.getNthChunk.getCall(i).args[0]).to.equal(i);
                    expect(sender.sendNthChunk).to.have.callCount(i+1);
                    expect(sender.sendNthChunk.getCall(i).args).to.deep.equal([i, {fakeBlob: true, index: i}]);
                    resolveSendingChunk();
                    await sleep(10);
                    expect(sender.numUploadedChunks).to.equal(i+1);
                    expect(sender.timeUntilNextRetry).to.equal(100);
                }
                expect(sender.notifyComplete).to.have.been.calledOnce;
                await result;
            });
            it('retries if there was a connection error', async () => {
                sender.startUpload();
                await sleep(10);
                resolveSendingChunk();
                await sleep(10);
                resolveSendingChunk();
                await sleep(10);
                rejectSendingChunk(new TypeError('connection error'));
                await sleep(90);
                // make sure send isn't called until after the delay
                expect(sender.sendNthChunk).to.have.callCount(3);
                await sleep(10);
                expect(sender.sendNthChunk).to.have.callCount(4);
                // make sure getNthChunk isn't called repeatedly
                expect(sender.getNthChunk).to.have.callCount(3);

                expect(sender.sendNthChunk.getCall(3).args[0]).to.equal(2);
                expect(sender.timeUntilNextRetry).to.equal(150);
            });
            it('emits and raises error if it was a server error', async () => {
                let result = sender.startUpload();
                let emittedError = new Promise((resolve) => {
                    sender.on('error', (err) => resolve(err));
                });
                await sleep(10);
                let err = new Error('some server error');
                rejectSendingChunk(err);
                try {
                    await result;
                    throw new Error('Promise resolved when it should have rejected');
                }
                catch (caughtErr) {
                    expect(caughtErr).to.equal(err);
                }
                expect(await emittedError).to.equal(err);
            });
        });
    });
    it('getNthChunk calls readFileAt with correct parameters', async () => {
        let testFile = {testFile: true};
        sandbox.stub(sender.file, 'readFileAt').resolves(testFile);
        expect(await sender.getNthChunk(0)).to.equal(testFile);
        expect(sender.file.readFileAt).to.have.been.calledWith(0, 1000);
        expect(await sender.getNthChunk(4)).to.equal(testFile);
        expect(sender.file.readFileAt).to.have.been.calledWith(4000, 96);
    });
    it('sendNthChunk calls fetchPutBlob', async () => {
        sandbox.stub(http, 'fetchPutBlob').resolves();
        sandbox.stub(sender, 'getNthChunkUploadUrl').resolves('testUploadUrl');
        await sender.sendNthChunk(321, 'testChunk');
        sender.numUploadedChunks = 2;
        expect(sender.getNthChunkUploadUrl).to.have.been.calledWith(321);
        expect(http.fetchPutBlob).to.have.been.calledOnce;
        expect(http.fetchPutBlob.args[0][0]).to.equal('testUploadUrl');
        expect(http.fetchPutBlob.args[0][1]).to.equal('testChunk');
    });
    it('sendNthChunk attaches a progress event that emits progress events on the instance');
    it('saveToLocalStorage works', () => {
        sender.numUploadedChunks = 231;
        sender.uploadId = 'testUploadId';
        sender.saveToLocalStorage();
        expect(JSON.parse(localStorage.getItem(`filetransfer:${sender.fileId}`))).to.deep.equal({
            numUploadedChunks: 231,
            uploadId: 'testUploadId',
        });
    });
    it('loadFromLocalStorage works', () => {
        localStorage.setItem(`filetransfer:testFileId`, JSON.stringify({
            numUploadedChunks: 231,
            uploadId: 'testUploadId'
        }));
        sender.loadFromLocalStorage();
        expect(sender.numUploadedChunks).to.equal(231);
        expect(sender.uploadId).to.equal('testUploadId');
    });
    it('notifyComplete posts to the configured URL and emits a complete event', async () => {
        let eventEmitted = new Promise(resolve => sender.on('complete', resolve));
        sandbox.stub(sender, 'getCompleteUploadUrl').returns('testCompleteUrl');
        sandbox.stub(http, 'fetchPost');
        sender.notifyComplete();
        expect(sender.getCompleteUploadUrl).to.have.been.calledOnce;
        expect(http.fetchPost).to.have.been.calledWithExactly('testCompleteUrl');
        await eventEmitted;
    });
    it('abort sends an abort request');
});