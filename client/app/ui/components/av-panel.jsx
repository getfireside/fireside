import React from 'react';
import {observer} from "mobx-react";

@observer
export default class AVPanel extends React.Component {
    render() {
        return (
            <div>
                <p>AV here.</p>
            </div>
        );
    }
}