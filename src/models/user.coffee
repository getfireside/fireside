philosophers = require "../../assets/philosophers.js"

class User extends Thorax.Model
	@getRandomName: -> _.sample philosophers
	
module.exports = User
