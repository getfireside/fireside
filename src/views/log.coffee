class DefaultLogView extends Thorax.View
	constructor: (data) ->
		data.template = Handlebars.templates['log-item-' + data.model.get('type')]
		super data

class LogCollectionView extends Thorax.CollectionView
	typeViews: 
		'*': DefaultLogView

	renderItem: (model, i) ->
		View = @typeViews[model.get 'type'] ? @typeViews['*']
		return new View({ model: model })

class LogView extends Thorax.View 
	template: Handlebars.templates['log-panel']
	constructor: (@roomView) ->
		collection = @roomView.getLogCollection()
		super
			collection: collection
			collectionView: new LogCollectionView 
				collection: collection
			events: 
				'keydown textarea#msgInput': "keyDown"

	sendMsg: ->
		v = @$el.find('#msgInput').val()
		@$el.find('#msgInput').val('')
		@roomView.sendMsg v

	keyDown: (e) ->
		if e.which == 13 and not e.ctrlKey
			e.preventDefault()
			@sendMsg()

		

module.exports = LogView