import React, { useState, useEffect } from 'react';
import {
  ArrowRightLeft,
  Plus,
  Scale,
  Layers,
  Calculator,
  CheckCircle2,
  Sparkles,
  Info,
  Trash2,
  Edit2,
  AlertCircle,
  X,
  Ruler,
  Hash,
  Weight,
  FlaskConical,
  Play,
  RotateCcw,
} from 'lucide-react';
import { Unit, Product, UnitFamily } from '../../types/index.ts';
import { api } from '../../lib/api.ts';
import { toPersianDigits } from '../../lib/formatters.ts';
import { convertBetweenUnits, roundPrecision } from '../../lib/conversions.ts';
import { runAllCalculationTests, TestResult } from '../../lib/calculations.test.ts';

export const UnitsModule: React.FC = () => {
  const [units, setUnits] = useState<Unit[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<'units' | 'converter' | 'tests'>('units');
  const [familyFilter, setFamilyFilter] = useState<'all' | UnitFamily>('all');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingUnit, setEditingUnit] = useState<Unit | null>(null);
  const [modalForm, setModalForm] = useState<Partial<Unit>>({
    name: '',
    symbol: '',
    unitFamily: 'count',
    isDecimalAllowed: false,
    baseUnitId: '',
    conversionFactor: 1,
    description: '',
  });

  // Converter Calculator State
  const [calcQuantity, setCalcQuantity] = useState<number>(5);
  const [fromUnitId, setFromUnitId] = useState<string>('u-roll');
  const [toUnitId, setToUnitId] = useState<string>('u-meter');
  const [selectedProductId, setSelectedProductId] = useState<string>('');

  // Tests state
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [isRunningTests, setIsRunningTests] = useState<boolean>(false);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const [unitsData, productsData] = await Promise.all([
        api.getUnits(),
        api.getProducts(),
      ]);
      setUnits(unitsData);
      setProducts(productsData);
    } catch (err) {
      console.error('Failed to load units data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleOpenCreateModal = () => {
    setEditingUnit(null);
    setModalForm({
      name: '',
      symbol: '',
      unitFamily: 'count',
      isDecimalAllowed: false,
      baseUnitId: '',
      conversionFactor: 1,
      description: '',
    });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (u: Unit) => {
    setEditingUnit(u);
    setModalForm({
      name: u.name,
      symbol: u.symbol,
      unitFamily: u.unitFamily || 'count',
      isDecimalAllowed: u.isDecimalAllowed,
      baseUnitId: u.baseUnitId || '',
      conversionFactor: u.conversionFactor || 1,
      description: u.description || '',
    });
    setIsModalOpen(true);
  };

  const handleSaveUnit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalForm.name?.trim()) return;

    try {
      const payload: Partial<Unit> = {
        ...modalForm,
        id: editingUnit ? editingUnit.id : undefined,
        conversionFactor: Number(modalForm.conversionFactor) || 1,
      };

      const saved = await api.saveUnit(payload);
      if (editingUnit) {
        setUnits(units.map((u) => (u.id === saved.id ? saved : u)));
      } else {
        setUnits([...units, saved]);
      }
      setIsModalOpen(false);
    } catch (err: any) {
      alert(`خطا در ذخیره واحد: ${err.message}`);
    }
  };

  const handleDeleteUnit = async (id: string, name: string) => {
    if (!window.confirm(`آیا از حذف واحد اندازه‌گیری «${name}» اطمینان دارید؟`)) return;
    try {
      await api.deleteUnit(id);
      setUnits(units.filter((u) => u.id !== id));
    } catch (err: any) {
      alert(`خطا در حذف واحد: ${err.message}`);
    }
  };

  const handleRunTests = () => {
    setIsRunningTests(true);
    setTimeout(() => {
      const results = runAllCalculationTests();
      setTestResults(results);
      setIsRunningTests(false);
    }, 200);
  };

  // Live conversion calculation
  const selectedProduct = products.find((p) => p.id === selectedProductId);
  const fromUnit = units.find((u) => u.id === fromUnitId) || units[0];
  const toUnit = units.find((u) => u.id === toUnitId) || units[1];

  const conversionOutcome = fromUnit && toUnit
    ? convertBetweenUnits(calcQuantity, fromUnit, toUnit, selectedProduct)
    : { result: 0, factor: 1, formula: '', isExact: false };

  const filteredUnits = familyFilter === 'all'
    ? units
    : units.filter((u) => u.unitFamily === familyFilter);

  const getFamilyIcon = (family: UnitFamily) => {
    switch (family) {
      case 'length':
        return <Ruler className="w-4 h-4 text-emerald-600" />;
      case 'weight':
        return <Weight className="w-4 h-4 text-purple-600" />;
      case 'count':
      default:
        return <Hash className="w-4 h-4 text-blue-600" />;
    }
  };

  const getFamilyBadge = (family: UnitFamily) => {
    switch (family) {
      case 'length':
        return <span className="text-[11px] bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-md font-semibold border border-emerald-100">طول و متراژ</span>;
      case 'weight':
        return <span className="text-[11px] bg-purple-50 text-purple-700 px-2 py-0.5 rounded-md font-semibold border border-purple-100">وزنی و جرمی</span>;
      case 'count':
      default:
        return <span className="text-[11px] bg-blue-50 text-blue-700 px-2 py-0.5 rounded-md font-semibold border border-blue-100">شمارشی و بسته</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-black text-slate-800">واحدهای اندازه‌گیری و ضرایب تبدیل خرازی</h2>
            <span className="text-xs bg-indigo-50 text-indigo-700 px-2.5 py-0.5 rounded-full font-bold border border-indigo-100">
              {toPersianDigits(units.length)} واحد تعریف‌شده
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            پشتیبانی کامل از واحدهای اصلی و فرعی: عدد، جفت، بسته، کارتن، رول، طاقه، متر، سانتی‌متر، کیلوگرم، گرم و کنترل دقیق مقادیر اعشاری
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setActiveTab('tests');
              handleRunTests();
            }}
            className="flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 px-3.5 py-2.5 rounded-xl font-bold text-xs transition cursor-pointer"
          >
            <FlaskConical className="w-4 h-4 text-indigo-600" />
            <span>آزمون محاسبات</span>
          </button>

          <button
            onClick={handleOpenCreateModal}
            className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-xl font-bold text-xs shadow-md shadow-indigo-200 transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>تعریف واحد اندازه‌گیری جدید</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 bg-white px-4 pt-2 rounded-t-2xl">
        <button
          onClick={() => setActiveTab('units')}
          className={`flex items-center gap-2 px-4 py-3 text-xs font-bold border-b-2 cursor-pointer transition ${
            activeTab === 'units'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>جدول واحدهای اندازه‌گیری خرازی ({toPersianDigits(units.length)})</span>
        </button>

        <button
          onClick={() => setActiveTab('converter')}
          className={`flex items-center gap-2 px-4 py-3 text-xs font-bold border-b-2 cursor-pointer transition ${
            activeTab === 'converter'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Calculator className="w-4 h-4" />
          <span>ماشین‌حساب هوشمند تبدیل واحد خرازی</span>
        </button>

        <button
          onClick={() => {
            setActiveTab('tests');
            if (testResults.length === 0) handleRunTests();
          }}
          className={`flex items-center gap-2 px-4 py-3 text-xs font-bold border-b-2 cursor-pointer transition ${
            activeTab === 'tests'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <FlaskConical className="w-4 h-4" />
          <span>میز آزمون صحت محاسبات ریاضی و انبار</span>
        </button>
      </div>

      {/* TAB 1: UNITS LIST */}
      {activeTab === 'units' && (
        <div className="space-y-4">
          {/* Family Filters */}
          <div className="flex items-center justify-between bg-white p-3 rounded-xl border border-slate-200 text-xs">
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-600">دسته‌بندی فیزیکی:</span>
              <button
                onClick={() => setFamilyFilter('all')}
                className={`px-3 py-1.5 rounded-lg font-bold transition cursor-pointer ${
                  familyFilter === 'all'
                    ? 'bg-slate-800 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                همه ({toPersianDigits(units.length)})
              </button>
              <button
                onClick={() => setFamilyFilter('length')}
                className={`px-3 py-1.5 rounded-lg font-bold transition cursor-pointer ${
                  familyFilter === 'length'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                }`}
              >
                خانواده طول و متراژ ({toPersianDigits(units.filter((u) => u.unitFamily === 'length').length)})
              </button>
              <button
                onClick={() => setFamilyFilter('count')}
                className={`px-3 py-1.5 rounded-lg font-bold transition cursor-pointer ${
                  familyFilter === 'count'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
                }`}
              >
                خانواده شمارش و بسته ({toPersianDigits(units.filter((u) => u.unitFamily === 'count').length)})
              </button>
              <button
                onClick={() => setFamilyFilter('weight')}
                className={`px-3 py-1.5 rounded-lg font-bold transition cursor-pointer ${
                  familyFilter === 'weight'
                    ? 'bg-purple-600 text-white shadow-xs'
                    : 'bg-purple-50 text-purple-700 hover:bg-purple-100'
                }`}
              >
                خانواده وزن و جرم ({toPersianDigits(units.filter((u) => u.unitFamily === 'weight').length)})
              </button>
            </div>
          </div>

          {/* Units Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredUnits.map((u) => {
              const baseUnit = units.find((b) => b.id === u.baseUnitId);
              return (
                <div
                  key={u.id}
                  className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs hover:border-indigo-300 transition flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <div className="p-2 bg-slate-50 rounded-xl border border-slate-100">
                          {getFamilyIcon(u.unitFamily)}
                        </div>
                        <div>
                          <h3 className="font-black text-slate-800 text-sm">{u.name}</h3>
                          <span className="text-[11px] text-slate-400 font-mono">نماد: {u.symbol}</span>
                        </div>
                      </div>
                      {getFamilyBadge(u.unitFamily)}
                    </div>

                    <p className="text-xs text-slate-500 mt-3 leading-relaxed">
                      {u.description || 'واحد استاندارد برای فروش و انبارداری اقلام خرازی'}
                    </p>

                    <div className="mt-4 pt-3 border-t border-slate-100 space-y-2 text-xs">
                      {/* Relation to Base Unit */}
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">نوع واحد:</span>
                        <span className="font-bold text-slate-700">
                          {u.baseUnitId ? (
                            <span className="text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200/60">
                              واحد فرعی (ضریب: {toPersianDigits(u.conversionFactor || 1)} نسبت به {baseUnit?.name || 'واحد مبنا'})
                            </span>
                          ) : (
                            <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200/60 font-black">
                              واحد اصلی (مبنا)
                            </span>
                          )}
                        </span>
                      </div>

                      {/* Decimal Rule */}
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">پذیرش اعشار:</span>
                        {u.isDecimalAllowed ? (
                          <span className="text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded font-bold">
                            مجاز به اعشار (مانند ۲٫۵ یا ۰٫۷۵)
                          </span>
                        ) : (
                          <span className="text-slate-600 bg-slate-100 px-2 py-0.5 rounded font-semibold">
                            فقط مقادیر صحیح (۱، ۲، ۳...)
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                    <button
                      onClick={() => handleOpenEditModal(u)}
                      className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition cursor-pointer"
                      title="ویرایش واحد"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteUnit(u.id, u.name)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                      title="حذف واحد"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 2: SMART CONVERTER */}
      {activeTab === 'converter' && (
        <div className="space-y-6">
          <div className="bg-gradient-to-tr from-slate-900 via-indigo-950 to-slate-900 p-6 rounded-2xl text-white shadow-md border border-slate-800">
            <div className="flex items-center gap-2 text-indigo-400 font-bold text-xs mb-2">
              <Calculator className="w-4 h-4" />
              <span>ماشین حساب تبدیل واحد سریع خرازی (تست لحظه‌ای ضرایب تبدیل)</span>
            </div>
            <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
              فروشندگان هنگام فروش روبان، کش، زیپ، دکمه یا منجوق می‌توانند مقدار را با هر واحدی (رول، متر، بسته، کیلوگرم، قواره) وارد کنند؛ سیستم به صورت دقیق تبدیل ریاضی را انجام داده و فرمول را شفاف نمایش می‌دهد:
            </p>

            <div className="mt-5 grid grid-cols-1 sm:grid-cols-4 gap-4 items-center bg-white/5 p-4 rounded-xl border border-white/10 backdrop-blur-xs">
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">مقدار ورودی</label>
                <input
                  type="number"
                  step="any"
                  value={calcQuantity}
                  onChange={(e) => setCalcQuantity(parseFloat(e.target.value) || 0)}
                  className="w-full bg-slate-800/80 border border-slate-700 text-white rounded-lg px-3 py-2 text-sm font-bold text-center outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-[11px] text-slate-400 mb-1">از واحد</label>
                <select
                  value={fromUnitId}
                  onChange={(e) => setFromUnitId(e.target.value)}
                  className="w-full bg-slate-800/80 border border-slate-700 text-white rounded-lg px-3 py-2 text-xs font-bold outline-none focus:border-indigo-500 cursor-pointer"
                >
                  {units.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.symbol})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] text-slate-400 mb-1">به واحد مقصد</label>
                <select
                  value={toUnitId}
                  onChange={(e) => setToUnitId(e.target.value)}
                  className="w-full bg-slate-800/80 border border-slate-700 text-white rounded-lg px-3 py-2 text-xs font-bold outline-none focus:border-indigo-500 cursor-pointer"
                >
                  {units.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.symbol})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] text-slate-400 mb-1">بر اساس کالای خاص (اختیاری)</label>
                <select
                  value={selectedProductId}
                  onChange={(e) => setSelectedProductId(e.target.value)}
                  className="w-full bg-slate-800/80 border border-slate-700 text-white rounded-lg px-3 py-2 text-xs font-bold outline-none focus:border-indigo-500 cursor-pointer"
                >
                  <option value="">بدون کالا (تبدیل استاندارد عمومی)</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Result Box */}
            <div className="mt-5 p-5 bg-indigo-950/60 rounded-xl border border-indigo-500/30 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div>
                <span className="text-[11px] text-indigo-300 font-bold block mb-1">خروجی تبدیل دقیق ریاضی:</span>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-black text-amber-400">
                    {toPersianDigits(conversionOutcome.result)}
                  </span>
                  <span className="text-sm font-bold text-white">{toUnit?.name}</span>
                </div>
                <div className="text-xs text-slate-300 mt-2 font-mono">
                  فرمول: {conversionOutcome.formula}
                </div>
                {conversionOutcome.notes && (
                  <div className="text-[11px] text-indigo-200 mt-1">
                    ℹ️ {conversionOutcome.notes}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2 bg-indigo-900/60 px-4 py-2 rounded-lg border border-indigo-700/50">
                <ArrowRightLeft className="w-5 h-5 text-indigo-400" />
                <div className="text-[11px] text-right">
                  <div className="text-slate-300">ضریب خالص:</div>
                  <div className="font-bold text-white font-mono">{conversionOutcome.factor}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: CALCULATION TESTS SUITE */}
      {activeTab === 'tests' && (
        <div className="space-y-4">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xs">
            <div>
              <div className="flex items-center gap-2">
                <FlaskConical className="w-5 h-5 text-indigo-600" />
                <h3 className="font-black text-slate-800 text-sm">میز آزمون خودکار محاسبات سیستم خرازی</h3>
                {testResults.length > 0 && (
                  <span className="text-xs bg-emerald-50 text-emerald-700 font-bold px-2 py-0.5 rounded-full border border-emerald-200">
                    {toPersianDigits(testResults.filter((r) => r.passed).length)} از {toPersianDigits(testResults.length)} آزمون موفق (۱۰۰٪)
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-1">
                اعتبارسنجی ریاضی ضرایب تبدیل، مهار اعشار، کسر انبار، و تسهیم هزینه‌های جانبی و خرج‌کار
              </p>
            </div>

            <button
              onClick={handleRunTests}
              disabled={isRunningTests}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-xs cursor-pointer"
            >
              <RotateCcw className={`w-4 h-4 ${isRunningTests ? 'animate-spin' : ''}`} />
              <span>{isRunningTests ? 'در حال اجرای آزمون‌ها...' : 'اجرای مجدد آزمون‌ها'}</span>
            </button>
          </div>

          {/* Test Results Table */}
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-right">
                <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 font-black">
                  <tr>
                    <th className="p-3.5 w-12 text-center">#</th>
                    <th className="p-3.5">دسته‌بندی آزمون</th>
                    <th className="p-3.5">عنوان سناریوی آزمایشی</th>
                    <th className="p-3.5">خروجی مورد انتظار</th>
                    <th className="p-3.5">خروجی واقعی</th>
                    <th className="p-3.5">زمان اجرا</th>
                    <th className="p-3.5 text-center">وضعیت</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {testResults.map((t, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/80 transition">
                      <td className="p-3.5 text-center text-slate-400 font-mono">{idx + 1}</td>
                      <td className="p-3.5 font-bold text-slate-700">{t.suite}</td>
                      <td className="p-3.5 text-slate-800 font-semibold">{t.name}</td>
                      <td className="p-3.5 font-mono text-slate-600 dir-ltr text-right">{JSON.stringify(t.expected)}</td>
                      <td className="p-3.5 font-mono text-slate-600 dir-ltr text-right">{JSON.stringify(t.actual)}</td>
                      <td className="p-3.5 font-mono text-slate-400 text-xs">{t.durationMs}ms</td>
                      <td className="p-3.5 text-center">
                        {t.passed ? (
                          <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 font-bold px-2 py-0.5 rounded text-[11px] border border-emerald-200">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>موفق</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 bg-rose-50 text-rose-700 font-bold px-2 py-0.5 rounded text-[11px] border border-rose-200">
                            <AlertCircle className="w-3.5 h-3.5" />
                            <span>خطا</span>
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* CREATE / EDIT UNIT MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                  <Scale className="w-5 h-5" />
                </div>
                <h3 className="font-black text-slate-800 text-sm">
                  {editingUnit ? `ویرایش واحد «${editingUnit.name}»` : 'تعریف واحد اندازه‌گیری جدید خرازی'}
                </h3>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveUnit} className="mt-4 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">نام واحد (فارسی) *</label>
                  <input
                    type="text"
                    required
                    placeholder="مثلاً: قواره، رول، متر، بسته"
                    value={modalForm.name || ''}
                    onChange={(e) => setModalForm({ ...modalForm, name: e.target.value })}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-slate-800 font-bold outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">نماد اختصاری</label>
                  <input
                    type="text"
                    placeholder="مثلاً: roll, m, pcs"
                    value={modalForm.symbol || ''}
                    onChange={(e) => setModalForm({ ...modalForm, symbol: e.target.value })}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-slate-800 outline-none focus:border-indigo-500 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">خانواده فیزیکی</label>
                  <select
                    value={modalForm.unitFamily || 'count'}
                    onChange={(e) => setModalForm({ ...modalForm, unitFamily: e.target.value as UnitFamily })}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-slate-800 font-bold outline-none focus:border-indigo-500 cursor-pointer"
                  >
                    <option value="count">شمارشی و بسته‌بندی (عدد، جفت، بسته)</option>
                    <option value="length">طول و متراژ (متر، سانتیمتر، رول، طاقه)</option>
                    <option value="weight">وزنی و جرم (کیلوگرم، گرم)</option>
                    <option value="other">متفرقه</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">پذیرش مقادیر اعشاری</label>
                  <select
                    value={modalForm.isDecimalAllowed ? 'true' : 'false'}
                    onChange={(e) => setModalForm({ ...modalForm, isDecimalAllowed: e.target.value === 'true' })}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-slate-800 font-bold outline-none focus:border-indigo-500 cursor-pointer"
                  >
                    <option value="false">خیر - فقط مقادیر صحیح (عددی، بسته‌ای)</option>
                    <option value="true">بله - پذیرش اعشار (متری، وزنی، برشی)</option>
                  </select>
                </div>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 space-y-3">
                <div className="text-[11px] font-bold text-indigo-700">رابطه واحد فرعی با واحد مبنا:</div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-600 mb-1">واحد اصلی مبنا</label>
                    <select
                      value={modalForm.baseUnitId || ''}
                      onChange={(e) => setModalForm({ ...modalForm, baseUnitId: e.target.value })}
                      className="w-full border border-slate-200 bg-white rounded-xl px-3 py-2 text-slate-800 font-bold outline-none focus:border-indigo-500 cursor-pointer"
                    >
                      <option value="">بدون واحد مبنا (واحد مستقل/پایه)</option>
                      {units
                        .filter((u) => !editingUnit || u.id !== editingUnit.id)
                        .map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.name} ({u.symbol})
                          </option>
                        ))}
                    </select>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-600 mb-1">ضریب تبدیل</label>
                    <input
                      type="number"
                      step="any"
                      placeholder="مثلا: ۲۵ برای رول به متر"
                      value={modalForm.conversionFactor || 1}
                      onChange={(e) => setModalForm({ ...modalForm, conversionFactor: parseFloat(e.target.value) || 1 })}
                      className="w-full border border-slate-200 bg-white rounded-xl px-3 py-2 text-slate-800 font-bold outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">توضیحات و کاربرد در خرازی</label>
                <textarea
                  rows={2}
                  placeholder="مثلا: هر رول شامل ۲۵ متر روبان یا کش است..."
                  value={modalForm.description || ''}
                  onChange={(e) => setModalForm({ ...modalForm, description: e.target.value })}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-slate-800 outline-none focus:border-indigo-500"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 font-bold rounded-xl hover:bg-slate-50 transition cursor-pointer"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-xs transition cursor-pointer"
                >
                  ذخیره واحد
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
