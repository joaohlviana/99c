'use strict';

/**
 * UsersPermissions.js controller
 *
 * @description: A set of functions called "actions" of the `users-permissions` plugin.
 */

const path = require('path');
const fs = require('fs');

const _ = require('lodash');
const { logger } = require('strapi-utils')

module.exports = {

  /**
   * Default action.
   *
   * @return {Object}
   */
  createRole: async (ctx) => {
    if (_.isEmpty(ctx.request.body)) {
      return ctx.badRequest(null, [{ messages: [{ id: 'Cannot be empty' }] }]);
    }

    try {
      await strapi.plugins['users-permissions'].services.userspermissions.createRole(ctx.request.body);

      ctx.send({ ok: true });
    } catch(err) {
      logger.error(JSON.stringify(err));
      ctx.badRequest(null, [{ messages: [{ id: 'An error occured' }] }]);
    }
  },

  deleteProvider: async ctx => {
    const { provider } = ctx.params;

    if (!provider) {
      return ctx.badRequest(null, [{ messages: [{ id: 'Bad request' }] }]);
    }

    // TODO handle dynamic
    ctx.send({ ok: true });
  },

  deleteRole: async ctx => {
    // Fetch root and guest role.
    const [root, guest] = await Promise.all([
      strapi.query('role', 'users-permissions').findOne({ type: 'root' }),
      strapi.query('role', 'users-permissions').findOne({ type: 'guest' })
    ]);

    const rootID = root.id || root._id;
    const guestID = guest.id || guest._id;

    const roleID = ctx.params.role;

    if (!roleID) {
      return ctx.badRequest(null, [{ messages: [{ id: 'Bad request' }] }]);
    }

    // Prevent from removing the root role.
    if (roleID.toString() === rootID.toString() || roleID.toString() === guestID.toString()) {
      return ctx.badRequest(null, [{ messages: [{ id: 'Unauthorized' }] }]);
    }

    try {
      await strapi.plugins['users-permissions'].services.userspermissions.deleteRole(roleID, guestID);

      ctx.send({ ok: true });
    } catch(err) {
      logger.error(JSON.stringify(err));
      ctx.badRequest(null, [{ messages: [{ id: 'Bad request' }] }]);
    }
  },

  getPermissions: async (ctx) => {
    try {
      const { lang } = ctx.query;
      const plugins = await strapi.plugins['users-permissions'].services.userspermissions.getPlugins(lang);
      const permissions = await strapi.plugins['users-permissions'].services.userspermissions.getActions(plugins);

      ctx.send({ permissions });
    } catch(err) {
      logger.error(JSON.stringify(err));      
      ctx.badRequest(null, [{ message: [{ id: 'Not Found' }] }]);
    }
  },

  getPolicies: async (ctx) => {
    ctx.send({
      policies: _.without(_.keys(strapi.plugins['users-permissions'].config.policies), 'permissions')
    });
  },

  getRole: async (ctx) => {
    const { id } = ctx.params;
    const { lang } = ctx.query;
    const plugins = await strapi.plugins['users-permissions'].services.userspermissions.getPlugins(lang);
    const role = await strapi.plugins['users-permissions'].services.userspermissions.getRole(id, plugins);

    if (_.isEmpty(role)) {
      return ctx.badRequest(null, [{ messages: [{ id: `Role does not exist` }] }]);
    }

    ctx.send({ role });
  },

  getRoles: async (ctx) => {
    try {
      const roles = await strapi.plugins['users-permissions'].services.userspermissions.getRoles();

      ctx.send({ roles });
    } catch(err) {
      logger.error(JSON.stringify(err));      
      ctx.badRequest(null, [{ messages: [{ id: 'Not found' }] }]);
    }
  },

  getRoutes: async (ctx) => {
    try {
      const routes = await strapi.plugins['users-permissions'].services.userspermissions.getRoutes();

      ctx.send({ routes });
    } catch(err) {
      logger.error(JSON.stringify(err));     
      ctx.badRequest(null, [{ messages: [{ id: 'Not found' }] }]);
    }
  },

  index: async (ctx) => {
    // Add your own logic here.

    // Send 200 `ok`
    ctx.send({
      message: 'ok'
    });
  },

  init: async (ctx) => {
    const role = await strapi.query('role', 'users-permissions').findOne({ type: 'root' }, ['users']);

    ctx.send({ hasAdmin: !_.isEmpty(role.users) });
  },

  searchUsers: async (ctx) => {
    const data = await strapi.query('user', 'users-permissions').search(ctx.params);

    ctx.send(data);
  },

  updateRole: async function (ctx) {
    // Fetch root role.
    const root = await strapi.query('role', 'users-permissions').findOne({ type: 'root' });

    const roleID = ctx.params.role;
    const rootID = root.id || root._id;

    // Prevent from updating the root role.
    if (roleID === rootID) {
      return ctx.badRequest(null, [{ messages: [{ id: 'Unauthorized' }] }]);
    }

    if (_.isEmpty(ctx.request.body)) {
      return ctx.badRequest(null, [{ messages: [{ id: 'Bad request' }] }]);
    }

    try {
      await strapi.plugins['users-permissions'].services.userspermissions.updateRole(roleID, ctx.request.body);

      ctx.send({ ok: true });
    } catch(err) {
      logger.error(JSON.stringify(err));
      ctx.badRequest(null, [{ messages: [{ id: 'An error occurred' }] }]);
    }
  },

  getEmailTemplate: async (ctx) => {
    ctx.send(strapi.plugins['users-permissions'].config.email);
  },

  updateEmailTemplate: async (ctx) => {
    if (_.isEmpty(ctx.request.body)) {
      return ctx.badRequest(null, [{ messages: [{ id: 'Cannot be empty' }] }]);
    }

    strapi.reload.isWatching = false;

    fs.writeFileSync(path.join(strapi.config.appPath, 'plugins', 'users-permissions', 'config', 'email.json'), JSON.stringify({
      email: ctx.request.body
    }, null, 2), 'utf8');

    ctx.send({ ok: true });

    strapi.reload();
  },

  getAdvancedSettings: async (ctx) => {
    ctx.send(strapi.plugins['users-permissions'].config.advanced);
  },

  updateAdvancedSettings: async (ctx) => {
    if (_.isEmpty(ctx.request.body)) {
      return ctx.badRequest(null, [{ messages: [{ id: 'Cannot be empty' }] }]);
    }

    strapi.reload.isWatching = false;

    fs.writeFileSync(path.join(strapi.config.appPath, 'plugins', 'users-permissions', 'config', 'advanced.json'), JSON.stringify({
      advanced: ctx.request.body
    }, null, 2), 'utf8');

    ctx.send({ ok: true });

    strapi.reload();
  },

  getProviders: async (ctx) => {
    ctx.send(strapi.plugins['users-permissions'].config.grant);
  },

  updateProviders: async (ctx) => {
    if (_.isEmpty(ctx.request.body)) {
      return ctx.badRequest(null, [{ messages: [{ id: 'Cannot be empty' }] }]);
    }

    strapi.reload.isWatching = false;

    fs.writeFileSync(path.join(strapi.config.appPath, 'plugins', 'users-permissions', 'config', 'grant.json'), JSON.stringify({
      grant: ctx.request.body
    }, null, 2), 'utf8');


    ctx.send({ ok: true });

    strapi.reload();
  }
};
