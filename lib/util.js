'use strict';
/**
 * General utility functions
 * @module lib/util
 */

var Q = require('q'),
  _ = require('lodash-node'),
  format = require('util').format;

// http://stackoverflow.com/questions/17217736/while-loop-with-promises
var loop = function loop(promise, fn) {
  return promise.then(fn)
    .then(function (wrapper) {
      return !wrapper.done ? loop(Q(wrapper.value), fn) : wrapper.value;
    });
};

var makeEndpoint = function makeEndpoint(name, version) {
  if (_.isObject(name)) {
    name = name.name;
  }
  return format('%s#%s', name, version);
};

var all = function all(collection, callback, ctx) {
  return Q.all(_.map(collection, callback.bind(ctx)));
};

module.exports = {
  all: all,
  makeEndpoint: makeEndpoint,
  loop: loop
};
