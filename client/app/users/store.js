import User from './model';

class UserManager extends Manager {
    static get modelClass() { return User; }
    set self(m) {
        this.collection.setKey('self', m.id);
    }
    get self() {
        return this.get(this.collection.getKey('self'));
    }
}