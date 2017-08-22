import FiresideApp from 'app';
import Raven from 'raven-js';

window.Raven = Raven;

window.initializeApp = async ({element, roomData, opts}) => {
    let app = new FiresideApp({roomData, opts});
    app.connectUI(element);
    app.roomController.initialize();
    return app;
}