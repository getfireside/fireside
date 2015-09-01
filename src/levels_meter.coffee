webrtc = require 'webrtcsupport'
{EventEmitter} = require 'events'
# /*
# The MIT License (MIT)
# Copyright (c) 2014 Chris Wilson
# Permission is hereby granted, free of charge, to any person obtaining a copy
# of this software and associated documentation files (the "Software"), to deal
# in the Software without restriction, including without limitation the rights
# to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
# copies of the Software, and to permit persons to whom the Software is
# furnished to do so, subject to the following conditions:
# The above copyright notice and this permission notice shall be included in all
# copies or substantial portions of the Software.
# THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
# IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
# FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
# AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
# LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
# OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
# SOFTWARE.
# */

class LevelsMeter extends EventEmitter
	constructor: (stream, opts={}) ->
		context = new webrtc.AudioContext
		@source = context.createMediaStreamSource stream
		@context = @source.context
		
		if not @context.createScriptProcessor
			@processor = @context.createJavascriptNode(512)
		else
			@processor = @context.createScriptProcessor(512)
		@processor.onaudioprocess = @onAudioProcess
		@clipping = false
		@lastClip = 0
		@volume = 0
		@clipLevel = opts.clipLevel ? 0.98
		@averaging = opts.averaging ? 0.95
		@clipLag = opts.clipLag ? 750

		@source.connect(@processor)
		@processor.connect @context.destination

	onAudioProcess: (evt) =>
		buf = evt.inputBuffer.getChannelData(0)
		sum = 0

		for x in buf
			if Math.abs(x) >= @clipLevel
				@clipping = true
				@lastClip = window.performance.now()
			sum += x*x

		rms = Math.sqrt(sum/buf.length)

	    # Now smooth this out with the averaging factor applied
	    # to the previous sample - take the max here because we
	    # want "fast attack, slow release."

		@volume = Math.max(rms, @volume*@averaging)

	checkClipping: ->
		if !@clipping
			return false
		if (@lastClip + @clipLag) < window.performance.now()
			@clipping = false
		return @clipping


	stop: ->
		@processor.disconnect()
		@processor.onAudioProcess = null

module.exports = LevelsMeter
