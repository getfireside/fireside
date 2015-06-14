Recording = require('../models/recording.coffee')

class RecordingCollection extends Backbone.Collection
	model: (attrs, opts) ->
		opts.app = @app 
		return new Recording(attrs, opts)
	constructor: (models, options) ->
		super models, options
		@localStorage = options.localStorage
		@s3 = options.s3



module.exports = RecordingCollection