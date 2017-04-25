import React from 'react';
import _ from 'lodash';
import {observer} from 'mobx-react';

@observer
export class MessageContainer extends React.Component {
    render() {
        return (
            <div className={`message ${this.props.className}`}>
                <time>{this.props.message.time.format()}</time>
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
                <div className="content"><b>{this.props.message.memberDisplayName}</b> disconnected.</div>
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
                    <b>{this.props.message.memberDisplayName}</b> connected.
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
export class Message extends React.Component {
    getForType() {
        return this.renderers[this.props.message.typeName]();
    }
    render() {
        return this.getForType();
    }
    constructor(props) {
        super(props);
        console.log('Attempted render', this.props.message);
        console.log(this.props.message.type, this.props.message.typeName, this.props.message.payload.type);
        this.renderers = {
            join: () => <JoinMessage {...this.props} />,
            leave: () => <LeaveMessage {...this.props} />,
            announce: () => <AnnounceMessage {...this.props} />,
            event: () => {
                let event = this.props.message.payload;
                if (_.includes(['start_recording', 'stop_recording'], event.type)) {
                    return <RecordingStatusMessage {...this.props} />;
                }
                else if (_.includes(['request_start_recording', 'request_stop_recording'])) {
                    return <RecordingRequestMessage {...this.props} />;
                }
                else if (event.type == 'error') {
                    return <ErrorMessage {...this.props} />;
                }
                else if (event.type == 'chat') {
                    return <ChatMessage {...this.props} />;
                }
            }
        };
    }
}

@observer
export default class MessagesPanel extends React.Component {
    render() {
        return (
            <div className="messages panel">
                <h2>Messages</h2>
                <ul>
                    {_.map(this.props.room.messages, (message) => (
                        <li key={`${message.id}:${message.timestamp}`}>
                            <Message message={message} {...this.props} />
                        </li>
                    ))}
                </ul>
            </div>
        );
    }
}