const LEVELS_MAP = { 
    error: 'error',
    debug: 'log',
    info: 'info',
    warn: 'warn',
    trace: 'log',
    log: 'log'
};

export default class ConsoleAppender {
    format(log) { 
        let time = log.timestamp.toTimeString().split(' ')[0];
        return [`${time} ${pad(log.level.toUpperCase(), 5)} %c${log.name}`, 'color: purple; font-weight: bold;'];
    }
    write(log) { 
        let fn = console[LEVELS_MAP[log.level || 'debug']];
        return fn.apply(console, this.format(log).concat(log.data));
    }
}