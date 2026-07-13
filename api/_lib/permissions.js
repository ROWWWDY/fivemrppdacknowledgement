// Single source of truth for what each role can do.
// To add a new role: add a key here with its list of capabilities, then add
// it as an <option> in the role dropdown in admin.html. Nothing else needs
// to change — every endpoint and the dashboard UI read from this list.

const ROLES = {
  owner: [
    'view_applications',
    'decide_applications',
    'delete_applications',
    'manage_invites',
    'manage_sync',
    'manage_admins',
    'view_security_log'
  ],
  coordinator: [
    'view_applications',
    'decide_applications',
    'manage_invites'
  ],
  reviewer: [
    'view_applications',
    'decide_applications'
  ]
};

function capabilitiesFor(permRole) {
  return ROLES[permRole] || [];
}

function can(permRole, capability) {
  return capabilitiesFor(permRole).includes(capability);
}

module.exports = { ROLES, capabilitiesFor, can };
