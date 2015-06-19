class StatusView extends Marionette.ItemView
	tagName: 'li'
	className: 'status'
	modelEvents:
		change: 'render'
	onRender: ->
		@el.className = @className()

class ConnectionStatusView extends StatusView
	template: Handlebars.templates['status-connection']
	className: -> 'status connection' + (if @model.get 'error' then ' error' else ' success')
	triggers: ->
		"click .retry": "retry"

class RecordingStatusView extends StatusView
	template: Handlebars.templates['status-recording']
	className: -> 'status recording'

class UploadStatusView extends StatusView
	template: Handlebars.templates['status-upload']
	className: -> 'status upload'
	initialize: (options) ->
		if not @model.get 'complete'
			@_timer = setInterval(@render, 1000)

	render: ->
		data = @serializeData()
		if data.complete or not @isRendered
			super()
		else
			@triggerMethod 'before:render', @
			@$('span.rec-progress').css('width', data.progress)
			@$('span.speed').html(Handlebars.helpers.formatRate(data.speed))
			@$('span.eta').html(Handlebars.helpers.timeUntil(data.eta))
			@triggerMethod 'render', @
		return @

	onRender: ->
		if @model.get 'complete'
			clearInterval @_timer
		

_types = 
	connection: ConnectionStatusView
	recording: RecordingStatusView
	upload: UploadStatusView

getFromType = (type) -> return _types[type]

module.exports = 
	getFromType: getFromType
	StatusView: StatusView
	ConnectionStatusView: ConnectionStatusView