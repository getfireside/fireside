class StatusView extends Marionette.ItemView
	tagName: 'li'
	className: 'status'
	modelEvents:
		change: 'render'
	onRender: ->
		@el.className = @className()
	className: -> @getClassNames().join(' ')
	getClassNames: -> ['status'].concat(if @model.get 'error' then 'error' else [])

class ConnectionStatusView extends StatusView
	template: Handlebars.templates['status-connection']
	getClassNames: -> super().concat('connection')
	triggers: ->
		"click .retry": "retry"

class RecordingStatusView extends StatusView
	template: Handlebars.templates['status-recording']
	getClassNames: -> super().concat('recording')

class ErrorStatusView extends StatusView
	template: Handlebars.templates['status-error']
	getClassNames: -> super().concat('error')

class RemoteErrorStatusView extends StatusView
	template: Handlebars.templates['status-remote-error']
	getClassNames: -> super().concat('error remote')

class UploadStatusView extends StatusView
	template: Handlebars.templates['status-upload']
	getClassNames: -> super().concat('upload')
	initialize: (options) ->
		if not @model.get 'uploading'
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
		if not @model.get 'uploading'
			clearInterval @_timer


		

_types = 
	connection: ConnectionStatusView
	recording: RecordingStatusView
	upload: UploadStatusView
	error: ErrorStatusView
	'remote-error': RemoteErrorStatusView

getFromType = (type) -> return _types[type]

module.exports = 
	getFromType: getFromType
	StatusView: StatusView
	ConnectionStatusView: ConnectionStatusView