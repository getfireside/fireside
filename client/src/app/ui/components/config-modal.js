import React from 'react';
import {observer} from "mobx-react";
import Modal from 'react-modal';
import { Form, RadioGroup, Select, Checkbox } from 'formsy-react-components';

// @Formsy.Mixin
// export class ConfigFormField extends React.Component {
//     getChildren() {
//         return React.Children.map(this.props.children,
//             (child) => {
//                 if (_.includes(['input', 'select', 'div'], child.type)) {
//                     return React.cloneElement(child, {
//                         onChange: this.onChange.bind(this)
//                     })
//                 }
//                 else {
//                     return child;
//                 }
//             }
//         );
//     }
//     render() {
//         const className = this.showRequired() ? 'required' : this.showError() ? 'error' : null;
//         const errorMessage = this.getErrorMessage();
//         return (
//             <div className={`field ${className}`}>
//                 {this.getChildren()}
//                 {errorMessage && <div className="error">{errorMessage}</div>}
//             </div>
//         );
//     }
// }

@observer
export class ConfigForm extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            data: {...this.props.config}
        };
    }
    submit(data) {
        data.video_bitrate = data.video_bitrate || null;
        this.props.controller.updateConfig(data);
        this.props.onSubmit && this.props.onSubmit(data);
    }

    getBitrate(mbps) {
        return ((mbps / 8) * 1024 * 1024) + (384 / 8 * 1024);
    }

    onChange(data) {
        this.setState({data:data});
    }

    render() {
        return (
            <Form onSubmit={(data) => { this.submit(data) }} onChange={(vals) => this.onChange(vals)}>
                <p>Warning! Changing some of these options may stop recording. It's best to make these changes before recording starts.</p>
                <RadioGroup
                    label="Room mode"
                    name="mode"
                    value={this.props.config.mode}
                    options={[
                        {value: 'audio', label: 'Audio'},
                        {value: 'video', label: 'Video'},
                    ]}
                />
                {this.state.data.mode == 'video' && (
                    <Select
                        name="video_bitrate"
                        value={this.props.config.video_bitrate}
                        label="Video bitrate"
                        help="This includes the audio track's bitrate."
                        options={[
                            {label: 'Auto (select based on resolution)', value: ''},
                            {label: '1 Mbps (good for ≤ 360p)', value: this.getBitrate(1)},
                            {label: '2.5 Mbps (good for ≤ 480p)', value: this.getBitrate(2.5)},
                            {label: '5 Mbps (good for ≤ 720p)', value: this.getBitrate(5)},
                            {label: '8 Mbps (good for ≤ 1080p)', value: this.getBitrate(8)},
                            {label: '16 Mbps (good for ≤ 1440p)', value: this.getBitrate(16)},
                            {label: '45 Mbps (good for ≤ 2160p)', value: this.getBitrate(45)},
                        ]}
                    />
                )}
                <Checkbox
                   name="debug_mode"
                   value={this.props.config.debug_mode}
                   label="Enable debug mode"
                   rowLabel="Debug mode"
                />
                <button type="submit">Save</button>
            </Form>
        )
    }
}

@observer
export default class ConfigModal extends React.Component {
    render() {
        return <Modal
            isOpen={this.props.uiStore.configModalShowing}
            shouldCloseOnOverlayClick={true}
            contentLabel="Room config"
        >
            <div class="modal-title">
                <h1>Room settings</h1>
            </div>
            <ConfigForm config={this.props.room.config} onSubmit={() => this.props.uiStore.closeConfigModal()} {...this.props}/>
        </Modal>;
    }
}