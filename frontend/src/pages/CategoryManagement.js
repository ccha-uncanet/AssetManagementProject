import React, { useState, useEffect, useCallback } from 'react';
import { Tag, Search, Pencil, Trash2, Loader2, X, AlertTriangle, ChevronRight, Package } from 'lucide-react';
import { categoryAPI, assetAPI } from '../services/api';

const inputCls = 'w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent';

const STATUS_LABEL = { 1: 'พร้อมใช้', 2: 'ยืมอยู่', 3: 'ซ่อม' };
const STATUS_COLOR = { 1: 'bg-green-100 text-green-700', 2: 'bg-yellow-100 text-yellow-700', 3: 'bg-red-100 text-red-700' };

function Toast({ toast }) {
  if (!toast) return null;
  const colors = { success: 'bg-green-500', error: 'bg-red-500' };
  return (
    <div className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-xl text-white text-sm font-medium shadow-lg ${colors[toast.type] ?? colors.success}`}>
      {toast.message}
    </div>
  );
}

function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-800">{title}</h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100 text-gray-400 transition-colors"><X size={16}/></button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

export default function CategoryManagement() {
  const [categories, setCategories]   = useState([]);
  const [loading, setLoading]         = useState(true);
  const [searchTerm, setSearchTerm]   = useState('');
  const [toast, setToast]             = useState(null);

  // Detail panel
  const [selectedCat, setSelectedCat]     = useState(null); // { Category, AssetCount }
  const [catAssets, setCatAssets]         = useState([]);
  const [loadingAssets, setLoadingAssets] = useState(false);
  const [assetSearch, setAssetSearch]     = useState('');

  // Rename modal
  const [renameTarget, setRenameTarget] = useState(null);
  const [newName, setNewName]           = useState('');
  const [saving, setSaving]             = useState(false);

  // Delete confirm
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting]         = useState(false);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  const fetchCategories = useCallback(async () => {
    setLoading(true);
    try {
      const res = await categoryAPI.getAll();
      setCategories(res.data.filter(c => c.Category));
    } catch {
      showToast('ไม่สามารถดึงข้อมูลได้', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchCategories(); }, [fetchCategories]);

  const filtered = categories.filter(c =>
    c.Category?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalAssets = categories.reduce((s, c) => s + c.AssetCount, 0);

  // ── Category detail panel ────────────────────────────────────────────────────
  const openCategory = async (cat) => {
    setSelectedCat(cat);
    setAssetSearch('');
    setLoadingAssets(true);
    try {
      const res = await assetAPI.getAll();
      setCatAssets(res.data.filter(a => a.Category === cat.Category));
    } catch {
      showToast('ไม่สามารถดึงรายการทรัพย์สินได้', 'error');
    } finally {
      setLoadingAssets(false);
    }
  };

  const closeDetail = () => { setSelectedCat(null); setCatAssets([]); setAssetSearch(''); };

  const filteredCatAssets = catAssets.filter(a =>
    [a.Name, a.InvNo, a.SerialNumber, a.Location].some(v =>
      v?.toLowerCase().includes(assetSearch.toLowerCase())
    )
  );

  // ── Rename ───────────────────────────────────────────────────────────────────
  const handleRenameOpen = (e, cat) => {
    e.stopPropagation();
    setRenameTarget(cat);
    setNewName(cat.Category);
  };

  const handleRenameSubmit = async (e) => {
    e.preventDefault();
    if (!newName.trim() || newName.trim() === renameTarget.Category) { setRenameTarget(null); return; }
    setSaving(true);
    try {
      await categoryAPI.rename({ oldName: renameTarget.Category, newName: newName.trim() });
      showToast(`เปลี่ยนชื่อเป็น "${newName.trim()}" สำเร็จ`);
      if (selectedCat?.Category === renameTarget.Category)
        setSelectedCat(prev => ({ ...prev, Category: newName.trim() }));
      setRenameTarget(null);
      fetchCategories();
    } catch {
      showToast('เปลี่ยนชื่อไม่สำเร็จ', 'error');
    } finally { setSaving(false); }
  };

  // ── Delete ───────────────────────────────────────────────────────────────────
  const handleDeleteConfirm = async () => {
    setDeleting(true);
    try {
      await categoryAPI.delete(deleteTarget.Category);
      showToast(`ลบหมวดหมู่ "${deleteTarget.Category}" สำเร็จ`);
      if (selectedCat?.Category === deleteTarget.Category) closeDetail();
      setDeleteTarget(null);
      fetchCategories();
    } catch {
      showToast('ลบไม่สำเร็จ', 'error');
    } finally { setDeleting(false); }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 bg-blue-50 rounded-xl"><Tag size={20} className="text-blue-600"/></div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">หมวดหมู่ทรัพย์สิน</h1>
          <p className="text-sm text-gray-500">จัดการหมวดหมู่และดูจำนวนทรัพย์สินในแต่ละหมวด</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <p className="text-xs text-gray-500 mb-1">หมวดหมู่ทั้งหมด</p>
          <p className="text-2xl font-bold text-gray-900">{categories.length}</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <p className="text-xs text-gray-500 mb-1">ทรัพย์สินที่มีหมวดหมู่</p>
          <p className="text-2xl font-bold text-gray-900">{totalAssets}</p>
        </div>
      </div>

      {/* Main layout: list + detail panel */}
      <div className={`flex gap-4 ${selectedCat ? 'items-start' : ''}`}>

        {/* Left: category list */}
        <div className={`flex flex-col gap-4 transition-all ${selectedCat ? 'w-80 flex-shrink-0' : 'flex-1'}`}>
          {/* Search */}
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
            <input
              type="text"
              placeholder="ค้นหาหมวดหมู่..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className={`${inputCls} pl-8`}
            />
          </div>

          {/* Table */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            {loading ? (
              <div className="flex items-center justify-center gap-2 py-20 text-gray-400">
                <Loader2 size={18} className="animate-spin"/> กำลังโหลด...
              </div>
            ) : filtered.length === 0 ? (
              <div className="py-20 text-center">
                <Tag size={32} className="mx-auto text-gray-300 mb-3"/>
                <p className="text-gray-400 text-sm">{searchTerm ? 'ไม่พบหมวดหมู่ที่ตรงกัน' : 'ยังไม่มีหมวดหมู่'}</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50">
                      {(selectedCat
                        ? ['ชื่อหมวดหมู่', 'จำนวน', '']
                        : ['#', 'ชื่อหมวดหมู่', 'จำนวนทรัพย์สิน', 'จัดการ']
                      ).map((h, i) => (
                        <th key={i} className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide text-left">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {filtered.map((cat, i) => {
                      const active = selectedCat?.Category === cat.Category;
                      return (
                        <tr
                          key={cat.Category}
                          onClick={() => active ? closeDetail() : openCategory(cat)}
                          className={`cursor-pointer transition-colors ${active ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
                        >
                          {!selectedCat && (
                            <td className="px-4 py-3 text-gray-400 tabular-nums w-10">{i + 1}</td>
                          )}
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center gap-1.5 text-sm font-medium ${active ? 'text-blue-700' : 'text-gray-800'}`}>
                              <Tag size={13} className={active ? 'text-blue-500' : 'text-blue-400'}/>
                              {cat.Category}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${active ? 'bg-blue-100 text-blue-800' : 'bg-blue-50 text-blue-700'}`}>
                              {cat.AssetCount} รายการ
                            </span>
                          </td>
                          {!selectedCat && (
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={e => handleRenameOpen(e, cat)}
                                  className="p-1.5 rounded-lg hover:bg-blue-50 text-gray-400 hover:text-blue-600 transition-colors"
                                  title="เปลี่ยนชื่อ">
                                  <Pencil size={14}/>
                                </button>
                                <button
                                  onClick={e => { e.stopPropagation(); setDeleteTarget(cat); }}
                                  className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"
                                  title="ลบหมวดหมู่">
                                  <Trash2 size={14}/>
                                </button>
                              </div>
                            </td>
                          )}
                          {selectedCat && (
                            <td className="px-3 py-3 text-gray-300">
                              <ChevronRight size={14} className={active ? 'text-blue-500' : ''}/>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Right: asset detail panel */}
        {selectedCat && (
          <div className="flex-1 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            {/* Panel header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 bg-gray-50">
              <div className="flex items-center gap-2">
                <Tag size={15} className="text-blue-500"/>
                <span className="font-semibold text-gray-800">{selectedCat.Category}</span>
                <span className="text-xs text-gray-400">({selectedCat.AssetCount} รายการ)</span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={e => handleRenameOpen(e, selectedCat)}
                  className="p-1.5 rounded-lg hover:bg-blue-50 text-gray-400 hover:text-blue-600 transition-colors"
                  title="เปลี่ยนชื่อ">
                  <Pencil size={14}/>
                </button>
                <button
                  onClick={() => setDeleteTarget(selectedCat)}
                  className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"
                  title="ลบหมวดหมู่">
                  <Trash2 size={14}/>
                </button>
                <button onClick={closeDetail} className="p-1.5 rounded-lg hover:bg-gray-200 text-gray-400 transition-colors ml-1">
                  <X size={14}/>
                </button>
              </div>
            </div>

            {/* Asset search */}
            <div className="px-4 py-3 border-b border-gray-100">
              <div className="relative">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
                <input
                  type="text"
                  placeholder="ค้นหาทรัพย์สิน..."
                  value={assetSearch}
                  onChange={e => setAssetSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Asset list */}
            <div className="overflow-y-auto max-h-[60vh]">
              {loadingAssets ? (
                <div className="flex items-center justify-center gap-2 py-16 text-gray-400">
                  <Loader2 size={16} className="animate-spin"/> กำลังโหลด...
                </div>
              ) : filteredCatAssets.length === 0 ? (
                <div className="py-16 text-center">
                  <Package size={28} className="mx-auto text-gray-300 mb-2"/>
                  <p className="text-gray-400 text-sm">{assetSearch ? 'ไม่พบรายการที่ตรงกัน' : 'ไม่มีทรัพย์สินในหมวดนี้'}</p>
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-white border-b border-gray-100">
                    <tr>
                      {['#', 'Inv No', 'ชื่อทรัพย์สิน', 'สถานที่', 'สถานะ'].map((h, i) => (
                        <th key={i} className="px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide text-left">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {filteredCatAssets.map((a, i) => (
                      <tr key={a.Id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-2.5 text-gray-400 tabular-nums text-xs">{i + 1}</td>
                        <td className="px-4 py-2.5">
                          <span className="font-mono text-xs bg-gray-100 px-2 py-0.5 rounded">{a.InvNo || '-'}</span>
                        </td>
                        <td className="px-4 py-2.5 font-medium text-gray-900">{a.Name}</td>
                        <td className="px-4 py-2.5 text-xs text-gray-500">{a.Location || '-'}</td>
                        <td className="px-4 py-2.5">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLOR[a.Status] ?? 'bg-gray-100 text-gray-500'}`}>
                            {STATUS_LABEL[a.Status] ?? '-'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Rename Modal */}
      {renameTarget && (
        <Modal title="เปลี่ยนชื่อหมวดหมู่" onClose={() => setRenameTarget(null)}>
          <form onSubmit={handleRenameSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">ชื่อใหม่</label>
              <input type="text" required value={newName} onChange={e => setNewName(e.target.value)} className={inputCls} autoFocus/>
              <p className="text-xs text-gray-400 mt-1">จะอัปเดตทรัพย์สิน {renameTarget.AssetCount} รายการที่อยู่ในหมวดนี้</p>
            </div>
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => setRenameTarget(null)}
                className="flex-1 py-2.5 text-sm text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors">ยกเลิก</button>
              <button type="submit" disabled={saving}
                className="flex-[2] flex items-center justify-center gap-2 py-2.5 text-sm font-semibold text-white bg-blue-600 rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-colors">
                {saving ? <><Loader2 size={14} className="animate-spin"/> กำลังบันทึก...</> : 'บันทึก'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Delete Confirm Modal */}
      {deleteTarget && (
        <Modal title="ยืนยันการลบหมวดหมู่" onClose={() => setDeleteTarget(null)}>
          <div className="space-y-4">
            <div className="flex items-start gap-3 p-3 bg-orange-50 rounded-xl">
              <AlertTriangle size={16} className="text-orange-500 mt-0.5 flex-shrink-0"/>
              <p className="text-sm text-orange-700">
                จะล้างหมวดหมู่ <strong>"{deleteTarget.Category}"</strong> ออกจากทรัพย์สิน {deleteTarget.AssetCount} รายการ
                (ทรัพย์สินจะยังอยู่ในระบบ แต่ไม่มีหมวดหมู่)
              </p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setDeleteTarget(null)} disabled={deleting}
                className="flex-1 py-2.5 text-sm text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200 disabled:opacity-50 transition-colors">ยกเลิก</button>
              <button onClick={handleDeleteConfirm} disabled={deleting}
                className="flex-[2] flex items-center justify-center gap-2 py-2.5 text-sm font-semibold text-white bg-red-500 rounded-xl hover:bg-red-600 disabled:opacity-50 transition-colors">
                {deleting ? <><Loader2 size={14} className="animate-spin"/> กำลังลบ...</> : <><Trash2 size={14}/> ลบหมวดหมู่</>}
              </button>
            </div>
          </div>
        </Modal>
      )}

      <Toast toast={toast}/>
    </div>
  );
}
