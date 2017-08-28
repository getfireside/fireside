import React from 'react';
import {observer} from "mobx-react";
import {runInAction} from "mobx";

import {ROLES} from 'app/rooms/constants';
import {default as RoomTopBar, StatusArea} from './room-top-bar';
import UserStatusPanel from './user-status-panel';
import RecordingStatusPanel from './recording-status-panel';
import MessagesPanel from './messages-panel';
import FilesDrawer from './files-drawer';
import AVPanel from './av-panel';
import JoinModal from './join-modal';
import ConfigModal from './config-modal';
import {MediaDeviceSelectorModal} from './media-device-selector';
import {LocalMediaPromptOverlay, FSPromptOverlay} from './prompt-overlays';
import Notifier from './notifier';
import EditNameModal from './edit-name-modal';
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
    async onJoinModalSubmit(data) {
        await this.props.controller.initialJoin({name: data.name});
        if (this.props.room.memberships.self.isOwner) {
            this.props.controller.updateConfig(data.config);
        }
    }
    componentDidMount() {
        window.addEventListener('beforeunload', (e) => {
            let msg;
            if (this.props.controller.connection.fileTransfers.hasActive) {
                msg = "A file transfer is in progress!";
            }
            else if (
                this.props.controller.recorder.status &&
                this.props.controller.recorder.status != 'ready'
            ) {
                msg = "A recording is in progress!";
            }
            else {
                return;
            }
            e.returnValue = msg;
            return msg;
        });
    }
    render() {
        let joinModalOpen = (
            !this.props.room.memberships.self ||
            this.props.room.memberships.self.isNew ||
            !this.props.room.memberships.self.onboardingComplete
        );
        let roomView = null;
        if (!joinModalOpen) {
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
                    {...this.props}
                />
                <EditNameModal
                    isOpen={this.props.uiStore.editModalMember != null}
                    member={this.props.uiStore.editModalMember}
                    onSubmit={(data) => {
                        this.props.controller.changeName(
                            this.props.uiStore.editModalMember,
                            data
                        );
                        this.props.uiStore.closeEditNameModal();
                    }}
                />
                <MediaDeviceSelectorModal {...this.props} />
                <LocalMediaPromptOverlay
                    isOpen={this.props.uiStore.localMediaPromptShowing}
                />
                <FSPromptOverlay
                    isOpen={this.props.uiStore.fsPromptShowing}
                />
                <Notifier {...this.props} />
            </div>
        );
    }
}