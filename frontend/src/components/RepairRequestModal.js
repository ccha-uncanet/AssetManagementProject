import React, { useState, useRef, useEffect } from 'react';
import { X, Send, AlertTriangle, Image as ImageIcon, Trash2, Search, Package } from 'lucide-react';
import { repairAPI, assetAPI } from '../services/api';

const inputCls =
  'w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent bg-white placeholder-gray-400';

const URGENCY = [
  {
    value: 'urgent',
    label: 'เร่งด่วน',
    desc: 'ส่งผลต่อการใช้งานทันที',
    selectedCls: 'border-red-400 bg-red-50 ring-2 ring-red-200',
    dotCls: 'bg-red-500',
    textCls: 'text-red-700',
  },
  {
    value: 'normal',
    label: 'ปกติ',
    desc: 'ยังสามารถรอได้',
    selectedCls: 'border-blue-400 bg-blue-50 ring-2 ring-blue-200',
    dotCls: 'bg-blue-500',
    textCls: 'text-blue-700',
  },
];

// ─── RepairRequestModal ───────────────────────────────────────────────────────
// วางไฟล์นี้ที่: frontend/src/components/RepairRequestModal.js
//
// Props:
//   asset     — object จาก ScanAsset (มี Id, Name, InvNo, SerialNumber)
//   onClose   — callback ปิด modal
//   onSuccess — callback หลังส่งสำเร็จ (optional)
const RepairRequestModal = ({ asset: assetProp, onClose, onSuccess }) => {
  // When opened without a pre-selected asset, show an inline asset picker first
  const [pickedAsset, setPickedAsset] = useState(assetProp || null);
  const [allAssets, setAllAssets]     = useState([]);
  const [assetSearch, setAssetSearch] = useState('');
  const [loadingAssets, setLoadingAssets] = useState(!assetProp);

  const asset = pickedAsset; // alias for the rest of the form

  useEffect(() => {
    if (assetProp) return; // already have one
    assetAPI.getAll()
      .then(r => setAllAssets(r.data || []))
      .catch(() => {})
      .finally(() => setLoadingAssets(false));
  }, [assetProp]);

  const filteredAssets = allAssets.filter(a => {
    const q = assetSearch.toLowerCase();
    return !q || [a.Name, a.InvNo, a.SerialNumber, a.Location]
      .some(v => v?.toLowerCase().includes(q));
  });

  const [urgency, setUrgency]       = useState('normal');
  const [symptom, setSymptom]       = useState('');
  const [note, setNote]             = useState('');
  const [images, setImages]         = useState([]); // [{ file, url }]
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]           = useState('');
  const fileRef = useRef();
  const dropRef = useRef();

  // ── image helpers ────────────────────────────────────────────────────────
  const addFiles = (fileList) => {
    const valid = Array.from(fileList).filter((f) => f.type.startsWith('image/'));
    if (images.length + valid.length > 5) {
      setError('แนบรูปได้สูงสุด 5 รูปต่อคำขอ');
      return;
    }
    setImages((prev) => [
      ...prev,
      ...valid.map((f) => ({ file: f, url: URL.createObjectURL(f) })),
    ]);
    setError('');
  };

  const removeImage = (idx) => {
    setImages((prev) => {
      URL.revokeObjectURL(prev[idx].url);
      return prev.filter((_, i) => i !== idx);
    });
  };

  const handleDrop = (e) => {
    e.preventDefault();
    dropRef.current?.classList.remove('border-orange-400', 'bg-orange-50');
    addFiles(e.dataTransfer.files);
  };

  // ── submit ───────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!symptom.trim()) {
      setError('กรุณากรอกอาการเสีย / รายละเอียดปัญหา');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const fd = new FormData();
      fd.append('asset_id',   asset.Id);
      fd.append('asset_code', asset.InvNo   || '');
      fd.append('asset_name', asset.Name    || '');
      fd.append('urgency',    urgency);
      fd.append('symptom',    symptom.trim());
      fd.append('note',       note.trim());
      images.forEach((img, i) => fd.append(`image_${i}`, img.file));

      await repairAPI.create(fd);
      onSuccess?.();
      onClose();
    } catch (err) {
      setError(err?.response?.data?.message || 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[92vh] flex flex-col overflow-hidden">

        {/* header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h3 className="font-bold text-gray-900 text-base">แบบฟอร์มส่งซ่อม</h3>
            <p className="text-xs text-gray-400 mt-0.5">
              {asset?.InvNo && <span className="font-mono">{asset.InvNo} · </span>}
              {asset?.Name}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

          {/* Asset picker — shown when no asset pre-selected */}
          {!asset && (
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                เลือกทรัพย์สิน <span className="text-red-500">*</span>
              </label>
              <div className="relative mb-2">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
                <input
                  autoFocus
                  value={assetSearch}
                  onChange={e => setAssetSearch(e.target.value)}
                  placeholder="ค้นหาชื่อ, รหัส, สถานที่..."
                  className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white"
                />
              </div>
              <div className="max-h-52 overflow-y-auto border border-gray-100 rounded-xl divide-y divide-gray-50">
                {loadingAssets ? (
                  <p className="text-sm text-gray-400 text-center py-6">กำลังโหลด...</p>
                ) : filteredAssets.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-6">ไม่พบทรัพย์สิน</p>
                ) : filteredAssets.map(a => (
                  <button key={a.Id} type="button"
                    onClick={() => setPickedAsset(a)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-orange-50 text-left transition-colors">
                    <Package size={14} className="text-gray-400 flex-shrink-0"/>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{a.Name}</p>
                      <p className="text-xs text-gray-400">{a.InvNo || '—'} · {a.Location || '—'}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Selected asset display (when picked but not pre-passed) */}
          {asset && !assetProp && (
            <div className="flex items-center gap-3 bg-orange-50 rounded-xl px-4 py-3">
              <Package size={16} className="text-orange-500 flex-shrink-0"/>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900 truncate">{asset.Name}</p>
                <p className="text-xs text-gray-500">{asset.InvNo || '—'}</p>
              </div>
              <button type="button" onClick={() => setPickedAsset(null)}
                className="p-1 rounded-lg hover:bg-orange-100 text-orange-400">
                <X size={14}/>
              </button>
            </div>
          )}

          {/* error */}
          {error && (
            <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
              <AlertTriangle size={15} className="flex-shrink-0" />
              {error}
            </div>
          )}

          {/* urgency */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              ระดับความเร่งด่วน <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-2 gap-2">
              {URGENCY.map((u) => (
                <button
                  key={u.value}
                  type="button"
                  onClick={() => setUrgency(u.value)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl border-2 text-left transition-all
                    ${urgency === u.value ? u.selectedCls : 'border-gray-200 hover:border-gray-300 bg-white'}`}
                >
                  <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${u.dotCls}`} />
                  <div>
                    <p className={`text-sm font-semibold ${urgency === u.value ? u.textCls : 'text-gray-700'}`}>
                      {u.label}
                    </p>
                    <p className="text-xs text-gray-400">{u.desc}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* symptom */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
              อาการเสีย / รายละเอียดปัญหา <span className="text-red-500">*</span>
            </label>
            <textarea
              rows={4}
              value={symptom}
              onChange={(e) => { setSymptom(e.target.value); setError(''); }}
              placeholder="อธิบายอาการเสียหรือปัญหาที่พบ เช่น หน้าจอไม่ติด, เสียงดังผิดปกติ, เปิดไม่ติด..."
              className={`${inputCls} resize-none`}
            />
            <p className="text-xs text-gray-400 mt-1 text-right">{symptom.length} ตัวอักษร</p>
          </div>

          {/* image upload */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
              รูปภาพความเสียหาย
              <span className="text-gray-400 font-normal ml-1 normal-case">(สูงสุด 5 รูป)</span>
            </label>
            <div
              ref={dropRef}
              onDragOver={(e) => {
                e.preventDefault();
                dropRef.current?.classList.add('border-orange-400', 'bg-orange-50');
              }}
              onDragLeave={() =>
                dropRef.current?.classList.remove('border-orange-400', 'bg-orange-50')
              }
              onDrop={handleDrop}
              onClick={() => fileRef.current?.click()}
              className="border-2 border-dashed border-gray-200 rounded-xl py-5 flex flex-col items-center gap-1.5 cursor-pointer hover:border-orange-300 hover:bg-orange-50/40 transition-colors"
            >
              <ImageIcon size={24} className="text-gray-300" />
              <p className="text-sm text-gray-400">คลิกหรือลากรูปมาวาง</p>
              <p className="text-xs text-gray-300">PNG, JPG, WEBP</p>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => addFiles(e.target.files)}
              />
            </div>

            {images.length > 0 && (
              <div className="mt-3 grid grid-cols-5 gap-2">
                {images.map((img, idx) => (
                  <div
                    key={idx}
                    className="relative group aspect-square rounded-xl overflow-hidden border border-gray-200"
                  >
                    <img src={img.url} alt="" className="w-full h-full object-cover" />
                    <button
                      onClick={() => removeImage(idx)}
                      className="absolute inset-0 bg-black/50 hidden group-hover:flex items-center justify-center rounded-xl"
                    >
                      <Trash2 size={16} className="text-white" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* note */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
              หมายเหตุเพิ่มเติม
            </label>
            <textarea
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="ข้อมูลเพิ่มเติม เช่น ช่วงเวลาที่เกิดปัญหา, การใช้งานก่อนเสีย..."
              className={`${inputCls} resize-none`}
            />
          </div>
        </div>

        {/* footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="flex-1 py-2.5 text-sm text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors disabled:opacity-50"
          >
            ยกเลิก
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting || !symptom.trim() || !asset}
            className="flex-[2] flex items-center justify-center gap-2 py-2.5 text-sm font-semibold text-white bg-orange-500 rounded-xl hover:bg-orange-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                </svg>
                กำลังส่ง...
              </>
            ) : (
              <>
                <Send size={15} />
                ส่งคำขอซ่อม
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default RepairRequestModal;