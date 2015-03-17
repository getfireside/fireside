class View extends Backbone.View 
	render: ->
		@stickit()
		@trigger 'rendered'

module.exports = View