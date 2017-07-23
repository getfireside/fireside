import React from 'react';
import ReactDOM from 'react-dom';
import {observer} from "mobx-react";
import {createAudioMeter} from "../volume-meter";

var SMOOTHING = 0.8;
var FFT_SIZE = 256;

let audioContext = new AudioContext();

@observer
export default class AudioVisualizer extends React.Component {
    constructor(props) {
        super(props);
        this.state = {};

        this.audioContext = audioContext;
        this.draw = this.draw.bind(this);
    }
    setup() {
        this.source = this.audioContext.createMediaStreamSource(this.props.stream);
        this.analyser = this.audioContext.createAnalyser();
        this.meter = createAudioMeter(this.audioContext);
        this.source.connect(this.meter);
        this.analyser.minDecibels = -140;
        this.analyser.maxDecibels = 0;
        this.freqs = new Uint8Array(this.analyser.frequencyBinCount);
        // this.times = new Uint8Array(this.analyser.frequencyBinCount);
        this.source.connect(this.analyser);
        this.canvas = ReactDOM.findDOMNode(this.refs.canvas);
        this.closed = false;
        requestAnimationFrame(this.draw);
    }
    draw() {
        this.analyser.smoothingTimeConstant = SMOOTHING;
        this.analyser.fftSize = FFT_SIZE;
        this.analyser.getByteFrequencyData(this.freqs);
        // this.analyser.getByteTimeDomainData(this.times);

        let canvas = this.canvas;
        let canvasHeight = canvas.offsetHeight;
        let canvasWidth = canvas.offsetWidth;
        canvas.height = canvasHeight;
        canvas.width = canvasWidth;

        var drawContext = canvas.getContext('2d');
        drawContext.clearRect(0, 0, canvasWidth, canvasHeight);

        // drawContext.moveTo(0, canvasHeight * (1 - 115/120));
        // drawContext.lineTo(canvasWidth, canvasHeight * (1 - 115/120));
        // drawContext.strokeStyle = "rgba(0,0,0,0.1)";
        // drawContext.stroke();

        var barWidth = Math.round(canvasWidth / this.analyser.frequencyBinCount);
        var barHeight;
        var x = 0;
        let grad = drawContext.createLinearGradient(0, 0, 0, canvasHeight);
        grad.addColorStop(0, '#263037');
        grad.addColorStop(1, '#161c20');

        for(var i = 0; i < this.analyser.frequencyBinCount; i++) {
            barHeight = canvasHeight * this.freqs[i] / 255;
            if (this.meter.checkClipping()) {
                drawContext.fillStyle = '#D01A1A';
            }
            else {
                drawContext.fillStyle = grad;
            }
            drawContext.fillRect(x,Math.round(canvasHeight-barHeight),barWidth,Math.round(barHeight));

            x += barWidth;
        }
        if (!this.closed) {
            requestAnimationFrame(this.draw);
        }
    }
    componentDidUpdate(prevProps, prevState) {
        if (this.props.stream != prevProps.stream) {
            if (this.analyser) {
                this.source.disconnect(this.analyser);
                this.closed = true;
            }
            this.setup();
        }
    }
    componentDidMount() {
        if (this.props.stream) {
            this.setup();
        }
    }
    render() {
        return (
            <canvas class="visualiser" ref="canvas" style={{width: '100%', height: '100%', display: 'block'}}></canvas>
        );
    }
}