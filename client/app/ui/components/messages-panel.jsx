import React from 'react';
import _ from 'lodash';
import {observer} from 'mobx-react';
import Textarea from 'react-textarea-autosize';

@observer
export class MessageContainer extends React.Component {
    render() {
        return (
            <div className={`message ${this.props.className}`}>
                <time>{this.props.message.time.format('HH:mm')}</time>
                {this.props.children}
            </div>
        )
    }
}

@observer
export class JoinMessage extends React.Component {
    render() {
        return (
            <MessageContainer message={this.props.message} className="join">
                <div className="content"><b>You</b> connected.</div>
            </MessageContainer>
        );
    }
}

@observer
export class LeaveMessage extends React.Component {
    render() {
        return (
            <MessageContainer message={this.props.message} className="leave">
                <div className="content">
                    <b>{this.props.message.memberDisplayName}</b>
                    {' '}disconnected.
                </div>
            </MessageContainer>
        );
    }
}

@observer
export class AnnounceMessage extends React.Component {
    render() {
        return (
            <MessageContainer message={this.props.message} className="announce">
                <div className="content">
                    <b>{this.props.message.memberDisplayName}</b>
                    {' '}connected.
                </div>
            </MessageContainer>
        );
    }
}

@observer
export class ChatMessage extends React.Component {
    messageToHTML() {
        let text = this.props.message.payload.data.text;
        return {
            __html: text.split('\n').join('<br />')
        };
    }
    render() {
        return (
            <MessageContainer message={this.props.message} className="chat">
                <div className="content">
                    <b>{this.props.message.memberDisplayName}</b>:{' '}
                    <div className="text" dangerouslySetInnerHTML={this.messageToHTML()}></div>
                </div>
            </MessageContainer>
        );
    }
}

@observer
export class RecordingRequestMessage extends React.Component {
    render() {
        let isStartRecording = this.props.message.payload.type == 'request_start_recording';
        let className;
        let messagePart;
        if (isStartRecording) {
            className = `event event-start-recording`;
            messagePart = "asked to start recording";
        }
        else {
            className = `event event-stop-recording`;
            messagePart = "asked to stop recording";
        }

        return (
            <MessageContainer message={this.props.message} className={className}>
                <div className="content"><b>{this.props.message.memberDisplayName}</b> {messagePart}</div>
            </MessageContainer>
        )
    }
}

@observer
export class RecordingStatusMessage extends React.Component {
    render() {
        let isStartRecording = this.props.message.payload.type == 'startRecording';
        let className;
        let messagePart;
        if (isStartRecording) {
            className = `event event-start-recording`;
            messagePart = "started recording";
        }
        else {
            className = `event event-stop-recording`;
            messagePart = "stopped recording";
        }

        return (
            <MessageContainer message={this.props.message} className={className}>
                <div className="content">
                    <b>{this.props.message.memberDisplayName}</b>{' '}
                    {messagePart}
                </div>
            </MessageContainer>
        );
    }
}

@observer
export class RecorderStatusMessage extends React.Component {
    render() {
        return (
            <MessageContainer message={this.props.message} className='event recorder-status'>
                <div className="content">
                    <b>{this.props.message.memberDisplayName}</b>
                    {' '}recorder status: {this.props.message.payload.data.recorderStatus}
                </div>
            </MessageContainer>
        );
    }
}

@observer
export class Message extends React.Component {
    getForType() {
        return this.renderers[this.props.message.typeName]();
    }
    render() {
        return this.getForType();
    }
    constructor(props) {
        super(props);
        this.renderers = {
            join: () => <JoinMessage {...this.props} />,
            leave: () => <LeaveMessage {...this.props} />,
            announce: () => <AnnounceMessage {...this.props} />,
            event: () => {
                let event = this.props.message.payload;
                if (_.includes(['startRecording', 'stopRecording'], event.type)) {
                    return <RecordingStatusMessage {...this.props} />;
                }
                else if (_.includes(['requestStartRecording', 'requestStopRecording'])) {
                    return <RecordingRequestMessage {...this.props} />;
                }
                else if (event.type == 'error') {
                    return <ErrorMessage {...this.props} />;
                }
                else if (event.type == 'chat') {
                    return <ChatMessage {...this.props} />;
                }
                else if (event.type == 'updateStatus' && event.data.recorderStatus) {
                    return <RecorderStatusMessage {...this.props} />;
                }
                return null;
            }
        };
    }
}

@observer
export default class MessagesPanel extends React.Component {
    constructor(props) {
        super(props);
        this.state = {text: ""};
    }
    componentDidUpdate() {
        this.ul.scrollTop = this.ul.scrollHeight;
    }
    onChatKeyDown(e) {
        if (e.keyCode == 13 && !(e.shiftKey)) {
            this.sendMessage();
            e.preventDefault();
        }
    }
    sendMessage() {
        let trimmed = _.trim(this.state.text);
        if (trimmed) {
            this.props.controller.sendEvent('chat', {text: this.state.text});
            this.setState({text: ''});
        }
    }
    onTextChange(e) {
        this.setState({text: e.target.value});
    }
    render() {
        return (
            <div className="messages-panel panel">
                <h2>Messages</h2>
                <ul ref={(ul) => {this.ul = ul;}}>
                    {_.map(this.props.room.messages, (message) => (
                        message && <li key={`${message.id}:${message.timestamp}`}>
                            <Message message={message} {...this.props} />
                        </li>
                    ))}
                </ul>
                <div className="chat-input">
                    <form onSubmit={this.sendMessage.bind(this)}>
                        <Textarea
                            onKeyDown={this.onChatKeyDown.bind(this)}
                            onChange={this.onTextChange.bind(this)}
                            placeholder={"Type here to send a message"}
                            value={this.state.text}
                        >
                        </Textarea>
                        <button style={{display: 'none'}}>Send</button>
                    </form>
                </div>
            </div>
        );
    }
}