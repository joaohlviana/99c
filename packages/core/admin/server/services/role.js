'use strict';

/**
 * @typedef {import('@strapi/admin').AdminPermission} AdminPermission
 */

const _ = require('lodash');
const { set, omit, pick, prop, isArray, differenceWith, differenceBy } = require('lodash/fp');
const deepEqual = require('fast-deep-equal');
const {
  generateTimestampCode,
  stringIncludes,
  hooks: { createAsyncSeriesWaterfallHook },
} = require('@strapi/utils');
const permissionDomain = require('../domain/permission');
const { validatePermissionsExist } = require('../validation/permission');
const { getService } = require('../utils');
const { SUPER_ADMIN_CODE, CONTENT_TYPE_SECTION } = require('./constants');

const hooks = {
  willResetSuperAdminPermissions: createAsyncSeriesWaterfallHook(),
};

const ACTIONS = {
  publish: 'plugin::content-manager.explorer.publish',
};

const sanitizeRole = omit(['users', 'permissions']);

const COMPARABLE_FIELDS = ['conditions', 'properties', 'subject', 'action'];
const pickComparableFields = pick(COMPARABLE_FIELDS);

const jsonClean = data => JSON.parse(JSON.stringify(data));

/**
 * Compare two permissions
 * @param {AdminPermission} p1
 * @param {AdminPermission} p2
 */
const arePermissionsEqual = (p1, p2) => {
  if (p1.action === p2.action) {
    return deepEqual(jsonClean(pickComparableFields(p1)), jsonClean(pickComparableFields(p2)));
  }

  return false;
};

/**
 * Create and save a role in database
 * @param {any} attributes A partial role object
 */
const create = async attributes => {
  const alreadyExists = await exists({ name: attributes.name });

  if (alreadyExists) {
    throw strapi.errors.badRequest('ValidationError', {
      name: [`The name must be unique and a role with name \`${attributes.name}\` already exists.`],
    });
  }

  const autoGeneratedCode = `${_.kebabCase(attributes.name)}-${generateTimestampCode()}`;

  const rolesWithCode = {
    ...attributes,
    code: attributes.code || autoGeneratedCode,
  };

  return strapi.query('admin::role').create({ data: rolesWithCode });
};

/**
 * Find a role in database
 * @param {any=} params query params to find the role
 * @param {boolean=} populate
 */
const findOne = (params = {}, populate) => {
  return strapi.query('admin::role').findOne({ where: params, populate });
};

/**
 * Find a role in database with usersCounts
 * @param {any=} params query params to find the role
 * @param {boolean=} populate
 */
const findOneWithUsersCount = async (params = {}, populate) => {
  const role = await strapi.query('admin::role').findOne({ where: params, populate });

  if (role) {
    role.usersCount = await getUsersCount(role.id);
  }

  return role;
};

/**
 * Find roles in database
 * @param {any=} params query params to find the roles
 * @param {boolean=} populate
 */
const find = (params = {}, populate) => {
  return strapi.query('admin::role').findMany({ where: params, populate });
};

/**
 * Find all roles in database
 */
const findAllWithUsersCount = async populate => {
  const roles = await strapi.query('admin::role').findMany({ populate });
  for (let role of roles) {
    role.usersCount = await getUsersCount(role.id);
  }

  return roles;
};

/**
 * Update a role in database
 * @param {any} params query params to find the role to update
 * @param {any} attributes A partial role object
 */
const update = async (params, attributes) => {
  const sanitizedAttributes = _.omit(attributes, ['code']);

  if (_.has(params, 'id') && _.has(sanitizedAttributes, 'name')) {
    const alreadyExists = await exists({
      name: sanitizedAttributes.name,
      id: { $ne: params.id },
    });
    if (alreadyExists) {
      throw strapi.errors.badRequest('ValidationError', {
        name: [
          `The name must be unique and a role with name \`${sanitizedAttributes.name}\` already exists.`,
        ],
      });
    }
  }

  return strapi.query('admin::role').update({ where: params, data: sanitizedAttributes });
};

/**
 * Check if a role exists in database
 * @param {any} params query params to find the role
 */
const exists = async (params = {}) => {
  const count = await strapi.query('admin::role').count({ where: params });
  return count > 0;
};

/**
 * Count the number of roles based on search params
 * @param {any=} params params used for the query
 */
const count = async (params = {}) => {
  return strapi.query('admin::role').count(params);
};

/**
 * Check if the given roles id can be deleted safely, throw otherwise
 * @param {string[]} ids
 */
const checkRolesIdForDeletion = async (ids = []) => {
  const superAdminRole = await getSuperAdmin();

  if (superAdminRole && stringIncludes(ids, superAdminRole.id)) {
    throw new Error('You cannot delete the super admin role');
  }

  for (let roleId of ids) {
    const usersCount = await getUsersCount(roleId);
    if (usersCount !== 0) {
      throw new Error('Some roles are still assigned to some users');
    }
  }
};

/**
 * Delete roles in database if they have no user assigned
 * @param {string[]} ids query params to find the roles
 */
const deleteByIds = async (ids = []) => {
  await checkRolesIdForDeletion(ids);

  await getService('permission').deleteByRolesIds(ids);

  const deletedRoles = [];
  for (const id of ids) {
    const deletedRole = await strapi.query('admin::role').delete({ where: { id } });

    if (deletedRole) {
      deletedRoles.push(deletedRole);
    }
  }

  return deletedRoles;
};

/**
 * Count the number of users for some roles
 * @param {string} roleId
 */
const getUsersCount = async roleId => {
  return strapi.query('admin::user').count({ where: { roles: { id: roleId } } });
};

/**
 * Returns admin role
 */
const getSuperAdmin = () => findOne({ code: SUPER_ADMIN_CODE });

/**
 * Returns admin role with userCount
 */
const getSuperAdminWithUsersCount = () => findOneWithUsersCount({ code: SUPER_ADMIN_CODE });

/**
 * Create superAdmin, Author and Editor role is no role already exist
 */
const createRolesIfNoneExist = async () => {
  const someRolesExist = await exists();
  if (someRolesExist) {
    return;
  }

  const { actionProvider } = getService('permission');

  const allActions = actionProvider.values();
  const contentTypesActions = allActions.filter(a => a.section === 'contentTypes');

  // create 3 roles
  const superAdminRole = await create({
    name: 'Super Admin',
    code: 'strapi-super-admin',
    description: 'Super Admins can access and manage all features and settings.',
  });

  await getService('user').assignARoleToAll(superAdminRole.id);

  const editorRole = await create({
    name: 'Editor',
    code: 'strapi-editor',
    description: 'Editors can manage and publish contents including those of other users.',
  });

  const authorRole = await create({
    name: 'Author',
    code: 'strapi-author',
    description: 'Authors can manage the content they have created.',
  });

  // create content-type permissions for each role
  const editorPermissions = getService('content-type').getPermissionsWithNestedFields(
    contentTypesActions,
    {
      restrictedSubjects: ['plugin::users-permissions.user'],
    }
  );

  const authorPermissions = editorPermissions
    .filter(({ action }) => action !== ACTIONS.publish)
    .map(permission =>
      permissionDomain.create({ ...permission, conditions: ['admin::is-creator'] })
    );

  editorPermissions.push(...getDefaultPluginPermissions());
  authorPermissions.push(...getDefaultPluginPermissions({ isAuthor: true }));

  // assign permissions to roles
  await addPermissions(editorRole.id, editorPermissions);
  await addPermissions(authorRole.id, authorPermissions);
};

const getDefaultPluginPermissions = ({ isAuthor = false } = {}) => {
  const conditions = isAuthor ? ['admin::is-creator'] : [];

  // add plugin permissions for each role
  return [
    { action: 'plugin::upload.read', conditions },
    { action: 'plugin::upload.assets.create' },
    { action: 'plugin::upload.assets.update', conditions },
    { action: 'plugin::upload.assets.download' },
    { action: 'plugin::upload.assets.copy-link' },
  ].map(permissionDomain.create);
};

/**
 * Display a warning if the role superAdmin doesn't exist
 * or if the role is not assigned to at least one user
 */
const displayWarningIfNoSuperAdmin = async () => {
  const superAdminRole = await getSuperAdminWithUsersCount();
  const someUsersExists = await getService('user').exists();

  if (!superAdminRole) {
    strapi.log.warn("Your application doesn't have a super admin role.");
  } else if (someUsersExists && superAdminRole.usersCount === 0) {
    strapi.log.warn("Your application doesn't have a super admin user.");
  }
};

/**
 * Assign permissions to a role
 * @param {string|number} roleId - role ID
 * @param {AdminPermission[]} permissions - permissions to assign to the role
 */
const assignPermissions = async (roleId, permissions = []) => {
  try {
    await validatePermissionsExist(permissions);
  } catch (err) {
    throw strapi.errors.badRequest('ValidationError', err);
  }

  const superAdmin = await getService('role').getSuperAdmin();
  const isSuperAdmin = superAdmin && superAdmin.id === roleId;
  const assignRole = set('role', roleId);

  const permissionsWithRole = permissions
    // Add the role attribute to every permission
    .map(assignRole)
    // Transform each permission into a Permission instance
    .map(permissionDomain.create);

  const existingPermissions = await getService('permission').findMany({
    where: { role: { id: roleId } },
    populate: ['role'],
  });

  const permissionsToAdd = differenceWith(
    arePermissionsEqual,
    permissionsWithRole,
    existingPermissions
  );

  const permissionsToDelete = differenceWith(
    arePermissionsEqual,
    existingPermissions,
    permissionsWithRole
  );

  const permissionsToReturn = differenceBy('id', permissionsToDelete, existingPermissions);

  if (permissionsToDelete.length > 0) {
    await getService('permission').deleteByIds(permissionsToDelete.map(prop('id')));
  }

  if (permissionsToAdd.length > 0) {
    const newPermissions = await addPermissions(roleId, permissionsToAdd);
    permissionsToReturn.push(...newPermissions);
  }

  if (!isSuperAdmin && (permissionsToAdd.length || permissionsToDelete.length)) {
    await getService('metrics').sendDidUpdateRolePermissions();
  }

  return permissionsToReturn;
};

const addPermissions = async (roleId, permissions) => {
  const { conditionProvider, createMany } = getService('permission');
  const { sanitizeConditions } = permissionDomain;

  const permissionsWithRole = permissions
    .map(set('role', roleId))
    .map(sanitizeConditions(conditionProvider));

  return createMany(permissionsWithRole);
};

const isContentTypeAction = action => action.section === CONTENT_TYPE_SECTION;

/**
 * Reset super admin permissions (giving it all permissions)
 */
const resetSuperAdminPermissions = async () => {
  const superAdminRole = await getService('role').getSuperAdmin();
  if (!superAdminRole) {
    return;
  }

  const permissionService = getService('permission');
  const contentTypeService = getService('content-type');

  const allActions = permissionService.actionProvider.values();

  const contentTypesActions = allActions.filter(action => isContentTypeAction(action));
  const otherActions = allActions.filter(action => !isContentTypeAction(action));

  // First, get the content-types permissions
  const permissions = contentTypeService.getPermissionsWithNestedFields(contentTypesActions);

  // Then add every other permission
  const otherPermissions = otherActions.reduce((acc, action) => {
    const { actionId, subjects } = action;

    if (isArray(subjects)) {
      acc.push(...subjects.map(subject => permissionDomain.create({ action: actionId, subject })));
    } else {
      acc.push(permissionDomain.create({ action: actionId }));
    }

    return acc;
  }, []);

  permissions.push(...otherPermissions);

  const transformedPermissions = await hooks.willResetSuperAdminPermissions.call(permissions);

  await assignPermissions(superAdminRole.id, transformedPermissions);
};

/**
 * Check if a user object includes the super admin role
 * @param {any} user
 */
const hasSuperAdminRole = user => {
  const roles = _.get(user, 'roles', []);

  return roles.map(prop('code')).includes(SUPER_ADMIN_CODE);
};

module.exports = {
  hooks,
  sanitizeRole,
  create,
  findOne,
  findOneWithUsersCount,
  find,
  findAllWithUsersCount,
  update,
  exists,
  count,
  deleteByIds,
  getUsersCount,
  getSuperAdmin,
  getSuperAdminWithUsersCount,
  createRolesIfNoneExist,
  displayWarningIfNoSuperAdmin,
  addPermissions,
  hasSuperAdminRole,
  assignPermissions,
  resetSuperAdminPermissions,
  checkRolesIdForDeletion,
  constants: {
    superAdminCode: SUPER_ADMIN_CODE,
  },
};
