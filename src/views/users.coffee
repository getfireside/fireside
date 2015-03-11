class UsersView extends Thorax.View 
	template: Handlebars.templates['users-panel']
	constructor: (@roomView) ->
		super
			collection: @roomView.getUserCollection()

module.exports = UsersView