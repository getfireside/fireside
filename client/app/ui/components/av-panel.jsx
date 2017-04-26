import React from 'react';
import ReactDOM from 'react-dom';
import {observer} from "mobx-react";
import {isVideo} from 'lib/util';
@observer
export default class AVPanel extends React.Component {

    render() {
        return (
            <div>
                <button onClick={() => this.props.controller.setupLocalMedia() }>Start local media</button>
                <LocalMedia stream={this.props.controller.connection.stream} />
            </div>
        );
    }
}

@observer
export class LocalMedia extends React.Component {
    constructor(props) {
        super(props);
        this.state = {};
    }
    componentDidUpdate(prevProps, prevState) {
        if (this.props.stream != prevProps.stream) {
            let m = ReactDOM.findDOMNode(this.refs.media);
            m.srcObject = this.props.stream;
            m.onloadedmetadata = () => {
                m.play();
                if (m.nodeName == 'VIDEO') {
                    this.setState({videoWidth:m.videoWidth, videoHeight: m.videoHeight});
                    this._lastFrameCount = m.mozDecodedFrames || m.webkitDecodedFrameCount;
                    this._lastFrameTime = new Date();
                    this._frameRateUpdateTimer = setInterval( () => {
                        let t = new Date();
                        let c = m.mozDecodedFrames || m.webkitDecodedFrameCount;
                        let frameRate = (c - this._lastFrameCount) / ((t - this._lastFrameTime)/1000);
                        this._lastFrameTime = t;
                        this._lastFrameCount = c;
                        this.setState({frameRate: frameRate});
                    }, 1000);
                }
            };
        }
    }
    render() {
        if (this.props.stream) {
            return (
                <div>
                {(
                    isVideo(this.props.stream) ?
                    <video muted ref="media"/> :
                    <audio muted ref="media"/>
                )}
                    <p>{this.state.videoWidth} x {this.state.videoHeight}</p>
                    <p>{this.state.frameRate} FPS</p>
                </div>
            );
        }
        return null;
    }
}