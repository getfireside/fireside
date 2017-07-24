import React from 'react';
import {observer} from "mobx-react";
import Modal from './modal';
import { Form } from 'formsy-react';
import FRC from 'formsy-react-components';
import { ConfigFormFields } from './config-modal';
import Button from './button';

@observer
export default class JoinModal extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            name: '',
            config: this.props.room.config,
        };
    }
    submit(data) {
        data = ConfigFormFields.clean(data);
        this.props.onSubmit(data);
    }
    disableButton() {
        this.setState({canSubmit: false});
    }
    enableButton() {
        this.setState({canSubmit: true});
    }
    render() {
        return <Modal
            isOpen={this.props.isOpen}
            shouldCloseOnOverlayClick={false}
            contentLabel="Join room"
        >
            <header className="modal-header">
                <h2>Welcome to Fireside!</h2>
                {this.props.isOwner && (
                    <h3>your unique URL: <a>fr.sd/{this.props.room.id}</a></h3>
                )}
            </header>
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
                        value={this.state.val}
                        required
                    />
                    {this.props.isOwner && (
                        <ConfigFormFields config={this.props.room.config} data={this.state.config} />
                    )}
                </main>

                <footer className="modal-footer">
                    <Button type="submit" className="primary" disabled={!this.state.canSubmit}>
                        {
                            this.props.isOwner ? 
                            "Enter room" :
                            "Join room"
                        }
                    </Button>
                </footer>
            </Form>
        </Modal>
    }
}