import React, { useState } from 'react';
import {
  User as UserIcon,
  X,
  Shield,
  Key,
  CheckCircle2,
  UserCheck,
  AlertCircle,
  Lock,
  Eye,
  EyeOff,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.tsx';
import { api } from '../../lib/api.ts';
import { UserRole } from '../../types/index.ts';
import {
  PERMISSION_ACTIONS_META,
  PERMISSION_MODULES_META,
} from '../../lib/securityCalculations.ts';
import { toPersianDigits, getCurrentJalaliDatePersian } from '../../lib/formatters.ts';

interface UserProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const UserProfileModal: React.FC<UserProfileModalProps> = ({ isOpen, onClose }) => {
  const { currentUser, users, roleConfigs, confidential, switchUser, switchRole } = useAuth();
  const [activeTab, setActiveTab] = useState<'profile' | 'permissions' | 'switch'>('profile');
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [isSavingPass, setIsSavingPass] = useState(false);

  if (!isOpen || !currentUser) return null;

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 6) {
      setPasswordError('رمز عبور جدید باید حداقل ۶ کاراکتر و ترکیبی از حروف و اعداد باشد.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('رمز عبور جدید و تکرار آن یکسان نیستند.');
      return;
    }
    try {
      setIsSavingPass(true);
      setPasswordError('');
      const res = await api.changeUserPassword(currentUser.id, {
        oldPassword,
        newPassword,
      });
      setPasswordSuccess(res.message);
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setPasswordSuccess(''), 4000);
    } catch (err: any) {
      setPasswordError(err.message || 'خطا در تغییر کلمه عبور');
    } finally {
      setIsSavingPass(false);
    }
  };

  const roleTitles: Record<UserRole, { title: string; color: string; desc: string }> = {
    admin: {
      title: 'مدیر سیستم',
      color: 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border-rose-200 dark:border-rose-800',
      desc: 'دسترسی کامل به کلیه اسناد، گزارش‌های سود خالص، بهای تمام‌شده، سال مالی و تنظیمات امنیتی.',
    },
    accountant: {
      title: 'حسابدار',
      color: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800',
      desc: 'مدیریت اسناد حسابداری، دفاتر مالی، صورت سود و زیان، ترازنامه، خزانه‌داری و سال مالی.',
    },
    cashier: {
      title: 'صندوق‌دار / شاگرد',
      color: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
      desc: 'صدور فاکتور فروش، دریافت وجه و چاپ فاکتور مشتری؛ قیمت خرید، بهای تمام‌شده و سود خالص مخفی است.',
    },
    inventory_clerk: {
      title: 'انباردار',
      color: 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200 dark:border-amber-800',
      desc: 'مدیریت کاتالوگ کالا، رسید و حواله انبار، انتقال بین انبارها، انبارگردانی و کاردکس کالا.',
    },
  };

  const currentRoleInfo = roleTitles[currentUser.role] || {
    title: currentUser.role,
    color: 'bg-slate-100 text-slate-800 border-slate-200',
    desc: 'کاربر سیستم',
  };

  const activeRoleMatrix = roleConfigs.find((r) => r.role === currentUser.role);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-900">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-indigo-600 text-white flex items-center justify-center text-base font-black">
              {currentUser.fullName ? currentUser.fullName[0] : 'ک'}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-slate-800 dark:text-slate-100 text-sm">
                  {currentUser.fullName}
                </h3>
                <span className={`text-[11px] px-2.5 py-0.5 rounded-md font-bold border ${currentRoleInfo.color}`}>
                  {currentRoleInfo.title}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                نام کاربری: <span className="font-bold text-slate-700 dark:text-slate-300">{currentUser.username}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/80 px-4 text-xs font-bold">
          <button
            onClick={() => setActiveTab('profile')}
            className={`py-2.5 px-3 border-b-2 transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'profile'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            <UserIcon className="w-4 h-4" />
            <span>پروفایل و دسترسی محرمانه</span>
          </button>

          <button
            onClick={() => setActiveTab('switch')}
            className={`py-2.5 px-3 border-b-2 transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'switch'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            <UserCheck className="w-4 h-4" />
            <span>تغییر نقش کاربری</span>
          </button>

          <button
            onClick={() => setActiveTab('permissions')}
            className={`py-2.5 px-3 border-b-2 transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'permissions'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            <Shield className="w-4 h-4" />
            <span>جدول مجوزهای نقش</span>
          </button>
        </div>

        <div className="p-5 space-y-4 max-h-[68vh] overflow-y-auto">
          {activeTab === 'profile' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs bg-slate-50 dark:bg-slate-800/50 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800">
                <div>
                  <span className="text-slate-400 block mb-0.5">وضعیت حساب:</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    فعال
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block mb-0.5">سقف تخفیف مجاز:</span>
                  <span className="font-bold text-indigo-600 dark:text-indigo-400">
                    {toPersianDigits(confidential.maxAllowedDiscountPercent)}٪
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block mb-0.5">تاریخ سامانه:</span>
                  <span className="font-bold text-slate-700 dark:text-slate-200">{getCurrentJalaliDatePersian()}</span>
                </div>
                <div>
                  <span className="text-slate-400 block mb-0.5">مشاهده قیمت خرید:</span>
                  <span
                    className={`font-bold flex items-center gap-1 ${
                      confidential.canViewPurchasePrice
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-rose-600 dark:text-rose-400'
                    }`}
                  >
                    {confidential.canViewPurchasePrice ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                    {confidential.canViewPurchasePrice ? 'مجاز' : 'مخفی (محرمانه)'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block mb-0.5">مشاهده سود خالص:</span>
                  <span
                    className={`font-bold flex items-center gap-1 ${
                      confidential.canViewProfitMargins
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-rose-600 dark:text-rose-400'
                    }`}
                  >
                    {confidential.canViewProfitMargins ? <Eye className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
                    {confidential.canViewProfitMargins ? 'مجاز' : 'مخفی (محرمانه)'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block mb-0.5">اطلاعات بانکی و امنیتی:</span>
                  <span className="font-bold text-slate-700 dark:text-slate-200">
                    {confidential.canViewBankSecrets ? 'کامل' : 'محدود'}
                  </span>
                </div>
              </div>

              <form onSubmit={handlePasswordChange} className="border-t border-slate-200 dark:border-slate-800 pt-4 space-y-3">
                <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <Key className="w-4 h-4 text-indigo-500" />
                  <span>تغییر رمز عبور حساب کاربری</span>
                </h4>

                {passwordSuccess && (
                  <div className="text-xs bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 p-2.5 rounded-lg border border-emerald-200 dark:border-emerald-800 font-bold">
                    {passwordSuccess}
                  </div>
                )}

                {passwordError && (
                  <div className="text-xs bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 p-2.5 rounded-lg border border-rose-200 dark:border-rose-800 font-bold flex items-center gap-1.5">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{passwordError}</span>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                      رمز عبور فعلی
                    </label>
                    <input
                      type="password"
                      value={oldPassword}
                      onChange={(e) => setOldPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                      رمز عبور جدید
                    </label>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="حداقل ۶ کاراکتر"
                      className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                      تکرار رمز جدید
                    </label>
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="تکرار رمز"
                      className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs"
                    />
                  </div>
                </div>

                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={isSavingPass}
                    className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition cursor-pointer"
                  >
                    {isSavingPass ? 'در حال ثبت...' : 'ذخیره رمز جدید'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {activeTab === 'switch' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {(['admin', 'accountant', 'cashier', 'inventory_clerk'] as UserRole[]).map((r) => {
                  const info = roleTitles[r];
                  const isActiveRole = currentUser.role === r;
                  return (
                    <button
                      key={r}
                      onClick={() => switchRole(r)}
                      className={`p-2.5 rounded-xl border text-right transition cursor-pointer ${
                        isActiveRole
                          ? 'bg-indigo-50 dark:bg-indigo-950/60 border-indigo-500 text-indigo-700 dark:text-indigo-300 font-black'
                          : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-indigo-300 font-bold'
                      }`}
                    >
                      <div className="text-xs">{info.title}</div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                        {isActiveRole ? 'نقش فعال' : 'سوییچ سریع'}
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="space-y-2">
                {users.map((u) => {
                  const roleObj = roleTitles[u.role] || { title: u.role, color: 'border-slate-200', desc: '' };
                  const isCurrent = u.id === currentUser.id;
                  return (
                    <div
                      key={u.id}
                      onClick={() => switchUser(u.id)}
                      className={`p-3 rounded-xl border transition cursor-pointer flex items-center justify-between ${
                        isCurrent
                          ? 'bg-indigo-50 dark:bg-indigo-950/50 border-indigo-400 dark:border-indigo-700'
                          : 'bg-white dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 hover:border-indigo-300'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 flex items-center justify-center font-bold text-sm">
                          {u.fullName[0]}
                        </div>
                        <div>
                          <div className="text-xs font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                            <span>{u.fullName}</span>
                            {isCurrent && (
                              <span className="text-[10px] bg-indigo-600 text-white px-2 py-0.5 rounded-md font-bold">
                                فعال
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                            {roleObj.desc}
                          </div>
                        </div>
                      </div>

                      <span className={`text-[11px] px-2.5 py-0.5 rounded-md font-bold border shrink-0 ${roleObj.color}`}>
                        {roleObj.title}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {activeTab === 'permissions' && activeRoleMatrix && (
            <div className="space-y-3">
              <div className="p-3 bg-indigo-50/50 dark:bg-indigo-950/30 rounded-xl border border-indigo-100 dark:border-indigo-900/50 text-xs">
                <p className="font-bold text-indigo-900 dark:text-indigo-300">
                  مجوزهای نقش «{activeRoleMatrix.title}»:
                </p>
                <p className="text-slate-600 dark:text-slate-400 mt-0.5 leading-relaxed">
                  {activeRoleMatrix.description}
                </p>
              </div>

              <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-xl">
                <table className="w-full text-right text-[11px]">
                  <thead className="bg-slate-50 dark:bg-slate-800 font-bold text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700">
                    <tr>
                      <th className="py-2 px-3">بخش</th>
                      {PERMISSION_ACTIONS_META.map((a) => (
                        <th key={a.action} className="py-2 px-1.5 text-center">
                          {a.shortLabel}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {PERMISSION_MODULES_META.map((m) => {
                      const mp = activeRoleMatrix.modules[m.module];
                      return (
                        <tr key={m.module}>
                          <td className="py-2 px-3 font-bold text-slate-700 dark:text-slate-200">
                            {m.label}
                          </td>
                          {PERMISSION_ACTIONS_META.map((a) => (
                            <td key={a.action} className="py-2 px-1.5 text-center">
                              {mp?.[a.action] ? (
                                <span className="text-emerald-600 dark:text-emerald-400 font-bold">✓</span>
                              ) : (
                                <span className="text-rose-400">✕</span>
                              )}
                            </td>
                          ))}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        <div className="p-3.5 bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex justify-end items-center text-xs">
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg font-bold transition cursor-pointer"
          >
            بستن
          </button>
        </div>
      </div>
    </div>
  );
};
