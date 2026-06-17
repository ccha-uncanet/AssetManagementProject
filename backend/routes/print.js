const express  = require('express');
const router   = express.Router();
const { verifyToken } = require('../middlewares/authMiddleware');
const { listPrinters, labelaryPreview, printZPL } = require('../services/zplService');

// ─── Validation ───────────────────────────────────────────────────────────────
const EPC_REGEX = /^[0-9A-Fa-f]{24}$/;

// ─── ZPL Builders ─────────────────────────────────────────────────────────────

// ZD230: renders one strip from a template string with {{L.*}} / {{R.*}} vars.
// When the queue has an odd number of items the last label is mirrored on the
// right half so no placeholder is left blank in the printed output.
function renderStrip(template, left, right) {
  let zpl = template
    .split('\n')
    .filter(l => !l.trim().startsWith(';'))
    .join('\n');

  for (const [k, v] of Object.entries(left))
    zpl = zpl.replaceAll(`{{L.${k}}}`, v ?? '');

  const rightItem = (right && Object.keys(right).length > 0) ? right : left;
  for (const [k, v] of Object.entries(rightItem))
    zpl = zpl.replaceAll(`{{R.${k}}}`, v ?? '');

  zpl = zpl.replace(/\{\{R\.[^}]+\}\}/g, '');
  return zpl;
}

const DEFAULT_ZD230_TEMPLATE = `^XA
^CI28^PW800^LL200
^FO10,15^A0N,36,36^FD{{L.name}}^FS
^FO10,58^A0N,24,24^FD{{L.sku}}^FS
^FO10,92^BCN,50,Y,N,N^FD{{L.barcode}}^FS
^FO400,0^GB1,200,2^FS
^FO412,15^A0N,36,36^FD{{R.name}}^FS
^FO412,58^A0N,24,24^FD{{R.sku}}^FS
^FO412,92^BCN,50,Y,N,N^FD{{R.barcode}}^FS
^PQ1,0,1,Y^XZ`;

function buildZD230Queue(items, template = DEFAULT_ZD230_TEMPLATE) {
  const strips = [];
  for (let i = 0; i < items.length; i += 2)
    strips.push(renderStrip(template, items[i], items[i + 1] ?? null));
  return strips.join('\n');
}

function buildZT411(item) {
  return `^XA
^CI28^PW780^LL420
^RS8,0,3^RR20^RW20
^RFW,H^FD${item.epc}^FS
^FO20,20^A0N,48,48^FD${item.name}^FS
^FO20,78^A0N,28,28^FD${item.sku}^FS
^FO20,120^BCN,70,Y,N,N^FD${item.barcode}^FS
^FO5,5^GB770,410,2^FS
^PQ1,0,1,Y^XZ`;
}

// ─── GET /api/print/printers ──────────────────────────────────────────────────
router.get('/printers', verifyToken, async (req, res) => {
  try {
    const printers = await listPrinters();
    res.json({ printers });
  } catch {
    res.json({ printers: [] });
  }
});

// ─── POST /api/print ──────────────────────────────────────────────────────────
// Body: { printer, printerType, items, template? }
// items: [{ name, sku, barcode, epc? }]
router.post('/', verifyToken, async (req, res) => {
  const { printer, items, printerType, template } = req.body;

  if (!printer?.trim()) {
    return res.status(400).json({ error: 'Invalid printer name' });
  }
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'No items provided' });
  }
  for (const item of items) {
    if (!item.name || !item.sku || !item.barcode) {
      return res.status(400).json({ error: 'Item missing required fields (name, sku, barcode)' });
    }
    if (printerType === 'ZT411' && (!item.epc || !EPC_REGEX.test(item.epc))) {
      return res.status(400).json({ error: `Invalid EPC for item ${item.sku}. Must be 24 hex characters.` });
    }
  }

  let zpl;
  try {
    zpl = printerType === 'ZT411'
      ? items.map(buildZT411).join('\n')
      : buildZD230Queue(items, template || DEFAULT_ZD230_TEMPLATE);
  } catch (e) {
    return res.status(500).json({ error: 'Failed to build ZPL: ' + e.message });
  }

  try {
    const result = await printZPL(printer.trim(), zpl);
    console.log(`[print] ${printerType} → "${printer}" · ${items.length} labels`);
    res.json({ ...result, count: items.length, printerType });
  } catch (e) {
    console.error('[print] error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ─── POST /api/print/preview ──────────────────────────────────────────────────
// Returns rendered ZPL string without printing.
router.post('/preview', verifyToken, (req, res) => {
  const { items, printerType, template } = req.body;

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'No items provided' });
  }

  let zpl;
  try {
    zpl = printerType === 'ZT411'
      ? items.map(buildZT411).join('\n')
      : buildZD230Queue(items, template || DEFAULT_ZD230_TEMPLATE);
  } catch (e) {
    return res.status(500).json({ error: 'Failed to build ZPL: ' + e.message });
  }

  res.json({ zpl });
});

// ─── POST /api/print/labelary-preview ────────────────────────────────────────
// Proxies ZPL to Labelary API → returns PNG image.
// Body: { zpl } OR { items, printerType, template? }
router.post('/labelary-preview', verifyToken, async (req, res) => {
  let zpl = req.body.zpl;

  if (!zpl) {
    const { items, printerType, template } = req.body;
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Provide either zpl or items' });
    }
    try {
      const previewItems = items.slice(0, 2);
      zpl = printerType === 'ZT411'
        ? previewItems.map(buildZT411).join('\n')
        : buildZD230Queue(previewItems, template || DEFAULT_ZD230_TEMPLATE);
    } catch (e) {
      return res.status(500).json({ error: 'Failed to build ZPL: ' + e.message });
    }
  }

  try {
    const png = await labelaryPreview(zpl);
    res.set('Content-Type', 'image/png').send(png);
  } catch (e) {
    res.status(502).json({ error: 'Preview failed', detail: e.message });
  }
});

module.exports = router;
