export function on(...eventSelectors) {
    return function(target, key, descriptor) {
        target.__handlers = target.__handlers || {};
        for (let eventSelector of eventSelectors) {
            target.__handlers[eventSelector] = key;
        }
    }
}

export function throttle(time) {
    return (target, key, descriptor) => ({
        ...descriptor,
        value() {
            return _.throttle(descriptor.value, time);
        }
    })
}

export function bindEventHandlers(obj) {
    for (let eventSelector in obj.__handlers) {
        let fn = obj[obj.__handlers[eventSelector]];
        if (fn == null) {
            continue;
        }
        let [source, ...eventParts] = eventSelector.split('.');
        // ugh, it turns out that JS split throws away the string after maxsplits, unlike python.
        // nasty and kludgy.
        let eventName = eventParts.join('.');
        obj[source].on(eventName, fn);
    }
}