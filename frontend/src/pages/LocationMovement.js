import React, { useState, useEffect, useCallback } from 'react';
import api, { assetAPI } from '../services/api';
import usePermission from '../hooks/usePermission';
import { PERMISSIONS } from '../constants/permissions';
import {
  Search, MapPin, ArrowRight, Truck, X, Loader2,
  CheckCircle2, AlertTriangle, History, Package,
  Filter, ChevronDown, Tag, Hash, RefreshCw
} from 'lucide-react';

// ── Status badge ──────────────────────────────────────────────────────────────
const STATUS = {
  1: { label: 'ว่าง',   color: 'bg-green-100 text-green-700'  },
  2: { label: 'ถูกยืม', color: 'bg-red-100 text-red-700'     },
  3: { label: 'ซ่อม',   color: 'bg-orange-100 text-orange-700' },
};

const inputCls = 'w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white';

// ── Move Modal (single) ───────────────────────────────────────────────────────
const MoveModal = ({ asset, onConfirm, onClose, loading }) => {
  const [toLocation, setToLocation] = useState(asset.Location || '');
  const [note, setNote] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!toLocation.trim()) return;
    onConfirm({ assetId: asset.Id, fromLocation: asset.Location || '-', toLocation, note });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-gray-900 flex items-center gap-2">
            <Truck size={18} className="text-blue-600"/> ย้ายสถานที่ทรัพย์สิน
          </h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100">
            <X size={18} className="text-gray-500"/>
          </button>
        </div>

        <div className="bg-gray-50 rounded-xl px-4 py-3 mb-5">
          <p className="font-semibold text-gray-900 text-sm">{asset.Name}</p>
          <p className="text-xs text-gray-400 mt-0.5 font-mono">{asset.InvNo || asset.Id}</p>
        </div>

        {/* From → To */}
        <div className="flex items-center gap-3 mb-5">
          <div className="flex-1 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5 text-center">
            <p className="text-xs text-amber-600 mb-1">สถานที่เดิม</p>
            <p className="text-sm font-semibold text-amber-800">{asset.Location || 'ยังไม่ระบุ'}</p>
          </div>
          <ArrowRight size={20} className="text-gray-400 flex-shrink-0"/>
          <div className="flex-1">
            <p className="text-xs text-gray-500 mb-1 text-center">สถานที่ใหม่</p>
            <input type="text" required autoFocus value={toLocation}
              onChange={e => setToLocation(e.target.value)}
              placeholder="ระบุสถานที่ใหม่..."
              className="w-full px-3 py-2 text-sm border-2 border-blue-400 rounded-xl focus:outline-none focus:border-blue-600 text-center font-medium"/>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">หมายเหตุ</label>
            <textarea value={note} onChange={e => setNote(e.target.value)}
              placeholder="เช่น ย้ายเพื่อซ่อมแซมห้อง..." rows={2}
              className={`${inputCls} resize-none`}/>
          </div>
          <div className="flex gap-3">
            <button type="button" onClick={onClose} disabled={loading}
              className="flex-1 py-2.5 text-sm text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200 disabled:opacity-50 transition-colors">
              ยกเลิก
            </button>
            <button type="submit" disabled={loading || !toLocation.trim()}
              className="flex-[2] flex items-center justify-center gap-2 py-2.5 text-sm font-semibold text-white bg-green-600 rounded-xl hover:bg-green-700 disabled:opacity-50 transition-colors">
              {loading ? <><Loader2 size={14} className="animate-spin"/> กำลังบันทึก...</> : '✅ ยืนยันการย้าย'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ── Bulk Move Modal ───────────────────────────────────────────────────────────
const BulkMoveModal = ({ selectedAssets, onConfirm, onClose, loading }) => {
  const [toLocation, setToLocation] = useState('');
  const [note, setNote] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!toLocation.trim()) return;
    onConfirm({ toLocation, note });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-gray-900 flex items-center gap-2">
            <Truck size={18} className="text-orange-600"/> ย้ายสถานที่พร้อมกัน
          </h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100">
            <X size={18} className="text-gray-500"/>
          </button>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-4 text-sm text-amber-800">
          เลือกทรัพย์สิน <strong>{selectedAssets.length} รายการ</strong> จะถูกย้ายไปสถานที่เดียวกัน
        </div>

        {/* รายการที่เลือก */}
        <div className="max-h-36 overflow-y-auto border border-gray-100 rounded-xl mb-4 divide-y divide-gray-50">
          {selectedAssets.map(a => (
            <div key={a.Id} className="flex items-center gap-3 px-3 py-2">
              <Package size={13} className="text-gray-400 flex-shrink-0"/>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800 truncate">{a.Name}</p>
                <p className="text-xs text-gray-400">{a.InvNo || '-'}</p>
              </div>
              <span className="text-xs text-red-500 flex items-center gap-1 flex-shrink-0">
                <MapPin size={10}/>{a.Location || 'ไม่ระบุ'}
              </span>
            </div>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">สถานที่ใหม่ *</label>
            <input type="text" required autoFocus value={toLocation}
              onChange={e => setToLocation(e.target.value)}
              placeholder="ระบุสถานที่ใหม่..."
              className="w-full px-3 py-2.5 text-sm border-2 border-orange-400 rounded-xl focus:outline-none focus:border-orange-600 font-medium"/>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">หมายเหตุ</label>
            <textarea value={note} onChange={e => setNote(e.target.value)}
              placeholder="หมายเหตุการย้ายครั้งนี้..." rows={2}
              className={`${inputCls} resize-none`}/>
          </div>
          <div className="flex gap-3">
            <button type="button" onClick={onClose} disabled={loading}
              className="flex-1 py-2.5 text-sm text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200 disabled:opacity-50 transition-colors">
              ยกเลิก
            </button>
            <button type="submit" disabled={loading || !toLocation.trim()}
              className="flex-[2] flex items-center justify-center gap-2 py-2.5 text-sm font-semibold text-white bg-orange-500 rounded-xl hover:bg-orange-600 disabled:opacity-50 transition-colors">
              {loading
                ? <><Loader2 size={14} className="animate-spin"/> กำลังย้าย...</>
                : `✅ ย้าย ${selectedAssets.length} รายการ`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ── Main ──────────────────────────────────────────────────────────────────────
const LocationMovement = () => {
  const [assets, setAssets]         = useState([]);
  const [history, setHistory]       = useState([]);
  const [loading, setLoading]       = useState(true);
  const [moving, setMoving]         = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [showModal, setShowModal]   = useState(false);
  const [showBulk, setShowBulk]     = useState(false);
  const [selectedAsset, setSelectedAsset] = useState(null);
  const [toast, setToast]           = useState(null);
  const [activeTab, setActiveTab]   = useState('assets'); // 'assets' | 'history'

  // ── Search filters ────────────────────────────────────────────────────────
  const [searchName, setSearchName]         = useState('');
  const [searchInvNo, setSearchInvNo]       = useState('');
  const [searchLocation, setSearchLocation] = useState('');
  const [searchCategory, setSearchCategory] = useState('');
  const [searchSerial, setSearchSerial]     = useState('');
  const [statusFilter, setStatusFilter]     = useState('all');
  const [showFilters, setShowFilters]       = useState(false);

  // ── History search ────────────────────────────────────────────────────────
  const [histSearch, setHistSearch] = useState('');

  const { can } = usePermission();
  const canMove = can(PERMISSIONS.MOVE_ASSET);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  // ── Fetch ─────────────────────────────────────────────────────────────────
  const fetchAssets = useCallback(async () => {
    try {
      const res = await assetAPI.getAll();
      setAssets(res.data);
    } catch { showToast('ดึงข้อมูลทรัพย์สินไม่สำเร็จ', 'error'); }
  }, []);

  const fetchHistory = useCallback(async () => {
    try {
      const res = await api.get('/locations/history');
      setHistory(res.data);
    } catch { console.error('fetch history error'); }
  }, []);

  useEffect(() => {
    Promise.all([fetchAssets(), fetchHistory()]).finally(() => setLoading(false));
  }, []);

  // ── Filter assets ─────────────────────────────────────────────────────────
  const filteredAssets = assets.filter(a => {
    const matchName     = !searchName     || a.Name?.toLowerCase().includes(searchName.toLowerCase());
    const matchInvNo    = !searchInvNo    || a.InvNo?.toLowerCase().includes(searchInvNo.toLowerCase());
    const matchLocation = !searchLocation || a.Location?.toLowerCase().includes(searchLocation.toLowerCase());
    const matchCategory = !searchCategory || a.Category?.toLowerCase().includes(searchCategory.toLowerCase());
    const matchSerial   = !searchSerial   || a.SerialNumber?.toLowerCase().includes(searchSerial.toLowerCase());
    const matchStatus   = statusFilter === 'all' || String(a.Status) === statusFilter;
    return matchName && matchInvNo && matchLocation && matchCategory && matchSerial && matchStatus;
  });

  const hasFilter = searchName || searchInvNo || searchLocation || searchCategory || searchSerial || statusFilter !== 'all';

  const clearFilters = () => {
    setSearchName(''); setSearchInvNo(''); setSearchLocation('');
    setSearchCategory(''); setSearchSerial(''); setStatusFilter('all');
  };

  // ── Filter history ────────────────────────────────────────────────────────
  const filteredHistory = history.filter(h => {
    const q = histSearch.toLowerCase();
    return !q ||
      h.AssetName?.toLowerCase().includes(q) ||
      h.FromLocation?.toLowerCase().includes(q) ||
      h.ToLocation?.toLowerCase().includes(q) ||
      h.MovedByName?.toLowerCase().includes(q) ||
      h.Note?.toLowerCase().includes(q);
  });

  // ── Select ────────────────────────────────────────────────────────────────
  const toggleSelect = (id) =>
    setSelectedIds(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]);
  const toggleSelectAll = () =>
    setSelectedIds(selectedIds.length === filteredAssets.length ? [] : filteredAssets.map(a => a.Id));

  // ── Move single ───────────────────────────────────────────────────────────
  const handleMove = async ({ assetId, fromLocation, toLocation, note }) => {
    setMoving(true);
    try {
      await api.post('/locations/move', { assetId, fromLocation, toLocation, note });
      showToast(`ย้ายสำเร็จ → ${toLocation}`);
      setShowModal(false);
      await Promise.all([fetchAssets(), fetchHistory()]);
    } catch (err) {
      showToast(err.response?.data?.error || 'ย้ายไม่สำเร็จ', 'error');
    } finally { setMoving(false); }
  };

  // ── Bulk move ─────────────────────────────────────────────────────────────
  const handleBulkMove = async ({ toLocation, note }) => {
    setMoving(true);
    try {
      const toMove = assets.filter(a => selectedIds.includes(a.Id));
      for (const asset of toMove) {
        await api.post('/locations/move', {
          assetId: asset.Id,
          fromLocation: asset.Location || '-',
          toLocation,
          note,
        });
      }
      showToast(`ย้าย ${toMove.length} รายการ → ${toLocation} สำเร็จ`);
      setShowBulk(false);
      setSelectedIds([]);
      await Promise.all([fetchAssets(), fetchHistory()]);
    } catch (err) {
      showToast(err.response?.data?.error || 'ย้ายไม่สำเร็จ', 'error');
    } finally { setMoving(false); }
  };

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">

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
          <h1 className="text-2xl font-bold text-gray-900">ย้ายสถานที่ทรัพย์สิน</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            ทั้งหมด <span className="font-medium text-gray-700">{assets.length}</span> รายการ
            {filteredAssets.length !== assets.length && ` · แสดง ${filteredAssets.length} รายการ`}
            {selectedIds.length > 0 && <span className="text-blue-600 ml-2">· เลือก {selectedIds.length} รายการ</span>}
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => { fetchAssets(); fetchHistory(); }}
            className="p-2 rounded-xl hover:bg-gray-100 text-gray-400 transition-colors" title="รีเฟรช">
            <RefreshCw size={16}/>
          </button>
          {canMove && selectedIds.length > 0 && (
            <button onClick={() => setShowBulk(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-orange-500 text-white text-sm font-medium rounded-xl hover:bg-orange-600 transition-colors shadow-sm">
              <Truck size={16}/> ย้ายพร้อมกัน ({selectedIds.length})
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        {[
          { key: 'assets',  label: 'รายการทรัพย์สิน', icon: Package },
          { key: 'history', label: 'ประวัติการย้าย',   icon: History },
        ].map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors
              ${activeTab===tab.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
            <tab.icon size={15}/> {tab.label}
          </button>
        ))}
      </div>

      {/* ── Tab: Assets ── */}
      {activeTab === 'assets' && (
        <>
          {/* Search & Filter */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-3">
            {/* Quick search */}
            <div className="flex gap-3">
              <div className="relative flex-1">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
                <input type="text" placeholder="ค้นหาชื่อทรัพย์สิน..."
                  value={searchName} onChange={e => setSearchName(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"/>
              </div>
              <button onClick={() => setShowFilters(v => !v)}
                className={`flex items-center gap-2 px-3 py-2 text-sm rounded-lg border transition-colors
                  ${showFilters || hasFilter ? 'border-blue-400 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                <Filter size={14}/> ตัวกรอง
                {hasFilter && <span className="w-4 h-4 bg-blue-600 text-white rounded-full text-xs flex items-center justify-center">!</span>}
                <ChevronDown size={13} className={`transition-transform ${showFilters ? 'rotate-180' : ''}`}/>
              </button>
              {hasFilter && (
                <button onClick={clearFilters}
                  className="flex items-center gap-1.5 px-3 py-2 text-sm text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition-colors">
                  <X size={13}/> ล้าง
                </button>
              )}
            </div>

            {/* Advanced filters */}
            {showFilters && (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 pt-1 border-t border-gray-100">
                {[
                  { icon: Hash,    placeholder: 'InvNo',         value: searchInvNo,    set: setSearchInvNo    },
                  { icon: MapPin,  placeholder: 'สถานที่',        value: searchLocation, set: setSearchLocation },
                  { icon: Tag,     placeholder: 'หมวดหมู่',       value: searchCategory, set: setSearchCategory },
                  { icon: Hash,    placeholder: 'Serial Number',  value: searchSerial,   set: setSearchSerial   },
                ].map((f, i) => (
                  <div key={i} className="relative">
                    <f.icon size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400"/>
                    <input type="text" placeholder={f.placeholder} value={f.value}
                      onChange={e => f.set(e.target.value)}
                      className="w-full pl-7 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"/>
                  </div>
                ))}
                <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
                  className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                  <option value="all">ทุกสถานะ</option>
                  <option value="1">ว่าง / ปกติ</option>
                  <option value="2">ถูกยืม</option>
                  <option value="3">ส่งซ่อม</option>
                </select>
              </div>
            )}
          </div>

          {/* Table */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 size={28} className="animate-spin text-blue-500"/>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50">
                      <th className="px-4 py-3 w-10 text-center">
                        {canMove && (
                          <input type="checkbox"
                            checked={selectedIds.length === filteredAssets.length && filteredAssets.length > 0}
                            onChange={toggleSelectAll} className="rounded border-gray-300"/>
                        )}
                      </th>
                      {['ชื่อทรัพย์สิน','InvNo','S/N','หมวดหมู่','สถานที่ปัจจุบัน','สถานะ', canMove ? 'ย้าย' : ''].map((h,i) => (
                        <th key={i} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {filteredAssets.map(asset => {
                      const s = STATUS[asset.Status] || STATUS[1];
                      const isSelected = selectedIds.includes(asset.Id);
                      return (
                        <tr key={asset.Id} className={`transition-colors ${isSelected ? 'bg-blue-50' : 'hover:bg-gray-50'}`}>
                          <td className="px-4 py-3 text-center">
                            {canMove && (
                              <input type="checkbox" checked={isSelected}
                                onChange={() => toggleSelect(asset.Id)} className="rounded border-gray-300"/>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <p className="font-medium text-gray-900">{asset.Name}</p>
                          </td>
                          <td className="px-4 py-3">
                            <span className="font-mono text-xs bg-gray-100 px-2 py-0.5 rounded">{asset.InvNo || '-'}</span>
                          </td>
                          <td className="px-4 py-3 text-xs text-gray-500 font-mono">{asset.SerialNumber || '-'}</td>
                          <td className="px-4 py-3">
                            {asset.Category
                              ? <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">{asset.Category}</span>
                              : <span className="text-gray-400 text-xs">-</span>}
                          </td>
                          <td className="px-4 py-3">
                            <span className="inline-flex items-center gap-1.5 text-xs bg-amber-50 text-amber-800 px-2.5 py-1 rounded-full">
                              <MapPin size={11}/>{asset.Location || 'ยังไม่ระบุ'}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium ${s.color}`}>{s.label}</span>
                          </td>
                          {canMove && (
                            <td className="px-4 py-3">
                              <button
                                onClick={() => { setSelectedAsset(asset); setShowModal(true); }}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors">
                                <Truck size={12}/> ย้าย
                              </button>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                    {filteredAssets.length === 0 && (
                      <tr>
                        <td colSpan="8" className="py-16 text-center">
                          <MapPin size={32} className="mx-auto text-gray-300 mb-3"/>
                          <p className="text-gray-400 text-sm">
                            {hasFilter ? 'ไม่พบรายการที่ตรงกับเงื่อนไขการค้นหา' : 'ยังไม่มีข้อมูลทรัพย์สิน'}
                          </p>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* ── Tab: History ── */}
      {activeTab === 'history' && (
        <>
          {/* History search */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <div className="relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
              <input type="text" placeholder="ค้นหาประวัติ: ชื่อทรัพย์สิน, สถานที่, ผู้ย้าย, หมายเหตุ..."
                value={histSearch} onChange={e => setHistSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"/>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    {['วันที่/เวลา','ชื่อทรัพย์สิน','InvNo','จาก','ไปยัง','ผู้ย้าย','หมายเหตุ'].map((h,i) => (
                      <th key={i} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filteredHistory.map(h => (
                    <tr key={h.Id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                        {new Date(h.MovedAt).toLocaleString('th-TH')}
                      </td>
                      <td className="px-4 py-3 font-medium text-gray-900">{h.AssetName || '-'}</td>
                      <td className="px-4 py-3">
                        <span className="font-mono text-xs bg-gray-100 px-2 py-0.5 rounded">{h.InvNo || '-'}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1 text-xs text-red-600 bg-red-50 px-2 py-0.5 rounded-full">
                          <MapPin size={10}/>{h.FromLocation || '-'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1 text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
                          <MapPin size={10}/>{h.ToLocation || '-'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-600">{h.MovedByName || '-'}</td>
                      <td className="px-4 py-3 text-xs text-gray-500">{h.Note || '-'}</td>
                    </tr>
                  ))}
                  {filteredHistory.length === 0 && (
                    <tr>
                      <td colSpan="7" className="py-16 text-center">
                        <History size={32} className="mx-auto text-gray-300 mb-3"/>
                        <p className="text-gray-400 text-sm">
                          {histSearch ? 'ไม่พบประวัติที่ตรงกัน' : 'ยังไม่มีประวัติการย้าย'}
                        </p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Modals */}
      {showModal && selectedAsset && (
        <MoveModal asset={selectedAsset} onConfirm={handleMove} onClose={() => setShowModal(false)} loading={moving}/>
      )}
      {showBulk && (
        <BulkMoveModal
          selectedAssets={assets.filter(a => selectedIds.includes(a.Id))}
          onConfirm={handleBulkMove}
          onClose={() => setShowBulk(false)}
          loading={moving}
        />
      )}
    </div>
  );
};

export default LocationMovement;