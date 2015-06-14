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
		opts.level ?= 'log'
		@controller.write(@, data, opts)

	logger: (name, opts) -> @controller.logger("#{@name}:#{name}")
	l: (name, opts) -> @logger(name, opts)

class Appender
	write: (log) ->

class MemListAppender
	constructor: (opts) ->
		opts ?= {}
		@data = opts.data
		@logs = []

	write: (log) -> @logs.push log

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
		return "#{time} #{log.name} #{log.level?.toUpperCase()}"
	write: (log) -> console[ConsoleAppender.map[log.level or 'debug']](@format(log), log.data)

module.exports = LoggingController
