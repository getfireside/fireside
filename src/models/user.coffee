philosophers = require "../../assets/philosophers.js"

class User extends Backbone.Model
	@getRandomName: -> _.sample philosophers
	constructor: (attributes, options) ->
		@peer = options?.peer
		if @peer?
			attrs = 
				id: @peer.id
				name: @peer.info?.name
				role: @peer.role
				status: 'connected'
				recordingStatus: @peer.recordingStatus
			_.extend attrs, attributes

			@peer.on 'peerInfoUpdated', (peer) => @set peer.info
			@peer.on 'peerStreamAdded', =>
				@set 'status', 'streaming'
				@trigger 'streamAdded'
			@peer.on 'peerStreamRemoved', =>
				@set 'status', 'connected'
				@trigger 'streamRemoved'

		super attrs, options

	
module.exports = User
