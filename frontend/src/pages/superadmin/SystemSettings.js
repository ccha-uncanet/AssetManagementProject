import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import {
  Database, CheckCircle2, XCircle, Loader2, Eye, EyeOff,
  Save, Wifi, AlertTriangle, RefreshCw,
} from 'lucide-react';

const inputCls = 'w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white disabled:opacity-50 disabled:bg-gray-50';

const SystemSettings = () => {
  const [form, setForm]           = useState({ server: '', port: '1433', instance: '', database: '', user: '', password: '' });
  const [showPass, setShowPass]   = useState(false);
  const [hasPassword, setHasPassword] = useState(false);
  const [loading, setLoading]     = useState(true);
  const [testing, setTesting]     = useState(false);
  const [saving, setSaving]       = useState(false);
  const [testResult, setTestResult] = useState(null); // null | 'ok' | 'error'
  const [testMsg, setTestMsg]     = useState('');
  const [toast, setToast]         = useState(null);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const res = await api.get('/superadmin/settings/db');
      const d = res.data;
      setForm({ server: d.server, port: d.port, instance: d.instance, database: d.database, user: d.user, password: '' });
      setHasPassword(d.hasPassword);
    } catch (err) {
      showToast('โหลดการตั้งค่าไม่สำเร็จ', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchSettings(); }, []);

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const payload = { ...form };
      // If password field is empty and server already has one, signal to use existing
      if (!payload.password && hasPassword) payload.password = '__KEEP__';
      const res = await api.post('/superadmin/settings/db/test', payload);
      setTestResult(res.data.ok ? 'ok' : 'error');
      setTestMsg(res.data.message);
    } catch (err) {
      setTestResult('error');
      setTestMsg(err.response?.data?.error || err.message);
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = { ...form, keepPassword: !form.password && hasPassword };
      await api.put('/superadmin/settings/db', payload);
      showToast('บันทึกและเชื่อมต่อใหม่สำเร็จ');
      setForm(p => ({ ...p, password: '' }));
      fetchSettings();
    } catch (err) {
      showToast(err.response?.data?.error || 'บันทึกไม่สำเร็จ', 'error');
    } finally {
      setSaving(false);
    }
  };

  const set = (k, v) => { setForm(p => ({ ...p, [k]: v })); setTestResult(null); };

  const FIELDS = [
    { key: 'server',   label: 'Server / IP Address', placeholder: '192.168.1.200', required: true, colSpan: 2 },
    { key: 'port',     label: 'Port',                placeholder: '1433',           required: true, colSpan: 1 },
    { key: 'instance', label: 'Instance (ถ้ามี)',    placeholder: 'SQLEXPRESS',     required: false, colSpan: 1 },
    { key: 'database', label: 'Database Name',       placeholder: 'AssetManagerWeb',required: true, colSpan: 2 },
    { key: 'user',     label: 'Username',            placeholder: 'sa',             required: true, colSpan: 1 },
  ];

  return (
    <div className="max-w-2xl mx-auto space-y-5 px-6 py-2">

      {/* Toast */}
      {toast && (
        <div className={`fixed top-5 right-5 z-50 flex items-center gap-3 px-5 py-3 rounded-xl shadow-lg text-sm font-medium
          ${toast.type === 'error' ? 'bg-red-600 text-white' : 'bg-gray-900 text-white'}`}>
          {toast.type === 'error' ? <AlertTriangle size={16}/> : <CheckCircle2 size={16}/>}
          {toast.message}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">ตั้งค่าระบบ</h1>
          <p className="text-sm text-gray-500 mt-0.5">กำหนดการเชื่อมต่อฐานข้อมูล SQL Server</p>
        </div>
        <button onClick={fetchSettings} disabled={loading}
          className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50">
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Card */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {/* Card header */}
        <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-100 bg-gray-50">
          <div className="w-9 h-9 bg-blue-100 rounded-xl flex items-center justify-center">
            <Database size={18} className="text-blue-600"/>
          </div>
          <div>
            <p className="font-semibold text-gray-800 text-sm">SQL Server Connection</p>
            <p className="text-xs text-gray-500">การตั้งค่าจะถูกบันทึกใน .env และมีผลทันทีโดยไม่ต้องรีสตาร์ท</p>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={24} className="animate-spin text-blue-500"/>
          </div>
        ) : (
          <div className="p-6 space-y-5">
            {/* Fields */}
            <div className="grid grid-cols-2 gap-4">
              {FIELDS.map(f => (
                <div key={f.key} className={f.colSpan === 2 ? 'col-span-2' : ''}>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">
                    {f.label}{f.required && <span className="text-red-400 ml-0.5">*</span>}
                  </label>
                  <input
                    type="text"
                    placeholder={f.placeholder}
                    value={form[f.key]}
                    onChange={e => set(f.key, e.target.value)}
                    className={inputCls}
                  />
                </div>
              ))}

              {/* Password field */}
              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-600 mb-1.5">
                  Password{hasPassword && <span className="ml-2 text-gray-400 font-normal">(เว้นว่างเพื่อใช้รหัสผ่านเดิม)</span>}
                </label>
                <div className="relative">
                  <input
                    type={showPass ? 'text' : 'password'}
                    placeholder={hasPassword ? '••••••  (ไม่เปลี่ยน)' : 'รหัสผ่าน'}
                    value={form.password}
                    onChange={e => set('password', e.target.value)}
                    className={`${inputCls} pr-10`}
                  />
                  <button type="button" onClick={() => setShowPass(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    {showPass ? <EyeOff size={15}/> : <Eye size={15}/>}
                  </button>
                </div>
              </div>
            </div>

            {/* Test result */}
            {testResult && (
              <div className={`flex items-start gap-3 px-4 py-3 rounded-xl text-sm border
                ${testResult === 'ok'
                  ? 'bg-green-50 border-green-200 text-green-800'
                  : 'bg-red-50 border-red-200 text-red-800'}`}>
                {testResult === 'ok'
                  ? <CheckCircle2 size={16} className="text-green-600 flex-shrink-0 mt-0.5"/>
                  : <XCircle size={16} className="text-red-500 flex-shrink-0 mt-0.5"/>}
                <span className="font-mono text-xs break-all">{testMsg}</span>
              </div>
            )}

            {/* Action buttons */}
            <div className="flex gap-3 pt-1">
              <button onClick={handleTest} disabled={testing || saving}
                className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-violet-700 bg-violet-50 border border-violet-200 rounded-xl hover:bg-violet-100 disabled:opacity-50 transition-colors">
                {testing ? <Loader2 size={14} className="animate-spin"/> : <Wifi size={14}/>}
                ทดสอบการเชื่อมต่อ
              </button>
              <button onClick={handleSave} disabled={saving || testing}
                className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-blue-600 rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-colors">
                {saving ? <Loader2 size={14} className="animate-spin"/> : <Save size={14}/>}
                บันทึกและเชื่อมต่อใหม่
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Warning note */}
      <div className="flex items-start gap-3 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
        <AlertTriangle size={15} className="flex-shrink-0 mt-0.5 text-amber-500"/>
        <p>การบันทึกจะตัดการเชื่อมต่อปัจจุบันและเชื่อมต่อใหม่ทันที — ทดสอบก่อนบันทึกเสมอเพื่อป้องกันระบบหยุดทำงาน</p>
      </div>
    </div>
  );
};

export default SystemSettings;
