export function on(eventSelector) {
    return function(target, name, descriptor) {
        descriptor.eventSelector = eventSelector;
    }  
}

export function bindActionsToObject(actions, object, mapper = (x) => object[x]) {
    for (let name of actions) {
        let action = actions[name];
        let eventSelector = actions[name].eventSelector;
        let [root, rest] = eventSelector.split(':', 1);
        mapper(root).on(rest, action);
    }
}