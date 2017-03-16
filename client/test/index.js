import sinon from 'sinon';
import chai from 'chai';
import sinonChai from "sinon-chai";
window.sinon = sinon;
window.chai = chai;

sinon.behavior = require('sinon/lib/sinon/behavior');
sinon.defaultConfig = {
    injectInto: null,
    properties: ['spy', 'stub', 'mock', 'clock', 'server', 'requests'],
    useFakeTimers: true,
    useFakeServer: true
};
chai.use(sinonChai);

window.expect = chai.expect;
window.should = chai.should;
var context = require.context('.', true, /.spec.js(x?)$/); //make sure you have your directory and regex test set correctly!
context.keys().forEach(context);