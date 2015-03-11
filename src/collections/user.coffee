User = require('../models/user.coffee')
class UserCollection extends Thorax.Collection
	model: User

module.exports = UserCollection