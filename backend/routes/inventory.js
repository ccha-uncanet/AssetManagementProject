const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middlewares/authMiddleware');
const {
    getSessions, createSession, getSessionItems,
    countAsset, getSessionSummary, closeSession,
    deleteCountItem, cancelSession, updateSession,
    getAllItems, getUncountedAssets
} = require('../controllers/inventoryController');

router.get('/all-items', verifyToken, getAllItems);
router.get('/sessions/:sessionId/uncounted', verifyToken, getUncountedAssets);
router.get('/sessions', verifyToken, getSessions);
router.post('/sessions', verifyToken, createSession);
router.put('/sessions/:sessionId', verifyToken, updateSession);
router.get('/sessions/:sessionId/items', verifyToken, getSessionItems);
router.get('/sessions/:sessionId/summary', verifyToken, getSessionSummary);
router.put('/sessions/:sessionId/close', verifyToken, closeSession);
router.put('/sessions/:sessionId/cancel', verifyToken, cancelSession);
router.post('/count', verifyToken, countAsset);
router.delete('/count/:id', verifyToken, deleteCountItem);

module.exports = router;