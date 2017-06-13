import _ from 'lodash';
import {observable, action} from 'mobx';

export default class Store {
    @action
    update(updates = []) {
        _.each(updates, (update) => {
            let rec = this.get(update.id);
            if (rec) {
                _.extend(rec, update);
            }
            else {
                this.create(update);
            }
        });
    }
}

export class ListStore extends Store {
    @observable items = [];

    @action
    create(data) {
        const item = this.createItemInstance(data);
        this.items.push(item);
        return item;
    }

    get(id) {
        return _.find(this.items, item => item.id === id);
    }

    @action
    delete(id) {
        this.items = _.filter(this.items, (x) => x.id !== id);
    }
}

export class MapStore extends Store {
    @observable items = observable.map();

    @action
    create(data) {
        const item = this.createItemInstance(data);
        this.items.set(item.id, item);
    }

    @action
    delete(id) {
        this.items.delete(id);
    }

    get(id) {
        return this.items.get(id);
    }
}