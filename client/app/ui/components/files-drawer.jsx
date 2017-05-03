import React from 'react';
import {observer} from "mobx-react";
import _ from 'lodash';
import {formatBytes} from 'app/ui/helpers';

@observer
export class RecordingInfo extends React.Component {
    async downloadClick() {
        if (this.props.membership.isSelf) {
            let url = await this.props.recording.getFileBlobURL();
            let a = document.createElement('a');
            a.style.display = 'none';
            document.body.appendChild(a);
            a.download = this.props.recording.niceFilename;
            a.href = url;
            a.click();
        }
    }
    render() {
        if (this.props.recording) {
            return (
                <div>
                    <p>bitrate: {formatBytes(this.props.recording.bitrate)}/sec</p>
                    <p>status: {this.props.membership.recorderStatus}</p>
                    <p>started: {this.props.recording.startDate.format()}</p>
                    <p>duration: {this.props.recording.duration}</p>
                    <p>filesize: {this.props.recording.filesize}</p>
                    <p><button onClick={this.downloadClick.bind(this)}>Download</button></p>
                </div>
            );
        }
        else {
            return (
                <div>
                    <p>status: {this.props.membership.recorderStatus}</p>
                </div>
            );
        }
    }
}


@observer
export default class FilesDrawer extends React.Component {
    render() {
        let mems = _.filter(this.props.room.memberships.values(), m => m.recordings.length > 0);
        let rows = [];
        _.each(mems, (mem, i) => {
            _.each(mem.recordings, (rec, j) => {
                let row = rows[j];
                if (row == null) {
                    row = rows[j] = [];
                }
                row[i] = <td>
                    <RecordingInfo recording={rec} membership={mem} />
                </td>;
            });
        });
        let tableRows = _.map(rows, row => <tr>{row}</tr>);
        let tableHeadRow = _.map(mems, mem => <td>{mem.name}</td>);
        return (
            <div>
                <h3>Files drawer</h3>
                <table>
                    <thead>
                        <tr>
                            {tableHeadRow}
                        </tr>
                    </thead>
                    <tbody>
                        {tableRows}
                    </tbody>
                </table>
            </div>
        );
    }
}