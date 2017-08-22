import React from 'react';
import {observer} from "mobx-react";
import Modal from './modal';
import { Form } from 'formsy-react';
import FRC from 'formsy-react-components';
import Button from './button';
import CopyToClipboard from 'react-copy-to-clipboard';
import OnboardingContent from './onboarding';

@observer
export default class JoinModal extends React.Component {
    render() {
        return <Modal
            isOpen={this.props.isOpen}
            shouldCloseOnOverlayClick={false}
            contentLabel="Welcome to Fireside"
        >
            <OnboardingContent {...this.props} />
        </Modal>
    }
}