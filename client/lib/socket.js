import WildEmitter from "wildemitter";

export default class Socket extends WildEmitter {
    /**
     * Tiny emitter-based wrapper for web sockets
     */

    constructor(opts) {
        super()
        this.status = 'closed';
        this.url = opts.url
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