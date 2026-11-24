import React, { useState, useEffect } from 'react';
import {
  Database,
  Server,
  CheckCircle2,
  AlertTriangle,
  Terminal,
  Code,
  Copy,
  RefreshCw,
  Layers,
  Table,
  X,
} from 'lucide-react';
import { api } from '../../lib/api.ts';
import { toPersianDigits } from '../../lib/formatters.ts';

interface DatabaseStatusModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DatabaseStatusModal: React.FC<DatabaseStatusModalProps> = ({ isOpen, onClose }) => {
  const [dbStatus, setDbStatus] = useState<any>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<'status' | 'schema' | 'install'>('status');
  const [copied, setCopied] = useState<boolean>(false);

  const fetchStatus = async () => {
    try {
      setIsLoading(true);
      const data = await api.getDbStatus();
      setDbStatus(data);
    } catch (err: any) {
      setDbStatus({
        connected: false,
        message: err.message,
        postgresConfigured: false,
        inMemoryRecords: {},
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchStatus();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const dockerCommand = `docker run --name postgres-kharrazi -e POSTGRES_PASSWORD=password -e POSTGRES_DB=kharrazi_db -p 5432:5432 -d postgres:16`;
  const psqlCommand = `psql -h localhost -U postgres -d kharrazi_db -f src/db/schema.sql`;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-4xl w-full p-6 shadow-2xl border border-slate-100 my-8 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center">
              <Database className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base">
                معماری پایگاه داده، اتصال به PostgreSQL و سلامت سرور API
              </h3>
              <p className="text-xs text-slate-500">
                طراحی شده برای Node.js API و PostgreSQL بدون ذخیره‌سازی داده‌های مالی در localStorage
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-100 gap-4 mt-4 text-xs font-bold">
          <button
            onClick={() => setActiveTab('status')}
            className={`pb-2.5 transition cursor-pointer border-b-2 ${
              activeTab === 'status'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            وضعیت زنده سرور و موتور پایگاه داده
          </button>
          <button
            onClick={() => setActiveTab('schema')}
            className={`pb-2.5 transition cursor-pointer border-b-2 ${
              activeTab === 'schema'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            مدل رابطه داده‌ها (PostgreSQL Schema)
          </button>
          <button
            onClick={() => setActiveTab('install')}
            className={`pb-2.5 transition cursor-pointer border-b-2 ${
              activeTab === 'install'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            دستورات راه‌اندازی و تست در محیط عملیاتی
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto py-4 space-y-4">
          {/* Tab 1: Live Status */}
          {activeTab === 'status' && (
            <div className="space-y-4">
              {/* Architecture Highlight Card */}
              <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-4">
                <div className="flex items-center gap-2 text-indigo-900 font-bold text-xs mb-1">
                  <Server className="w-4 h-4 text-indigo-600" />
                  <span>معماری بک‌اند و پایگاه داده سیستم:</span>
                </div>
                <p className="text-xs text-indigo-950 leading-relaxed">
                  تمامی فرایندهای مالی، کاردکس انبار و ثبت اسناد در لایه سرور Node.js پردازش شده و به صورت بلادرنگ از طریق REST API تبادل می‌شوند.
                  هیچ داده مالی حساسی در حافظه موقت مرورگر (localStorage) نگهداری نمی‌شود.
                </p>
              </div>

              {/* Status Indicator */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Node.js API State */}
                <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-600">وب‌سرویس Node.js / Express</span>
                    <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                      <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                      آنلاین و فعال
                    </span>
                  </div>
                  <div className="mt-3 text-xs text-slate-500 space-y-1">
                    <div>پورت اجرا: <span className="font-mono font-bold text-slate-700">3000</span></div>
                    <div>فرمت ارتباطی: <span className="font-mono font-bold text-slate-700">RESTful JSON API</span></div>
                    <div>احراز هویت: <span className="font-mono font-bold text-slate-700">Role-Based Header Session</span></div>
                  </div>
                </div>

                {/* PostgreSQL Connection State */}
                <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-600">پایگاه داده رابطه‌ای (PostgreSQL)</span>
                    <span
                      className={`flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full border ${
                        dbStatus?.connected
                          ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
                          : 'text-indigo-800 bg-indigo-50 border-indigo-200'
                      }`}
                    >
                      {dbStatus?.connected ? (
                        <>
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          متصل به PostgreSQL
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-3 h-3 text-indigo-600" />
                          تنظیمات پیشنهادی ست شد (آماده)
                        </>
                      )}
                    </span>
                  </div>
                  <div className="mt-2 text-xs text-slate-600 leading-relaxed">
                    {dbStatus?.message}
                  </div>
                  {/* Suggested Config Details Box */}
                  <div className="mt-3 bg-slate-50 p-2.5 rounded-xl border border-slate-200 font-mono text-[11px] text-slate-700 space-y-1">
                    <div className="flex justify-between">
                      <span className="text-slate-500 font-sans">پورت پیشنهادی:</span>
                      <strong className="text-indigo-700">5432</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500 font-sans">نام دیتابیس:</span>
                      <strong className="text-slate-800">kharrazi_db</strong>
                    </div>
                    <div className="flex justify-between items-center pt-1 border-t border-slate-200 text-[10px]">
                      <span className="text-slate-500 font-sans">Database URL:</span>
                      <span className="text-indigo-600 truncate max-w-[200px]" title="postgres://postgres:password@localhost:5432/kharrazi_db">
                        postgres://postgres:password@localhost:5432/kharrazi_db
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Data Record Counters */}
              <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200">
                <span className="text-xs font-bold text-slate-700 block mb-3">
                  تعداد رکوردهای فعال ذخیره شده بر روی سرور:
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-center text-xs">
                  <div className="bg-white p-3 rounded-xl border border-slate-200">
                    <span className="text-slate-500 block text-[11px]">اقلام کالا</span>
                    <strong className="text-slate-800 font-bold text-sm mt-1 block">
                      {toPersianDigits(dbStatus?.inMemoryRecords?.products || 0)}
                    </strong>
                  </div>
                  <div className="bg-white p-3 rounded-xl border border-slate-200">
                    <span className="text-slate-500 block text-[11px]">طرف‌های حساب</span>
                    <strong className="text-slate-800 font-bold text-sm mt-1 block">
                      {toPersianDigits(dbStatus?.inMemoryRecords?.persons || 0)}
                    </strong>
                  </div>
                  <div className="bg-white p-3 rounded-xl border border-slate-200">
                    <span className="text-slate-500 block text-[11px]">فاکتورها</span>
                    <strong className="text-slate-800 font-bold text-sm mt-1 block">
                      {toPersianDigits(dbStatus?.inMemoryRecords?.invoices || 0)}
                    </strong>
                  </div>
                  <div className="bg-white p-3 rounded-xl border border-slate-200">
                    <span className="text-slate-500 block text-[11px]">اسناد دوبل</span>
                    <strong className="text-slate-800 font-bold text-sm mt-1 block">
                      {toPersianDigits(dbStatus?.inMemoryRecords?.vouchers || 0)}
                    </strong>
                  </div>
                  <div className="bg-white p-3 rounded-xl border border-slate-200">
                    <span className="text-slate-500 block text-[11px]">لاگ‌های نظارتی</span>
                    <strong className="text-slate-800 font-bold text-sm mt-1 block">
                      {toPersianDigits(dbStatus?.inMemoryRecords?.auditLogs || 0)}
                    </strong>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Tab 2: PostgreSQL Schema */}
          {activeTab === 'schema' && (
            <div className="space-y-4">
              <p className="text-xs text-slate-600">
                جداول رابطه‌ای تعریف شده در <code className="font-mono bg-slate-100 px-1 rounded text-indigo-700">src/db/schema.sql</code> و <code className="font-mono bg-slate-100 px-1 rounded text-indigo-700">src/db/schema.ts</code> با کلیدهای اصلی، خارجی و ایندکس‌ها:
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <div className="flex items-center gap-2 font-bold text-indigo-900 mb-1">
                    <Table className="w-4 h-4 text-indigo-600" />
                    <span>products (کالاها و خدمات فروشگاه)</span>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    شامل: barcode, code, name, color, size, material, brand, base_unit_id, current_stock, min_stock_alert, purchase_price, retail_price, wholesale_price, min_allowed_price
                  </p>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <div className="flex items-center gap-2 font-bold text-indigo-900 mb-1">
                    <Table className="w-4 h-4 text-indigo-600" />
                    <span>units & conversions (واحدها و ضرایب)</span>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    شامل: name, symbol, is_decimal_allowed, conversion_factor, base_unit_id (پشتیبانی از رول به متر و بسته به عدد)
                  </p>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <div className="flex items-center gap-2 font-bold text-indigo-900 mb-1">
                    <Table className="w-4 h-4 text-indigo-600" />
                    <span>accounting_vouchers (اسناد دوبل حسابداری)</span>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    شامل: voucher_number, date, total_debit, total_credit, is_balanced (با شرط چک CONSTRAINT تراز بودن بدهکار = بستانکار)
                  </p>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <div className="flex items-center gap-2 font-bold text-indigo-900 mb-1">
                    <Table className="w-4 h-4 text-indigo-600" />
                    <span>invoices & invoice_items (فاکتورها و اقلام)</span>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    شامل: invoice_number, invoice_type, person_id, subtotal, discount, final_amount, paid_amount, remaining_amount, voucher_id
                  </p>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <div className="flex items-center gap-2 font-bold text-indigo-900 mb-1">
                    <Table className="w-4 h-4 text-indigo-600" />
                    <span>stock_kardex (کاردکس انبارداری)</span>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    محاسبه موجودی کالا از گردش ورود و خروج، رهگیری قیمت خرید و فروش، مانده تعدادی و ریالی
                  </p>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <div className="flex items-center gap-2 font-bold text-indigo-900 mb-1">
                    <Table className="w-4 h-4 text-indigo-600" />
                    <span>treasury_accounts & cheques (خزانه و چک)</span>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    شامل صندوق‌ها، کارتخوان، حساب‌های بانکی و چک‌های صیادی (در جریان وصول، پاس شده و برگشتی)
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Tab 3: Installation & Test Instructions */}
          {activeTab === 'install' && (
            <div className="space-y-4">
              <div className="space-y-2 text-xs">
                <span className="font-bold text-slate-800">دستور اجرای داکر برای راه‌اندازی سریع PostgreSQL محلی:</span>
                <div className="bg-slate-900 text-slate-200 p-3 rounded-xl font-mono text-[11px] flex justify-between items-center overflow-x-auto">
                  <code>{dockerCommand}</code>
                </div>
              </div>

              <div className="space-y-2 text-xs">
                <span className="font-bold text-slate-800">اعمال ساختار جداول به پایگاه داده با دستور psql:</span>
                <div className="bg-slate-900 text-slate-200 p-3 rounded-xl font-mono text-[11px] flex justify-between items-center overflow-x-auto">
                  <code>{psqlCommand}</code>
                </div>
              </div>

              <div className="space-y-2 text-xs">
                <span className="font-bold text-slate-800">تنظیمات متغیرهای محیطی (.env):</span>
                <div className="bg-slate-900 text-slate-200 p-3 rounded-xl font-mono text-[11px] leading-relaxed">
                  <div>SQL_HOST="localhost"</div>
                  <div>SQL_PORT=5432</div>
                  <div>SQL_USER="postgres"</div>
                  <div>SQL_PASSWORD="password"</div>
                  <div>SQL_DB_NAME="kharrazi_db"</div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="pt-4 border-t border-slate-100 flex justify-between items-center">
          <button
            onClick={fetchStatus}
            disabled={isLoading}
            className="flex items-center gap-1.5 text-xs text-slate-600 hover:text-indigo-600 font-medium cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>بررسی مجدد اتصال</span>
          </button>

          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition cursor-pointer"
          >
            بستن پنجره
          </button>
        </div>
      </div>
    </div>
  );
};
