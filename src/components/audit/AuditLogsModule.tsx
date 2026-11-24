import React, { useState, useEffect, useMemo } from 'react';
import {
  History,
  ShieldCheck,
  Search,
  User,
  RefreshCw,
  FileSpreadsheet,
  Printer,
  AlertTriangle,
} from 'lucide-react';
import { AuditLog, AuditLogCategory } from '../../types/index.ts';
import { api } from '../../lib/api.ts';
import { toPersianDigits } from '../../lib/formatters.ts';
import { getRoleLabel } from '../../lib/securityCalculations.ts';
import {
  exportReportToExcelXLS,
  downloadPrintablePdfDocument,
} from '../../lib/reportExports.ts';

export const AuditLogsModule: React.FC = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState<'all' | AuditLogCategory>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'success' | 'failed' | 'blocked'>('all');

  const loadLogs = async () => {
    try {
      setIsLoading(true);
      const data = await api.getAuditLogs();
      setLogs(data);
    } catch (err) {
      console.error('Failed to load audit logs:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, []);

  const getActionBadge = (action: AuditLog['action']) => {
    switch (action) {
      case 'create':
        return <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full">ایجاد جدید</span>;
      case 'update':
        return <span className="bg-blue-100 text-blue-800 text-[10px] font-bold px-2 py-0.5 rounded-full">ویرایش</span>;
      case 'delete':
      case 'cancel':
        return <span className="bg-rose-100 text-rose-800 text-[10px] font-bold px-2 py-0.5 rounded-full">ابطال / حذف</span>;
      case 'approve':
        return <span className="bg-indigo-100 text-indigo-800 text-[10px] font-bold px-2 py-0.5 rounded-full">ثبت نهایی</span>;
      case 'print':
        return <span className="bg-cyan-100 text-cyan-800 text-[10px] font-bold px-2 py-0.5 rounded-full">چاپ سند</span>;
      case 'export':
        return <span className="bg-teal-100 text-teal-800 text-[10px] font-bold px-2 py-0.5 rounded-full">خروجی فایل</span>;
      case 'login':
        return <span className="bg-amber-100 text-amber-800 text-[10px] font-bold px-2 py-0.5 rounded-full">ورود به سیستم</span>;
      case 'logout':
      case 'session_revoke':
        return <span className="bg-slate-200 text-slate-800 text-[10px] font-bold px-2 py-0.5 rounded-full">خروج / ابطال نشست</span>;
      case 'failed_login':
        return <span className="bg-orange-100 text-orange-800 text-[10px] font-bold px-2 py-0.5 rounded-full border border-orange-300">ورود ناموفق</span>;
      case 'unauthorized_access':
        return <span className="bg-rose-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">دسترسی غیرمجاز (403)</span>;
      case 'validation_failed':
        return <span className="bg-purple-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">تزریق مسدود (400)</span>;
      case 'permission_change':
      case 'sensitive_op':
        return <span className="bg-violet-100 text-violet-800 text-[10px] font-bold px-2 py-0.5 rounded-full">عملیات حساس</span>;
      default:
        return <span className="bg-slate-100 text-slate-700 text-[10px] font-bold px-2 py-0.5 rounded-full">{action}</span>;
    }
  };

  const filtered = useMemo(() => {
    return logs.filter((l) => {
      if (categoryFilter !== 'all' && l.category !== categoryFilter) return false;
      if (statusFilter !== 'all' && (l.status || 'success') !== statusFilter) return false;
      if (searchTerm.trim()) {
        const q = searchTerm.trim().toLowerCase();
        const match =
          l.description.toLowerCase().includes(q) ||
          l.userName.toLowerCase().includes(q) ||
          l.module.toLowerCase().includes(q) ||
          (l.endpoint && l.endpoint.toLowerCase().includes(q)) ||
          (l.ipAddress && l.ipAddress.includes(q));
        if (!match) return false;
      }
      return true;
    });
  }, [logs, categoryFilter, statusFilter, searchTerm]);

  const handleExportExcel = () => {
    exportReportToExcelXLS({
      filename: 'Audit-Trail-Report',
      reportTitle: 'گزارش جامع تاریخچه تغییرات، ورود و خروج و رویدادهای امنیتی',
      permissionModule: 'users_security',
      columns: [
        { key: 'timestamp', header: 'تاریخ و زمان' },
        { key: 'userName', header: 'کاربر مسئول' },
        { key: 'role', header: 'نقش' },
        { key: 'action', header: 'نوع عملیات' },
        { key: 'module', header: 'ماژول' },
        { key: 'status', header: 'وضعیت' },
        { key: 'ipAddress', header: 'IP' },
        { key: 'description', header: 'شرح کامل' },
      ],
      rows: filtered.map((l) => ({
        timestamp: l.timestamp,
        userName: l.userName,
        role: getRoleLabel(l.userRole || ''),
        action: l.action,
        module: l.module,
        status: l.status === 'blocked' ? 'مسدود (403/400)' : l.status === 'failed' ? 'ناموفق' : 'موفق',
        ipAddress: l.ipAddress || '127.0.0.1',
        description: l.description,
      })),
    });
  };

  const handlePrintPdf = () => {
    downloadPrintablePdfDocument({
      filename: 'Audit-Trail-Official',
      reportTitle: 'گزارش رسمی ممیزی عملیات، تاریخچه تغییرات و تلاش‌های ناموفق',
      permissionModule: 'users_security',
      columns: [
        { key: 'timestamp', header: 'زمان ثبت' },
        { key: 'userName', header: 'کاربر' },
        { key: 'action', header: 'عملیات' },
        { key: 'module', header: 'بخش' },
        { key: 'status', header: 'وضعیت' },
        { key: 'description', header: 'شرح رویداد' },
      ],
      rows: filtered.slice(0, 120).map((l) => ({
        timestamp: l.timestamp,
        userName: `${l.userName} (${getRoleLabel(l.userRole || '')})`,
        action: l.action,
        module: l.module,
        status: l.status === 'blocked' ? 'مسدود' : l.status === 'failed' ? 'ناموفق' : 'موفق',
        description: l.description,
      })),
    });
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <div className="flex items-center gap-2">
              <History className="w-5 h-5 text-indigo-600" />
              <h2 className="text-lg font-black text-slate-800 dark:text-slate-100">
                تاریخچه کامل تغییرات، ورود و خروج، عملیات حساس و تلاش‌های ناموفق (Audit Log)
              </h2>
              <span className="text-xs bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 px-2.5 py-0.5 rounded-full font-bold border border-indigo-100 dark:border-indigo-800">
                {toPersianDigits(filtered.length)} رویداد
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              ردیابی تغییرناپذیر کلیه رویدادهای مالی، تغییر داده‌ها (قبل/بعد)، ورود و خروج نشست‌ها، چاپ و خروجی و تلاش‌های غیرمجاز مسدودشده در Backend
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={loadLogs}
              className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 rounded-xl text-xs font-bold cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>بروزرسانی</span>
            </button>
            <button
              type="button"
              onClick={handleExportExcel}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold cursor-pointer"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>خروجی Excel</span>
            </button>
            <button
              type="button"
              onClick={handlePrintPdf}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>چاپ / PDF</span>
            </button>
          </div>
        </div>

        {/* فیلترهای دسته‌بندی و جستجو */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-1.5 flex-wrap text-xs font-bold">
            {[
              { id: 'all', label: 'همه دسته‌ها' },
              { id: 'change_history', label: 'تاریخچه تغییرات (ایجاد/ویرایش)' },
              { id: 'auth_session', label: 'ورود، خروج و نشست‌ها' },
              { id: 'sensitive_operation', label: 'عملیات حساس، قطعی‌سازی، چاپ و خروجی' },
              { id: 'failed_attempt', label: 'تلاش‌های ناموفق و غیرمجاز (401/403/400)' },
            ].map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setCategoryFilter(cat.id as any)}
                className={`px-3 py-1.5 rounded-xl transition cursor-pointer ${
                  categoryFilter === cat.id
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 w-full lg:w-auto">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold"
            >
              <option value="all">همه وضعیت‌ها</option>
              <option value="success">موفق (Success)</option>
              <option value="failed">ناموفق (Failed)</option>
              <option value="blocked">مسدود شده توسط گارد (Blocked)</option>
            </select>

            <div className="relative flex-1 lg:w-64">
              <Search className="w-4 h-4 text-slate-400 absolute right-3 top-2" />
              <input
                type="text"
                placeholder="جستجو در لاگ‌ها، کاربر، IP یا مسیر..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-3 pr-9 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Logs Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 border-b border-slate-200 dark:border-slate-700">
              <tr>
                <th className="py-3 px-4 font-bold">زمان ثبت و IP</th>
                <th className="py-3 px-4 font-bold">کاربر مسئول</th>
                <th className="py-3 px-4 font-bold">نوع عملیات</th>
                <th className="py-3 px-4 font-bold">بخش / مسیر وب‌سرویس</th>
                <th className="py-3 px-4 font-bold">شرح و مقادیر تغییریافته</th>
                <th className="py-3 px-4 font-bold text-center">وضعیت</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">
                    در حال بارگذاری رویدادهای امنیتی...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">
                    هیچ رویدادی مطابق فیلتر انتخابی یافت نشد.
                  </td>
                </tr>
              ) : (
                filtered.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition">
                    <td className="py-3 px-4 font-mono text-slate-500 whitespace-nowrap">
                      <div>{toPersianDigits(log.timestamp)}</div>
                      <div className="text-[10px] text-slate-400">IP: {log.ipAddress || '127.0.0.1'}</div>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <div className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-slate-400" />
                        <span>{log.userName}</span>
                      </div>
                      {log.userRole && (
                        <div className="text-[10px] text-slate-400 pr-5">{getRoleLabel(log.userRole)}</div>
                      )}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      {getActionBadge(log.action)}
                    </td>
                    <td className="py-3 px-4 font-medium text-slate-700 dark:text-slate-300 whitespace-nowrap">
                      <div>{log.module}</div>
                      {log.endpoint && (
                        <div className="text-[10px] font-mono text-slate-400">{log.endpoint}</div>
                      )}
                    </td>
                    <td className="py-3 px-4 text-slate-600 dark:text-slate-300 leading-relaxed">
                      <div>{log.description}</div>
                      {(log.beforeData || log.afterData) && (
                        <div className="mt-1 flex flex-wrap gap-1.5 text-[10px] font-mono">
                          {log.beforeData && (
                            <span className="bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 px-2 py-0.5 rounded border border-rose-200 dark:border-rose-800">
                              قبل: {JSON.stringify(log.beforeData)}
                            </span>
                          )}
                          {log.afterData && (
                            <span className="bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800">
                              بعد: {JSON.stringify(log.afterData)}
                            </span>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center whitespace-nowrap">
                      {log.status === 'blocked' ? (
                        <span className="inline-flex items-center gap-1 bg-rose-100 text-rose-800 text-[10px] font-bold px-2 py-0.5 rounded-full">
                          <AlertTriangle className="w-3 h-3" />
                          مسدود شده
                        </span>
                      ) : log.status === 'failed' ? (
                        <span className="bg-amber-100 text-amber-800 text-[10px] font-bold px-2 py-0.5 rounded-full">
                          ناموفق
                        </span>
                      ) : (
                        <span className="bg-emerald-50 text-emerald-700 text-[10px] font-bold px-2 py-0.5 rounded-full">
                          موفق
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
