/**
 * Controller that manages all the logs for an application, and handle where they get written to.
 */
import MemListAppender from './appenders/memory.js';
import ConsoleAppender from './appenders/console.js';
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
    }

    write(logger, data, opts) {
        let log = {
            data,
            timestamp: new Date(),
            name: logger.name,
            level: opts.level
        };

        return this.appenders.map((appender) => appender.write(log));
    }
}