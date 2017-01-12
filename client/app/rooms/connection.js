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
                message.type = message.type.split(':', 1)[1]
                let peer = this.getPeer(message.id);
                if (peer) {
                    peer.receiveSignallingMessage(message)
                }
            },
            authenticate: (message) => {
                if (message.payload == 'OK') {
                    this.status = 'connected'
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
    }

    async connect() {
        /**
         * Open the websocket and connect
         */
        if (this.status != 'connected') {
            this.socket.open()
            this.socket.on('open', this.doHandshake.bind(this))
        }
    }

    doHandshake() {
        /**
         * Perform the authentication handshake
         */
        this.socket.send('authenticate', this.authToken)
    }

    handleSocketMessage(message) {
        /**
         * Dispatches a message received from the socket.
         * @private
         * @param {obj} message: the received message
         */
        let [type, subtype] = message.type.split(':', 1);
        this.messageActions[root](message)
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