const { sql } = require('../config/db');

// POST /api/locations/move — ย้ายสถานที่
const moveAsset = async (req, res) => {
    try {
        const { assetId, fromLocation, toLocation, note } = req.body;

        if (!assetId || !toLocation) {
            return res.status(400).json({ error: 'กรุณาระบุ assetId และสถานที่ใหม่' });
        }

        // 1. อัปเดต Location ในตาราง Assets
        const updateReq = new sql.Request();
        updateReq.input('Id', sql.UniqueIdentifier, assetId);
        updateReq.input('Location', sql.NVarChar, toLocation);
        await updateReq.query('UPDATE Assets SET Location = @Location WHERE Id = @Id');

        // 2. บันทึกประวัติลง LocationHistory
        const histReq = new sql.Request();
        histReq.input('AssetId', sql.UniqueIdentifier, assetId);
        histReq.input('FromLocation', sql.NVarChar, fromLocation || '-');
        histReq.input('ToLocation', sql.NVarChar, toLocation);
        histReq.input('Note', sql.NVarChar, note || '');
        histReq.input('MovedBy', sql.Int, req.user?.id || null);
        await histReq.query(`
            INSERT INTO LocationHistory (Id, AssetId, FromLocation, ToLocation, Note, MovedBy, MovedAt)
            VALUES (NEWID(), @AssetId, @FromLocation, @ToLocation, @Note, @MovedBy, GETDATE())
        `);

        res.json({ message: 'ย้ายสถานที่สำเร็จ' });
    } catch (err) {
        console.error('moveAsset Error:', err.message);
        res.status(500).json({ error: 'เกิดข้อผิดพลาด: ' + err.message });
    }
};

// GET /api/locations/history — ดึงประวัติการย้าย
const getHistory = async (req, res) => {
    try {
        const result = await sql.query(`
            SELECT 
                lh.Id, lh.FromLocation, lh.ToLocation, lh.Note, lh.MovedAt,
                a.Name AS AssetName, a.InvNo,
                u.FullName AS MovedByName
            FROM LocationHistory lh
            LEFT JOIN Assets a ON lh.AssetId = a.Id
            LEFT JOIN Users u ON lh.MovedBy = u.Id
            ORDER BY lh.MovedAt DESC
        `);
        res.json(result.recordset);
    } catch (err) {
        console.error('getHistory Error:', err.message);
        res.status(500).json({ error: 'เกิดข้อผิดพลาด: ' + err.message });
    }
};

module.exports = { moveAsset, getHistory };