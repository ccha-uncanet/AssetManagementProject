'use strict';

const { execFile } = require('child_process');
const fs    = require('fs');
const os    = require('os');
const path  = require('path');
const https = require('https');

const PLATFORM = os.platform();

/**
 * List printers known to the OS.
 * @returns {Promise<string[]>}
 */
function listPrinters() {
  return new Promise((resolve, reject) => {
    const [cmd, args] = PLATFORM === 'win32'
      ? ['powershell', ['-NoProfile', '-Command', 'Get-Printer | Select-Object -ExpandProperty Name']]
      : ['lpstat', ['-a']];

    execFile(cmd, args, (err, stdout, stderr) => {
      if (err) return reject(new Error(stderr || err.message));
      const printers = PLATFORM === 'win32'
        ? stdout.split('\n').map(p => p.trim()).filter(Boolean)
        : stdout.split('\n').map(l => l.trim().split(' ')[0]).filter(Boolean);
      resolve(printers);
    });
  });
}

/**
 * Render ZPL to a PNG preview via the Labelary API.
 * @param {string} zpl
 * @returns {Promise<Buffer>} PNG image bytes
 */
function labelaryPreview(zpl) {
  return new Promise((resolve, reject) => {
    if (!zpl || !zpl.trim()) return reject(new Error('No ZPL provided'));

    const options = {
      hostname: 'api.labelary.com',
      path: '/v1/printers/8dpmm/labels/4x2/0/',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'image/png',
        'Content-Length': Buffer.byteLength(zpl),
      },
    };

    const req = https.request(options, (res) => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        if (res.statusCode !== 200) return reject(new Error(`Labelary returned ${res.statusCode}`));
        resolve(Buffer.concat(chunks));
      });
    });
    req.on('error', reject);
    req.write(zpl);
    req.end();
  });
}

/**
 * Send raw ZPL to a printer.
 * @param {string} printerName
 * @param {string} zpl
 * @returns {Promise<{success: boolean, message: string}>}
 */
async function printZPL(printerName, zpl) {
  if (!printerName || !printerName.trim()) throw new Error('No printer specified');
  if (!zpl || !zpl.trim()) throw new Error('No ZPL provided');


  const tmpFile = path.join(
    os.tmpdir(),
    `zebra_${Date.now()}_${Math.random().toString(36).slice(2)}.zpl`
  );
  await fs.promises.writeFile(tmpFile, zpl, 'utf8');

  try {
    await new Promise((resolve, reject) => {
      const [cmd, args] = PLATFORM === 'win32'
        ? ['powershell', ['-NoProfile', '-Command',
            `Get-Content -Raw '${tmpFile}' | Out-Printer -Name '${printerName}'`]]
        : ['lp', ['-d', printerName, '-o', 'raw', tmpFile]];

      execFile(cmd, args, (err, _stdout, stderr) => {
        if (err) return reject(new Error(stderr || err.message));
        resolve();
      });
    });
  } finally {
    fs.promises.unlink(tmpFile).catch(() => {});
  }

  return { success: true, message: `Sent to "${printerName}"` };
}

module.exports = { listPrinters, labelaryPreview, printZPL };
