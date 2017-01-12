/**
 * Controller that manages all the logs for an application, and handle where they get written to.
 */
export default class LoggingController {
    /**
     * @param  {obj} [opts] - options
     * @param {list} opts.appenders - a list of appenders. By default, stores the logs in memory and also writes to the console.
     */
    constructor(opts) {
        if (opts == null) { 
            opts = {}; 
        }
        this.appenders = opts.appenders != null ? opts.appenders : [new MemListAppender, new ConsoleAppender];
        this.loggers = {};
    }


    /**
     * Write a log to the appenders.
     * @param  {Logger} logger - the logger that is writing
     * @param  {obj} data - the data to write
     * @param  {obj} [opts] - set options such as the level
     */
    write(logger, data, opts) {
        let log = { 
            data,
            timestamp: new Date(),
            name: logger.name,
            level: opts.level
        };

        return this.appenders.map((appender) => appender.write(log));
    }

    /**
     * Returns the logger with the name provided. 
     * If it doesn't exist, create it with the provided options. 
     * @param  {string} name - what to call the logger
     * @param  {obj} opts - options to be passed through
     * @return {Logger}
     */
    logger(name, opts) { 
        if (this.loggers[name] == null) { 
            this.loggers[name] = new Logger(this, name, opts); 
        }
        return this.loggers[name];
    }

    /**
     * Alias for logger.
     */
    l(name, opts) { 
        return this.logger(name, opts); 
    }
}