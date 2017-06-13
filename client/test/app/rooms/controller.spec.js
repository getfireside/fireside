import RoomController from 'app/rooms/controller';
import {MESSAGE_TYPES, MEMBER_STATUSES} from 'app/rooms/constants';
import MemFS from 'lib/fs/memfs';
import {Recording} from 'app/recordings/store';
import {sleep} from 'lib/util/async';

describe.only("RoomController", function() {
    let rc = null;
    beforeEach( () => {
        let fs = new MemFS;
        let room = fixtures.roomWithStores({fs: fs});
        rc = new RoomController({
            fs: fs,
            room: room
        });
    });

    context('Event handlers', () => {
        context('Recorder events', () => {
            let rec;
            beforeEach( () => {
                rec = new Recording({
                    room: {id: 2},
                    id: 'aaaa',
                    started: new Date(),
                    filesize: 1856,
                    type: 'audio/wav',
                    uid: 1
                });
            });
            it(`When the local recorder status changes, send an event
                (over HTTP)`, () => {
                sinon.stub(rc.connection, 'sendEvent');
                // the other rec events will try to run too, so let's stop them
                rc.recorder.callbacks.started = [];
                rc.recorder.callbacks.blobWritten = [];
                rc.recorder.callbacks.stopped = [];
                for (let event of ['ready', 'started', 'stopping', 'stopped']) {
                    rc.connection.sendEvent.reset();
                    rc.recorder.emit(event);
                    expect(rc.connection.sendEvent).to.have.been.calledWith(
                        'updateStatus', {recorderStatus: event}, {http:true}
                    );
                }
            });

            it(`When the local recording starts, send a HTTP request to the
                server and set current recording.`, () => {
                sinon.stub(rc.connection, 'notifyCreatedRecording');
                rc.recorder.currentRecording = rec;
                rc.recorder.emit('started', rec);
                expect(rc.room.memberships.self.currentRecordingId).to.equal(rec.id);
                expect(rc.room.memberships.self.currentRecording).to.equal(rec);
                expect(rc.connection.notifyCreatedRecording)
                    .to.have.been.calledWith({
                        started: +(rec.started),
                        ended: null,
                        filesize: 1856,
                        id: 'aaaa',
                        type: 'audio/wav',
                        uid: 1,
                        roomId: 2,
                    });
            });

            it(`On local blobWritten, send an event over the socket with the new
                filesize`, () => {
                sinon.stub(rc.connection, 'sendEvent');
                rc.recorder.currentRecording = rec;
                rc.recorder.emit('blobWritten');
                expect(rc.connection.sendEvent).to.have.been.calledWith(
                    'updateRecording',
                    {id: rec.id, filesize: 1856},
                    {http: false}
                );
            });

            it(`On complete, send an event over the socket with the new
                data`, () => {
                sinon.stub(rc.connection, 'sendEvent');
                rec.ended = new Date();
                rc.recorder.currentRecording = rec;
                rc.recorder.emit('stopped', rec);
                expect(rc.connection.sendEvent).to.have.been.calledWith(
                    'stopRecording',
                    {
                        filesize: 1856,
                        id: rec.id,
                        ended: +(rec.ended)
                    },
                    {http: true}
                );
            });

            it('On start recording request, attempt to start recording.', () => {
                sinon.stub(rc.recorder, 'start');
                rc.connection.emit('event.requestStartRecording');
                expect(rc.recorder.start.calledOnce).to.be.true;
            });

            it('On stop recording request, attempt to stop recording.', () => {
                sinon.stub(rc.recorder, 'stop');
                rc.connection.emit('event.requestStopRecording');
                expect(rc.recorder.stop.calledOnce).to.be.true;
            });

            it('On remote recording status update, pass through to recording store', () => {
                sinon.spy(rc.room.recordingStore, 'update');
                rc.room.recordingStore.create(rec);
                for (let eventType of ['startRecording', 'updateRecording', 'stopRecording']) {
                    rc.connection.emit(`event.${eventType}`, {
                        uid: 22,
                        id: 'aaaa',
                        type: 'video/webm',
                        filesize: 100000,
                    });
                    expect(rc.room.recordingStore.update).to.have.been.calledWith([{
                        room: rc.room,
                        uid: 22,
                        id: 'aaaa',
                        type: 'video/webm',
                        filesize: 100000,
                    }]);
                }
            });
        });

        context('On join', () => {
            let message;
            beforeEach( () => {
                message = {
                    payload: {
                        members: _.map(rc.room.memberships.values(), (m, i) => ({
                            uid: m.uid,
                            info: {
                                role: m.role,
                                name: m.name,
                                diskUsage: m.diskUsage,
                                resources: m.resources,
                                recorderStatus: m.recorderStatus,
                                recordings: []
                            },
                            peerId: m.peerId,
                        })),
                        self: {
                            name: rc.room.memberships.values()[0].name,
                            info: {role: rc.room.memberships.values()[0].role},
                            peerId: 'bbbb',
                            uid: rc.room.memberships.values()[0].uid
                        }
                    },
                    timestamp: +(new Date()),
                }
            });
            it('Adds members', async () => {
                let spy = sinon.spy(rc.room, 'updateMembership');
                rc.connection.emit('join', message.payload, message);
                await sleep(10);
                expect(spy.args).to.have.lengthOf(4);
                _.each(message.payload.members, (m, i) => {
                    expect(spy.args[i][0]).to.equal(m.uid);
                    expect(spy.args[i][1]).to.deep.equal({
                        status: m.peerId ? MEMBER_STATUSES.CONNECTED : MEMBER_STATUSES.DISCONNECTED,
                        role: m.info.role,
                        name: m.info.name,
                        uid: m.uid,
                        diskUsage: m.info.diskUsage,
                        resources: m.info.resources,
                        recorderStatus: m.info.recorderStatus,
                    })
                });
            });
            it('Updates self', async () => {
                let spy = sinon.spy(rc.room, 'updateMembership');
                rc.connection.emit('join', message.payload, message);
                await sleep(10);
                let args = spy.args[spy.args.length-1];
                expect(args[0]).to.equal(message.payload.self.uid);
                expect(args[1]).to.deep.equal({
                    status: 1,
                    role: message.payload.self.info.role,
                    peerId: message.payload.self.peerId,
                    name: message.payload.self.info.name,
                    uid: message.payload.self.uid,
                })
            });
            it('Gets and updates messages from server', async () => {
                let stub = sinon.stub(rc.connection, 'getMessages');
                stub.resolves([{id: 213}, {id: 214}]);
                let stub2 = sinon.stub(rc.room, 'updateMessagesFromServer');
                rc.connection.emit('join', message.payload, message);
                await sleep(10);
                expect(stub).to.have.been.calledWith({until: message.timestamp});
                expect(stub2).to.have.been.calledWith([{id: 213}, {id: 214}]);
            });
            it('If getting messages fails, restarts connection', async () => {
                let stub = sinon.stub(rc.connection, 'getMessages');
                let stub2 = sinon.stub(rc.connection, 'restart');
                stub.rejects();
                rc.connection.emit('join', message.payload, message);
                await sleep(10);
                expect(stub2.calledOnce).to.be.true;
            })
            it('Tries to open the FS', async () => {
                let stub = sinon.stub(rc.connection, 'getMessages');
                stub.resolves([{id: 213}, {id: 214}]);
                let stub2 = sinon.stub(rc, 'openFS');
                rc.connection.emit('join', message.payload, message);
                await sleep(10);
                expect(stub2.calledOnce).to.be.true;
            });
        });

        it("When a peer joins, updates everything correctly", () => {
            sinon.stub(rc.room.recordingStore, 'update');
            sinon.stub(rc.room, 'updateMembership');
            let peer = {
                id: 'aaaa',
                uid: 22,
                on: () => null,
                info: {
                    name: "Test user",
                    role: 'guest',
                    diskUsage: {usage: 0, quota: 3},
                    resources: {audio: true, video: false},
                    recordings: [{
                        id: "test-rec-22",
                        type: 'audio/wav',
                        filesize: 5552,
                        started: +( new Date() ),
                        ended: null,
                        uid: 22,
                    }]
                },
                currentRecordingId: "test-rec-22",
            };
            sinon.stub(peer, 'on');
            rc.connection.emit('peerAdded', peer);
            expect(rc.room.recordingStore.update).calledWith([{
                id: 'test-rec-22',
                type: 'audio/wav',
                room: rc.room,
                started: peer.info.recordings[0].started,
                ended: null,
                filesize: 5552,
                uid: 22,
            }]);
            expect(rc.room.updateMembership).calledWith(peer.uid, {
                peerId: peer.id,
                status: MEMBER_STATUSES.CONNECTED,
                role: peer.info.role,
                currentRecordingId: peer.info.currentRecordingId,
                peer: peer,
                name: peer.info.name,
                diskUsage: peer.info.diskUsage,
                resources: peer.info.resources,
            });
        });

        it('When a peer leaves, dispatch to room membership', () => {
            sinon.stub(rc.room, 'updateMembership');
            rc.connection.emit('peerRemoved', {uid: 123});
            expect(rc.room.updateMembership).calledWith(123, {
                status: MEMBER_STATUSES.DISCONNECTED,
                peerId: null,
                peer: null,
            });
        });

        it(`On receiving a message event from connection, adds received messages
            to the message store`, () => {
            sinon.stub(rc.room.messageStore, 'addMessage');
            let testMessage = {type: 'test', payload: {foo: 'bar'}};
            rc.connection.emit('message', testMessage);
            expect(rc.room.messageStore.addMessage).to.have.been.calledWith(testMessage);
        });

        it('Dispatches status updates from connection to room user connection', () => {
            sinon.stub(rc.room, 'updateMembership');
            rc.connection.emit('event.updateStatus', {
                foo: 'bar'
            }, {uid: 42});
            expect(rc.room.updateMembership).to.have.been.calledWith(
                42, {foo: 'bar'}
            );
        });

        it('When a disk usage update is trigged, send it through to the connection and update self', () => {
            sinon.stub(rc.connection, 'sendEvent');
            let diskUsage = {usage: 0, quota: 1024};
            rc.fs.emit('diskUsageUpdate', diskUsage);
            expect(rc.room.memberships.self.diskUsage).to.deep.equal(diskUsage);
            expect(rc.connection.sendEvent).to.have.been.calledWith(
                'updateStatus', {diskUsage}, {http:false}
            );
        });
    });

    context('Actions', () => {
        it(`When sendEvent called, add message to store and send through
            connection`, () => {
            let promise = new Promise( () => null );
            sinon.stub(rc.connection, 'sendEvent').returns(promise);
            let spy = sinon.spy(rc.room.messageStore, 'addMessage');
            let testEvent = {type: 'testEvent', data: {foo: 'bar'}};
            let result = rc.sendEvent(testEvent.type, testEvent.data);
            expect(rc.connection.sendEvent).to.have.been.calledWith(
                testEvent.type,
                testEvent.data,
                {http: true}
            );

            var messageData = spy.args[0][0];
            expect(messageData.type).to.equal(MESSAGE_TYPES.EVENT);
            expect(messageData.payload).to.deep.equal(testEvent);
            expect(messageData.room).to.equal(rc.room);
            expect(spy.args[0][1]).to.deep.equal({sendPromise: promise});

            expect(result.type).to.equal(MESSAGE_TYPES.EVENT);
            expect(result.payload).to.deep.equal(testEvent);
            expect(result.room).to.equal(rc.room);
            expect(result.status).to.equal('pending');
        });

        it(`requestStartRecording/requestStopRecording are passed through to
            runAction`, () => {
            sinon.stub(rc.connection, 'runAction');
            rc.requestStartRecording({peerId: 2});
            expect(rc.connection.runAction).to.have.been.calledWith(
                'startRecording',
                {'peerId': 2},
            );
            rc.connection.runAction.reset();
            rc.requestStopRecording({peerId: 2});
            expect(rc.connection.runAction).to.have.been.calledWith(
                'stopRecording',
                {'peerId': 2},
            );
            rc.connection.runAction.reset();
        });

        it('updateResources sends updateStatus event over the socket', () => {
            sinon.stub(rc.connection, 'sendEvent');
            rc.updateResources({
                video: {
                    width: 1920,
                    height: 1080
                },
                audio: true
            });
            expect(rc.connection.sendEvent).to.have.been.calledWith(
                'updateStatus',
                {
                    resources: {
                        video: {
                            width: 1920,
                            height: 1080
                        },
                        audio: true
                    }
                },
                {http: false}
            );
        });

        context('setupLocalMedia', () => {
            beforeEach( () => {
                sinon.stub(rc.recorder, 'setStream');
                sinon.stub(rc.connection, 'connectStream');
                sinon.stub(rc, 'updateResources');
            });
            it('attaches a media stream to the recorder and connection', async () => {
                let mediaStream = await rc.setupLocalMedia();
                expect(mediaStream).to.be.an.instanceOf(MediaStream);
                expect(rc.recorder.setStream).to.have.been.calledWith(mediaStream);
                expect(rc.connection.connectStream).to.have.been.calledWith(
                    mediaStream
                );
                expect(rc.updateResources).to.have.been.calledWith({
                    audio: true,
                    video: true
                });
            });
            it('calls updateResources when ended, but only after all tracks end', async () => {
                let mediaStream = await rc.setupLocalMedia();
                rc.updateResources.reset();
                mediaStream.getTracks()[0].stop();
                expect(rc.updateResources).not.to.have.been.called;
                mediaStream.getTracks()[1].stop();
                expect(rc.updateResources).to.have.been.calledWith({audio: null, video: null});
            });
        });
    });
});
