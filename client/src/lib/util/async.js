export function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms))
}

export function sleepUntilTrue(cond, every=50) {
    return new Promise((resolve) => {
        let _t = setInterval(() => {
            if (cond()) {
                clearInterval(_t);
                resolve();
            }
        }, every);
    });
}

export function eventEmitted(obj, name) {
    return new Promise(resolve => obj.on(name, (...args) => resolve(args)));
}