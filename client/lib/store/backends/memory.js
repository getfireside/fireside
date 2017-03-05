import uuid from 'uuid/v4';

class MemoryBackend() {
    constructor() {
        this.data = {};
    }
    newUUID() {
        return uuid()
    }
    create(data, collection) {
        let id = this.newUUID();
        this.data[`${collection}:${id}`] = data;
        let items = this.data[collection];
            if (items === undefined) {
                items = [];
            }
            items.push(id);

        data.id = id;
        return data;
    }

    update(data, collection) {
        let d = _.cloneDeep(data);
        let id = data.id;
        delete d.id;
        if (!_.includes(this.data[collection], id)) {
            this.data[collection].push(id);
        }
        return store.set(`${collection}:${id}`, d);
    }

    setKey(name, value, collection) {
        this.data[`${collection}:${name}` = value;
    }

    getKey(name, collection) {
        return this.data[`${collection}:${name}`;
    }

    get(id, collection) {
        let res = this.data[`${collection}:${id}`];
        res.id = id;
        return res;
    }

    delete(id, collection) {
        delete this.data[`${collection}:${id}`];
        this.data[collection] = this.data[collection] && _.without(this.data[collection], id);
    }

    getAll(collection) {
        let ids = this.data[collection];
        return _.map((id) => this.get(id, collection), ids);
    }
}