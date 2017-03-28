import WildEmitter from 'wildemitter';
import _ from 'lodash';
import {observable} from 'mobx';

import Peer from 'lib/rtc/peer';
import Socket from 'lib/socket';


const MESSAGE_TYPE_MAP = {
    s: 'signalling',
    a: 'authentication',
    m: 'message',
    l: 'leave',
    j: 'joinRoom',
    A: 'announce',
    e: 'event'
};

const MESSAGE_REVERSED_TYPE_MAP = _.invert(MESSAGE_TYPE_MAP);

export default class RoomConnection extends WildEmitter {
    /**
     * Handles the connection to the signalling server, and to the RTC peers.
     */
    @observable status = null;
    @observable.shallow peers = [];

    constructor(opts) {
        super();
        this.wsUrl = opts.wsUrl;
        this.config = {
            enableDataChannels: opts.enableDataChannels || true,
        };

        this.peers = [];
        this.localMedia = [];

        this.socket = new Socket({url: this.wsUrl});
        this.socket.on('message', this.handleSocketMessage.bind(this));

        this.status = 'disconnected';

        this.messageHandlers = {
            signalling: (data) => {
                let peer = this.getPeer(data.id);
                if (peer) {
                    peer.receiveSignallingMessage(data);
                }
            },
            announce: (data) => {
                let peer = this.addPeer(data.peer);
                this.emit('announcePeer', peer);
            },
            joinRoom: (data) => {
                // this event is sent on join
                this.emit('joinRoom', data);
                for (let peer of data.peers) {
                    this.addPeer(peer);
                }
            },
            leave: (data) => {
                this.removePeer(data.id);
            },
            event: (data) => {
                this.emit(`event.${data.type}`, data.payload);
            }
        }
    }

    onConnect() {
        this.status = 'connected';
        this.emit('connect');
    }

    connect() {
        /**
         * Open the websocket and connect
         */
        if (this.status == 'disconnected') {
            this.status = 'connecting';
            this.socket.once('open', this.onConnect.bind(this));
            this.socket.open();
            this.emit('connecting');
        }
    }

    handleSocketMessage(message) {
        /**
         * Dispatches a message received from the socket.
         * @private
         * @param {obj} message: the received message
         */
        let [type, payload] = [MESSAGE_TYPE_MAP[message.t], message.p];
        // let [type, subtype] = message.type.split(':', 1);
        this.messageHandlers[type](payload);
    }

    addPeer(data) {
        /**
         * Set up a peer
         * @param {obj} peer: Info received from the server about the peer
         */
        let peer = new Peer({
            id: data.id,
            uid: data.uid,
            info: data.info,
            resources: data.resources,
            enableDataChannels: this.config.enableDataChannels,
            connection: this,
        });
        if (this.stream) {
            peer.addLocalStream(this.stream);
        }
        let existingPeer = this.getPeer(peer.id);
        if (existingPeer) {
            existingPeer = peer;
        }
        else {
            this.peers.push(peer);
        }
        this.emit('peerAdded', peer);
        return peer;
    }

    send(name, data) {
        this.socket.send({
            t: MESSAGE_REVERSED_TYPE_MAP[name],
            p: data
        });
    }

    sendEvent(name, data) {
        this.send('event', {name: name, data: data});
    }

    sendMessage(name, data) {
        this.send('message', {type: name, payload: data});
    }

    connectStream(stream) {
        this.stream = stream;
        for (let peer of this.peers) {
            peer.addLocalStream(this.stream)
        }
        this.emit('localStreamConnected');
    }

    getPeer(id) {
        return _.find(this.peers, p => p.id == id)
    }

    removePeer(id) {
        let peer = this.getPeer(id);
        peer.end();
        this.peers = _.reject(this.peers, p => p.id == id);
        this.emit('peerRemoved', {peerId: peer.id, userId: peer.uid});
    }
}