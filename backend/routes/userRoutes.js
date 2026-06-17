const express = require('express');
const router = express.Router();
const { getAllUsers, updateUser, deleteUser } = require('../controllers/userController');
const { verifyToken, isAdmin } = require('../middlewares/authMiddleware');

router.get('/', verifyToken, isAdmin, getAllUsers);
router.put('/:id', verifyToken, isAdmin, updateUser);       // เพิ่มบรรทัดนี้
router.delete('/:id', verifyToken, isAdmin, deleteUser);

module.exports = router;