User = require('../models/user.coffee')
class UserCollection extends Backbone.Collection
	model: User

module.exports = UserCollection