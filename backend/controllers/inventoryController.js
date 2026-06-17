const { sql } = require('../config/db');

const getSessions = async (req, res) => {
    try {
        const result = await sql.query(`
            SELECT s.*, 
                COUNT(c.Id) AS TotalCounted
            FROM CountingSessions s
            LEFT JOIN InventoryCounting c ON s.Id = c.SessionId
            GROUP BY s.Id, s.Name, s.Description, s.CreatedBy, s.CreatedByName, s.Status, s.CreatedAt, s.ClosedAt
            ORDER BY s.CreatedAt DESC
        `);
        res.json(result.recordset);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

const createSession = async (req, res) => {
    try {
        const { name, description } = req.body;
        const request = new sql.Request();
        request.input('Name', sql.NVarChar, name);
        request.input('Description', sql.NVarChar, description || '');
        request.input('CreatedBy', sql.Int, req.user.id);
        request.input('CreatedByName', sql.NVarChar, req.user.fullName || req.user.username || '');

        const result = await request.query(`
            INSERT INTO CountingSessions (Id, Name, Description, CreatedBy, CreatedByName)
            OUTPUT INSERTED.*
            VALUES (NEWID(), @Name, @Description, @CreatedBy, @CreatedByName)
        `);
        res.status(201).json(result.recordset[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

const getSessionItems = async (req, res) => {
    try {
        const { sessionId } = req.params;
        const request = new sql.Request();
        request.input('SessionId', sql.UniqueIdentifier, sessionId);
        const result = await request.query(`
            SELECT c.*, a.Name AS AssetName
            FROM InventoryCounting c
            LEFT JOIN Assets a ON c.AssetId = a.Id
            WHERE c.SessionId = @SessionId
            ORDER BY c.CountedAt DESC
        `);
        res.json(result.recordset);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

const countAsset = async (req, res) => {
    try {
        const { sessionId, assetId, invNo, location, category, status, note } = req.body;

        const countedBy = req.user.id;
        const countedByName = req.user.fullName || req.user.username || '';

        // ดึงชื่อ Session
        const sessionReq = new sql.Request();
        sessionReq.input('SessionId', sql.UniqueIdentifier, sessionId);
        const sessionResult = await sessionReq.query('SELECT Name FROM CountingSessions WHERE Id = @SessionId');
        const sessionName = sessionResult.recordset[0]?.Name || '';

        // เช็คว่านับไปแล้วไหม
        const checkReq = new sql.Request();
        checkReq.input('SessionId', sql.UniqueIdentifier, sessionId);
        checkReq.input('AssetId', sql.UniqueIdentifier, assetId);
        const existing = await checkReq.query(`
            SELECT Id FROM InventoryCounting 
            WHERE SessionId = @SessionId AND AssetId = @AssetId
        `);

        if (existing.recordset.length > 0) {
            const updateReq = new sql.Request();
            updateReq.input('SessionId', sql.UniqueIdentifier, sessionId);
            updateReq.input('AssetId', sql.UniqueIdentifier, assetId);
            updateReq.input('Status', sql.NVarChar, status || 'found');
            updateReq.input('Note', sql.NVarChar, note || '');
            updateReq.input('CountedBy', sql.Int, countedBy);
            updateReq.input('CountedByName', sql.NVarChar, countedByName);
            updateReq.input('CountedAt', sql.DateTime, new Date());
            await updateReq.query(`
                UPDATE InventoryCounting 
                SET Status = @Status, Note = @Note, CountedBy = @CountedBy, 
                    CountedByName = @CountedByName, CountedAt = @CountedAt
                WHERE SessionId = @SessionId AND AssetId = @AssetId
            `);
            return res.json({ message: 'อัปเดตการนับสำเร็จ' });
        }

        const insertReq = new sql.Request();
        insertReq.input('SessionId', sql.UniqueIdentifier, sessionId);
        insertReq.input('SessionName', sql.NVarChar, sessionName);
        insertReq.input('AssetId', sql.UniqueIdentifier, assetId);
        insertReq.input('InvNo', sql.NVarChar, invNo || '');
        insertReq.input('Location', sql.NVarChar, location || '');
        insertReq.input('Category', sql.NVarChar, category || '');
        insertReq.input('Status', sql.NVarChar, status || 'found');
        insertReq.input('Note', sql.NVarChar, note || '');
        insertReq.input('CountedBy', sql.Int, countedBy);
        insertReq.input('CountedByName', sql.NVarChar, countedByName);

        await insertReq.query(`
            INSERT INTO InventoryCounting 
            (Id, SessionId, SessionName, AssetId, InvNo, Location, Category, Status, Note, CountedBy, CountedByName)
            VALUES 
            (NEWID(), @SessionId, @SessionName, @AssetId, @InvNo, @Location, @Category, @Status, @Note, @CountedBy, @CountedByName)
        `);

        res.status(201).json({ message: 'บันทึกการนับสำเร็จ' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

const getSessionSummary = async (req, res) => {
    try {
        const { sessionId } = req.params;
        const request = new sql.Request();
        request.input('SessionId', sql.UniqueIdentifier, sessionId);

        const totalAssets = await sql.query('SELECT COUNT(Id) AS Total FROM Assets');
        const counted = await request.query(`
            SELECT 
                COUNT(Id) AS TotalCounted,
                SUM(CASE WHEN Status = 'found' THEN 1 ELSE 0 END) AS Found,
                SUM(CASE WHEN Status = 'missing' THEN 1 ELSE 0 END) AS Missing,
                SUM(CASE WHEN Status = 'damaged' THEN 1 ELSE 0 END) AS Damaged
            FROM InventoryCounting WHERE SessionId = @SessionId
        `);

        res.json({
            totalAssets: totalAssets.recordset[0].Total,
            ...counted.recordset[0]
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

const closeSession = async (req, res) => {
    try {
        const { sessionId } = req.params;
        const request = new sql.Request();
        request.input('Id', sql.UniqueIdentifier, sessionId);
        await request.query(`
            UPDATE CountingSessions 
            SET Status = 'closed', ClosedAt = GETDATE() 
            WHERE Id = @Id
        `);
        res.json({ message: 'ปิดรอบการนับสำเร็จ' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

const deleteCountItem = async (req, res) => {
    try {
        const { id } = req.params;
        const request = new sql.Request();
        request.input('Id', sql.UniqueIdentifier, id);
        await request.query('DELETE FROM InventoryCounting WHERE Id = @Id');
        res.json({ message: 'ลบรายการสำเร็จ' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

const cancelSession = async (req, res) => {
    try {
        const { sessionId } = req.params;
        const request = new sql.Request();
        request.input('Id', sql.UniqueIdentifier, sessionId);
        await request.query(`
            UPDATE CountingSessions SET Status = 'cancelled' WHERE Id = @Id
        `);
        res.json({ message: 'ยกเลิกรอบการนับสำเร็จ' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

const updateSession = async (req, res) => {
    try {
        const { sessionId } = req.params;
        const { name, description } = req.body;
        const request = new sql.Request();
        request.input('Id', sql.UniqueIdentifier, sessionId);
        request.input('Name', sql.NVarChar, name);
        request.input('Description', sql.NVarChar, description || '');
        await request.query(`
            UPDATE CountingSessions SET Name = @Name, Description = @Description WHERE Id = @Id
        `);
        res.json({ message: 'แก้ไขรอบการนับสำเร็จ' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};
// GET /api/inventory/all-items
const getAllItems = async (req, res) => {
    try {
        const result = await sql.query(`
            SELECT 
                c.Id, c.SessionId, c.SessionName, c.AssetId,
                c.InvNo, c.Location, c.Category, c.Status,
                c.Note, c.CountedBy, c.CountedByName, c.CountedAt,
                a.Name AS AssetName, a.SerialNumber,
                s.Name AS SessionNameFull, s.Status AS SessionStatus,
                s.CreatedAt AS SessionCreatedAt
            FROM InventoryCounting c
            LEFT JOIN Assets a ON c.AssetId = a.Id
            LEFT JOIN CountingSessions s ON c.SessionId = s.Id
            ORDER BY c.CountedAt DESC
        `);
        res.json(result.recordset);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// GET /api/inventory/sessions/:sessionId/uncounted
const getUncountedAssets = async (req, res) => {
    try {
        const { sessionId } = req.params;
        const request = new sql.Request();
        request.input('SessionId', sql.UniqueIdentifier, sessionId);
        const result = await request.query(`
            SELECT a.*
            FROM Assets a
            WHERE a.Id NOT IN (
                SELECT AssetId FROM InventoryCounting
                WHERE SessionId = @SessionId
            )
            ORDER BY a.Name ASC
        `);
        res.json(result.recordset);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};
module.exports = { 
    getSessions, createSession, getSessionItems, 
    countAsset, getSessionSummary, closeSession, 
    deleteCountItem, cancelSession, updateSession,
    getAllItems, getUncountedAssets
};