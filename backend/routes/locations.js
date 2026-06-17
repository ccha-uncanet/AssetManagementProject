const express = require('express');
const router = express.Router();
const { moveAsset, getHistory } = require('../controllers/locationController');
const { verifyToken } = require('../middlewares/authMiddleware');

router.post('/move', verifyToken, moveAsset);
router.get('/history', verifyToken, getHistory);

module.exports = router;