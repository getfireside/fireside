import React from 'react';
import ReactDOM from 'react-dom';
import {observer} from "mobx-react";

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
        this.closed = false;
        this.source = this.audioContext.createMediaStreamSource(this.props.stream);
        this.analyser = this.audioContext.createAnalyser();
        this.analyser.minDecibels = -130;
        this.analyser.maxDecibels = -10;
        this.freqs = new Uint8Array(this.analyser.frequencyBinCount);
        // this.times = new Uint8Array(this.analyser.frequencyBinCount);
        this.source.connect(this.analyser);
        this.canvas = ReactDOM.findDOMNode(this.refs.canvas);
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

        var barWidth = Math.round(canvasWidth / this.analyser.frequencyBinCount);
        var barHeight;
        var x = 0;

        for(var i = 0; i < this.analyser.frequencyBinCount; i++) {
            barHeight = canvasHeight * this.freqs[i] / 255;

            drawContext.fillStyle = 'rgb(' + this.freqs[i] + ',50,50)';
            drawContext.fillRect(x,Math.round(canvasHeight-barHeight),barWidth,Math.round(barHeight));

            x += barWidth;
        }

        // // Draw the time domain chart.
        // for (var i = 0; i < this.analyser.frequencyBinCount; i++) {
        //     var value = this.times[i];
        //     var percent = value / 256;
        //     var height = canvas.height * percent;
        //     var offset = canvas.height - height - 1;
        //     var barWidth = canvas.width/this.analyser.frequencyBinCount;
        //     drawContext.fillStyle = 'white';
        //     drawContext.fillRect(i * barWidth, offset, 1, 2);
        // }
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
    render() {
        return (
            <canvas class="visualiser" ref="canvas" style={{width: '100%', height: '100%', display: 'block'}}></canvas>
        );
    }
}