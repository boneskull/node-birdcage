'use strict';
/**
 * Filesystem-based package data store.
 * @module lib/store
 */

var config = require('lib/config'),
_ = require('lodash-node'),
pkg = require('lib/pkg'),
fs = require('graceful-fs'),
Q = require('q'),
path = require('path'),
join = path.join,
exists = Q.nfbind(fs.exists),
rename = Q.nfbind(fs.rename),
rimraf = Q.nfbind(require('rimraf')),
mkdir = Q.nfbind(fs.mkdir),
symlink = Q.nfbind(fs.symlink),
format = require('util').format,
util = require('lib/util'),
all = util.all,
ncp = Q.nfbind(require('ncp').ncp),
makeEndpoint = util.normalize,
glob = Q.nfbind(require('glob')),

COMPAT = require(join('..', 'package.json')).version,

/**
 * Singleton instance of Store class.
 * @type module:lib/store.Store
 */
store;

/**
 * Handles the package store.
 * @param {Object} [inventory] Store data (contents of bowerspawn.json)
 * @property {Object} includes Mapping of included packages to any dependencies they may have.
 * @property {Object} packages Pkg objects
 * @memberof module:lib/store
 * @constructor
 */
var Store = function Store(inventory) {
  _.extend(this, _.defaults(inventory, {
    compat: COMPAT,
    includes: {}
  }));
};

Store.prototype.renovate = function renovate() {
  if (this.compat < COMPAT) {
    // for future use; if we need to upgrade the store
  }
};

/**
 *
 * @returns {Promise}
 */
Store.prototype.clean = function clean() {
  return glob('!(*#*)',
    {
      cwd: config.endpoints_dir_path,
      nonegate: true
    })
    .then(function (dirpaths) {
      return all(dirpaths, function (dirpath) {
        return rimraf(join(config.endpoints_dir_path, dirpath))
          .then(function () {
            grunt.log.verbose.ok('Annihilated temp dir "%s"', dirpath);
          });
      });
    });
};

Store.prototype.stock = function stock() {
  var store = this,
      makeEndpointsDirPath = function makeEndpointsDirPath() {
        return mkdir(config.endpoints_dir_path);
      },
      save = function save() {
        return Q(function () {
          grunt.file.write(config.store_db_path,
            JSON.stringify(store, null, 2));
        });
      };

  return mkdir(config.store_dir_path)
    .then(function () {
      grunt.log.verbose.ok('Created store directory');
      return makeEndpointsDirPath();
    }, makeEndpointsDirPath)
    .then(function () {
      grunt.log.verbose.ok('Created endpoints store directory');
      return save();
    }, save);
};

/**
 * Copies a package from the cache into the destination directory.
 * @param {Object|String} pkg If object, then a Package instance.  If string, an endpoint of form `name#version`.
 * @param {String} [version] Package version
 */
Store.prototype.pick = function pick(pkg, version) {
  var data = Store.endpointify(pkg, version);
  return ncp(data.endpoint_path, data.target_path)
    .then(function () {
      grunt.log.verbose.ok('Package "%s": Provisioned %s', data.name,
        data.endpoint);
      return data.endpoint;
    })
    .then(function (endpoint) {
      return all(opts.includes, function (include) {
        var ep = this.includes[include][endpoint],
            include_data;
        if (!ep) {
          include_data = Store.endpointify(data.name, 'latest');
        } else {
          include_data = Store.endpointify(this.includes[include][endpoint]);
        }
        grunt.log.verbose.writeln(JSON.stringify(include_data));
        return ncp(include_data.endpoint_path, include_data.target_path)
          .then(function () {
            grunt.log.verbose.ok('Copied %s => %s',
              path.basename(include_data.endpoint_path,
                include_data.target_path));
          });
      }, this);
    }.bind(this));
};

Store.prototype.shelve =
  function shelve(name, version, target_endpoint, pkg) {
    var data = Store.endpointify(name, version),
        neuter = function neuter() {
          return rimraf(join(data.endpoint_path, '.bower.json'));
        };
    return Q(function () {
      var o;
      if (target_endpoint) {
        o = {};
        o[target_endpoint] = {};
        o[target_endpoint][name] = version;
        _.extend(this.endpoints, o);
        return this.stock();
      }
    }.bind(this))
      .then(function () {
        return rename(data.temp_path, data.endpoint_path);
      })
      .then(function () {
        var latest_path;
        if (pkg && pkg._latest_version === version) {
          latest_path =
            path.join(config.endpoints_dir_path, format('%s-latest', name));
          return rimraf()
            .then(function () {
              return symlink(data.endpoint_path, latest_path, 'dir');
            })
            .then(function () {
              grunt.log.verbose.ok('Symlinked %s to %s', data.endpoint_path,
                latest_path);
            });
        }
        return Q();
      })
      .then(neuter, function () {
        return rimraf(data.temp_path)
          .then(neuter);
      });
  };

Store.endpointify = function (pkg, version) {
  var name, ep_arr, endpoint;
  if (_.isString(pkg)) {
    ep_arr = pkg.split('#');
    if (ep_arr.length > 1) {
      name = ep_arr[0];
      version = ep_arr[1];
      endpoint = pkg;
    } else {
      name = pkg;
      endpoint = makeEndpoint(name, version);
    }
  } else if (_.isObject(pkg)) {
    name = pkg.name;
    version = version || pkg.version;
    endpoint = makeEndpoint(name, version);
  } else {
    throw new Error('parameters must be an endpoint string, name string and version string, or a Pkg instance and a version string');
  }
  return {
    name: name,
    version: version,
    endpoint: endpoint,
    endpoint_path: join(config.endpoints_dir_path, endpoint),
    temp_path: join(config.endpoints_dir_path, name),
    target_path: join(opts.dest, name)
  };
};

Store.prototype.inStock = function inStock(pkg, version) {
  var data = Store.endpointify(pkg, version),
      in_stock;

  // assert we have all of the include information present
  in_stock = _(pkg.includes)
    .map(function (include) {
      return _.has(this.includes, include);
    }, this)
    .every()
    .value();
  if (!in_stock) {
    return Q.reject();
  }

  return exists(data.endpoint_path)
    .then(function () {
      return all(pkg.includes, function (version, name) {
        var include_data = Store.endpointify(name, version);
        return exists(include_data.endpoint_path);
      });
    });
};

Store.open = function open() {
  return new Store(grunt.file.readJSON(config.store_db_path));
};

if (!store) {
  try {
    store = Store.open();
  } catch (e) {
    store = new Store();
    store.stock();
  }
}

module.exports = store;

