class Manager {
    constructor(collection) {
        this.collection = collection;
    }

    model(data) {
        return new this.modelClass(data, this.collection);
    }

    create(data) {
        let id = this.collection.create(data);
        return this.model(data);
    }

    get(id) {
        return this.model(this.collection.get(id));
    }

    delete(id) {
        return this.collection.delete(id);
    }

    getAll() {
        return _.map((o) => this.model(o), this.collection.getAll();
    }
}