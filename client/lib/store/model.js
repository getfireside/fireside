class Model {
    @observable data;
    
    constructor(data) {
        this.data = data;
        this.collection = collection;
        this._setupProps();
    }

    _setupProps() {
        for (let name in this.fields) {
            let propInfo = this.fields[name];
            Object.defineProperty(this, name, {
                get: () => this.fields[name],
                set: (val) => this.fields[name] = val,
                writable: true,
                enumerable: true,
                configurable: false,
            })
        }
    }

    save() {
        this.collection.update(this.data);
    }
}