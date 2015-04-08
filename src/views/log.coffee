class DefaultLogView extends Marionette.ItemView
	# constructor: (data) ->
	# 	data.template = Handlebars.templates['log-item-' + data.model.get('type')]
	# 	super data

	template: (ctx) =>
		mainTpl = Handlebars.templates['log-item']
		ctx['inner'] = new Handlebars.SafeString(Handlebars.templates['log-item-' + @model.get('type')](ctx))
		return mainTpl(ctx)

	serializeData: ->
		data = @model.toJSON()
		if not data.from 
			data.from = 'self'
			data.fromName = @options.parent.roomView.model.self.get('name')
		else
			firstAttempt = @options.parent.roomView.getUserCollection().get(data.from)?.get('name')
			data.fromName = firstAttempt ? @options.parent.roomView.model.historicalClients[data.from].name
		return data

class RecordingLogView extends DefaultLogView
	modelEvents:
		change: 'render'

class LogCollectionView extends Marionette.CollectionView
	typeViews: 
		'*': DefaultLogView
		'recording': RecordingLogView

	constructor: (opts) ->
		super opts
		@roomView = opts.roomView

	getChildView: (model) -> @typeViews[model.get 'type'] ? @typeViews['*']
	childViewOptions: (model, index) => 
		parent: @

	onAddChild: ->
		# todo: better scrolling, use a jquery plugin or something
		@roomView.$('div.scroller').scrollTop(@roomView.$('div.scroller ul#logsList').height() + 1000)

class LogView extends Marionette.LayoutView 
	template: Handlebars.templates['log-panel']
	regions:
		logs: '#logsList'

	events: 
		'keydown textarea#msgInput': "keyDown"

	constructor: (@roomView, opts) ->
		opts = opts ? {}
		opts.collection = @roomView.getLogCollection()
		super opts
	
	onRender: ->
		@logs.show new LogCollectionView
			collection: @collection
			roomView: @roomView

	sendMsg: ->
		v = @$el.find('#msgInput').val()
		@$el.find('#msgInput').val('')
		@roomView.sendMsg v

	keyDown: (e) ->
		if e.which == 13 and not e.ctrlKey and @$el.find('#msgInput').val()
			e.preventDefault()
			@sendMsg()

module.exports = LogView