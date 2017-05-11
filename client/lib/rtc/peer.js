import webrtcSupport from 'webrtcsupport';
import PeerConnection from 'rtcpeerconnection';
import WildEmitter from 'wildemitter';
// import FileTransfer from 'filetransfer';
import Logger from 'lib/logger';
import {MESSAGE_TYPES} from 'app/rooms/constants';

import _ from 'lodash';

class Peer extends WildEmitter {
    /**
     * Represents a peer connected via WebRTC and manages the connection.
     */
    constructor(opts) {
        super();
        this.id = opts.id;
        this.uid = opts.uid;
        this.info = opts.info; // info about this peer from the signalling server

        this.connection = opts.connection;

        // WebRTC stuff
        this.browserPrefix = null;
        this.stream = opts.stream || null;
        this.enableDataChannels = opts.enableDataChannels || true;
        this.receiveMedia = opts.receiveMedia;
        this.status = 'disconnected';

        this.peerConnectionConfig = {
            iceServers: [{'urls': 'stun:stun.l.google.com:19302'}],
        };

        this.channels = {};

        this.logger = opts.logger != null ? opts.logger : new Logger(null, 'Peer');

        this.peerConnectionActions = {
            ice: (candidate) => {
                if (this.closed) return;
                if (candidate) {
                    this.sendSignallingMessage('candidate', candidate);
                } else {
                    this.logger.log("End of candidates.");
                }
            },

            offer: (offer) => {
                this.sendSignallingMessage('offer', offer);
            },

            answer: (offer) => {
                this.sendSignallingMessage('answer', offer);
            },

            addStream: (event) => {
                // let's just go ahead and replace rather than worrying about existing streams.
                this.stream = event.stream;

                for (let track of this.stream.getTracks()) {
                    track.addEventListener('ended', () => {
                        if (_.every(this.stream.getTracks(), (t) => t.readyState === 'ended')) {
                            this.endStream();
                        }
                    });
                }
                this.emit('streamAdded', event.stream);
            },

            removeStream: () => {
                this.stream = null;
                this.emit('streamRemoved');
            },

            addChannel: (channel) => {
                this.emit('dataChannelAdded', channel);
                this.channels[channel.label] = channel;
                if (_.startsWith(channel.label, 'filetransfer:')) {
                    this.emit('fileTransferChannelOpen', channel);
                }
                else {
                    this._observeDataChannel(channel);
                }
            },

            negotiationNeeded: () => {
                this.emit('negotiationNeeded', arguments);
                // this.start();
            },

            iceConnectionStateChange: () => {
                this.logger.log(`Ice connection state changed: ${this.peerConnection.iceConnectionState}`);
                if (_.includes(['connected', 'completed'], this.peerConnection.iceConnectionState)) {
                    if (this.status == 'disconnected') {
                        this.status = 'connected';
                        this.emit('connected');
                    }
                }
                else {
                    if (this.status == 'connected') {
                        this.status = 'disconnected';
                        this.emit('disconnected');
                        this.start(true); //icerestart = true
                    }
                }
                if (this.peerConnection.iceConnectionState == 'failed') {
                    // currently, in chrome only the initiator goes to failed
                    // so we need to signal this to the peer
                    if (this.peerConnection.pc.localDescription.type === 'offer') {
                        this.emit('iceFailed');
                        this.sendSignallingMessage('connectivityError');
                    }
                }
            },

            signalingStateChange: () => {
                this.emit('signalingStateChange', arguments);
            }
        };

        this.signallingActions = {
            offer: (message) => {
                this.peerConnection.handleOffer(message.payload, (err) => {
                    if (err) {
                        this.logger.error(err);
                        return; // TODO actually emit properly
                    }
                    this.emit('remoteDescriptionAdded');
                    this.peerConnection.answer();
                });
            },

            requestFileTransfer: (message) => {
                this.emit('requestFileTransfer', message.payload);
            },

            answer: (message) => {
                this.logger.log('Handling answer');
                this.peerConnection.handleAnswer(message.payload, () => this.emit('remoteDescriptionAdded'));
            },

            candidate: (message) => {
                this.logger.log('Ice candidate', message);
                // // if remote description hasn't been set yet, then adding ice candidates
                // // will throw an error. let's wait until it's been added, then attempt to add.
                // if (this.peerConnection.pc.remoteDescription.type) {
                //     this.peerConnection.processIce(message.payload);
                // }
                // else {
                //     this.once('remoteDescriptionAdded', () => {
                //         this.peerConnection.processIce(message.payload)
                //     });
                // }
                this.peerConnection.processIce(message.payload);
            },

            connectivityError: () => this.emit('connectivityError'),

            endOfCandidates: () => {
                // Edge requires an end-of-candidates. Since only Edge will have mLines or tracks on the
                // shim this will only be called in Edge.
                var mLines = this.peerConnection.pc.peerconnection.transceivers || [];
                for (let line of mLines) {
                    if (line.iceTransport) {
                        line.iceTransport.addRemoteCandidate({});
                    }
                }
            }
        };

        this.setupPeerConnection();

        // this.connection.on('localStream', this.addLocalStream);
        // this.on('signalingStateChange', () => this.logger.log(['new signalling state,', this.peerConnection.signalingState]));
    }

    setupPeerConnection() {
        /**
         * Initialise the internal PeerConnection object, hook up all the
         * methods and get ready to start streaming.
         */
        this.logger.log('setting up new peer connection...');

        if (this.peerConnection != null) {
            this.oldPc = this.peerConnection;
            this.oldPc.releaseGroup();
        }

        this.peerConnection = new PeerConnection(this.peerConnectionConfig, this.peerConnectionConstraints);

        for (let handlerName in this.peerConnectionActions) {
            let handler = this.peerConnectionActions[handlerName];
            this.peerConnection.on(handlerName, handler);
        }

        this.peerConnection.on('signalingStateChange', () => this.emit('signalingStateChange'));
        this.peerConnection.on('*', (...args) => { this.logger.log(["DEBUG PC EVENT", args]); });
        this.logger.log('done setting up PC.');

        // this.controller.localMedia.localStreams.map((stream) => {
        //     this.peerConnection.addStream(stream));
        // }
    }

    _observeDataChannel(channel) {
        /**
         * @private
         * Bind any data channel events to this object.
         * @type {obj} channel: the data channel
         */
        channel.onclose = this.emit.bind(this, 'channelClose', channel);
        channel.onerror = this.emit.bind(this, 'channelError', channel);
        channel.onmessage = event => {
            return this.emit('channelMessage', this, channel.label, JSON.parse(event.data), channel, event);
        };
        channel.onopen = this.emit.bind(this, 'channelOpen', channel);
    }

    getDataChannel(name, opts) {
        /**
         * Fetch or create a data channel by the given name
         */
        if (!webrtcSupport.supportDataChannel) {
            this.logger.warn('DataChannel is claimed to not be currently supported...');
        }
        let channel = this.channels[name];
        if (channel) {
            return channel;
        }
        // if we don't have one by this label, create it
        opts = opts || {};
        channel = this.channels[name] = this.peerConnection.createDataChannel(name, opts);
        if (!_.startsWith(name, 'filetransfer:')) {
            this._observeDataChannel(channel);
        }
        return channel;
    }

    addLocalStream(stream) {
        /**
         * Add a local stream to the connection with this peer.
         */
        this.logger.log("added the local stream!");
        this.peerConnection.addStream(stream);
    }

    receiveSignallingMessage(message) {
        /**
         * Dispatch an incoming message from the signalling server to the various actions.
         * @param {obj} message
         */
        if (message.prefix) {
            this.browserPrefix = message.prefix;
        }
        this.signallingActions[message.type](message);
    }

    sendSignallingMessage(type, payload) {
        /**
         * Send a signalling message to this peer via the signalling server.
         * @param {string} type: message type
         * @param {obj} payload: the contents of the message
         */
        let message = {
            to: this.id,
            uid: this.uid,
            type: type,
            payload: payload,
            prefix: webrtcSupport.prefix
        };
        this.connection.send({type:MESSAGE_TYPES.SIGNALLING, payload:message}, {http:false});
        this.logger.log(["SIGNALLING: SENT", message]);
    }

    sendDirectly(channel, type, payload) {
        /**
         * Send a message to this peer directly.
         * @param {string} type: message type
         * @param {obj} payload: the contents of the message. Must be JSON stringifiable.
         */
        let message = {
            type: type,
            payload: payload
        };

        this.logger.log(["sending via datachannel", channel, type, message]);

        let dc = this.getDataChannel(channel);
        if (dc.readyState !== 'open') {
            return false;
        }

        dc.send(JSON.stringify(message));
        return true;
    }

    start(icerestart = false) {
        /**
         * Attempt to open a stream with this peer.
         */
        this.logger.log(["trying to start", this.id]);
        // well, the webrtc api requires that we either
        // a) create a datachannel a priori
        // b) do a renegotiation later to add the SCTP m-line
        // Let's do (a) first...
        if (this.enableDataChannels) {
            this.getDataChannel('rtc');
        }

        this.streamClosed = false;
        let constraints = {};
        constraints.iceRestart = icerestart;

        return this.peerConnection.offer(constraints, (err, sessionDescription) => {
            if (err) {
                this.logger.error(['error!', err]);
            }
        });
    }

    endStream(restart = false) {
        /**
         * Close the stream.
         */
        if (this.streamClosed) {
            return;
        }
        this.peerConnection.close();
        if (restart) {
            this.sendSignallingMessage('restart');
        }
        this.streamClosed = true;
        this.emit('streamRemoved');
    }

    end() {
        /**
         * Close the stream and the peer connection.
         */
        if (this.closed) {
            return;
        }
        this.logger.log([this.id, "leaving"]);
        this.endStream();
        this.closed = true;
        this.releaseGroup();
    }
}

export default Peer;