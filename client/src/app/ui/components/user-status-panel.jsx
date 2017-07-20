import React from 'react';
import {whyRun} from 'mobx';
import {observer} from "mobx-react";
import _ from 'lodash';
import {MEMBER_STATUSES} from 'app/rooms/constants';
import {formatBytes} from '../helpers';
import {formatDuration} from 'lib/util';
import Button from './Button';

@observer
export class RecordingButton extends React.Component {
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
        if (this.props.membership.recorderStatus == 'started') {
            return <Button className="recording stop" onClick={this.onStopClick.bind(this)}>Stop recording</Button>;
        }
        else {
            return <Button
                onClick={this.onStartClick.bind(this)}
                disabled={this.props.membership.recorderStatus != 'ready'}
                className="recording start"
            >
                Record
            </Button>;
        }
    }
}

@observer
export class RecordAllButton extends React.Component {
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
            this.showStopRecordingAllButton() ?
            <Button className="recording recording-all stop" onClick={() => this.onStopClick()}>Stop all</Button> :
            <Button className="recording recording-all start" disabled={!this.startRecordingAllEnabled()} onClick={() => this.onStartClick()}>Record Everyone</Button>
        );
    }
}


@observer
export class UserStatusPanelItem extends React.Component {
    getClassName() {
        let c = "";
        if (this.props.membership.status == MEMBER_STATUSES.CONNECTED) {
            c += 'connected';
        }
        else {
            c += 'disconnected';
        }
        return c;
    }
    getRecordingStatus() {
        if (this.props.membership.status == MEMBER_STATUSES.DISCONNECTED) {
            return 'disconnected';
        }
        switch (this.props.membership.recorderStatus) {
            case "ready":
                return "ready";
            case "started":
                return [
                    <span>Rec</span>,
                    " ",
                    <time datetime={`${this.props.membership.currentRecording.duration}s`}>
                        {formatDuration(this.props.membership.currentRecording.duration, {
                            format: "stopwatch"
                        })}
                    </time>
                ];
            case "stopping":
                return "stopping";
        }
    }
    getMinutesLeft() {
        return [Math.round(this.props.membership.approxMinutesLeft), ' minutes left'];
    }
    render() {
        let membership = this.props.membership;
        return (
            <div className={`membership ${this.getClassName()}`}>
                <div className="topline">
                    <div className="info">
                        <span className='name'>{membership.name}</span>
                        {" "}
                        { membership.role == 'o' && <i className="fa fa-star" style={{color: 'gold'}} />}
                        {" "}
                        {
                            (
                                membership.status == MEMBER_STATUSES.DISCONNECTED &&
                                membership.peerStatus
                            ) &&
                            <span className={`peer-status`}>
                                {
                                    membership.peerStatus == "connected" ?
                                    <i className="fa fa-plug" aria-hidden="true"></i> :
                                    null
                                }
                            </span>
                        }
                        {" "}
                        {
                            (
                                membership.status == MEMBER_STATUSES.DISCONNECTED &&
                                membership.resources
                            ) ?
                            <div className="resources">
                                <span className={`video ${membership.resources.video ? '' : 'disabled'}`}>
                                    {
                                        membership.resources.video &&
                                        membership.resources.video.width ?
                                        <i
                                            className="fa fa-video-camera"
                                            aria-hidden="true"
                                            title={`${membership.resources.video.width} x ${membership.resources.video.height}`}
                                        ></i> :
                                        null
                                    }
                                </span>{" "}
                                <span className={`audio ${membership.resources.audio ? '' : 'disabled'}`}>
                                    {membership.resources.audio && <i
                                        className="fa fa-microphone"
                                        aria-hidden="true"
                                    ></i>}
                                </span>
                            </div> :
                            null
                        }
                    </div>
                    <div className="recording-status">
                        {this.getRecordingStatus()}
                    </div>
                </div>
                {
                    membership.diskUsage ?
                    <div className="disk">
                        <div className="bar">
                            <span style={{width: (100*membership.diskUsage.usage/membership.diskUsage.quota)+"%" }} />
                        </div>
                        <div className="info">
                            <div className="time-left">
                                {this.getMinutesLeft()}
                            </div>
                            <div className="usage-info">
                                {formatBytes(membership.diskUsage.usage)} / {formatBytes(membership.diskUsage.quota)}
                            </div>
                        </div>
                    </div> :
                    null
                }
                {
                    membership.resources &&
                    <div className="recording">
                        {membership.currentRecording && <div className="status">
                            <span className="size">{formatBytes(membership.currentRecording.filesize)}</span>
                            {" "}
                            <span className="bitrate">{formatBytes(membership.currentRecording.bitrate)}/s</span>
                        </div>}
                        <RecordingButton {...this.props} membership={membership} />
                    </div>
                }
            </div>
        );
    }
}

@observer
export default class UserStatusPanel extends React.Component {
    render() {
        return (
            <div className="panel user-status-panel">
                <ul>
                    {_.map(this.props.room.memberships.values().slice(), (membership) => (
                        <li key={membership.uid}>
                            <UserStatusPanelItem {...this.props} membership={membership} />
                        </li>
                    ))}
                </ul>
                <div><RecordAllButton {...this.props} /></div>
            </div>
        );
    }
}