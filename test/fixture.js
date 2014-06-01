'use strict';

var chai = require('chai'),

  sandbox;

chai.use(require('sinon-chai'));
chai.use(require('chai-as-promised'));

global.expect = chai.expect;
global.sinon = require('sinon');
global.sandbox = null;
global.RequireSubvert = require('require-subvert');

global.fixture = {
  beforeEach: function beforeEach() {
    global.sandbox = sandbox = sinon.sandbox.create();
  },
  afterEach: function afterEach() {
    global.sandbox = sandbox.restore();
  }
};

