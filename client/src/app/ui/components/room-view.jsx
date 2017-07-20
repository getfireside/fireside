import React from 'react';
import {observer} from "mobx-react";

import {ROLES} from 'app/rooms/constants';
import {default as RoomTopBar, StatusArea} from './room-top-bar';
import UserStatusPanel from './user-status-panel';
import RecordingStatusPanel from './recording-status-panel';
import MessagesPanel from './messages-panel';
import FilesDrawer from './files-drawer';
import AVPanel from './av-panel';
import JoinModal from './join-modal';
import ConfigModal from './config-modal';
import {LocalMediaPromptOverlay, FSPromptOverlay} from './prompt-overlays';

@observer
export class HostRoomView extends React.Component {
    render() {
        return (
            <div className="host-role room-view" style={{background: 'whitesmoke'}}>
                <div className="flex-container">
                    <aside>
                        <RoomTopBar {...this.props} />
                        <UserStatusPanel {...this.props} />
                        <MessagesPanel {...this.props} />
                    </aside>
                    <main>
                        <StatusArea {...this.props} />
                        <AVPanel {...this.props} />
                        <FilesDrawer {...this.props} />
                    </main>
                </div>
                <ConfigModal {...this.props} />
            </div>
        );
    }
}

@observer
export class GuestRoomView extends React.Component {
    render() {
        return (
            <div className="host-role room-view" style={{background: 'yellow'}}>
                <div className="flex-container">
                    <aside>
                        <RoomTopBar {...this.props} />
                        <UserStatusPanel {...this.props} />
                        <MessagesPanel {...this.props} />
                    </aside>
                    <main>
                        <StatusArea {...this.props} />
                        <AVPanel {...this.props} />
                        <FilesDrawer {...this.props} />
                    </main>
                </div>
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
                <LocalMediaPromptOverlay
                    isOpen={this.props.uiStore.localMediaPromptShowing}
                />
                <FSPromptOverlay
                    isOpen={this.props.uiStore.fsPromptShowing}
                />
            </div>
        );
    }
}