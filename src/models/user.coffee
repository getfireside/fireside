philosophers = require "../../assets/philosophers.js"

class User extends Backbone.Model
	@getRandomName: -> _.sample philosophers
	
module.exports = User
