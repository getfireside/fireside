import {observable, action} from 'mobx';

export default class UIStore {
    @observable localMediaPromptShowing = false;
    @observable fsPromptShowing = false;
    constructor({app}) {
        this.app = app;
        this.app.fs.on('promptOpen', action(() => this.fsPromptShowing = true));
        this.app.fs.on('promptClosed', action(() => this.fsPromptShowing = false));
    }
}