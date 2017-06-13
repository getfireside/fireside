export default class MemoryAppender {
    constructor(opts) {
        if (opts == null) { 
            opts = {}; 
        }
        this.data = opts.data;
        this.logs = [];
    }

    write(log) { 
        return this.logs.push(log); 
    }

    export() { 
        return {
            logs: this.logs,
            data: this.data
        };
    }
}