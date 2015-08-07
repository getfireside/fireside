moment = require 'moment'

pad = (num, size) ->
    s = num + ""
    while (s.length < size) 
        s = "0" + s
    return s

sum = (arr) -> arr.reduce (a, b) -> a + b

formatLength = (difference) -> pad(Math.floor(difference / 60), 2) + ':' + pad(Math.round(difference % 60), 2)

class EtaTracker
	constructor: (@progress=0, @total=0, @currentSpeed=0) ->
		@averageSpeed = @currentSpeed or null
		@lastSpeeds = []
		@lastUpdate = moment()
		@started = moment()

	smoothFactor: ->
		dt = Math.log10 moment().diff(@started) / 1000 
		switch	
			when dt < 10 then 0.9
			when dt < 100 then 0.8
			when dt < 200 then 0.5
			when dt < 600 then 0.1
			when dt < 1200 then 0.01
			when dt < 3600 then 0.005


	update: (progress, total=null) ->
		if total?
			@total = total
		oldProgress = @progress
		@progress = progress
		dP = @progress - oldProgress
		@prevUpdate = @lastUpdate
		@lastUpdate = moment()
		dt = @lastUpdate.diff(@prevUpdate) / 1000
		@currentSpeed = dP / dt
		if @lastSpeeds.length >= 20
			@lastSpeeds.shift()
		@lastSpeeds.push(@currentSpeed)
		@movingAverageSpeed = sum(@lastSpeeds) / @lastSpeeds.length
		if @averageSpeed?
			@averageSpeed = @smoothFactor()*@movingAverageSpeed + (1-@smoothFactor()) * @averageSpeed
		else
			@averageSpeed = @movingAverageSpeed

		bytesLeft = @total - @progress
		# remaining time
		timeLeft = bytesLeft / @averageSpeed
		eta = moment()
		eta.add(timeLeft, 'seconds')
		return eta

module.exports = {pad, formatLength, EtaTracker}