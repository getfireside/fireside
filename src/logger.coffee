pad = require 'pad'
colour = require 'colour'

class LoggingController
	constructor: (opts) ->
		opts ?= {}
		@appenders = opts.appenders ? [new MemListAppender, new ConsoleAppender]
		@loggers = {}

	write: (logger, data, opts) ->
		log = 
			data: data
			timestamp: new Date()
			name: logger.name
			level: opts.level

		appender.write(log) for appender in @appenders

	logger: (name, opts) -> 
		@loggers[name] ?= new Logger @, name, opts
		return @loggers[name]

	l: (name, opts) -> @logger(name, opts)

class Logger
	constructor: (@controller, @name, @conf) ->
		alias = (name) => 
			f = (data, opts) => 
				opts ?= {}
				opts.level = name
				@log(data, opts)
			@[name] = f
		alias(n) for n in 'error warn info debug trace'.split ' '

	log: (data, opts) ->
		opts ?= {}
		opts.level = opts.level or 'log'
		@controller.write(@, data, opts)

	logger: (name, opts) -> @controller.logger("#{@name}:#{name}")
	l: (name, opts) -> @logger(name, opts)
	adapt: =>
		l = (level) =>
			return =>
				@log arguments,
					level: name
		return {
			log: l('debug')
			error: l('error')
		}
			


class Appender
	write: (log) ->

class MemListAppender
	constructor: (opts) ->
		opts ?= {}
		@data = opts.data
		@logs = []

	write: (log) -> @logs.push log

	export: -> 
		logs: @logs
		data: @data

class ConsoleAppender
	@map = 
		error: 'error'
		debug: 'log'
		info: 'info'
		warn: 'warn'
		trace: 'log'
		log: 'log'

	constructor: (opts) ->
	format: (log) -> 
		time = log.timestamp.toTimeString().split(' ')[0]
		return ["#{time} #{pad(log.level.toUpperCase(), 5)} %c#{log.name}", 'color: purple; font-weight: bold;']
	write: (log) -> 
		fn = console[ConsoleAppender.map[log.level or 'debug']]
		fn.apply(console, @format(log).concat(log.data))

module.exports = LoggingController
