const express = require('express');
const router = express.Router();
const { moveAsset, getHistory, getLocations } = require('../controllers/locationController');
const { verifyToken } = require('../middlewares/authMiddleware');

router.get('/', verifyToken, getLocations);
router.post('/move', verifyToken, moveAsset);
router.get('/history', verifyToken, getHistory);

module.exports = router;