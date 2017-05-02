import React from 'react';
import ReactDOM from 'react-dom';
import {observer} from "mobx-react";
import {runInAction} from 'mobx';
import {isVideo} from 'lib/util';
@observer
export default class AVPanel extends React.Component {
    async onStartClick() {
        runInAction( () => {
            this.props.uiStore.localMediaPromptShowing = true;
        });
        await this.props.controller.setupLocalMedia();
        runInAction( () => {
            this.props.uiStore.localMediaPromptShowing = false;
        });
    }
    render() {
        return (
            <div className='av-panel'>
                <button onClick={this.onStartClick.bind(this)} disabled={this.props.controller.connection.stream != null}>Start local media</button>
                <LocalMedia stream={this.props.controller.connection.stream} onResourceUpdate={this.props.controller.updateResources} />
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
            };
        }
    }
    render() {
        if (this.props.stream) {
            return (
                <div className="localmedia">
                {(
                    isVideo(this.props.stream) ?
                    <video muted ref="media"/> :
                    <audio muted ref="media"/>
                )}
                    <div className="resolution">{this.state.videoWidth} x {this.state.videoHeight}</div>
                </div>
            );
        }
        return null;
    }
}