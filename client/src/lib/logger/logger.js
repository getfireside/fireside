/**
 * Tiny logging class.
 */
import LoggingController from './controller';

export default class Logger {
    /**
     * @param  {LoggingController} [controller] - creates a console-based one if not provided
     * @param  {string} [name] - what to call this logger, if anything.
     */
    constructor(root, name) {
        if (root instanceof Logger) {
            this.controller = root.controller;
            this.name = root.name + ":" + name;
        }
        else {
            this.controller = root || new LoggingController();
            this.name = name || 'Logger';
        }
    }

    error(...args) {
        return this.writeLog(args, {level: 'error'});
    }
    warn(...args) {
        return this.writeLog(args, {level: 'warn'});
    }
    log(...args) {
        this.writeLog(args, {'level': 'log'});
    }
    info(...args) {
        return this.writeLog(args, {level: 'info'});
    }
    debug(...args) {
        return this.writeLog(args, {level: 'debug'});
    }
    trace(...args) {
        return this.writeLog(args, {level: 'trace'});
    }

    /**
     * @param  {obj} data - the data to log. Must be JSON serializable.
     * @param  {obj} [opts] - opts to pass through to the controller. Can use this to set the level.
     */
    writeLog(data, opts) {
        if (opts == null) { opts = {}; }
        opts.level = opts.level || 'log';
        return this.controller.write(this, data, opts);
    }
}