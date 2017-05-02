import Recorder from 'app/recordings/recorder';
import WAVRecorder from 'lib/wavrecorder/recorder';
import MemFS from 'lib/fs/memfs';
import uuid from "node-uuid";
import {LocalRecording} from 'app/recordings/store';
import _ from 'lodash';

window.fs = new MemFS();

async function makeMediaElementWith(recording) {
    let url = await recording.getFileBlobURL();
    let element = document.createElement(recording.type.split('/')[0]);
    document.body.append(element);
    let dataLoaded = new Promise((fulfil, reject) => {
        element.onloadeddata = () => {
            console.log('Onload called!');
            if (element.duration === Infinity) {
                console.log('But duration is infinity! Argh!');
                // see http://stackoverflow.com/questions/38443084/how-can-i-add-predefined-length-to-audio-recorded-from-mediarecorder-in-chrome/39971175#39971175
                element.ontimeupdate = () => {
                    element.onTimeUpdate = _.noop;
                    fulfil();
                };
                element.currentTime = 1e101;
            }
            else {
                fulfil();
            }
        };
        element.src = url;
    });
    await dataLoaded;
    return element;
}

function loadMedia(file, kind) {
    return new Promise( (resolve, reject) => {
        let el = document.createElement(kind.split('/')[0]);
        document.body.append(el);
        el.addEventListener('loadeddata', () => {
            resolve(el);
        });
        el.src = `/assets/${file}`;
        el.load();
    });
}

function captureStream(el) {
    if (el.captureStream) {
        return el.captureStream();
    }
    else {
        return el.mozCaptureStream();
    }
}

describe.only("Recorder", function() {
    let recorder, video, audio;

    // set up some AV streams we can use to test the recorder, using MediaSource
    before(async function() {
        console.info('Loading media...');
        [video, audio] = await Promise.all([
            loadMedia('test.mov', 'video/mp4'),
            loadMedia('test.mp3', 'audio/mpeg')
        ]);
        console.info('Media loaded :)');
        return;
    });

    for (let recordingType of ['audio', 'video']) {
        context(`For ${recordingType} recordings, it:`, () => {
            let recorder, media;

            beforeEach(async () => {
                if (recorder) {
                    await recorder.destroy();
                }
                recorder = new Recorder({
                    // set up a clean recorder instance with a test FS before each test
                    store: fixtures.generateRecordingStore(window.fs),
                    extraAttrs: {room: {id: '6UQbFa'}}
                });
                if (recordingType === 'audio') {
                    media = audio;
                }
                else {
                    media = video;
                }
            });

            it('Emits a ready event and sets the status correctly when a stream is added via setupMediaRecorder', (done) => {
                recorder.on('ready', () => {
                    expect(recorder.status).to.equal('ready');
                    done();
                });
                recorder.setupMediaRecorder(captureStream(media));
            });

            it('Sets up the correct underlying MediaRecorder dependent on the stream type', () => {
                recorder.setupMediaRecorder(captureStream(media));
                let expectedType = recordingType == 'audio' ? WAVRecorder : MediaRecorder;
                expect(recorder.mediaRecorder).to.be.an.instanceof(expectedType);
            });

            context('Once the recording starts', () => {

                beforeEach(() => {
                    recorder.setupMediaRecorder(captureStream(media));
                });

                it('Emits a start event and sets the status correctly', (done) => {
                    recorder.on('started', () => {
                        expect(recorder.status).to.equal('started');
                        done();
                    });
                    media.play();
                    recorder.start();
                });

                it('Creates a recording of the correct type', (done) => {
                    let spy = sinon.spy(recorder.store, 'create');
                    recorder.on('started', () => {
                        expect(spy).to.have.been.calledOnce;
                        expect(spy).to.have.been.calledWithMatch({
                            type: recordingType == 'audio' ? 'audio/wav' : 'video/webm'
                        });
                        done();
                    });
                    media.play();
                    recorder.start();
                });

                it("Writes a blob to the recording's file after it becomes available", function(done) {
                    this.timeout(5000);
                    let spy;
                    recorder.on('started', () => {
                        spy = sinon.spy(recorder.currentRecording, 'appendBlobToFile');
                    });

                    recorder.on('blobWritten', () => {
                        try {
                            expect(spy.args[0][0]).to.be.an.instanceof(Blob);
                            done();
                        }
                        catch (err) {
                            done(err);
                        }
                    });
                    media.play();
                    recorder.start();
                });

                it("Emits an error event and stops if appendBlob fails", function(done) {
                    let stub;

                    recorder.on('error', (err) => {
                        expect(err.details).to.equal('Some blob-based error');
                        expect(err.message).to.equal('Error');
                        recorder.on('stopped', () => {
                            done();
                        });
                    });

                    media.play();
                    recorder.start();
                    stub = sinon.stub(recorder.currentRecording, "appendBlobToFile").rejects(
                        new Error('Some blob-based error')
                    );
                });

                afterEach((done) => {
                    setTimeout(() => {
                        recorder.stop();
                        media.pause();
                        media.currentTime = 0;
                        setTimeout(done, 500); // chrome crashes if we don't give it some time to close down resources
                    }, 50);
                });

            }); // end recording starts context

            context('After recording.stop is called', () => {
                let stop = (fn, time=500) => {
                    setTimeout(() => {
                        recorder.stop();
                        media.pause();
                        media.currentTime = 0;
                        fn && fn();
                    }, time);
                };

                beforeEach(() => {
                    recorder.setupMediaRecorder(captureStream(media));
                    recorder.start();
                    media.play();
                });

                it('Sets the status to stopping and emits a stopping event', (done) => {
                    let didEmitStopping = false;
                    recorder.on('stopping', () => {didEmitStopping = true;})

                    recorder.mediaRecorder.onstop = _.noop;
                    stop(() => {
                        expect(recorder.status).to.equal('stopping');
                        expect(didEmitStopping).to.be.true;
                        done();
                    });
                });

                it('Once finished, emits a stop event', (done) => {
                    stop(() => {
                        recorder.on('stopped', () => {
                            done();
                        });
                    });
                });

                it('Sets the status to ready and emits a ready event', (done) => {
                    recorder.on('stopped', () => {
                        expect(recorder.status).to.equal('ready');
                        recorder.on('ready', () => {
                            done();
                        });
                    });
                    stop();
                });

                it('The resulting blob is valid and has the correct length and filesize', function(done) {
                    this.timeout(20000);
                    recorder.on('stopped', async () => {
                        try {
                            let blobTestMediaEl = await makeMediaElementWith(recorder.currentRecording);
                            console.log('Getting blob');
                            let blob = await recorder.currentRecording.getFileBlob();
                            console.log(blob.type);
                            console.log(blob.filesize);

                            // check the durations are nearly the same
                            expect(blobTestMediaEl.duration).to.be.closeTo(recorder.currentRecording.duration, 1);

                            //... and file sizes should be equal
                            expect(blob.size).to.equal(recorder.currentRecording.filesize);

                            // for the video, check the dimensions
                            if (recordingType == 'video') {
                                console.log(media);
                                console.log(blobTestMediaEl);
                                expect(blobTestMediaEl.videoWidth).to.equal(media.videoWidth);
                                expect(blobTestMediaEl.videoHeight).to.equal(media.videoHeight);
                            }

                            // ideally we should check the content too, but that is a bit too tricky for now!
                            done();
                        }
                        catch (err) {
                            done(err);
                        }
                    });
                    stop(null, 5000);
                });
            });
        });
    }
});
