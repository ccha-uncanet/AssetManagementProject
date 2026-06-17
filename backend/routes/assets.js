const express = require('express');
const router = express.Router();
const { verifyToken, hasPermission } = require('../middlewares/authMiddleware');

// ← เหลือบรรทัดนี้บรรทัดเดียว ลบอันเก่าออก
const { 
  getAllAssets, createAsset, deleteAsset, getAssetById, 
  getAssetStats, updateAssetStatus, updateAsset, getCategories 
} = require('../controllers/assetController');

router.get('/stats', verifyToken, getAssetStats);
router.get('/categories', verifyToken, getCategories);   // ← ต้องอยู่ก่อน /:id
router.get('/', verifyToken, hasPermission('view_assets'), getAllAssets);
router.post('/', verifyToken, hasPermission('manage_assets'), createAsset);
router.get('/:id', verifyToken, getAssetById);
router.delete('/:id', verifyToken, hasPermission('manage_assets'), deleteAsset);
router.put('/:id', verifyToken, hasPermission('manage_assets'), updateAsset);      // ← เพิ่ม
router.put('/:id/status', verifyToken, hasPermission('borrow_assets'), updateAssetStatus);

module.exports = router;