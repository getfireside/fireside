import React from 'react';
import RoomView from './room-view';
import {observer} from "mobx-react";

@observer
export default class App extends React.Component {
    render() {
        return (
            <RoomView
                controller={this.props.app.roomController}
                room={this.props.app.room}
                uiStore={this.props.app.uiStore}
            />
        );
    }
}