Log = require('../models/log.coffee')
class LogCollection extends Backbone.Collection
	model: Log

module.exports = LogCollection