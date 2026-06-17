const express = require('express');
const { exec } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const https = require('https');

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '2mb' }));
app.use(express.static(path.join(__dirname, 'public')));
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

app.get('/printers', (req, res) => {
  exec('powershell -NoProfile -Command "Get-Printer | Select-Object -ExpandProperty Name"', (err, stdout, stderr) => {
    if (err) return res.status(500).json({ error: stderr || err.message });
    const printers = stdout.split('\n').map(p => p.trim()).filter(Boolean);
    res.json({ printers });
  });
});

app.post('/labelary-preview', (req, res) => {
  const { zpl } = req.body;
  if (!zpl) return res.status(400).json({ error: 'No ZPL provided' });
  const options = {
    hostname: 'api.labelary.com',
    path: '/v1/printers/8dpmm/labels/4x2/0/',
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Accept': 'image/png', 'Content-Length': Buffer.byteLength(zpl) },
  };
  const proxyReq = https.request(options, (proxyRes) => {
    res.setHeader('Content-Type', 'image/png');
    proxyRes.pipe(res);
  });
  proxyReq.on('error', (e) => res.status(502).json({ error: e.message }));
  proxyReq.write(zpl);
  proxyReq.end();
});

app.post('/print', (req, res) => {
  const { printer, zpl } = req.body;
  if (!printer) return res.status(400).json({ error: 'No printer selected' });
  if (!zpl) return res.status(400).json({ error: 'No ZPL provided' });
  const tmpFile = path.join(os.tmpdir(), `zebra_${Date.now()}.zpl`);
  fs.writeFileSync(tmpFile, zpl, 'utf8');
  const cmd = `powershell -NoProfile -Command "Get-Content -Raw '${tmpFile}' | Out-Printer -Name '${printer}'"`;
  exec(cmd, (err, _stdout, stderr) => {
    try { fs.unlinkSync(tmpFile); } catch (_) {}
    if (err) return res.status(500).json({ error: stderr || err.message });
    res.json({ success: true, message: `Sent to "${printer}"` });
  });
});

app.listen(PORT, () => console.log(`ZebraPress running at http://localhost:${PORT}`));
