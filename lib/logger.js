/**
 *
 * @module logger
 */

'use strict';

var config = require('lib/config'),
  Log = require('log'),

  log;

log = new Log(config.log_level);

module.exports = log;
