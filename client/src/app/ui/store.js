import {observable, action} from 'mobx';

export default class UIStore {
    @observable localMediaPromptShowing = false;
    @observable fsPromptShowing = false;
    @observable configModalShowing = false;
    @observable.ref editModalMember = null;
    @observable filesDrawer = {
        selectedMember: null,
        isOpen: false
    };
    constructor({app}) {
        this.app = app;
        this.app.fs.on('promptOpen', action(() => this.fsPromptShowing = true));
        this.app.fs.on('promptClosed', action(() => this.fsPromptShowing = false));
    }
    @action openConfigModal() {
        this.configModalShowing = true;
    }
    @action closeConfigModal() {
        this.configModalShowing = false;
    }
    @action showEditNameModal(member) {
        this.editModalMember = member;
    }
    @action closeEditNameModal() {
        this.editModalMember = null;
    }
}