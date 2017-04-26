import React from 'react';
import {observer} from "mobx-react";

import {ROLES} from 'app/rooms/constants';
import RoomTopBar from './room-top-bar';
import UserStatusPanel from './user-status-panel';
import MessagesPanel from './messages-panel';
import FilesDrawer from './files-drawer';
import AVPanel from './av-panel';
import JoinModal from './join-modal';

@observer
export class HostRoomView extends React.Component {
    render() {
        return (
            <div className="host-role room-view" style={{background: 'puce'}}>
                <RoomTopBar {...this.props} />
                <aside>
                    <UserStatusPanel {...this.props} />
                    <MessagesPanel {...this.props} />
                </aside>
                <main>
                    <AVPanel {...this.props} />
                    <FilesDrawer />
                </main>
            </div>
        )
    }
}

@observer
export class GuestRoomView extends React.Component {
    render() {
        return (
            <div className="host-role room-view" style={{background: 'yellow'}}>
                <RoomTopBar {...this.props} />
                <aside>
                    <UserStatusPanel {...this.props} />
                    <MessagesPanel {...this.props} />
                </aside>
                <main>
                    <AVPanel {...this.props} />
                    <FilesDrawer />
                </main>
            </div>
        )
    }
}

@observer
export default class RoomView extends React.Component {
    onJoinModalSubmit(data) {
        this.props.controller.initialJoin(data);
    }
    render() {
        let joinModalOpen = false;
        let roomView = null;
        if (!this.props.room.memberships.self) {
            if (!this.props.room.memberships.selfId) {
                joinModalOpen = true;
            }
        }
        else {
            let role = this.props.room.memberships.self.role;
            roomView = (
                role == ROLES.OWNER ?
                <HostRoomView {...this.props} /> :
                <GuestRoomView {...this.props} />
            );
        }
        return (
            <div>
                {roomView}
                <JoinModal
                    isOpen={joinModalOpen}
                    onSubmit={this.onJoinModalSubmit.bind(this)}
                />
            </div>
        );
    }
}