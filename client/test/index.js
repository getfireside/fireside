import sinon from 'sinon';
import chai from 'chai';
import sinonChai from "sinon-chai";
import subset from 'chai-subset';
window.sinon = sinon;
window.chai = chai;

chai.use(sinonChai);
chai.use(subset);

window.expect = chai.expect;
window.should = chai.should;

import * as fixtures from './fixtures.js';
window.fixtures = fixtures;

var context = require.context('.', true, /.spec.js(x?)$/); //make sure you have your directory and regex test set correctly!
context.keys().forEach(context);