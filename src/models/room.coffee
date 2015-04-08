RoomController = require('../room_controller.coffee')
RecordingController = require('../recording_controller.coffee')
UserCollection = require('../collections/user.coffee')
RecordingCollection = require('../collections/recording.coffee')
User = require('../models/user.coffee')
LogCollection = require('../collections/log.coffee')
LogEvent = require('../models/log.coffee')

class Room extends Backbone.Model
	defaults = {}
	constructor: (roomID) ->
		super {id: roomID, randomName: User.getRandomName()}
		@roomController = new RoomController @
		@self = new User
		@userCollection = new UserCollection([@self])
		@logCollection = new LogCollection([])

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
			rec.getBlobUrl (err, url) =>
				if err
					return console.log(err)
				else
					@logCollection.add
						type: 'recording'
						data: 
							subtype: 'stopped'
							url: url

			@self.set 'recordingStatus', 'recording'

			@roomController.sendEvent
				type: 'recording'
				data: 
					subtype: 'stopped'
					recData: rec.toJSON()

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
				data: u

		statusMap = 
			ready: 'ready'
			started: 'recording'
			stopped: 'ready'

		@roomController.on "event", (evt) =>
			@logCollection.add new LogEvent evt
			# probably should put this in a subhandler for now...
			if evt.type == 'recording' and evt.from
				status = statusMap[evt.data.subtype]
				@userCollection.get(evt.from).set 'recordingStatus', status

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