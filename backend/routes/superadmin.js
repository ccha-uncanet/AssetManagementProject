const express = require('express');
const router = express.Router();
const { verifyToken, hasRole } = require('../middlewares/authMiddleware');
const {
    getSystemStats, getAllUsers, changeUserRole,
    deleteUser, getRoles, updateRolePermissions,
    getLogs, getUserLogs,
    getDbSettings, testDbConnection, updateDbSettings,
} = require('../controllers/superAdminController');

// superadmin เท่านั้น
router.get('/stats',                        verifyToken, hasRole('superadmin'), getSystemStats);
router.get('/users',                        verifyToken, hasRole('superadmin'), getAllUsers);
router.put('/users/:id/role',               verifyToken, hasRole('superadmin'), changeUserRole);
router.delete('/users/:id',                 verifyToken, hasRole('superadmin'), deleteUser);
router.get('/roles',                        verifyToken, hasRole('superadmin'), getRoles);
router.put('/roles/:roleId/permissions',    verifyToken, hasRole('superadmin'), updateRolePermissions);

// superadmin และ auditor เข้าได้
router.get('/logs',      verifyToken, hasRole('superadmin', 'auditor'), getLogs);
router.get('/userlogs',  verifyToken, hasRole('superadmin', 'auditor'), getUserLogs);

// DB settings (superadmin only)
router.get('/settings/db',   verifyToken, hasRole('superadmin'), getDbSettings);
router.post('/settings/db/test', verifyToken, hasRole('superadmin'), testDbConnection);
router.put('/settings/db',   verifyToken, hasRole('superadmin'), updateDbSettings);

module.exports = router;