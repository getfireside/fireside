# attachMediaStream = require('attachmediastream')
# moment = require 'moment'
# #View = require '../view.coffee'

# class PeerView extends Marionette.ItemView
# 	template: Handlebars.templates['peer']

# class PeersView extends Marionette.CollectionView 
# 	# constructor: (@roomView, opts) ->
# 	# 	super opts
		
# 	# 	@roomView.model.on 'setRole', (role) =>
# 	# 		@controls.show new ControlsView @,
# 	# 			template: Handlebars.templates["#{role}-controls"]
			

# 	# onRender: ->
# 	# 	@controls.show new ControlsView @
# 	# 	@$('a#changeVidRes').on 'click', ->
# 	# 		$('#ffVideoResModal').modal 'show'
# 	# 		if not window.yakkFFExtension
# 	# 			window.location.href = $('#ffVideoResModal p.ffextn-not-installed a').attr('href')
# 	# 		else
# 	# 			$('#ffVideoResModal p.ffextn-not-installed').hide()
# 	# 			$('#ffVideoResModal .btn.save').removeAttr('disabled')
# 	# 			window.yakkFFGetRes (err, w, h) ->
# 	# 				if w
# 	# 					$('#ffVideoResModal input[name=width]').val(w)
# 	# 				if h
# 	# 					$('#ffVideoResModal input[name=height]').val(h)

# 	# 	$('#ffVideoResModal .btn.save').on 'click', =>
# 	# 		width = $('#ffVideoResModal input[name=width]').val()
# 	# 		height = $('#ffVideoResModal input[name=height]').val()
# 	# 		if window.yakkFFExtension
# 	# 			window.yakkFFSetRes(width, height)
# 	# 			setTimeout((-> window.location.reload()), 500)

# 	# handleStreamStart: (peer) =>
# 	# 	@$('div.video').show()
# 	# 	@$('div.waiting').hide()
# 	# 	attachMediaStream(peer.stream, @$('video#remoteVideo')[0])

# 	# handleStreamEnd: (peer) =>
# 	# 	@$('div.waiting').show()


# module.exports = CallView