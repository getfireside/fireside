import Recorder from 'app/recordings/recorder';
import WAVRecorder from 'lib/wavrecorder/recorder';
import MemFS from 'lib/fs/memfs';
import {eventListenerToPromise, eventToPromise} from 'lib/util';
import uuid from "node-uuid";
import {Recording} from 'app/recordings/store';

window.fs = new MemFS();

function getTempStore() {
    let store = {};
    store.create = (x) => {
        x.id = uuid.v4();
        return new Recording(x, {
            fs: window.fs,
            store: store,
            directory: 'firesidetest/recordings'
        })
    }
    return store;
};

async function makeMediaElementWith(recording) {
    let url = await recording.getFileBlobURL();
    let element = document.createElement(recording.type.split('/')[0]);
    document.body.append(element);
    let dataLoaded = new Promise((fulfil, reject) => {
        element.onloadeddata = () => {
            console.log('Onload called!')
            if (element.duration === Infinity) {
                console.log('But duration is infinity! Argh!')
                // see http://stackoverflow.com/questions/38443084/how-can-i-add-predefined-length-to-audio-recorded-from-mediarecorder-in-chrome/39971175#39971175
                element.ontimeupdate = () => {
                    element.onTimeUpdate = _.noop;
                    fulfil();
                }
                element.currentTime = 1e101
            }
            else {
                fulfil();
            }
        }
        element.src = url;
    });
    await dataLoaded;
    return element;
}


function fetchAB (url, cb) {
  return new Promise((fulfil, reject) => {
    var xhr = new XMLHttpRequest;
    xhr.open('get', url);
    xhr.responseType = 'arraybuffer';
    xhr.onload = function () {
        fulfil(xhr.response);
    };
    xhr.send();
  })
};

function loadMedia(file, kind) {
    return new Promise( (resolve, reject) => {
        let el = document.createElement(kind.split('/')[0]);
        document.body.append(el);
        el.addEventListener('loadeddata', () => {
            resolve(el);
        })
        el.src = `/assets/${file}`
        el.load()
    })
}

function captureStream(el) {
    if (el.captureStream) {
        return el.captureStream();
    }
    else {
        return el.mozCaptureStream();
    }
}

describe("Recorder", function() {
    let recorder = window.recorder = null;
    let recorder2 = window.recorder2 = null;
    let video, audio;

    // set up some AV streams we can use to test the recorder, using MediaSource
    before(async function() {
        console.info('Loading media...');
        [video, audio] = await Promise.all([
            loadMedia('test.mov', 'video/mp4'),
            loadMedia('test.mp3', 'audio/mpeg')
        ]);
        console.info('Media loaded :)')
        return;
    })

    // set up a clean recorder instance with a test FS before each test
    beforeEach(async () => {
        if (recorder) {
            await recorder.destroy()
        }
        if (recorder2) {
            await recorder2.destroy()
        }
        recorder = new Recorder({
            store: getTempStore()
        })
        recorder2 = new Recorder({
            store: getTempStore()
        })
    })

    // now for the actual tests!

    it('Emits a ready event and sets the status correctly when a stream is added via setupMediaRecorder', (done) => {
        recorder.on('ready', () => {
            expect(recorder.status).to.equal('ready');
            done()
        })
        recorder.setupMediaRecorder(captureStream(video));
    });

    it('Sets up the correct underlying MediaRecorder dependent on the stream type', () => {
        recorder.setupMediaRecorder(captureStream(audio));
        expect(recorder.mediaRecorder).to.be.an.instanceof(WAVRecorder);
        recorder2.setupMediaRecorder(captureStream(video));
        expect(recorder2.mediaRecorder).to.be.an.instanceof(MediaRecorder);
    });

    context('Once the recording starts', () => {
        beforeEach(() => {
            recorder.setupMediaRecorder(captureStream(audio));
            recorder2.setupMediaRecorder(captureStream(video));
        })

        it('Emits a start event and sets the status correctly', (done) => {
            recorder2.on('started', () => {
                expect(recorder2.status).to.equal('started')
                done()
            });
            video.play()
            recorder2.start()
        })

        it('Creates a recording of the correct type', (done) => {
            let spy = sinon.spy(recorder.store, 'create');
            let spy2 = sinon.spy(recorder2.store, 'create');
            recorder.on('started', () => {
                expect(spy).to.have.been.calledOnce;
                expect(spy).to.have.been.calledWithMatch({type: 'audio/wav'});
                video.play()
                recorder2.start()
            });
            recorder2.on('started', () => {
                expect(spy2).to.have.been.calledOnce;
                expect(spy2).to.have.been.calledWithMatch({type: 'video/webm'});
                done()
            });
            audio.play()
            recorder.start();
        });

        it("Writes a blob to the recording's file after it becomes available", function(done) {
            this.timeout(3000);
            let spy;
            recorder2.on('started', () => {
                spy = sinon.spy(recorder2.currentRecording, 'appendBlobToFile');
            })

            recorder2.on('blobWritten', () => {
                try {
                    expect(spy.args[0][0]).to.be.an.instanceof(Blob);
                    done();
                }
                catch (err) {
                    done(err);
                }
            })
            video.play();
            recorder2.start();
        });

        it("Emits an error event and stops if appendBlob fails", (done) => {
            let stub;

            let blobError = (blob) => new Promise( (resolve, reject) => {
                reject(new Error('Some blob-based error'));
            });

            recorder.on('started', () => {
                stub = sinon.stub(recorder.currentRecording, "appendBlobToFile", blobError);
            })
            recorder.on('error', (err) => {
                expect(err.details).to.equal('Some blob-based error');
                expect(err.message).to.equal('Error');
                recorder.on('stopped', () => {
                    done();
                });
            })
            recorder.start();
        });

        afterEach(() => {
            recorder.stop()
            recorder2.stop()
            video.pause();
            video.currentTime = 0;
            audio.pause();
            audio.currentTime = 0;
        })
    })

    context('After recording.stop is called', () => {
        let stopAll = (fn, time=100) => {
            setTimeout(() => {
                recorder.stop()
                recorder2.stop()
                video.pause();
                video.currentTime = 0;
                audio.pause();
                audio.currentTime = 0;
                fn && fn();
            }, time)
        }

        beforeEach(() => {
            recorder.setupMediaRecorder(captureStream(audio));
            recorder2.setupMediaRecorder(captureStream(video));
            recorder.start()
            recorder2.start()
            audio.play()
            video.play()
            // recorder2.on('started', () => done())
        })

        it('Sets the status to stopping and emits a stopping event', (done) => {
            let didEmitStopping = false;
            recorder.on('stopping', () => {didEmitStopping = true;})

            recorder.mediaRecorder.onstop = _.noop;
            stopAll(() => {
                expect(recorder.status).to.equal('stopping');
                expect(didEmitStopping).to.be.true;
                done();
            })
        })

        it('Once finished, emits a stop event', (done) => {
            stopAll(() => {
                recorder2.on('stopped', () => {
                    done();
                })
            })
        })

        it('Sets the status to ready and emits a ready event', (done) => {
            recorder.on('stopped', () => {
                expect(recorder.status).to.equal('ready');
                recorder.on('ready', () => {
                    done();
                })
            })
            stopAll();
        })

        it('The resulting blob is valid and has the correct length and filesize', function(done) {
            this.timeout(15000);
            let bothStopped = _.after(2, async () => {
                window.recorder1 = recorder;
                window.recorder2 = recorder2;

                try {
                    let blobVideo = await makeMediaElementWith(recorder2.currentRecording);
                    let blobAudio = await makeMediaElementWith(recorder.currentRecording);

                    let videoBlob = await recorder2.currentRecording.getFileBlob();
                    let audioBlob = await recorder1.currentRecording.getFileBlob();

                    // check the durations are nearly the same
                    expect(blobAudio.duration).to.be.closeTo(recorder.currentRecording.duration, 0.5);
                    expect(blobVideo.duration).to.be.closeTo(recorder2.currentRecording.duration, 0.5);

                    //... and file sizes should be equal
                    expect(videoBlob.size).to.equal(recorder2.currentRecording.filesize);
                    expect(audioBlob.size).to.equal(recorder.currentRecording.filesize);

                    // for the video, check the dimensions
                    expect(blobVideo.videoWidth).to.equal(video.videoWidth)
                    expect(blobVideo.videoHeight).to.equal(video.videoHeight)

                    // ideally we should check the content too, but that is a bit too tricky for now!
                    done()
                }
                catch (err) {
                    done(err);
                }
            })
            recorder.on('stopped', () => { console.log('audio stopped!'); bothStopped(); });
            recorder2.on('stopped', () => { console.log('video stopped!'); bothStopped(); });
            stopAll(null, 2000);
        })
    })
})
