import React, { useState, useRef, useEffect } from 'react';
import api from '../services/api';
import usePermission from '../hooks/usePermission';
import { PERMISSIONS } from '../constants/permissions';
import AssetPhotoGallery from '../components/AssetPhotoGallery';
import RepairRequestModal from '../components/RepairRequestModal';
import BorrowRequestModal from '../components/BorrowRequestModal';
// ── 1. เพิ่มการ Import AssetScanner ที่เราสร้างไว้ ────────────────────────────
import AssetScanner from '../components/AssetScanner';
import {
  ScanLine, Search, X, Loader2, AlertTriangle, CheckCircle2,
  Package, Wrench, ArrowDownToLine, ArrowUpFromLine, RefreshCw,
  Pencil, Save, Tag, MapPin, Hash, Calendar, DollarSign,
  ChevronRight, Info
} from 'lucide-react';

// ── Status config ─────────────────────────────────────────────────────────────
const STATUS = {
  1: { label: 'ว่าง / ปกติ',   color: 'bg-green-100 text-green-700',   dot: 'bg-green-500',  border: 'border-green-200'  },
  2: { label: 'ถูกยืม',       color: 'bg-red-100 text-red-700',       dot: 'bg-red-500',    border: 'border-red-200'    },
  3: { label: 'ส่งซ่อม',      color: 'bg-orange-100 text-orange-700', dot: 'bg-orange-500', border: 'border-orange-200' },
};

// ── Modal configs ─────────────────────────────────────────────────────────────
const MODAL_CONFIGS = {
  borrow:     { title: 'ขอยืมทรัพย์สิน',        newStatus: 2,    fields: ['borrowerName','expectedReturnDate','note'] },
  return:     { title: 'คืนทรัพย์สิน',           newStatus: null, fields: ['returnerName','condition','note'] },
  repairDone: { title: 'ซ่อมเสร็จ — นำเข้าคลัง', newStatus: 1,    fields: ['note'] },
};

const inputCls = 'w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white';

// ── Action Modal (ยืม / คืน / ซ่อมเสร็จ) ─────────────────────────────────────
const ActionModal = ({ type, assetName, onConfirm, onClose }) => {
  const config = MODAL_CONFIGS[type];
  const [form, setForm] = useState({ borrowerName:'', expectedReturnDate:'', returnerName:'', condition:'', note:'' });
  const firstRef = useRef(null);
  useEffect(() => { firstRef.current?.focus(); }, []);

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const handleSubmit = (e) => {
    e.preventDefault();
    if (config.fields.includes('borrowerName') && !form.borrowerName.trim()) return;
    if (config.fields.includes('expectedReturnDate') && !form.expectedReturnDate) return;
    if (config.fields.includes('returnerName') && !form.returnerName.trim()) return;
    if (config.fields.includes('condition') && !form.condition) return;
    onConfirm({ ...form });
  };

  const MODAL_ICON = {
    borrow:     <ArrowUpFromLine size={20} className="text-red-500"/>,
    return:     <ArrowDownToLine size={20} className="text-green-500"/>,
    repairDone: <CheckCircle2 size={20} className="text-green-500"/>,
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={e => e.target===e.currentTarget && onClose()}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-gray-900 flex items-center gap-2">
            {MODAL_ICON[type]} {config.title}
          </h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100"><X size={18} className="text-gray-500"/></button>
        </div>
        <div className="bg-gray-50 rounded-xl px-4 py-2.5 mb-5 text-sm text-gray-600">
          ทรัพย์สิน: <span className="font-semibold text-gray-900">{assetName}</span>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {config.fields.includes('borrowerName') && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">ชื่อผู้ยืม *</label>
              <input ref={firstRef} type="text" required placeholder="ชื่อ-นามสกุลผู้ยืม"
                value={form.borrowerName} onChange={e => set('borrowerName', e.target.value)} className={inputCls}/>
            </div>
          )}
          {config.fields.includes('expectedReturnDate') && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">กำหนดคืน *</label>
              <input type="date" required value={form.expectedReturnDate}
                onChange={e => set('expectedReturnDate', e.target.value)} className={inputCls}/>
            </div>
          )}
          {config.fields.includes('returnerName') && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">ชื่อผู้คืน *</label>
              <input ref={firstRef} type="text" required placeholder="ชื่อ-นามสกุลผู้คืน"
                value={form.returnerName} onChange={e => set('returnerName', e.target.value)} className={inputCls}/>
            </div>
          )}
          {config.fields.includes('condition') && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">สภาพทรัพย์สิน *</label>
              <div className="space-y-2">
                {[
                  { value:'normal',  label:'ปกติ — ใช้งานได้ตามปกติ', color:'green'  },
                  { value:'damaged', label:'ชำรุด — ต้องส่งซ่อมต่อ',   color:'orange' },
                ].map(opt => (
                  <label key={opt.value} className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all
                    ${form.condition===opt.value
                      ? opt.color==='green' ? 'border-green-400 bg-green-50' : 'border-orange-400 bg-orange-50'
                      : 'border-gray-200 hover:border-gray-300'}`}>
                    <input type="radio" name="condition" value={opt.value}
                      checked={form.condition===opt.value} onChange={() => set('condition', opt.value)}
                      className="accent-blue-600"/>
                    <span className={`text-sm font-medium ${form.condition===opt.value
                      ? opt.color==='green' ? 'text-green-700' : 'text-orange-700'
                      : 'text-gray-700'}`}>
                      {opt.color==='green' ? '🟢' : '🟠'} {opt.label}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}
          {config.fields.includes('note') && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">หมายเหตุ</label>
              <textarea ref={config.fields[0]==='note' ? firstRef : null}
                rows={3} placeholder="หมายเหตุเพิ่มเติม..."
                value={form.note} onChange={e => set('note', e.target.value)}
                className={`${inputCls} resize-none`}/>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 py-2.5 text-sm text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors">
              ยกเลิก
            </button>
            <button type="submit"
              className="flex-[2] py-2.5 text-sm font-semibold text-white bg-blue-600 rounded-xl hover:bg-blue-700 transition-colors">
              ยืนยัน
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ── Edit Panel (inline) ───────────────────────────────────────────────────────
const EditPanel = ({ asset, categories, onSave, onCancel }) => {
  const [form, setForm] = useState({
    name: asset.Name || '', description: asset.Description || '',
    serialNumber: asset.SerialNumber || '', invNo: asset.InvNo || '',
    location: asset.Location || '', category: asset.Category || '',
    purchaseDate: asset.PurchaseDate ? new Date(asset.PurchaseDate).toISOString().split('T')[0] : '',
    purchasePrice: asset.PurchasePrice || '', status: asset.Status || 1,
  });
  const [saving, setSaving] = useState(false);
  const [showCustomCat, setShowCustomCat] = useState(false);
  const [customCat, setCustomCat] = useState('');

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = { ...form, category: showCustomCat && customCat ? customCat : form.category };
      await onSave(payload);
    } finally { setSaving(false); }
  };

  const f = (key) => ({
    value: form[key],
    onChange: e => setForm(p => ({ ...p, [key]: e.target.value })),
    disabled: saving,
    className: inputCls,
  });

  return (
    <div className="border-t border-gray-100 pt-5 mt-5 space-y-4">
      <h4 className="font-semibold text-gray-700 flex items-center gap-2 text-sm">
        <Pencil size={14} className="text-blue-600"/> แก้ไขข้อมูล
      </h4>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div><label className="block text-xs font-medium text-gray-500 mb-1">ชื่อทรัพย์สิน *</label>
          <input type="text" required {...f('name')}/></div>
        <div><label className="block text-xs font-medium text-gray-500 mb-1">InvNo</label>
          <input type="text" {...f('invNo')}/></div>
        <div><label className="block text-xs font-medium text-gray-500 mb-1">Serial Number</label>
          <input type="text" {...f('serialNumber')}/></div>
        <div><label className="block text-xs font-medium text-gray-500 mb-1">สถานะ</label>
          <select value={form.status} onChange={e => setForm(p=>({...p,status:parseInt(e.target.value)}))} disabled={saving} className={inputCls}>
            <option value={1}>ว่าง / ปกติ</option>
            <option value={2}>ถูกยืม</option>
            <option value={3}>ส่งซ่อม</option>
          </select></div>
        <div><label className="block text-xs font-medium text-gray-500 mb-1">สถานที่เก็บ</label>
          <input type="text" {...f('location')}/></div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">หมวดหมู่</label>
          {!showCustomCat ? (
            <div className="flex gap-2">
              <select value={form.category} onChange={e => setForm(p=>({...p,category:e.target.value}))} disabled={saving} className={inputCls}>
                <option value="">-- เลือกหมวดหมู่ --</option>
                {categories.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <button type="button" onClick={() => setShowCustomCat(true)}
                className="px-2 text-xs text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 whitespace-nowrap">+ ใหม่</button>
            </div>
          ) : (
            <div className="flex gap-2">
              <input type="text" placeholder="พิมพ์หมวดหมู่ใหม่" value={customCat}
                onChange={e => setCustomCat(e.target.value)} className={inputCls}/>
              <button type="button" onClick={() => setShowCustomCat(false)}
                className="px-2 text-xs text-gray-500 bg-gray-100 rounded-lg hover:bg-gray-200">ยกเลิก</button>
            </div>
          )}
        </div>
        <div><label className="block text-xs font-medium text-gray-500 mb-1">วันที่ซื้อ</label>
          <input type="date" {...f('purchaseDate')}/></div>
        <div><label className="block text-xs font-medium text-gray-500 mb-1">ราคา (บาท)</label>
          <input type="number" step="0.01" {...f('purchasePrice')}/></div>
        <div className="sm:col-span-2">
          <label className="block text-xs font-medium text-gray-500 mb-1">รายละเอียด</label>
          <textarea rows={2} value={form.description} onChange={e => setForm(p=>({...p,description:e.target.value}))}
            disabled={saving} className={`${inputCls} resize-none`}/>
        </div>
      </div>
      <div className="flex gap-3">
        <button onClick={onCancel} disabled={saving}
          className="flex-1 py-2 text-sm text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors disabled:opacity-50">
          ยกเลิก
        </button>
        <button onClick={handleSave} disabled={saving}
          className="flex-[2] flex items-center justify-center gap-2 py-2 text-sm font-semibold text-white bg-blue-600 rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-colors">
          {saving ? <><Loader2 size={14} className="animate-spin"/> กำลังบันทึก...</> : <><Save size={14}/> บันทึก</>}
        </button>
      </div>
    </div>
  );
};

// ── Main ScanAsset ────────────────────────────────────────────────────────────
const ScanAsset = () => {
  const [scanId, setScanId]           = useState('');
  const [assetData, setAssetData]     = useState(null);
  const [loading, setLoading]         = useState(false);
  const [errorMsg, setErrorMsg]       = useState('');
  const [activeModal, setActiveModal] = useState(null); // 'return' | 'repairDone'
  const [showRepairModal, setShowRepairModal]   = useState(false);
  const [showBorrowModal, setShowBorrowModal]   = useState(false);
  const [editMode, setEditMode]       = useState(false);
  const [categories, setCategories]   = useState([]);
  const [toast, setToast]             = useState(null);
  // ── 2. เพิ่ม State คุมการเปิด/ปิดกล้องสแกน ─────────────────────────────────────
  const [isScanning, setIsScanning]   = useState(false);

  const inputRef = useRef(null);
  const { can } = usePermission();

  useEffect(() => { inputRef.current?.focus(); }, []);
  useEffect(() => {
    api.get('/assets/categories').then(r => setCategories(r.data)).catch(() => {});
  }, []);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  // ── Search / Scan ──────────────────────────────────────────────────────────
  // 🛠️ ถอดระบบควบคุมด้วย RegEx ออก เพื่อให้รองรับรหัส Custom IDs หรือ GUIDs ที่มีตัวอักษรพิเศษได้
  const handleScan = async (e, overrideId) => {
    if (e) e.preventDefault();
    const q = (overrideId || scanId).trim();
    if (!q) return;
    setLoading(true);
    setErrorMsg('');
    setAssetData(null);
    setEditMode(false);
    setIsScanning(false); // เมื่อเริ่มค้นหาข้อมูล ให้สั่งปิดระบบเปิดกล้องทันที

    try {
      // 1. ลองดึงข้อมูลโดยมองว่าค่า q คือค่า ID ของทรัพย์สินในฐานข้อมูลตรงๆ (เช่น รหัส GUID)
      try {
        const res = await api.get(`/assets/${q}`);
        if (res.data && res.data.Id) {
          setAssetData(res.data);
          setScanId('');
          setLoading(false);
          return; // หากเจอ ID ชิ้นนี้ในฐานข้อมูลแล้ว ให้จบการค้นหาทันที
        }
      } catch (idErr) {
        // หากค้นหาด้วย ID ตรงๆ แล้วไม่พบ (เช่น 404) ระบบจะปล่อยผ่านเพื่อลงไปหาด้วย Keywords ในขั้นต่อไป
        console.log("Not found by asset ID, switching to keyword matching...");
      }

      // 2. ถ้าค้นหาด้วย ID ตรงๆ ไม่เจอ ค่อยสลับมาสแกนหาข้อความในคลังทรัพย์สินทั้งหมดที่มี (InvNo, ชื่อ, S/N)
      const allRes = await api.get('/assets');
      const keyword = q.toLowerCase();
      const found = allRes.data.filter(a =>
        a.InvNo?.toLowerCase().includes(keyword) ||
        a.Name?.toLowerCase().includes(keyword) ||
        a.SerialNumber?.toLowerCase().includes(keyword) ||
        a.Location?.toLowerCase().includes(keyword) ||
        a.Category?.toLowerCase().includes(keyword)
      );

      if (found.length === 1) {
        setAssetData(found[0]);
        setScanId('');
      } else if (found.length > 1) {
        setErrorMsg(`พบ ${found.length} รายการที่ตรงกับ "${q}" — กรุณาระบุให้ละเอียดขึ้น`);
        setScanId('');
      } else {
        setErrorMsg(`ไม่พบทรัพย์สินที่ตรงกับ "${q}"`);
        setScanId('');
      }
    } catch (err) {
      setErrorMsg(err.response?.data?.message || `ไม่พบทรัพย์สินที่ตรงกับ "${q}"`);
      setScanId('');
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  // ── 4. ฟังก์ชันรับค่าเมื่อกล้องหน้าจอมือถือสแกนติด QR Code สำเร็จ ───────────────
  const handleCameraScanSuccess = (scannedText) => {
    handleScan(null, scannedText); // ส่งค่าไอดีที่ได้ไปให้ฟังก์ชันค้นหาของเดิมทำงานต่อทันที
  };

  // ── Action confirm (ยืม/คืน/ซ่อมเสร็จ) ────────────────────────────────────
  const handleConfirm = async (formData) => {
    const config = MODAL_CONFIGS[activeModal];
    setActiveModal(null);
    let newStatus = config.newStatus;
    if (activeModal === 'return') {
      newStatus = formData.condition === 'damaged' ? 3 : 1;
    }
    let note = formData.note || '';
    if (activeModal === 'return') {
      const condText = formData.condition === 'damaged' ? '🟠 ชำรุด (ส่งซ่อมต่อ)' : '🟢 ปกติ';
      note = `ผู้คืน: ${formData.returnerName} | สภาพ: ${condText}${note ? ` | หมายเหตุ: ${note}` : ''}`;
    }
    try {
      await api.put(`/assets/${assetData.Id}/status`, {
        status: newStatus,
        borrowerName: formData.borrowerName,
        expectedReturnDate: formData.expectedReturnDate,
        note,
      });
      const msg = activeModal==='return' && newStatus===3
        ? 'คืนแล้ว — ปรับสถานะเป็น "ส่งซ่อม" เนื่องจากทรัพย์สินชำรุด'
        : `ทำรายการ "${config.title}" สำเร็จ`;
      showToast(msg);
      const refreshed = await api.get(`/assets/${assetData.Id}`);
      setAssetData(refreshed.data);
    } catch { showToast('ทำรายการไม่สำเร็จ', 'error'); }
  };

  // ── หลังส่งคำขอซ่อมสำเร็จ ─────────────────────────────────────────────────
  const handleRepairSuccess = () => {
    showToast('ส่งคำขอซ่อมสำเร็จ — Admin จะดำเนินการต่อ');
    api.get(`/assets/${assetData.Id}`)
      .then(res => setAssetData(res.data))
      .catch(() => {});
  };

  // ── Edit save ──────────────────────────────────────────────────────────────
  const handleEditSave = async (payload) => {
    try {
      const normalized = {
        name:          payload.name          || payload.Name          || '',
        description:   payload.description   || payload.Description   || '',
        serialNumber:  payload.serialNumber  || payload.SerialNumber  || '',
        invNo:         payload.invNo         || payload.InvNo         || '',
        location:      payload.location      || payload.Location      || '',
        category:      payload.category      || payload.Category      || '',
        purchaseDate:  payload.purchaseDate  || payload.PurchaseDate  || null,
        purchasePrice: payload.purchasePrice ?? payload.PurchasePrice ?? 0,
        status:        payload.status        ?? payload.Status        ?? 1,
      };
      await api.put(`/assets/${assetData.Id}`, normalized);
      showToast('อัปเดตข้อมูลสำเร็จ');
      setEditMode(false);
      const refreshed = await api.get(`/assets/${assetData.Id}`);
      setAssetData(refreshed.data);
    } catch (err) {
      showToast('อัปเดตไม่สำเร็จ', 'error');
      throw err;
    }
  };

  const s = assetData ? STATUS[assetData.Status] || STATUS[1] : null;

  return (
    <div className="max-w-2xl mx-auto space-y-5">

      {/* Toast */}
      {toast && (
        <div className={`fixed top-5 right-5 z-50 flex items-center gap-3 px-5 py-3 rounded-xl shadow-lg text-sm font-medium
          ${toast.type==='error'?'bg-red-600 text-white':'bg-gray-900 text-white'}`}>
          {toast.type==='error'?<AlertTriangle size={16}/>:<CheckCircle2 size={16}/>}
          {toast.message}
        </div>
      )}

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">สแกนทรัพย์สิน</h1>
        <p className="text-sm text-gray-500 mt-0.5">ค้นหาด้วย QR Code, InvNo, ชื่อ, S/N, สถานที่ หรือหมวดหมู่</p>
      </div>

      {/* ── 5. ปุ่มเปิดกล้องสแกนสไตล์มือถือ (เพิ่มเข้ามาด้านบนช่องค้นหาเพื่อให้กดง่าย) ── */}
      <button
        type="button"
        onClick={() => { setIsScanning(!isScanning); setErrorMsg(''); setAssetData(null); }}
        className={`w-full py-3.5 px-4 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 shadow-sm transition-all duration-200
          ${isScanning 
            ? 'bg-red-500 hover:bg-red-600 text-white animate-pulse' 
            : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white'}`}
      >
        {isScanning ? (
          <>❌ ปิดหน้าต่างกล้องสแกน</>
        ) : (
          <><ScanLine size={18} /> เปิดกล้องสแกน QR / Barcode ทรัพย์สิน</>
        )}
      </button>

      {/* ── 6. หน้าจอแสดงผลกล้องสแกน (ถ้ากดเปิดปุ่มกล้องจะโผล่มาตรงนี้) ────────────────── */}
      {isScanning && (
        <div className="bg-white border-2 border-dashed border-blue-400 rounded-2xl p-4 shadow-inner overflow-hidden">
          <AssetScanner onScanSuccess={handleCameraScanSuccess} />
        </div>
      )}

      {/* Search bar */}
      <form onSubmit={handleScan} className="flex gap-3">
        <div className="relative flex-1">
          <ScanLine size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-blue-500"/>
          <input
            ref={inputRef}
            type="text"
            placeholder="หรือพิมพ์ InvNo / ชื่อ / S/N / สถานที่..."
            value={scanId}
            onChange={e => { setScanId(e.target.value); setErrorMsg(''); }}
            className="w-full pl-10 pr-4 py-3 text-sm border-2 border-blue-300 rounded-xl focus:outline-none focus:border-blue-500 bg-blue-50/30"
          />
          {scanId && (
            <button type="button" onClick={() => { setScanId(''); setErrorMsg(''); inputRef.current?.focus(); }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <X size={16}/>
            </button>
          )}
        </div>
        <button type="submit" disabled={loading || !scanId.trim()}
          className="flex items-center gap-2 px-5 py-3 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-colors">
          {loading ? <Loader2 size={16} className="animate-spin"/> : <Search size={16}/>}
          ค้นหา
        </button>
      </form>

      {/* Search hints */}
      <div className="flex flex-wrap gap-2 text-xs text-gray-400">
        {['QR Code / Asset ID','InvNo','ชื่อทรัพย์สิน','Serial Number','สถานที่','หมวดหมู่'].map(hint => (
          <span key={hint} className="flex items-center gap-1 bg-gray-100 px-2 py-1 rounded-full">
            <ChevronRight size={10}/>{hint}
          </span>
        ))}
      </div>

      {/* Error */}
      {errorMsg && (
        <div className="flex items-center gap-3 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">
          <AlertTriangle size={16} className="flex-shrink-0"/>
          {errorMsg}
        </div>
      )}

      {/* Asset Card */}
      {assetData && s && (
        <div className={`bg-white rounded-2xl border-2 ${s.border} shadow-sm overflow-hidden`}>

          {/* Status bar */}
          <div className={`px-5 py-2.5 flex items-center justify-between ${s.color}`}>
            <div className="flex items-center gap-2 text-sm font-semibold">
              <span className={`w-2 h-2 rounded-full ${s.dot}`}/>
              {s.label}
            </div>
            <button onClick={() => handleScan(null, assetData.Id)}
              className="p-1 rounded-lg hover:bg-black/10 transition-colors">
              <RefreshCw size={14}/>
            </button>
          </div>

          <div className="p-5 space-y-5">
            {/* Asset name */}
            <div>
              <h2 className="text-xl font-bold text-gray-900">{assetData.Name}</h2>
              {assetData.Description && <p className="text-sm text-gray-500 mt-1">{assetData.Description}</p>}
            </div>

            {/* Info grid */}
            <div className="grid grid-cols-2 gap-3">
              {[
                { icon: Hash,      label: 'InvNo',         value: assetData.InvNo || '-',         mono: true },
                { icon: Hash,      label: 'Serial Number', value: assetData.SerialNumber || '-', mono: true },
                { icon: MapPin,    label: 'สถานที่',        value: assetData.Location || '-' },
                { icon: Tag,       label: 'หมวดหมู่',       value: assetData.Category || '-' },
                { icon: Calendar,  label: 'วันที่ซื้อ',     value: assetData.PurchaseDate ? new Date(assetData.PurchaseDate).toLocaleDateString('th-TH') : '-' },
                { icon: DollarSign,label: 'ราคา',           value: assetData.PurchasePrice ? `฿${Number(assetData.PurchasePrice).toLocaleString()}` : '-' },
              ].map(item => (
                <div key={item.label} className="bg-gray-50 rounded-xl p-3 flex items-start gap-2">
                  <item.icon size={14} className="text-gray-400 mt-0.5 flex-shrink-0"/>
                  <div className="min-w-0">
                    <p className="text-xs text-gray-400">{item.label}</p>
                    <p className={`text-sm font-medium text-gray-800 truncate ${item.mono ? 'font-mono' : ''}`}>{item.value}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Asset ID */}
            <div className="flex items-center gap-2 bg-gray-50 rounded-xl px-4 py-2.5">
              <Info size={13} className="text-gray-400 flex-shrink-0"/>
              <p className="text-xs text-gray-400 font-mono truncate">{assetData.Id}</p>
            </div>

            {/* Photos */}
            <AssetPhotoGallery assetId={assetData.Id} canEdit={can(PERMISSIONS.EDIT_ASSET)}/>

            {/* Edit panel */}
            {editMode && (
              <EditPanel
                asset={assetData}
                categories={categories}
                onSave={handleEditSave}
                onCancel={() => setEditMode(false)}
              />
            )}

            {/* Action buttons */}
            {!editMode && (
              <div className="border-t border-gray-100 pt-4">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">ดำเนินการ</p>
                <div className="grid grid-cols-2 gap-2">

                  {/* Status 1: Empty / Normal */}
                  {assetData.Status === 1 && (
                    <>
                      <button onClick={() => setShowBorrowModal(true)}
                        className="flex items-center justify-center gap-2 py-2.5 text-sm font-medium text-white bg-red-500 rounded-xl hover:bg-red-600 transition-colors">
                        <ArrowUpFromLine size={15}/> แจ้งยืม
                      </button>
                      <button onClick={() => setShowRepairModal(true)}
                        className="flex items-center justify-center gap-2 py-2.5 text-sm font-medium text-white bg-orange-500 rounded-xl hover:bg-orange-600 transition-colors">
                        <Wrench size={15}/> แจ้งซ่อม
                      </button>
                    </>
                  )}

                  {/* Status 2: Borrowed */}
                  {assetData.Status === 2 && (
                    <>
                      <button onClick={() => setActiveModal('return')}
                        className="flex items-center justify-center gap-2 py-2.5 text-sm font-medium text-white bg-green-500 rounded-xl hover:bg-green-600 transition-colors">
                        <ArrowDownToLine size={15}/> คืนทรัพย์สิน
                      </button>
                      <button onClick={() => setShowRepairModal(true)}
                        className="flex items-center justify-center gap-2 py-2.5 text-sm font-medium text-white bg-orange-500 rounded-xl hover:bg-orange-600 transition-colors">
                        <Wrench size={15}/> แจ้งซ่อม
                      </button>
                    </>
                  )}

                  {/* Status 3: Repairing */}
                  {assetData.Status === 3 && can(PERMISSIONS.EDIT_ASSET) && (
                    <button onClick={() => setActiveModal('repairDone')}
                      className="col-span-2 flex items-center justify-center gap-2 py-2.5 text-sm font-medium text-white bg-green-600 rounded-xl hover:bg-green-700 transition-colors">
                      <CheckCircle2 size={15}/> ซ่อมเสร็จ — นำเข้าคลัง
                    </button>
                  )}

                  {/* Edit data */}
                  {can(PERMISSIONS.EDIT_ASSET) && (
                    <button onClick={() => setEditMode(true)}
                      className={`${assetData.Status===3 ? '' : 'col-span-2'} flex items-center justify-center gap-2 py-2.5 text-sm font-medium text-blue-700 bg-blue-50 rounded-xl hover:bg-blue-100 transition-colors border border-blue-200`}>
                      <Pencil size={15}/> แก้ไขข้อมูล
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ActionModal (ยืม/คืน/ซ่อมเสร็จ) */}
      {activeModal && (
        <ActionModal
          type={activeModal}
          assetName={assetData?.Name}
          onConfirm={handleConfirm}
          onClose={() => setActiveModal(null)}
        />
      )}

      {/* RepairRequestModal */}
      {showRepairModal && assetData && (
        <RepairRequestModal
          asset={assetData}
          onClose={() => setShowRepairModal(false)}
          onSuccess={handleRepairSuccess}
        />
      )}

      {/* BorrowRequestModal */}
      {showBorrowModal && assetData && (
        <BorrowRequestModal
          assets={[assetData]}
          onClose={() => setShowBorrowModal(false)}
          onSuccess={() => {
            showToast('ส่งคำขอยืมสำเร็จ — Admin จะดำเนินการต่อ');
            api.get(`/assets/${assetData.Id}`).then(res => setAssetData(res.data)).catch(()=>{});
          }}
        />
      )}
    </div>
  );
};

export default ScanAsset;