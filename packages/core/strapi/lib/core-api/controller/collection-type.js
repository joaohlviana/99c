'use strict';

/**
 * @typedef {import('@strapi/strapi').StrapiAppContext} StrapiAppContext
 */

const { parseBody } = require('./transform');

/**
 *
 * Returns a collection type controller to handle default core-api actions
 */
const createCollectionTypeController = ({ service, sanitize, transformResponse }) => {
  return {
    /**
     * Retrieve records.
     *
     * @param {StrapiAppContext} ctx
     */
    async find(ctx) {
      const { query } = ctx;

      const { results, pagination } = await service.find(query);

      return transformResponse(sanitize(results), { pagination });
    },

    /**
     * Retrieve a record.
     *
     * @param {StrapiAppContext} ctx
     */
    async findOne(ctx) {
      const { id } = ctx.params;
      const { query } = ctx;

      const entity = await service.findOne(id, query);

      return transformResponse(sanitize(entity));
    },

    /**
     * Create a record.
     *
     * @param {StrapiAppContext} ctx
     */
    async create(ctx) {
      const { query } = ctx.request;

      const { data, files } = parseBody(ctx);

      const entity = await service.create({ ...query, data, files });

      return transformResponse(sanitize(entity));
    },

    /**
     * Update a record.
     *
     * @param {StrapiAppContext} ctx
     */
    async update(ctx) {
      const { id } = ctx.params;
      const { query } = ctx.request;

      const { data, files } = parseBody(ctx);

      const entity = await service.update(id, { ...query, data, files });

      return transformResponse(sanitize(entity));
    },

    /**
     * Destroy a record.
     *
     * @param {StrapiAppContext} ctx
     */
    async delete(ctx) {
      const { id } = ctx.params;
      const { query } = ctx;

      const entity = await service.delete(id, query);
      return transformResponse(sanitize(entity));
    },
  };
};

module.exports = createCollectionTypeController;
