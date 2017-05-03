import * as quota from 'lib/fs/quota';

describe('Quota functions', () => {
    // afterEach(() => {
    //     sandbox.restore();
    // });
    describe('requestStorageQuota', () => {
        context('In Chrome:', () => {
            before(function() {
                if (window.webkitRequestFileSystem == null) {
                    this.skip();
                }
            });
            it('Calls webkitPersistentStorage.requestQuota, returning a promise', async () => {
                let spy = sinon.spy(navigator.webkitPersistentStorage, 'requestQuota');
                let req = quota.requestStorageQuota();
                expect(spy.calledOnce);
                let res = await req;
                expect(res).to.be.a('number');
                spy.restore();

            });
            it('Rejects on error', (done) => {
                let stub = sinon.stub(navigator.webkitPersistentStorage, 'requestQuota', (size, resolve, reject) => {
                    reject(new Error('some error'));
                });
                quota.requestStorageQuota().catch(err => done());
                stub.restore();
            });
        });
        context('In Firefox:', () => {
            before(function() {
                if (window.webkitRequestFileSystem != null) {
                    this.skip();
                }
            });
            it('Should resolve immediately', async () => {
                let req = await quota.requestStorageQuota();
                assert(req).is.undefined;
            });
        });
    });

    describe('getStorageUsage', () => {
        context('In Chrome:', () => {
            before(function() {
                if (window.webkitRequestFileSystem == null) {
                    this.skip();
                }
            });
            it('Calls getQueryUsageAndQuota', async () => {
                let spy = sinon.spy(navigator.webkitPersistentStorage, 'queryUsageAndQuota');
                let req = quota.getStorageUsage();
                expect(spy.calledOnce);
                let res = await req;
                expect(res.quota).to.be.a('number');
                expect(res.usage).to.be.a('number');
                spy.restore();
            });
            it('Rejects on error', (done) => {
                let stub = sinon.stub(navigator.webkitPersistentStorage, 'queryUsageAndQuota', (resolve, reject) => {
                    reject(new Error('some error'));
                });
                quota.getStorageUsage().catch(err => done());
                stub.restore();
            });
        });
        context('In Firefox:', () => {
            before(function() {
                if (window.webkitRequestFileSystem != null) {
                    this.skip();
                }
            });
            it('Calls navigator.storage.estimate', async () => {
                let spy = sinon.spy(navigator.storage, 'estimate');
                let req = quota.getStorageUsage();
                expect(spy.calledOnce);
                let res = await req;
                expect(res.quota).to.be.a('number');
                expect(res.usage).to.be.a('number');
                spy.restore();
            });
            it('Rejects on error', (done) => {
                let stub = sinon.stub(navigator.storage, 'estimate', () => new Promise( (resolve, reject) => {
                    reject(new Error('some error'));
                }));
                quota.getStorageUsage().catch(err => done());
                stub.restore();
            });
        });
    });
});

export async function testDiskUsageEvents(fs) {
    let sleep = (n) => new Promise(resolve => {
        setTimeout(resolve, n);
    });
    let genPromise = (d) => new Promise(resolve => {
        setTimeout(() => resolve(d), 0);
    });
    let events = [];
    let stub = sinon.stub(quota, 'getStorageUsage');
    try {
        stub.onCall(0).returns(genPromise({usage: 0, quota: 1024}));
        stub.onCall(1).returns(genPromise({usage: 0, quota: 1024}));
        stub.onCall(2).returns(genPromise({usage: 0, quota: 1024}));
        stub.onCall(3).returns(genPromise({usage: 512, quota: 2048}));
        stub.onCall(4).returns(genPromise({usage: 512, quota: 1024}));
        stub.onCall(5).returns(genPromise({usage: 500, quota: 1024}));
        stub.returns(genPromise({usage: 500, quota: 1024}));
        fs.on('diskUsageUpdate', res => events.push(res));
        await fs.open();
        await sleep(100);
        expect(events).to.have.length(1);
        expect(events[0]).to.deep.equal({usage: 0, quota: 1024});
        await sleep(1000);
        expect(events).to.have.length(1);
        await sleep(1000);
        expect(events).to.have.length(1);
        await sleep(1000);
        expect(events).to.have.length(2);
        expect(events[1]).to.deep.equal({usage: 512, quota: 2048});
        await sleep(1000);
        expect(events).to.have.length(3);
        expect(events[2]).to.deep.equal({usage: 512, quota: 1024});
        await sleep(1000);
        expect(events).to.have.length(4);
        expect(events[3]).to.deep.equal({usage: 500, quota: 1024});
    }
    finally {
        stub.restore();
        fs.off('diskUsageUpdate');
    }
    return;
}
