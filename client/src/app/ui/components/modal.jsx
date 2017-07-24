import React from 'react';
import ReactModal from 'react-modal';

const Modal = (props) => (
    <ReactModal 
        className="modal" 
        overlayClassName="modal-overlay" 
        bodyOpenClassName="modal-open"
        {...props}
    >
        {props.children}
    </ReactModal>
);

export default Modal;