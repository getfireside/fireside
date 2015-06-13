class StatusView extends Marionette.ItemView
	tagName: 'div'
	className: 'status'

class ConnectionStatusView extends StatusView
	template: Handlebars.templates['status-connection']
	className: -> 'status connection' + (if @model.get 'error' then ' error' else ' success')
	modelEvents:
		change: 'render'
	triggers: ->
		"click .retry": "retry"
	onRender: ->
		@el.className = @className()

module.exports = 
	StatusView: StatusView
	ConnectionStatusView: ConnectionStatusView 