'use strict';

const _ = require('lodash');
const { yup } = require('@strapi/utils');

const strapiServerSchema = yup
  .object()
  .shape({
    // @ts-ignore
    bootstrap: yup.mixed().isFunction(),
    // @ts-ignore
    destroy: yup.mixed().isFunction(),
    // @ts-ignore
    register: yup.mixed().isFunction(),
    config: yup.object(),
    routes: yup.lazy(value => {
      if (Array.isArray(value)) {
        return yup.array();
      } else {
        const shape = _.mapValues(value, () => yup.object({ routes: yup.array().required() }));

        return yup.object(shape);
      }
    }),
    controllers: yup.object(),
    services: yup.object(),
    policies: yup.object(),
    middlewares: yup.object(),
    contentTypes: yup.object(),
  })
  .noUnknown();

const validateModule = data => {
  return strapiServerSchema.validateSync(data, { strict: true, abortEarly: false });
};

module.exports = {
  validateModule,
};
