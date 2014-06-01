'use strict';
/**
 * Convenience methods for dealing w/ Bower.
 * @module lib/bower
 */

var commands = require('bower').commands,
  Q = require('q'),
  format = require('util').format,
  argumenter = require('argumenter'),
  log = require('lib/logger').log,
  _ = require('lodash-node'),

  NORMALIZE_RE = /[#@]/;

var _wrapEE = function _wrapEE(cmd) {
  return function command() {
    var dfrd = Q.defer();
    cmd.apply(null, arguments)
      .on('end', function (res) {
        dfrd.resolve(res);
      })
      .on('error', function (err) {
        dfrd.reject(err);
      });
    return dfrd.promise;
  };
};

var bower = function bower(cmd) {
  var command = bower[cmd],
    args = _.toArray(arguments).slice(1);
  if (!command) {
    log.fatal('unknown Bower command: %s', cmd);
  }
  return cmd.apply(null, args);
};

_.each(commands, function (fn, name) {
  bower[name] = _wrapEE(fn);
});

bower._wrapEE = _wrapEE;
bower.normalize = function normalize() {
  return argumenter(normalize)
    .when([String, String], function (name, version) {
      return format('%s#%s', name.split(NORMALIZE_RE)[0], version);
    })
    .when(String, _.memoize(function (name) {
      var tuple = name.split(NORMALIZE_RE);
      return tuple.length > 1 ? tuple.join('#') : tuple[0];
    }))
    .done();
};
bower.denormalize = _.memoize(function denormalize(endpoint) {
  return endpoint.replace('#', '@');
});

module.exports = bower;
