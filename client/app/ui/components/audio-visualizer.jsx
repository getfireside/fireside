import React from 'react';
import ReactDOM from 'react-dom';
import {observer} from "mobx-react";

var SMOOTHING = 0.8;
var FFT_SIZE = 2048;
var WIDTH = 640;
var HEIGHT = 480;

@observer
export default class AudioVisualizer extends React.Component {
    constructor(props) {
        super(props);
        this.state = {};
        this.audioContext = new AudioContext();
        this.draw = this.draw.bind(this);
    }
    setup() {
        this.closed = false;
        this.source = this.audioContext.createMediaStreamSource(this.props.stream);
        this.analyser = this.audioContext.createAnalyser();
        this.analyser.connect(this.audioContext.destination);
        this.analyser.minDecibels = -140;
        this.analyser.maxDecibels = 0;
        this.freqs = new Uint8Array(this.analyser.frequencyBinCount);
        this.times = new Uint8Array(this.analyser.frequencyBinCount);
        this.source.connect(this.analyser);
        this.canvas = ReactDOM.findDOMNode(this.refs.canvas);
        requestAnimationFrame(this.draw);
    }
    draw() {
        if (this.closed) {
            return;
        }
        this.analyser.smoothingTimeConstant = SMOOTHING;
        this.analyser.fftSize = FFT_SIZE;
        this.analyser.getByteFrequencyData(this.freqs);
        this.analyser.getByteTimeDomainData(this.times);

        var width = Math.floor(1/this.freqs.length, 10);
        let canvas = this.canvas;
        var drawContext = canvas.getContext('2d');
        canvas.width = WIDTH;
        canvas.height = HEIGHT;
        // Draw the frequency domain chart.
        for (var i = 0; i < this.analyser.frequencyBinCount; i++) {
            var value = this.freqs[i];
            var percent = value / 256;
            var height = HEIGHT * percent;
            var offset = HEIGHT - height - 1;
            var barWidth = WIDTH/this.analyser.frequencyBinCount;
            var hue = i/this.analyser.frequencyBinCount * 360;
            drawContext.fillStyle = 'hsl(' + hue + ', 100%, 50%)';
            drawContext.fillRect(i * barWidth, offset, barWidth, height);
        }

        // Draw the time domain chart.
        for (var i = 0; i < this.analyser.frequencyBinCount; i++) {
            var value = this.times[i];
            var percent = value / 256;
            var height = HEIGHT * percent;
            var offset = HEIGHT - height - 1;
            var barWidth = WIDTH/this.analyser.frequencyBinCount;
            drawContext.fillStyle = 'white';
            drawContext.fillRect(i * barWidth, offset, 1, 2);
        }
        requestAnimationFrame(this.draw);
    }
    componentDidUpdate(prevProps, prevState) {
        if (this.props.stream != prevProps.stream) {
            this.setup();
        }
    }
    componentDidMount() {
        if (this.props.stream) {
            this.setup();
        }
    }
    componentWillUnmount() {
        this.closed = true;
        this.context.close();
    }
    render() {
        return (
            <canvas class="visualiser" ref="canvas"></canvas>
        );
    }
}