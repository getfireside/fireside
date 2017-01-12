/**
 * Tiny logging class.
 */
class Logger {
    /**
     * @param  {LoggingController} [controller] - creates a console-based one if not provided
     * @param  {string} [name] - what to call this logger, if anything. 
     */
    constructor(controller, name) {
        this.controller = controller || new LoggingController();
        this.name = name;

        // Generate some sugary aliases of the log method
        this._generateAliases()
        let alias = (name) => { 
            let f = (data, opts) => { 
                if (opts == null) { opts = {}; }
                opts.level = name;
                return this.log(data, opts);
            };
            return this[name] = f;
        };
        for (let n of 'error warn info debug trace'.split(' ')) { 
            alias(n); 
        }
    }

    /**
     * @param  {obj} data - the data to log. Must be JSON serializable.
     * @param  {obj} [opts] - opts to pass through to the controller. Can use this to set the level.
     */
    log(data, opts) {
        if (opts == null) { opts = {}; }
        opts.level = opts.level || 'log';
        return this.controller.write(this, data, opts);
    }
}