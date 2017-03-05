import WildEmitter from 'wildemitter';
import Peer from 'lib/rtc/peer';

class Socket extends WildEmitter {
    /**
     * Tiny emitter-based wrapper for web sockets
     */
    
    constructor(opts) {
        this.status = 'closed';
        this.url = url
    }

    open() {
        this.ws = new WebSocket(this.url)
        this.status = 'connecting'
        this.ws.onopen = (event) => {
            this.status = 'open'
            this.emit('open', event)
        }

        this.ws.onmessage = (event) => {
            var msg = JSON.parse(event.data)
            this.emit('message', msg)
        }
        this.ws.onclose = (event) => {
            this.status = 'closed'
            this.emit('close', event)
        }
    }

    send(type, payload) {
        this.ws.send({
            type, 
            payload
        });
    }

    close() {
        this.ws.close()
    }
}

const MESSAGE_TYPE_MAP = {
    s: 'signalling',
    a: 'authentication',
    m: 'message',
    l: 'leave',
    j: 'joinRoom',
    A: 'announce',
    e: 'event'
}

const MESSAGE_REVERSED_TYPE_MAP = _.invert(MESSAGE_TYPE_MAP)

class RoomConnection extends WildEmitter {
    /**
     * Handles the connection to the signalling server, and to the RTC peers.
     */
    constructor(opts) {
        this.wsUrl = opts.wsUrl

        this.peers = []
        this.localMedia = [];

        this.socket = Socket({wsUrl: this.wsUrl})
        this.socket.on('message', handleSocketMessage)

        this.status = 'disconnected'

        this.messageActions = {
            signalling: (message) => {
                let peer = this.getPeer(message.id);
                if (peer) {
                    peer.receiveSignallingMessage(message)
                }
            },
            authentication: (message) => {
                if (message.payload == 'OK') {
                    this.onConnect()
                }
            },
            announce: (message) => {
                let peer = this.addPeer(message.payload)
                this.emit('announcePeer', peer)
            },
            joinRoom: (message) => {
                // this event is sent on join
                this.emit('joinRoom', message.payload)
                for (peer of message.payload.peers) {
                    this.addPeer(peer)
                }
            }
            leave: (message) => {
                this.removePeer(message.payload.peerId)
            }
        }
        this.connectActions()
    }

    connectActions() {
        _.forIn(this.messageActions, (v, k) => {
            this.on(`event:${k}`, v);
        })
    }

    onConnect() {
        this.status = 'connected'
        this.emit('connect')
    }

    async connect() {
        /**
         * Open the websocket and connect
         */
        if (this.status == 'disconnected') {
            this.status = 'connecting'
            this.socket.open()
            this.socket.on('open', this.doHandshake.bind(this))
            this.emit('connecting')
        }
    }

    doHandshake() {
        /**
         * Perform the authentication handshake
         */
        this.send('authenticate', {t: this.authToken})
    }

    handleSocketMessage(message) {
        /**
         * Dispatches a message received from the socket.
         * @private
         * @param {obj} message: the received message
         */
        this.emit(`event:${MESSAGE_TYPE_MAP[message.t]}`, message.p)
        // let [type, subtype] = message.type.split(':', 1);
        // this.messageActions[root](message)
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
        })
        if (this.stream) {
            peer.addLocalStream()
        }
        this.emit('peerAdded', peer)
    }

    send(name, data) {
        this.ws.send({
            t: MESSAGE_REVERSED_TYPE_MAP[name],
            p: data
        })
    }

    sendEvent(name, data) {
        this.send('event', {name: name, data: data})
    }

    connectStream(stream) {
        this.stream = stream;
        for (let peer of this.peers) {
            peer.addLocalStream(this.stream)
        }
        this.emit('localStreamConnected')
    }

    getPeer(id) {
        return _.find(this.peers, p => p.id == id)
    }

    removePeer(id) {
        let peer = this.getPeer(id);
        peer.end()
        this.peers = _.reject(this.peers, p => p.id == id)
        this.emit('peerRemoved', peer.id)
    }
}