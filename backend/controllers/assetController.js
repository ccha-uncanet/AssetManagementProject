// controllers/assetController.js
const { sql } = require('../config/db');

const getAllAssets = async (req, res) => {
    try {
        const result = await sql.query('SELECT * FROM Assets ORDER BY PurchaseDate DESC');
        res.json(result.recordset);
    } catch (err) {
        console.error('Error fetching assets:', err);
        res.status(500).json({ message: 'เกิดข้อผิดพลาดในการดึงข้อมูลทรัพย์สิน' });
    }
};

const createAsset = async (req, res) => {
    try {
        const { name, description, serialNumber, purchaseDate, purchasePrice, status, invNo, location, assetCategoryId, category } = req.body;

        const request = new sql.Request();
        request.input('Name', sql.NVarChar, name);
        request.input('Description', sql.NVarChar, description || '');
        request.input('SerialNumber', sql.NVarChar, serialNumber || '');
        request.input('PurchaseDate', sql.DateTime, purchaseDate || new Date());
        request.input('PurchasePrice', sql.Decimal(18, 2), purchasePrice || 0);
        request.input('Status', sql.Int, status || 1);
        request.input('InvNo', sql.NVarChar, invNo || '');
        request.input('Location', sql.NVarChar, location || '');
        request.input('AssetCategoryId', sql.Int, assetCategoryId || null);
        request.input('Category', sql.NVarChar, category || '');  // ⭐ เพิ่ม

        const query = `
            INSERT INTO Assets 
            (Id, Name, Description, SerialNumber, PurchaseDate, PurchasePrice, Status, InvNo, Location, AssetCategoryId, Category)
            OUTPUT INSERTED.*
            VALUES 
            (NEWID(), @Name, @Description, @SerialNumber, @PurchaseDate, @PurchasePrice, @Status, @InvNo, @Location, @AssetCategoryId, @Category)
        `;

        const result = await request.query(query);
        res.status(201).json({ message: 'เพิ่มทรัพย์สินสำเร็จ!', asset: result.recordset[0] });
    } catch (err) {
        console.error('Error creating asset:', err);
        res.status(500).json({ message: 'เกิดข้อผิดพลาดในการสร้างทรัพย์สิน' });
    }
};

const deleteAsset = async (req, res) => {
    try {
        const { id } = req.params;
        const request = new sql.Request();
        request.input('Id', sql.UniqueIdentifier, id);
        await request.query('DELETE FROM Assets WHERE Id = @Id');
        res.json({ message: 'ลบข้อมูลทรัพย์สินเรียบร้อยแล้ว' });
    } catch (err) {
        console.error('Error deleting asset:', err);
        res.status(500).json({ message: 'เกิดข้อผิดพลาดในการลบข้อมูล' });
    }
};

const getAssetById = async (req, res) => {
    try {
        const { id } = req.params;
        const request = new sql.Request();
        request.input('Id', sql.UniqueIdentifier, id);
        const result = await request.query('SELECT * FROM Assets WHERE Id = @Id');
        if (result.recordset.length === 0) {
            return res.status(404).json({ message: 'ไม่พบทรัพย์สินรหัสนี้ในระบบ' });
        }
        res.json(result.recordset[0]);
    } catch (err) {
        console.error('Error fetching asset by ID:', err);
        res.status(500).json({ message: 'รูปแบบ QR Code ไม่ถูกต้อง หรือเกิดข้อผิดพลาด' });
    }
};

const getAssetStats = async (req, res) => {
    try {
        const result = await sql.query(`
            SELECT 
                COUNT(Id) AS Total,
                SUM(CASE WHEN Status = 1 THEN 1 ELSE 0 END) AS Available,
                SUM(CASE WHEN Status = 2 THEN 1 ELSE 0 END) AS Borrowed,
                SUM(CASE WHEN Status = 3 THEN 1 ELSE 0 END) AS Repairing
            FROM Assets
        `);
        const stats = result.recordset[0] || { Total: 0, Available: 0, Borrowed: 0, Repairing: 0 };
        res.json({
            Total: stats.Total || 0,
            Available: stats.Available || 0,
            Borrowed: stats.Borrowed || 0,
            Repairing: stats.Repairing || 0
        });
    } catch (err) {
        console.error('Error fetching stats:', err);
        res.status(500).json({ message: 'เกิดข้อผิดพลาดในการดึงสถิติ' });
    }
};

const updateAssetStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status, borrowerName, expectedReturnDate, note } = req.body;

        let finalNotes = note || '';
        if (status === 2) {
            finalNotes = `ผู้ยืม: ${borrowerName || '-'} | กำหนดคืน: ${expectedReturnDate || '-'} | หมายเหตุ: ${note || '-'}`;
        } else if (note) {
            finalNotes = `หมายเหตุ: ${note}`;
        }

        const request = new sql.Request();
        request.input('Id', sql.UniqueIdentifier, id);
        request.input('Status', sql.Int, status);
        await request.query('UPDATE Assets SET Status = @Status WHERE Id = @Id');

        request.input('ActionInt', sql.Int, status);
        request.input('Notes', sql.NVarChar, finalNotes);
        await request.query(`
            INSERT INTO AssetTransactions (Id, AssetId, UserId, Action, TransactionDate, Location, Notes)
            VALUES (NEWID(), @Id, NULL, @ActionInt, GETDATE(), NULL, @Notes)
        `);

        res.json({ message: 'ทำรายการและบันทึกประวัติเรียบร้อยแล้ว' });
    } catch (err) {
        console.error('Error updating status:', err);
        res.status(500).json({ message: 'เกิดข้อผิดพลาดในการทำรายการ' });
    }
};
// ── เพิ่มฟังก์ชันเหล่านี้ใน assetController.js ──────────────────────────────

// GET /api/assets/categories — ดึง category พร้อมจำนวนทรัพย์สิน
const getCategories = async (req, res) => {
    try {
        const result = await sql.query(`
            SELECT Category, COUNT(*) AS AssetCount
            FROM Assets
            WHERE Category IS NOT NULL AND Category != ''
            GROUP BY Category
            ORDER BY Category ASC
        `);
        res.json(result.recordset);
    } catch (err) {
        console.error('Error fetching categories:', err);
        res.status(500).json({ message: 'เกิดข้อผิดพลาด' });
    }
};

// PUT /api/assets/categories/rename — เปลี่ยนชื่อ category ทั้งหมด
const renameCategory = async (req, res) => {
    const { oldName, newName } = req.body;
    if (!oldName?.trim() || !newName?.trim())
        return res.status(400).json({ message: 'กรุณาระบุชื่อเดิมและชื่อใหม่' });
    try {
        const request = new sql.Request();
        request.input('oldName', sql.NVarChar, oldName.trim());
        request.input('newName', sql.NVarChar, newName.trim());
        const result = await request.query('UPDATE Assets SET Category = @newName WHERE Category = @oldName');
        res.json({ affected: result.rowsAffected[0] });
    } catch (err) {
        console.error('Error renaming category:', err);
        res.status(500).json({ message: 'เกิดข้อผิดพลาด' });
    }
};

// DELETE /api/assets/categories/:name — ล้าง category ออกจากทรัพย์สิน
const deleteCategory = async (req, res) => {
    const name = decodeURIComponent(req.params.name);
    try {
        const request = new sql.Request();
        request.input('name', sql.NVarChar, name);
        const result = await request.query('UPDATE Assets SET Category = NULL WHERE Category = @name');
        res.json({ affected: result.rowsAffected[0] });
    } catch (err) {
        console.error('Error deleting category:', err);
        res.status(500).json({ message: 'เกิดข้อผิดพลาด' });
    }
};

// PUT /api/assets/:id — แก้ไขข้อมูลทรัพย์สิน
const updateAsset = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, description, serialNumber, purchaseDate, purchasePrice, status, invNo, location, category, rfidTag } = req.body;

        const request = new sql.Request();
        request.input('Id', sql.UniqueIdentifier, id);
        request.input('Name', sql.NVarChar, name);
        request.input('Description', sql.NVarChar, description || '');
        request.input('SerialNumber', sql.NVarChar, serialNumber || '');
        request.input('PurchaseDate', sql.DateTime, purchaseDate || null);
        request.input('PurchasePrice', sql.Decimal(18, 2), purchasePrice || 0);
        request.input('Status', sql.Int, status || 1);
        request.input('InvNo', sql.NVarChar, invNo || '');
        request.input('Location', sql.NVarChar, location || '');
        request.input('Category', sql.NVarChar, category || '');
        request.input('RfidTag', sql.NVarChar, rfidTag || '');
        request.input('HasRfid', sql.Bit, rfidTag ? 1 : 0);

        await request.query(`
            UPDATE Assets SET
                Name = @Name,
                Description = @Description,
                SerialNumber = @SerialNumber,
                PurchaseDate = @PurchaseDate,
                PurchasePrice = @PurchasePrice,
                Status = @Status,
                InvNo = @InvNo,
                Location = @Location,
                Category = @Category,
                RfidTag = @RfidTag,
                HasRfid = @HasRfid
            WHERE Id = @Id
        `);

        // ดึงข้อมูลที่อัปเดตแล้วส่งกลับ
        const fetchReq = new sql.Request();
        fetchReq.input('Id', sql.UniqueIdentifier, id);
        const result = await fetchReq.query('SELECT * FROM Assets WHERE Id = @Id');
        res.json({ message: 'อัปเดตทรัพย์สินสำเร็จ', asset: result.recordset[0] });
    } catch (err) {
        console.error('Error updating asset:', err);
        res.status(500).json({ message: 'เกิดข้อผิดพลาดในการอัปเดต' });
    }
};

module.exports = {
  getAllAssets,
  createAsset,
  deleteAsset,
  getAssetById,
  getAssetStats,
  updateAssetStatus,
  updateAsset,
  getCategories,
  renameCategory,
  deleteCategory,
};