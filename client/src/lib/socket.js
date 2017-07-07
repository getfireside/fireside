import WildEmitter from "wildemitter";
import ReconnectingWebSocket from "reconnectingwebsocket";
import {observable, action} from 'mobx';

export default class Socket extends WildEmitter {
    /**
     * Tiny emitter-based wrapper for web sockets
     */

    @observable status;
    @observable nextAttemptTime;

    constructor(opts) {
        super()
        this.status = 'closed';
        this.url = opts.url;
    }

    @action open() {
        this.ws = new ReconnectingWebSocket(this.url, undefined, {
            maxReconnectInterval: 10000,
            timeoutInterval: 5000,
            debug: true,
        });
        this.status = 'connecting';
        this.ws.onconnecting = action((event) => {
            if (event.code) {
                let timeout = this.ws.reconnectInterval * Math.pow(
                    this.ws.reconnectDecay, this.ws.reconnectAttempts
                );
                timeout = (timeout > this.ws.maxReconnectInterval ? this.ws.maxReconnectInterval : timeout);
                this.nextAttemptTime = new Date((new Date()).getTime() + timeout);
                this.status = 'connecting';
            }
        })
        this.ws.onopen = action((event) => {
            this.status = 'open';
            this.emit('open', event);
        });

        this.ws.onmessage = (event) => {
            var msg = JSON.parse(event.data);
            this.emit('message', msg);
        };
        this.ws.onclose = action((event) => {
            this.status = 'closed';
            this.emit('close', event);
        });
    }

    send(data) {
        this.ws.send(JSON.stringify(data));
    }

    close() {
        this.ws.close();
    }

    restart() {
        this.ws.refresh();
    }
}