'use strict';

const { defaultsDeep } = require('lodash/fp');
const { convertQueryParams } = require('@strapi/utils');
const { getService } = require('../utils');
const { FOLDER_MODEL_UID } = require('../constants');
const { validateCreateFolder, validateUpdateFolder } = require('./validation/admin/folder');

module.exports = {
  async findOne(ctx) {
    const {
      params: { id },
    } = ctx.request;

    const permissionsManager = strapi.admin.services.permission.createPermissionsManager({
      ability: ctx.state.userAbility,
      model: FOLDER_MODEL_UID,
    });

    await permissionsManager.validateQuery(ctx.query);
    const query = await permissionsManager.sanitizeQuery(ctx.query);

    const { results } = await strapi.db.query(FOLDER_MODEL_UID).findPage(
      convertQueryParams.transformParamsToQuery(
        FOLDER_MODEL_UID,
        defaultsDeep(
          {
            filters: { id },
            populate: {
              children: {
                count: true,
              },
              files: {
                count: true,
              },
            },
          },
          query
        )
      )
    );

    if (results.length === 0) {
      return ctx.notFound('folder not found');
    }

    ctx.body = {
      data: await permissionsManager.sanitizeOutput(results[0]),
    };
  },

  async find(ctx) {
    const permissionsManager = strapi.admin.services.permission.createPermissionsManager({
      ability: ctx.state.userAbility,
      model: FOLDER_MODEL_UID,
    });

    await permissionsManager.validateQuery(ctx.query);
    const query = await permissionsManager.sanitizeQuery(ctx.query);

    const results = await strapi.db.query(FOLDER_MODEL_UID).findMany(
      convertQueryParams.transformParamsToQuery(
        FOLDER_MODEL_UID,
        defaultsDeep(
          {
            populate: {
              children: {
                count: true,
              },
              files: {
                count: true,
              },
            },
          },
          query
        )
      )
    );

    ctx.body = {
      data: await permissionsManager.sanitizeOutput(results),
    };
  },
  async create(ctx) {
    const { user } = ctx.state;
    const { body } = ctx.request;

    await validateCreateFolder(body);

    const folderService = getService('folder');

    const folder = await folderService.create(body, { user });

    const permissionsManager = strapi.admin.services.permission.createPermissionsManager({
      ability: ctx.state.userAbility,
      model: FOLDER_MODEL_UID,
    });

    ctx.created({
      body: {
        data: await permissionsManager.sanitizeOutput(folder),
      },
    });
  },

  async update(ctx) {
    const { user } = ctx.state;
    const {
      body,
      params: { id },
    } = ctx.request;

    const permissionsManager = strapi.admin.services.permission.createPermissionsManager({
      ability: ctx.state.userAbility,
      model: FOLDER_MODEL_UID,
    });

    await validateUpdateFolder(id)(body);

    const folderService = getService('folder');

    const updatedFolder = await folderService.update(id, body, { user });

    if (!updatedFolder) {
      return ctx.notFound('folder not found');
    }

    ctx.body = {
      data: await permissionsManager.sanitizeOutput(updatedFolder),
    };
  },

  async getStructure(ctx) {
    const { getStructure } = getService('folder');

    const structure = await getStructure();

    ctx.body = {
      data: structure,
    };
  },
};
