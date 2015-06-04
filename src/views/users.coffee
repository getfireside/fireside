attachMediaStream = require 'attachMediaStream'

class UserItemView extends Marionette.ItemView
	template: Handlebars.templates['user']
	modelEvents: 
		'change': 'render'
	onRender: => 
		# Hack to get rid of the unnecessary wrapper div.
		# TODO: figure out a way to cleanly generalise this.
		@setElement(@el.innerHTML)
	
	modelEvents:
		'streamAdded': 'onStreamAdded'

	onStreamAdded: =>		
		alert('hey!')
		if @model.peer.resources.video
			el = @$('video')[0]
			@$('video').show()
		else
			el = @$('audio')[0]
		attachMediaStream @model.peer.stream, el




class UsersView extends Marionette.CollectionView
	tagName: 'div'
	className: 'user-grid'
	childView: UserItemView
	constructor: (@roomView) ->
		super
			collection: @roomView.getUserCollection()
	render: -> 
		ret = super()
		return ret

# class UsersView extends Marionette.LayoutView
# 	regions: 
# 		users: '#usersList'
# 	template: Handlebars.templates['users-panel']
	

# 	onRender: ->
# 		@users.show new UserCollectionView
# 			collection: @collection

module.exports = UsersView