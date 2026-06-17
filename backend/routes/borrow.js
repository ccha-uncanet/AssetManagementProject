// routes/borrow.js
const express = require('express');
const router  = express.Router();
const { verifyToken, hasRole } = require('../middlewares/authMiddleware');
const {
    createBorrowRequest,
    getBorrowRequests,
    getMyBorrowRequests,
    getBorrowCounts,
    getBorrowRequestById,
    updateBorrowStatus,
} = require('../controllers/borrowController');

// /counts และ /my ต้องอยู่ก่อน /:id เสมอ
router.get('/counts', verifyToken, hasRole('admin', 'superadmin'), getBorrowCounts);
router.get('/my',     verifyToken, getMyBorrowRequests);
router.get('/',       verifyToken, hasRole('admin', 'superadmin'), getBorrowRequests);
router.post('/',      verifyToken, createBorrowRequest);
router.get('/:id',    verifyToken, getBorrowRequestById);
router.patch('/:id/status', verifyToken, hasRole('admin', 'superadmin'), updateBorrowStatus);

module.exports = router;