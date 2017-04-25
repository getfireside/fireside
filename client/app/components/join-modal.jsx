import React from 'react';
import {observer} from "mobx-react";
import Modal from 'react-modal';

@observer
export default class JoinModal extends React.Component {
    constructor(props) {
        super(props)
        this.state = {val: ''}
    }
    render() {
        return <Modal
            isOpen={this.props.isOpen}
            shouldCloseOnOverlayClick={false}
            contentLabel="Join room"
        >
            <p>What's your name?</p>
            <input
                type="text"
                name="name"
                placeholder="Anonymous Aardvark"
                value={this.state.val}
                onChange={(e) => this.setState({val: e.target.value})}
            />
            <button onClick={(e) => this.props.onSubmit({name:this.state.val})}>Join</button>
        </Modal>
    }
}