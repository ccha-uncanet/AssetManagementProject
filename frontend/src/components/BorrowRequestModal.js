import React, { useState } from 'react';
import { X, Send, AlertTriangle, Trash2, Package, ArrowUpFromLine } from 'lucide-react';
import { borrowAPI } from '../services/api';

const inputCls =
  'w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-400 focus:border-transparent bg-white placeholder-gray-400';

// ─── BorrowRequestModal ───────────────────────────────────────────────────────
// Props:
//   assets    — array of asset objects [{ Id, Name, InvNo }] (1 หรือหลายชิ้น)
//   onClose   — callback ปิด modal
//   onSuccess — callback หลังส่งสำเร็จ
const BorrowRequestModal = ({ assets = [], onClose, onSuccess }) => {
  const [borrowerName, setBorrowerName]   = useState('');
  const [expectedReturn, setExpectedReturn] = useState('');
  const [note, setNote]                   = useState('');
  const [submitting, setSubmitting]       = useState(false);
  const [error, setError]                 = useState('');
  const [list, setList]                   = useState(assets); // ลบออกจาก list ได้

  const removeAsset = (id) => setList(prev => prev.filter(a => a.Id !== id));

  const handleSubmit = async () => {
    if (!borrowerName.trim()) { setError('กรุณากรอกชื่อผู้ยืม'); return; }
    if (!expectedReturn)      { setError('กรุณาระบุวันกำหนดคืน'); return; }
    if (!list.length)         { setError('กรุณาเลือกทรัพย์สินอย่างน้อย 1 รายการ'); return; }

    setSubmitting(true);
    setError('');
    try {
      await borrowAPI.create({
        borrower_name:   borrowerName.trim(),
        expected_return: expectedReturn,
        note:            note.trim(),
        assets: list.map(a => ({
          id:   a.Id,
          code: a.InvNo || '',
          name: a.Name  || a.asset_name || '',
        })),
      });
      onSuccess?.();
      onClose();
    } catch (err) {
      setError(err?.response?.data?.message || 'เกิดข้อผิดพลาด กรุณาลองใหม่');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[92vh] flex flex-col overflow-hidden">

        {/* header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-red-100 flex items-center justify-center">
              <ArrowUpFromLine size={16} className="text-red-600" />
            </div>
            <div>
              <h3 className="font-bold text-gray-900 text-base">แบบฟอร์มขอยืมทรัพย์สิน</h3>
              <p className="text-xs text-gray-400 mt-0.5">{list.length} รายการ</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">
            <X size={18} />
          </button>
        </div>

        {/* body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

          {/* error */}
          {error && (
            <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
              <AlertTriangle size={15} className="flex-shrink-0" />
              {error}
            </div>
          )}

          {/* asset list */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              รายการทรัพย์สินที่ขอยืม
            </label>
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {list.map(a => (
                <div key={a.Id}
                  className="flex items-center gap-3 bg-gray-50 rounded-xl px-3 py-2.5">
                  <Package size={14} className="text-gray-400 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{a.Name || a.asset_name}</p>
                    <p className="text-xs text-gray-400">{a.InvNo || '-'}</p>
                  </div>
                  {list.length > 1 && (
                    <button onClick={() => removeAsset(a.Id)}
                      className="p-1 rounded-lg hover:bg-red-50 text-gray-300 hover:text-red-500 transition-colors">
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* borrower name */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
              ชื่อผู้ยืม <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={borrowerName}
              onChange={e => { setBorrowerName(e.target.value); setError(''); }}
              placeholder="ชื่อ-นามสกุลผู้ยืม"
              className={inputCls}
              autoFocus
            />
          </div>

          {/* expected return */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
              กำหนดวันคืน <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={expectedReturn}
              onChange={e => { setExpectedReturn(e.target.value); setError(''); }}
              min={new Date().toISOString().split('T')[0]}
              className={inputCls}
            />
          </div>

          {/* note */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
              หมายเหตุ
            </label>
            <textarea
              rows={2}
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="วัตถุประสงค์การยืม หรือข้อมูลเพิ่มเติม..."
              className={`${inputCls} resize-none`}
            />
          </div>
        </div>

        {/* footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex gap-3">
          <button type="button" onClick={onClose} disabled={submitting}
            className="flex-1 py-2.5 text-sm text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors disabled:opacity-50">
            ยกเลิก
          </button>
          <button type="button" onClick={handleSubmit}
            disabled={submitting || !borrowerName.trim() || !expectedReturn || !list.length}
            className="flex-[2] flex items-center justify-center gap-2 py-2.5 text-sm font-semibold text-white bg-red-500 rounded-xl hover:bg-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
            {submitting ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                </svg>
                กำลังส่ง...
              </>
            ) : (
              <><Send size={15}/> ส่งคำขอยืม ({list.length} รายการ)</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default BorrowRequestModal;