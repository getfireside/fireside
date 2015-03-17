WildEmitter = require('WildEmitter')
webrtcSupport = require('webrtcsupport')
attachMediaStream = require('attachmediastream')
mockconsole = require('mockconsole')
io = require('socket.io-client')
util = require('util')
LocalMedia = require('localmedia')
PeerConnection = require 'rtcpeerconnection'

class Peer extends WildEmitter
	constructor: (opts) ->
		@id = opts.id
		@controller = opts.controller
		@resources = opts.resources or {}
		@browserPrefix = opts.prefix 
		@stream = opts.stream
		@enableDataChannels = opts.enableDataChannels ? @controller.config.enableDataChannels
		@receiveMedia = opts.receiveMedia ? @controller.config.receiveMedia
		@channels = {}
		@sid = opts.sid
		@info = opts.info
		@role = opts.role
		@recordingStatus = opts.recordingStatus ? null

		@pc = new PeerConnection(@controller.config.peerConnectionConfig, @controller.config.peerConnectionConstraints)
		@pc.on 'ice', @onIceCandidate
		@pc.on 'offer', (offer) => @send('offer', offer)
		@pc.on 'answer', (offer) => @send('answer', offer)
		@pc.on 'addStream', @handleRemoteStreamAdded
		@pc.on 'addChannel', @handleDataChannelAdded
		@pc.on 'removeStream', @handleStreamRemoved
		# Just fire negotiation needed events for now
		# When browser re-negotiation handling seems to work
		# we can use this as the emit for starting the offer/answer process
		# automatically. We'll just leave it be for now while this stabalizes.
		@pc.on 'negotiationNeeded', => @emit 'negotiationNeeded'
		@pc.on 'iceConnectionStateChange', => @emit 'iceConnectionStateChange'
		@pc.on 'iceConnectionStateChange', =>
			switch @pc.iceConnectionState
				when 'failed'
					# currently, in chrome only the initiator goes to failed
					# so we need to signal this to the peer
					if @pc.pc.peerconnection.localDescription.type == 'offer'
						@controller.emit('iceFailed', @)
						@send('connectivityError')

		@pc.on 'signalingStateChange', => @emit 'signalingStateChange'
		@logger = @controller.logger

		# call emitter constructor
		super

		# proxy events to parent
		@on '*', => @controller.emit.apply(@controller, arguments)

		@controller.on('localStream', @addLocalStream)

		for stream in @controller.localMedia.localStreams
			@addLocalStream stream

	addLocalStream: (stream) =>
		console.log "added stream!"
		@pc.addStream(stream)


	handleMessage: (message) ->
		@logger.log('getting', message.type, message, 'from', message.from)

		if message.prefix
			@browserPrefix = message.prefix;

		switch message.type
			when 'offer'
				@logger.log 'received offer. trying to handle payload...'

				message.payload.sdp = message.payload.sdp.replace('a=fmtp:0 profile-level-id=0x42e00c;packetization-mode=1\r\n', '')
				@pc.handleOffer message.payload, (err) =>
					if (err)
						@logger.log 'error handing payload', err
						return
					# auto-accept
					@logger.log 'auto-accepting answer...'
					@pc.answer @receiveMedia, (err, sessionDescription) =>
						if (err)
							@logger.log "error calling pc.answer", err
							return
						@logger.log 'answering', message.from, 'with', sessionDescription
						@send('answer', sessionDescription)

			when 'answer'
				@logger.log 'accepting stream from', message.from
				@pc.handleAnswer(message.payload)
			when 'candidate'
				@pc.processIce(message.payload)
			when 'connectivityError'
				@controller.emit('connectivityError', @)
			when 'mute'
				@controller.emit('mute', {id: message.from, name: message.payload.name})
			when 'unmute'
				@controller.emit('unmute', {id: message.from, name: message.payload.name})

	send: (type, payload) =>
		message = 
			to: @id
			sid: @sid
			broadcaster: @broadcaster
			type: type
			payload: payload
			prefix: @controller.capabilities.prefix
		@logger.log "sending", type, "to", @id, ":", message
		@controller.connection.emit 'signalling', message

	sendDirectly: (channel, type, payload) =>
		message = 
			type: type
			payload: payload

		@logger.log "sending via datachannel", channel, type, message
		dc = @getDataChannel channel
		if dc.readyState != 'open'
			return false
		dc.send JSON.stringify message
		return true

	requestRecordingStart: =>
		@controller.connection.emit 'startRecordingRequest', @id

	requestRecordingStop: =>
		@controller.connection.emit 'stopRecordingRequest', @id

	_observeDataChannel: (channel) =>
		channel.onclose = @emit.bind(@, 'channelClose', channel);
		channel.onerror = @emit.bind(@, 'channelError', channel);
		channel.onmessage = (event) =>
			@emit 'channelMessage', @, channel.label, JSON.parse(event.data), channel, event
		channel.onopen = @emit.bind(this, 'channelOpen', channel);

	# Fetch or create a data channel by the given name
	getDataChannel: (name, opts) ->
		if (!@controller.capabilities.dataChannel) 
			return @emit('error', new Error('createDataChannel not supported'));
		channel = @channels[name];
		if channel
			return channel
		# if we don't have one by this label, create it
		opts = opts or {}
		channel = @channels[name] = @pc.createDataChannel(name, opts)
		@_observeDataChannel(channel)
		return channel

	onIceCandidate: (candidate) =>
		if @streamClosed 
			return
		if candidate
			this.send('candidate', candidate)
		else
			this.logger.log("End of candidates.")

	start: =>
		@logger.log "trying to start", @id
		# well, the webrtc api requires that we either
		# a) create a datachannel a priori
		# b) do a renegotiation later to add the SCTP m-line
		# Let's do (a) first...
		if (@enableDataChannels)
			@getDataChannel('simplewebrtc')

		@pc.offer @receiveMedia, (err, sessionDescription) =>
			@logger.log "sending offer", sessionDescription, 'to', @id
			@send('offer', sessionDescription)

	icerestart: =>
		constraints = @receiveMedia
		constraints.mandatory.IceRestart = true
		@pc.offer(constraints, (err, success) -> null)

	endStream: =>
		if @streamClosed
			return
		@pc.close()
		@handleStreamRemoved()

	unbindEvents: =>
		@controller.off('localStream', @addLocalStream)

	end: =>
		if @closed
			return
		@logger.log @id, "leaving"
		@endStream()
		@closed = true
		@off()
		@unbindEvents()
		@controller.emit 'peerRemoved', @


	handleRemoteStreamAdded: (event) =>
		if (@stream)
			@logger.warn('Already have a remote stream')
		else
			@stream = event.stream;
			# FIXME: addEventListener('ended', ...) would be nicer
			# but does not work in firefox 
			@stream.onended = =>
				@endStream()

			@controller.emit('peerStreamAdded', @)
			@logger.log "GOT STREAM!"

	handleStreamRemoved: =>
		@streamClosed = true
		@controller.emit 'peerStreamRemoved', @

	handleDataChannelAdded: (channel) =>
		@channels[channel.label] = channel
		@_observeDataChannel(channel)

	updateInfo: (info) =>
		@info = info
		@emit "peerInfoUpdated", @

	updateResources: (resources) =>
		@resources = resources
		@emit "peerResourcesUpdated", @



class RoomController extends WildEmitter
	constructor: (@model, config) ->
		console.log "SET UP ROOM CONTROLLER..."
		@defaults = 
			url: "http://localhost:8001",
			socketio: {}
			media:
				video: true
				audio: true
			enableDataChannels: true
			peerConnectionConfig:
				iceServers: [
					{url: "stun:stun.l.google.com:19302"}
				]

			peerConnectionConstraints: 
				optional: [
					{DtlsSrtpKeyAgreement: true}
				]

			receiveMedia: 
				mandatory:
					OfferToReceiveAudio: true
					OfferToReceiveVideo: true

			logger: console


		@config = _.extend {}, @defaults, config 

		super

		@capabilities = webrtcSupport
		@peers = {}
		@logger = @config.logger

		@localMedia = new LocalMedia @config
		@localMedia.on 'localStream', (stream) => @emit 'localStream', stream

		@setupConnection()

		@on 'joinedRoom', (r) -> console.log 'joined room with role', r
		@on 'peerStreamAdded', @handlePeerStreamAdded
		@on 'peerStreamRemoved', @handlePeerStreamRemoved
		@on 'peerRemoved', @handlePeerRemoved
		@on 'peerResourcesUpdated', (peer) =>
			@logger.log "peer resources updated!"
			if peer.resources.video and not @mainPeer?
				@mainPeer = peer
				peer.start()

		# @mainPeer = null

	createPeer: (opts) ->
		opts.controller = @
		peer = new Peer(opts)
		@peers[peer.id] = peer

	removePeer: (id) -> 
		@peers[id].end()
		delete @peers[id]

	getPeer: (id) -> @peers[id]

	getInterviewees: -> _.filter @peers, ((p) -> p.role == 'interviewee')

	startIntervieweeRecording: ->
		for peer in @getInterviewees()
			peer.requestRecordingStart()

	stopIntervieweeRecording: ->
		for peer in @getInterviewees()
			peer.requestRecordingStop()

	sendToAll: (message, payload) ->
		for peer of @peers
			peer.send message, payload

	sendEvent: (evt) ->
		@connection.emit 'event', evt

	sendDirectlyToAll: (channel, message, payload) ->
		for peer of @peers
			if peer.enableDataChannels
				peer.sendDirectly channel, message, payload


	startLocalVideo: (el, cb) ->
		if not @localMedia.localStreams.length
			@localMedia.start {video: true, audio: true}, (err, stream) =>
				if err
					# handle error
					console.log err
				else
					attachMediaStream(stream, $(el)[0], 
						autoplay: true
						mirror: true
						muted: true
					)
					@logger.log "emitting updateResources!"
					@connection.emit "updateResources", 
						id: @connection.io.engine.id
						video: true
					if cb?
						cb(stream)
		else
			if cb?
				cb(@localMedia.localStreams[0])


	setupConnection: ->
		@connection = io.connect(@config.url, @config.socketio)

		@connection.on "connect", =>
			@emit "connectionReady", @connection.io.engine.id
			@sessionReady = true

		@connection.on 'signalling', (message) =>
			console.log message
			peer = @getPeer(message.from)
			peer.handleMessage(message)

		@connection.on 'event', (data) => @emit "event", data

		@on 'event', (evt) =>
			if evt.type == 'recording'
				# argh this thing is here again, really hackish. FIXME
				statusMap = 
					ready: 'ready'
					started: 'recording'
					stopped: 'ready'
				@getPeer(evt.from).recordingStatus = statusMap[evt.data.subtype]

		@connection.on 'remove', (data) =>
			@getPeer(data.id).end()

		@connection.on 'announce', (data) =>
			@logger.log "ANNOUNCING THE AMAZING", data?.info?.name
			peer = @createPeer
				id: data.id
				enableDataChannels: @config.enableDataChannels
				info: data.info
				resources: data.resources
				role: data.role
				sid: data.sid

			@emit 'createdPeer', peer
			@emit 'announcePeer', peer

		@connection.on 'startRecordingRequest', (data) =>
			if @getPeer(data.host).role != 'host'
				@logger.log "according to local data the startRecording message didn't come from a host."
				return
			@emit 'startRecordingRequest'

		@connection.on 'stopRecordingRequest', (data) =>
			if @getPeer(data.host).role != 'host'
				@logger.log "according to local data the stopRecording message didn't come from a host."
				return
			@emit 'stopRecordingRequest'


		@connection.on 'updateResources', (data) =>
			@getPeer(data.id).updateResources(data.newResources)

	joinRoom: ->
		console.log 'joining room...'
		return new Promise (fulfil, reject) =>
			info = 
				name: @localName
			@connection.emit 'join', {room: @model.id, info: info}, (err, roomData) =>
				if err
					reject(err)
				else
					@role = roomData.role
					console.log "people in room", roomData.clients
					for id, data of roomData.clients
						peer = @createPeer
							id: id,
							enableDataChannels: @config.enableDataChannels
							info: data.info
							resources: data.resources
							role: data.role
							sid: data.sid
							recordingStatus: data.recordingStatus

						@emit 'createdPeer', peer
						if peer.resources.video and not @mainPeer?
							@mainPeer = peer
							peer.start()

					fulfil(roomData)
					@emit 'joinedRoom', @role

	setLocalName: (name) ->
		@localName = name

	handlePeerStreamAdded: (peer) =>
		console.log "peer stream added!"
		@emit 'videoAdded', peer

	handlePeerStreamRemoved: (peer) =>
		console.log "peer stream removed."
		if (@mainPeer? and peer.id == @mainPeer.id)
			@mainPeer = null
		@emit 'videoRemoved', peer

	handlePeerRemoved: (peer) =>
		@removePeer peer.id

module.exports = RoomController

# peerjs = require('peerjs')

# class RoomController
# 	constructor: (@model) ->
# 		@peerjs = new Peer
# 			key: id
# 			debug: 3

# 		@peerjs.on 'open', (id) -> console.log("I AM", id)
# 		@peerjs.on 'connection', @onConnect

# 	onConnect: (conn) ->
# 		@users.append

