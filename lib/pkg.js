'use strict';
/**
 * Facilities for interacting with Bower packages and their versions
 * @module lib/pkg
 * @requires lib/store
 * @requires lib/config
 * @requires lib/bower
 * @requires lib/util
 * @requires util.format
 * @requires "lodash-node"
 * @requires q
 * @requires path
 * @requires rimraf
 *
 */

var format = require('util').format,
  _ = require('lodash-node'),
  Q = require('q'),
  path = require('path'),
  join = path.join,
  rimraf = Q.nfbind(require('rimraf')),
  semver = require('semver'),
  argumenter = require('argumenter'),

  log = require('lib/logger'),
  store = require('lib/store'),
  config = require('lib/config'),
  util = require('lib/util'),
  adapter = config.adapter,
  normalize = adapter.normalize,
  denormalize = adapter.denormalize,
  all = util.all,
  makeEndpoint = util.normalize;

/**
 * A valid SemVer version string.  See {@link http://semver.org}
 * @typedef {String} SemVer
 */

/**
 * A valid SemVer package string.  See {@link http://semver.org}
 * @typedef {String} SemVerPkg
 */

/**
 * Describes a package.
 * @property {String} name The name of the package
 * @property {SemVer} [version=*] The version of the package.  If omitted, all available versions, depending on the prerelease flag.
 * @property {SemVerPkg} [endpoint=]
 * @constructor
 */
var Pkg = function Pkg() {
  var endpointify = this.endpointify.bind(this),
    semverify = this.semverify.bind(this),
    defaultify = this.defaultify.bind(this);

  argumenter(Pkg)
    .when(String, endpointify)
    .when([String, String], function (name, ver) {
      semverify(ver);
      endpointify(name);
    })
    .when(Object, function (o) {
      semverify(o.version || o.versions || o.ver);
      endpointify(o.name || o.package);
    })
    .done();

  defaultify();

};

Pkg.prototype.defaultify = function defaultify() {
  _.defaults(this, {
    inclusive: config.inclusive,
    prerelease: config.prerelease,
    _state: {},
    _dependencies: [],
    _available_versions: [],
    _target_versions: []
  });
};

Pkg.splitify = function splitify(endpoint) {
  return denormalize(endpoint).split('@');
};

Pkg.prototype.endpointify = function endpointify(name) {
  var tuple;
  if (!name) {
    throw new Error('package must have a name');
  }
  tuple = Pkg.splitify(name);
  if (semver.validPackage(denormalize(name))) {
    this.endpoint = normalize(name);
    this.name = tuple[0];
    this.version = tuple[1];
  } else if (this.version) {
    this.endpoint = normalize(name, this.version);
    this.name = name;
  } else {
    this.endpoint = normalize(name, '*');
    this.name = name;
  }
};

Pkg.prototype.semverify = function semverify(ver) {
  if (!ver) {
    return;
  }
  if (semver.valid(ver)) {
    this.version = semver.clean(ver);
  } else if (semver.validRange(ver)) {
    this.version = ver;
  }
  else {
    throw new Error('invalid version; must conform to SemVer specification; http://semver.org');
  }
};

Pkg.prototype.save = function save(version) {
  var pkg = this,
    name = pkg.name;
  version = version || this.version;

  return store.inStock(this, version)
    .then(function () {
      log.info('Package "%s": Found in cache.', name);
      // XXX
      return Q(pkg);
    }, function () {
//      endpoints = _(opts.includes)
//        .map(function (include) {
//          return store.includes[include][endpoint];
//        })
//        .concat(endpoint)
//        .compact()
//        .value();
//
//      if (endpoints.length > 1) {
//        log.debug('Package "%s": Installing %s', name,
//          _.map(endpoints, function (endpoint) {
//            return format('"%s"', endpoint);
//          })
//            .join(', '));
//      } else {
//        log.debug('Package "%s": Installing "%s"', name,
//          endpoint);
//      }

      return this.trash()
        .then(function () {
          return bower.save(endpoints, {},
            {directory: config.endpoints_dir_path, cwd: '/'});
        })
        .then(function (installed) {
          return all(installed, function (info, installed_name) {
            var installed_version = info.pkgMeta.version;
            log.notice('Package "%s": Installed "%s"', name,
              makeEndpoint(installed_name, installed_version));
            return store.shelve(installed_name, installed_version, name,
              this);
          }, this);
        }.bind(this))
        .then(function () {
          return _.extend(this, {version: version});
        }.bind(this));
    }.bind(this));
};

Pkg.prototype.trash = function trash() {
  var name = this.name,
    dest = opts.dest,
    includes = opts.includes;
  return rimraf(join(dest, name))
    .then(function () {
      log.info('Package "%s": Trashed', name);
      return all(includes, function (include) {
        return rimraf(join(dest, include))
          .then(function () {
            log.info('Package "%s": Trashed dependency "%s"',
              name, include);
          });
      });
    });
};


Pkg.prototype.reconcileTargets = function reconcileTargets() {
  var satisfied_versions = {},
    target_versions,
    available_versions = this._available_versions;

  log.debug('Package "%s": Reconciling required versions...',
    this.name);

  _.each(this.versions, function (version) {
    // if we already have picked all available versions, just stop
    if (_.keys(satisfied_versions).length === available_versions.length) {
      return;
    }
    // if you say '*' anywhere as a version, assume this means "all" versions
    // so set them all true.
    if (version === '*') {
      return (satisfied_versions = _.object(available_versions,
        _.map(new Array(available_versions.length), function () {
          return true;
        })));
    }
    // otherwise, check semver to see if an available v. satisfies the reqs.
    _.each(available_versions, function (a_version) {
      satisfied_versions[a_version] = semver.satisfies(a_version, version);
    });
  });
  this._target_versions =
    target_versions = _.filter(satisfied_versions, function (satisfied) {
      return satisfied;
    });
  if (!target_versions.length) {
    return Q.reject(format('Package "%s": No versions matching "%s"',
      this.name, this.versions));
  }
  return Q(target_versions);
};

Pkg.prototype.getAvailableVersions =
  function getAvailableVersions(prerelease) {
    var name = this.name;
    prerelease = _.isUndefined(prerelease) ? opts.prerelease : prerelease;
    return bower.info(name)
      .then(function (data) {
        var available_versions = prerelease ? data.versions :
          _.filter(data.versions, function (version) {
            return !_.contains(version, '-');
          });
        this._latest_version = available_versions[0];
        log.info('Package "%s": Found %d available versions...',
          name, available_versions.length);
        return (this._available_versions = available_versions);
      }.bind(this));
  };

Pkg.prototype.matchDependencies = function matchDependencies() {
  if (opts.includes.length) {
    log.notice('Matching dependencies for includes, please wait...');
  }
  return all(opts.includes, function (include) {
    return Pkg.prototype.getAvailableVersions.apply({name: include})
      .then(function (available_versions) {
        return all(available_versions, function (a_version, i) {
          var includes = store.includes,
            dep_map = includes[include],
            endpoint = makeEndpoint(include, a_version);
          // XXX
          if (!dep_map) {
            includes[include] = dep_map = {};
          }
          if (!dep_map[endpoint]) {
            return bower.info(endpoint)
              .then(function (data) {
                var deps = data.dependencies,
                  o;
                if (deps) {
                  _.extend(includes[include], _(deps)
                    .map(function (version, dep) {
                      return makeEndpoint(dep, version);
                    })
                    .object(_.map(new Array(deps.length), function () {
                      return endpoint;
                    }))
                    .value());
                } else if (data.name !== include) {
                  o = {};
                  o[endpoint] = format('%s#*', data.name);
                  _.extend(includes[include], o);
                }
              })
              .then(function () {
                log.info('Package "%s": Matched dependencies for version %d/%d',
                  include, i + 1, available_versions.length);
              });
          } else {
            return Q(includes[include][endpoint]);
          }
        });
      })
      .then(function () {
        return store.stock();
      });
  });
};

Pkg.prototype.prepare = function prepare() {
  var pkg = this;
  return pkg.getAvailableVersions()
    .then(function () {
      return pkg.reconcileTargets();
    })
    .then(function () {
      return pkg.matchDependencies();
    }).
    then(function () {
      return store.stock(pkg);
    });
};

return Pkg;


