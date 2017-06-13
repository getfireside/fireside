import React from 'react';
import ReactDOM from 'react-dom';
import {observer} from "mobx-react";
import {runInAction, action} from 'mobx';
import {isVideo} from 'lib/util';
import _ from 'lodash';

import AudioVisualizer from './audio-visualizer';

@observer
export default class AVPanel extends React.Component {
    async onStartClick() {
        let needToShowPrompt = null;
        setTimeout(action(() => {
            if (needToShowPrompt == null) {
                this.props.uiStore.localMediaPromptShowing = true;
            }
        }), 200);
        await this.props.controller.setupLocalMedia();
        runInAction( () => {
            needToShowPrompt = false;
            this.props.uiStore.localMediaPromptShowing = false;
        });
    }
    onStopClick() {
        this.props.controller.stopLocalMedia();
    }
    render() {
        let resourceText = (
            this.props.controller.room.mode == "video" ?
            "camera + mic" :
            "camera"
        );
        return (
            <div className='av-panel'>
                {this.props.controller.connection.stream == null ?
                    <button class='toggle-local-media' onClick={this.onStartClick.bind(this)}>Start {resourceText}</button> :
                    <button class='toggle-local-media' onClick={this.onStopClick.bind(this)}>Stop {resourceText}</button>
                }
                <LocalMedia stream={this.props.controller.connection.stream} onResourceUpdate={this.props.controller.updateResources} />
                <div className="remotes">
                    {this.getRemoteMedia()}
                </div>
            </div>
        );
    }
    getRemoteMedia() {
        let membersWithStreams = _.filter(this.props.room.memberships.values(), m => m.stream != null);
        return _.map(membersWithStreams, (member) => (
            <div>
                <RemoteMedia stream={member.stream} />
                <b>{member.name}</b>
            </div>
        ));
    }
}

@observer
export class LocalMedia extends React.Component {
    constructor(props) {
        super(props);
        this.state = {};
    }
    setStream() {
        let m = ReactDOM.findDOMNode(this.refs.media);
        if (m) {
            m.srcObject = this.props.stream;
            m.onloadedmetadata = () => {
                m.play();
                if (m.nodeName == 'VIDEO') {
                    this.props.onResourceUpdate({
                        video: {
                            width: m.videoWidth,
                            height: m.videoHeight
                        },
                        audio:true
                    });
                    this.setState({
                        videoWidth: m.videoWidth,
                        videoHeight:m.videoHeight
                    });
                }
                else {
                    this.setState({videoWidth: null, videoHeight: null});
                }
            };
        }
    }
    componentDidUpdate(prevProps, prevState) {
        if (this.props.stream != prevProps.stream) {
            this.setStream();
        }
    }
    componentDidMount() {
        if (this.props.stream) {
            this.setStream();
        }
    }
    render() {
        if (this.props.stream) {
            return (
                <div className={`localmedia ${isVideo(this.props.stream) ? 'video' : 'audio'}`}>
                {(
                    isVideo(this.props.stream) ?
                    <video muted ref="media"/> :
                    <div>
                        <AudioVisualizer stream={this.props.stream} />
                        <audio ref="media" muted/>
                    </div>
                )}
                    {this.state.videoWidth &&
                        <div className="resolution">
                            {this.state.videoWidth} x {this.state.videoHeight}
                        </div>
                    }
                </div>
            );
        }
        return null;
    }
}

@observer
export class RemoteMedia extends React.Component {
    componentDidUpdate(prevProps, prevState) {
        if (this.props.stream != prevProps.stream) {
            this.setStream();
        }
    }
    componentDidMount() {
        if (this.props.stream) {
            this.setStream();
        }
    }
    setStream() {
        if (this.mediaEl) {
            this.mediaEl.srcObject = this.props.stream;
            this.mediaEl.onloadedmetadata = () => {
                this.mediaEl.play();
            };
        }
    }
    render() {
        if (this.props.stream) {
            return (
                <div className="remotemedia">
                {(
                    isVideo(this.props.stream) ?
                    <video ref={(media) => { this.mediaEl = media; }}/> : (
                        <div>
                            <AudioVisualizer stream={this.props.stream} />
                            <audio ref={(media) => { this.mediaEl = media; }} />
                        </div>
                    )
                )}
                </div>
            );
        }
        return null;
    }
}