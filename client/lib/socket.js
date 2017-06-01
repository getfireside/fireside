import WildEmitter from "wildemitter";
import ReconnectingWebSocket from "reconnecting-websocket";

export default class Socket extends WildEmitter {
    /**
     * Tiny emitter-based wrapper for web sockets
     */

    constructor(opts) {
        super()
        this.status = 'closed';
        this.url = opts.url;
    }

    open() {
        this.ws = new ReconnectingWebSocket(this.url, undefined, {
            maxReconnectInterval: 10000,
            timeoutInterval: 5000,
            debug: true,
        });
        this.status = 'connecting';
        this.ws.onopen = (event) => {
            this.status = 'open';
            this.emit('open', event);
        };

        this.ws.onmessage = (event) => {
            var msg = JSON.parse(event.data);
            this.emit('message', msg);
        };
        this.ws.onclose = (event) => {
            this.status = 'closed';
            this.emit('close', event)
        };
    }

    send(data) {
        this.ws.send(JSON.stringify(data));
    }

    close() {
        this.ws.close();
    }
}