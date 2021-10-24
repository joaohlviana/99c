'use strict';

/**
 * @template T
 * @typedef {import('@strapi/strapi').DeepPartial<T>} DeepPartial<T>
 */
/**
 * @typedef {import('@strapi/strapi').StrapiConfig} StrapiConfig
 */

const os = require('os');
const path = require('path');
const _ = require('lodash');
const { omit } = require('lodash/fp');
const dotenv = require('dotenv');

dotenv.config({ path: process.env.ENV_PATH });

process.env.NODE_ENV = process.env.NODE_ENV || 'development';

const loadConfigDir = require('./config-loader');
const loadFunction = require('./load-functions');

const { version: strapiVersion } = require(path.join(__dirname, '../../../package.json'));

const CONFIG_PATHS = {
  config: 'config',
  static: 'public',
  views: 'views',
};

const defaultConfig = {
  server: {
    host: process.env.HOST || os.hostname() || 'localhost',
    port: parseInt(process.env.PORT || '', 10) || 1337,
    proxy: false,
    cron: { enabled: false },
    admin: { autoOpen: false },
  },
  admin: {},
};

/**
 * @param {string} dir
 * @param {{
 *  autoReload?: boolean
 *  serveAdminPanel?: boolean
 * }} initialConfig
 * @returns {StrapiConfig}
 */
module.exports = (dir, initialConfig = {}) => {
  const { autoReload = false, serveAdminPanel = true } = initialConfig;

  const pkgJSON = require(path.resolve(dir, 'package.json'));

  const configDir = path.resolve(dir || process.cwd(), 'config');

  const rootConfig = {
    launchedAt: Date.now(),
    paths: CONFIG_PATHS,
    serveAdminPanel,
    autoReload,
    environment: process.env.NODE_ENV,
    uuid: _.get(pkgJSON, 'strapi.uuid'),
    packageJsonStrapi: _.omit(_.get(pkgJSON, 'strapi', {}), 'uuid'),
    info: {
      ...pkgJSON,
      strapi: strapiVersion,
    },
    functions: loadFunction(path.join(configDir, 'functions')),
  };

  const baseConfig = omit('plugins', loadConfigDir(configDir)); // plugin config will be loaded later

  const envDir = path.resolve(configDir, 'env', process.env.NODE_ENV || '');
  const envConfig = loadConfigDir(envDir);

  // @ts-ignore
  return _.merge(rootConfig, defaultConfig, baseConfig, envConfig);
};
