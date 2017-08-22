import React from 'react';
import _ from 'lodash';
import {observer} from "mobx-react";
import { Form } from 'formsy-react';
import FRC from 'formsy-react-components';
import Button from './button';
import {getStorageUsage} from 'lib/fs/quota';
import {LocalMedia} from './av-panel';
import TagsInput from 'react-tagsinput'
import { ConfigFormFields } from './config-modal';
import CopyToClipboard from 'react-copy-to-clipboard';

@observer
class InvitesStep extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            emails: [],
        };
    }
    onChange(emails) {
        this.setState({emails: emails, canSend: emails.length && emails.length < 100});
    }
    onInvalid() {
        this.setState({canSend: false});
    }
    onSendClick() {
        if (this.state.canSend) {
            this.props.sendInviteEmails({emails: emails})
        }
    }
    next() {
        window.localStorage.setItem(`rooms:${this.props.room.id}:invitesComplete`, "true");
        this.props.next();
    }
    render() {
        return (
            <div>
                <main className="modal-body">
                    <div className="email-invites">
                        <TagsInput
                            value={this.state.emails}
                            onChange={(emails) => this.onChange(emails)}
                            validationRegex={/^[a-zA-Z0-9.!#$%&’*+/=?^_`{|}~-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*$/}
                            onValidationReject={() => this.onInvalid()}
                            renderInput={(props) => {
                                let {onChange, value, addTag, ...other} = props
                                return (
                                    <input type='email' onChange={onChange} value={value} {...other} />
                                )
                            }}
                        />
                        <Button type="Send" disabled={!this.state.canSend} onClick={() => this.onSendClick()} />
                    </div>
                    <div className="url-invites">
                        <p>You can also send the URL directly to your guests. Here's the URL - just click to copy!</p>
                        <span>your unique URL:</span>{' '}
                        <CopyToClipboard text={window.location.href}>
                            <a
                                className="with-tooltip with-tooltip-bottom"
                                aria-label="Click to copy"
                                href="javascript:void(0);"
                            >
                                {window.location.scheme}{window.location.host}/rooms/{this.props.room.id}
                            </a>
                        </CopyToClipboard>
                    </div>
                </main>

                <footer className="modal-footer">
                    <Button className="primary" onClick={() => this.next()}>Next</Button>
                </footer>
            </div>
        )
    }
}

InvitesStep.niceName = "Invite guests";

@observer
class NameAndConfigStep extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            name: '',
            config: this.props.room.config,
        };
    }
    submit(data) {
        data = ConfigFormFields.clean(data);
        let name = data.name;
        delete data.name;
        this.props.onSubmit({name, config: data});
        this.props.next();
    }
    disableButton() {
        this.setState({canSubmit: false});
    }
    enableButton() {
        this.setState({canSubmit: true});
    }
    render() {
        let isOwner = (
            this.props.room.memberships.self &&
            this.props.room.memberships.self.isOwner
        );
        return (
            <Form
                onValidSubmit={(data) => this.submit(data)}
                onValid={() => this.enableButton()}
                onInvalid={() => this.disableButton()}
                key="2"
            >
                <main className="modal-body">
                    <FRC.Input
                        type="text"
                        name="name"
                        label="Your name"
                        placeholder="Anonymous Aardvark"
                        value={this.state.name}
                        required
                    />
                    {isOwner && (
                        <ConfigFormFields config={this.props.room.config} data={this.state.config} />
                    )}
                </main>

                <footer className="modal-footer">
                    <Button type="submit" className="primary" disabled={!this.state.canSubmit}>
                        Next
                    </Button>
                </footer>
            </Form>
        )
    }
}

NameAndConfigStep.niceName = 'Name & settings';

@observer
class MediaDeviceSelector extends React.Component {
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
                {this.props.audio && (
                    <div>
                        <label for="audioDeviceSelector">Audio input</label>
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
                {this.props.video && (
                    <div>
                        <label for="videoDeviceSelector">Video input</label>
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
            </div>
        )
    }
}

@observer
export class NameStep extends React.Component {
    constructor(props) {
        super(props);
        this.state = {};
    }
    submit(data) {
        this.props.onSubmit(data);
        this.props.next();
    }
    disableButton() {
        this.setState({canSubmit: false});
    }
    enableButton() {
        this.setState({canSubmit: true});
    }
    render() {
        return (
            <Form
                onValidSubmit={(data) => this.submit(data)}
                onValid={() => this.enableButton()}
                onInvalid={() => this.disableButton()}
            >
                <main className="modal-body">
                    <FRC.Input
                        type="text"
                        name="name"
                        label="Your name"
                        placeholder="Anonymous Aardvark"
                        required
                    />
                </main>

                <footer className="modal-footer">
                    <Button type="submit" className="primary" disabled={!this.state.canSubmit}>
                        Next
                    </Button>
                </footer>
            </Form>
        )
    }
}

NameStep.niceName = "Name"

@observer
export class NotificationStep extends React.Component {
    requestPermission() {
        Notification.requestPermission().then(() => this.props.next());
    }
    render() {
        return (
            <main className="modal-body nofooter">
                <p className="explainer">
                    To make sure that you know when important events happen
                    even when you have the Fireside window minimised, click
                    the button below to give Fireside permission to show
                    you desktop notifications.
                </p>
                <Button onClick={() => this.requestPermission()}>Grant notification permissions</Button>
            </main>
        )
    }
}

NotificationStep.niceName = "Notifications"

@observer class StorageStep extends React.Component {
    render() {
        return (
            <main className="modal-body nofooter">
                <p className="explainer">
                    To make sure you have the best possible recording quality,
                    click the button below to give Fireside permission to save
                    recordings on your computer’s hard disk.
                </p>
                <Button onClick={() => this.requestPermission()}>Grant storage permissions</Button>
                <p>
                    Fireside can’t access any files on your computer, and will
                    clean up any used disk space after you’re finished.
                </p>
            </main>
        )
    }
    requestPermission() {
        this.props.controller.openFS().then(() => {
            this.props.next();
        });
    }
}

StorageStep.niceName = "File Storage"

@observer class AVSetupStep extends React.Component {
    constructor(props) {
        super(props);
        this.state = {};
    }
    componentDidMount() {
        navigator.mediaDevices.enumerateDevices().then((devs) => {
            let alreadyHasPermissions = _.some(devs, dev => (
                (dev.kind == 'audioinput' || dev.kind == 'videoinput') &&
                dev.label.length
            ))
            this.setState({
                alreadyHasPermissions: alreadyHasPermissions,
                devs: devs
            });
            if (alreadyHasPermissions) {
                this.props.controller.setupLocalMedia();
            }
        });
    }
    async requestPermission() {
        await this.props.controller.setupLocalMedia();
        let devs = await navigator.mediaDevices.enumerateDevices();
        this.setState({alreadyHasPermissions: true, devs: devs});
    }
    render() {
        let resource = this.props.room.config.mode == "audio" ? "microphone" : "microphone and webcam";
        let stream = this.props.controller.connection.stream;
        let isOwner = (
            this.props.room.memberships.self &&
            this.props.room.memberships.self.isOwner
        );
        if (this.state.alreadyHasPermissions) {
            return (
                <div>
                    <main className="modal-body">
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
                    </main>
                    <footer className="modal-footer">
                        <Button onClick={() => this.props.next()}>Next</Button>
                    </footer>
                </div>
            )
        }
        else {
            return (
                <main className="modal-body nofooter">
                    <p className="explainer">
                        To join the room
                        {!isOwner ? (
                            " and start talking to " +
                            this.props.room.memberships.owner.name
                        ) : ''}, you'll need to give permission to access your {resource}.
                    </p>
                    <Button onClick={() => this.requestPermission()}>Grant access to {resource}</Button>
                </main>
            )
        }
    }
}

AVSetupStep.niceName = "AV setup";

@observer class ReadyStep extends React.Component {
    render() {
        return (
            <div>
                <main className="modal-body">
                    <p className="explainer">
                        Ready to join!
                    </p>
                </main>
                <footer className="modal-footer">
                    <Button onClick={() => this.props.next()}>Join room</Button>
                </footer>
            </div>
        )
    }
}

ReadyStep.niceName = "Ready";


@observer
export default class OnboardingContent extends React.Component {
    constructor(props) {
        super(props)
        let stepProps = {
            ...this.props,
            next: () => this.next(),
        };
        let isOwner = (
            this.props.room.memberships.self &&
            this.props.room.memberships.self.isOwner
        );
        getStorageUsage().then(({quota, usage}) => {
            let steps = [];
            if (isOwner) {
                steps = steps.concat([
                    <NameAndConfigStep {...stepProps} />,
                    <InvitesStep {...stepProps} />,
                ]);
            }
            else {
                steps.push(<NameStep {...stepProps} />);
            }
            if (Notification.permission != 'granted') {
                steps.push(<NotificationStep {...stepProps} />);
            }
            if (quota == 0) {
                steps.push(<StorageStep {...stepProps} />);
            }
            else {
                this.props.controller.openFS();
            }
            steps = steps.concat([
                <AVSetupStep {...stepProps} />,
                <ReadyStep {...stepProps} />
            ]);
            this.setState({
                completedSteps: {},
                steps: steps,
            });
            this.getStartingStep();
        });
        this.state = {steps: []};
    }
    getStartingStep() {
        let hasName = (
            this.props.room.memberships.self &&
            this.props.room.memberships.self.name
        );
        let newState = {...this.state};
        if (!hasName) {
            newState.currentStep = newState.steps[0];
        }
        else {
            newState.completedSteps[this.state.steps[0].type.name] = true;
            newState.currentStep = this.state.steps[1];
            if (this.props.room.memberships.self.isOwner) {
                if (window.localStorage.getItem(`rooms:${this.props.room.id}:invitesComplete`)) {
                    newState.completedSteps['InvitesStep'] = true;
                    newState.currentStep = this.state.steps[2];
                }
            }
        }
        this.setState(newState);
    }
    next() {
        let newState = {...this.state};
        newState.completedSteps[newState.currentStep.type.name] = true;
        newState.currentStep = this.state.steps[
            _.findIndex(this.state.steps, newState.currentStep) + 1
        ];
        if (newState.currentStep === undefined) {
            this.finish();
        }
        else {
            this.setState(newState);
        }
    }
    finish() {
        this.props.controller.completeOnboarding();
    }
    render() {
        let isOwner = (
            this.props.room.memberships.self &&
            this.props.room.memberships.self.isOwner
        );
        return (
            <div>
                <header className="modal-header">
                    <h2>Welcome to Fireside!</h2>
                    {isOwner ? (
                        <h3>Let's get you all ready for your conversation.</h3>
                    ) : (
                        <h3>Let's get you all ready for your conversation with {this.props.room.memberships.owner.name}.</h3>
                    )}
                </header>
                <ol className="onboarding-steps">
                    {_.map(this.state.steps, (step, index) => {
                        let active = this.state.currentStep == step;
                        let completed = this.state.completedSteps[step.type.name];
                        return (
                            <li key={index} className={"step " + (completed ? "completed " : "") + (active ? "active " : "")}>
                                {step.type.niceName == "AV setup" ? (
                                    (this.props.room.config.mode == "audio" ? "Audio" : "Audio and video") + " setup"
                                ) : step.type.niceName}
                            </li>
                        );
                    })
                }
                </ol>
                {this.state.currentStep}
            </div>
        )
    }
}