import React from 'react';
import {observer} from "mobx-react";
import _ from 'lodash';
import {MEMBER_STATUSES} from 'app/rooms/constants';
import {formatBytes} from '../helpers';

@observer
export class UserStatusPanelItem extends React.Component {
    render() {
        let membership = this.props.membership;
        return (
            <div className="membership">
                <h2>{membership.name}</h2>
                <p>uid: <b>{membership.uid}</b></p>
                <p>peer id: <b>{membership.peerId}</b></p>
                <p>status: <b>{membership.status}</b></p>
                <p>role: <b>{membership.role}</b></p>
                <p>has current recording? <b>{(!!membership.currentRecording).toString()}</b></p>
                {
                    membership.diskUsage ?
                    <p>disk space: <b>{formatBytes(membership.diskUsage.usage)} used / {formatBytes(membership.diskUsage.quota)} available</b></p> :
                    null
                }
            </div>
        );
    }
}

@observer
export default class UserStatusPanel extends React.Component {
    render() {
        return (
            <ul>
                {_.map(this.props.room.memberships.values(), (membership) => (
                    <li key={membership.uid}>
                        <UserStatusPanelItem membership={membership} />
                    </li>
                ))}
            </ul>
        );
    }
}