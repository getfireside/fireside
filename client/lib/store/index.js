import LocalStorageBackend from './backends/localstorage';

class StoreCollection() {
    constructor(name, store) {
        this.name = name;
        this.store = store;
    }
    create(data) {
        return this.store.create(data, this);
    }

    update(id, data) {
        return this.store.update(id, data, this);
    }

    get(id) {
        return this.store.get(id, this);
    }

    delete(id) {
        return this.store.delete(id, this);
    }

    getAll() {
        return this.store.getAll(this);
    }

    getKey(name) {
        return this.store.getKey(name);   
    }

    setKey(name, value) {
        return this.store.setKey(name, value);
    }
}

class Store() {
    constructor(config) {
        if (config == null) {
            config = {};
        }
        for (let collectionName of this.config.collections) {
            this.collections[collectionName] = this[collectionName] = new StoreCollection(name, this);
        }
        this.defaultBackend = config.backend || new LocalStorageBackend();
        this.backends = config.backends || {};
    }

    backendForCollection(collection) {
        return this.backends[collection.name] || defaultBackend;
    }

    create(data, collection) {
        return this.backendForCollection(collection).create(data, collection.name);
    }

    update(id, data, collection) {
        return this.backendForCollection(collection).update(id, data, collection.name);
    }

    get(id, collection) {
        return this.backendForCollection(collection).get(id, collection.name);
    }

    getKey(name, collection) {
        return this.backendForCollection(collection).getKey(name, collection.name);   
    }

    setKey(name, value, collection) {
        return this.backendForCollection(collection).setKey(name, value, collection.name);
    }

    delete(id, collection) {
        return this.backendForCollection(collection).delete(id, collection.name);
    }

    getAll(collection) {
        return this.backendForCollection(collection).getAll(collection.name);
    }
}