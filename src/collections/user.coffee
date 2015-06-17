User = require('../models/user.coffee')
class UserCollection extends Backbone.Collection
	model: User
	initialize: (models, opts) ->
		@room = opts.room

module.exports = UserCollection