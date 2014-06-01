'use strict';
/**
 * @description
 * @module birdcage
 * @requires q
 * @requires "lodash-node"
 * @requires argumenter
 */

var Q = require('q'),
  _ = require('lodash-node'),
  argumenter = require('argumenter'),

  config = require('lib/config'),
  log = require('lib/logger'),
  Pkg = require('lib/pkg'),

  all = require('lib/util').all;

/**
 * Installs package(s) with or without versions.
 * @param pkgs
 * @param opts
 * @returns {Pkg}
 * @param version
 */
var capture = function capture(pkgs, version, opts) {
  var save = function save() {
    var _save = function _save(pkg) {
        return new Pkg(pkg).save();
      },

      assertName = function assertName(pkg) {
        if (!pkg.name) {
          throw new Error('package object requires name property');
        }
      };

    return argumenter(arguments)
      .when([String, String], function (name, version) {
        return _save(_.extend({name: name, version: version}, opts));
      })
      .when([Object, String], function (pkg, version) {
        assertName(pkg);
        pkg.version = version;
        _.defaults(pkg, opts);
        return _save(pkg);
      })
      .when(String, function (name) {
        return _save(_.extend({name: name}, opts));
      })
      .when(Object, function (pkg) {
        assertName(pkg);
        _.defaults(pkg, opts);
        return _save(pkg);
      })
      .done();
  };

  return Q(argumenter(arguments)
    .when([String, String], save)
    .when([Object, String], save)
    .when(String, save)
    .when(Object, save)
    .when(Array, _.partialRight(all, save))
    .when(0, function () {
      throw new Error('expected parameter');
    })
    .done())
    .nodeify();
};

var pluck = function pluck() {

};

var free = function free(name, version) {
};


var scatter = function scatter() {

};

var peek = function peek(name, version) {
};

var birdcage = function birdcage(opts) {
  config.configure(opts);
};

birdcage.capture = birdcage.save = capture;
birdcage.free = birdcage.remove = free;
birdcage.pluck = birdcage.save = pluck;
birdcage.scatter = birdcage.uninstall = scatter;
birdcage.peek = birdcage.contains = peek;

module.exports = birdcage;
