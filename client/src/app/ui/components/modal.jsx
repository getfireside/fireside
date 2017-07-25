import React from 'react';
import ReactModal from 'react-modal';
import ReactTooltip from 'react-tooltip';

const Modal = (props) => (
    <ReactModal
        className="modal"
        overlayClassName="modal-overlay"
        bodyOpenClassName="modal-open"
        shouldCloseOnOverlayClick={true}
        onAfterOpen={() => ReactTooltip.rebuild()}
        {...props}
    >
        {props.children}
    </ReactModal>
);

export default Modal;