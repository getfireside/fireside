import * as http from 'lib/http';
import {sleep} from 'lib/util/async';
import {HttpFileSender} from 'lib/filetransfer/http/sender';

describe.only('HttpFileSender', () => {
    let sender;
    before(() => {
        sinon.stub(HttpFileSender.prototype, 'getChunkSize').returns(1000);
    });
    beforeEach(() =>  {
        sender = new HttpFileSender({
            fileId: 'testFileId',
            getFileById: () => ({
                readFileAt: () => null,
                filesize: 5000,
            }),
        });
    });
    it('has a method initiateUpload, which starts the upload on the server and gets the upload ID', async () => {
        sinon.stub(sender, 'getInitiateUploadUrl').returns('testUrl');
        sinon.stub(http, 'fetchPost').resolves({uploadId: 'testUploadId'});
        let result = await sender.initiateUpload();
        expect(sender.getInitiateUploadUrl).to.have.been.calledOnce;
        expect(http.fetchPost).to.have.been.calledWith('testUrl');
        expect(result).to.equal('testUploadId')
    });
    context('#startUpload', () => {
        it('calls initiateUpload only when upload ID is not set', () => {
            sinon.stub(sender, 'initiateUpload');
            sender.startUpload();
            expect(sender.initiateUpload).to.have.been.calledOnce;
            sender.initiateUpload.reset();
            sender.uploadId = 4;
            sinon.stub(sender, 'getNthChunk')
            sender.startUpload();
            expect(sender.initiateUpload).has.not.been.called;
        });
        it('loops getting the next chunk until complete', async () => {
            sinon.stub(sender, 'initiateUpload').resolves('testUploadId');
            sinon.stub(sender, 'getNthChunk', n => Promise(
                (resolve, reject) => resolve({fakeBlob: true, index: n})
            ));
            sinon.stub(sender, 'sendNthChunk');
            sender.startUpload();
            await sleep(10);
            expect(sender.getNthChunk).to.have.been.calledOnce;
            expect(sender.getNthChunk).to.have.been.calledWith(0);
            expect(sender.sendNthChunk).to.have.been.calledOnce;
            expect(sender.sendNthChunk).to.have.been.calledWith(0, {
                fakeBlob: true, index: 0
            });
            debugger;
        });
    });
});