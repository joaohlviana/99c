'use strict';

/**
 * @typedef {import('@strapi/strapi').StrapiAppContext} StrapiAppContext
 */

const { validateProfileUpdateInput } = require('../validation/user');
const { getService } = require('../utils');

module.exports = {
  /**
   * @param {StrapiAppContext} ctx
   */
  async getMe(ctx) {
    const userInfo = getService('user').sanitizeUser(ctx.state.user);

    ctx.body = {
      data: userInfo,
    };
  },

  /**
   * @param {StrapiAppContext} ctx
   */
  async updateMe(ctx) {
    const input = ctx.request.body;

    try {
      await validateProfileUpdateInput(input);
    } catch (err) {
      return ctx.badRequest('ValidationError', err);
    }

    const userService = getService('user');
    const authServer = getService('auth');

    const { currentPassword, ...userInfo } = input;

    if (currentPassword && userInfo.password) {
      const isValid = await authServer.validatePassword(currentPassword, ctx.state.user.password);

      if (!isValid) {
        return ctx.badRequest('ValidationError', {
          currentPassword: ['Invalid credentials'],
        });
      }
    }

    const updatedUser = await userService.updateById(ctx.state.user.id, userInfo);

    ctx.body = {
      data: userService.sanitizeUser(updatedUser),
    };
  },

  /**
   * @param {StrapiAppContext} ctx
   */
  async getOwnPermissions(ctx) {
    const { findUserPermissions, sanitizePermission } = getService('permission');
    const { user } = ctx.state;

    const userPermissions = await findUserPermissions(user);

    ctx.body = {
      data: userPermissions.map(sanitizePermission),
    };
  },
};
