class UserItemView extends Marionette.ItemView
	template: Handlebars.templates['user-item']
	modelEvents: 
		'change': 'render'

class UserCollectionView extends Marionette.CollectionView
	childView: UserItemView

class UsersView extends Marionette.LayoutView
	regions: 
		users: '#usersList'
	template: Handlebars.templates['users-panel']
	constructor: (@roomView) ->
		super
			collection: @roomView.getUserCollection()

	onRender: ->
		@users.show new UserCollectionView
			collection: @collection

module.exports = UsersView