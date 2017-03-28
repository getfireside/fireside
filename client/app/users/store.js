import {observable, computed, action} from 'mobx';
import {MapStore} from 'lib/store';

export class User {

}

export default class UserStore extends MapStore {
    @observable selfId;

    @observable test = [];

    constructor(opts = {}) {
        super(opts);
        this.selfId = opts.selfId;
    }

    @computed get self() {
        return this.get(this.selfId);
    }

    createItemInstance(data) {
        return new User({...data, store: this});
    }
}