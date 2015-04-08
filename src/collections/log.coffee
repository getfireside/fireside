Log = require('../models/log.coffee')
class LogCollection extends Backbone.Collection
	model: Log
	comparator: 'timestamp'

module.exports = LogCollection