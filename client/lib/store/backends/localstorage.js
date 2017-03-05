import uuid from 'uuid/v4';
import store from 'store';

class LocalStorageBackend() {
    newUUID() {
        return uuid()
    }
    create(data, collection) {
        let id = this.newUUID();
        store.set(`${collection}:${id}`, data);
        store.transact(collection, (v) => {
            if (v === undefined) {
                v = [];
            }
            v.push(id);
        })
        data.id = id;
        return data;
    }

    update(data, collection) {
        let d = _.cloneDeep(data);
        delete d.id;
        if ! _.includes(store.get(collection), data.id) {
            store.transact(collection, (v) => {
                if (v === undefined) {
                    v = [];
                }
                v.push(id);
            })
        }
        return store.set(`${collection}:${id}`, d);
    }

    setKey(name, value, collection) {
        return store.set(`${collection}:${name}`, value);
    }

    getKey(name, collection) {
        return store.get(`${collection}:${name}`);
    }

    get(id, collection) {
        let res = store.get(`${collection}:${id}`);
        res.id = id;
        return res;
    }

    delete(id, collection) {
        store.remove(`${collection}:${id}`);
        store.transact(collection, (v) => {
            if (v) {
                _.pull(v, id);
            }
        })
    }

    getAll(collection) {
        let ids = store.get(`${collection}`);
        return _.map((id) => this.get(id, collection), ids);
    }
}