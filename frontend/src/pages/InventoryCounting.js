import React, { useState, useEffect, useRef, useCallback } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import * as XLSX from 'xlsx';
import api, { assetAPI } from '../services/api';
import { exportPDF } from '../utils/exportPDF';
import { useAuth } from '../context/AuthContext';
import usePermission from '../hooks/usePermission';
import {
  Plus, X, Pencil, Lock, Ban, Download, FileText,
  ScanLine, CheckCircle2, AlertTriangle, Loader2,
  ClipboardList, ChevronRight, RefreshCw, Trash2,
  AlertCircle, Filter, Search, Printer, Package,
  Eye, EyeOff, ChevronDown
} from 'lucide-react';

// ── Status config ─────────────────────────────────────────────────────────────
const ITEM_STATUS = {
  found:   { label: 'นับแล้ว',     color: 'bg-green-100 text-green-700',  dot: 'bg-green-500'  },
  missing: { label: 'ยังไม่นับ',   color: 'bg-gray-100 text-gray-600',    dot: 'bg-gray-400'   },
  damaged: { label: 'ชำรุด',       color: 'bg-orange-100 text-orange-700', dot: 'bg-orange-500' },
};

const SESSION_STATUS = {
  active:    { label: 'กำลังนับ', color: 'bg-green-100 text-green-700'  },
  closed:    { label: 'ปิดแล้ว',  color: 'bg-gray-100 text-gray-500'    },
  cancelled: { label: 'ยกเลิก',   color: 'bg-red-100 text-red-600'      },
};

const StatusBadge = ({ status, map }) => {
  const s = (map || ITEM_STATUS)[status] || ITEM_STATUS.missing;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${s.color}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`}/>
      {s.label}
    </span>
  );
};

const inputCls = 'w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white';

// ── Summary Card ──────────────────────────────────────────────────────────────
const SCard = ({ label, value, color }) => (
  <div className={`${color} rounded-xl p-4 text-white text-center`}>
    <p className="text-3xl font-bold tabular-nums">{value ?? 0}</p>
    <p className="text-xs mt-1 opacity-80">{label}</p>
  </div>
);

// ── Modal wrapper ─────────────────────────────────────────────────────────────
const Modal = ({ title, onClose, children, wide }) => (
  <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
    <div className={`bg-white rounded-2xl shadow-2xl w-full ${wide ? 'max-w-3xl' : 'max-w-md'} p-6 max-h-[90vh] overflow-y-auto`}>
      <div className="flex items-center justify-between mb-5">
        <h3 className="font-bold text-gray-900">{title}</h3>
        <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100">
          <X size={18} className="text-gray-500"/>
        </button>
      </div>
      {children}
    </div>
  </div>
);

// ── ZPL Print helper ──────────────────────────────────────────────────────────
const printZPL = async (assets, printerIp, printerPort, showToast) => {
  try {
    const res = await api.post('/print/network', {
      assets,
      ip: printerIp,
      port: parseInt(printerPort),
    });
    showToast(res.data.message || 'ส่งงานพิมพ์สำเร็จ');
  } catch (err) {
    showToast('พิมพ์ไม่สำเร็จ: ' + (err.response?.data?.error || err.message), 'error');
  }
};

// ── Main ──────────────────────────────────────────────────────────────────────
const InventoryCounting = () => {
  const [sessions, setSessions]           = useState([]);
  const [activeSession, setActiveSession] = useState(null);
  const [sessionItems, setSessionItems]   = useState([]);
  const [uncountedAssets, setUncountedAssets] = useState([]);
  const [allAssets, setAllAssets]         = useState([]);
  const [summary, setSummary]             = useState(null);
  const [assets, setAssets]               = useState([]);
  const [scanId, setScanId]               = useState('');
  const [loading, setLoading]             = useState(true);
  const [exporting, setExporting]         = useState(false);
  const [toast, setToast]                 = useState(null);
  const [activeTab, setActiveTab]         = useState('counted'); // 'counted' | 'uncounted'

  // Search/Filter
  const [searchTerm, setSearchTerm]     = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Print modal
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [printTarget, setPrintTarget]       = useState([]); // assets to print
  const [printerIp, setPrinterIp]           = useState('192.168.1.200');
  const [printerPort, setPrinterPort]       = useState(9100);
  const [printing, setPrinting]             = useState(false);

  // Modals
  const [showNewSession, setShowNewSession]   = useState(false);
  const [showEditSession, setShowEditSession] = useState(false);
  const [showNewAsset, setShowNewAsset]       = useState(false);
  const [showDuplicate, setShowDuplicate]     = useState(false);
  const [duplicateAssets, setDuplicateAssets] = useState([]);
  const [scannedUnknownId, setScannedUnknownId] = useState('');

  const [newSessionName, setNewSessionName] = useState('');
  const [newSessionDesc, setNewSessionDesc] = useState('');
  const [editSessionName, setEditSessionName] = useState('');
  const [editSessionDesc, setEditSessionDesc] = useState('');
  const [newAssetData, setNewAssetData] = useState({ invNo:'', assetName:'', location:'', category:'', note:'' });

  const scanRef = useRef(null);
  const { user } = useAuth();
  const { isAdmin } = usePermission();

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  // ── Fetch ─────────────────────────────────────────────────────────────────
  const fetchSessions = useCallback(async () => {
    try {
      const res = await api.get('/inventory/sessions');
      setSessions(res.data);
    } catch { showToast('ดึงข้อมูลรอบการนับไม่สำเร็จ', 'error'); }
    finally { setLoading(false); }
  }, []);

  const fetchAssets = useCallback(async () => {
    try {
      const res = await assetAPI.getAll();
      setAssets(res.data);
    } catch { console.error('fetch assets error'); }
  }, []);

  const fetchSessionItems = useCallback(async (sessionId) => {
    try {
      const [itemsRes, summaryRes, uncountedRes] = await Promise.all([
        api.get(`/inventory/sessions/${sessionId}/items`),
        api.get(`/inventory/sessions/${sessionId}/summary`),
        api.get(`/inventory/sessions/${sessionId}/uncounted`),
      ]);
      setSessionItems(itemsRes.data);
      setSummary(summaryRes.data);
      setUncountedAssets(uncountedRes.data);
    } catch { showToast('ดึงข้อมูลรอบการนับไม่สำเร็จ', 'error'); }
  }, []);

  useEffect(() => { fetchSessions(); fetchAssets(); }, []);
  useEffect(() => { if (activeSession) fetchSessionItems(activeSession.Id); }, [activeSession]);

  // ── Filter counted items ──────────────────────────────────────────────────
  const filteredItems = sessionItems.filter(item => {
    const matchStatus = statusFilter === 'all' || item.Status === statusFilter;
    const matchSearch = !searchTerm || [
      item.AssetName, item.InvNo, item.Location, item.Category, item.CountedByName
    ].some(v => v?.toLowerCase().includes(searchTerm.toLowerCase()));
    return matchStatus && matchSearch;
  });

  // ── Filter uncounted ──────────────────────────────────────────────────────
  const filteredUncounted = uncountedAssets.filter(a =>
    !searchTerm || [a.Name, a.InvNo, a.Location, a.Category, a.SerialNumber]
      .some(v => v?.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  // ── Session CRUD ──────────────────────────────────────────────────────────
  const handleCreateSession = async (e) => {
    e.preventDefault();
    try {
      const res = await api.post('/inventory/sessions', { name: newSessionName, description: newSessionDesc });
      showToast('สร้างรอบการนับสำเร็จ');
      setShowNewSession(false); setNewSessionName(''); setNewSessionDesc('');
      fetchSessions(); setActiveSession(res.data);
    } catch (err) { showToast(err.response?.data?.error || 'เกิดข้อผิดพลาด', 'error'); }
  };

  const handleEditSession = async (e) => {
    e.preventDefault();
    try {
      await api.put(`/inventory/sessions/${activeSession.Id}`, { name: editSessionName, description: editSessionDesc });
      showToast('แก้ไขรอบการนับสำเร็จ');
      setShowEditSession(false);
      fetchSessions();
      setActiveSession(prev => ({ ...prev, Name: editSessionName, Description: editSessionDesc }));
    } catch (err) { showToast(err.response?.data?.error || 'เกิดข้อผิดพลาด', 'error'); }
  };

  const handleCloseSession = async () => {
    if (!window.confirm('ปิดรอบการนับนี้? จะไม่สามารถแก้ไขได้อีก')) return;
    try {
      await api.put(`/inventory/sessions/${activeSession.Id}/close`, {});
      showToast('ปิดรอบการนับสำเร็จ');
      fetchSessions(); setActiveSession(null); setSessionItems([]); setSummary(null); setUncountedAssets([]);
    } catch { showToast('เกิดข้อผิดพลาด', 'error'); }
  };

  const handleCancelSession = async () => {
    if (!window.confirm('ยกเลิกรอบการนับนี้?')) return;
    try {
      await api.put(`/inventory/sessions/${activeSession.Id}/cancel`, {});
      showToast('ยกเลิกรอบการนับสำเร็จ');
      fetchSessions(); setActiveSession(null); setSessionItems([]); setSummary(null); setUncountedAssets([]);
    } catch { showToast('เกิดข้อผิดพลาด', 'error'); }
  };

  // ── Scan ──────────────────────────────────────────────────────────────────
  const saveCount = async (asset) => {
    try {
      await api.post('/inventory/count', {
        sessionId: activeSession.Id, assetId: asset.Id,
        invNo: asset.InvNo, location: asset.Location,
        category: asset.Category, status: 'found',
      });
      setScanId('');
      fetchSessionItems(activeSession.Id);
      scanRef.current?.focus();
    } catch (err) { showToast(err.response?.data?.error || 'บันทึกไม่สำเร็จ', 'error'); }
  };

  const handleScan = async (e) => {
    e.preventDefault();
    if (!activeSession) { showToast('กรุณาเลือกรอบการนับก่อน', 'error'); return; }
    if (!scanId.trim()) return;

    const byId = assets.find(a => String(a.Id) === scanId.trim());
    if (byId) { await saveCount(byId); return; }

    const byInvNo = assets.filter(a => a.InvNo === scanId.trim());
    if (byInvNo.length === 0) {
      setScannedUnknownId(scanId.trim());
      setNewAssetData({ invNo: scanId.trim(), assetName:'', location:'', category:'', note:'' });
      setScanId(''); setShowNewAsset(true);
    } else if (byInvNo.length === 1) {
      await saveCount(byInvNo[0]);
    } else {
      setDuplicateAssets(byInvNo); setScanId(''); setShowDuplicate(true);
    }
  };

  const handleAddUnknownAsset = async (e) => {
    e.preventDefault();
    try {
      const createRes = await assetAPI.create({
        name: newAssetData.assetName, invNo: newAssetData.invNo,
        location: newAssetData.location, category: newAssetData.category,
        description: newAssetData.note, status: 1,
      });
      const newAsset = createRes.data.asset;
      await api.post('/inventory/count', {
        sessionId: activeSession.Id, assetId: newAsset.Id,
        invNo: newAsset.InvNo, location: newAsset.Location,
        category: newAsset.Category, status: 'found',
      });
      showToast(`เพิ่ม "${newAssetData.assetName}" และนับสำเร็จ`);
      setShowNewAsset(false);
      setNewAssetData({ invNo:'', assetName:'', location:'', category:'', note:'' });
      fetchAssets(); fetchSessionItems(activeSession.Id);
    } catch (err) { showToast(err.response?.data?.error || 'เกิดข้อผิดพลาด', 'error'); }
  };

  const handleUpdateStatus = async (assetId, newStatus) => {
    if (!activeSession) return;
    try {
      await api.post('/inventory/count', { sessionId: activeSession.Id, assetId, status: newStatus });
      fetchSessionItems(activeSession.Id);
    } catch { showToast('อัปเดตไม่สำเร็จ', 'error'); }
  };

  const handleDeleteItem = async (itemId) => {
    if (!window.confirm('ลบรายการนี้ออกจากรอบการนับ?')) return;
    try {
      await api.delete(`/inventory/count/${itemId}`);
      fetchSessionItems(activeSession.Id);
    } catch { showToast('ลบไม่สำเร็จ', 'error'); }
  };

  // ── Export current session ────────────────────────────────────────────────
  const handleExportExcel = () => {
    const data = filteredItems.map((item, i) => ({
      'ลำดับ': i+1, 'รอบการนับ': activeSession.Name,
      'Inv_No': item.InvNo||'-', 'ชื่อทรัพย์สิน': item.AssetName||'-',
      'Location': item.Location||'-', 'Category': item.Category||'-',
      'ผู้นับ': item.CountedByName||'-',
      'เวลาที่นับ': new Date(item.CountedAt).toLocaleString('th-TH'),
      'สถานะ': ITEM_STATUS[item.Status]?.label || item.Status,
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Inventory');
    ws['!cols'] = Object.keys(data[0]||{}).map(() => ({ wch: 20 }));
    XLSX.writeFile(wb, `inventory_${activeSession.Name}_${new Date().toLocaleDateString('th-TH')}.xlsx`);
  };

  // ── Export selected sessions ──────────────────────────────────────────────
  const [showExportModal, setShowExportModal]       = useState(false);
  const [exportSelectedIds, setExportSelectedIds]   = useState([]);

  const toggleExportSession = (id) =>
    setExportSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const toggleExportAll = () =>
    setExportSelectedIds(exportSelectedIds.length === sessions.length ? [] : sessions.map(s => s.Id));

  const handleExportAllExcel = async () => {
    if (!exportSelectedIds.length) { showToast('กรุณาเลือกอย่างน้อย 1 รอบ', 'error'); return; }
    setExporting(true);
    try {
      const res = await api.get('/inventory/all-items');
      const filtered = res.data.filter(item => exportSelectedIds.includes(item.SessionId));
      if (!filtered.length) { showToast('ไม่มีข้อมูลในรอบที่เลือก', 'error'); return; }
      const data = filtered.map((item, i) => ({
        'ลำดับ': i+1, 'รอบการนับ': item.SessionNameFull||'-',
        'Inv_No': item.InvNo||'-', 'ชื่อทรัพย์สิน': item.AssetName||'-',
        'Location': item.Location||'-', 'Category': item.Category||'-',
        'ผู้นับ': item.CountedByName||'-',
        'เวลาที่นับ': new Date(item.CountedAt).toLocaleString('th-TH'),
        'สถานะ': ITEM_STATUS[item.Status]?.label || item.Status,
        'สถานะรอบ': SESSION_STATUS[item.SessionStatus]?.label || item.SessionStatus,
      }));
      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Inventory');
      ws['!cols'] = Object.keys(data[0]||{}).map(() => ({ wch: 20 }));
      XLSX.writeFile(wb, `inventory_export_${new Date().toLocaleDateString('th-TH')}.xlsx`);
      showToast(`Export ${exportSelectedIds.length} รอบสำเร็จ`);
      setShowExportModal(false);
      setExportSelectedIds([]);
    } catch { showToast('Export ไม่สำเร็จ', 'error'); }
    finally { setExporting(false); }
  };

  const handleExportPDF = () => {
    setExporting(true);
    try {
      exportPDF({
        title: `รายงานการนับทรัพย์สิน: ${activeSession.Name}`,
        filename: `inventory_${activeSession.Name}`,
        orientation: 'landscape',
        columns: ['#','Inv_No','ชื่อทรัพย์สิน','Location','Category','ผู้นับ','เวลาที่นับ','สถานะ'],
        rows: filteredItems.map((item, i) => [
          i+1, item.InvNo||'-', item.AssetName||'-', item.Location||'-',
          item.Category||'-', item.CountedByName||'-',
          new Date(item.CountedAt).toLocaleString('th-TH'),
          ITEM_STATUS[item.Status]?.label || item.Status,
        ]),
      });
    } finally { setExporting(false); }
  };

  // ── Export uncounted ──────────────────────────────────────────────────────
  const handleExportUncounted = () => {
    const data = filteredUncounted.map((a, i) => ({
      'ลำดับ': i+1, 'InvNo': a.InvNo||'-', 'ชื่อทรัพย์สิน': a.Name,
      'Serial Number': a.SerialNumber||'-', 'สถานที่': a.Location||'-',
      'หมวดหมู่': a.Category||'-',
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'ยังไม่ได้นับ');
    ws['!cols'] = Object.keys(data[0]||{}).map(() => ({ wch: 20 }));
    XLSX.writeFile(wb, `uncounted_${activeSession.Name}_${new Date().toLocaleDateString('th-TH')}.xlsx`);
  };

  // ── Print ZPL uncounted ───────────────────────────────────────────────────
  const handlePrintUncounted = () => {
    if (!filteredUncounted.length) { showToast('ไม่มีรายการที่ยังไม่ได้นับ', 'error'); return; }
    setPrintTarget(filteredUncounted);
    setShowPrintModal(true);
  };

  const handlePrintConfirm = async () => {
    setPrinting(true);
    try {
      await printZPL(printTarget, printerIp, printerPort, showToast);
      setShowPrintModal(false);
    } finally { setPrinting(false); }
  };

  const countByStatus = (s) => sessionItems.filter(i => i.Status === s).length;
  const isActive = activeSession?.Status === 'active';

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5 h-full">

      {/* Toast */}
      {toast && (
        <div className={`fixed top-5 right-5 z-50 flex items-center gap-3 px-5 py-3 rounded-xl shadow-lg text-sm font-medium
          ${toast.type==='error'?'bg-red-600 text-white':'bg-gray-900 text-white'}`}>
          {toast.type==='error'?<AlertTriangle size={16}/>:<CheckCircle2 size={16}/>}
          {toast.message}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">รอบตรวจนับทรัพย์สิน</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            ผู้ดำเนินการ: <span className="font-medium text-gray-700">{user?.fullName || user?.username}</span>
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => { setExportSelectedIds([]); setShowExportModal(true); }} disabled={exporting}
            className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-green-700 bg-green-50 rounded-xl hover:bg-green-100 disabled:opacity-50 transition-colors">
            <Download size={14}/> Export รอบที่เลือก
          </button>
          {isAdmin && (
            <button onClick={() => setShowNewSession(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-green-600 text-white text-sm font-medium rounded-xl hover:bg-green-700 transition-colors shadow-sm">
              <Plus size={16}/> สร้างรอบใหม่
            </button>
          )}
        </div>
      </div>

      {/* Two-column layout */}
      <div className="flex gap-5 items-start">

        {/* Session List */}
        <div className="w-64 flex-shrink-0 space-y-2">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide px-1">รอบการนับ ({sessions.length})</p>
          {loading ? (
            <div className="space-y-2">{[1,2,3].map(i=><div key={i} className="h-20 bg-gray-100 rounded-xl animate-pulse"/>)}</div>
          ) : sessions.length === 0 ? (
            <div className="text-center text-gray-400 text-sm py-10 border-2 border-dashed border-gray-200 rounded-xl">ยังไม่มีรอบการนับ</div>
          ) : sessions.map(s => {
            const ss = SESSION_STATUS[s.Status] || SESSION_STATUS.active;
            const isSelected = activeSession?.Id === s.Id;
            return (
              <button key={s.Id} onClick={() => { setActiveSession(s); setSearchTerm(''); setStatusFilter('all'); }}
                className={`w-full text-left p-3 rounded-xl border-2 transition-all
                  ${isSelected ? 'border-blue-500 bg-blue-50' : 'border-gray-100 bg-white hover:border-gray-200'}`}>
                <div className="flex items-start justify-between gap-2 mb-1">
                  <p className="font-semibold text-gray-800 text-sm leading-tight truncate">{s.Name}</p>
                  {isSelected && <ChevronRight size={14} className="text-blue-500 flex-shrink-0 mt-0.5"/>}
                </div>
                <span className={`inline-block text-xs px-1.5 py-0.5 rounded-full font-medium ${ss.color}`}>{ss.label}</span>
                <p className="text-xs text-blue-600 mt-1.5 font-medium">นับแล้ว {s.TotalCounted} รายการ</p>
                <p className="text-xs text-gray-400 mt-0.5">{new Date(s.CreatedAt).toLocaleDateString('th-TH')}</p>
              </button>
            );
          })}
        </div>

        {/* Detail */}
        <div className="flex-1 min-w-0 space-y-4">
          {!activeSession ? (
            <div className="flex flex-col items-center justify-center py-20 border-2 border-dashed border-gray-200 rounded-2xl text-gray-400">
              <ClipboardList size={36} className="mb-3 text-gray-300"/>
              <p className="text-sm">เลือกรอบการนับทางซ้าย หรือสร้างรอบใหม่</p>
            </div>
          ) : (
            <>
              {/* Session header */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h2 className="font-bold text-gray-900 text-lg">{activeSession.Name}</h2>
                      <StatusBadge status={activeSession.Status} map={SESSION_STATUS}/>
                    </div>
                    <p className="text-xs text-gray-500">
                      สร้างโดย <span className="font-medium">{activeSession.CreatedByName||'-'}</span>
                      {' · '}{new Date(activeSession.CreatedAt).toLocaleString('th-TH')}
                    </p>
                    {activeSession.Description && <p className="text-xs text-gray-400 mt-1">{activeSession.Description}</p>}
                  </div>
                  <div className="flex gap-2 flex-wrap justify-end">
                    {isActive && isAdmin && (
                      <>
                        <button onClick={() => { setEditSessionName(activeSession.Name); setEditSessionDesc(activeSession.Description||''); setShowEditSession(true); }}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors">
                          <Pencil size={12}/> แก้ไข
                        </button>
                        <button onClick={handleCloseSession}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">
                          <Lock size={12}/> ปิดรอบ
                        </button>
                        <button onClick={handleCancelSession}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition-colors">
                          <Ban size={12}/> ยกเลิก
                        </button>
                      </>
                    )}
                    <button onClick={handleExportExcel}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-green-700 bg-green-50 rounded-lg hover:bg-green-100 transition-colors">
                      <Download size={12}/> Excel
                    </button>
                    <button onClick={handleExportPDF} disabled={exporting}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-700 bg-red-50 rounded-lg hover:bg-red-100 disabled:opacity-50 transition-colors">
                      <FileText size={12}/> PDF
                    </button>
                    <button onClick={() => fetchSessionItems(activeSession.Id)}
                      className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">
                      <RefreshCw size={14}/>
                    </button>
                  </div>
                </div>
              </div>

              {/* Summary cards */}
              {summary && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <SCard label="ทั้งหมดในระบบ"  value={summary.totalAssets}     color="bg-blue-500"/>
                  <SCard label="นับแล้ว"         value={summary.Found}          color="bg-green-500"/>
                  <SCard label="ยังไม่นับ"        value={uncountedAssets.length} color="bg-gray-400"/>
                  <SCard label="ชำรุด"            value={summary.Damaged}        color="bg-orange-500"/>
                </div>
              )}

              {/* Scan bar */}
              {isActive && (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                  <form onSubmit={handleScan} className="flex gap-3">
                    <div className="relative flex-1">
                      <ScanLine size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-500"/>
                      <input ref={scanRef} type="text" placeholder="สแกน QR Code หรือพิมพ์ InvNo..."
                        value={scanId} onChange={e => setScanId(e.target.value)} autoFocus
                        className="w-full pl-9 pr-4 py-2.5 text-sm border-2 border-blue-300 rounded-xl focus:outline-none focus:border-blue-500 bg-blue-50/30"/>
                    </div>
                    <button type="submit"
                      className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition-colors">
                      <CheckCircle2 size={15}/> บันทึก
                    </button>
                  </form>
                </div>
              )}

              {/* Search & Filter */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                <div className="flex gap-3">
                  <div className="relative flex-1">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
                    <input type="text" placeholder="ค้นหา InvNo, ชื่อ, สถานที่, ผู้นับ..."
                      value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                      className="w-full pl-8 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"/>
                  </div>
                  {activeTab === 'counted' && (
                    <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
                      className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                      <option value="all">ทุกสถานะ</option>
                      <option value="found">นับแล้ว</option>
                      <option value="damaged">ชำรุด</option>
                    </select>
                  )}
                </div>
              </div>

              {/* Tabs */}
              <div className="flex items-center justify-between">
                <div className="flex gap-2">
                  {[
                    { key:'counted',   label:'นับแล้ว',     count: sessionItems.length    },
                    { key:'uncounted', label:'ยังไม่ได้นับ', count: uncountedAssets.length },
                  ].map(tab => (
                    <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg font-medium transition-colors
                        ${activeTab===tab.key ? 'bg-gray-800 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}>
                      {tab.label}
                      <span className={`text-xs px-1.5 py-0.5 rounded-full ${activeTab===tab.key ? 'bg-white/20' : 'bg-gray-100'}`}>
                        {tab.count}
                      </span>
                    </button>
                  ))}
                </div>

                {/* Uncounted actions */}
                {activeTab === 'uncounted' && uncountedAssets.length > 0 && (
                  <div className="flex gap-2">
                    <button onClick={handleExportUncounted}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-green-700 bg-green-50 rounded-lg hover:bg-green-100 transition-colors">
                      <Download size={12}/> Export
                    </button>
                    <button onClick={handlePrintUncounted}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-purple-700 bg-purple-50 rounded-lg hover:bg-purple-100 transition-colors">
                      <Printer size={12}/> Print ZPL
                    </button>
                  </div>
                )}
              </div>

              {/* ── Tab: Counted ── */}
              {activeTab === 'counted' && (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-100 bg-gray-50">
                          {['#','QR','Inv_No','ชื่อทรัพย์สิน','Location','ผู้นับ','เวลาที่นับ','สถานะ', isActive?'ลบ':''].map((h,i)=>(
                            <th key={i} className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide text-left">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {filteredItems.map((item, i) => {
                          const isNew = i === 0 && isActive; // highlight รายการล่าสุด
                          return (
                            <tr key={item.Id} className={`transition-colors ${isNew ? 'bg-green-50' : 'hover:bg-gray-50'}`}>
                              <td className="px-4 py-3 text-gray-400 tabular-nums">{i+1}</td>
                              <td className="px-4 py-3">
                                {item.AssetId ? <QRCodeCanvas value={item.AssetId} size={36} level="H"/> : <span className="text-gray-300">-</span>}
                              </td>
                              <td className="px-4 py-3">
                                <span className="font-mono text-xs bg-gray-100 px-2 py-0.5 rounded">{item.InvNo||'-'}</span>
                              </td>
                              <td className="px-4 py-3 font-medium text-gray-900">
                                {item.AssetName||'-'}
                                {isNew && <span className="ml-2 text-xs text-green-600 font-normal">● ล่าสุด</span>}
                              </td>
                              <td className="px-4 py-3 text-gray-500 text-xs">{item.Location||'-'}</td>
                              <td className="px-4 py-3 text-gray-500 text-xs">{item.CountedByName||'-'}</td>
                              <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">
                                {new Date(item.CountedAt).toLocaleString('th-TH')}
                              </td>
                              <td className="px-4 py-3">
                                {isActive ? (
                                  <select value={item.Status}
                                    onChange={e => handleUpdateStatus(item.AssetId, e.target.value)}
                                    className="text-xs border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                                    <option value="found">นับแล้ว</option>
                                    <option value="damaged">ชำรุด</option>
                                  </select>
                                ) : (
                                  <StatusBadge status={item.Status}/>
                                )}
                              </td>
                              {isActive && (
                                <td className="px-4 py-3">
                                  <button onClick={() => handleDeleteItem(item.Id)}
                                    className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors">
                                    <Trash2 size={14}/>
                                  </button>
                                </td>
                              )}
                            </tr>
                          );
                        })}
                        {filteredItems.length === 0 && (
                          <tr><td colSpan="9" className="py-16 text-center">
                            <ScanLine size={32} className="mx-auto text-gray-300 mb-3"/>
                            <p className="text-gray-400 text-sm">
                              {statusFilter!=='all'||searchTerm ? 'ไม่มีรายการที่ตรงกัน' : 'ยังไม่มีรายการ — สแกน QR Code เพื่อเริ่มนับ'}
                            </p>
                          </td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* ── Tab: Uncounted ── */}
              {activeTab === 'uncounted' && (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-100 bg-gray-50">
                          {['#','InvNo','ชื่อทรัพย์สิน','S/N','สถานที่','หมวดหมู่','สถานะ'].map((h,i)=>(
                            <th key={i} className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide text-left">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {filteredUncounted.map((a, i) => (
                          <tr key={a.Id} className="hover:bg-orange-50/30 transition-colors">
                            <td className="px-4 py-3 text-gray-400 tabular-nums">{i+1}</td>
                            <td className="px-4 py-3">
                              <span className="font-mono text-xs bg-gray-100 px-2 py-0.5 rounded">{a.InvNo||'-'}</span>
                            </td>
                            <td className="px-4 py-3 font-medium text-gray-900">{a.Name}</td>
                            <td className="px-4 py-3 text-xs text-gray-400 font-mono">{a.SerialNumber||'-'}</td>
                            <td className="px-4 py-3 text-xs text-gray-500">{a.Location||'-'}</td>
                            <td className="px-4 py-3 text-xs text-gray-500">{a.Category||'-'}</td>
                            <td className="px-4 py-3">
                              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500">
                                <span className="w-1.5 h-1.5 rounded-full bg-gray-400"/>ยังไม่นับ
                              </span>
                            </td>
                          </tr>
                        ))}
                        {filteredUncounted.length === 0 && (
                          <tr><td colSpan="7" className="py-16 text-center">
                            <CheckCircle2 size={32} className="mx-auto text-green-300 mb-3"/>
                            <p className="text-green-500 text-sm font-medium">
                              {searchTerm ? 'ไม่มีรายการที่ตรงกัน' : '🎉 นับครบทุกรายการแล้ว!'}
                            </p>
                          </td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── Modal: สร้างรอบใหม่ ── */}
      {showNewSession && (
        <Modal title="สร้างรอบการนับใหม่" onClose={() => setShowNewSession(false)}>
          <form onSubmit={handleCreateSession} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">ชื่อรอบการนับ *</label>
              <input type="text" required value={newSessionName} onChange={e => setNewSessionName(e.target.value)}
                placeholder="เช่น นับทรัพย์สินประจำปี 2567" className={inputCls}/>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">รายละเอียด</label>
              <textarea value={newSessionDesc} onChange={e => setNewSessionDesc(e.target.value)}
                rows={3} className={`${inputCls} resize-none`}/>
            </div>
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => setShowNewSession(false)}
                className="flex-1 py-2.5 text-sm text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors">ยกเลิก</button>
              <button type="submit"
                className="flex-[2] py-2.5 text-sm font-semibold text-white bg-green-600 rounded-xl hover:bg-green-700 transition-colors">สร้างรอบการนับ</button>
            </div>
          </form>
        </Modal>
      )}

      {/* ── Modal: แก้ไขรอบ ── */}
      {showEditSession && (
        <Modal title="แก้ไขรอบการนับ" onClose={() => setShowEditSession(false)}>
          <form onSubmit={handleEditSession} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">ชื่อรอบการนับ *</label>
              <input type="text" required value={editSessionName} onChange={e => setEditSessionName(e.target.value)} className={inputCls}/>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">รายละเอียด</label>
              <textarea value={editSessionDesc} onChange={e => setEditSessionDesc(e.target.value)} rows={3} className={`${inputCls} resize-none`}/>
            </div>
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => setShowEditSession(false)}
                className="flex-1 py-2.5 text-sm text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors">ยกเลิก</button>
              <button type="submit"
                className="flex-[2] py-2.5 text-sm font-semibold text-white bg-blue-600 rounded-xl hover:bg-blue-700 transition-colors">บันทึก</button>
            </div>
          </form>
        </Modal>
      )}

      {/* ── Modal: ทรัพย์สินใหม่ ── */}
      {showNewAsset && (
        <Modal title="ไม่พบทรัพย์สินในระบบ" onClose={() => setShowNewAsset(false)}>
          <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-4 text-sm text-amber-800">
            <AlertCircle size={15} className="flex-shrink-0 mt-0.5"/>
            <span>รหัสที่สแกน: <strong className="font-mono">{scannedUnknownId}</strong></span>
          </div>
          <form onSubmit={handleAddUnknownAsset} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              {[
                { key:'invNo', label:'Inv_No', placeholder:'รหัสทรัพย์สิน' },
                { key:'assetName', label:'ชื่อทรัพย์สิน *', placeholder:'ระบุชื่อ', req:true },
                { key:'location', label:'Location', placeholder:'สถานที่เก็บ' },
                { key:'category', label:'Category', placeholder:'หมวดหมู่' },
              ].map(f => (
                <div key={f.key}>
                  <label className="block text-xs font-medium text-gray-600 mb-1">{f.label}</label>
                  <input type="text" required={f.req} placeholder={f.placeholder}
                    value={newAssetData[f.key]} onChange={e => setNewAssetData(p=>({...p,[f.key]:e.target.value}))}
                    className={inputCls}/>
                </div>
              ))}
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">หมายเหตุ</label>
              <textarea value={newAssetData.note} onChange={e => setNewAssetData(p=>({...p,note:e.target.value}))}
                rows={2} className={`${inputCls} resize-none`}/>
            </div>
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => setShowNewAsset(false)}
                className="flex-1 py-2.5 text-sm text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors">ยกเลิก</button>
              <button type="submit"
                className="flex-[2] py-2.5 text-sm font-semibold text-white bg-green-600 rounded-xl hover:bg-green-700 transition-colors">เพิ่มเข้าระบบและนับ</button>
            </div>
          </form>
        </Modal>
      )}

      {/* ── Modal: InvNo ซ้ำ ── */}
      {showDuplicate && (
        <Modal title="พบ InvNo ซ้ำหลายชิ้น" onClose={() => { setShowDuplicate(false); setDuplicateAssets([]); }}>
          <p className="text-sm text-gray-500 mb-4">
            InvNo <strong>{duplicateAssets[0]?.InvNo}</strong> มี {duplicateAssets.length} ชิ้น — เลือกชิ้นที่ต้องการนับ
          </p>
          <div className="space-y-2">
            {duplicateAssets.map(asset => (
              <button key={asset.Id}
                onClick={async () => { setShowDuplicate(false); setDuplicateAssets([]); await saveCount(asset); }}
                className="w-full flex items-center gap-3 p-3 border-2 border-gray-100 rounded-xl hover:border-green-400 hover:bg-green-50 transition-all text-left">
                <QRCodeCanvas value={String(asset.Id)} size={36} level="H"/>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 text-sm">{asset.Name}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{asset.Location||'ไม่ระบุที่'} · SN: {asset.SerialNumber||'-'}</p>
                </div>
              </button>
            ))}
          </div>
          <button onClick={() => { setShowDuplicate(false); setDuplicateAssets([]); }}
            className="w-full mt-4 py-2.5 text-sm text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors">ยกเลิก</button>
        </Modal>
      )}

      {/* ── Modal: Print ZPL ── */}
      {showPrintModal && (
        <Modal title={`Print ZPL — ${printTarget.length} รายการที่ยังไม่นับ`} onClose={() => setShowPrintModal(false)}>
          <p className="text-sm text-gray-500 mb-4">ส่งงานพิมพ์ฉลากสำหรับทรัพย์สินที่ยังไม่ได้นับ</p>
          <div className="space-y-3 mb-5">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">IP Address เครื่องพิมพ์</label>
              <input type="text" value={printerIp} onChange={e => setPrinterIp(e.target.value)} className={inputCls}/>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Port</label>
              <input type="number" value={printerPort} onChange={e => setPrinterPort(e.target.value)} className={inputCls}/>
            </div>
          </div>
          <div className="flex gap-3">
            <button onClick={() => setShowPrintModal(false)} disabled={printing}
              className="flex-1 py-2.5 text-sm text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200 disabled:opacity-50 transition-colors">ยกเลิก</button>
            <button onClick={handlePrintConfirm} disabled={printing}
              className="flex-[2] flex items-center justify-center gap-2 py-2.5 text-sm font-semibold text-white bg-purple-600 rounded-xl hover:bg-purple-700 disabled:opacity-50 transition-colors">
              {printing ? <><Loader2 size={14} className="animate-spin"/> กำลังส่ง...</> : <><Printer size={14}/> พิมพ์ {printTarget.length} ฉลาก</>}
            </button>
          </div>
        </Modal>
      )}
      {/* ── Modal: เลือกรอบที่ต้องการ Export ── */}
      {showExportModal && (
        <Modal title="เลือกรอบที่ต้องการ Export" onClose={() => setShowExportModal(false)} wide>
          <div className="mb-4 flex items-center justify-between">
            <p className="text-sm text-gray-500">เลือกรอบการนับที่ต้องการรวมใน Excel</p>
            <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
              <input type="checkbox"
                checked={exportSelectedIds.length === sessions.length && sessions.length > 0}
                onChange={toggleExportAll}
                className="rounded border-gray-300 accent-blue-600"/>
              เลือกทั้งหมด
            </label>
          </div>
          <div className="space-y-2 max-h-80 overflow-y-auto mb-5">
            {sessions.map(s => {
              const ss = SESSION_STATUS[s.Status] || SESSION_STATUS.active;
              const isChecked = exportSelectedIds.includes(s.Id);
              return (
                <label key={s.Id}
                  className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all
                    ${isChecked ? 'border-blue-400 bg-blue-50' : 'border-gray-100 hover:border-gray-200'}`}>
                  <input type="checkbox" checked={isChecked} onChange={() => toggleExportSession(s.Id)}
                    className="rounded border-gray-300 accent-blue-600 flex-shrink-0"/>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-gray-800 text-sm truncate">{s.Name}</p>
                      <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${ss.color}`}>{ss.label}</span>
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">
                      นับแล้ว {s.TotalCounted} รายการ · {new Date(s.CreatedAt).toLocaleDateString('th-TH')}
                    </p>
                  </div>
                </label>
              );
            })}
          </div>
          <div className="flex gap-3">
            <button onClick={() => setShowExportModal(false)}
              className="flex-1 py-2.5 text-sm text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors">
              ยกเลิก
            </button>
            <button onClick={handleExportAllExcel} disabled={exporting || !exportSelectedIds.length}
              className="flex-[2] flex items-center justify-center gap-2 py-2.5 text-sm font-semibold text-white bg-green-600 rounded-xl hover:bg-green-700 disabled:opacity-50 transition-colors">
              {exporting ? <><Loader2 size={14} className="animate-spin"/> กำลัง Export...</> : <><Download size={14}/> Export {exportSelectedIds.length} รอบ</>}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default InventoryCounting;