import _ from 'lodash';
import React from 'react';
import {observer} from "mobx-react";
import {formatDuration} from 'lib/util';
import {formatBytes} from 'app/ui/helpers';
import {FrSdFileSender} from 'lib/filetransfer/http/sender';

@observer
export default class RoomTopBar extends React.Component {
    render() {
        return (
            <header className="top-bar">
                <h2>fr.sd/<a href={this.props.room.url}>{this.props.room.id}</a></h2>
                <StatusArea {...this.props} />
                <a className="conf" href="javascript:void(0);" onClick={() => this.props.uiStore.openConfigModal()}>conf</a>
            </header>
        );
    }
}

@observer
export class StatusArea extends React.Component {
    render() {
        return (
            <div className="status-area">{this.renderContents()}</div>
        );
    }
    renderContents() {
        let contents = [];
        let activeHttpUploads = _.filter(this.props.controller.connection.fileTransfers.senders, x => (
            x.status == 1 && x instanceof FrSdFileSender
        ));
        if (this.props.controller.connection.status == 'disconnected') {
            let messageTemplate = (contents) => (
                <div className="notification error connection">
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
                <div className="notification recording">
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
            contents.push(
                <div className="notification upload http">
                    <span className="progress" style={{width: `${progress*100}%`}}></span>
                    <div className="foreground">
                        {text}
                        <span className="percent">{Math.round(progress*100)}%</span>
                        {" "}
                        <span className="bitrate">{formatBytes(bitrate) + "/s"}</span>
                    </div>
                </div>
            );
        }
        return contents;
    }
}