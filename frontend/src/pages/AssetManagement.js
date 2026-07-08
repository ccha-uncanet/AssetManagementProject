import React, { useState, useEffect, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { QRCodeCanvas } from 'qrcode.react';
import * as XLSX from 'xlsx';
import api, { assetAPI } from '../services/api';
import usePermission from '../hooks/usePermission';
import { PERMISSIONS } from '../constants/permissions';
import AssetPhotoGallery from '../components/AssetPhotoGallery';
import { exportPDF } from '../utils/exportPDF';
import {
  Plus, Search, Download, FileText, Printer, QrCode,
  Trash2, X, Loader2, Package, AlertTriangle, CheckCircle2,
  Filter, Eye, Pencil, ChevronLeft, Save, Tag, ShieldOff, Wifi
} from 'lucide-react';

// ── Status config ─────────────────────────────────────────────────────────────
const STATUS = {
  1: { label: 'ว่าง / ปกติ',  color: 'bg-green-100 text-green-700',   dot: 'bg-green-500'  },
  2: { label: 'ถูกยืม',       color: 'bg-red-100 text-red-700',      dot: 'bg-red-500'    },
  3: { label: 'ส่งซ่อม',      color: 'bg-orange-100 text-orange-700', dot: 'bg-orange-500' },
};

const StatusBadge = ({ status }) => {
  const s = STATUS[status] || STATUS[1];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${s.color}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  );
};

const inputCls = 'w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:bg-gray-50 bg-white';
const EMPTY_FORM = { name: '', description: '', serialNumber: '', purchaseDate: '', purchasePrice: '', status: 1, invNo: '', location: '', category: '' };

// ── Asset Detail / Edit Panel ─────────────────────────────────────────────────
const AssetDetail = ({ asset, categories, onClose, onSave, canEdit, canDelete, onDelete }) => {
  const [editMode, setEditMode] = useState(false);
  const [form, setForm] = useState({ ...asset });
  const [saving, setSaving] = useState(false);
  const [customCategory, setCustomCategory] = useState('');
  const [showCustom, setShowCustom] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const category = showCustom && customCategory ? customCategory : (form.Category || form.category || '');
      const payload = {
        name:          form.Name        || form.name        || '',
        description:   form.Description || form.description || '',
        serialNumber:  form.SerialNumber|| form.serialNumber|| '',
        purchaseDate:  form.PurchaseDate|| form.purchaseDate|| null,
        purchasePrice: form.PurchasePrice ?? form.purchasePrice ?? 0,
        status:        form.Status      ?? form.status      ?? 1,
        invNo:         form.InvNo       || form.invNo       || '',
        location:      form.Location    || form.location    || '',
        category,
        rfidTag:       form.RfidTag     || form.rfidTag     || '',
      };
      await onSave(asset.Id, payload);
      setEditMode(false);
    } finally { setSaving(false); }
  };

  const dateVal = form.PurchaseDate
    ? new Date(form.PurchaseDate).toISOString().split('T')[0]
    : '';

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50">
        <div className="flex items-center gap-3">
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-200 text-gray-500 transition-colors">
            <ChevronLeft size={18} />
          </button>
          <div>
            <h2 className="font-bold text-gray-900">{asset.Name}</h2>
            <p className="text-xs text-gray-500 font-mono">{asset.Id}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {canEdit && !editMode && (
            <button onClick={() => setEditMode(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors">
              <Pencil size={14} /> แก้ไข
            </button>
          )}
          {editMode && (
            <>
              <button onClick={() => { setEditMode(false); setForm({ ...asset }); }}
                className="px-3 py-1.5 text-sm text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">
                ยกเลิก
              </button>
              <button onClick={handleSave} disabled={saving}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors">
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                บันทึก
              </button>
            </>
          )}
          {canDelete && (
            <button onClick={() => onDelete(asset.Id, asset.Name)}
              className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors">
              <Trash2 size={16} />
            </button>
          )}
        </div>
      </div>

      <div className="p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="space-y-5">
          <div className="flex flex-col items-center gap-3 p-5 bg-gray-50 rounded-xl border border-gray-100">
            <QRCodeCanvas value={String(asset.Id)} size={140} level="H" />
            <div className="text-center">
              <p className="text-xs text-gray-400 font-mono break-all">{asset.Id}</p>
              <p className="text-xs text-gray-500 mt-1">InvNo: <span className="font-semibold">{asset.InvNo || '-'}</span></p>
            </div>
          </div>
          <AssetPhotoGallery assetId={asset.Id} canEdit={canEdit} />
        </div>

        <div className="lg:col-span-2 space-y-4">
          {editMode ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">ชื่อทรัพย์สิน *</label>
                <input type="text" required value={form.Name || ''} onChange={e => setForm(p => ({ ...p, Name: e.target.value }))} disabled={saving} className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">รหัสทรัพย์สิน (InvNo)</label>
                <input type="text" value={form.InvNo || ''} onChange={e => setForm(p => ({ ...p, InvNo: e.target.value }))} disabled={saving} className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Serial Number</label>
                <input type="text" value={form.SerialNumber || ''} onChange={e => setForm(p => ({ ...p, SerialNumber: e.target.value }))} disabled={saving} className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">สถานะ</label>
                <select value={form.Status || 1} onChange={e => setForm(p => ({ ...p, Status: parseInt(e.target.value) }))} disabled={saving} className={inputCls}>
                  <option value={1}>ว่าง / ปกติ</option>
                  <option value={2}>ถูกยืม</option>
                  <option value={3}>ส่งซ่อม</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">วันที่ซื้อ</label>
                <input type="date" value={dateVal} onChange={e => setForm(p => ({ ...p, PurchaseDate: e.target.value }))} disabled={saving} className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">ราคา (บาท)</label>
                <input type="number" step="0.01" value={form.PurchasePrice || ''} onChange={e => setForm(p => ({ ...p, PurchasePrice: e.target.value }))} disabled={saving} className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">สถานที่เก็บ</label>
                <input type="text" value={form.Location || ''} onChange={e => setForm(p => ({ ...p, Location: e.target.value }))} disabled={saving} className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">หมวดหมู่</label>
                {!showCustom ? (
                  <div className="flex gap-2">
                    <select value={form.Category || ''} onChange={e => setForm(p => ({ ...p, Category: e.target.value }))} disabled={saving} className={inputCls}>
                      <option value="">-- เลือกหมวดหมู่ --</option>
                      {categories.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <button type="button" onClick={() => setShowCustom(true)}
                      className="px-2 py-1 text-xs text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 whitespace-nowrap">+ ใหม่</button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <input type="text" placeholder="พิมพ์หมวดหมู่ใหม่" value={customCategory}
                      onChange={e => setCustomCategory(e.target.value)} className={inputCls} />
                    <button type="button" onClick={() => setShowCustom(false)}
                      className="px-2 py-1 text-xs text-gray-500 bg-gray-100 rounded-lg hover:bg-gray-200">ยกเลิก</button>
                  </div>
                )}
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-gray-600 mb-1.5">รายละเอียด</label>
                <textarea value={form.Description || ''} onChange={e => setForm(p => ({ ...p, Description: e.target.value }))} rows={3} disabled={saving} className={`${inputCls} resize-none`} />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-gray-600 mb-1.5 flex items-center gap-1.5">
                  <Wifi size={12} className="text-violet-500" /> RFID Tag
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={form.RfidTag || ''}
                    onChange={e => setForm(p => ({ ...p, RfidTag: e.target.value }))}
                    disabled={saving}
                    placeholder="เชื่อมต่อ RFID Reader แล้วสแกน หรือพิมพ์ Tag ID..."
                    className={`${inputCls} font-mono pr-20`}
                  />
                  {form.RfidTag && (
                    <button
                      type="button"
                      onClick={() => setForm(p => ({ ...p, RfidTag: '' }))}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-red-400 hover:text-red-600 px-2 py-0.5 rounded"
                    >
                      ล้าง
                    </button>
                  )}
                </div>
                <p className="text-xs text-gray-400 mt-1">คลิกที่ช่องนี้แล้วสแกน RFID Reader จะพิมพ์ Tag ID อัตโนมัติ</p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[
                { label: 'ชื่อทรัพย์สิน', value: asset.Name },
                { label: 'InvNo', value: asset.InvNo || '-', mono: true },
                { label: 'Serial Number', value: asset.SerialNumber || '-', mono: true },
                { label: 'วันที่ซื้อ', value: asset.PurchaseDate ? new Date(asset.PurchaseDate).toLocaleDateString('th-TH') : '-' },
                { label: 'ราคา', value: asset.PurchasePrice ? `฿${Number(asset.PurchasePrice).toLocaleString()}` : '-' },
                { label: 'สถานที่', value: asset.Location || '-' },
                { label: 'หมวดหมู่', value: asset.Category || '-' },
              ].map(item => (
                <div key={item.label} className="bg-gray-50 rounded-xl p-3">
                  <p className="text-xs text-gray-400 mb-0.5">{item.label}</p>
                  <p className={`font-medium text-gray-800 text-sm ${item.mono ? 'font-mono' : ''}`}>{item.value}</p>
                </div>
              ))}
              <div className="bg-gray-50 rounded-xl p-3">
                <p className="text-xs text-gray-400 mb-1">สถานะ</p>
                <StatusBadge status={asset.Status} />
              </div>
              {asset.Description && (
                <div className="sm:col-span-2 bg-gray-50 rounded-xl p-3">
                  <p className="text-xs text-gray-400 mb-0.5">รายละเอียด</p>
                  <p className="text-sm text-gray-700">{asset.Description}</p>
                </div>
              )}
              <div className="sm:col-span-2 bg-gray-50 rounded-xl p-3">
                <p className="text-xs text-gray-400 mb-1 flex items-center gap-1.5">
                  <Wifi size={11} className="text-violet-500" /> RFID Tag
                </p>
                {asset.RfidTag ? (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-violet-100 text-violet-700 rounded-lg text-xs font-mono font-medium">
                    <Wifi size={11} /> {asset.RfidTag}
                  </span>
                ) : (
                  <p className="text-sm text-gray-400 italic">ยังไม่ได้ผูก RFID Tag</p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ── Main Component ────────────────────────────────────────────────────────────
const AssetManagement = () => {
  const [assets, setAssets]               = useState([]);
  const [categories, setCategories]       = useState([]);
  const [loading, setLoading]             = useState(true);
  const [permissionDenied, setPermissionDenied] = useState(false); // ── ใหม่
  const [searchTerm, setSearchTerm]       = useState('');
  const [statusFilter, setStatusFilter]   = useState('all');
  const [formData, setFormData]           = useState(EMPTY_FORM);
  const [showForm, setShowForm]           = useState(false);
  const [formLoading, setFormLoading]     = useState(false);
  const [showCustomCat, setShowCustomCat] = useState(false);
  const [customCat, setCustomCat]         = useState('');
  const [selectedIds, setSelectedIds]     = useState([]);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [printing, setPrinting]           = useState(false);
  const [printerIp, setPrinterIp]         = useState('192.168.1.200');
  const [printerPort, setPrinterPort]     = useState(9100);
  const [selectedAsset, setSelectedAsset] = useState(null);
  const [toast, setToast]                 = useState(null);

  const { can } = usePermission();
  const location = useLocation();
  const navigate  = useNavigate();

  useEffect(() => {
    if (location.state?.statusFilter) {
      setStatusFilter(location.state.statusFilter);
      window.history.replaceState({}, '');
    }
  }, []);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  // ── Fetch ─────────────────────────────────────────────────────────────────
  const fetchAssets = useCallback(async () => {
    setLoading(true);
    setPermissionDenied(false);
    try {
      const res = await assetAPI.getAll();
      setAssets(res.data);
    } catch (err) {
      // ── แยก 403 (ไม่มีสิทธิ์) ออกจาก error อื่น ──
      if (err.response?.status === 403) {
        setPermissionDenied(true);
      } else {
        showToast('ไม่สามารถดึงข้อมูลได้', 'error');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchCategories = useCallback(async () => {
    try {
      const res = await api.get('/assets/categories');
      setCategories(res.data.map(r => r.Category));
    } catch { console.error('fetch categories error'); }
  }, []);

  useEffect(() => { fetchAssets(); fetchCategories(); }, []);

  // ── Filter ────────────────────────────────────────────────────────────────
  const filteredAssets = assets.filter(a => {
    const matchSearch =
      a.Name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      a.InvNo?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      a.Location?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      a.Category?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      a.SerialNumber?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchStatus = statusFilter === 'all' || String(a.Status) === statusFilter;
    return matchSearch && matchStatus;
  });

  // ── CRUD ──────────────────────────────────────────────────────────────────
  const handleCreate = async (e) => {
    e.preventDefault();
    setFormLoading(true);
    try {
      const payload = { ...formData };
      if (showCustomCat && customCat) payload.category = customCat;
      await assetAPI.create(payload);
      showToast('เพิ่มทรัพย์สินสำเร็จ');
      setFormData(EMPTY_FORM);
      setShowForm(false);
      setShowCustomCat(false);
      setCustomCat('');
      fetchAssets();
      fetchCategories();
    } catch (err) {
      showToast(err.response?.data?.message || 'เพิ่มข้อมูลไม่สำเร็จ', 'error');
    } finally { setFormLoading(false); }
  };

  const handleUpdate = async (id, data) => {
    try {
      const res = await api.put(`/assets/${id}`, data);
      const updated = res.data?.asset || { ...data, Id: id };
      showToast('อัปเดตทรัพย์สินสำเร็จ');
      // Refresh the detail panel with the server's response so all fields (incl. RfidTag) reflect truth
      setSelectedAsset(prev => prev && prev.Id === id ? { ...prev, ...updated } : prev);
      setAssets(prev => prev.map(a => a.Id === id ? { ...a, ...updated } : a));
      fetchAssets();
      fetchCategories();

      // ── redirect ตามสถานะที่เลือก ──────────────────────────────────────
      const newStatus = data.status ?? data.Status;
      if (newStatus === 3) {
        // ส่งซ่อม → ไปหน้า Dashboard Tab คำขอซ่อม
        setTimeout(() => navigate('/app/dashboard', { state: { openTab: 'repairs' } }), 800);
      } else if (newStatus === 2) {
        // ถูกยืม → ไปหน้าสแกนทรัพย์สิน (ดูประวัติยืม)
        setTimeout(() => navigate('/app/scan'), 800);
      }
    } catch (err) {
      showToast(err.response?.data?.message || 'อัปเดตไม่สำเร็จ', 'error');
      throw err;
    }
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`ยืนยันการลบ "${name}" ?`)) return;
    try {
      await assetAPI.delete(id);
      showToast('ลบข้อมูลเรียบร้อย');
      setSelectedIds(prev => prev.filter(x => x !== id));
      if (selectedAsset?.Id === id) setSelectedAsset(null);
      fetchAssets();
    } catch { showToast('ลบไม่สำเร็จ', 'error'); }
  };

  const handleBulkDelete = async () => {
    if (!selectedIds.length) return;
    if (!window.confirm(`ยืนยันการลบ ${selectedIds.length} รายการที่เลือก?`)) return;
    try {
      await Promise.all(selectedIds.map(id => assetAPI.delete(id)));
      showToast(`ลบ ${selectedIds.length} รายการสำเร็จ`);
      setSelectedIds([]);
      if (selectedIds.includes(selectedAsset?.Id)) setSelectedAsset(null);
      fetchAssets();
    } catch { showToast('ลบบางรายการไม่สำเร็จ', 'error'); }
  };

  const toggleSelect = (id) =>
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  const toggleSelectAll = () =>
    setSelectedIds(selectedIds.length === filteredAssets.length ? [] : filteredAssets.map(a => a.Id));

  // ── Export ────────────────────────────────────────────────────────────────
  const handleExportExcel = () => {
    const data = filteredAssets.map((a, i) => ({
      'ลำดับ': i + 1, 'InvNo': a.InvNo || '-', 'ชื่อรายการ': a.Name,
      'Serial Number': a.SerialNumber || '-',
      'วันที่ซื้อ': a.PurchaseDate ? new Date(a.PurchaseDate).toLocaleDateString('th-TH') : '-',
      'ราคา (บาท)': a.PurchasePrice || 0, 'สถานที่': a.Location || '-',
      'หมวดหมู่': a.Category || '-', 'สถานะ': STATUS[a.Status]?.label || '-',
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'ทรัพย์สิน');
    ws['!cols'] = Object.keys(data[0] || {}).map(() => ({ wch: 20 }));
    XLSX.writeFile(wb, `รายการทรัพย์สิน_${new Date().toLocaleDateString('th-TH')}.xlsx`);
  };

  const handleExportPDF = () => {
    exportPDF({
      title: 'รายการทรัพย์สินทั้งหมด',
      filename: 'รายการทรัพย์สิน',
      orientation: 'landscape',
      columns: ['#', 'InvNo', 'ชื่อรายการ', 'S/N', 'วันที่ซื้อ', 'ราคา (บาท)', 'สถานที่', 'หมวดหมู่', 'สถานะ'],
      rows: filteredAssets.map((a, i) => [
        i + 1, a.InvNo || '-', a.Name, a.SerialNumber || '-',
        a.PurchaseDate ? new Date(a.PurchaseDate).toLocaleDateString('th-TH') : '-',
        a.PurchasePrice ? Number(a.PurchasePrice).toLocaleString() : '0',
        a.Location || '-', a.Category || '-', STATUS[a.Status]?.label || '-',
      ]),
    });
  };

  const handlePrintQR = () => {
    const toPrint = assets.filter(a => selectedIds.includes(a.Id));
    if (!toPrint.length) { showToast('กรุณาเลือกทรัพย์สินก่อน', 'error'); return; }
    const qrImages = {};
    toPrint.forEach(asset => {
      const canvas = document.querySelector(`canvas[data-id="${asset.Id}"]`);
      if (canvas) qrImages[asset.Id] = canvas.toDataURL('image/png');
    });
    const stickers = toPrint.map(a => `
      <div class="sticker">
        <img src="${qrImages[a.Id]||''}" />
        <div class="info">
          <div class="name">${a.Name}</div>
          <div class="sub">InvNo: ${a.InvNo||'-'}</div>
          <div class="sub">SN: ${a.SerialNumber||'-'}</div>
          <div class="sub">${a.Location||''}</div>
        </div>
      </div>`).join('');
    const w = window.open('','_blank');
    w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"/>
      <style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:sans-serif;background:white}
      .page{width:210mm;padding:5mm;display:flex;flex-wrap:wrap;gap:3mm}
      .sticker{width:97mm;height:25mm;border:1px dashed #aaa;border-radius:3px;display:flex;align-items:center;padding:2mm;gap:2mm;page-break-inside:avoid}
      .sticker img{width:21mm;height:21mm;flex-shrink:0}.info{flex:1;overflow:hidden}
      .name{font-size:8pt;font-weight:bold;margin-bottom:1.5mm;word-break:break-word}
      .sub{font-size:7pt;color:#444;margin-bottom:0.8mm}
      @media print{@page{size:A4;margin:0}.no-print{display:none}}</style></head>
      <body>
        <div class="no-print" style="padding:10px;background:#f0f0f0;text-align:center">
          <button onclick="window.print()" style="padding:8px 20px;background:#007bff;color:white;border:none;border-radius:4px;cursor:pointer">🖨️ พิมพ์</button>
          <button onclick="window.close()" style="padding:8px 20px;margin-left:10px;cursor:pointer">❌ ปิด</button>
          <span style="margin-left:15px;color:#666">${toPrint.length} สติกเกอร์</span>
        </div>
        <div class="page">${stickers}</div>
      </body></html>`);
    w.document.close();
  };

  const handlePrintNetwork = async () => {
    const toPrint = assets.filter(a => selectedIds.includes(a.Id));
    if (!toPrint.length) return;
    setPrinting(true);
    try {
      const res = await api.post('/print/network', { assets: toPrint, ip: printerIp, port: parseInt(printerPort) });
      showToast(res.data.message);
      setShowPrintModal(false);
    } catch (err) { showToast('พิมพ์ไม่สำเร็จ: ' + (err.response?.data?.error || err.message), 'error'); }
    finally { setPrinting(false); }
  };

  const handlePrintUSB = async () => {
    const toPrint = assets.filter(a => selectedIds.includes(a.Id));
    if (!toPrint.length) return;
    setPrinting(true);
    try {
      const res = await api.post('/print/zpl', { assets: toPrint });
      const bpRes = await fetch('http://127.0.0.1:9100/write', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ device: { name: 'ZD230', uid: 'USB' }, zpl: res.data.zpl })
      });
      if (!bpRes.ok) throw new Error('Zebra Browser Print ตอบกลับผิดพลาด');
      showToast(`ส่งงานพิมพ์สำเร็จ ${toPrint.length} สติกเกอร์`);
      setShowPrintModal(false);
    } catch (err) { showToast('กรุณาตรวจสอบ Zebra Browser Print: ' + err.message, 'error'); }
    finally { setPrinting(false); }
  };

  // ── 403 Permission Denied UI ──────────────────────────────────────────────
  if (!loading && permissionDenied) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="w-16 h-16 bg-orange-100 rounded-2xl flex items-center justify-center mb-4">
          <ShieldOff size={28} className="text-orange-500" />
        </div>
        <h2 className="text-lg font-bold text-gray-800">ไม่มีสิทธิ์เข้าถึง</h2>
        <p className="text-sm text-gray-400 mt-2 max-w-xs">
          บัญชีของคุณไม่มีสิทธิ์ดูรายการทรัพย์สิน
          กรุณาติดต่อ Admin เพื่อขอสิทธิ์เพิ่มเติม
        </p>
      </div>
    );
  }

  // ── Detail Panel ──────────────────────────────────────────────────────────
  if (selectedAsset) {
    return (
      <div className="space-y-5">
        {toast && (
          <div className={`fixed top-5 right-5 z-50 flex items-center gap-3 px-5 py-3 rounded-xl shadow-lg text-sm font-medium
            ${toast.type==='error'?'bg-red-600 text-white':'bg-gray-900 text-white'}`}>
            {toast.type==='error'?<AlertTriangle size={16}/>:<CheckCircle2 size={16}/>}
            {toast.message}
          </div>
        )}
        <AssetDetail
          asset={selectedAsset}
          categories={categories}
          onClose={() => setSelectedAsset(null)}
          onSave={handleUpdate}
          canEdit={can(PERMISSIONS.EDIT_ASSET)}
          canDelete={can(PERMISSIONS.DELETE_ASSET)}
          onDelete={handleDelete}
        />
      </div>
    );
  }

  // ── Main List ─────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">
      {toast && (
        <div className={`fixed top-5 right-5 z-50 flex items-center gap-3 px-5 py-3 rounded-xl shadow-lg text-sm font-medium
          ${toast.type==='error'?'bg-red-600 text-white':'bg-gray-900 text-white'}`}>
          {toast.type==='error'?<AlertTriangle size={16}/>:<CheckCircle2 size={16}/>}
          {toast.message}
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">จัดการทรัพย์สิน</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            ทั้งหมด <span className="font-medium text-gray-700">{assets.length}</span> รายการ
            {(searchTerm || statusFilter !== 'all') ? ` · แสดง ${filteredAssets.length} รายการ` : ''}
          </p>
        </div>
        {can(PERMISSIONS.CREATE_ASSET) && (
          <button onClick={() => setShowForm(v => !v)}
            className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 transition-colors shadow-sm">
            {showForm ? <X size={16}/> : <Plus size={16}/>}
            {showForm ? 'ยกเลิก' : 'เพิ่มทรัพย์สิน'}
          </button>
        )}
      </div>

      {showForm && can(PERMISSIONS.CREATE_ASSET) && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <h2 className="font-semibold text-gray-800 mb-5 flex items-center gap-2">
            <Plus size={16} className="text-blue-600"/> เพิ่มทรัพย์สินใหม่
          </h2>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[
                { key:'name', label:'ชื่อทรัพย์สิน *', placeholder:'ชื่อทรัพย์สิน', required:true },
                { key:'invNo', label:'รหัสทรัพย์สิน (InvNo)', placeholder:'INV-2024-001' },
                { key:'serialNumber', label:'Serial Number', placeholder:'Serial Number' },
                { key:'location', label:'สถานที่เก็บ', placeholder:'ห้อง / อาคาร' },
                { key:'purchasePrice', label:'ราคา (บาท)', placeholder:'0.00', type:'number' },
              ].map(f => (
                <div key={f.key}>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">{f.label}</label>
                  <input type={f.type||'text'} placeholder={f.placeholder} required={f.required}
                    value={formData[f.key]}
                    onChange={e => setFormData(p => ({ ...p, [f.key]: e.target.value }))}
                    disabled={formLoading} className={inputCls}/>
                </div>
              ))}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">หมวดหมู่</label>
                {!showCustomCat ? (
                  <div className="flex gap-2">
                    <select value={formData.category}
                      onChange={e => setFormData(p => ({ ...p, category: e.target.value }))}
                      disabled={formLoading} className={inputCls}>
                      <option value="">-- เลือกหมวดหมู่ --</option>
                      {categories.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <button type="button" onClick={() => setShowCustomCat(true)}
                      className="px-2 py-1 text-xs text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 whitespace-nowrap">+ ใหม่</button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <input type="text" placeholder="พิมพ์หมวดหมู่ใหม่" value={customCat}
                      onChange={e => setCustomCat(e.target.value)} className={inputCls}/>
                    <button type="button" onClick={() => setShowCustomCat(false)}
                      className="px-2 py-1 text-xs text-gray-500 bg-gray-100 rounded-lg hover:bg-gray-200">ยกเลิก</button>
                  </div>
                )}
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">วันที่ซื้อ</label>
                <input type="date" value={formData.purchaseDate}
                  onChange={e => setFormData(p => ({ ...p, purchaseDate: e.target.value }))}
                  disabled={formLoading} className={inputCls}/>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">สถานะ</label>
                <select value={formData.status}
                  onChange={e => setFormData(p => ({ ...p, status: parseInt(e.target.value) }))}
                  disabled={formLoading} className={inputCls}>
                  <option value={1}>ว่าง / ปกติ</option>
                  <option value={2}>ถูกยืม</option>
                  <option value={3}>ส่งซ่อม</option>
                </select>
              </div>
              <div className="sm:col-span-2 lg:col-span-3">
                <label className="block text-xs font-medium text-gray-600 mb-1.5">รายละเอียด</label>
                <input type="text" placeholder="รายละเอียดเพิ่มเติม" value={formData.description}
                  onChange={e => setFormData(p => ({ ...p, description: e.target.value }))}
                  disabled={formLoading} className={inputCls}/>
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={() => { setShowForm(false); setFormData(EMPTY_FORM); setShowCustomCat(false); setCustomCat(''); }}
                className="px-5 py-2 text-sm text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">ยกเลิก</button>
              <button type="submit" disabled={formLoading}
                className="flex items-center gap-2 px-5 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors">
                {formLoading ? <><Loader2 size={14} className="animate-spin"/> กำลังบันทึก...</> : 'บันทึกข้อมูล'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-48">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
            <input type="text" placeholder="ค้นหาชื่อ, InvNo, สถานที่, หมวดหมู่, S/N..."
              value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"/>
          </div>
          <div className="relative">
            <Filter size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
              className="pl-8 pr-8 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none bg-white">
              <option value="all">ทุกสถานะ</option>
              <option value="1">ว่าง / ปกติ</option>
              <option value="2">ถูกยืม</option>
              <option value="3">ส่งซ่อม</option>
            </select>
          </div>
          <div className="h-6 w-px bg-gray-200"/>
          {can(PERMISSIONS.EXPORT_ASSETS) && (
            <>
              <button onClick={handleExportExcel} className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-green-700 bg-green-50 rounded-lg hover:bg-green-100 transition-colors">
                <Download size={14}/> Excel
              </button>
              <button onClick={handleExportPDF} className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-red-700 bg-red-50 rounded-lg hover:bg-red-100 transition-colors">
                <FileText size={14}/> PDF
              </button>
            </>
          )}
          {can(PERMISSIONS.DELETE_ASSET) && selectedIds.length > 0 && (
            <>
              <div className="h-6 w-px bg-gray-200"/>
              <button onClick={handleBulkDelete}
                className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-red-700 bg-red-50 rounded-lg hover:bg-red-100 transition-colors border border-red-200">
                <Trash2 size={14}/> ลบที่เลือก ({selectedIds.length})
              </button>
            </>
          )}
          {can(PERMISSIONS.PRINT_LABEL) && (
            <>
              <button onClick={() => { if (!selectedIds.length) { showToast('กรุณาเลือกทรัพย์สินก่อน','error'); return; } setShowPrintModal(true); }}
                className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-purple-700 bg-purple-50 rounded-lg hover:bg-purple-100 transition-colors">
                <Printer size={14}/> ZPL {selectedIds.length > 0 && `(${selectedIds.length})`}
              </button>
              <button onClick={handlePrintQR} className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-cyan-700 bg-cyan-50 rounded-lg hover:bg-cyan-100 transition-colors">
                <QrCode size={14}/> QR A4 {selectedIds.length > 0 && `(${selectedIds.length})`}
              </button>
            </>
          )}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="flex flex-col items-center gap-3">
              <Loader2 size={28} className="animate-spin text-blue-500"/>
              <p className="text-sm text-gray-400">กำลังโหลดข้อมูล...</p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="px-4 py-3 text-center w-10">
                    {can(PERMISSIONS.PRINT_LABEL) && (
                      <input type="checkbox"
                        checked={selectedIds.length === filteredAssets.length && filteredAssets.length > 0}
                        onChange={toggleSelectAll} className="rounded border-gray-300"/>
                    )}
                  </th>
                  <th className="px-4 py-3 text-center w-20 text-xs font-semibold text-gray-500 uppercase tracking-wide">QR</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">InvNo</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">ชื่อทรัพย์สิน</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">สถานที่</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">หมวดหมู่</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">ราคา</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">สถานะ</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">จัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filteredAssets.map(asset => (
                  <tr key={asset.Id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-center">
                      {can(PERMISSIONS.PRINT_LABEL) && (
                        <input type="checkbox" checked={selectedIds.includes(asset.Id)}
                          onChange={() => toggleSelect(asset.Id)} className="rounded border-gray-300"/>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex justify-center">
                        <QRCodeCanvas value={String(asset.Id)} size={44} level="H" data-id={asset.Id}/>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs bg-gray-100 px-2 py-0.5 rounded text-gray-700">
                        {asset.InvNo || '-'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{asset.Name}</p>
                      {asset.SerialNumber && <p className="text-xs text-gray-400 mt-0.5">S/N: {asset.SerialNumber}</p>}
                    </td>
                    <td className="px-4 py-3 text-gray-600 text-xs">{asset.Location || '-'}</td>
                    <td className="px-4 py-3">
                      {asset.Category
                        ? <span className="inline-flex items-center gap-1 text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">
                            <Tag size={10}/>{asset.Category}
                          </span>
                        : <span className="text-gray-400 text-xs">-</span>}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-gray-700 tabular-nums text-xs">
                      {asset.PurchasePrice ? Number(asset.PurchasePrice).toLocaleString() : '-'}
                    </td>
                    <td className="px-4 py-3 text-center"><StatusBadge status={asset.Status}/></td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1.5">
                        <button onClick={() => setSelectedAsset(asset)}
                          className="p-1.5 rounded-lg hover:bg-blue-50 text-gray-400 hover:text-blue-600 transition-colors" title="ดูรายละเอียด">
                          <Eye size={15}/>
                        </button>
                        {can(PERMISSIONS.EDIT_ASSET) && (
                          <button onClick={() => setSelectedAsset(asset)}
                            className="p-1.5 rounded-lg hover:bg-green-50 text-gray-400 hover:text-green-600 transition-colors" title="แก้ไข">
                            <Pencil size={15}/>
                          </button>
                        )}
                        {can(PERMISSIONS.DELETE_ASSET) && (
                          <button onClick={() => handleDelete(asset.Id, asset.Name)}
                            className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors" title="ลบ">
                            <Trash2 size={15}/>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredAssets.length === 0 && !loading && (
                  <tr>
                    <td colSpan="9" className="py-16 text-center">
                      <Package size={32} className="mx-auto text-gray-300 mb-3"/>
                      <p className="text-gray-400 text-sm">
                        {searchTerm || statusFilter !== 'all' ? 'ไม่พบผลการค้นหา' : 'ยังไม่มีข้อมูลทรัพย์สินในระบบ'}
                      </p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showPrintModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-900 flex items-center gap-2">
                <Printer size={18} className="text-purple-600"/> เลือกเครื่องพิมพ์
              </h3>
              <button onClick={() => setShowPrintModal(false)} className="p-1.5 rounded-lg hover:bg-gray-100">
                <X size={18} className="text-gray-500"/>
              </button>
            </div>
            <p className="text-sm text-gray-500 mb-5">
              พิมพ์ <strong className="text-gray-800">{selectedIds.length}</strong> สติกเกอร์
            </p>
            <div className="border-2 border-blue-200 rounded-xl p-4 mb-3">
              <p className="font-semibold text-gray-800 mb-3">🌐 Zebra ZT411 (Network)</p>
              <div className="flex gap-2 mb-3">
                <div className="flex-1">
                  <label className="block text-xs text-gray-500 mb-1">IP Address</label>
                  <input type="text" value={printerIp} onChange={e => setPrinterIp(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"/>
                </div>
                <div className="w-24">
                  <label className="block text-xs text-gray-500 mb-1">Port</label>
                  <input type="number" value={printerPort} onChange={e => setPrinterPort(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"/>
                </div>
              </div>
              <button onClick={handlePrintNetwork} disabled={printing}
                className="w-full py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2">
                {printing ? <><Loader2 size={14} className="animate-spin"/> กำลังส่ง...</> : '🖨️ พิมพ์ผ่าน ZT411'}
              </button>
            </div>
            <div className="border-2 border-purple-200 rounded-xl p-4 mb-5">
              <p className="font-semibold text-gray-800 mb-1">🔌 Zebra ZD230 (USB)</p>
              <p className="text-xs text-gray-400 mb-3">ต้องติดตั้ง Zebra Browser Print ก่อนใช้งาน</p>
              <button onClick={handlePrintUSB} disabled={printing}
                className="w-full py-2.5 bg-purple-600 text-white text-sm font-semibold rounded-lg hover:bg-purple-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2">
                {printing ? <><Loader2 size={14} className="animate-spin"/> กำลังส่ง...</> : '🖨️ พิมพ์ผ่าน ZD230'}
              </button>
            </div>
            <button onClick={() => setShowPrintModal(false)} disabled={printing}
              className="w-full py-2.5 text-sm text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors disabled:opacity-50">
              ยกเลิก
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AssetManagement;