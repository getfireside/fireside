import React from 'react';
import ReactDOM from 'react-dom';
import {observer} from "mobx-react";
import {runInAction, action} from 'mobx';
import {isVideo} from 'lib/util';
import Button from './Button';
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
            this.props.controller.room.config.mode == "video" ?
            "camera + mic" :
            "mic"
        );
        let remotes = this.getRemoteMedia();
        return (
            <div className='av-panel'>
                {this.props.controller.connection.stream == null ?
                    <Button className='toggle-local-media toggle-on' onClick={this.onStartClick.bind(this)}>Turn on {resourceText}</Button> :
                    <Button className='toggle-local-media toggle-off' onClick={this.onStopClick.bind(this)}>Turn off {resourceText}</Button>
                }
                <Button className='media-selector' onClick={() => this.props.uiStore.openMediaSelectorModal()}>Select input devices</Button>
                <LocalMedia stream={this.props.controller.connection.stream} onResourceUpdate={this.props.controller.updateResources} />
                <div className={`remotes count-${remotes.length}`} ref="remotes">
                    {remotes}
                </div>
            </div>
        );
    }
    componentDidMount() {
        const onUpdateSize = () => {
            let newClass = (
                this.refs.remotes.offsetWidth >= this.refs.remotes.offsetHeight ?
                'wide' :
                'tall'
            );
            this.refs.remotes.classList.remove('wide');
            this.refs.remotes.classList.remove('tall');
            this.refs.remotes.classList.add(newClass);
        };
        onUpdateSize();
        this.resizeHandler = _.debounce(() => { onUpdateSize() }, 50);
        window.addEventListener("resize", this.resizeHandler);
    }
    componentWillUnmount() {
        window.removeEventListener("resize", this.resizeHandler);
    }
    getRemoteMedia() {
        let membersWithStreams = _.filter(this.props.room.memberships.values(), m => m.stream != null);
        // let tests = _.times(2, (i) => (
        //     <div>
        //         <div className="remotemedia">
        //             <video src="/static/dist/video.mp4" />
        //         </div>
        //         <b>Member {i}</b>
        //     </div>
        // ));
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
                            height: m.videoHeight,
                            label: this.props.stream.getVideoTracks()[0].label,
                        },
                        audio: {
                            label: this.props.stream.getAudioTracks()[0].label,
                        }
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
                    <div>
                        <video muted ref="media"/>
                        {this.props.showAudioWithVideo && (
                            <AudioVisualizer stream={this.props.stream} />
                        )}
                    </div> :
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