import {on} from 'lib/actions';

export default actions = {
    @on('messages:send')
    sendMessage: (message) => {
        this.connection.sendEvent('message', {m: message})
        this.messages.add(message)
    },

    @on('connection:event:message')
    receiveMessage: (message) => {
        this.messages.add(message)
    },
}
