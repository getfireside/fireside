import React from 'react';

export default class RoomTopBar extends React.Component {
    render() {
        return (
            <header className="top-bar">
                <h2>fr.sd/<a href={this.props.room.url}>{this.props.room.id}</a></h2>
                <a href="javascript:void(0);" onClick={() => this.props.uiStore.openConfigModal()}>conf</a>
            </header>
        );
    }
}