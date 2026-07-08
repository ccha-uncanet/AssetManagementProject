import React, { useState, useEffect, useCallback, useRef } from 'react';
import api from '../services/api';
import { getPrinters, printZPL, previewZPL } from '../services/zebrapress';

// ─── Constants ────────────────────────────────────────────────────────────────
const DEFAULT_ZPL_TEMPLATE = `^XA
^CI28^PW800^LL200
^FO10,15^A0N,36,36^FD{{L.name}}^FS
^FO10,58^A0N,24,24^FD{{L.sku}}^FS
^FO10,92^BCN,50,Y,N,N^FD{{L.barcode}}^FS
^FO400,0^GB1,200,2^FS
^FO412,15^A0N,36,36^FD{{R.name}}^FS
^FO412,58^A0N,24,24^FD{{R.sku}}^FS
^FO412,92^BCN,50,Y,N,N^FD{{R.barcode}}^FS
^PQ1,0,1,Y^XZ`;

const FIELDS = [
  { name: 'name',     label: 'ชื่อ (Name)',         type: 'text' },
  { name: 'sku',      label: 'เลขครุภัณฑ์ (SKU)',   type: 'text' },
  { name: 'barcode',  label: 'Barcode',              type: 'text' },
  { name: 'location', label: 'สถานที่ (Location)',   type: 'text' },
  { name: 'date',     label: 'วันที่ (Date)',         type: 'text' },
  { name: 'time',     label: 'เวลา (Time)',           type: 'text' },
];

const ZPL_SNIPPETS = {
  'Line 1':    '^FO10,15^A0N,36,36^FD{{L.name}}^FS',
  'Line 2':    '^FO10,58^A0N,24,24^FD{{L.sku}}^FS',
  'Barcode':   '^FO10,92^BCN,50,Y,N,N^FD{{L.barcode}}^FS',
  'QR Code':   '^FO10,92^BQN,2,4^FDQA,{{L.barcode}}^FS',
  'Location':  '^FO10,155^A0N,20,20^FD{{L.location}}^FS',
  'Date/Time': '^FO10,175^A0N,20,20^FD{{L.date}} {{L.time}}^FS',
  'Box':       '^FO5,5^GB390,190,2^FS',
  'Divider':   '^FO400,0^GB1,200,2^FS',
};

// ─── Sub-components ───────────────────────────────────────────────────────────
const StatusBadge = ({ status }) => {
  const map = {
    idle:     { label: 'พร้อม',          cls: 'bg-slate-100 text-slate-600' },
    printing: { label: 'กำลังปริ้น...', cls: 'bg-amber-100 text-amber-700 animate-pulse' },
    success:  { label: 'สำเร็จ',         cls: 'bg-emerald-100 text-emerald-700' },
    error:    { label: 'ผิดพลาด',        cls: 'bg-red-100 text-red-700' },
  };
  const s = map[status] ?? map.idle;
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${s.cls}`}>
      {s.label}
    </span>
  );
};

const PrinterTypeCard = ({ type, selected, onClick }) => {
  const info = {
    ZD230: { label: 'ZD230', desc: '5×2.5 cm · 203 DPI · 2 คอลัมน์/แถบ', badge: 'Barcode',        badgeCls: 'bg-blue-100 text-blue-700',    icon: '🏷️' },
    ZT411: { label: 'ZT411', desc: '6.5×3.5 cm · 300 DPI · 1 คอลัมน์',   badge: 'RFID + Barcode', badgeCls: 'bg-violet-100 text-violet-700', icon: '📡' },
  };
  const d = info[type];
  return (
    <button
      onClick={onClick}
      className={`relative flex flex-col gap-2 p-4 rounded-xl border-2 text-left transition-all w-full
        ${selected ? 'border-blue-500 bg-blue-50 shadow-md shadow-blue-100' : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm'}`}
    >
      <div className="flex items-center gap-2">
        <span className="text-2xl">{d.icon}</span>
        <span className="font-semibold text-slate-800">{d.label}</span>
        <span className={`ml-auto text-xs font-medium px-2 py-0.5 rounded-full ${d.badgeCls}`}>{d.badge}</span>
      </div>
      <p className="text-xs text-slate-500">{d.desc}</p>
      {selected && <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-blue-500" />}
    </button>
  );
};

// ─── Printer Selector ─────────────────────────────────────────────────────────
const PrinterSelector = ({ printers, selected, onSelect, onRefresh, loading, error }) => {
  const [manual, setManual] = React.useState('');

  const handleManual = (e) => {
    setManual(e.target.value);
    onSelect(e.target.value);
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">เครื่องพิมพ์</h2>
        <button
          onClick={onRefresh}
          disabled={loading}
          className="text-xs text-blue-600 hover:underline disabled:opacity-40"
        >{loading ? 'กำลังโหลด...' : '↻ รีเฟรช'}</button>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
          กำลังค้นหาเครื่องพิมพ์...
        </div>
      ) : (
        <>
          {error && (
            <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              ⚠️ {error}
            </div>
          )}
          <select
            value={printers.includes(selected) ? selected : ''}
            onChange={e => { onSelect(e.target.value); setManual(''); }}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
          >
            <option value="">
              {printers.length === 0 ? '— ไม่พบเครื่องพิมพ์ (กรอกชื่อด้านล่าง) —' : '— เลือกเครื่องพิมพ์ —'}
            </option>
            {printers.map(p => <option key={p} value={p}>{p}</option>)}
          </select>

        </>
      )}

      {selected && (
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-500" />
          <span className="text-xs text-slate-500 truncate">{selected}</span>
        </div>
      )}

    </div>
  );
};

// ─── Template Editor Modal ────────────────────────────────────────────────────
const DEFAULT_SAMPLE = {
  name:     'ตัวอย่างสินค้า',
  sku:      'SKU-001',
  barcode:  '1234567890',
  location: 'ห้อง A101',
  date:     new Date().toLocaleDateString('th-TH'),
  time:     new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }),
};

const TemplateEditorModal = ({ template, onSave, onClose }) => {
  const [draft, setDraft]               = useState(template);
  const [previewImg, setPreviewImg]     = useState(null);
  const [previewing, setPreviewing]     = useState(false);
  const [previewErr, setPreviewErr]     = useState('');
  const [sample, setSample]             = useState(DEFAULT_SAMPLE);
  const taRef = useRef(null);

  const updateSample = (field, value) =>
    setSample(prev => ({ ...prev, [field]: value }));

  const insertAtCursor = (text) => {
    const ta = taRef.current;
    if (!ta) return;
    const s = ta.selectionStart, e = ta.selectionEnd;
    setDraft(draft.slice(0, s) + text + draft.slice(e));
    requestAnimationFrame(() => {
      ta.selectionStart = ta.selectionEnd = s + text.length;
      ta.focus();
    });
  };

  const handleFormat = () =>
    setDraft(
      draft.replace(/\r\n/g, '\n').split('\n')
        .map(l => l.trimEnd()).join('\n')
        .replace(/\n{3,}/g, '\n\n')
    );

  const handlePreview = async () => {
    setPreviewing(true);
    setPreviewErr('');
    setPreviewImg(null);
    try {
      const blob = await previewZPL([sample], 'ZD230', draft);
      setPreviewImg(URL.createObjectURL(blob));
    } catch (e) {
      setPreviewErr(e.response?.data?.error || e.message);
    } finally {
      setPreviewing(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col">

        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div>
            <h3 className="font-bold text-slate-800 text-lg">แก้ไข ZPL Template (ZD230)</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              ใช้ <code className="bg-slate-100 px-1 rounded">{'{{L.field}}'}</code> สำหรับซ้าย ·{' '}
              <code className="bg-slate-100 px-1 rounded">{'{{R.field}}'}</code> สำหรับขวา
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-2xl leading-none">×</button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          <div className="flex flex-col flex-1 min-w-0 border-r border-slate-100">
            <div className="px-4 py-2 border-b border-slate-100 flex flex-wrap gap-1.5 items-center bg-slate-50">
              <span className="text-xs text-slate-400 mr-1">แทรกตัวแปร:</span>
              {FIELDS.map(f => (
                <React.Fragment key={f.name}>
                  <button onClick={() => insertAtCursor(`{{L.${f.name}}}`)}
                    className="text-xs px-2 py-0.5 rounded bg-amber-100 text-amber-700 border border-amber-200 hover:bg-amber-200 font-mono transition-colors">
                    L.{f.name}
                  </button>
                  <button onClick={() => insertAtCursor(`{{R.${f.name}}}`)}
                    className="text-xs px-2 py-0.5 rounded bg-blue-100 text-blue-700 border border-blue-200 hover:bg-blue-200 font-mono transition-colors">
                    R.{f.name}
                  </button>
                </React.Fragment>
              ))}
            </div>

            <div className="px-4 py-2 border-b border-slate-100 flex flex-wrap gap-1.5 items-center">
              <span className="text-xs text-slate-400 mr-1">Snippets:</span>
              {Object.entries(ZPL_SNIPPETS).map(([label, code]) => (
                <button key={label} onClick={() => insertAtCursor('\n' + code)}
                  className="text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200 hover:bg-slate-200 transition-colors">
                  {label}
                </button>
              ))}
            </div>

            <textarea
              ref={taRef}
              value={draft}
              onChange={e => setDraft(e.target.value)}
              spellCheck={false}
              className="flex-1 font-mono text-xs leading-relaxed p-4 resize-none outline-none bg-slate-900 text-emerald-400 min-h-0"
              style={{ caretColor: '#f5a623' }}
            />

            <div className="px-4 py-3 border-t border-slate-100 flex items-center gap-2 bg-slate-50">
              <button onClick={handleFormat}
                className="px-3 py-1.5 text-xs font-medium border border-slate-200 rounded-lg hover:bg-slate-100 text-slate-600 transition-colors">
                ⌥ Format
              </button>
              <button onClick={() => setDraft(DEFAULT_ZPL_TEMPLATE)}
                className="px-3 py-1.5 text-xs font-medium border border-slate-200 rounded-lg hover:bg-slate-100 text-slate-600 transition-colors">
                ↺ Reset
              </button>
              <div className="flex-1" />
              <button onClick={handlePreview} disabled={previewing}
                className="px-3 py-1.5 text-xs font-semibold border border-amber-300 bg-amber-50 text-amber-700 rounded-lg hover:bg-amber-100 disabled:opacity-50 transition-colors">
                {previewing ? '⏳ Rendering…' : '▶ Preview'}
              </button>
              <button onClick={() => { onSave(draft); onClose(); }}
                className="px-4 py-1.5 text-xs font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                บันทึก Template
              </button>
            </div>
          </div>

          <div className="w-72 flex-shrink-0 flex flex-col bg-slate-50">
            <div className="px-4 py-3 border-b border-slate-100">
              <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Preview (ข้อมูลตัวอย่าง)</p>
            </div>
            <div className="flex-1 p-4 flex flex-col gap-3 overflow-auto">
              {previewImg ? (
                <img src={previewImg} alt="Label preview" className="w-full rounded-lg border border-slate-200 bg-white" />
              ) : previewErr ? (
                <div className="text-xs text-red-500 bg-red-50 border border-red-200 rounded-lg p-3">{previewErr}</div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-slate-300 gap-2">
                  <span className="text-4xl">🖼️</span>
                  <p className="text-xs text-center">กด ▶ Preview<br />เพื่อดูตัวอย่าง</p>
                </div>
              )}
              <div className="bg-white border border-slate-100 rounded-lg p-3 text-xs text-slate-500 space-y-2">
                <div className="flex items-center justify-between mb-1">
                  <p className="font-semibold text-slate-600">ข้อมูลตัวอย่าง (แก้ไขได้)</p>
                  <button onClick={() => setSample(DEFAULT_SAMPLE)}
                    className="text-xs text-slate-400 hover:text-slate-600 underline">reset</button>
                </div>
                {FIELDS.map(f => (
                  <div key={f.name} className="flex flex-col gap-0.5">
                    <span className="font-mono text-slate-400">{f.name}</span>
                    <input
                      type="text"
                      value={sample[f.name] ?? ''}
                      onChange={e => updateSample(f.name, e.target.value)}
                      className="w-full border border-slate-200 rounded px-2 py-1 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-400"
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── Queue Panel ──────────────────────────────────────────────────────────────
const QueuePanel = ({ queue, onRemove, onClear, onPreviewZPL, onPrint, printing, hasPrinter }) => {
  const strips = Math.ceil(queue.length / 2);
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col">
      <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">คิวรอปริ้น</h2>
          <p className="text-xs text-slate-400 mt-0.5">{queue.length} ป้าย · {strips} แถบ</p>
        </div>
        <button onClick={onClear} disabled={queue.length === 0}
          className="text-xs px-3 py-1.5 rounded-lg border border-red-200 text-red-500 hover:bg-red-50 disabled:opacity-30 transition-colors">
          ล้างทั้งหมด
        </button>
      </div>

      <div className="flex-1 overflow-auto max-h-64 px-4 py-3 space-y-3">
        {queue.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 gap-2">
            <span className="text-4xl">🏷️</span>
            <p className="text-xs text-center text-slate-400">ยังไม่มีป้าย<br />เลือก Asset แล้วกด + เพิ่มลงคิว</p>
          </div>
        ) : (
          Array.from({ length: strips }, (_, si) => {
            const li    = si * 2;
            const left  = queue[li];
            const right = queue[li + 1] ?? null;
            return (
              <div key={si} className="rounded-xl border border-slate-200 overflow-hidden">
                <div className="bg-slate-50 px-3 py-1 text-xs font-mono text-slate-400 border-b border-slate-100">
                  แถบ {si + 1}
                </div>
                <div className="grid grid-cols-2 divide-x divide-slate-100">
                  <div className="flex items-center gap-2 px-3 py-2">
                    <span className="text-xs font-mono text-amber-600 flex-shrink-0">#{li + 1} L</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-slate-700 truncate">{left.name}</p>
                      <p className="text-xs text-slate-400 font-mono truncate">{left.sku}</p>
                    </div>
                    <button onClick={() => onRemove(li)} className="text-slate-300 hover:text-red-400 text-sm flex-shrink-0 transition-colors">✕</button>
                  </div>
                  {right ? (
                    <div className="flex items-center gap-2 px-3 py-2">
                      <span className="text-xs font-mono text-blue-500 flex-shrink-0">#{li + 2} R</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-slate-700 truncate">{right.name}</p>
                        <p className="text-xs text-slate-400 font-mono truncate">{right.sku}</p>
                      </div>
                      <button onClick={() => onRemove(li + 1)} className="text-slate-300 hover:text-red-400 text-sm flex-shrink-0 transition-colors">✕</button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center px-3 py-2">
                      <span className="text-xs text-slate-300 italic">— ว่าง —</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="px-4 py-3 border-t border-slate-100 flex gap-2">
        <button onClick={onPreviewZPL} disabled={queue.length === 0}
          className="flex-1 py-2 text-xs font-medium border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 disabled:opacity-30 transition-colors">
          👁 ดู ZPL
        </button>
        <button onClick={onPrint} disabled={queue.length === 0 || !hasPrinter || printing}
          className="flex-1 py-2 text-xs font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 transition-colors">
          {printing ? '⏳ ส่งงาน…' : '🖨️ ปริ้นทั้งหมด'}
        </button>
      </div>
    </div>
  );
};

// ─── ZPL Raw Modal ────────────────────────────────────────────────────────────
const ZplModal = ({ zpl, onClose }) => (
  <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col">
      <div className="flex items-center justify-between p-5 border-b border-slate-100">
        <h3 className="font-semibold text-slate-800">ZPL Preview</h3>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl">×</button>
      </div>
      <div className="flex-1 overflow-auto p-5">
        <pre className="text-xs font-mono bg-slate-900 text-emerald-400 p-4 rounded-xl whitespace-pre-wrap break-words leading-relaxed">{zpl}</pre>
      </div>
      <div className="p-4 border-t border-slate-100 flex justify-end gap-2">
        <button onClick={() => navigator.clipboard.writeText(zpl)}
          className="px-4 py-2 text-sm font-medium border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-600">
          📋 คัดลอก ZPL
        </button>
        <button onClick={onClose}
          className="px-4 py-2 text-sm font-medium bg-slate-800 text-white rounded-lg hover:bg-slate-700">
          ปิด
        </button>
      </div>
    </div>
  </div>
);

// ─── Main Component ───────────────────────────────────────────────────────────
const PrintLabels = () => {
  const [printerType, setPrinterType]         = useState('ZD230');
  const [printers, setPrinters]               = useState([]);
  const [selectedPrinter, setSelectedPrinter] = useState('');
  const [loadingPrinters, setLoadingPrinters] = useState(false);
  const [printerError, setPrinterError]       = useState('');
  const [assets, setAssets]                   = useState([]);
  const [selectedIds, setSelectedIds]         = useState(new Set());
  const [search, setSearch]                   = useState('');
  const [status, setStatus]                   = useState('idle');
  const [message, setMessage]                 = useState('');
  const [loadingAssets, setLoadingAssets]     = useState(true);
  const [copies, setCopies]                   = useState(1);
  const [zplTemplate, setZplTemplate]         = useState(DEFAULT_ZPL_TEMPLATE);
  const [queue, setQueue]                     = useState([]);
  const [showEditor, setShowEditor]           = useState(false);
  const [showZplModal, setShowZplModal]       = useState(false);
  const [zplModalContent, setZplModalContent] = useState('');
  const [printing, setPrinting]               = useState(false);

  // ─── Load printers ────────────────────────────────────────────────────
  const loadPrinters = useCallback(async () => {
    setLoadingPrinters(true);
    setPrinterError('');
    try {
      const data = await getPrinters();
      const list = data.printers ?? [];
      setPrinters(list);
      if (list.length === 1) setSelectedPrinter(list[0]);
    } catch (e) {
      setPrinters([]);
      setPrinterError('ไม่สามารถดึงรายการเครื่องพิมพ์ได้: ' + e.message);
    } finally {
      setLoadingPrinters(false);
    }
  }, []);

  useEffect(() => { loadPrinters(); }, [loadPrinters]);

  // ─── Load assets ──────────────────────────────────────────────────────
  useEffect(() => {
    setLoadingAssets(true);
    api.get('/assets')
      .then(r => setAssets(r.data?.assets ?? r.data ?? []))
      .catch(() => setAssets([]))
      .finally(() => setLoadingAssets(false));
  }, []);

  // ─── Filter ───────────────────────────────────────────────────────────
  const filtered = assets.filter(a => {
    const q = search.toLowerCase();
    return (a.Name ?? '').toLowerCase().includes(q) || (a.InvNo ?? '').toLowerCase().includes(q);
  });

  // ─── Selection ────────────────────────────────────────────────────────
  const toggleItem = id =>
    setSelectedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const toggleAll = () =>
    setSelectedIds(selectedIds.size === filtered.length ? new Set() : new Set(filtered.map(a => a.Id)));

  // ─── Build items ──────────────────────────────────────────────────────
  const buildItems = useCallback(() => {
    const selected = assets.filter(a => selectedIds.has(a.Id));
    const repeated = [];
    for (let c = 0; c < copies; c++) repeated.push(...selected);
    const now = new Date();
    return repeated.map(a => ({
      name:     (a.Name ?? '').substring(0, 20),
      sku:      a.InvNo    ?? '',
      barcode:  a.InvNo    ?? '',
      epc:      a.RfidTag  ?? '',
      location: a.Location ?? '',
      date:     now.toLocaleDateString('th-TH'),
      time:     now.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }),
    }));
  }, [assets, selectedIds, copies]);

  // ─── ZD230 queue actions ──────────────────────────────────────────────
  const handleAddToQueue = () => {
    if (selectedIds.size === 0) { setMessage('กรุณาเลือก Asset อย่างน้อย 1 รายการ'); return; }
    const items = buildItems();
    setQueue(prev => [...prev, ...items]);
    setSelectedIds(new Set());
    setMessage(`เพิ่ม ${items.length} ป้ายลงคิวแล้ว`);
    setStatus('success');
  };

  const handleRemoveFromQueue = idx => setQueue(prev => prev.filter((_, i) => i !== idx));

  const handleClearQueue = () => {
    if (!queue.length) return;
    if (!window.confirm(`ล้างคิว ${queue.length} ป้าย?`)) return;
    setQueue([]);
  };

  const handlePreviewQueueZPL = async () => {
    if (!queue.length) return;
    try {
      const r = await api.post('/print/preview', {
        items:       queue,
        printerType: 'ZD230',
        template:    zplTemplate,
      });
      setZplModalContent(r.data.zpl);
      setShowZplModal(true);
    } catch (e) {
      setMessage('ไม่สามารถสร้าง ZPL ได้: ' + (e.response?.data?.error || e.message));
      setStatus('error');
    }
  };

  // ─── ZD230 print ─────────────────────────────────────────────────────
  const handlePrintQueue = async () => {
    if (!selectedPrinter) { setMessage('กรุณาเลือกเครื่องพิมพ์ก่อน'); return; }
    if (!queue.length)    { setMessage('คิวว่างเปล่า'); return; }
    setPrinting(true);
    setStatus('printing');
    setMessage('');
    try {
      await printZPL(selectedPrinter, queue, 'ZD230', zplTemplate);
      setStatus('success');
      setMessage(`ปริ้นสำเร็จ ${queue.length} ป้าย (${Math.ceil(queue.length / 2)} แถบ)`);
      setQueue([]);
    } catch (e) {
      setStatus('error');
      setMessage('ปริ้นไม่สำเร็จ: ' + (e.response?.data?.error || e.message));
    } finally {
      setPrinting(false);
    }
  };

  // ─── ZT411 direct print ───────────────────────────────────────────────
  const handlePrintZT411 = async () => {
    if (!selectedPrinter)       { setMessage('กรุณาเลือกเครื่องพิมพ์ก่อน'); return; }
    if (selectedIds.size === 0) { setMessage('กรุณาเลือก Asset อย่างน้อย 1 รายการ'); return; }
    const items = buildItems();
    setStatus('printing');
    setMessage('');
    try {
      await printZPL(selectedPrinter, items, 'ZT411');
      setStatus('success');
      setMessage(`ปริ้นสำเร็จ ${items.length} ป้าย`);
    } catch (e) {
      setStatus('error');
      setMessage('ปริ้นไม่สำเร็จ: ' + (e.response?.data?.error || e.message));
    }
  };

  const selectedCount = selectedIds.size;
  const totalLabels   = selectedCount * copies;
  const isZD230       = printerType === 'ZD230';

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-6">

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">พิมพ์ป้าย Zebra</h1>
            <p className="text-sm text-slate-500 mt-0.5">เลือกเครื่องพิมพ์และ Asset แล้วกดปริ้น</p>
          </div>
          <StatusBadge status={status} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          <div className="space-y-4">

            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-3">
              <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">ประเภทเครื่องพิมพ์</h2>
              <div className="space-y-2">
                {['ZD230', 'ZT411'].map(t => (
                  <PrinterTypeCard key={t} type={t} selected={printerType === t}
                    onClick={() => { setPrinterType(t); setSelectedIds(new Set()); }} />
                ))}
              </div>
            </div>

            <PrinterSelector
              printers={printers}
              selected={selectedPrinter}
              onSelect={setSelectedPrinter}
              onRefresh={loadPrinters}
              loading={loadingPrinters}
              error={printerError}
            />

            {isZD230 && (
              <button onClick={() => setShowEditor(true)}
                className="w-full py-2.5 px-4 rounded-xl font-medium text-sm transition-all
                  border-2 border-dashed border-amber-300 text-amber-700 bg-amber-50
                  hover:border-amber-400 hover:bg-amber-100">
                ✏️ แก้ไข ZPL Template
              </button>
            )}

            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-3">
              <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">จำนวนชุด</h2>
              <div className="flex items-center gap-3">
                <button onClick={() => setCopies(c => Math.max(1, c - 1))}
                  className="w-9 h-9 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 font-bold text-lg">−</button>
                <span className="flex-1 text-center text-xl font-bold text-slate-800">{copies}</span>
                <button onClick={() => setCopies(c => Math.min(10, c + 1))}
                  className="w-9 h-9 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 font-bold text-lg">+</button>
              </div>
              <p className="text-xs text-slate-400 text-center">
                {selectedCount} รายการ × {copies} ชุด = {totalLabels} ป้าย
              </p>
            </div>

            {isZD230 ? (
              <button onClick={handleAddToQueue} disabled={selectedCount === 0}
                className="w-full py-3 px-4 rounded-xl font-semibold text-sm transition-all
                  bg-blue-600 text-white hover:bg-blue-700 active:scale-[0.98]
                  disabled:opacity-40 disabled:cursor-not-allowed shadow-sm shadow-blue-200">
                + เพิ่มลงคิว ({totalLabels} ป้าย)
              </button>
            ) : (
              <button onClick={handlePrintZT411}
                disabled={selectedCount === 0 || !selectedPrinter || status === 'printing'}
                className="w-full py-3 px-4 rounded-xl font-semibold text-sm transition-all
                  bg-violet-600 text-white hover:bg-violet-700 active:scale-[0.98]
                  disabled:opacity-40 disabled:cursor-not-allowed shadow-sm shadow-violet-200">
                {status === 'printing' ? '⏳ กำลังส่ง…' : `🖨️ พิมพ์ (${totalLabels} ป้าย)`}
              </button>
            )}

            {message && (
              <div className={`rounded-xl px-4 py-3 text-sm font-medium
                ${status === 'error'
                  ? 'bg-red-50 text-red-700 border border-red-200'
                  : 'bg-emerald-50 text-emerald-700 border border-emerald-200'}`}>
                {message}
              </div>
            )}
          </div>

          <div className="lg:col-span-2 space-y-4">

            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col">
              <div className="p-5 border-b border-slate-100 space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                    Asset ({selectedCount} / {filtered.length} เลือก)
                  </h2>
                  <button onClick={toggleAll} className="text-xs text-blue-600 hover:underline font-medium">
                    {selectedIds.size === filtered.length && filtered.length > 0 ? 'ยกเลิกทั้งหมด' : 'เลือกทั้งหมด'}
                  </button>
                </div>
                <input
                  type="text"
                  placeholder="ค้นหา ชื่อ / เลขครุภัณฑ์..."
                  value={search}
                  onChange={e => { setSearch(e.target.value); setSelectedIds(new Set()); }}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
              </div>

              <div className="overflow-auto flex-1 max-h-[480px]">
                {loadingAssets ? (
                  <div className="flex items-center justify-center h-40">
                    <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : filtered.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-40 text-slate-400 text-sm gap-2">
                    <span className="text-4xl">📦</span>
                    <span>ไม่พบ Asset</span>
                  </div>
                ) : (
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 sticky top-0 z-10">
                      <tr>
                        <th className="w-10 px-4 py-3">
                          <input type="checkbox" className="rounded"
                            checked={selectedIds.size === filtered.length && filtered.length > 0}
                            onChange={toggleAll} />
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">ชื่อ</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">เลขครุภัณฑ์</th>
                        {printerType === 'ZT411' && (
                          <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">RFID Tag</th>
                        )}
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">สถานที่</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {filtered.map(a => {
                        const id = a.Id;
                        const checked    = selectedIds.has(id);
                        const missingEpc = printerType === 'ZT411' && !a.RfidTag;
                        return (
                          <tr key={id}
                            onClick={() => !missingEpc && toggleItem(id)}
                            className={`cursor-pointer transition-colors
                              ${checked ? 'bg-blue-50' : 'hover:bg-slate-50'}
                              ${missingEpc ? 'opacity-50 cursor-not-allowed' : ''}`}>
                            <td className="px-4 py-3">
                              <input type="checkbox" className="rounded"
                                checked={checked} disabled={missingEpc}
                                onChange={() => toggleItem(id)}
                                onClick={e => e.stopPropagation()} />
                            </td>
                            <td className="px-4 py-3 font-medium text-slate-800">{a.Name ?? '-'}</td>
                            <td className="px-4 py-3 text-slate-500 font-mono text-xs">{a.InvNo ?? '-'}</td>
                            {printerType === 'ZT411' && (
                              <td className="px-4 py-3">
                                {a.RfidTag
                                  ? <span className="font-mono text-xs text-violet-700 bg-violet-50 px-1.5 py-0.5 rounded">{a.RfidTag}</span>
                                  : <span className="text-xs text-red-400 italic">ไม่มี RFID Tag</span>}
                              </td>
                            )}
                            <td className="px-4 py-3 text-slate-500 text-xs">{a.Location ?? '-'}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

            {isZD230 && (
              <QueuePanel
                queue={queue}
                onRemove={handleRemoveFromQueue}
                onClear={handleClearQueue}
                onPreviewZPL={handlePreviewQueueZPL}
                onPrint={handlePrintQueue}
                printing={printing}
                hasPrinter={!!selectedPrinter}
              />
            )}
          </div>
        </div>
      </div>

      {showEditor && (
        <TemplateEditorModal
          template={zplTemplate}
          onSave={setZplTemplate}
          onClose={() => setShowEditor(false)}
        />
      )}

      {showZplModal && (
        <ZplModal zpl={zplModalContent} onClose={() => setShowZplModal(false)} />
      )}
    </div>
  );
};

export default PrintLabels;