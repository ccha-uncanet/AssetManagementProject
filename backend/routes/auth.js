const express = require('express');
const router = express.Router();
const { register, login } = require('../controllers/authController');
const { verifyToken, isAdmin } = require('../middlewares/authMiddleware');

router.post('/register', verifyToken, isAdmin, register);
router.post('/login', login);

module.exports = router;