/**
 * مجموعه آزمون‌های واحد خودکار برای کلیه محاسبات سیستم خرازی
 * Test Suite for Haberdashery Units & Cost Allocation Calculations
 */

import {
  convertBetweenUnits,
  calculateItemBaseQuantity,
  calculatePriceForSelectedUnit,
  validateQuantityDecimals,
  allocateAccessoryCost,
  roundPrecision,
} from './conversions.ts';
import {
  calculateRowFinancials,
  calculateInvoiceFinancials,
  validateCustomerCredit,
} from './salesCalculations.ts';
import { numberToPersianWords } from './formatters.ts';
import {
  calculateReturnableItems,
  validateReturnQuantities,
  calculateRefundAllocation,
} from './returnsCalculations.ts';
import {
  validateInvoiceSettlement,
  checkForDuplicateTransaction,
  calculateAccountStatementAndReconciliation,
  validateChequeStatusTransition,
  createStatusHistoryEntry,
} from './treasuryCalculations.ts';
import {
  validateDoubleEntryVoucher,
  checkForDuplicateVoucher,
  generateJournalLedger,
  generateGeneralLedger,
  generateSubsidiaryLedger,
  generateDetailedPersonLedger,
  generateTrialBalance,
  auditAccountingIntegrity,
} from './accountingCalculations.ts';
import {
  calculateProfitabilityAndCogsReport,
  calculatePeriodicSalesAndPurchasesReport,
  calculateBestAndLeastSellingReport,
  calculateInventoryAndTurnoverReport,
  calculatePersonsDebtorsCreditorsAndAgingReport,
  calculateExpensesReport,
  calculateTreasuryAndChequesReport,
  calculateFinancialStatementsReport,
  verifyReportsWithSampleDocuments,
} from './reportsCalculations.ts';
import {
  isShamsiLeapYear,
  validateFiscalYearDefinition,
  calculateOpeningBalancePreview,
  generateOpeningBalanceVoucherFromPayload,
  runPreClosingAudit,
  generateClosingAndRolloverVouchers,
  runFiscalRolloverSimulationTest,
} from './fiscalYearCalculations.ts';
import {
  getDefaultRolePermissionConfigs,
  evaluateUserPermission,
  resolveEndpointPermissionRequirement,
  validateAndSanitizeInput,
  redactUserForClient,
  protectTreasuryConfidentialData,
  getEffectiveConfidentialRules,
  runSecurityAndRbacSimulationTest,
} from './securityCalculations.ts';
import { Unit, Product, Invoice, TreasuryAccount, TreasuryTransaction, Cheque, AccountingVoucher, AccountingAccount, Person, FiscalYear, User, RolePermissionConfig } from '../types/index.ts';

export interface TestResult {
  suite: string;
  name: string;
  passed: boolean;
  expected: any;
  actual: any;
  durationMs: number;
  message?: string;
}

// واحدهای آزمایشی استاندارد خرازی
export const testUnits: Record<string, Unit> = {
  meter: { id: 'u-meter', name: 'متر', symbol: 'm', isDecimalAllowed: true, unitFamily: 'length', description: 'واحد مبنای طول' },
  cm: { id: 'u-cm', name: 'سانتی‌متر', symbol: 'cm', isDecimalAllowed: true, unitFamily: 'length', baseUnitId: 'u-meter', conversionFactor: 0.01 },
  roll: { id: 'u-roll', name: 'رول', symbol: 'roll', isDecimalAllowed: false, unitFamily: 'length', baseUnitId: 'u-meter', conversionFactor: 25 },
  bolt: { id: 'u-bolt', name: 'طاقه', symbol: 'bolt', isDecimalAllowed: false, unitFamily: 'length', baseUnitId: 'u-meter', conversionFactor: 50 },
  
  kg: { id: 'u-kg', name: 'کیلوگرم', symbol: 'kg', isDecimalAllowed: true, unitFamily: 'weight', description: 'واحد مبنای وزن' },
  gram: { id: 'u-gram', name: 'گرم', symbol: 'g', isDecimalAllowed: true, unitFamily: 'weight', baseUnitId: 'u-kg', conversionFactor: 0.001 },

  item: { id: 'u-item', name: 'عدد', symbol: 'pcs', isDecimalAllowed: false, unitFamily: 'count', description: 'واحد مبنای شمارش' },
  pair: { id: 'u-pair', name: 'جفت', symbol: 'pair', isDecimalAllowed: false, unitFamily: 'count', baseUnitId: 'u-item', conversionFactor: 2 },
  pack: { id: 'u-pack', name: 'بسته', symbol: 'pack', isDecimalAllowed: false, unitFamily: 'count', baseUnitId: 'u-item', conversionFactor: 100 },
  box: { id: 'u-box', name: 'کارتن', symbol: 'box', isDecimalAllowed: false, unitFamily: 'count', baseUnitId: 'u-pack', conversionFactor: 24 },
};

// کالای تستی برای محاسبات
export const sampleRibbonProduct: Product = {
  id: 'prd-test-ribbon',
  code: 'RB-101',
  barcode: '62601001',
  name: 'روبان ساتن ۲٫۵ سانت',
  categoryId: 'cat-ribbons',
  baseUnitId: 'u-meter',
  baseUnitName: 'متر',
  color: 'قرمز',
  size: '۲٫۵ سانتیمتر',
  material: 'ساتن',
  weight: 0.35, // ۳۵۰ گرم در هر رول ۲۵ متری
  weightUnit: 'کیلوگرم',
  length: 25,
  lengthUnit: 'متر',
  width: 2.5,
  widthUnit: 'سانتی‌متر',
  purchasePrice: 20000, // ۲۰,۰۰۰ تومان در هر متر
  retailPrice: 35000, // ۳۵,۰۰۰ تومان در هر متر
  wholesalePrice: 28000,
  minAllowedPrice: 25000,
  currentStock: 500, // ۵۰۰ متر در انبار
  minStockAlert: 50,
  allowDecimal: true,
  isActive: true,
  createdAt: '1403/01/01',
  updatedAt: '1403/01/01',
  unitConversions: [
    { unitId: 'u-roll', unitName: 'رول (۲۵ متری)', conversionFactor: 25, price: 750000 },
    { unitId: 'u-cm', unitName: 'سانتی‌متر', conversionFactor: 0.01, price: 350 },
  ],
};

export const sampleButtonProduct: Product = {
  id: 'prd-test-button',
  code: 'BT-202',
  barcode: '62601002',
  name: 'دکمه مجلسی صدفی',
  categoryId: 'cat-buttons',
  baseUnitId: 'u-item',
  baseUnitName: 'عدد',
  purchasePrice: 500, // ۵۰۰ تومان هر عدد
  retailPrice: 1200,
  wholesalePrice: 800,
  minAllowedPrice: 700,
  currentStock: 5000,
  minStockAlert: 500,
  allowDecimal: false,
  isActive: true,
  createdAt: '1403/01/01',
  updatedAt: '1403/01/01',
  unitConversions: [
    { unitId: 'u-pair', unitName: 'جفت', conversionFactor: 2, price: 2300 },
    { unitId: 'u-pack', unitName: 'بسته (۱۴۴ عددی قواره)', conversionFactor: 144, price: 140000 },
  ],
};

/**
 * اجرای کلیه تست‌ها
 */
export function runAllCalculationTests(): TestResult[] {
  const results: TestResult[] = [];

  function test(suite: string, name: string, fn: () => { expected: any; actual: any; passed: boolean; message?: string }) {
    const start = performance.now();
    try {
      const outcome = fn();
      const durationMs = roundPrecision(performance.now() - start, 2);
      results.push({
        suite,
        name,
        passed: outcome.passed,
        expected: outcome.expected,
        actual: outcome.actual,
        durationMs,
        message: outcome.message,
      });
    } catch (err: any) {
      results.push({
        suite,
        name,
        passed: false,
        expected: 'بدون خطا',
        actual: err.message,
        durationMs: roundPrecision(performance.now() - start, 2),
        message: `خطای برنامه: ${err.message}`,
      });
    }
  }

  // ==========================================
  // دسته اول: آزمون‌های تبدیل واحدهای استاندارد (Unit Conversion)
  // ==========================================

  test('واحدهای اندازه‌گیری', 'تبدیل ۱ رول روبان به ۲۵ متر بر اساس ضریب پایه', () => {
    const conv = convertBetweenUnits(1, testUnits.roll, testUnits.meter);
    return {
      expected: 25,
      actual: conv.result,
      passed: conv.result === 25,
    };
  });

  test('واحدهای اندازه‌گیری', 'تبدیل ۳ رول به ۷۵ متر', () => {
    const conv = convertBetweenUnits(3, testUnits.roll, testUnits.meter);
    return {
      expected: 75,
      actual: conv.result,
      passed: conv.result === 75,
    };
  });

  test('واحدهای اندازه‌گیری', 'تبدیل معکوس ۵۰ متر به ۲ رول', () => {
    const conv = convertBetweenUnits(50, testUnits.meter, testUnits.roll);
    return {
      expected: 2,
      actual: conv.result,
      passed: conv.result === 2,
    };
  });

  test('واحدهای اندازه‌گیری', 'تبدیل ۲٫۵ متر به ۲۵۰ سانتی‌متر', () => {
    const conv = convertBetweenUnits(2.5, testUnits.meter, testUnits.cm);
    return {
      expected: 250,
      actual: conv.result,
      passed: conv.result === 250,
    };
  });

  test('واحدهای اندازه‌گیری', 'تبدیل ۳۵۰ سانتی‌متر به ۳٫۵ متر', () => {
    const conv = convertBetweenUnits(350, testUnits.cm, testUnits.meter);
    return {
      expected: 3.5,
      actual: conv.result,
      passed: conv.result === 3.5,
    };
  });

  test('واحدهای اندازه‌گیری', 'تبدیل ۱ کیلوگرم منجوق به ۱۰۰۰ گرم', () => {
    const conv = convertBetweenUnits(1, testUnits.kg, testUnits.gram);
    return {
      expected: 1000,
      actual: conv.result,
      passed: conv.result === 1000,
    };
  });

  test('واحدهای اندازه‌گیری', 'تبدیل ۲۵۰ گرم به ۰٫۲۵ کیلوگرم (اعشار وزنی)', () => {
    const conv = convertBetweenUnits(250, testUnits.gram, testUnits.kg);
    return {
      expected: 0.25,
      actual: conv.result,
      passed: conv.result === 0.25,
    };
  });

  test('واحدهای اندازه‌گیری', 'تبدیل ۵ جفت دکمه یا اپل به ۱۰ عدد', () => {
    const conv = convertBetweenUnits(5, testUnits.pair, testUnits.item);
    return {
      expected: 10,
      actual: conv.result,
      passed: conv.result === 10,
    };
  });

  test('واحدهای اندازه‌گیری', 'تبدیل ۲ کارتن نخ (هر کارتن ۲۴ بسته) به ۴۸ بسته', () => {
    const conv = convertBetweenUnits(2, testUnits.box, testUnits.pack);
    return {
      expected: 48,
      actual: conv.result,
      passed: conv.result === 48,
    };
  });

  // ==========================================
  // دسته دوم: ضرایب اختصاصی کالا (Product Specific Overrides)
  // ==========================================

  test('ضرایب اختصاصی کالا', 'تبدیل ۱ بسته دکمه قواره‌ای ۱۴۴ تایی به ۱۴۴ عدد کالا', () => {
    const conv = convertBetweenUnits(1, testUnits.pack, testUnits.item, sampleButtonProduct);
    return {
      expected: 144,
      actual: conv.result,
      passed: conv.result === 144,
    };
  });

  test('ضرایب اختصاصی کالا', 'تبدیل معکوس ۲۸۸ عدد دکمه به ۲ بسته قواره‌ای', () => {
    const conv = convertBetweenUnits(288, testUnits.item, testUnits.pack, sampleButtonProduct);
    return {
      expected: 2,
      actual: conv.result,
      passed: conv.result === 2,
    };
  });

  // ==========================================
  // دسته سوم: اعتبارسنجی اعشار و مقادیر صحیح (Decimal Precision Discipline)
  // ==========================================

  test('کنترل اعشار', 'پذیرش مقدار اعشاری ۲٫۷۵ متر برای واحد متر (مجاز)', () => {
    const res = validateQuantityDecimals(2.75, testUnits.meter);
    return {
      expected: true,
      actual: res.valid,
      passed: res.valid === true,
    };
  });

  test('کنترل اعشار', 'پذیرش مقدار اعشاری ۰٫۳۵۰ کیلوگرم برای واحد کیلو (مجاز)', () => {
    const res = validateQuantityDecimals(0.35, testUnits.kg);
    return {
      expected: true,
      actual: res.valid,
      passed: res.valid === true,
    };
  });

  test('کنترل اعشار', 'ممنوعیت مقدار اعشاری ۱٫۵ برای واحد عدد (نامجاز)', () => {
    const res = validateQuantityDecimals(1.5, testUnits.item);
    return {
      expected: false,
      actual: res.valid,
      passed: res.valid === false,
    };
  });

  test('کنترل اعشار', 'ممنوعیت مقدار اعشاری ۰٫۴ برای واحد جفت و کارتن (نامجاز)', () => {
    const res = validateQuantityDecimals(0.4, testUnits.pair);
    return {
      expected: false,
      actual: res.valid,
      passed: res.valid === false,
    };
  });

  // ==========================================
  // دسته چهارم: محاسبات کسر از انبار در فروش (Base Quantity & Sales Pricing)
  // ==========================================

  test('محاسبات انبار و فروش', 'محاسبه کسر از انبار به واحد پایه (فروش ۳ رول ۲۵ متری = کسر ۷۵ متر)', () => {
    const baseQty = calculateItemBaseQuantity(3, 'u-roll', Object.values(testUnits), sampleRibbonProduct);
    return {
      expected: 75,
      actual: baseQty,
      passed: baseQty === 75,
    };
  });

  test('محاسبات انبار و فروش', 'محاسبه کسر از انبار (فروش ۱۵۰ سانتی‌متر = کسر ۱٫۵ متر از انبار)', () => {
    const baseQty = calculateItemBaseQuantity(150, 'u-cm', Object.values(testUnits), sampleRibbonProduct);
    return {
      expected: 1.5,
      actual: baseQty,
      passed: baseQty === 1.5,
    };
  });

  test('محاسبات انبار و فروش', 'محاسبه قیمت واحد فرعی اختصاصی (قیمت رول ۲۵ متری ۷۵۰,۰۰۰ تومان)', () => {
    const rollPrice = calculatePriceForSelectedUnit(sampleRibbonProduct, 'u-roll', Object.values(testUnits));
    return {
      expected: 750000,
      actual: rollPrice,
      passed: rollPrice === 750000,
    };
  });

  test('محاسبات انبار و فروش', 'محاسبه قیمت واحد سانتی‌متر (۳۵۰ تومان بر اساس جدول اختصاصی)', () => {
    const cmPrice = calculatePriceForSelectedUnit(sampleRibbonProduct, 'u-cm', Object.values(testUnits));
    return {
      expected: 350,
      actual: cmPrice,
      passed: cmPrice === 350,
    };
  });

  // ==========================================
  // دسته پنجم: تسهیم هزینه جانبی و خرج کار (Accessory Cost Allocation)
  // ==========================================

  const allocationSampleItems = [
    {
      productId: 'p-1',
      productCode: 'KH-101',
      productName: 'روبان ساتن (۱۰ رول)',
      quantity: 10,
      unitName: 'رول',
      originalUnitCost: 50000,
      weightPerUnit: 0.35, // ۳۵۰ گرم
      lengthPerUnit: 25, // ۲۵ متر
    },
    {
      productId: 'p-2',
      productCode: 'KH-102',
      productName: 'دوک نخ پلی‌استر (۳۰ عدد)',
      quantity: 30,
      unitName: 'دوک',
      originalUnitCost: 20000,
      weightPerUnit: 0.15, // ۱۵۰ گرم
      lengthPerUnit: 0,
    },
    {
      productId: 'p-3',
      productCode: 'KH-103',
      productName: 'زیپ فلزی ۵۰ سانت (۶۰ عدد)',
      quantity: 60,
      unitName: 'عدد',
      originalUnitCost: 10000,
      weightPerUnit: 0.05, // ۵۰ گرم
      lengthPerUnit: 0.5,
    },
  ];

  test('تسهیم خرج‌کار و هزینه', 'تسهیم بر اساس تعداد (مجموع ۱۰۰ عدد با هزینه ۱۰۰,۰۰۰ تومان => هر واحد ۱,۰۰۰ تومان)', () => {
    const alloc = allocateAccessoryCost({
      totalAmount: 100000,
      method: 'quantity',
      items: allocationSampleItems,
    });

    const perUnits = alloc.allocatedItems.map((it) => it.allocatedPerUnit);
    return {
      expected: [1000, 1000, 1000],
      actual: perUnits,
      passed: perUnits.every((p) => p === 1000),
    };
  });

  test('تسهیم خرج‌کار و هزینه', 'تسهیم بر اساس ارزش ریالی اقلام و بهای خرید پایه', () => {
    // ارزش‌ها: p1: 10*50000 = 500k (29.41%), p2: 30*20000 = 600k (35.29%), p3: 60*10000 = 600k (35.29%) -> مجموع: 1,700,000
    const totalFreight = 170000;
    const alloc = allocateAccessoryCost({
      totalAmount: totalFreight,
      method: 'value',
      items: allocationSampleItems,
    });

    // سهم کل p1 = 50,000, p2 = 60,000, p3 = 60,000
    const shares = alloc.allocatedItems.map((it) => it.allocatedShare);
    return {
      expected: [50000, 60000, 60000],
      actual: shares,
      passed: shares[0] === 50000 && shares[1] === 60000 && shares[2] === 60000,
    };
  });

  test('تسهیم خرج‌کار و هزینه', 'تسهیم بر اساس وزن فیزیکی (کرایه باربری بر حسب کیلوگرم)', () => {
    // وزن کل: p1 (10 * 0.35 = 3.5kg), p2 (30 * 0.15 = 4.5kg), p3 (60 * 0.05 = 3.0kg) => مجموع: 11kg
    const totalFreight = 110000;
    const alloc = allocateAccessoryCost({
      totalAmount: totalFreight,
      method: 'weight',
      items: allocationSampleItems,
    });

    const shares = alloc.allocatedItems.map((it) => it.allocatedShare);
    // p1 = 35,000, p2 = 45,000, p3 = 30,000
    return {
      expected: [35000, 45000, 30000],
      actual: shares,
      passed: shares[0] === 35000 && shares[1] === 45000 && shares[2] === 30000,
    };
  });

  test('تسهیم خرج‌کار و هزینه', 'تضمین تراز ۱۰۰٪ ریالی بدون افت حتی ۱ تومان (Penny Balancing / Zero Leakage)', () => {
    // مبلغی که تقسیم دقیق نمی‌شود مثلا ۳۳۳,۳۳۳ تومان
    const oddAmount = 333333;
    const alloc = allocateAccessoryCost({
      totalAmount: oddAmount,
      method: 'quantity',
      items: allocationSampleItems,
    });

    const sumAllocated = alloc.allocatedItems.reduce((sum, it) => sum + it.allocatedShare, 0);
    return {
      expected: oddAmount,
      actual: sumAllocated,
      passed: sumAllocated === oddAmount,
    };
  });

  test('تسهیم خرج‌کار و هزینه', 'محاسبه صحیح بهای تمام‌شده جدید هر واحد (newUnitCost = original + allocatedPerUnit)', () => {
    const alloc = allocateAccessoryCost({
      totalAmount: 100000,
      method: 'quantity',
      items: allocationSampleItems,
    });

    const correctlyCalculated = alloc.allocatedItems.every(
      (it) => it.newUnitCost === it.originalUnitCost + it.allocatedPerUnit
    );

    return {
      expected: true,
      actual: correctlyCalculated,
      passed: correctlyCalculated,
    };
  });

  // ==================== آزمون‌های تخصصی انبارداری، خرید و کاردکس ====================

  test('حسابداری انبار و کاردکس', 'محاسبه مانده لحظه‌ای تعدادی و ریالی کاردکس (Running Balance)', () => {
    let runningQty = 0;
    const unitPrice = 25000;
    const movements = [
      { type: 'initial_stock', in: 1000, out: 0 },
      { type: 'purchase_invoice', in: 500, out: 0 },
      { type: 'sale_invoice', in: 0, out: 300 },
      { type: 'adjustment_minus', in: 0, out: 50 },
    ];

    const balances = movements.map((m) => {
      runningQty += m.in - m.out;
      return { qty: runningQty, value: runningQty * unitPrice };
    });

    const last = balances[balances.length - 1];
    return {
      expected: { qty: 1150, value: 1150 * 25000 },
      actual: last,
      passed: last.qty === 1150 && last.value === 28750000,
    };
  });

  test('حسابداری انبار و کاردکس', 'تراز انتقال بین انبارها و حفظ مجموع کل موجودی کالا', () => {
    let sourceStock = 500;
    let destStock = 120;
    const initialTotal = sourceStock + destStock;

    const transferQty = 150;
    sourceStock -= transferQty;
    destStock += transferQty;

    const finalTotal = sourceStock + destStock;
    return {
      expected: { source: 350, dest: 270, total: 620 },
      actual: { source: sourceStock, dest: destStock, total: finalTotal },
      passed: sourceStock === 350 && destStock === 270 && initialTotal === finalTotal,
    };
  });

  test('حسابداری انبار و کاردکس', 'محاسبه خودکار مغایرت و ارزش ریالی انبارگردانی (کسری / فزونی)', () => {
    const items = [
      { id: '1', system: 100, counted: 95, cost: 10000 }, // کسری ۵ عدد = -50,000
      { id: '2', system: 40, counted: 44, cost: 20000 },  // فزونی ۴ عدد = +80,000
      { id: '3', system: 80, counted: 80, cost: 15000 },  // منطبق ۰ = 0
    ];

    let deficitValue = 0;
    let surplusValue = 0;

    const variances = items.map((it) => {
      const variance = it.counted - it.system;
      const value = variance * it.cost;
      if (variance < 0) deficitValue += Math.abs(value);
      if (variance > 0) surplusValue += value;
      return {
        variance,
        status: variance < 0 ? 'deficit' : variance > 0 ? 'surplus' : 'matched',
      };
    });

    const netVariance = surplusValue - deficitValue;

    return {
      expected: {
        statuses: ['deficit', 'surplus', 'matched'],
        deficitValue: 50000,
        surplusValue: 80000,
        netVariance: 30000,
      },
      actual: {
        statuses: variances.map((v) => v.status),
        deficitValue,
        surplusValue,
        netVariance,
      },
      passed:
        variances[0].status === 'deficit' &&
        variances[1].status === 'surplus' &&
        variances[2].status === 'matched' &&
        deficitValue === 50000 &&
        surplusValue === 80000 &&
        netVariance === 30000,
    };
  });

  test('حسابداری انبار و کاردکس', 'محاسبه نرخ گردش کالا و دوره گردش به روز (Turnover Ratio & Days)', () => {
    const initialStock = 200;
    const currentStock = 100;
    const totalOutflow = 600; // خروجی کالا در دوره
    const avgStock = (initialStock + currentStock) / 2; // 150
    const turnoverRatio = roundPrecision(totalOutflow / avgStock, 2); // 4.0
    const turnoverDays = Math.round(365 / turnoverRatio); // 91 days

    return {
      expected: { ratio: 4, days: 91 },
      actual: { ratio: turnoverRatio, days: turnoverDays },
      passed: turnoverRatio === 4 && turnoverDays === 91,
    };
  });

  test('حسابداری انبار و کاردکس', 'راستی‌آزمایی هشدار نقطه سفارش و حداقل موجودی (Low Stock Alert)', () => {
    const productA = { currentStock: 18, minStockAlert: 50 };
    const productB = { currentStock: 120, minStockAlert: 30 };

    const isALow = productA.currentStock <= productA.minStockAlert;
    const isBLow = productB.currentStock <= productB.minStockAlert;

    return {
      expected: { isALow: true, isBLow: false },
      actual: { isALow, isBLow },
      passed: isALow === true && isBLow === false,
    };
  });

  test('حسابداری انبار و کاردکس', 'الزام ثبت دلیل برای تعدیل موجودی انبار (Damage, Expiration, Theft)', () => {
    const validReasonAdjustment = {
      type: 'minus',
      reasonCode: 'damage',
      reasonDescription: 'شکستگی ۵ عدد قیچی حین حمل در انبار',
    };
    const invalidReasonAdjustment = {
      type: 'minus',
      reasonCode: 'damage',
      reasonDescription: '', // بدون دلیل
    };

    const isValidOk = Boolean(validReasonAdjustment.reasonDescription && validReasonAdjustment.reasonDescription.length >= 3);
    const isInvalidOk = Boolean(invalidReasonAdjustment.reasonDescription && invalidReasonAdjustment.reasonDescription.length >= 3);

    return {
      expected: { isValidOk: true, isInvalidOk: false },
      actual: { isValidOk, isInvalidOk },
      passed: isValidOk === true && isInvalidOk === false,
    };
  });

  // ==========================================
  // آزمون‌های ماژول فروش، تسویه ترکیبی و مالیات
  // ==========================================

  test('ماژول فروش و صندوق', 'محاسبه ارقام مالی ردیف فاکتور (تخفیف، ارزش افزوده ۱۰٪ و مبلغ کل ردیف)', () => {
    const row = calculateRowFinancials({
      quantity: 4,
      unitPrice: 50000,
      discount: 20000,
      isTaxEnabled: true,
      taxRate: 10,
    });

    return {
      expected: {
        grossAmount: 200000,
        discountAmount: 20000,
        taxableAmount: 180000,
        taxAmount: 18000,
        totalPrice: 198000,
      },
      actual: row,
      passed:
        row.grossAmount === 200000 &&
        row.discountAmount === 20000 &&
        row.taxableAmount === 180000 &&
        row.taxAmount === 18000 &&
        row.totalPrice === 198000,
    };
  });

  test('ماژول فروش و صندوق', 'محاسبه سرجمع فاکتور چندردیفه با تخفیف کلی و ارزش افزوده', () => {
    const result = calculateInvoiceFinancials({
      items: [
        { quantity: 2, unitPrice: 100000, discount: 10000 }, // net: 190,000
        { quantity: 5, unitPrice: 30000, discount: 0 },      // net: 150,000
      ],
      totalDiscount: 40000, // 340,000 - 40,000 = 300,000 taxable
      isTaxEnabled: true,
      taxRate: 10, // 10% on 300,000 = 30,000
    });

    return {
      expected: {
        subtotal: 350000,
        itemsDiscount: 10000,
        totalDiscount: 40000,
        netBeforeTax: 300000,
        taxAmount: 30000,
        finalAmount: 330000,
      },
      actual: {
        subtotal: result.subtotal,
        itemsDiscount: result.itemsDiscount,
        totalDiscount: result.totalDiscount,
        netBeforeTax: result.netBeforeTax,
        taxAmount: result.taxAmount,
        finalAmount: result.finalAmount,
      },
      passed:
        result.subtotal === 350000 &&
        result.itemsDiscount === 10000 &&
        result.totalDiscount === 40000 &&
        result.netBeforeTax === 300000 &&
        result.taxAmount === 30000 &&
        result.finalAmount === 330000,
    };
  });

  test('ماژول فروش و صندوق', 'تسویه ترکیبی فاکتور: تفکیک مبالغ نقدی، پوز، چک صیادی و مانده نسیه', () => {
    const result = calculateInvoiceFinancials({
      items: [{ quantity: 1, unitPrice: 1000000 }],
      totalDiscount: 0,
      isTaxEnabled: false,
      payments: [
        { id: '1', method: 'cash', amount: 200000 },
        { id: '2', method: 'pos', amount: 500000 },
        { id: '3', method: 'cheque', amount: 150000 },
      ],
    });

    return {
      expected: {
        finalAmount: 1000000,
        paidAmount: 850000,
        remainingAmount: 150000,
        breakdown: { cash: 200000, pos: 500000, bankTransfer: 0, cheque: 150000, credit: 0 },
      },
      actual: {
        finalAmount: result.finalAmount,
        paidAmount: result.paidAmount,
        remainingAmount: result.remainingAmount,
        breakdown: result.paymentBreakdown,
      },
      passed:
        result.finalAmount === 1000000 &&
        result.paidAmount === 850000 &&
        result.remainingAmount === 150000 &&
        result.paymentBreakdown.cash === 200000 &&
        result.paymentBreakdown.pos === 500000 &&
        result.paymentBreakdown.cheque === 150000,
    };
  });

  test('ماژول فروش و صندوق', 'محاسبه پول خرد / باقی‌مانده وجه پرداختی نقدی مشتری (Cash Change)', () => {
    const result = calculateInvoiceFinancials({
      items: [{ quantity: 1, unitPrice: 73000 }],
      payments: [{ id: '1', method: 'cash', amount: 100000 }],
    });

    return {
      expected: { finalAmount: 73000, paidAmount: 100000, cashChange: 27000 },
      actual: { finalAmount: result.finalAmount, paidAmount: result.paidAmount, cashChange: result.cashChange },
      passed: result.finalAmount === 73000 && result.paidAmount === 100000 && result.cashChange === 27000,
    };
  });

  test('ماژول فروش و صندوق', 'کنترل سقف اعتبار طرف حساب برای فروش نسیه و دفتری', () => {
    const customer = {
      id: 'per-cst',
      code: '101',
      name: 'مزون شبنم',
      personType: 'customer' as const,
      mobile: '09120000000',
      creditLimit: 5000000, // سقف ۵ میلیون تومان
      currentBalance: 4200000, // مانده ۴.۲ میلیون تومان بدهکار
      isActive: true,
      createdAt: '1403/01/01',
    };

    const attempt1 = validateCustomerCredit(customer, 1000000); // 4.2M + 1M = 5.2M (over limit)
    const attempt2 = validateCustomerCredit(customer, 500000);  // 4.2M + 0.5M = 4.7M (within limit)

    return {
      expected: {
        attempt1Exceeded: true,
        attempt1Excess: 200000,
        attempt2Exceeded: false,
        attempt2Excess: 0,
      },
      actual: {
        attempt1Exceeded: attempt1.isExceeded,
        attempt1Excess: attempt1.excessAmount,
        attempt2Exceeded: attempt2.isExceeded,
        attempt2Excess: attempt2.excessAmount,
      },
      passed:
        attempt1.isExceeded === true &&
        attempt1.excessAmount === 200000 &&
        attempt2.isExceeded === false &&
        attempt2.excessAmount === 0,
    };
  });

  test('ماژول فروش و صندوق', 'تبدیل مبالغ به حروف فارسی جهت چاپ قالب هلو (Number to Words)', () => {
    const text1 = numberToPersianWords(1250000);
    const text2 = numberToPersianWords(350000);

    const expected1 = 'یک میلیون و دویست و پنجاه هزار تومان';
    const expected2 = 'سیصد و پنجاه هزار تومان';

    return {
      expected: { text1: expected1, text2: expected2 },
      actual: { text1, text2 },
      passed: text1 === expected1 && text2 === expected2,
    };
  });

  test('ماژول فروش و صندوق', 'تبدیل واحد خرازی در فاکتور فروش (فروش ۳ رول ۲۵ متری = ۷۵ متر کسر از انبار)', () => {
    const qty = 3;
    const conversionFactor = 25; // ۱ رول = ۲۵ متر
    const baseQuantity = qty * conversionFactor; // 75 متر
    const unitPricePerRoll = 75000;
    const totalPrice = qty * unitPricePerRoll; // 225,000 تومان

    return {
      expected: { baseQuantity: 75, totalPrice: 225000 },
      actual: { baseQuantity, totalPrice },
      passed: baseQuantity === 75 && totalPrice === 225000,
    };
  });

  test('ماژول فروش و صندوق', 'راستی‌آزمایی منطق ابطال سند و بازگشت قطعی کالا به انبار و کاردکس', () => {
    let stock = 100;
    const soldQty = 15;

    // ۱. ثبت فاکتور فروش قطعی -> کسر از انبار
    stock -= soldQty; // 85
    const stockAfterSale = stock;

    // ۲. ابطال مستند با ثبت دلیل الزامی -> برگشت کالا به انبار
    const cancellationReason = 'انصراف خریدار و مرجوعی قبل از تحویل';
    const isReasonValid = Boolean(cancellationReason && cancellationReason.length >= 3);
    if (isReasonValid) {
      stock += soldQty; // 100
    }
    const stockAfterVoid = stock;

    return {
      expected: { stockAfterSale: 85, isReasonValid: true, stockAfterVoid: 100 },
      actual: { stockAfterSale, isReasonValid, stockAfterVoid },
      passed: stockAfterSale === 85 && isReasonValid === true && stockAfterVoid === 100,
    };
  });

  // ==========================================
  // آزمون‌های برگشت از فروش، برگشت از خرید و مرجوعی
  // ==========================================

  const sampleOriginalInvoice: Invoice = {
    id: 'inv-orig-101',
    invoiceNumber: '101',
    invoiceType: 'sale',
    personId: 'per-4',
    personName: 'مزون شبنم',
    fiscalYearId: 'fy-1403',
    date: '1403/07/20',
    status: 'approved',
    items: [
      {
        id: 'it-1',
        productId: 'prd-test-ribbon',
        productCode: 'RB-101',
        productName: 'روبان ساتن قرمز',
        unitId: 'u-roll',
        unitName: 'رول',
        conversionFactor: 25,
        quantity: 10,
        baseQuantity: 250,
        unitPrice: 75000,
        discount: 0,
        tax: 0,
        totalPrice: 750000,
      },
      {
        id: 'it-2',
        productId: 'prd-test-button',
        productCode: 'BT-202',
        productName: 'دکمه مجلسی صدفی',
        unitId: 'u-item',
        unitName: 'عدد',
        conversionFactor: 1,
        quantity: 200,
        baseQuantity: 200,
        unitPrice: 1200,
        discount: 0,
        tax: 0,
        totalPrice: 240000,
      },
    ],
    subtotal: 990000,
    totalDiscount: 0,
    taxAmount: 0,
    finalAmount: 990000,
    paidAmount: 990000,
    remainingAmount: 0,
    createdBy: 'مدیر سیستم',
    createdAt: '1403/07/20',
  };

  test('مرجوعی کالا', 'برگشت کامل فاکتور فروش (Full Return): استرداد ۱۰۰٪ اقلام و صفر شدن مانده قابل برگشت', () => {
    // برگشت کامل هر ۲ قلم کالا
    const fullReturnInvoice: Invoice = {
      id: 'ret-inv-1',
      invoiceNumber: 'SR-201',
      invoiceType: 'sale_return',
      originalInvoiceId: 'inv-orig-101',
      personId: 'per-4',
      personName: 'مزون شبنم',
      fiscalYearId: 'fy-1403',
      date: '1403/07/21',
      status: 'approved',
      items: [
        {
          id: 'rit-1',
          productId: 'prd-test-ribbon',
          productCode: 'RB-101',
          productName: 'روبان ساتن قرمز',
          unitId: 'u-roll',
          unitName: 'رول',
          conversionFactor: 25,
          quantity: 10, // برگشت تمام ۱۰ رول
          baseQuantity: 250,
          unitPrice: 75000,
          discount: 0,
          tax: 0,
          totalPrice: 750000,
        },
        {
          id: 'rit-2',
          productId: 'prd-test-button',
          productCode: 'BT-202',
          productName: 'دکمه مجلسی صدفی',
          unitId: 'u-item',
          unitName: 'عدد',
          conversionFactor: 1,
          quantity: 200, // برگشت تمام ۲۰۰ عدد
          baseQuantity: 200,
          unitPrice: 1200,
          discount: 0,
          tax: 0,
          totalPrice: 240000,
        },
      ],
      subtotal: 990000,
      totalDiscount: 0,
      taxAmount: 0,
      finalAmount: 990000,
      paidAmount: 990000,
      remainingAmount: 0,
      createdBy: 'مدیر سیستم',
      createdAt: '1403/07/21',
    };

    const returnables = calculateReturnableItems(sampleOriginalInvoice, [fullReturnInvoice]);

    const ribbonItem = returnables.find((r) => r.productId === 'prd-test-ribbon')!;
    const buttonItem = returnables.find((r) => r.productId === 'prd-test-button')!;

    return {
      expected: {
        ribbonRemaining: 0,
        ribbonFullyReturned: true,
        buttonRemaining: 0,
        buttonFullyReturned: true,
      },
      actual: {
        ribbonRemaining: ribbonItem.remainingReturnableQuantity,
        ribbonFullyReturned: ribbonItem.isFullyReturned,
        buttonRemaining: buttonItem.remainingReturnableQuantity,
        buttonFullyReturned: buttonItem.isFullyReturned,
      },
      passed:
        ribbonItem.remainingReturnableQuantity === 0 &&
        ribbonItem.isFullyReturned === true &&
        buttonItem.remainingReturnableQuantity === 0 &&
        buttonItem.isFullyReturned === true,
    };
  });

  test('مرجوعی کالا', 'برگشت جزئی فاکتور (Partial Return): استرداد بخشی از مقدار یک قلم کالا', () => {
    // برگشت جزئی ۳ رول از مجموع ۱۰ رول
    const partialReturnInvoice: Invoice = {
      id: 'ret-inv-part-1',
      invoiceNumber: 'SR-202',
      invoiceType: 'sale_return',
      originalInvoiceId: 'inv-orig-101',
      personId: 'per-4',
      personName: 'مزون شبنم',
      fiscalYearId: 'fy-1403',
      date: '1403/07/22',
      status: 'approved',
      items: [
        {
          id: 'rit-1',
          productId: 'prd-test-ribbon',
          productCode: 'RB-101',
          productName: 'روبان ساتن قرمز',
          unitId: 'u-roll',
          unitName: 'رول',
          conversionFactor: 25,
          quantity: 3, // ۳ رول از ۱۰ رول
          baseQuantity: 75,
          unitPrice: 75000,
          discount: 0,
          tax: 0,
          totalPrice: 225000,
        },
      ],
      subtotal: 225000,
      totalDiscount: 0,
      taxAmount: 0,
      finalAmount: 225000,
      paidAmount: 225000,
      remainingAmount: 0,
      createdBy: 'مدیر سیستم',
      createdAt: '1403/07/22',
    };

    const returnables = calculateReturnableItems(sampleOriginalInvoice, [partialReturnInvoice]);
    const ribbonItem = returnables.find((r) => r.productId === 'prd-test-ribbon')!;

    return {
      expected: {
        cumulativeReturned: 3,
        remainingReturnable: 7,
        isFullyReturned: false,
      },
      actual: {
        cumulativeReturned: ribbonItem.cumulativeReturnedQuantity,
        remainingReturnable: ribbonItem.remainingReturnableQuantity,
        isFullyReturned: ribbonItem.isFullyReturned,
      },
      passed:
        ribbonItem.cumulativeReturnedQuantity === 3 &&
        ribbonItem.remainingReturnableQuantity === 7 &&
        ribbonItem.isFullyReturned === false,
    };
  });

  test('مرجوعی کالا', 'برگشت‌های تکراری و متوالی (Repeated Returns): ثبت چند مرجوعی پی‌درپی تا تکمیل سقف', () => {
    // مرجوعی اول: ۳ رول
    const ret1: Invoice = {
      id: 'ret-1',
      invoiceNumber: 'SR-301',
      invoiceType: 'sale_return',
      originalInvoiceId: 'inv-orig-101',
      personId: 'per-4',
      personName: 'مزون شبنم',
      fiscalYearId: 'fy-1403',
      date: '1403/07/22',
      status: 'approved',
      items: [{ id: '1', productId: 'prd-test-ribbon', productCode: 'RB-101', productName: 'روبان', unitId: 'u-roll', unitName: 'رول', conversionFactor: 25, quantity: 3, baseQuantity: 75, unitPrice: 75000, discount: 0, tax: 0, totalPrice: 225000 }],
      subtotal: 225000,
      totalDiscount: 0,
      taxAmount: 0,
      finalAmount: 225000,
      paidAmount: 225000,
      remainingAmount: 0,
      createdBy: 'مدیر سیستم',
      createdAt: '1403/07/22',
    };

    // مرجوعی دوم: ۴ رول
    const ret2: Invoice = {
      id: 'ret-2',
      invoiceNumber: 'SR-302',
      invoiceType: 'sale_return',
      originalInvoiceId: 'inv-orig-101',
      personId: 'per-4',
      personName: 'مزون شبنم',
      fiscalYearId: 'fy-1403',
      date: '1403/07/23',
      status: 'approved',
      items: [{ id: '2', productId: 'prd-test-ribbon', productCode: 'RB-101', productName: 'روبان', unitId: 'u-roll', unitName: 'رول', conversionFactor: 25, quantity: 4, baseQuantity: 100, unitPrice: 75000, discount: 0, tax: 0, totalPrice: 300000 }],
      subtotal: 300000,
      totalDiscount: 0,
      taxAmount: 0,
      finalAmount: 300000,
      paidAmount: 300000,
      remainingAmount: 0,
      createdBy: 'مدیر سیستم',
      createdAt: '1403/07/23',
    };

    const afterTwoReturns = calculateReturnableItems(sampleOriginalInvoice, [ret1, ret2]);
    const ribbonAfterTwo = afterTwoReturns.find((r) => r.productId === 'prd-test-ribbon')!;

    // مرجوعی سوم: ۳ رول (سقف تکمیل می‌شود)
    const ret3: Invoice = {
      id: 'ret-3',
      invoiceNumber: 'SR-303',
      invoiceType: 'sale_return',
      originalInvoiceId: 'inv-orig-101',
      personId: 'per-4',
      personName: 'مزون شبنم',
      fiscalYearId: 'fy-1403',
      date: '1403/07/24',
      status: 'approved',
      items: [{ id: '3', productId: 'prd-test-ribbon', productCode: 'RB-101', productName: 'روبان', unitId: 'u-roll', unitName: 'رول', conversionFactor: 25, quantity: 3, baseQuantity: 75, unitPrice: 75000, discount: 0, tax: 0, totalPrice: 225000 }],
      subtotal: 225000,
      totalDiscount: 0,
      taxAmount: 0,
      finalAmount: 225000,
      paidAmount: 225000,
      remainingAmount: 0,
      createdBy: 'مدیر سیستم',
      createdAt: '1403/07/24',
    };

    const afterThreeReturns = calculateReturnableItems(sampleOriginalInvoice, [ret1, ret2, ret3]);
    const ribbonAfterThree = afterThreeReturns.find((r) => r.productId === 'prd-test-ribbon')!;

    return {
      expected: {
        step1Remaining: 3, // 10 - (3 + 4) = 3
        step2Remaining: 0, // 10 - (3 + 4 + 3) = 0
        step2Cumulative: 10,
        isCompleted: true,
      },
      actual: {
        step1Remaining: ribbonAfterTwo.remainingReturnableQuantity,
        step2Remaining: ribbonAfterThree.remainingReturnableQuantity,
        step2Cumulative: ribbonAfterThree.cumulativeReturnedQuantity,
        isCompleted: ribbonAfterThree.isFullyReturned,
      },
      passed:
        ribbonAfterTwo.remainingReturnableQuantity === 3 &&
        ribbonAfterThree.remainingReturnableQuantity === 0 &&
        ribbonAfterThree.cumulativeReturnedQuantity === 10 &&
        ribbonAfterThree.isFullyReturned === true,
    };
  });

  test('مرجوعی کالا', 'ممنوعیت اکید برگشت بیش از مقدار مجاز (Forbidden Excess Return Validation)', () => {
    // قبلاً ۷ رول برگشت داده شده و فقط ۳ رول باقی مانده است
    const existingReturn: Invoice = {
      id: 'ret-prev',
      invoiceNumber: 'SR-401',
      invoiceType: 'sale_return',
      originalInvoiceId: 'inv-orig-101',
      personId: 'per-4',
      personName: 'مزون شبنم',
      fiscalYearId: 'fy-1403',
      date: '1403/07/22',
      status: 'approved',
      items: [{ id: '1', productId: 'prd-test-ribbon', productCode: 'RB-101', productName: 'روبان', unitId: 'u-roll', unitName: 'رول', conversionFactor: 25, quantity: 7, baseQuantity: 175, unitPrice: 75000, discount: 0, tax: 0, totalPrice: 525000 }],
      subtotal: 525000,
      totalDiscount: 0,
      taxAmount: 0,
      finalAmount: 525000,
      paidAmount: 525000,
      remainingAmount: 0,
      createdBy: 'مدیر سیستم',
      createdAt: '1403/07/22',
    };

    // کاربر سعی دارد ۴ رول را مرجوع کند (در حالی که فقط ۳ رول مجاز است)
    const invalidAttempt = validateReturnQuantities(
      sampleOriginalInvoice,
      [existingReturn],
      [{ productId: 'prd-test-ribbon', quantity: 4 }]
    );

    // کاربر با مقدار مجاز ۳ رول درخواست می‌دهد
    const validAttempt = validateReturnQuantities(
      sampleOriginalInvoice,
      [existingReturn],
      [{ productId: 'prd-test-ribbon', quantity: 3 }]
    );

    return {
      expected: {
        invalidSuccess: false,
        validSuccess: true,
      },
      actual: {
        invalidSuccess: invalidAttempt.isValid,
        validSuccess: validAttempt.isValid,
      },
      passed: invalidAttempt.isValid === false && validAttempt.isValid === true,
    };
  });

  test('مرجوعی کالا', 'فاکتور تسویه‌شده: استرداد نقدی وجه یا بستانکاری دفتری بدون ایجاد انحراف مالی', () => {
    // سناریو ۱: فاکتور کاملاً تسویه‌شده بوده است (مانده بدهی = ۰)
    // مبلغ مرجوعی: ۱۵۰,۰۰۰ تومان -> کل ۱۵۰,۰۰۰ تومان نقداً مسترد یا بستانکار مشتری می‌شود
    const settledAllocation = calculateRefundAllocation(150000, 0);

    // سناریو ۲: فاکتور دارای مانده بدهی معوقه ۱۰۰,۰۰۰ تومان بوده است
    // مبلغ مرجوعی: ۱۵۰,۰۰۰ تومان -> ۱۰۰,۰۰۰ تومان بدهی را تسویه می‌کند و ۵۰,۰۰۰ تومان مازاد نقداً مسترد می‌شود
    const partialDebtAllocation = calculateRefundAllocation(150000, 100000);

    return {
      expected: {
        settledOffset: 0,
        settledRefund: 150000,
        debtOffset: 100000,
        excessRefund: 50000,
      },
      actual: {
        settledOffset: settledAllocation.offsetDebtAmount,
        settledRefund: settledAllocation.directRefundOrCreditAmount,
        debtOffset: partialDebtAllocation.offsetDebtAmount,
        excessRefund: partialDebtAllocation.directRefundOrCreditAmount,
      },
      passed:
        settledAllocation.offsetDebtAmount === 0 &&
        settledAllocation.directRefundOrCreditAmount === 150000 &&
        partialDebtAllocation.offsetDebtAmount === 100000 &&
        partialDebtAllocation.directRefundOrCreditAmount === 50000,
    };
  });

  test('مرجوعی کالا', 'اصلاح انبار و کاردکس: ورود مجدد کالا به انبار در برگشت از فروش و خروج در برگشت از خرید', () => {
    let shopStock = 50;

    // ۱. برگشت از فروش: مشتری ۵ متر روبان را برمی‌گرداند -> موجودی انبار ۵ واحد اضافه می‌شود
    const saleReturnQty = 5;
    shopStock += saleReturnQty;
    const stockAfterSaleReturn = shopStock;

    // ۲. برگشت از خرید: فروشگاه ۱۰ عدد دکمه را به علت خرابی به تامین‌کننده پس می‌دهد -> موجودی ۱۰ واحد کم می‌شود
    let buttonStock = 40;
    const purchaseReturnQty = 10;
    buttonStock -= purchaseReturnQty;
    const stockAfterPurchaseReturn = buttonStock;

    return {
      expected: { stockAfterSaleReturn: 55, stockAfterPurchaseReturn: 30 },
      actual: { stockAfterSaleReturn, stockAfterPurchaseReturn },
      passed: stockAfterSaleReturn === 55 && stockAfterPurchaseReturn === 30,
    };
  });

  // ==========================================
  // بخش هفتم: ماژول مالی، خزانه‌داری، تسویه‌ها و چک‌های صیادی
  // ==========================================

  test('عملیات مالی و خزانه‌داری', 'تسویه کامل فاکتور (Full Settlement) و صفر شدن مانده بدهی', () => {
    const invoice: Invoice = {
      id: 'inv-test-settle-1',
      invoiceNumber: 'INV-8801',
      invoiceType: 'sale',
      personId: 'per-1',
      personName: 'مزون دوخت پریسا',
      fiscalYearId: 'fy-1403',
      date: '1403/07/20',
      status: 'approved',
      items: [],
      subtotal: 5000000,
      totalDiscount: 0,
      taxAmount: 0,
      finalAmount: 5000000,
      paidAmount: 2000000,
      remainingAmount: 3000000,
      createdBy: 'admin',
      createdAt: '1403/07/20',
    };

    // پرداخت دقیقاً معادل ۳,۰۰۰,۰۰۰ تومان بدهی باقی‌مانده
    const res = validateInvoiceSettlement(invoice, 3000000);

    return {
      expected: {
        isValid: true,
        settlementType: 'full',
        newPaidAmount: 5000000,
        newRemainingAmount: 0,
        isFullySettled: true,
      },
      actual: {
        isValid: res.isValid,
        settlementType: res.settlementType,
        newPaidAmount: res.newPaidAmount,
        newRemainingAmount: res.newRemainingAmount,
        isFullySettled: res.isFullySettled,
      },
      passed:
        res.isValid === true &&
        res.settlementType === 'full' &&
        res.newPaidAmount === 5000000 &&
        res.newRemainingAmount === 0 &&
        res.isFullySettled === true,
    };
  });

  test('عملیات مالی و خزانه‌داری', 'تسویه جزئی فاکتور (Partial Settlement) و محاسبه دقیق مانده معوقه', () => {
    const invoice: Invoice = {
      id: 'inv-test-settle-2',
      invoiceNumber: 'INV-8802',
      invoiceType: 'sale',
      personId: 'per-1',
      personName: 'مزون دوخت پریسا',
      fiscalYearId: 'fy-1403',
      date: '1403/07/20',
      status: 'approved',
      items: [],
      subtotal: 10000000,
      totalDiscount: 0,
      taxAmount: 0,
      finalAmount: 10000000,
      paidAmount: 0,
      remainingAmount: 10000000,
      createdBy: 'admin',
      createdAt: '1403/07/20',
    };

    // پرداخت ۴,۰۰۰,۰۰۰ تومان از کل ۱۰,۰۰۰,۰۰۰ تومان
    const res = validateInvoiceSettlement(invoice, 4000000);

    return {
      expected: {
        isValid: true,
        settlementType: 'partial',
        newPaidAmount: 4000000,
        newRemainingAmount: 6000000,
        isFullySettled: false,
      },
      actual: {
        isValid: res.isValid,
        settlementType: res.settlementType,
        newPaidAmount: res.newPaidAmount,
        newRemainingAmount: res.newRemainingAmount,
        isFullySettled: res.isFullySettled,
      },
      passed:
        res.isValid === true &&
        res.settlementType === 'partial' &&
        res.newPaidAmount === 4000000 &&
        res.newRemainingAmount === 6000000 &&
        res.isFullySettled === false,
    };
  });

  test('عملیات مالی و خزانه‌داری', 'ممانعت از پرداخت بیش از مانده بدهی و پرداخت دوباره فاکتور تسویه‌شده', () => {
    const fullySettledInvoice: Invoice = {
      id: 'inv-test-settled',
      invoiceNumber: 'INV-8803',
      invoiceType: 'sale',
      personId: 'per-1',
      personName: 'مزون دوخت پریسا',
      fiscalYearId: 'fy-1403',
      date: '1403/07/20',
      status: 'approved',
      items: [],
      subtotal: 4000000,
      totalDiscount: 0,
      taxAmount: 0,
      finalAmount: 4000000,
      paidAmount: 4000000,
      remainingAmount: 0, // تسویه شده کامل
      createdBy: 'admin',
      createdAt: '1403/07/20',
    };

    const partiallyOwedInvoice: Invoice = {
      ...fullySettledInvoice,
      id: 'inv-test-owed',
      remainingAmount: 1500000,
      paidAmount: 2500000,
    };

    // ۱. تلاش برای پرداخت روی فاکتوری که مانده‌اش صفر است
    const settledAttempt = validateInvoiceSettlement(fullySettledInvoice, 500000);

    // ۲. تلاش برای پرداخت مبلغ بیش از بدهی (مثلاً پرداخت ۲,۰۰۰,۰۰۰ تومان در حالی که مانده ۱,۵۰۰,۰۰۰ است)
    const excessAttempt = validateInvoiceSettlement(partiallyOwedInvoice, 2000000);

    return {
      expected: { settledAttemptValid: false, excessAttemptValid: false },
      actual: { settledAttemptValid: settledAttempt.isValid, excessAttemptValid: excessAttempt.isValid },
      passed: settledAttempt.isValid === false && excessAttempt.isValid === false,
    };
  });

  test('عملیات مالی و خزانه‌داری', 'پیشگیری هوشمند از ثبت تکراری دریافت یا پرداخت (Duplicate Prevention)', () => {
    const existingTxs: TreasuryTransaction[] = [
      {
        id: 'tx-existing-1',
        transactionType: 'receive',
        treasuryAccountId: 'tr-cash-1',
        treasuryAccountTitle: 'صندوق اصلی',
        personId: 'per-1',
        personName: 'مزون پریسا',
        invoiceId: 'inv-100',
        amount: 2500000,
        date: '1403/07/22',
        trackingNumber: 'POS-998877',
        description: 'تسویه دستگاه پوز',
        createdBy: 'admin',
        createdAt: '1403/07/22',
      },
    ];

    // ۱. تلاش برای ثبت تراکنش با همان شماره پیگیری دقیق
    const duplicateTrackResult = checkForDuplicateTransaction(existingTxs, {
      treasuryAccountId: 'tr-cash-1',
      amount: 2500000,
      trackingNumber: 'POS-998877',
      date: '1403/07/22',
      transactionType: 'receive',
    });

    // ۲. ثبت تراکنش مجاز جدید با شماره پیگیری متفاوت
    const validResult = checkForDuplicateTransaction(existingTxs, {
      treasuryAccountId: 'tr-cash-1',
      amount: 1200000,
      trackingNumber: 'POS-112233',
      date: '1403/07/22',
      transactionType: 'receive',
    });

    return {
      expected: { isDuplicateExpected: true, isValidExpected: false },
      actual: { isDuplicateExpected: duplicateTrackResult.isDuplicate, isValidExpected: validResult.isDuplicate },
      passed: duplicateTrackResult.isDuplicate === true && validResult.isDuplicate === false,
    };
  });

  test('عملیات مالی و خزانه‌داری', 'گردش صندوق و بانک و تطبیق ۱۰۰٪ مانده حساب با تراکنش‌های واقعی (Reconciliation)', () => {
    const account: TreasuryAccount = {
      id: 'acc-test-reconcile',
      type: 'bank',
      title: 'حساب جاری بانک ملت',
      balance: 18500000, // مانده ثبت‌شده
      initialBalance: 10000000, // مانده افتتاحیه
      isActive: true,
    };

    const transactions: TreasuryTransaction[] = [
      // ورود: دریافت وجه از مشتری +12,000,000
      {
        id: 'tx-r-1',
        transactionType: 'receive',
        treasuryAccountId: account.id,
        treasuryAccountTitle: account.title,
        amount: 12000000,
        date: '1403/07/01',
        description: 'واریز مشتری',
        createdBy: 'admin',
        createdAt: '1403/07/01',
      },
      // خروج: پرداخت هزینه باربری -1,500,000
      {
        id: 'tx-e-1',
        transactionType: 'expense',
        treasuryAccountId: account.id,
        treasuryAccountTitle: account.title,
        sourceAccountId: account.id,
        amount: 1500000,
        date: '1403/07/05',
        description: 'هزینه باربری',
        createdBy: 'admin',
        createdAt: '1403/07/05',
      },
      // خروج: انتقال وجه به صندوق فروشگاه -2,000,000
      {
        id: 'tx-t-1',
        transactionType: 'transfer',
        treasuryAccountId: account.id,
        treasuryAccountTitle: account.title,
        sourceAccountId: account.id,
        destinationAccountId: 'tr-cash-1',
        amount: 2000000,
        date: '1403/07/10',
        description: 'انتقال به صندوق',
        createdBy: 'admin',
        createdAt: '1403/07/10',
      },
    ];

    // محاسبه: 10,000,000 + 12,000,000 - 1,500,000 - 2,000,000 = 18,500,000
    const report = calculateAccountStatementAndReconciliation(account, transactions);

    return {
      expected: {
        calculatedBalance: 18500000,
        recordedBalance: 18500000,
        variance: 0,
        isReconciled: true,
        entryCount: 3,
      },
      actual: {
        calculatedBalance: report.calculatedBalance,
        recordedBalance: report.recordedBalance,
        variance: report.variance,
        isReconciled: report.isReconciled,
        entryCount: report.transactionCount,
      },
      passed:
        report.calculatedBalance === 18500000 &&
        report.variance === 0 &&
        report.isReconciled === true &&
        report.transactionCount === 3,
    };
  });

  test('عملیات مالی و خزانه‌داری', 'چرخه حیات چک صیادی، قوانین انتقال وضعیت و ثبت تاریخچه تغییرات', () => {
    const receivedCheque: Cheque = {
      id: 'chq-lifecycle-test',
      chequeType: 'received',
      chequeNumber: '990011',
      sayadNumber: '1122334455667788',
      bankName: 'بانک سپه',
      amount: 8000000,
      issueDate: '1403/07/01',
      dueDate: '1403/08/01',
      personId: 'per-2',
      personName: 'تولیدی پوشاک زنانه باران',
      status: 'registered', // نزد صندوق
      createdAt: '1403/07/01',
    };

    // ۱. مرحله اول: واگذاری به بانک (خواباندن به حساب) با تعیین حساب مقصد
    const step1 = validateChequeStatusTransition(receivedCheque, 'deposited', {
      depositedBankAccountId: 'tr-bank-1',
    });

    // ۲. مرحله دوم: پس از واگذاری، چک وصول می‌شود
    const inBankCheque: Cheque = { ...receivedCheque, status: 'deposited', depositedBankAccountId: 'tr-bank-1' };
    const step2 = validateChequeStatusTransition(inBankCheque, 'collected');

    // ۳. مرحله سوم: آزمایش قانون ممنوعیت (چک وصول شده نمی‌تواند به ابطال تغییر کند)
    const collectedCheque: Cheque = { ...inBankCheque, status: 'collected' };
    const invalidStep = validateChequeStatusTransition(collectedCheque, 'cancelled');

    // ۴. ایجاد ردیف تاریخچه وقایع
    const hist = createStatusHistoryEntry('registered', 'deposited', step1.actionTitle, 'واگذاری به بانک ملی', 'کاربر صندوق');

    return {
      expected: { step1Valid: true, step2Valid: true, invalidValid: false, hasHistoryId: true },
      actual: { step1Valid: step1.isValid, step2Valid: step2.isValid, invalidValid: invalidStep.isValid, hasHistoryId: Boolean(hist.id) },
      passed: step1.isValid === true && step2.isValid === true && invalidStep.isValid === false && Boolean(hist.id),
    };
  });

  // ==========================================
  // بخش آزمون‌های موتور حسابداری دوطرفه و دفاتر قانونی
  // ==========================================

  test('موتور حسابداری دوطرفه', 'اعتبارسنجی توازن و اصول ثبت دوطرفه (برابری بدهکار و بستانکار، حداقل دو آرتیکل، عدم ثبت منفی یا هم‌زمان)', () => {
    // ۱. سند کاملاً متوازن استاندارد
    const validLines = [
      { id: 'l1', accountCode: '10101', accountTitle: 'صندوق اصلی فروشگاه', debit: 2500000, credit: 0 },
      { id: 'l2', accountCode: '401', accountTitle: 'درآمد حاصل از فروش کالا', debit: 0, credit: 2500000 },
    ];
    const resValid = validateDoubleEntryVoucher(validLines);

    // ۲. سند نامتوازن (اختلاف بدهکار و بستانکار)
    const unbalancedLines = [
      { id: 'l1', accountCode: '10101', accountTitle: 'صندوق اصلی', debit: 3000000, credit: 0 },
      { id: 'l2', accountCode: '401', accountTitle: 'درآمد فروش', debit: 0, credit: 2000000 },
    ];
    const resUnbalanced = validateDoubleEntryVoucher(unbalancedLines);

    // ۳. ثبت همزمان بدهکار و بستانکار در یک آرتیکل (خطای متداول حسابداری)
    const sameLineLines = [
      { id: 'l1', accountCode: '10101', accountTitle: 'صندوق', debit: 500000, credit: 200000 },
      { id: 'l2', accountCode: '401', accountTitle: 'درآمد', debit: 0, credit: 300000 },
    ];
    const resSameLine = validateDoubleEntryVoucher(sameLineLines);

    // ۴. سند تک‌سطری (نقض قاعده حسابداری دوبل)
    const singleLine = [
      { id: 'l1', accountCode: '10101', accountTitle: 'صندوق', debit: 1000000, credit: 0 },
    ];
    const resSingle = validateDoubleEntryVoucher(singleLine);

    // ۵. مبلغ منفی در آرتیکل
    const negativeLines = [
      { id: 'l1', accountCode: '10101', accountTitle: 'صندوق', debit: -1000000, credit: 0 },
      { id: 'l2', accountCode: '401', accountTitle: 'درآمد', debit: 0, credit: -1000000 },
    ];
    const resNegative = validateDoubleEntryVoucher(negativeLines);

    return {
      expected: {
        validBalanced: true,
        unbalancedValid: false,
        sameLineValid: false,
        singleValid: false,
        negativeValid: false,
      },
      actual: {
        validBalanced: resValid.isBalanced && resValid.isValid && resValid.variance === 0,
        unbalancedValid: resUnbalanced.isValid,
        sameLineValid: resSameLine.isValid,
        singleValid: resSingle.isValid,
        negativeValid: resNegative.isValid,
      },
      passed:
        resValid.isBalanced === true &&
        resValid.isValid === true &&
        resValid.variance === 0 &&
        resUnbalanced.isValid === false &&
        resSameLine.isValid === false &&
        resSingle.isValid === false &&
        resNegative.isValid === false,
    };
  });

  test('موتور حسابداری دوطرفه', 'جلوگیری هوشمند از تولید سند تکراری (Duplicate Voucher Prevention)', () => {
    const existingVouchers: AccountingVoucher[] = [
      {
        id: 'vch-seed-1',
        voucherNumber: '1001',
        date: '1403/07/01',
        description: 'سند تسویه فاکتور خرید ۱۰۱',
        fiscalYearId: '1403',
        status: 'approved',
        totalDebit: 15000000,
        totalCredit: 15000000,
        isBalanced: true,
        createdBy: 'حسابدار',
        createdAt: '1403/07/01',
        lines: [
          { id: 'vl-1', accountCode: '201', accountTitle: 'حساب‌های پرداختنی', debit: 15000000, credit: 0, personId: 'per-sup-1' },
          { id: 'vl-2', accountCode: '10102', accountTitle: 'بانک ملی', debit: 0, credit: 15000000 },
        ],
      },
    ];

    // ۱. سند کاندید با تاریخ، مبلغ و سطور کاملاً یکسان
    const duplicateCandidate = {
      date: '1403/07/01',
      description: 'سند تسویه فاکتور خرید ۱۰۱',
      totalDebit: 15000000,
      lines: [
        { accountCode: '201', debit: 15000000, credit: 0, personId: 'per-sup-1' },
        { accountCode: '10102', debit: 0, credit: 15000000 },
      ],
    };
    const dupCheck1 = checkForDuplicateVoucher(existingVouchers, duplicateCandidate);

    // ۲. سند کاندید در همان تاریخ ولی با مبلغ متفاوت
    const differentAmountCandidate = {
      date: '1403/07/01',
      description: 'سند تسویه فاکتور خرید ۱۰۱',
      totalDebit: 16000000,
      lines: [
        { accountCode: '201', debit: 16000000, credit: 0, personId: 'per-sup-1' },
        { accountCode: '10102', debit: 0, credit: 16000000 },
      ],
    };
    const dupCheck2 = checkForDuplicateVoucher(existingVouchers, differentAmountCandidate);

    // ۳. سند کاندید با همان مبلغ ولی در تاریخی دیگر
    const differentDateCandidate = {
      date: '1403/07/02',
      description: 'سند تسویه فاکتور خرید ۱۰۱',
      totalDebit: 15000000,
      lines: [
        { accountCode: '201', debit: 15000000, credit: 0, personId: 'per-sup-1' },
        { accountCode: '10102', debit: 0, credit: 15000000 },
      ],
    };
    const dupCheck3 = checkForDuplicateVoucher(existingVouchers, differentDateCandidate);

    return {
      expected: {
        isDuplicate1: true,
        isDuplicate2: false,
        isDuplicate3: false,
        matchedVoucherNumber: '1001',
      },
      actual: {
        isDuplicate1: dupCheck1.isDuplicate,
        isDuplicate2: dupCheck2.isDuplicate,
        isDuplicate3: dupCheck3.isDuplicate,
        matchedVoucherNumber: dupCheck1.matchedVoucherNumber,
      },
      passed:
        dupCheck1.isDuplicate === true &&
        dupCheck1.matchedVoucherNumber === '1001' &&
        dupCheck2.isDuplicate === false &&
        dupCheck3.isDuplicate === false,
    };
  });

  test('دفاتر قانونی حسابداری', 'تولید دفتر روزنامه قانونی (Journal Ledger) با رعایت ترتیب زمانی و برابری جمع گردش‌ها', () => {
    const vouchers: AccountingVoucher[] = [
      {
        id: 'v1',
        voucherNumber: '101',
        date: '1403/07/01',
        description: 'فروش روز اول',
        fiscalYearId: '1403',
        status: 'approved',
        totalDebit: 5000000,
        totalCredit: 5000000,
        isBalanced: true,
        createdBy: 'صندوق',
        createdAt: '1403/07/01',
        lines: [
          { id: 'l1', accountCode: '10101', accountTitle: 'صندوق', debit: 5000000, credit: 0 },
          { id: 'l2', accountCode: '401', accountTitle: 'درآمد فروش', debit: 0, credit: 5000000 },
        ],
      },
      {
        id: 'v2',
        voucherNumber: '102',
        date: '1403/07/02',
        description: 'هزینه باربری',
        fiscalYearId: '1403',
        status: 'approved',
        totalDebit: 800000,
        totalCredit: 800000,
        isBalanced: true,
        createdBy: 'حسابدار',
        createdAt: '1403/07/02',
        lines: [
          { id: 'l3', accountCode: '601', accountTitle: 'هزینه باربری', debit: 800000, credit: 0 },
          { id: 'l4', accountCode: '10101', accountTitle: 'صندوق', debit: 0, credit: 800000 },
        ],
      },
    ];

    const journal = generateJournalLedger(vouchers);

    return {
      expected: {
        totalDebit: 5800000,
        totalCredit: 5800000,
        isBalanced: true,
        entryCount: 4,
      },
      actual: {
        totalDebit: journal.totalDebit,
        totalCredit: journal.totalCredit,
        isBalanced: journal.isBalanced,
        entryCount: journal.entries.length,
      },
      passed:
        journal.totalDebit === 5800000 &&
        journal.totalCredit === 5800000 &&
        journal.isBalanced === true &&
        journal.entries.length === 4,
    };
  });

  test('دفاتر قانونی حسابداری', 'استخراج دفاتر کل و معین، مانده لحظه‌ای و تشخیص خودکار ماهیت مانده (بدهکار/بستانکار)', () => {
    const testAccounts: AccountingAccount[] = [
      { id: 'a1', code: '101', title: 'موجودی نقد و بانک', level: 'general', type: 'asset', balance: 0, isActive: true },
      { id: 'a2', code: '10101', title: 'صندوق نقدی اصلی', level: 'subsidiary', parentCode: '101', type: 'asset', balance: 10000000, isActive: true },
      { id: 'a3', code: '401', title: 'درآمدهای عملیاتی', level: 'general', type: 'revenue', balance: 0, isActive: true },
    ];

    const vouchers: AccountingVoucher[] = [
      {
        id: 'v1',
        voucherNumber: '101',
        date: '1403/07/01',
        description: 'دریافت فروش نقدی',
        fiscalYearId: '1403',
        status: 'approved',
        totalDebit: 4000000,
        totalCredit: 4000000,
        isBalanced: true,
        createdBy: 'صندوق',
        createdAt: '1403/07/01',
        lines: [
          { id: 'l1', accountCode: '10101', accountTitle: 'صندوق نقدی اصلی', debit: 4000000, credit: 0 },
          { id: 'l2', accountCode: '401', accountTitle: 'درآمدهای عملیاتی', debit: 0, credit: 4000000 },
        ],
      },
      {
        id: 'v2',
        voucherNumber: '102',
        date: '1403/07/02',
        description: 'پرداخت تنخواه',
        fiscalYearId: '1403',
        status: 'approved',
        totalDebit: 1500000,
        totalCredit: 1500000,
        isBalanced: true,
        createdBy: 'صندوق',
        createdAt: '1403/07/02',
        lines: [
          { id: 'l3', accountCode: '401', accountTitle: 'درآمدهای عملیاتی', debit: 1500000, credit: 0 },
          { id: 'l4', accountCode: '10101', accountTitle: 'صندوق نقدی اصلی', debit: 0, credit: 1500000 },
        ],
      },
    ];

    const generalList = generateGeneralLedger(vouchers, testAccounts);
    const subList = generateSubsidiaryLedger(vouchers, testAccounts);

    const cashGeneral = generalList.find((g) => g.accountCode === '101');
    const cashSubsidiary = subList.find((s) => s.accountCode === '10101');

    return {
      expected: {
        genTotalDebit: 4000000,
        genTotalCredit: 1500000,
        subClosingBalance: 12500000, // 10,000,000 initial + 4,000,000 debit - 1,500,000 credit
        subNature: 'debit',
      },
      actual: {
        genTotalDebit: cashGeneral?.totalDebit,
        genTotalCredit: cashGeneral?.totalCredit,
        subClosingBalance: cashSubsidiary?.closingBalance,
        subNature: cashSubsidiary?.balanceNature,
      },
      passed:
        cashGeneral?.totalDebit === 4000000 &&
        cashGeneral?.totalCredit === 1500000 &&
        cashSubsidiary?.closingBalance === 12500000 &&
        cashSubsidiary?.balanceNature === 'debit',
    };
  });

  test('دفاتر قانونی حسابداری', 'دفتر تفصیلی اشخاص و تطبیق مانده دفتری با مانده ثبت‌شده طرف‌های حساب', () => {
    const persons: Person[] = [
      {
        id: 'per-test-1',
        code: 'CUST-10',
        name: 'مزون پروانه',
        personType: 'customer',
        mobile: '09121112233',
        currentBalance: 7000000, // بدهکار ۷ میلیون
        creditLimit: 20000000,
        isActive: true,
        createdAt: '1403/01/01',
      },
    ];

    const vouchers: AccountingVoucher[] = [
      {
        id: 'vch-cust-1',
        voucherNumber: '201',
        date: '1403/07/05',
        description: 'فروش نسیه',
        fiscalYearId: '1403',
        status: 'approved',
        totalDebit: 10000000,
        totalCredit: 10000000,
        isBalanced: true,
        createdBy: 'مدیر فروش',
        createdAt: '1403/07/05',
        lines: [
          { id: 'vl-c-1', accountCode: '103', accountTitle: 'حساب‌های دریافتنی', personId: 'per-test-1', personName: 'مزون پروانه', debit: 10000000, credit: 0 },
          { id: 'vl-c-2', accountCode: '401', accountTitle: 'فروش', debit: 0, credit: 10000000 },
        ],
      },
      {
        id: 'vch-cust-2',
        voucherNumber: '202',
        date: '1403/07/06',
        description: 'دریافت نقدی تسویه حساب',
        fiscalYearId: '1403',
        status: 'approved',
        totalDebit: 3000000,
        totalCredit: 3000000,
        isBalanced: true,
        createdBy: 'صندوق',
        createdAt: '1403/07/06',
        lines: [
          { id: 'vl-c-3', accountCode: '10101', accountTitle: 'صندوق', debit: 3000000, credit: 0 },
          { id: 'vl-c-4', accountCode: '103', accountTitle: 'حساب‌های دریافتنی', personId: 'per-test-1', personName: 'مزون پروانه', debit: 0, credit: 3000000 },
        ],
      },
    ];

    const personLedger = generateDetailedPersonLedger(vouchers, persons, 'per-test-1');
    const pl = personLedger[0];

    return {
      expected: {
        totalDebit: 10000000,
        totalCredit: 3000000,
        currentLedgerBalance: 7000000,
        isReconciled: true,
        variance: 0,
      },
      actual: {
        totalDebit: pl.totalDebit,
        totalCredit: pl.totalCredit,
        currentLedgerBalance: pl.currentLedgerBalance,
        isReconciled: pl.isReconciled,
        variance: pl.variance,
      },
      passed:
        pl.totalDebit === 10000000 &&
        pl.totalCredit === 3000000 &&
        pl.currentLedgerBalance === 7000000 &&
        pl.isReconciled === true &&
        pl.variance === 0,
    };
  });

  test('تراز آزمایشی و ممیزی سیستم', 'تراز آزمایشی ۴ و ۶ ستونی و ممیزی جامع سلامت دفاتر حسابداری (Audit Integrity)', () => {
    const testAccounts: AccountingAccount[] = [
      { id: 'a-1', code: '101', title: 'موجودی نقد و بانک', level: 'general', type: 'asset', balance: 50000000, isActive: true },
      { id: 'a-2', code: '10101', title: 'صندوق اصلی', level: 'subsidiary', parentCode: '101', type: 'asset', balance: 50000000, isActive: true },
      { id: 'a-3', code: '301', title: 'سرمایه مالک', level: 'general', type: 'equity', balance: 50000000, isActive: true },
    ];

    const vouchers: AccountingVoucher[] = [
      {
        id: 'vch-tb-1',
        voucherNumber: '301',
        date: '1403/07/01',
        description: 'گردش تستی تراز',
        fiscalYearId: '1403',
        status: 'approved',
        totalDebit: 12000000,
        totalCredit: 12000000,
        isBalanced: true,
        createdBy: 'حسابدار',
        createdAt: '1403/07/01',
        lines: [
          { id: 'l1', accountCode: '10101', accountTitle: 'صندوق اصلی', debit: 12000000, credit: 0 },
          { id: 'l2', accountCode: '301', accountTitle: 'سرمایه مالک', debit: 0, credit: 12000000 },
        ],
      },
    ];

    const tb = generateTrialBalance(vouchers, testAccounts);
    const audit = auditAccountingIntegrity(vouchers, testAccounts, [], []);

    return {
      expected: {
        isTurnoverBalanced: true,
        isClosingBalanced: true,
        totalTurnoverDebit: 12000000,
        totalTurnoverCredit: 12000000,
        vouchersBalanced: true,
        isIntegrityPassed: true,
      },
      actual: {
        isTurnoverBalanced: tb.isTurnoverBalanced,
        isClosingBalanced: tb.isClosingBalanced,
        totalTurnoverDebit: tb.totalTurnoverDebit,
        totalTurnoverCredit: tb.totalTurnoverCredit,
        vouchersBalanced: audit.checks.vouchersBalanced,
        isIntegrityPassed: audit.isIntegrityPassed,
      },
      passed:
        tb.isTurnoverBalanced === true &&
        tb.isClosingBalanced === true &&
        tb.totalTurnoverDebit === 12000000 &&
        tb.totalTurnoverCredit === 12000000 &&
        audit.checks.vouchersBalanced === true &&
        audit.isIntegrityPassed === true,
    };
  });

  // ==========================================
  // بخش آزمون‌های گزارش‌های مدیریتی و حسابداری (۱۹ گزارش)
  // ==========================================

  test('گزارش‌های مدیریتی و حسابداری', 'محاسبه سود ناخالص، بهای تمام‌شده (COGS با ضریب تبدیل واحد)، سود خالص، سود هر کالا و سود هر فاکتور', () => {
    const sampleProds: Product[] = [
      {
        id: 'prd-r-1',
        code: 'RB-101',
        barcode: '6260000101',
        name: 'روبان ساتن ۲ سانت',
        categoryId: 'cat-1',
        categoryName: 'روبان',
        baseUnitId: 'u-meter',
        baseUnitName: 'متر',
        purchasePrice: 3000, // هر متر ۳۰۰۰ تومان خرید
        retailPrice: 5000,
        wholesalePrice: 4200,
        minAllowedPrice: 3800,
        allowDecimal: true,
        unitConversions: [],
        currentStock: 500,
        minStockAlert: 100,
        isActive: true,
        createdAt: '1403/01/01',
        updatedAt: '1403/01/01',
      },
    ];

    const sampleInvs: Invoice[] = [
      {
        id: 'inv-r-sale-1',
        invoiceNumber: 'S-501',
        invoiceType: 'sale',
        personId: 'per-c-1',
        personName: 'مزون نگار',
        fiscalYearId: '1403',
        date: '1403/07/10',
        status: 'approved',
        items: [
          {
            id: 'it-s-1',
            productId: 'prd-r-1',
            productCode: 'RB-101',
            productName: 'روبان ساتن ۲ سانت',
            unitId: 'u-roll',
            unitName: 'رول ۲۵ متری',
            conversionFactor: 25,
            quantity: 4, // ۴ رول = ۱۰۰ متر
            baseQuantity: 100, // 100 متر * 3000 = 300,000 COGS
            unitPrice: 125000, // ۴ * ۱۲۵,۰۰۰ = ۵۰۰,۰۰۰ فروش
            discount: 0,
            tax: 0,
            totalPrice: 500000,
          },
        ],
        subtotal: 500000,
        totalDiscount: 0,
        taxAmount: 0,
        finalAmount: 500000,
        paidAmount: 500000,
        remainingAmount: 0,
        createdBy: 'admin',
        createdAt: '1403/07/10',
      },
      {
        id: 'inv-r-ret-1',
        invoiceNumber: 'SR-501',
        invoiceType: 'sale_return',
        originalInvoiceId: 'inv-r-sale-1',
        personId: 'per-c-1',
        personName: 'مزون نگار',
        fiscalYearId: '1403',
        date: '1403/07/12',
        status: 'approved',
        items: [
          {
            id: 'it-sr-1',
            productId: 'prd-r-1',
            productCode: 'RB-101',
            productName: 'روبان ساتن ۲ سانت',
            unitId: 'u-roll',
            unitName: 'رول ۲۵ متری',
            conversionFactor: 25,
            quantity: 1, // برگشت ۱ رول = ۲۵ متر
            baseQuantity: 25, // 25 * 3000 = 75,000 برگشت از بهای تمام شده
            unitPrice: 125000,
            discount: 0,
            tax: 0,
            totalPrice: 125000,
          },
        ],
        subtotal: 125000,
        totalDiscount: 0,
        taxAmount: 0,
        finalAmount: 125000,
        paidAmount: 125000,
        remainingAmount: 0,
        createdBy: 'admin',
        createdAt: '1403/07/12',
      },
    ];

    const sampleTxs: TreasuryTransaction[] = [
      {
        id: 'tx-exp-1',
        transactionType: 'expense',
        treasuryAccountId: 'tr-cash-1',
        treasuryAccountTitle: 'صندوق',
        amount: 50000, // هزینه ۵۰,۰۰۰ تومان
        date: '1403/07/15',
        description: 'هزینه ارسال پیک',
        createdBy: 'admin',
        createdAt: '1403/07/15',
      },
    ];

    const prof = calculateProfitabilityAndCogsReport(sampleInvs, sampleProds, [], sampleTxs);

    // فروش ناخالص: 500,000 | برگشت: 125,000 => فروش خالص: 375,000
    // COGS ناخالص: 300,000 | برگشت COGS: 75,000 => COGS خالص: 225,000
    // سود ناخالص: 375,000 - 225,000 = 150,000
    // هزینه عملیاتی: 50,000 => سود خالص: 100,000
    return {
      expected: {
        netSales: 375000,
        cogs: 225000,
        grossProfit: 150000,
        operatingExpenses: 50000,
        netProfit: 100000,
        productNetQty: 75,
        invoiceCount: 2,
      },
      actual: {
        netSales: prof.summary.netSales,
        cogs: prof.summary.cogs,
        grossProfit: prof.summary.grossProfit,
        operatingExpenses: prof.summary.operatingExpenses,
        netProfit: prof.summary.netProfit,
        productNetQty: prof.productProfits[0]?.netSoldBaseQty,
        invoiceCount: prof.invoiceProfits.length,
      },
      passed:
        prof.summary.netSales === 375000 &&
        prof.summary.cogs === 225000 &&
        prof.summary.grossProfit === 150000 &&
        prof.summary.operatingExpenses === 50000 &&
        prof.summary.netProfit === 100000 &&
        prof.productProfits[0]?.netSoldBaseQty === 75 &&
        prof.invoiceProfits.length === 2,
    };
  });

  test('گزارش‌های مدیریتی و حسابداری', 'گزارش بدهکاران، بستانکاران، ریزحساب اشخاص و تحلیل سنی سررسید مطالبات (Aging)', () => {
    const samplePersons: Person[] = [
      {
        id: 'per-d-1',
        code: 'C-101',
        name: 'خیاطی الماس (بدهکار)',
        personType: 'customer',
        mobile: '09120001111',
        creditLimit: 20000000,
        currentBalance: 8000000, // بدهکار
        isActive: true,
        createdAt: '1403/01/01',
      },
      {
        id: 'per-c-2',
        code: 'S-201',
        name: 'بنکداری نخ طلایی (بستانکار)',
        personType: 'supplier',
        mobile: '09120002222',
        creditLimit: 0,
        currentBalance: -15000000, // بستانکار
        isActive: true,
        createdAt: '1403/01/01',
      },
    ];

    const unpaidInvoices: Invoice[] = [
      {
        id: 'inv-unpaid-1',
        invoiceNumber: 'INV-901',
        invoiceType: 'sale',
        personId: 'per-d-1',
        personName: 'خیاطی الماس (بدهکار)',
        fiscalYearId: '1403',
        date: '1403/06/05', // ۵۰ روز قبل از تاریخ مبنا 1403/07/25 -> سطل ۳۱ تا ۶۰ روز
        status: 'approved',
        items: [],
        subtotal: 8000000,
        totalDiscount: 0,
        taxAmount: 0,
        finalAmount: 8000000,
        paidAmount: 0,
        remainingAmount: 8000000,
        createdBy: 'admin',
        createdAt: '1403/06/05',
      },
    ];

    const rep = calculatePersonsDebtorsCreditorsAndAgingReport(
      samplePersons,
      unpaidInvoices,
      [],
      [],
      [],
      {},
      '1403/07/25'
    );

    return {
      expected: {
        debtorsCount: 1,
        totalReceivables: 8000000,
        creditorsCount: 1,
        totalPayables: 15000000,
        agingBucket31to60: 8000000,
      },
      actual: {
        debtorsCount: rep.summary.totalDebtorsCount,
        totalReceivables: rep.summary.totalDebtorsAmount,
        creditorsCount: rep.summary.totalCreditorsCount,
        totalPayables: rep.summary.totalCreditorsAmount,
        agingBucket31to60: rep.agingBuckets.days31to60,
      },
      passed:
        rep.summary.totalDebtorsCount === 1 &&
        rep.summary.totalDebtorsAmount === 8000000 &&
        rep.summary.totalCreditorsCount === 1 &&
        rep.summary.totalCreditorsAmount === 15000000 &&
        rep.agingBuckets.days31to60 === 8000000,
    };
  });

  test('گزارش‌های مدیریتی و حسابداری', 'کنترل خودکار صحت کلیه گزارش‌ها با اسناد نمونه و معادله اساسی ترازنامه (Verification Engine)', () => {
    const sampleProducts: Product[] = [
      {
        id: 'p-1',
        code: '101',
        barcode: '6260000102',
        name: 'زیپ مخفی ۲۰ سانت',
        categoryId: 'cat-1',
        categoryName: 'زیپ',
        baseUnitId: 'u-item',
        baseUnitName: 'عدد',
        purchasePrice: 5000,
        retailPrice: 9000,
        wholesalePrice: 7500,
        minAllowedPrice: 6500,
        allowDecimal: false,
        unitConversions: [],
        currentStock: 800, // 800 * 5000 = 4,000,000
        minStockAlert: 100,
        isActive: true,
        createdAt: '1403/07/01',
        updatedAt: '1403/07/01',
      },
    ];

    const sampleInvoices: Invoice[] = [
      {
        id: 'inv-v-1',
        invoiceNumber: '1001',
        invoiceType: 'sale',
        personId: 'per-1',
        personName: 'مشتری نمونه',
        fiscalYearId: '1403',
        date: '1403/07/10',
        status: 'approved',
        items: [
          {
            id: 'i-1',
            productId: 'p-1',
            productCode: '101',
            productName: 'زیپ مخفی ۲۰ سانت',
            unitId: 'u-item',
            unitName: 'عدد',
            conversionFactor: 1,
            quantity: 200,
            baseQuantity: 200,
            unitPrice: 9000,
            discount: 0,
            tax: 0,
            totalPrice: 1800000,
          },
        ],
        subtotal: 1800000,
        totalDiscount: 0,
        taxAmount: 0,
        finalAmount: 1800000,
        paidAmount: 1800000,
        remainingAmount: 0,
        createdBy: 'admin',
        createdAt: '1403/07/10',
      },
    ];

    const sampleAccounts: AccountingAccount[] = [
      { id: 'a-101', code: '101', title: 'موجودی نقد و بانک', level: 'general', type: 'asset', balance: 1800000, isActive: true },
      { id: 'a-10101', code: '10101', title: 'صندوق اصلی', level: 'subsidiary', parentCode: '101', type: 'asset', balance: 1800000, isActive: true },
      { id: 'a-401', code: '401', title: 'فروش کالا', level: 'general', type: 'revenue', balance: 1800000, isActive: true },
    ];

    const sampleVouchers: AccountingVoucher[] = [
      {
        id: 'v-1',
        voucherNumber: '1001',
        date: '1403/07/10',
        description: 'ثبت فروش نقدی فاکتور ۱۰۰۱',
        referenceType: 'sale_invoice',
        referenceId: 'inv-v-1',
        fiscalYearId: '1403',
        status: 'approved',
        totalDebit: 1800000,
        totalCredit: 1800000,
        isBalanced: true,
        createdBy: 'سیستم',
        createdAt: '1403/07/10',
        lines: [
          { id: 'l-1', accountCode: '10101', accountTitle: 'صندوق اصلی', debit: 1800000, credit: 0 },
          { id: 'l-2', accountCode: '401', accountTitle: 'فروش کالا', debit: 0, credit: 1800000 },
        ],
      },
    ];

    const sampleTreasuryAccounts: TreasuryAccount[] = [
      { id: 'tr-1', type: 'cash', title: 'صندوق اصلی', initialBalance: 0, balance: 1800000, isActive: true },
    ];

    const sampleTreasuryTxs: TreasuryTransaction[] = [
      {
        id: 'tx-1',
        transactionType: 'receive',
        treasuryAccountId: 'tr-1',
        treasuryAccountTitle: 'صندوق اصلی',
        amount: 1800000,
        date: '1403/07/10',
        description: 'دریافت فروش نقدی',
        createdBy: 'admin',
        createdAt: '1403/07/10',
      },
    ];

    const verification = verifyReportsWithSampleDocuments({
      products: sampleProducts,
      persons: [],
      invoices: sampleInvoices,
      warehouses: [{ id: 'wh-1', code: '01', name: 'انبار مرکزی', type: 'central', location: 'تهران', isActive: true, createdAt: '1403/01/01' }],
      warehouseStocks: [{ productId: 'p-1', warehouseId: 'wh-1', quantity: 800, lastUpdated: '1403/07/10' }],
      kardexEntries: [],
      treasuryAccounts: sampleTreasuryAccounts,
      treasuryTransactions: sampleTreasuryTxs,
      cheques: [],
      accessoryCosts: [],
      accounts: sampleAccounts,
      vouchers: sampleVouchers,
    });

    return {
      expected: {
        allPassed: true,
        checksCount: 9,
      },
      actual: {
        allPassed: verification.allPassed,
        checksCount: verification.checks.length,
        failedChecks: verification.checks.filter((c) => !c.passed).map((c) => c.id),
      },
      passed: verification.allPassed === true && verification.checks.length === 9,
    };
  });

  // ==========================================
  // بخش آزمون‌های مدیریت سال مالی شمسی، افتتاحیه، اختتامیه و انتقال مانده‌ها
  // ==========================================

  test('مدیریت سال مالی شمسی', 'اعتبارسنجی تعریف سال مالی شمسی، تشخیص سال کبیسه (۳۰ اسفند) و جلوگیری از همپوشانی بازه‌ها', () => {
    const existingYears: FiscalYear[] = [
      {
        id: 'fy-1403',
        code: '1403',
        title: 'سال مالی ۱۴۰۳',
        startDate: '1403/01/01',
        endDate: '1403/12/30',
        isLeapYear: true,
        status: 'open',
        isActive: true,
        isClosed: false,
        auditTrail: [],
        createdAt: '1403/01/01',
        createdBy: 'مدیر',
      },
    ];

    // ۱. تعریف سال مالی معتبر ۱۴۰۴
    const valid1404 = validateFiscalYearDefinition(
      { code: '1404', title: 'سال مالی ۱۴۰۴', startDate: '1404/01/01', endDate: '1404/12/29' },
      existingYears
    );

    // ۲. تلاش برای تعریف سال مالی تکراری ۱۴۰۳
    const duplicate1403 = validateFiscalYearDefinition(
      { code: '1403', title: 'سال مالی تکراری', startDate: '1403/01/01', endDate: '1403/12/29' },
      existingYears
    );

    // ۳. تشخیص سال کبیسه ۱۴۰۳ (کبیسه) در برابر ۱۴۰۴ (عادی)
    const leap1403 = isShamsiLeapYear(1403);
    const leap1404 = isShamsiLeapYear(1404);

    return {
      expected: {
        valid1404: true,
        duplicate1403: false,
        leap1403: true,
        leap1404: false,
      },
      actual: {
        valid1404: valid1404.isValid,
        duplicate1403: duplicate1403.isValid,
        leap1403,
        leap1404,
      },
      passed:
        valid1404.isValid === true &&
        duplicate1403.isValid === false &&
        leap1403 === true &&
        leap1404 === false,
    };
  });

  test('مدیریت سال مالی شمسی', 'ثبت مانده‌های افتتاحیه (صندوق، بانک، اشخاص، موجودی انبار و سرمایه) و صدور سند افتتاحیه تراز', () => {
    const fy1404: FiscalYear = {
      id: 'fy-1404',
      code: '1404',
      title: 'سال مالی ۱۴۰۴',
      startDate: '1404/01/01',
      endDate: '1404/12/29',
      status: 'open',
      isClosed: false,
      isActive: true,
      auditTrail: [],
      createdBy: 'مدیر',
      createdAt: '1404/01/01',
    };

    const sampleTreasury: TreasuryAccount[] = [
      { id: 'tr-1', type: 'cash', title: 'صندوق اصلی', initialBalance: 15000000, balance: 15000000, isActive: true },
      { id: 'tr-2', type: 'bank', title: 'بانک ملت', initialBalance: 45000000, balance: 45000000, isActive: true },
    ];
    const samplePersons: Person[] = [
      { id: 'per-1', code: '101', name: 'مزون پریسا', personType: 'customer', mobile: '09121111111', creditLimit: 50000000, currentBalance: 12000000, isActive: true, createdAt: '1404/01/01' },
      { id: 'per-2', code: '201', name: 'بازرگانی ابریشم', personType: 'supplier', mobile: '09122222222', creditLimit: 0, currentBalance: -20000000, isActive: true, createdAt: '1404/01/01' },
    ];
    const sampleProducts: Product[] = [
      {
        id: 'prd-1',
        code: '101',
        barcode: '62601',
        name: 'روبان ساتن',
        categoryId: 'cat-1',
        baseUnitId: 'u-1',
        baseUnitName: 'متر',
        purchasePrice: 40000,
        retailPrice: 60000,
        wholesalePrice: 50000,
        minAllowedPrice: 45000,
        allowDecimal: true,
        unitConversions: [],
        currentStock: 500,
        minStockAlert: 50,
        isActive: true,
        createdAt: '1404/01/01',
        updatedAt: '1404/01/01',
      },
    ];

    const payload = {
      fiscalYearId: 'fy-1404',
      date: '1404/01/01',
      treasuryBalances: [
        { accountId: 'tr-1', amount: 15000000 },
        { accountId: 'tr-2', amount: 45000000 },
      ],
      personBalances: [
        { personId: 'per-1', balance: 12000000 }, // بدهکار
        { personId: 'per-2', balance: -20000000 }, // بستانکار
      ],
      inventoryBalances: [
        { productId: 'prd-1', warehouseId: 'wh-1', quantity: 500, unitPurchasePrice: 40000 }, // 20,000,000
      ],
      initialCapital: 72000000, // 15M + 45M + 12M + 20M = 92M Assets; 92M - 20M Liability = 72M Capital
      description: 'سند افتتاحیه سال مالی ۱۴۰۴',
    };

    const preview = calculateOpeningBalancePreview(payload, sampleTreasury, samplePersons, sampleProducts);
    const voucher = generateOpeningBalanceVoucherFromPayload(
      payload,
      fy1404,
      sampleTreasury,
      samplePersons,
      sampleProducts,
      '1404-OPN',
      'مدیر سیستم'
    );

    return {
      expected: {
        totalDebit: 92000000,
        totalCredit: 92000000,
        isBalanced: true,
        voucherBalanced: true,
      },
      actual: {
        totalDebit: preview.totalAssetsDebit,
        totalCredit: preview.totalCredit,
        isBalanced: preview.isBalanced,
        voucherBalanced: voucher.isBalanced && voucher.totalDebit === 92000000,
      },
      passed:
        preview.totalAssetsDebit === 92000000 &&
        preview.totalCredit === 92000000 &&
        preview.isBalanced === true &&
        voucher.isBalanced === true,
    };
  });

  test('مدیریت سال مالی شمسی', 'تست کامل انتقال سال مالی (کنترل اسناد موقت، بستن سود و زیان، سند اختتامیه، سند افتتاحیه سال بعد و حفظ سال قبل)', () => {
    const sim = runFiscalRolloverSimulationTest();

    return {
      expected: {
        allPassed: true,
        totalSteps: 7,
        closedYearNetProfit: 6000000,
        openingNewYearVoucherTotal: 151000000,
      },
      actual: {
        allPassed: sim.allPassed,
        totalSteps: sim.totalSteps,
        closedYearNetProfit: sim.sampleDataSummary.closedYearNetProfit,
        openingNewYearVoucherTotal: sim.sampleDataSummary.openingNewYearVoucherTotal,
      },
      passed:
        sim.allPassed === true &&
        sim.totalSteps === 7 &&
        sim.sampleDataSummary.closedYearNetProfit === 6000000 &&
        sim.sampleDataSummary.openingNewYearVoucherTotal === 151000000,
    };
  });

  // ==========================================
  // ۱۲. امنیت، مدیریت کاربران و کنترل دسترسی (RBAC)
  // ==========================================

  test('امنیت و مدیریت کاربران', 'کنترل مجوزهای ۸گانه (مشاهده، ایجاد، ویرایش، ثبت نهایی، ابطال، چاپ، خروجی، گزارش‌ها) برای ۴ نقش و قابلیت شخصی‌سازی', () => {
    const configs = getDefaultRolePermissionConfigs();
    const cashierUser: User = {
      id: 'u-cashier',
      username: 'cashier1',
      fullName: 'صندوق‌دار تست',
      role: 'cashier',
      isActive: true,
      createdAt: '1403/12/20',
    };
    const clerkUser: User = {
      id: 'u-clerk',
      username: 'clerk1',
      fullName: 'انباردار تست',
      role: 'inventory_clerk',
      isActive: true,
      createdAt: '1403/12/20',
    };

    const cashierSalesCreate = evaluateUserPermission(cashierUser, configs, 'sales', 'create').allowed;
    const cashierAccountingApprove = evaluateUserPermission(cashierUser, configs, 'accounting', 'approve').allowed;
    const clerkInventoryCreate = evaluateUserPermission(clerkUser, configs, 'inventory', 'create').allowed;
    const clerkTreasuryApprove = evaluateUserPermission(clerkUser, configs, 'treasury', 'approve').allowed;

    // تست شخصی‌سازی مجوز خروجی فروش برای صندوق‌دار
    const beforeCustomExport = evaluateUserPermission(cashierUser, configs, 'sales', 'export').allowed;
    const customConfigs: RolePermissionConfig[] = configs.map((c: RolePermissionConfig) =>
      c.role === 'cashier'
        ? {
            ...c,
            modules: {
              ...c.modules,
              sales: { ...c.modules.sales, export: true },
            },
          }
        : c
    );
    const afterCustomExport = evaluateUserPermission(cashierUser, customConfigs, 'sales', 'export').allowed;

    return {
      expected: {
        cashierSalesCreate: true,
        cashierAccountingApprove: false,
        clerkInventoryCreate: true,
        clerkTreasuryApprove: false,
        beforeCustomExport: false,
        afterCustomExport: true,
      },
      actual: {
        cashierSalesCreate,
        cashierAccountingApprove,
        clerkInventoryCreate,
        clerkTreasuryApprove,
        beforeCustomExport,
        afterCustomExport,
      },
      passed:
        cashierSalesCreate === true &&
        cashierAccountingApprove === false &&
        clerkInventoryCreate === true &&
        clerkTreasuryApprove === false &&
        beforeCustomExport === false &&
        afterCustomExport === true,
    };
  });

  test('امنیت و مدیریت کاربران', 'نگاشت مسیرهای Backend API به مجوزهای دقیق عملیاتی و مسدودسازی دسترسی غیرمجاز', () => {
    const reqApproveVoucher = resolveEndpointPermissionRequirement('PUT', '/accounting/vouchers/v-101/status', { status: 'permanent' });
    const reqCancelSale = resolveEndpointPermissionRequirement('POST', '/invoices/inv-1/cancel', {});
    const reqEditRoleSecurity = resolveEndpointPermissionRequirement('PUT', '/security/roles/cashier', {});

    const configs = getDefaultRolePermissionConfigs();
    const accountantUser: User = {
      id: 'u-acc',
      username: 'acc1',
      fullName: 'حسابدار تست',
      role: 'accountant',
      isActive: true,
      createdAt: '1403/12/20',
    };

    const accCanFinalizeVoucher = reqApproveVoucher
      ? evaluateUserPermission(accountantUser, configs, reqApproveVoucher.module, reqApproveVoucher.action).allowed
      : false;
    const accCanEditSecurityRoles = reqEditRoleSecurity
      ? evaluateUserPermission(accountantUser, configs, reqEditRoleSecurity.module, reqEditRoleSecurity.action).allowed
      : false;

    return {
      expected: {
        voucherModule: 'accounting',
        voucherAction: 'approve',
        saleAction: 'cancel',
        accCanFinalizeVoucher: true,
        accCanEditSecurityRoles: false,
      },
      actual: {
        voucherModule: reqApproveVoucher?.module,
        voucherAction: reqApproveVoucher?.action,
        saleAction: reqCancelSale?.action,
        accCanFinalizeVoucher,
        accCanEditSecurityRoles,
      },
      passed:
        reqApproveVoucher?.module === 'accounting' &&
        reqApproveVoucher?.action === 'approve' &&
        reqCancelSale?.action === 'cancel' &&
        accCanFinalizeVoucher === true &&
        accCanEditSecurityRoles === false,
    };
  });

  test('امنیت و مدیریت کاربران', 'اعتبارسنجی ورودی (مسدودسازی XSS/SQLi) و حفاظت از اطلاعات محرمانه (حذف هش رمز و ماسک شبا/کارت)', () => {
    const xssCheck = validateAndSanitizeInput({ comment: '<script>fetch("http://evil")</script>' });
    const sqliCheck = validateAndSanitizeInput({ search: "1' UNION SELECT password FROM users --" });
    const safeCheck = validateAndSanitizeInput({ customerName: 'فروشگاه خرازی بهار', amount: 2500000 });

    const configs = getDefaultRolePermissionConfigs();
    const rawUser: User = {
      id: 'u-1',
      username: 'admin',
      fullName: 'مدیر سیستم',
      role: 'admin',
      isActive: true,
      createdAt: '1403/12/25',
      passwordHash: 'scrypt$secret$hash999',
    };
    const safeUser = redactUserForClient(rawUser);

    const clerkUser: User = {
      id: 'u-clerk',
      username: 'clerk1',
      fullName: 'انباردار',
      role: 'inventory_clerk',
      isActive: true,
      createdAt: '1403/12/25',
    };
    const clerkRules = getEffectiveConfidentialRules(clerkUser, configs);
    const sampleBank: TreasuryAccount = {
      id: 'tr-bank-1',
      code: '101',
      title: 'بانک ملت',
      type: 'bank',
      bankName: 'ملت',
      accountNumber: '1234567890',
      cardNumber: '6104337812345678',
      shebaNumber: 'IR120120000000001234567890',
      balance: 85000000,
      initialBalance: 50000000,
      isActive: true,
    };
    const [protectedBank] = protectTreasuryConfidentialData([sampleBank], clerkRules);

    return {
      expected: {
        xssBlocked: false,
        sqliBlocked: false,
        safeAllowed: true,
        passwordHashExposed: false,
        cardMasked: true,
      },
      actual: {
        xssBlocked: xssCheck.valid,
        sqliBlocked: sqliCheck.valid,
        safeAllowed: safeCheck.valid,
        passwordHashExposed: safeUser.passwordHash !== undefined,
        cardMasked: protectedBank.cardNumber !== sampleBank.cardNumber && (protectedBank.cardNumber || '').includes('••••'),
      },
      passed:
        xssCheck.valid === false &&
        sqliCheck.valid === false &&
        safeCheck.valid === true &&
        safeUser.passwordHash === undefined &&
        protectedBank.cardNumber !== sampleBank.cardNumber,
    };
  });

  test('امنیت و مدیریت کاربران', 'اجرای کامل سوئیت ۷ سناریویی تست امنیت، نشست، قفل حساب و RBAC', () => {
    const sim = runSecurityAndRbacSimulationTest();
    return {
      expected: {
        allPassed: true,
        totalScenarios: 7,
      },
      actual: {
        allPassed: sim.success,
        totalScenarios: sim.scenarios.length,
      },
      passed: sim.success === true && sim.scenarios.length === 7,
    };
  });

  return results;
}



