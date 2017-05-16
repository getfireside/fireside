import React from 'react';
import {observer, computed} from "mobx-react";
import _ from 'lodash';
import {RecordingInfo} from './files-drawer';

// TODO: these components need a major refactor!

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
        if (this.props.membership.recorderStatus == 'started') {
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
    startRecordingAllEnabled() {
        return _.some(this.connectedMemberships, (mem) => mem.recorderStatus == 'ready');
    }
    showStopRecordingAllButton() {
        return _.some(this.connectedMemberships, (mem) => mem.recorderStatus == 'started');
    }
    get connectedMemberships() {
        return this.props.room.memberships.connected;
    }
    onStartClick() {
        _.each(this.connectedMemberships, (mem) => {
            if (mem.recorderStatus == 'ready') {
                if (mem.isSelf) {
                    this.props.controller.startRecording();
                }
                else {
                    this.props.controller.requestStartRecording(mem);
                }
            }
        });
    }
    onStopClick() {
        _.each(this.connectedMemberships, (mem) => {
            if (mem.recorderStatus == 'started') {
                if (mem.isSelf) {
                    this.props.controller.stopRecording();
                }
                else {
                    this.props.controller.requestStopRecording(mem);
                }
            }
        });
    }
    render() {
        return (
            <div className="panel panel-recording-status">
                <h2>Recording</h2>
                {
                    this.showStopRecordingAllButton() ?
                    <button onClick={() => this.onStopClick()}>Stop all</button> :
                    <button disabled={!this.startRecordingAllEnabled()} onClick={() => this.onStartClick()}>Start all</button>
                }
                <ul>
                    {_.map(this.props.room.memberships.connected, (membership) => (
                        <li key={membership.uid}>
                            <RecordingStatus membership={membership} {...this.props} />
                        </li>
                    ))}
                </ul>
            </div>
        );
    }
}