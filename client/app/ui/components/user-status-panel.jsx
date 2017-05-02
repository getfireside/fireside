import React from 'react';
import {observer} from "mobx-react";
import _ from 'lodash';
import {MEMBER_STATUSES} from 'app/rooms/constants';
import {formatBytes} from '../helpers';

@observer
export class UserStatusPanelItem extends React.Component {
    getClassName() {
        let c = "";
        if (this.props.membership.status == MEMBER_STATUSES.CONNECTED) {
            c += 'connected';
        }
        else {
            c += 'disconnected';
        }
        return c;
    }
    render() {
        let membership = this.props.membership;
        return (
            <div className={`membership ${this.getClassName()}`}>
                <div className="info">
                    <span className='name'>{membership.name}</span>
                    <span className={`role role-${membership.roleName}`}>{membership.roleName}</span>
                </div>
                {
                    membership.resources ?
                    <div className="resources">
                        <span className={`video ${membership.resources.video ? '' : 'disabled'}`}>
                            {
                                membership.resources.video.width ?
                                <span className="resolution">
                                    {membership.resources.video.width} x {membership.resources.video.height}
                                </span> :
                                null
                            }
                        </span>
                        <span className={`audio ${membership.resources.audio ? '' : 'disabled'}`}>

                        </span>
                    </div> :
                    null
                }
                {
                    membership.diskUsage ?
                    <div className="disk">
                        <b>{formatBytes(membership.diskUsage.usage)} used / {formatBytes(membership.diskUsage.quota)} available</b>
                    </div> :
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
            <div className="panel user-status-panel">
                <h2>Users</h2>
                <ul>
                    {_.map(this.props.room.memberships.values(), (membership) => (
                        <li key={membership.uid}>
                            <UserStatusPanelItem membership={membership} />
                        </li>
                    ))}
                </ul>
            </div>
        );
    }
}