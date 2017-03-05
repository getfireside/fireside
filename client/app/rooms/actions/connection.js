import {on} from 'lib/actions';

export default actions = {
    // @on('connection:connect')
    // didConnect: () => {
    //     this.status.connection = 'connected'
    // },

    // @on('connection:connecting')
    // connectStarted: () => {
    //     this.status.connection = 'connecting'
    // // },

    // @on('recorder:ready')
    // handleRecordingReady: () => {
    //     this.connection.send('recording:ready')
    //     this.status.recording = 'ready'
    // },

    // @on('recorder:stop')
    // handleRecordingStop: (recording) => {
    //     this.connection.send('recording:stop', this.recording.toJSON())
    //     this.status.recording = 'ready';
    //     this.queueRecordingUpload(recording);
    // },

    // @on('recorder:error')
    // handleRecordingError: (recording, error) => {
    //     // this.handleError()
    //     window.alert(error);
    //     // check if we've got all the data
    //     // if so, upload
    // }

    @on('connection:requestStartRecording')
    startRecording: () => {
        if (this.status.recording != 'ready') {
            return
        }
        this.recorder.start()
    }

    @on('connection:requestStopRecording')
    stopRecording: () => {
        if (this.status.recording != 'started') {
            return
        }
        this.recorder.stop()
    }
}
