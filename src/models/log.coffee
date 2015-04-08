moment = require 'moment'

Handlebars.registerHelper 'formatTime', (m, s) -> m.format s

class Log extends Backbone.Model
	constructor: (attributes, options) ->
		if not attributes.timestamp?
			attributes.timestamp = moment()
		if not (attributes.timestamp instanceof moment)
			attributes.timestamp = moment(attributes.timestamp)
		super attributes, options

	displayTimestamp: ->
		@get('timestamp').format 'hh:mm'

	displayFullTimestamp: ->
		@get('timestamp').format 'MMMM Do YYYY, hh:mm:ss'

module.exports = Log