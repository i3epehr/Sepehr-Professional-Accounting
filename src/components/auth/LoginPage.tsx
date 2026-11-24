import React, { useState } from 'react';
import {
  Store,
  Shield,
  KeyRound,
  User,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  Sparkles,
  Lock,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.tsx';
import { useSettings } from '../../context/SettingsContext.tsx';
import { toPersianDigits } from '../../lib/formatters.ts';

interface LoginPageProps {
  onLoginSuccess?: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess }) => {
  const { users, loginWithCredentials, loginAsUser, switchRole } = useAuth();
  const { settings } = useSettings();

  const [username, setUsername] = useState<string>('admin');
  const [password, setPassword] = useState<string>('Admin123');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleStandardLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) {
      setErrorMsg('لطفاً نام کاربری را وارد نمایید.');
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMsg(null);
      await loginWithCredentials(username.trim(), password);
      if (onLoginSuccess) onLoginSuccess();
    } catch (err: any) {
      setErrorMsg(err.message || 'نام کاربری یا کلمه عبور وارد شده صحیح نمی‌باشد.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleQuickUserSelect = async (userId: string) => {
    try {
      setIsSubmitting(true);
      setErrorMsg(null);
      await loginAsUser(userId);
      if (onLoginSuccess) onLoginSuccess();
    } catch (err: any) {
      setErrorMsg(err.message || 'خطا در ورود به حساب کاربری انتخاب شده.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'admin':
        return { label: 'مدیر سیستم', color: 'bg-rose-500/10 text-rose-400 border-rose-500/20' };
      case 'accountant':
        return { label: 'حسابدار ارشد', color: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' };
      case 'cashier':
        return { label: 'صندوق‌دار / شاگرد', color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' };
      case 'inventory_clerk':
        return { label: 'مسئول انبار', color: 'bg-amber-500/10 text-amber-400 border-amber-500/20' };
      default:
        return { label: 'کاربر سیستم', color: 'bg-slate-500/10 text-slate-400 border-slate-500/20' };
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 sm:p-6 text-slate-100 font-sans relative overflow-hidden" dir="rtl">
      {/* Background Ambient Glow */}
      <div className="absolute top-1/4 -right-20 w-96 h-96 bg-indigo-600/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 -left-20 w-96 h-96 bg-teal-600/15 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md space-y-6 relative z-10">
        {/* Branding & Logo */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-tr from-indigo-600 to-indigo-500 text-white shadow-xl shadow-indigo-600/30 border border-indigo-400/30 mb-2">
            <Store className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              {settings.storeName || 'سامانه حسابداری سپهر'}
            </h1>
            <p className="text-xs text-indigo-300 font-bold mt-1">
              {settings.guildName || 'سامانه جامع مالی، حسابداری و انبارداری بازرگانی'}
            </p>
          </div>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            سامانه جامع حسابداری دوطرفه، مدیریت انبار، خزانه‌داری و صدور فاکتور
          </p>
        </div>

        {/* Login Card */}
        <div className="bg-slate-900/90 backdrop-blur-xl border border-slate-800 rounded-3xl p-6 sm:p-7 shadow-2xl space-y-5">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
            <div className="flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-indigo-400" />
              <h2 className="text-sm font-black text-white">ورود به پنل کاربری</h2>
            </div>
            <span className="text-[11px] font-bold text-slate-400 bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700/60">
              سال مالی {toPersianDigits(settings.activeFiscalYear || '۱۴۰۳')}
            </span>
          </div>

          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs font-bold flex items-start gap-2.5 animate-in fade-in">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Standard Form */}
          <form onSubmit={handleStandardLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">
                نام کاربری یا شناسه پرسنلی
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="مثال: admin"
                  className="w-full pr-10 pl-3 py-2.5 bg-slate-950/70 border border-slate-700/80 rounded-xl text-xs font-bold text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition"
                  required
                />
                <User className="w-4 h-4 text-slate-400 absolute right-3 top-3" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">
                رمز عبور / پین ورود
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pr-10 pl-10 py-2.5 bg-slate-950/70 border border-slate-700/80 rounded-xl text-xs font-bold text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition"
                />
                <Lock className="w-4 h-4 text-slate-400 absolute right-3 top-3" />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute left-3 top-3 text-slate-400 hover:text-slate-200 cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs transition cursor-pointer shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isSubmitting ? (
                <span>در حال ورود و اعتبارسنجی...</span>
              ) : (
                <>
                  <span>ورود به سامانه</span>
                  <ArrowLeft className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Quick Access Account Selector */}
          <div className="pt-3 border-t border-slate-800/80 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-400">ورود سریع با نقش‌های کاربری:</span>
              <span className="text-[10px] text-indigo-400 font-bold flex items-center gap-1">
                <Sparkles className="w-3 h-3" />
                یک کلیک
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {users.slice(0, 4).map((u) => {
                const roleBadge = getRoleBadge(u.role);
                return (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => handleQuickUserSelect(u.id)}
                    className="p-2.5 rounded-xl bg-slate-950/60 hover:bg-slate-800/80 border border-slate-800 text-right transition cursor-pointer group flex flex-col justify-between"
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-md bg-indigo-600/30 text-indigo-300 font-black text-xs flex items-center justify-center shrink-0">
                        {u.fullName[0] || 'ک'}
                      </div>
                      <span className="text-[11px] font-black text-slate-200 truncate group-hover:text-white">
                        {u.fullName}
                      </span>
                    </div>
                    <span className={`mt-2 text-[10px] px-2 py-0.5 rounded-md border font-bold self-start ${roleBadge.color}`}>
                      {roleBadge.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Security Footer Notice */}
        <div className="flex items-center justify-center gap-2 text-slate-500 text-[11px]">
          <Shield className="w-3.5 h-3.5 text-emerald-500" />
          <span>پروتکل امنیتی نشست‌های داخلی فعال است — داده‌ها به صورت اتمیک نگهداری می‌شوند</span>
        </div>
      </div>
    </div>
  );
};
