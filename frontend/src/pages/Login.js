import React, { useState } from 'react';
import { useNavigate, useLocation, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { authAPI } from '../services/api';
import { Eye, EyeOff, Package, AlertCircle, Loader2 } from 'lucide-react';

const Login = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { login, isAuthenticated, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // รอ AuthContext โหลดจาก localStorage ก่อน
  if (authLoading) return null;

  // ถ้า login แล้ว redirect ออกทันที (ใช้ Navigate แทน useEffect)
  if (isAuthenticated) {
    return <Navigate to="/app/dashboard" replace />;
  }

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await authAPI.login({ username, password });

      // เรียก login() จาก AuthContext — จัดการ localStorage ให้หมด
      login(res.data);

      // redirect ไปหน้าที่พยายามเข้าก่อนหน้า หรือ dashboard
      const from = location.state?.from?.pathname || '/app/dashboard';
      navigate(from, { replace: true });

    } catch (err) {
      const message = err.response?.data?.message || 'เข้าสู่ระบบไม่สำเร็จ กรุณาลองใหม่อีกครั้ง';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-xl shadow-slate-200/60 border border-slate-100 overflow-hidden">

          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-8 py-8 text-center">
            <div className="w-14 h-14 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Package size={28} className="text-white" />
            </div>
            <h1 className="text-xl font-bold text-white tracking-tight">Asset Management</h1>
            <p className="text-blue-200 text-sm mt-1">ระบบจัดการและตรวจนับทรัพย์สิน</p>
          </div>

          {/* Form */}
          <div className="px-8 py-8">
            <h2 className="text-lg font-semibold text-slate-800 mb-6">เข้าสู่ระบบ</h2>

            {/* Error Alert */}
            {error && (
              <div className="flex items-start gap-3 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 mb-5 text-sm">
                <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-5">

              {/* Username */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  ชื่อผู้ใช้งาน
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => {
                    setUsername(e.target.value);
                    if (error) setError('');
                  }}
                  placeholder="กรอกชื่อผู้ใช้งาน"
                  required
                  autoComplete="username"
                  autoFocus
                  className="
                    w-full px-4 py-2.5 rounded-xl border border-slate-200
                    text-slate-800 placeholder-slate-400 text-sm
                    focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                    transition-all duration-150
                    disabled:opacity-50 disabled:bg-slate-50
                  "
                  disabled={loading}
                />
              </div>

              {/* Password */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  รหัสผ่าน
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (error) setError('');
                    }}
                    placeholder="กรอกรหัสผ่าน"
                    required
                    autoComplete="current-password"
                    className="
                      w-full px-4 py-2.5 pr-11 rounded-xl border border-slate-200
                      text-slate-800 placeholder-slate-400 text-sm
                      focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                      transition-all duration-150
                      disabled:opacity-50 disabled:bg-slate-50
                    "
                    disabled={loading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={loading || !username || !password}
                className="
                  w-full py-2.5 px-4 rounded-xl font-semibold text-sm
                  bg-blue-600 hover:bg-blue-700 active:bg-blue-800
                  text-white transition-all duration-150
                  disabled:opacity-50 disabled:cursor-not-allowed
                  flex items-center justify-center gap-2
                  shadow-sm shadow-blue-200
                "
              >
                {loading ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    กำลังเข้าสู่ระบบ...
                  </>
                ) : (
                  'เข้าสู่ระบบ'
                )}
              </button>
            </form>

            {/* Footer */}
            <p className="text-center text-sm text-slate-500 mt-6">
              ลืมรหัสผ่าน?{' '}
              <span className="text-blue-600 hover:underline cursor-pointer">
                ติดต่อผู้ดูแลระบบ
              </span>
            </p>
          </div>
        </div>

        {/* Bottom note */}
        <p className="text-center text-xs text-slate-400 mt-5">
          © {new Date().getFullYear()} Asset Management System
        </p>
      </div>
    </div>
  );
};

export default Login;