import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import api from '../services/api';
import usePermission from '../hooks/usePermission';
import { PERMISSIONS } from '../constants/permissions';
import {
  Upload, Download, FileSpreadsheet, CheckCircle2,
  AlertTriangle, X, Loader2, Radio, Trash2,
  ArrowRight, Table, Info
} from 'lucide-react';

// ── Main ──────────────────────────────────────────────────────────────────────
const ImportAssets = () => {
  const [activeTab, setActiveTab]     = useState('excel'); // 'excel' | 'rfid'
  const [file, setFile]               = useState(null);
  const [preview, setPreview]         = useState([]);
  const [totalRows, setTotalRows]     = useState(0);
  const [importing, setImporting]     = useState(false);
  const [result, setResult]           = useState(null);
  const [dragOver, setDragOver]       = useState(false);
  const [rfidInput, setRfidInput]     = useState('');
  const [scannedRfids, setScannedRfids] = useState([]);
  const [toast, setToast]             = useState(null);

  const fileInputRef = useRef(null);
  const rfidRef      = useRef(null);
  const navigate     = useNavigate();
  const { can }      = usePermission();

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  // ── Excel Tab ─────────────────────────────────────────────────────────────
  const handleFileChange = (f) => {
    if (!f) return;
    if (!f.name.endsWith('.xlsx')) {
      showToast('กรุณาเลือกไฟล์ .xlsx เท่านั้น', 'error');
      return;
    }
    setFile(f);
    setResult(null);

    const reader = new FileReader();
    reader.onload = (evt) => {
      const wb = XLSX.read(evt.target.result, { type: 'binary' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json(ws);
      setTotalRows(data.length);
      setPreview(data.slice(0, 5));
    };
    reader.readAsBinaryString(f);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFileChange(f);
  };

  const handleDownloadTemplate = async () => {
    try {
      const res = await api.get('/import/template', { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = 'asset_import_template.xlsx';
      a.click();
      window.URL.revokeObjectURL(url);
    } catch { showToast('ดาวน์โหลด Template ไม่สำเร็จ', 'error'); }
  };

  const handleImport = async () => {
    if (!file) { showToast('กรุณาเลือกไฟล์ก่อน', 'error'); return; }
    if (!window.confirm(`นำเข้าข้อมูลทั้งหมด ${totalRows} รายการใช่ไหม?`)) return;

    setImporting(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await api.post('/import/assets', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setResult(res.data);
      setFile(null);
      setPreview([]);
      setTotalRows(0);
    } catch (err) {
      showToast(err.response?.data?.error || 'นำเข้าไม่สำเร็จ', 'error');
    } finally { setImporting(false); }
  };

  const clearFile = () => {
    setFile(null);
    setPreview([]);
    setTotalRows(0);
    setResult(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // ── RFID Tab ──────────────────────────────────────────────────────────────
  const handleRfidScan = (e) => {
    e.preventDefault();
    const tag = rfidInput.trim();
    if (!tag) return;
    if (scannedRfids.find(r => r.tag === tag)) {
      showToast('สแกน RFID นี้ไปแล้ว', 'error');
      setRfidInput('');
      return;
    }
    setScannedRfids(prev => [...prev, { tag, time: new Date().toLocaleTimeString('th-TH') }]);
    setRfidInput('');
    rfidRef.current?.focus();
  };

  const handleExportRfid = () => {
    const data = scannedRfids.map((r, i) => ({
      'ลำดับ': i + 1, 'RFID Tag': r.tag, 'เวลาที่สแกน': r.time,
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'RFID Scan');
    ws['!cols'] = [{ wch: 8 }, { wch: 30 }, { wch: 15 }];
    XLSX.writeFile(wb, `rfid_scan_${new Date().toLocaleDateString('th-TH')}.xlsx`);
  };

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5 max-w-4xl">

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
        <h1 className="text-2xl font-bold text-gray-900">นำเข้าทรัพย์สิน</h1>
        <p className="text-sm text-gray-500 mt-0.5">Import ข้อมูลจาก Excel หรือสแกน RFID</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        {[
          { key: 'excel', label: 'Import Excel', icon: FileSpreadsheet },
          { key: 'rfid',  label: 'สแกน RFID',   icon: Radio },
        ].map(tab => (
          <button key={tab.key}
            onClick={() => { setActiveTab(tab.key); if (tab.key==='rfid') setTimeout(() => rfidRef.current?.focus(), 100); }}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors
              ${activeTab===tab.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
            <tab.icon size={15}/> {tab.label}
          </button>
        ))}
      </div>

      {/* ── Excel Tab ── */}
      {activeTab === 'excel' && (
        <div className="space-y-5">

          {/* Template download */}
          <div className="bg-blue-50 border border-blue-200 rounded-2xl p-5 flex items-center justify-between gap-4">
            <div>
              <p className="font-semibold text-blue-900 flex items-center gap-2">
                <Table size={16}/> Template Excel
              </p>
              <p className="text-sm text-blue-700 mt-0.5">
                ดาวน์โหลด template กรอกข้อมูล แล้ว upload กลับมา
              </p>
            </div>
            <button onClick={handleDownloadTemplate}
              className="flex items-center gap-2 px-4 py-2.5 bg-green-600 text-white text-sm font-semibold rounded-xl hover:bg-green-700 transition-colors whitespace-nowrap shadow-sm">
              <Download size={15}/> ดาวน์โหลด Template
            </button>
          </div>

          {/* Column guide */}
          <div className="bg-gray-50 rounded-2xl border border-gray-100 p-5">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-1.5">
              <Info size={13}/> คอลัมน์ที่รองรับ
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {[
                { col: 'InvNo / รหัสทรัพย์สิน', req: false },
                { col: 'Name / ชื่อ',            req: true  },
                { col: 'Category / หมวดหมู่',    req: false },
                { col: 'Location / สถานที่',      req: false },
                { col: 'SerialNumber / Serial Number', req: false },
                { col: 'PurchaseDate / วันที่ซื้อ',   req: false },
                { col: 'PurchasePrice / ราคา',    req: false },
                { col: 'Description / รายละเอียด', req: false },
              ].map(item => (
                <div key={item.col} className="flex items-center gap-1.5 text-xs">
                  <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${item.req ? 'bg-red-500' : 'bg-gray-300'}`}/>
                  <span className="font-mono text-gray-600">{item.col}</span>
                  {item.req && <span className="text-red-500 text-xs">*</span>}
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-400 mt-3">* = จำเป็น</p>
          </div>

          {/* Drop zone */}
          {!file && (
            <div
              onDrop={handleDrop}
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              className={`border-2 border-dashed rounded-2xl p-10 text-center transition-all cursor-pointer
                ${dragOver ? 'border-blue-500 bg-blue-50' : 'border-gray-200 bg-gray-50 hover:border-blue-300 hover:bg-blue-50/30'}`}
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload size={36} className={`mx-auto mb-3 ${dragOver ? 'text-blue-500' : 'text-gray-300'}`}/>
              <p className="text-gray-600 font-medium mb-1">วางไฟล์ที่นี่ หรือคลิกเพื่อเลือก</p>
              <p className="text-xs text-gray-400">รองรับเฉพาะไฟล์ .xlsx</p>
              <input ref={fileInputRef} type="file" accept=".xlsx" className="hidden"
                onChange={e => handleFileChange(e.target.files[0])}/>
            </div>
          )}

          {/* File selected */}
          {file && !result && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
                    <FileSpreadsheet size={20} className="text-green-600"/>
                  </div>
                  <div>
                    <p className="font-semibold text-gray-800">{file.name}</p>
                    <p className="text-xs text-gray-500">พบข้อมูล {totalRows} รายการ</p>
                  </div>
                </div>
                <button onClick={clearFile} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">
                  <X size={16}/>
                </button>
              </div>

              {/* Preview table */}
              {preview.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                    ตัวอย่างข้อมูล ({preview.length} แถวแรก จากทั้งหมด {totalRows} แถว)
                  </p>
                  <div className="overflow-x-auto rounded-xl border border-gray-100">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-100">
                          {Object.keys(preview[0]).map(k => (
                            <th key={k} className="px-3 py-2 text-left font-semibold text-gray-500 whitespace-nowrap">{k}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {preview.map((row, i) => (
                          <tr key={i} className="hover:bg-gray-50">
                            {Object.values(row).map((v, j) => (
                              <td key={j} className="px-3 py-2 text-gray-700 whitespace-nowrap">{String(v)}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <button onClick={handleImport} disabled={importing}
                className="w-full flex items-center justify-center gap-2 py-3 text-sm font-semibold text-white bg-green-600 rounded-xl hover:bg-green-700 disabled:opacity-50 transition-colors">
                {importing
                  ? <><Loader2 size={16} className="animate-spin"/> กำลังนำเข้า {totalRows} รายการ...</>
                  : <><Upload size={16}/> นำเข้าข้อมูลทั้งหมด {totalRows} รายการ</>}
              </button>
            </div>
          )}

          {/* Result */}
          {result && (
            <div className={`bg-white rounded-2xl border-2 shadow-sm p-6 ${result.failed===0 ? 'border-green-200' : 'border-amber-200'}`}>
              <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                {result.failed===0
                  ? <CheckCircle2 size={20} className="text-green-600"/>
                  : <AlertTriangle size={20} className="text-amber-500"/>}
                ผลการนำเข้า
              </h3>
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="bg-green-50 rounded-xl p-4 text-center">
                  <p className="text-3xl font-bold text-green-700 tabular-nums">{result.success}</p>
                  <p className="text-sm text-green-600 mt-1">นำเข้าสำเร็จ</p>
                </div>
                <div className={`rounded-xl p-4 text-center ${result.failed > 0 ? 'bg-red-50' : 'bg-gray-50'}`}>
                  <p className={`text-3xl font-bold tabular-nums ${result.failed > 0 ? 'text-red-600' : 'text-gray-400'}`}>{result.failed}</p>
                  <p className={`text-sm mt-1 ${result.failed > 0 ? 'text-red-500' : 'text-gray-400'}`}>ล้มเหลว</p>
                </div>
              </div>

              {result.errors?.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4">
                  <p className="text-xs font-semibold text-red-700 mb-2">รายการที่มีปัญหา:</p>
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {result.errors.map((e, i) => (
                      <p key={i} className="text-xs text-red-600">• {e}</p>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-3">
                <button onClick={() => { setResult(null); }}
                  className="flex-1 py-2.5 text-sm text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors">
                  นำเข้าเพิ่มเติม
                </button>
                <button onClick={() => navigate('/app/assets')}
                  className="flex-[2] flex items-center justify-center gap-2 py-2.5 text-sm font-semibold text-white bg-blue-600 rounded-xl hover:bg-blue-700 transition-colors">
                  ไปหน้าจัดการทรัพย์สิน <ArrowRight size={15}/>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── RFID Tab ── */}
      {activeTab === 'rfid' && (
        <div className="space-y-5">

          {/* Info */}
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3 text-sm text-amber-800">
            <Info size={16} className="flex-shrink-0 mt-0.5"/>
            เชื่อมต่อ RFID Reader ผ่าน USB แล้วคลิกช่องด้านล่าง จากนั้นเดินสแกนได้เลย — ระบบบันทึก Tag อัตโนมัติ
          </div>

          {/* RFID input */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <form onSubmit={handleRfidScan} className="flex gap-3">
              <div className="relative flex-1">
                <Radio size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-orange-500"/>
                <input ref={rfidRef} type="text" value={rfidInput}
                  onChange={e => setRfidInput(e.target.value)}
                  placeholder="พร้อมรับสัญญาณ RFID... (คลิกที่นี่ก่อน)"
                  autoComplete="off"
                  className="w-full pl-9 pr-4 py-3 text-sm border-2 border-orange-300 rounded-xl focus:outline-none focus:border-orange-500 bg-orange-50/30"/>
              </div>
              <button type="submit"
                className="flex items-center gap-2 px-5 py-3 bg-orange-500 text-white text-sm font-semibold rounded-xl hover:bg-orange-600 transition-colors">
                บันทึก
              </button>
            </form>
          </div>

          {/* Stats + Actions */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-orange-500 text-white rounded-xl px-5 py-3 text-center">
                <p className="text-2xl font-bold tabular-nums">{scannedRfids.length}</p>
                <p className="text-xs opacity-80">สแกนแล้ว</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={handleExportRfid} disabled={scannedRfids.length===0}
                className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-green-700 bg-green-50 rounded-xl hover:bg-green-100 disabled:opacity-40 transition-colors">
                <Download size={14}/> Export Excel
              </button>
              <button onClick={() => { if (window.confirm('ล้างรายการทั้งหมด?')) setScannedRfids([]); }}
                disabled={scannedRfids.length===0}
                className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-red-600 bg-red-50 rounded-xl hover:bg-red-100 disabled:opacity-40 transition-colors">
                <Trash2 size={14}/> ล้างทั้งหมด
              </button>
            </div>
          </div>

          {/* RFID Table */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide w-16">#</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">RFID Tag</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">เวลาที่สแกน</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide w-16">ลบ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {scannedRfids.map((r, i) => (
                  <tr key={i} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-center text-gray-500 tabular-nums">{i+1}</td>
                    <td className="px-4 py-3 font-mono text-sm text-gray-800">{r.tag}</td>
                    <td className="px-4 py-3 text-xs text-gray-500">{r.time}</td>
                    <td className="px-4 py-3 text-center">
                      <button onClick={() => setScannedRfids(prev => prev.filter((_,idx) => idx!==i))}
                        className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors">
                        <Trash2 size={14}/>
                      </button>
                    </td>
                  </tr>
                ))}
                {scannedRfids.length===0 && (
                  <tr>
                    <td colSpan="4" className="py-16 text-center">
                      <Radio size={32} className="mx-auto text-gray-300 mb-3"/>
                      <p className="text-gray-400 text-sm">ยังไม่มีรายการ — คลิกช่องด้านบนแล้วเริ่มสแกน</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default ImportAssets;