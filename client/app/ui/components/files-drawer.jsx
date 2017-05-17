import React from 'react';
import {observer} from "mobx-react";
import _ from 'lodash';
import {formatBytes, runDownload} from 'app/ui/helpers';

@observer
export class DownloadStatusButton extends React.Component {
    async downloadClick() {
        if (this.props.membership.isSelf) {
            let url = await this.props.recording.getFileBlobURL();
            let filename = this.props.recording.niceFilename;
            runDownload(url, filename);
        }
        else {
            if (
                this.props.recording.fileTransfer
                && this.props.recording.fileTransfer.isComplete
            ) {
                this.props.recording.fileTransfer.getBlobURL();
                let url = await this.props.recording.fileTransfer.getBlobURL();
                runDownload(url, this.props.recording.niceFilename);
            }
            else {
                this.props.controller.requestRecordingTransfer(this.props.recording);
                this.props.controller.connection.on('fileTransfer.complete', async (transfer) => {
                    if (transfer.fileId == `recording:${this.props.recording.id}`) {
                        this.props.recording.fileTransfer.getBlobURL();
                        let url = await this.props.recording.fileTransfer.getBlobURL();
                        runDownload(url, this.props.recording.niceFilename);
                    }
                });
            }
        }
    }
    shouldShowButton() {
        return (
            this.props.membership.isSelf
            || (
                this.props.recording.fileTransfer == null
                || this.props.recording.fileTransfer.isComplete
            )
        );
    }
    progressBar() {
        return <div>
            <progress
                value={this.props.recording.fileTransfer.downloadedBytes}
                max={
                    this.props.recording.fileTransfer.metadata &&
                    this.props.recording.fileTransfer.metadata.size
                }
            ></progress>
            <b>{formatBytes(this.props.recording.fileTransfer.bitrate) + "/s"}</b>
        </div>;
    }
    render() {
        if (this.shouldShowButton()) {
            return (
                <button onClick={this.downloadClick.bind(this)}>
                    {
                        (
                            this.props.recording.fileTransfer &&
                            this.props.recording.fileTransfer.isComplete
                        ) ?
                        "Download" :
                        "Copy to Downloads folder"
                    }
                </button>
            );
        }
        else {
            return this.progressBar();
        }
    }
}

@observer
export class RecordingInfo extends React.Component {
    render() {
        if (this.props.recording) {
            return (
                <div>
                    <p>bitrate: {formatBytes(this.props.recording.bitrate)}/sec</p>
                    <p>status: {this.props.membership.recorderStatus}</p>
                    <p>started: {this.props.recording.startDate.format()}</p>
                    <p>duration: {this.props.recording.duration}</p>
                    <p>filesize: {this.props.recording.filesize}</p>
                    <p><DownloadStatusButton {...this.props} /></p>
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
                    <RecordingInfo recording={rec} membership={mem} {...this.props} />
                </td>;
            });
        });
        let tableRows = _.map(rows, row => <tr>{row}</tr>);
        let tableHeadRow = _.map(mems, mem => <td>{mem.name}</td>);
        return (
            <div className="files-drawer">
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