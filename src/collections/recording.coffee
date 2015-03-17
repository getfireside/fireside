Recording = require('../models/recording.coffee')
IDBWriter = require '../writers/idbwriter.coffee' 

class RecordingCollection extends Backbone.Collection
	model: Recording
	constructor: (models, options) ->
		super models, options
		@localStorage = new Backbone.LocalStorage options.room.id + '-recordings'



module.exports = RecordingCollection