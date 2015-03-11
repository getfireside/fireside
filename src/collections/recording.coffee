Recording = require('../models/recording.coffee')

class RecordingCollection extends Thorax.Collection
	model: Recording
	constructor: (models, options) ->
		super models, options
		@localStorage = new Backbone.LocalStorage options.room.id + '-recordings'

module.exports = RecordingCollection