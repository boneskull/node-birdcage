'use strict';
/**
 * Configuration
 * @module lib/config
 */

var path = require('path'),
  pkg = require('../package.json'),
  _ = require('lodash-node'),

  STORE_DIR_NAME = '.bowerspawn.store',
  ENDPOINTS_DIR_NAME = 'endpoints',
  STORE_DB_NAME = 'bowerspawn.json',
  LOG_LEVEL = 'error',
  PRERELEASE = false,
  INCLUSIVE = true,

  default_config;

var Config = function Config(opts) {
  this.configure(opts);
};

Config.prototype.configure = function configure(opts) {
  _.defaults(this, opts, default_config);
};

default_config = new Config({
  store_dir_path: path.resolve(path.join(__dirname, STORE_DIR_NAME)),
  store_db_path: path.join(__dirname, STORE_DIR_NAME, STORE_DB_NAME),
  endpoints_dir_path: path.join(__dirname, STORE_DIR_NAME,
    ENDPOINTS_DIR_NAME),
  log_level: LOG_LEVEL,
  prerelease: PRERELEASE,
  inclusive: INCLUSIVE,
  adapter: require('./adapters/bower')
});

module.exports = default_config;

