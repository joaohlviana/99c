'use strict';

const { yup, formatYupErrors } = require('strapi-utils');

const handleReject = error => Promise.reject(formatYupErrors(error));

const updatePermissionsSchema = yup
  .object()
  .shape({
    permissions: yup
      .array()
      .of(
        yup
          .object()
          .shape({
            action: yup.string().required(),
            subject: yup.string().nullable(),
            fields: yup.array().of(yup.string()),
            conditions: yup.array().of(yup.string()),
          })
          .noUnknown()
      )
      .requiredAllowEmpty(),
  })
  .required()
  .noUnknown();

const validatedUpdatePermissionsInput = data => {
  return updatePermissionsSchema
    .validate(data, { strict: true, abortEarly: false })
    .catch(handleReject);
};

module.exports = {
  validatedUpdatePermissionsInput,
};
