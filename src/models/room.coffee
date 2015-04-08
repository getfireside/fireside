RoomController = require('../room_controller.coffee')
RecordingController = require('../recording_controller.coffee')
UserCollection = require('../collections/user.coffee')
RecordingCollection = require('../collections/recording.coffee')
User = require('../models/user.coffee')
LogCollection = require('../collections/log.coffee')
LogEvent = require('../models/log.coffee')

# put me in a more sensible place please.
lastStoppedLog = null

class Room extends Backbone.Model
	defaults = {}
	constructor: (roomID) ->
		super {id: roomID, randomName: User.getRandomName()}
		@roomController = new RoomController @
		@self = new User
		@userCollection = new UserCollection([@self])
		@logCollection = new LogCollection([])

		$.getJSON "/rooms/#{roomID}/clients/", (res) =>
			@historicalClients = res.clients
			
			$.getJSON "/rooms/#{roomID}/logs/", (res) =>
				@logCollection.add res.logs

		@recordingCollection = new RecordingCollection [], {room: @}
		@recordingController = new RecordingController @, @recordingCollection

		@recordingController.on 'started', =>
			@sendEvent
				type: 'recording'
				data: 
					subtype: 'started'
			@self.set 'recordingStatus', 'recording'

		@recordingController.on 'ready', =>
			@sendEvent
				type: 'recording'
				data: 
					subtype: 'ready'
			@self.set 'recordingStatus', 'ready'


		@recordingController.on 'stopped', (rec) =>
			rec.upload()
			log = null

			@roomController.sendEvent
				type: 'recording'
				data: 
					subtype: 'stopped'
					recData: rec.toJSON()

			rec.on 'uploadStarted', =>
				log = @logCollection.add
					type: 'recording'
					data: 
						subtype: 'stopped'
						progress: 0

			rec.on 'uploadProgress', (rec, v) =>
				# doing this isn't very nice, need to change later.
				data = _.clone log.get 'data'
				data.progress = v 
				log.set 'data', data

				@roomController.sendEvent
					type: 'recording'
					data: 
						subtype: 'upload-progress'
						progress: v

			rec.on 'uploadComplete', (rec, url) =>
				data = _.clone log.get 'data'
				data.progress = 1
				data.url = url 
				log.set 'data', data

				@roomController.sendEvent
					type: 'recording'
					data: 
						subtype: 'upload-complete'
						url: url

			@self.set 'recordingStatus', 'ready'

			@status = 'ready'

		@roomController.on "connectionReady", (id) =>
			@self.set
				id: id
				status: 'connected'
				isSelf: true

		@roomController.on "videoAdded", (peer) =>
			@userCollection.get(peer.id).set('status', 'streaming')

		@roomController.on "videoRemoved", (peer) =>
			@userCollection.get(peer.id).set('status', 'connected')

		@roomController.on "joinedRoom", (role) =>
			@trigger 'setRole', role
			@self.set 'role', role
			@logCollection.add
				type: 'connection'
				data: 'Joined room.'

		@roomController.on "createdPeer", (peer) =>
			@userCollection.add 
				id: peer.id
				name: peer.info?.name
				role: peer.role
				status: 'connected'
				recordingStatus: peer.recordingStatus

		@roomController.on "peerInfoUpdated", (peer) =>
			@userCollection.get(peer.id).set peer.info

		@roomController.on 'localStream', (stream) =>
			@recordingController.addStream stream
			@self.set 'status', 'streaming'

		@roomController.on "peerRemoved", (peer) =>
			u = @userCollection.get peer.id 
			@userCollection.remove {id: peer.id}
			@logCollection.add
				type: 'leave'
				from: peer.id

		statusMap = 
			ready: 'ready'
			started: 'recording'
			stopped: 'ready'

		@roomController.on "event", (evt) =>
			# probably should put this in a subhandler later...
			if evt.type != 'recording' or (evt.data.subtype != 'upload-progress' and evt.data.subtype != 'upload-complete')
				log = new LogEvent evt
				@logCollection.add log

			if evt.type == 'recording' 
				if evt.from
					status = statusMap[evt.data.subtype]
					@userCollection.get(evt.from).set 'recordingStatus', status
					if evt.data.subtype == 'stopped'
						lastStoppedLog = log
				if evt.data.subtype == 'upload-progress' or evt.data.subtype == 'upload-complete'
					console.log lastStoppedLog
					# attempt to find the correct log event and update it
					if lastStoppedLog
						if evt.data.subtype == 'upload-progress'
							lastStoppedLog.set 'data', _.extend {}, lastStoppedLog.get('data'), {progress:evt.data.progress}
						if evt.data.subtype == 'upload-complete'
							lastStoppedLog.set 'data', _.extend {}, lastStoppedLog.get('data'), {url: evt.data.url}


		@roomController.on "startRecordingRequest", =>
			if @recordingController.status == 'ready'
				@recordingController.start()

		@roomController.on "stopRecordingRequest", =>
			if @recordingController.status == 'started'
				@recordingController.stop()

		@roomController.on "announcePeer", (peer) =>
			@logCollection.add 
				type: 'announce'
				data: @userCollection.get peer.id

	getUserCollection: -> @userCollection 
	getLogCollection: -> @logCollection
	sendMsg: (msg) -> 
		@sendEvent 
			data: msg
			type: 'msg'

	sendEvent: (evt) ->
		@roomController.sendEvent evt
		@logCollection.add new LogEvent evt



module.exports = Room