import React from 'react';
import _ from 'lodash';
import {observer} from 'mobx-react';
import {formatBytes} from 'app/ui/helpers';
import {formatDuration} from 'lib/util';

export default class Notifier extends React.Component {
    componentDidMount() {
        this.listener = this.onMessage.bind(this);
        this.props.room.messageStore.on('message', this.listener);
    }
    componentWillUnmount() {
        this.props.room.messageStore.off('message', this.listener);
    }
    render() {
        return (
            <div>
                <audio src="/static/dist/sounds/ping.mp3" preload ref="ping"/>
                <audio src="/static/dist/sounds/connect.mp3" preload ref="connect"/>
                <audio src="/static/dist/sounds/upload-complete.mp3" preload ref="upload-complete"/>
            </div>
        )
    }
    renderMessage(message) {
        switch (message.typeName) {
            case "join":
                return {
                    title: "You connected"
                };
            case "leave":
                return {
                    title: `${message.memberDisplayName} disconnected`,
                };
            case "announce":
                return {
                    title: `${message.memberDisplayName} connected`,
                    sound: "connect",
                };
            case "event": {
                switch (message.payload.type) {
                    case "startRecording":
                    case "stopRecording": {
                        let isStartRecording = message.payload.type == 'startRecording';
                        let action = isStartRecording ? "started" : "stopped";
                        return {
                            title: (
                                message.member.isSelf ?
                                `Recording ${action}` :
                                `${message.member.name} ${action} recording`
                            ),
                            body: !isStartRecording ? formatDuration(message.recording.duration) : undefined,
                        };
                    }
                    case "uploadStarted":
                        return {
                            title: (
                                message.member.isSelf ?
                                "Upload started" :
                                `${message.member.name} started uploading`
                            ),
                            body: message.recording.niceFilename
                        };
                    case "uploadComplete":
                        return {
                            title: (
                                message.member.isSelf ?
                                "Upload complete" :
                                `${message.member.name}: completed upload`
                            ),
                            body: message.recording.niceFilename,
                            sound: "upload-complete",
                        };
                    case "chat":
                        return {
                            title: message.member.name,
                            body: message.payload.data.text,
                        };
                    case "error":
                        return {
                            title: (
                                message.member.isSelf ?
                                "Error" :
                                `${message.member.name}: Error`
                            ),
                            body: message.payload.data.error.name,
                        };
                }
            }
        }
    }
    onMessage(message) {
        if (message.room.id != this.props.room.id) {
            // sanity check
            return;
        }
        if (document.visibilityState != 'visible') {
            let notificationData = this.renderMessage(message);
            if (notificationData) {
                new Notification(notificationData.title, {
                    body: notificationData.body,
                    image: notificationData.image,
                });
                let audio;
                if (notificationData.sound) {
                    audio = this.refs[notificationData.sound];
                }
                else {
                    audio = this.refs.ping;
                }
                audio.play();
            }
        }
    }
}