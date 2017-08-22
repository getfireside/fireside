import React from 'react';
import {observer} from "mobx-react";
import {action} from 'mobx';
import _ from 'lodash';
import {formatBytes, runDownload} from 'app/ui/helpers';
import {formatDuration} from 'lib/util';
import Button from './Button';

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
    render() {
        if (this.shouldShowButton()) {
            return (
                <Button onClick={this.downloadClick.bind(this)}>
                    {
                        (
                            this.props.recording.fileTransfer &&
                            this.props.recording.fileTransfer.isComplete
                        ) ?
                        "Copy to Downloads folder" :
                        "Download"
                    }
                </Button>
            );
        }
        else {
            return this.progressBar();
        }
    }
}

class RecordingIcon extends React.Component {
    render() {
        let size = 16;
        let r = size - 1;
        let strokeDasharray = r * 2 * Math.PI;
        let strokeDashoffset = (1 - this.props.progress) * r * 2 * Math.PI;
        return (
            <div className="icon-container">
                <svg height={size*2} width={size*2}>
                    <circle
                        r={r}
                        cx={size}
                        cy={size}
                        style={{
                            strokeDashoffset,
                            strokeDasharray,
                        }}
                    />
                </svg>
                <i className={`fa fa-file-${this.props.recording.type.split('/')[0]}-o`}></i>
            </div>
        );
    }
}

@observer
export class RecordingInfo extends React.Component {
    showTransferInfo() {
        let items = [<div className="size">{formatBytes(this.props.recording.filesize)}</div>];
        if (this.props.recording.fileTransfer && !this.props.recording.fileTransfer.isComplete) {
            items.unshift(
                <div className="uploaded">
                    {formatBytes(this.props.recording.fileTransfer.transferredBytes, {
                        relativeTo: this.props.recording.filesize
                    })}
                    <span className="slash"> / </span>
                </div>
            );
            items.unshift(<div className="status">uploading... </div>);
        }
        if (this.canDownload) {
            items.push(<div className="actions">
                <a
                    className="download"
                    href={this.props.recording.url || "javascript:void(0);"}
                    onClick={() => this.onDownloadClick()}
                >
                    <span className="sr-only">Download</span>
                    <i className="sr-hidden fa fa-arrow-down"></i>
                </a>
                <Button className="preview" disabled>
                    <span className="sr-only">Preview</span>
                    <i className="sr-hidden fa fa-search"></i>
                </Button>
            </div>);
        }
        return items;
    }
    get canDownload() {
        return (
            this.props.recording.url || (
                this.props.recording.fileTransfer && this.props.recording.fileTransfer.isComplete
            )
        );
    }
    render() {
        let className = 'recording-info';
        let progress = 0;
        if (this.canDownload) {
            className += ' complete';
            progress = 1;
        }
        else if (this.props.recording.fileTransfer) {
            className += ' uploading';
            progress = (
                this.props.recording.fileTransfer.transferredBytes /
                this.props.recording.filesize
            );
            console.log('PROGRESS! WOO');
        }
        return (
            <div className={className}>
                <RecordingIcon
                    {...this.props}
                    progress={progress}
                />
                <div className="right">
                    <div className="name">
                        <span className="user">{this.props.recording.membership.name}</span>{" "}
                        <span className="duration">({formatDuration(this.props.recording.duration, 'hms')})</span>{" "}
                        {this.props.recording.ended != null ?
                            <span className="startTime">
                                {this.props.recording.startDate.calendar(null, {
                                    sameDay: "HH:MM",
                                    lastDay: "ddd, HH:MM",
                                    lastWeek: "ddd, HH:MM",
                                    sameElse: "Do MMM"
                                })}
                            </span> :
                            <span className="status">RECORDING</span>
                        }
                    </div>
                    <div className="info">
                        {this.showTransferInfo()}
                    </div>
                </div>
            </div>
        );
    }
}


@observer
export default class FilesDrawer extends React.Component {
    @action
    selectMember(uid) {
        this.props.uiStore.filesDrawer.selectedMember = uid;
    }
    @action toggle() {
        this.props.uiStore.filesDrawer.isOpen = !this.props.uiStore.filesDrawer.isOpen;
    }
    componentDidMount() {
        this.updateHeight();
        this.resizeHandler = _.debounce(() => { this.updateHeight() }, 50);
        window.addEventListener("resize", this.resizeHandler);
    }
    componentDidUpdate() {
        this.updateHeight();
    }
    componentWillUnmount() {
        window.removeEventListener("resize", this.resizeHandler);
    }
    updateHeight() {
        if (this.props.uiStore.filesDrawer.selectedMember == null) {
            this.height = this.recsUl.offsetHeight;
        }
    }
    render() {
        let mems = _.filter(this.props.room.memberships.values(), m => m.recordings.length > 0);
        let recs = (
            this.props.uiStore.filesDrawer.selectedMember == null ?
            this.props.room.recordings :
            _.filter(this.props.room.recordings, (rec) => (
                rec.uid == this.props.uiStore.filesDrawer.selectedMember
            ))
        );
        return (
            <div className={"files-drawer " + (this.props.uiStore.filesDrawer.isOpen ? "open" : "")}>
                <h2 onClick={() => this.toggle()}>Files <span className="number">({this.props.room.recordings.length})</span></h2>
                <div className="content">
                    <ul className="members">
                        {_.map([{name: 'All recordings', uid: null}].concat(mems), (mem) => (
                            <li key={mem.uid} className={this.props.uiStore.filesDrawer.selectedMember == mem.uid ? 'selected' : ''}>
                                <a href="javascript:void(0);" onClick={() => this.selectMember(mem.uid)}>{mem.name}</a>
                            </li>
                        ))}
                    </ul>
                    <ul
                        className="recordings"
                        ref={(recsUl) => { this.recsUl = recsUl; }}
                        style={{minHeight: this.props.uiStore.filesDrawer.selectedMember != null && this.height || 0}}
                    >
                        {_.map(recs, (rec) => (
                            <li key={rec.id}><RecordingInfo recording={rec} {...this.props} /></li>
                        ))}
                    </ul>
                </div>
            </div>
        );
    }
}