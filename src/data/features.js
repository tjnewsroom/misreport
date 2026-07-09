// ── Grantable admin features ─────────────────────────────────
// Admin can grant any of these to an individual employee via
// Staff Mgmt → Edit. IDs must match the tab ids in AdminDashboard.
// ('search' is excluded — every employee already has Task Search.)

export const GRANTABLE_FEATURES = [
  // Analytics
  { id: 'overview',  label: 'Overview',          icon: '📊', group: 'Analytics' },
  { id: 'live',      label: 'Live Now',          icon: '🟢', group: 'Analytics' },
  { id: 'today',     label: "Today's Work",      icon: '🗒', group: 'Analytics' },
  { id: 'att',       label: 'Attendance',        icon: '🕒', group: 'Analytics' },
  // Management
  { id: 'shifts',    label: 'Shift Planner',     icon: '📅', group: 'Management' },
  { id: 'shiftreq',  label: 'Shift Requests',    icon: '🔄', group: 'Management' },
  { id: 'staff',     label: 'Staff Mgmt',        icon: '👥', group: 'Management' },
  { id: 'quality',   label: 'Quality',           icon: '🎯', group: 'Management' },
  { id: 'rel',       label: 'Reliability',       icon: '📈', group: 'Management' },
  { id: 'prod',      label: 'Producers/VO',      icon: '🎙', group: 'Management' },
  // Reports
  { id: 'report',    label: 'Full Report',       icon: '📄', group: 'Reports' },
  { id: 'empmonth',  label: 'Employee Monthly',  icon: '📆', group: 'Reports' },
  { id: 'typemonth', label: 'News Type Monthly', icon: '🗞', group: 'Reports' },
];

export const FEATURE_GROUPS = ['Analytics', 'Management', 'Reports'];
