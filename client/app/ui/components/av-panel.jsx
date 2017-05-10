import React from 'react';
import ReactDOM from 'react-dom';
import {observer} from "mobx-react";
import {runInAction} from 'mobx';
import {isVideo} from 'lib/util';
import _ from 'lodash';

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
        let m = ReactDOM.findDOMNode(this.refs.media);
        m.srcObject = this.props.stream;
        m.onloadedmetadata = () => {
            m.play();
        };
    }
    render() {
        if (this.props.stream) {
            return (
                <div className="remotemedia">
                {(
                    isVideo(this.props.stream) ?
                    <video muted ref="media"/> :
                    <audio muted ref="media"/>
                )}
                </div>
            );
        }
        return null;
    }
}