attachMediaStream = require 'attachmediastream'

class UserItemView extends Marionette.ItemView
	template: Handlebars.templates['user']
	modelEvents: 
		'change': 'render'
	events: 
		'click a.kick': 'onKick'

	onKick: -> 
		@model.requestKick()

	render: ->
		if not @isRendered
			super()
		else
			@triggerMethod 'before:render', @
			data = @serializeData()
			@$('div.name em').text(data.name)
			@triggerMethod 'render', @
		return @

	onRender: => 
		# Hack to get rid of the unnecessary wrapper div.
		# TODO: figure out a way to cleanly generalise this.
		@setElement(@el.innerHTML)
	
	modelEvents:
		'streamAdded': 'onStreamAdded'

	onStreamAdded: =>		
		if @model.peer.resources.video
			el = @$('video')[0]
			@$('video').show()
			@$('img').hide()
		else
			el = @$('audio')[0]
		attachMediaStream @model.peer.stream, el

class EmptyView extends Marionette.ItemView
	template: Handlebars.templates['no-users']
	onRender: -> 
		# Hack to get rid of the unnecessary wrapper div.
		# TODO: figure out a way to cleanly generalise this.
		@setElement(@el.innerHTML)


class UsersView extends Marionette.CollectionView
	tagName: 'div'
	className: 'user-grid'
	childView: UserItemView
	emptyView: EmptyView
	constructor: (@roomView) ->
		super
			collection: @roomView.getUserCollection()

# class UsersView extends Marionette.LayoutView
# 	regions: 
# 		users: '#usersList'
# 	template: Handlebars.templates['users-panel']
	

# 	onRender: ->
# 		@users.show new UserCollectionView
# 			collection: @collection

module.exports = UsersView