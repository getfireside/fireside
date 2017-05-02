import React from 'react';
import {observer} from "mobx-react";


@observer
export class LocalMediaPromptOverlay extends React.Component {
    render() {
        if (this.props.isOpen) {
            return (
                <div className="overlay">
                    ACCEPT THIS (MEDIA)!
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
                    ACCEPT THIS (FS)!
                </div>
            );
        }
        return null;
    }
}