/* eslint-disable no-undef */

import RoomConnection from 'app/rooms/connection';

let peer1 = {
    id: 1,
    uid: 11,
    info: {
        name: name,
        status: 'test'
    },
    resources: {
        audio: true,
        video: true,
    }
};

let peer2 = {
    id: 2,
    uid: 22,
    info: {
        name: name,
        status: 'test 2'
    },
    resources: {
        audio: true,
        video: true,
    }
};

describe("RoomConnection", function() {
    let rc = null;
    context('Socket events', () => {
        beforeEach( () => {
            rc = new RoomConnection({});
            sinon.stub(rc.socket, 'open');
            sinon.stub(rc.socket, 'send');
        });

        it('On connect, opens the websocket and attempts handshake', (done) => {
            rc.connect();
            expect(rc.status).to.equal('connecting');
            rc.on('connect', () => {
                expect(rc.status).to.equal('connected');
                done();
            });
            rc.socket.emit('open');
        });

        it("On join room, emit event and add all the peers to the connection's peers list", (done) => {
            rc.status = 'connected';
            let peer1Added = false;
            let peer2Added = false;
            let joinRoomEventEmitted = false;
            let testPayload = {peers: [peer1, peer2]};
            rc.on('joinRoom', (data) => {
                expect(data).to.deep.equal(testPayload);
                joinRoomEventEmitted = true;
            });
            rc.on('peerAdded', (peer) => {
                if (peer.id == 1) {
                    peer1Added = true;
                }
                if (peer.id == 2) {
                    peer2Added = true;
                }
                if (peer1Added && peer2Added) {
                    expect(rc.peers).to.have.lengthOf(2);
                    let peerInList = _.find(rc.peers, p => p.id == 1);
                    expect(peerInList.uid).to.equal(peer1.uid);
                    expect(peerInList.info).to.deep.equal(peer1.info);
                    expect(peerInList.resources).to.deep.equal(peer1.resources);
                    expect(joinRoomEventEmitted).to.be.true;
                    done();
                }
            });
            rc.socket.emit('message', {t: 'j', p: testPayload});
        });

        it('Passes through signalling messages to peers', () => {
            rc.status = 'connected';
            rc.addPeer(peer1);
            let peer = rc.addPeer(peer2);
            sinon.stub(peer, 'receiveSignallingMessage');
            let payload = {id: 2, foo: {bar: 'baz'}};
            rc.socket.emit('message', {t: 's', p: payload});
            expect(peer.receiveSignallingMessage).to.have.been.calledWith(payload);
        });

        it('Re-emits events with the correct name', (done) => {
            rc.status = 'connected';
            rc.on('event.testEvent1', (data) => {
                expect(data).to.deep.equal({foo: 'bar'});
                done();
            });
            rc.socket.emit('message', {t: 'e', p: {type: 'testEvent1', payload: {foo: 'bar'}}});
        });

        it('Adds peers correctly on announce', (done) => {
            rc.status = 'connected';
            rc.addPeer(peer1);
            let peerAnnounced = false;
            rc.once('announcePeer', () => peerAnnounced = true);
            rc.once('peerAdded', () => {
                expect(rc.peers).has.lengthOf(2);
                expect(rc.peers[0].uid).to.equal(peer1.uid);
                expect(rc.peers[0].info).to.deep.equal(peer1.info);
                expect(rc.peers[0].resources).to.deep.equal(peer1.resources);
                expect(rc.peers[0].id).to.equal(peer1.id);
                expect(rc.peers[1].uid).to.equal(peer2.uid);
                expect(rc.peers[1].info).to.deep.equal(peer2.info);
                expect(rc.peers[1].resources).to.deep.equal(peer2.resources);
                expect(rc.peers[1].id).to.equal(peer2.id);
            });
            rc.socket.emit('message', {t: 'A', p: {peer: peer2}});
            rc.once('peerAdded', () => {
                expect(rc.peers).has.lengthOf(2);
                expect(rc.peers[0].uid).to.equal(peer1.uid);
                expect(rc.peers[0].info).to.deep.equal(peer1.info);
                expect(rc.peers[0].resources).to.deep.equal(peer1.resources);
                expect(rc.peers[0].id).to.equal(peer1.id);
                expect(rc.peers[1].uid).to.equal(peer2.uid);
                expect(rc.peers[1].info).to.deep.equal(peer2.info);
                expect(rc.peers[1].resources).to.deep.equal(peer2.resources);
                expect(rc.peers[1].id).to.equal(peer2.id);
                expect(peerAnnounced).to.be.true;
                done();
            });
            rc.addPeer(peer1);
        });

        it('addPeer also adds existing local stream to peer');

        it('Removes peers correcly on leave', (done) => {
            rc.status = 'connected';
            rc.addPeer(peer1);
            rc.addPeer(peer2);
            rc.once('peerRemoved', ({peerId, userId}) => {
                expect(peerId).to.equal(peer2.id);
                expect(userId).to.equal(peer2.uid);
                expect(rc.peers).to.have.lengthOf(1);
                expect(rc.getPeer(peer2.id)).to.be.undefined;
                expect(rc.peers[0].id).to.equal(peer1.id);
                done();
            });
            rc.socket.emit('message', {t: 'l', p: {id: peer2.id}});
        });
    });

    context('Actions', () => {
        beforeEach( () => {
            rc = new RoomConnection({});
            sinon.stub(rc.socket, 'send');
        });
        it('connectStream sets this.stream and passes through attached stream to peers', (done) => {
            rc.status = 'connected';
            let peer1obj = rc.addPeer(peer1);
            let peer2obj = rc.addPeer(peer2);
            sinon.stub(peer1obj, 'addLocalStream');
            sinon.stub(peer2obj, 'addLocalStream');
            rc.on('localStreamConnected', () => {
                expect(rc.stream).to.equal('Fake String Stream');
                expect(peer1obj.addLocalStream).to.have.been.calledWith('Fake String Stream');
                expect(peer2obj.addLocalStream).to.have.been.calledWith('Fake String Stream');
                done();
            });
            rc.connectStream('Fake String Stream');
        });
        it('Sends events and messages through the socket', () => {
            rc.status = 'connected';
            rc.sendEvent('testEvent1', {foo: 'bar'});
            expect(rc.socket.send).to.have.been.calledWithExactly({
                t: 'e',
                p: {
                    name: 'testEvent1',
                    data: {foo: 'bar'},
                }
            });
            rc.sendMessage('testMessage1', {foo: 'bar'});
            expect(rc.socket.send).to.have.been.calledWithExactly({
                t: 'm',
                p: {
                    type: 'testMessage1',
                    payload: {foo: 'bar'},
                }
            });
        });
    });
});
