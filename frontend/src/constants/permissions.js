/**
 * PERMISSIONS CONSTANTS
 *
 * ใช้ไฟล์นี้เป็น source of truth สำหรับชื่อ permission ทั้งหมดในระบบ
 * เพื่อป้องกัน typo เวลาใช้ hasPermission() หรือ can()
 *
 * ตัวอย่าง:
 *   import { PERMISSIONS } from '../constants/permissions';
 *   {can(PERMISSIONS.DELETE_ASSET) && <DeleteButton />}
 */

export const PERMISSIONS = {
  // Dashboard
  VIEW_DASHBOARD: 'view_dashboard',
  VIEW_STATS: 'view_stats',

  // Assets — ตรงกับ DB
  VIEW_ASSETS: 'view_assets',
  CREATE_ASSET: 'manage_assets',   // DB ใช้ manage_assets
  EDIT_ASSET: 'manage_assets',     // DB ใช้ manage_assets
  DELETE_ASSET: 'manage_assets',   // DB ใช้ manage_assets
  IMPORT_ASSETS: 'manage_assets',
  EXPORT_ASSETS: 'export_reports',
  PRINT_LABEL: 'manage_assets',

  // Scan & Audit
  SCAN_ASSET: 'scan_assets',       // DB ใช้ scan_assets
  CREATE_AUDIT: 'manage_assets',
  VIEW_AUDIT: 'view_assets',

  // Locations
  VIEW_LOCATIONS: 'view_assets',
  MANAGE_LOCATIONS: 'manage_assets',
  MOVE_ASSET: 'move_assets',       // DB ใช้ move_assets

  // Users
  VIEW_USERS: 'view_users',
  CREATE_USER: 'manage_users',     // DB ใช้ manage_users
  EDIT_USER: 'manage_users',
  DELETE_USER: 'manage_users',

  // Reports
  VIEW_REPORTS: 'view_reports',
  EXPORT_REPORTS: 'export_reports',

  // System (superadmin only)
  MANAGE_ROLES: 'manage_roles',
  VIEW_LOGS: 'view_logs',
  SYSTEM_SETTINGS: 'manage_settings',
};

/**
 * Default permissions ที่แต่ละ Role ควรมี
 * ใช้สำหรับ seed database หรือ reference เท่านั้น
 * สิทธิ์จริงจะมาจาก API (user.permissions[])
 */
export const ROLE_DEFAULT_PERMISSIONS = {
  superadmin: Object.values(PERMISSIONS),

  admin: [
    PERMISSIONS.VIEW_DASHBOARD,
    PERMISSIONS.VIEW_STATS,
    PERMISSIONS.VIEW_ASSETS,
    PERMISSIONS.CREATE_ASSET,
    PERMISSIONS.EDIT_ASSET,
    PERMISSIONS.DELETE_ASSET,
    PERMISSIONS.IMPORT_ASSETS,
    PERMISSIONS.EXPORT_ASSETS,
    PERMISSIONS.PRINT_LABEL,
    PERMISSIONS.SCAN_ASSET,
    PERMISSIONS.CREATE_AUDIT,
    PERMISSIONS.VIEW_AUDIT,
    PERMISSIONS.VIEW_LOCATIONS,
    PERMISSIONS.MANAGE_LOCATIONS,
    PERMISSIONS.MOVE_ASSET,
    PERMISSIONS.VIEW_USERS,
    PERMISSIONS.VIEW_REPORTS,
    PERMISSIONS.EXPORT_REPORTS,
  ],

  staff: [
    PERMISSIONS.VIEW_DASHBOARD,
    PERMISSIONS.VIEW_ASSETS,
    PERMISSIONS.SCAN_ASSET,
    PERMISSIONS.VIEW_AUDIT,
    PERMISSIONS.VIEW_LOCATIONS,
    PERMISSIONS.MOVE_ASSET,
  ],

  auditor: [
    PERMISSIONS.VIEW_DASHBOARD,
    PERMISSIONS.VIEW_STATS,
    PERMISSIONS.VIEW_ASSETS,
    PERMISSIONS.VIEW_AUDIT,
    PERMISSIONS.VIEW_REPORTS,
    PERMISSIONS.EXPORT_REPORTS,
    PERMISSIONS.VIEW_LOGS,
  ],
};

/**
 * กำหนด Navigation Menu ตาม permissions
 * Sidebar จะ filter เมนูนี้ตาม can() ของ user ปัจจุบัน
 */
export const NAV_ITEMS = [
  {
    key: 'dashboard',
    label: 'ภาพรวม',
    icon: 'LayoutDashboard',
    path: '/app/dashboard',
    permission: PERMISSIONS.VIEW_DASHBOARD,
  },
  {
    key: 'assets',
    label: 'จัดการทรัพย์สิน',
    icon: 'Package',
    path: '/app/assets',
    permission: PERMISSIONS.VIEW_ASSETS,
  },
  {
    key: 'categories',
    label: 'หมวดหมู่',
    icon: 'Tag',
    path: '/app/categories',
    permission: PERMISSIONS.VIEW_ASSETS,
  },
  {
    key: 'borrows',
    label: 'การยืม',
    icon: 'BookOpen',
    path: '/app/borrows',
    permission: PERMISSIONS.VIEW_ASSETS,
  },
  {
    key: 'repairs',
    label: 'การแจ้งซ่อม',
    icon: 'Wrench',
    path: '/app/repairs',
    permission: PERMISSIONS.VIEW_ASSETS,
  },
  {
    key: 'scan',
    label: 'สแกนทรัพย์สิน',
    icon: 'ScanLine',
    path: '/app/scan',
    permission: PERMISSIONS.SCAN_ASSET,
  },
  {
    key: 'inventory',
    label: 'รอบตรวจนับ',
    icon: 'ClipboardList',
    path: '/app/inventory',
    permission: PERMISSIONS.VIEW_AUDIT,
  },
  {
    key: 'locations',
    label: 'สถานที่ / โอนย้าย',
    icon: 'MapPin',
    path: '/app/locations',
    permission: PERMISSIONS.VIEW_LOCATIONS,
  },
  {
    key: 'import',
    label: 'นำเข้าข้อมูล',
    icon: 'Upload',
    path: '/app/import',
    permission: PERMISSIONS.IMPORT_ASSETS,
  },
  {
    key: 'print-labels',
    label: 'พิมพ์ป้าย',
    icon: 'Printer',
    path: '/app/print-labels',
    permission: PERMISSIONS.PRINT_LABEL,
  },
  {
    key: 'reports',
    label: 'รายงาน',
    icon: 'BarChart2',
    path: '/app/reports',
    permission: PERMISSIONS.VIEW_REPORTS,
  },
  {
    key: 'users',
    label: 'จัดการผู้ใช้',
    icon: 'Users',
    path: '/app/users',
    permission: PERMISSIONS.VIEW_USERS,
  },
  {
    key: 'roles',
    label: 'สิทธิ์การเข้าถึง',
    icon: 'ShieldCheck',
    path: '/app/roles',
    permission: PERMISSIONS.MANAGE_ROLES,
  },
  {
    key: 'logs',
    label: 'System Logs',
    icon: 'ScrollText',
    path: '/app/logs',
    permission: PERMISSIONS.VIEW_LOGS,
  },
  {
    key: 'settings',
    label: 'ตั้งค่าระบบ',
    icon: 'Settings',
    path: '/app/settings',
    permission: PERMISSIONS.SYSTEM_SETTINGS,
  },
];