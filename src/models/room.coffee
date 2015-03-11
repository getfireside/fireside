RoomController = require('../room_controller.coffee')
RecordingController = require('../recording_controller.coffee')
UserCollection = require('../collections/user.coffee')
RecordingCollection = require('../collections/recording.coffee')
User = require('../models/user.coffee')
LogCollection = require('../collections/log.coffee')
LogEvent = require('../models/log.coffee')

class Room extends Thorax.Model
	defaults = {}
	constructor: (roomID) ->
		super {id: roomID, randomName: User.getRandomName()}
		@roomController = new RoomController @
		@self = new User
		@userCollection = new UserCollection([@self])
		@logCollection = new LogCollection([])
		@recordingCollection = new RecordingCollection [], {room: @}

		@recordingController = new RecordingController @, @recordingCollection

		@roomController.on "connectionReady", (id) =>
			@self.set
				id: id
				status: 'connected'
				isSelf: true

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

		@roomController.on "peerInfoUpdated", (peer) =>
			@userCollection.get(peer.id).set peer.info

		@roomController.on 'localStream', (stream) =>
			@recordingController.addStream stream

		@roomController.on "peerRemoved", (peer) =>
			u = @userCollection.get peer.id 
			@userCollection.remove {id: peer.id}
			@logCollection.add
				type: 'leave'
				data: u

		@roomController.on "event", (data) =>
			@logCollection.add new LogEvent data

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