import React from 'react';
import {observer} from "mobx-react";
import Modal from './modal';
import Button from './button';

@observer
export default class EditNameModal extends React.Component {
    constructor(props) {
        super(props);
        this.state = {val: this.props.member ? this.props.member.name : ''};
    }
    componentWillUpdate(newProps, newState) {
        if (newProps.member) {
            this.state.val = newProps.member ? newProps.member.name : '';
        }
    }
    render() {
        return <Modal
            isOpen={this.props.isOpen}
            shouldCloseOnOverlayClick={false}
            contentLabel="Join room"
        >
            <header className="modal-header">
                <h3>Edit name (currently {this.props.member && this.props.member.name})</h3>
            </header>
            <form>
                <main className="modal-body">
                    <div className="form-group">
                        <label className="control-label">Name</label>
                        <input
                            type="text"
                            name="name"
                            value={this.state.val}
                            onChange={(e) => this.setState({val: e.target.value})}
                        />
                    </div>
                </main>
                <footer className="modal-footer">
                    <Button className="primary" onClick={(e) => this.props.onSubmit({name:this.state.val})}>Save</Button>
                </footer>
            </form>
        </Modal>
    }
}