Log = require('../models/log.coffee')
class LogCollection extends Thorax.Collection
	model: Log

module.exports = LogCollection