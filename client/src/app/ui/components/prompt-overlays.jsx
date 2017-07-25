import React from 'react';
import {observer} from "mobx-react";


@observer
export class LocalMediaPromptOverlay extends React.Component {
    render() {
        if (this.props.isOpen) {
            return (
                <div className="overlay">
                    Please click <b>Allow</b> in the prompt above to give Fireside access to your mic and/or camera.
                </div>
            );
        }
        return null;
    }
}

@observer
export class FSPromptOverlay extends React.Component {
    render() {
        if (this.props.isOpen) {
            return (
                <div className="overlay">
                    In order to make recordings, Fireside needs to be able to store files on your device. <br /> Please press <b>Allow</b> in the dialogue above.
                </div>
            );
        }
        return null;
    }
}