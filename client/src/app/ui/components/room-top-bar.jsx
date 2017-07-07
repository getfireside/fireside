import React from 'react';
import {observer} from "mobx-react";
import {formatDuration} from 'lib/util';

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
        if (this.props.controller.connection.status == 'disconnected') {
            let messageTemplate = (contents) => (
                <div className="notification error connection">
                    <span>Connection lost.</span>
                    {contents}
                </div>
            );
            if (this.props.controller.connection.socket.nextAttemptTime > new Date()) {
                let timeLeft = Math.ceil((
                    this.props.controller.connection.socket.nextAttemptTime
                    - this.props.room.recordingStore.time
                ) / 1000);
                timeLeft += (timeLeft > 1 ? ' seconds' : " second");
                return messageTemplate(`Reconnecting in ${timeLeft}...`);
            }
            else {
                return messageTemplate(`Attempting to reconnect...`);
            }
        }
        else if (
            this.props.controller.recorder.status &&
            this.props.controller.recorder.status != 'ready'
        ) {
            return (
                <div className="notification recording">
                    <span>
                        {(
                            this.props.controller.recorder.status == 'started' ?
                            "Rec" :
                            this.props.controller.recorder.status
                        )}
                    </span>
                    {" "}
                    <time datetime={`${this.props.controller.recorder.currentRecording.duration}s`}>
                        {formatDuration(this.props.controller.recorder.currentRecording.duration, {
                            format: "stopwatch"
                        })}
                    </time>
                </div>
            )
        }
    }
}