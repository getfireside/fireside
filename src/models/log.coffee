moment = require 'moment'

Handlebars.registerHelper 'formatTime', (m, s) -> m.format s

class Log extends Thorax.Model
	constructor: (attributes, options) ->
		if not attributes.timestamp?
			attributes.timestamp = moment()
		super attributes, options

	displayTimestamp: ->
		@get('timestamp').format 'hh:mm'

	displayFullTimestamp: ->
		@get('timestamp').format 'MMMM Do YYYY, hh:mm:ss'

module.exports = Log