import React from 'react';
import {observer} from "mobx-react";
import Modal from './modal';
import FRC from 'formsy-react-components';
import RadioButtonGroup from './radio-button-group';
import Button from './button';

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
//
@observer
export class ConfigFormFields extends React.Component {
    getBitrate(mbps) {
        return ((mbps / 8) * 1024 * 1024);
    }
    constructor(props) {
        super(props);
        this.state = {
            showAdvanced: this.props.showAdvanced || false,
        };
    }
    toggleAdvanced() {
        this.setState({showAdvanced: !this.state.showAdvanced});
    }
    render() {
        return (
            <div>
                <RadioButtonGroup
                    label="Room mode"
                    name="mode"
                    id="form-mode"
                    value={this.props.config.mode}
                    options={[
                        {value: 'audio', label: 'Audio'},
                        {value: 'video', label: 'Video'},
                    ]}
                    rowClassName="radio-button-group radio-button-group-large"
                />
                <div className={`advanced ${this.state.showAdvanced ? "show" : "hide"}`}>
                    <label className="show-advanced control-label" onClick={() => this.toggleAdvanced()}>
                        Advanced options
                    </label>
                    <div className="collapse">
                        <FRC.RadioGroup
                            label="Upload mode"
                            name="uploadMode"
                            id="form-upload-mode"
                            help={(
                                _.includes(this.props.config.uploadModeChoices, "HTTP") ?
                                "HTTP upload is not enabled on this server" :
                                ""
                            )}
                            value={this.props.config.uploadMode}
                            options={_.map(this.props.config.uploadModeChoices, c => (
                                {value: c, label: c.toUpperCase()}
                            ))}
                        />
                        {this.props.data.mode == 'video' && (
                            <FRC.Select
                                name="videoBitrate"
                                id="form-video-bitrate"
                                value={this.props.config.videoBitrate}
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
                        <FRC.Checkbox
                            id="form-video-bitrate"
                            name="debugMode"
                            value={this.props.config.debugMode}
                            label="Enable debug mode"
                            rowLabel="Debug mode"
                        />
                    </div>
                </div>
            </div>
        )
    }
    static clean(data) {
        data.videoBitrate = parseInt(data.videoBitrate) || null;
        return data;
    }
}

@observer
export class ConfigForm extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            data: {...this.props.config}
        };
    }

    submit(data) {
        data = ConfigFormFields.clean(data);
        debugger;
        this.props.controller.updateConfig(data);
        this.props.onSubmit && this.props.onSubmit(data);
    }

    onChange(data) {
        this.setState({data:data});
    }

    render() {
        return (
            <FRC.Form
                onSubmit={(data) => { this.submit(data) }}
                onChange={(vals) => this.onChange(vals)}
            >
                <main className="modal-body">
                    <p>Warning! Changing some of these options may stop recording. It's best to make these changes before recording starts.</p>
                    <ConfigFormFields data={this.state.data} {...this.props} />
                </main>
                <footer className="modal-footer">
                    <Button type="submit" className="primary">Save</Button>
                </footer>
            </FRC.Form>
        )
    }
}

@observer
export default class ConfigModal extends React.Component {
    render() {
        return <Modal
            isOpen={this.props.uiStore.configModalShowing}
            contentLabel="Room config"
            onRequestClose={() => this.props.uiStore.closeConfigModal()}
        >
            <header className="modal-header">
                <h3>Room settings</h3>
            </header>
            <ConfigForm config={this.props.room.config} onSubmit={() => this.props.uiStore.closeConfigModal()} {...this.props}/>
        </Modal>;
    }
}