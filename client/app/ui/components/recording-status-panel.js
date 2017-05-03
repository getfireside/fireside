import React from 'react';
import {observer} from "mobx-react";
import _ from 'lodash';
import {RecordingInfo} from './files-drawer';

@observer
export class RecordingStatus extends React.Component {
    onStartClick() {
        if (this.props.membership.isSelf) {
            this.props.controller.startRecording();
        }
        else {
            this.props.controller.requestStartRecording(this.props.membership);
        }
    }
    onStopClick() {
        if (this.props.membership.isSelf) {
            this.props.controller.stopRecording();
        }
        else {
            this.props.controller.requestStopRecording(this.props.membership);
        }
    }
    render() {
        let actionButton;
        if (
            this.props.membership.currentRecording &&
            this.props.membership.currentRecording.ended === null
        ) {
            actionButton = <button onClick={this.onStopClick.bind(this)}>Stop recording</button>;
        }
        else {
            actionButton = <button
                onClick={this.onStartClick.bind(this)}
                disabled={this.props.membership.recorderStatus != 'ready'}
            >
                Start recording
            </button>;
        }
        return (
            <div>
                <div>{this.props.membership.name}</div>
                <RecordingInfo recording={this.props.membership.currentRecording} membership={this.props.membership} />
                {actionButton}
            </div>
        );
    }
}

@observer
export default class RecordingStatusPanel extends React.Component {
    render() {
        return (
            <div className="panel panel-recording-status">
                <h2>Recording</h2>
                <button>Start recording all</button>
                <ul>
                    {_.map(this.props.room.memberships.values(), (membership) => {
                        if (membership.peerId) {
                            return (
                                <li key={membership.uid}>
                                    <RecordingStatus membership={membership} {...this.props} />
                                </li>
                            );
                        }
                        else {
                            return null;
                        }
                    })}
                </ul>
            </div>
        );
    }
}