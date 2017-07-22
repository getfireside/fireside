import React from 'react';
import {observer} from "mobx-react";
import Modal from 'react-modal';

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
            <p>Edit name (currently {this.props.member && this.props.member.name})</p>
            <input
                type="text"
                name="name"
                value={this.state.val}
                onChange={(e) => this.setState({val: e.target.value})}
            />
            <button onClick={(e) => this.props.onSubmit({name:this.state.val})}>Save</button>
        </Modal>
    }
}