import _ from 'lodash';
import React from 'react';
import {observer} from "mobx-react";
import {formatDuration} from 'lib/util';
import {formatBytes} from 'app/ui/helpers';
import {FrSdFileSender} from 'lib/filetransfer/http/sender';
import {ROLES} from 'app/rooms/constants';

@observer
export default class RoomTopBar extends React.Component {
    render() {
        return (
            <header className="top-bar">
                <h2>fr.sd/<a href={this.props.room.url}>{this.props.room.id}</a></h2>
                {
                    this.props.self.role == ROLES.OWNER && (
                        <a className="conf with-tooltip with-tooltip-bottom" href="javascript:void(0);" onClick={() => this.props.uiStore.openConfigModal()} aria-label="Room settings">
                            <i className="fa fa-sliders sr-hidden" />
                            <span className="sr-only">Room settings</span>
                        </a>
                    )
                }
            </header>
        );
    }
}

@observer
export class StatusArea extends React.Component {
    render() {
        let contents = this.renderContents();
        return (
            <div className={`status-area ${contents.length == 0 ? "empty" : ""}`}>{contents}</div>
        );
    }
    renderContents() {
        let contents = [];
        let activeHttpUploads = _.filter(this.props.controller.connection.fileTransfers.senders, x => (
            x.status == 1 && x instanceof FrSdFileSender
        ));
        if (this.props.controller.connection.status == 'disconnected') {
            let messageTemplate = (contents) => (
                <div key="conn" className="notification error connection">
                    <i className="fa fa-exclamation-triangle sr-hidden" />
                    {contents}
                </div>
            );
            if (this.props.controller.connection.socket.nextAttemptTime > new Date()) {
                let timeLeft = Math.ceil((
                    this.props.controller.connection.socket.nextAttemptTime
                    - this.props.room.recordingStore.time
                ) / 1000);
                timeLeft += (timeLeft > 1 ? ' seconds' : " second");
                contents.push(messageTemplate([
                    <strong>Connection lost.</strong>,
                    ` Reconnecting in ${timeLeft}...`
                ]));
            }
            else {
                contents.push(messageTemplate(`Attempting to reconnect...`));
            }
        }
        if (
            this.props.controller.recorder.status &&
            this.props.controller.recorder.status != 'ready'
        ) {
            contents.push(
                <div key="rec" className="notification recording">
                    <span>
                        {(
                            this.props.controller.recorder.status == 'started' ?
                            "Recording" :
                            this.props.controller.recorder.status
                        )}
                    </span>
                    {" "}
                    <time datetime={`${this.props.controller.recorder.currentRecording.duration || 0}s`}>
                        {formatDuration(this.props.controller.recorder.currentRecording.duration || 0, {
                            format: "stopwatch"
                        })}
                    </time>
                </div>
            );
        }
        if (activeHttpUploads.length) {
            let text;
            if (activeHttpUploads.length == 1) {
                text = "Uploading recording...";
            }
            else {
                text = `Uploading ${activeHttpUploads.length} recordings...`;
            }
            let progress = (
                _.sumBy(activeHttpUploads, s => s.uploadedBytes) /
                _.sumBy(activeHttpUploads, s => s.file.filesize)
            );
            let bitrate = _.sumBy(activeHttpUploads, s => s.bitrate);
            const ProgressBar = ({children, progress}) => (
                <div className="bar">
                    <div className="progress" style={{width: `${progress*100}%`}}>
                        <div className="text progress-text" style={{width: (progress ? `${100 * (1/progress)}%` : 0)}}>
                            {children}
                        </div>
                    </div>
                    <div className="text bar-text">
                        {children}
                    </div>
                </div>
            );
            contents.push(
                <div key="up" className="notification upload http">
                    <ProgressBar progress={progress}>
                        {text}
                        <span className="percent">{Math.round(progress*100)}%</span>
                        {" "}
                        <span className="bitrate">{formatBytes(bitrate) + "/s"}</span>
                    </ProgressBar>
                </div>
            );
        }
        return contents;
    }
}