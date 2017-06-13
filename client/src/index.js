import FiresideApp from 'app';

window.initializeApp = async ({element, roomData, opts}) => {
    let app = new FiresideApp({roomData, opts});
    app.connectUI(element);
    app.roomController.initialize();
    return app;
}