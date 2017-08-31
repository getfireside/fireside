import React from 'react';
import {observer} from "mobx-react";
import Modal from './modal';
import {LocalMedia} from './av-panel';
import Button from './button';

@observer
export class MediaDeviceSelector extends React.Component {
    constructor(props) {
        super(props);
        this.state = {};
    }
    componentDidMount() {
        this.updateDevices = async () => {
            let devs = await navigator.mediaDevices.enumerateDevices();
            let newState = {};
            if (this.props.audio) {
                newState.audioDevices = _.filter(devs, d => d.kind == 'audioinput');
            }
            if (this.props.video) {
                newState.videoDevices = _.filter(devs, d => d.kind == 'videoinput');
            }
            this.setState(newState);
        }
        this.updateDevices();
        navigator.mediaDevices.addEventListener("devicechange", this.updateDevices);
    }
    componentWillUnmount() {
        navigator.mediaDevices.removeEventListener("devicechange", this.updateDevices);
    }
    render() {
        return (
            <div className="media-device-selector">
                {this.props.video && (
                    <div>
                        <label htmlFor="videoDeviceSelector">Video input</label>
                        <select id="videoDeviceSelector" value={this.props.selectedVideoDeviceId} onChange={(e) => this.props.onChange({
                            selectedAudioDeviceId: this.props.audio ? this.props.selectedAudioDeviceId : undefined,
                            selectedVideoDeviceId: e.target.value
                        })}>
                            {_.map(this.state.videoDevices, d => (
                                <option value={d.deviceId}>{d.label}</option>
                            ))}
                        </select>
                    </div>
                )}
                {this.props.audio && (
                    <div>
                        <label htmlFor="audioDeviceSelector">Audio input</label>
                        <select id="audioDeviceSelector" value={this.props.selectedAudioDeviceId} onChange={(e) => this.props.onChange({
                            selectedAudioDeviceId: e.target.value,
                            selectedVideoDeviceId: this.props.video ? this.props.selectedVideoDeviceId : undefined,
                        })}>
                            {_.map(this.state.audioDevices, d => (
                                <option value={d.deviceId}>{d.label}</option>
                            ))}
                        </select>
                    </div>
                )}
            </div>
        )
    }
}

@observer
export class MediaDeviceSelectorModal extends React.Component {
    render() {
        let stream = this.props.controller.connection.stream;
        if (stream == null && this.props.uiStore.mediaSelectorModalShowing) {
            this.props.controller.setupLocalMedia();
        }
        return <Modal
            isOpen={this.props.uiStore.mediaSelectorModalShowing}
            shouldCloseOnOverlayClick={true}
            contentLabel="Select input devices"
            onRequestClose={() => this.props.uiStore.closeMediaSelectorModal()}
        >
            <header className="modal-header">
                <h2>Select input devices</h2>
            </header>
            <main className="modal-body">
                {this.props.uiStore.mediaSelectorModalShowing && (
                    <div>
                        <MediaDeviceSelector
                            audio={true}
                            video={this.props.room.config.mode == "video"}
                            selectedAudioDeviceId={this.props.room.memberships.self.selectedAudioDeviceId}
                            selectedVideoDeviceId={this.props.room.memberships.self.selectedVideoDeviceId}
                            onChange={(updates) => {
                                this.props.room.memberships.self.update(updates);
                                this.props.controller.setupLocalMedia();
                            }}
                        />
                        <LocalMedia stream={stream} onResourceUpdate={_.noop} showAudioWithVideo={true} />
                    </div>
                )}
            </main>
            <footer className="modal-footer">
                <Button onClick={() => this.props.uiStore.closeMediaSelectorModal()}>Return to room</Button>
            </footer>
        </Modal>
    }
}