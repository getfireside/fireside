/* eslint-disable no-undef */

import RoomConnection from 'app/rooms/connection';
import * as util from 'lib/util';
import {decamelizeKeys} from 'lib/util';

let peer1 = {
    peerId: 1,
    uid: 11,
    info: {
        name: name,
        status: 'test',
        resources: {
            audio: true,
            video: true,
        },
    },
};

let peer2 = {
    peerId: 2,
    uid: 22,
    info: {
        name: name,
        status: 'test 2',
        resources: {
            audio: true,
            video: true,
        },
    },
};

let peer3 = {
    id: 3,
    uid: 33,
    info: {
        name: name,
        status: 'test 3',
        resources: {
            audio: true,
            video: true,
        },
    },
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
            let testPayload = {members: [peer1, peer2], self: peer3};
            let message = {t: 'j', p: decamelizeKeys(testPayload)};
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
                    expect(peerInList.info.resources).to.deep.equal(peer1.info.resources);
                }
            });
            rc.on('join', (data, message) => {
                expect(data).to.deep.equal(testPayload);
                expect(message.typeName).to.equal('join');
                expect(message.payload).to.deep.equal(data);
                if (peer1Added && peer2Added) {
                    done();
                }
            });
            rc.socket.emit('message', message);
        });

        it('Sets selfPeerId on join', (done) => {
            let testPayload = decamelizeKeys({members: [], self: peer3});
            let message = {t: 'j', p: testPayload};
            rc.on('join', (data, message) => {
                expect(rc.selfPeerId).to.equal(peer3.peerId);
                done();
            });
            rc.socket.emit('message', message);
        });

        it('Only emits message event (and relevant typed events) if from another peer', (done) => {
            rc.status = 'connected';
            rc.selfPeerId = peer1.peerId;
            rc.addPeer(peer2);
            rc.socket.emit('message', {t: 'a', p: {peer: {peer1}}, P: peer1.peerId});
            rc.socket.emit('message', {t: 'e', p: {type: 'testEvent', data: null}, P: peer1.peerId});
            rc.on('event.testEvent', () => {
                done(new Error('Should not have emitted for this event'));
            });
            rc.on('message', () => {
                done(new Error('Should not have emitted for this message'));
            });
            setTimeout(done, 50);
        });

        it('Camelizes incoming messages', (done) => {
            rc.on('message', (message) => {
                if (message.type == 'e') {
                    expect(message.payload.type).to.equal('testEventName');
                    expect(message.payload.data.testKey1).to.equal('foo');
                    expect(message.payload.data.test_key_1).to.be.undefined;
                }
                else if (message.type == 'a') {
                    expect(message.payload.dataTest).to.equal(22);
                    expect(message.payload.data_test).to.be.undefined;
                    done();
                }
            });
            rc.socket.emit('message', {
                t: 'e',
                p: {
                    type: 'test_event_name',
                    data: {
                        test_key_1: 'foo',
                    }
                }
            });
            rc.socket.emit('message', {
                t: 'a',
                p: {
                    peer: peer2,
                    data_test: 22,
                }
            });
        });

        it('Passes through signalling messages to peers', () => {
            rc.status = 'connected';
            rc.addPeer(peer1);
            let peer = rc.addPeer(peer2);
            sinon.stub(peer, 'receiveSignallingMessage');
            let payload = {to: 2, foo: {bar: 'baz'}};
            rc.socket.emit('message', {t: 's', p: payload});
            expect(peer.receiveSignallingMessage).to.have.been.calledWith(payload);
        });

        it('Re-emits events with the correct name', (done) => {
            rc.status = 'connected';
            rc.on('event.testEvent1', (data, message) => {
                expect(data).to.deep.equal({foo: 'bar'});
                expect(message.typeName).to.equal('event');
                expect(message.payload).to.deep.equal({
                    type: 'testEvent1',
                    data: {foo: 'bar'}
                });
                done();
            });
            rc.socket.emit('message', {
                t: 'e',
                p: {
                    type: 'test_event_1',
                    data: {foo: 'bar'}
                }
            });
        });

        it('Adds peers correctly on announce (even for duplicate peers)', (done) => {
            rc.status = 'connected';
            rc.addPeer(peer1);
            let peerAnnounced = false;
            rc.once('peerAnnounce', () => {
                peerAnnounced = true;
                // TODO: check the data and message here
            });
            rc.once('peerAdded', () => {
                expect(rc.peers).has.lengthOf(2);
                expect(rc.peers[0].uid).to.equal(peer1.uid);
                expect(rc.peers[0].info).to.deep.equal(peer1.info);
                expect(rc.peers[0].info.resources).to.deep.equal(peer1.info.resources);
                expect(rc.peers[0].id).to.equal(peer1.peerId);
                expect(rc.peers[1].uid).to.equal(peer2.uid);
                expect(rc.peers[1].info).to.deep.equal(peer2.info);
                expect(rc.peers[1].info.resources).to.deep.equal(peer2.info.resources);
                expect(rc.peers[1].id).to.equal(peer2.peerId);
            });
            rc.socket.emit('message', {t: 'a', p: {peer: peer2}});
            rc.once('peerAdded', () => {
                expect(rc.peers).has.lengthOf(2);
                expect(rc.peers[0].uid).to.equal(peer1.uid);
                expect(rc.peers[0].info).to.deep.equal(peer1.info);
                expect(rc.peers[0].info.resources).to.deep.equal(peer1.info.resources);
                expect(rc.peers[0].id).to.equal(peer1.peerId);
                expect(rc.peers[1].uid).to.equal(peer2.uid);
                expect(rc.peers[1].info).to.deep.equal(peer2.info);
                expect(rc.peers[1].info.resources).to.deep.equal(peer2.info.resources);
                expect(rc.peers[1].id).to.equal(peer2.peerId);
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
            let peerRemovedCalled = false;
            rc.once('peerRemoved', ({peerId, uid}) => {
                peerRemovedCalled = true;
                expect(peerId).to.equal(peer2.peerId);
                expect(uid).to.equal(peer2.uid);
            });
            rc.once('peerLeave', (peer, message) => {
                expect(peer.id).to.equal(peer2.peerId);
                expect(peer.uid).to.equal(peer2.uid);
                expect(rc.peers).to.have.lengthOf(1);
                expect(rc.getPeer(peer2.peerId)).to.be.undefined;
                expect(rc.peers[0].id).to.equal(peer1.peerId);
                if (peerRemovedCalled) {
                    done();
                }
                else {
                    done(new Error('peerRemoved not called'));
                }
                // TODO also check message
            });
            rc.socket.emit('message', {t: 'l', p: {id: peer2.peerId}});
        });

        it('After a valid message of any kind, emits a message event', (done) => {
            let testMessages = [
                {t: 'j', p: {members: [], self: {peerId: peer1.id}}},
                {t: 'a', p: {peer: peer2}},
                {t: 'e', p: {type: 'testEvent1', data: {foo: 'bar'}}},
                {t: 's', p: {to: peer2.peerId}},
                {t: 'l', p: {id: peer2.peerId}},
            ];
            let numMessagesReceived = 0;
            for (let msg of testMessages) {
                rc.once('message', (received) => {
                    if (received.type == 'a') {
                        sinon.stub(rc.peers[0], 'receiveSignallingMessage');
                    }
                    expect(received.type).to.equal(msg.t);
                    expect(received.payload).to.deep.equal(msg.p);
                    numMessagesReceived++;
                    if (numMessagesReceived == 5) {
                        done();
                    }
                });
                rc.socket.emit('message', decamelizeKeys(msg));
            }
        });
    });

    context('Actions', () => {
        beforeEach( () => {
            rc = new RoomConnection({urls: {
                messages: '/test/messages/url/',
                recordings: '/test/recordings/url/',
                action: '/test/actions/url/:name/',
                join: '/test/join/url/',
            }});
            sinon.stub(rc.socket, 'send');
            sinon.stub(util, 'fetchPost', () => 'fakePromise');
        });

        afterEach( () => {
            util.fetchPost.restore();
        });

        it('initialJoin POSTs join data to the server', () => {
            let res = rc.initialJoin({foo: 'bar', fooBar: 2});
            expect(util.fetchPost).to.have.been.calledWith(rc.urls.join, {
                foo: 'bar',
                foo_bar: 2
            });
            expect(res).to.equal('fakePromise');
        });

        it('runAction POSTs an action to the server and returns a promise', () => {
            let res = rc.runAction('actionName', {foo: 'bar', fooBar: 2});
            expect(util.fetchPost).to.have.been.calledWith('/test/actions/url/action_name/', {
                foo: 'bar',
                foo_bar: 2
            });
            expect(res).to.equal('fakePromise');
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

        it('sendEvent(..., {http: false}) sends events through the socket', () => {
            rc.status = 'connected';
            rc.sendEvent('testEvent1', {foo: 'bar'}, {http: false});
            expect(rc.socket.send).to.have.been.calledWithExactly({
                t: 'e',
                p: {
                    type: 'test_event_1',
                    data: {foo: 'bar'},
                }
            });
        });

        it('sendEvent(..., {http: true}) sends events over HTTP and returns a promise', () => {
            rc.status = 'connected';
            let res = rc.sendEvent('testEvent2', {foo: 'bar'}, {http: true});
            expect(util.fetchPost).to.have.been.calledWith(rc.urls.messages, {
                type: 'e',
                payload: {
                    type: 'test_event_2',
                    data: {foo: 'bar'}
                }
            });
            expect(res).to.equal('fakePromise');
        });

        it('send decamelizes message keys', () => {
            rc.send({type: 'e', payload: {
                type: 'test',
                data: {'fooBar': 'bar12'}
            }}, {http: false});
            expect(rc.socket.send).to.have.been.calledWithExactly({
                t: 'e',
                p: {
                    type: 'test',
                    data: {'foo_bar': 'bar12'}
                }
            });
        });

        it('notifyCreatedRecording posts to the recordings url', () => {
            let res = rc.notifyCreatedRecording({foo: 'bar', fooBar: 2});
            expect(util.fetchPost).to.have.been.calledWith(rc.urls.recordings, {
                foo: 'bar',
                foo_bar: 2
            });
            expect(res).to.equal('fakePromise');
        });
    });
});
