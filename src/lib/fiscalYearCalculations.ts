import {
  FiscalYear,
  FiscalYearArchiveSnapshot,
  OpeningBalancePayload,
  FiscalPreCheckItem,
  FiscalPreClosingAudit,
  AccountingAccount,
  AccountingVoucher,
  VoucherLine,
  Invoice,
  Product,
  Person,
  TreasuryAccount,
  TreasuryTransaction,
  Cheque,
  Warehouse,
  WarehouseStock,
  KardexEntry,
  AccessoryCostEntry,
  GoodsReceipt,
  WarehouseTransfer,
  StocktakingSession,
  InventoryAdjustment,
} from '../types/index.ts';
import {
  normalizePersianDate,
  isDateInRange,
  calculateProfitabilityAndCogsReport,
  calculateFinancialStatementsReport,
} from './reportsCalculations.ts';
import { generateTrialBalance, validateDoubleEntryVoucher } from './accountingCalculations.ts';

/**
 * تشخیص سال کبیسه شمسی
 */
export function isShamsiLeapYear(year: number): boolean {
  const remainders = [1, 5, 9, 13, 17, 22, 26, 30];
  return remainders.includes(((year % 33) + 33) % 33);
}

/**
 * تبدیل ارقام فارسی/عربی به انگلیسی
 */
export function toEnglishDigits(str: string): string {
  return String(str || '')
    .trim()
    .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
}

/**
 * اعتبارسنجی تعریف سال مالی شمسی جدید
 */
export function validateFiscalYearDefinition(
  input: {
    code: string;
    title: string;
    startDate: string;
    endDate: string;
  },
  existingYears: FiscalYear[],
  editingId?: string
): {
  isValid: boolean;
  errors: string[];
  normalizedCode: string;
  normalizedStartDate: string;
  normalizedEndDate: string;
  isLeapYear: boolean;
} {
  const errors: string[] = [];
  const normalizedCode = toEnglishDigits(input.code);
  const normalizedStartDate = normalizePersianDate(input.startDate);
  const normalizedEndDate = normalizePersianDate(input.endDate);

  if (!/^\d{4}$/.test(normalizedCode)) {
    errors.push('کد سال مالی باید یک عدد ۴ رقمی شمسی معتبر باشد (مانند ۱۴۰۳ یا ۱۴۰۴).');
  }

  const yearNum = parseInt(normalizedCode, 10) || 1403;
  if (yearNum < 1380 || yearNum > 1450) {
    errors.push('سال مالی واردشده خارج از محدوده مجاز تقویم شمسی (۱۳۸۰ تا ۱۴۵۰) است.');
  }

  if (!input.title || input.title.trim().length < 3) {
    errors.push('عنوان سال مالی الزامی است (حداقل ۳ کاراکتر).');
  }

  const dateRegex = /^\d{4}\/(0[1-9]|1[0-2])\/(0[1-9]|[12]\d|3[01])$/;
  if (!dateRegex.test(normalizedStartDate)) {
    errors.push('تاریخ شروع سال مالی معتبر نیست (فرمت صحیح: YYYY/MM/DD مانند 1404/01/01).');
  }
  if (!dateRegex.test(normalizedEndDate)) {
    errors.push('تاریخ پایان سال مالی معتبر نیست (فرمت صحیح: YYYY/MM/DD مانند 1404/12/29).');
  }

  if (normalizedStartDate && normalizedEndDate && normalizedStartDate >= normalizedEndDate) {
    errors.push('تاریخ پایان سال مالی باید بزرگ‌تر از تاریخ شروع آن باشد.');
  }

  const duplicateCode = existingYears.find(
    (fy) => toEnglishDigits(fy.code) === normalizedCode && fy.id !== editingId
  );
  if (duplicateCode) {
    errors.push(`سال مالی با کد «${normalizedCode}» (${duplicateCode.title}) قبلاً در سیستم ثبت شده است.`);
  }

  // بررسی تداخل بازه زمانی با سایر سال‌های مالی
  for (const fy of existingYears) {
    if (fy.id === editingId) continue;
    const s = normalizePersianDate(fy.startDate);
    const e = normalizePersianDate(fy.endDate);
    if (normalizedStartDate && normalizedEndDate && s && e) {
      const overlaps = normalizedStartDate <= e && normalizedEndDate >= s;
      if (overlaps) {
        errors.push(`بازه تاریخی واردشده با «${fy.title}» (${s} تا ${e}) هم‌پوشانی دارد.`);
        break;
      }
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    normalizedCode,
    normalizedStartDate,
    normalizedEndDate,
    isLeapYear: isShamsiLeapYear(yearNum),
  };
}

/**
 * محاسبه پیش‌نمایش و توازن مانده‌های افتتاحیه
 */
export function calculateOpeningBalancePreview(
  payload: OpeningBalancePayload,
  treasuryAccounts: TreasuryAccount[],
  persons: Person[],
  products: Product[]
): {
  totalCashAndBank: number;
  totalReceivables: number;
  totalInventoryValue: number;
  totalAssetsDebit: number;
  totalPayablesCredit: number;
  calculatedCapitalCredit: number;
  explicitCapitalCredit: number;
  totalCredit: number;
  variance: number;
  isBalanced: boolean;
  lines: VoucherLine[];
} {
  const lines: VoucherLine[] = [];
  let totalCashAndBank = 0;
  let totalReceivables = 0;
  let totalInventoryValue = 0;
  let totalPayablesCredit = 0;

  // ۱. مانده‌های اول دوره صندوق، بانک و کارتخوان
  for (const tb of payload.treasuryBalances || []) {
    const amount = Math.round(Number(tb.amount) || 0);
    if (amount <= 0) continue;
    const acc = treasuryAccounts.find((a) => a.id === tb.accountId);
    const code =
      acc?.accountingAccountCode ||
      (acc?.type === 'cash' ? '10101' : acc?.type === 'pos' ? '10103' : '10102');
    const title = acc ? acc.title : 'موجودی نقد و بانک';
    totalCashAndBank += amount;
    lines.push({
      id: `op-tr-${tb.accountId}`,
      accountCode: code,
      accountTitle: title,
      debit: amount,
      credit: 0,
      description: `مانده اول دوره ${title}`,
    });
  }

  // ۲. مانده‌های اول دوره اشخاص (بدهکاران ۱۰۳ و بستانکاران ۲۰۱)
  for (const pb of payload.personBalances || []) {
    const bal = Math.round(Number(pb.balance) || 0);
    if (bal === 0) continue;
    const per = persons.find((p) => p.id === pb.personId);
    const pName = per ? per.name : 'طرف حساب';
    if (bal > 0) {
      totalReceivables += bal;
      lines.push({
        id: `op-per-dr-${pb.personId}`,
        accountCode: '103',
        accountTitle: `حساب‌های دریافتنی تجاری - ${pName}`,
        personId: pb.personId,
        personName: pName,
        debit: bal,
        credit: 0,
        description: `مانده بدهکاری اول دوره ${pName}`,
      });
    } else {
      const absPayable = Math.abs(bal);
      totalPayablesCredit += absPayable;
      lines.push({
        id: `op-per-cr-${pb.personId}`,
        accountCode: '201',
        accountTitle: `حساب‌های پرداختنی تجاری - ${pName}`,
        personId: pb.personId,
        personName: pName,
        debit: 0,
        credit: absPayable,
        description: `مانده بستانکاری اول دوره ${pName}`,
      });
    }
  }

  // ۳. موجودی اول دوره کالای انبار (۱۰۴)
  for (const ib of payload.inventoryBalances || []) {
    const qty = Number(ib.quantity) || 0;
    const cost = Number(ib.unitPurchasePrice) || 0;
    const val = Math.round(qty * cost);
    if (val <= 0) continue;
    totalInventoryValue += val;
  }

  if (totalInventoryValue > 0) {
    const prdCount = (payload.inventoryBalances || []).filter((i) => (Number(i.quantity) || 0) > 0).length;
    lines.push({
      id: 'op-inv-total',
      accountCode: '104',
      accountTitle: 'موجودی کالای انبارهای خرازی',
      debit: totalInventoryValue,
      credit: 0,
      description: `ارزش ریالی موجودی اول دوره انبار (${prdCount} قلم کالا)`,
    });
  }

  const totalAssetsDebit = totalCashAndBank + totalReceivables + totalInventoryValue;
  const calculatedCapitalCredit = Math.max(0, totalAssetsDebit - totalPayablesCredit);
  const explicitCapitalCredit =
    payload.initialCapital !== undefined && payload.initialCapital !== null && payload.initialCapital > 0
      ? Math.round(Number(payload.initialCapital))
      : calculatedCapitalCredit;

  if (explicitCapitalCredit > 0) {
    lines.push({
      id: 'op-equity-301',
      accountCode: '301',
      accountTitle: 'سرمایه اولیه و حقوق مالکانه اول دوره',
      debit: 0,
      credit: explicitCapitalCredit,
      description: 'سرمایه اول دوره (تراز افتتاحیه سال مالی)',
    });
  } else if (totalPayablesCredit > totalAssetsDebit) {
    // در صورت فزونی بدهی بر دارایی، مابه‌التفاوت به عنوان کسر سرمایه / زیان انباشته اول دوره بدهکار می‌شود
    const deficit = totalPayablesCredit - totalAssetsDebit;
    lines.push({
      id: 'op-equity-deficit',
      accountCode: '302',
      accountTitle: 'سود و زیان انباشته سنواتی',
      debit: deficit,
      credit: 0,
      description: 'تعدیل تراز افتتاحیه سنواتی',
    });
  }

  const sumDebit = lines.reduce((s, l) => s + l.debit, 0);
  const sumCredit = lines.reduce((s, l) => s + l.credit, 0);
  const variance = sumDebit - sumCredit;

  return {
    totalCashAndBank,
    totalReceivables,
    totalInventoryValue,
    totalAssetsDebit,
    totalPayablesCredit,
    calculatedCapitalCredit,
    explicitCapitalCredit,
    totalCredit: sumCredit,
    variance,
    isBalanced: variance === 0 && lines.length >= 2,
    lines,
  };
}

/**
 * صدور سند حسابداری افتتاحیه از روی مانده‌های اول دوره
 */
export function generateOpeningBalanceVoucherFromPayload(
  payload: OpeningBalancePayload,
  fiscalYear: FiscalYear,
  treasuryAccounts: TreasuryAccount[],
  persons: Person[],
  products: Product[],
  voucherNumber: string = '1001',
  createdBy: string = 'مدیر سیستم'
): AccountingVoucher {
  const preview = calculateOpeningBalancePreview(payload, treasuryAccounts, persons, products);
  const sumDebit = preview.lines.reduce((s, l) => s + l.debit, 0);
  const sumCredit = preview.lines.reduce((s, l) => s + l.credit, 0);

  return {
    id: `vch-open-${fiscalYear.code}`,
    voucherNumber,
    date: payload.date || fiscalYear.startDate || `${toEnglishDigits(fiscalYear.code)}/01/01`,
    description:
      payload.description ||
      `سند افتتاحیه تراز اول دوره ${fiscalYear.title} (نقد و بانک، اشخاص، موجودی انبار و سرمایه)`,
    fiscalYearId: toEnglishDigits(fiscalYear.code),
    status: 'permanent',
    referenceType: 'opening_balance',
    referenceId: fiscalYear.id,
    referenceNumber: `OPN-${toEnglishDigits(fiscalYear.code)}`,
    lines: preview.lines,
    totalDebit: sumDebit,
    totalCredit: sumCredit,
    isBalanced: sumDebit === sumCredit && sumDebit > 0,
    createdBy,
    createdAt: payload.date || fiscalYear.startDate,
  };
}

/**
 * تولید پیش‌نمایش یا اسناد قطعی بستن حساب‌های موقت (سود و زیان)، سند اختتامیه دائمی و سند افتتاحیه سال جدید
 */
export function generateClosingAndRolloverVouchers(params: {
  closingFiscalYear: FiscalYear;
  nextFiscalYearCode: string;
  nextFiscalYearTitle: string;
  nextFiscalYearStartDate: string;
  accounts: AccountingAccount[];
  vouchers: AccountingVoucher[];
  invoices: Invoice[];
  products: Product[];
  persons: Person[];
  treasuryAccounts: TreasuryAccount[];
  treasuryTransactions: TreasuryTransaction[];
  cheques: Cheque[];
  accessoryCosts: AccessoryCostEntry[];
  createdBy?: string;
}): {
  closingTemporaryVoucher: AccountingVoucher;
  closingPermanentVoucher: AccountingVoucher;
  nextYearOpeningVoucher: AccountingVoucher;
  financialSummary: {
    grossSales: number;
    salesReturnsAndDiscounts: number;
    netSales: number;
    cogs: number;
    grossProfit: number;
    operatingExpenses: number;
    accessoryExpenses: number;
    totalExpenses: number;
    otherIncome: number;
    netProfit: number;
    totalAssets: number;
    totalLiabilities: number;
    totalEquity: number;
  };
} {
  const {
    closingFiscalYear,
    nextFiscalYearCode,
    nextFiscalYearTitle,
    nextFiscalYearStartDate,
    accounts,
    vouchers,
    invoices,
    products,
    persons,
    treasuryAccounts,
    treasuryTransactions,
    cheques,
    accessoryCosts,
    createdBy = 'مدیر مالی',
  } = params;

  const fyCode = toEnglishDigits(closingFiscalYear.code);
  const endDate = normalizePersianDate(closingFiscalYear.endDate) || `${fyCode}/12/29`;

  // محاسبه دقیق سود و زیان و ترازنامه در بازه سال مالی در حال بستن
  const filters = {
    dateFrom: normalizePersianDate(closingFiscalYear.startDate) || `${fyCode}/01/01`,
    dateTo: endDate,
  };

  const prof = calculateProfitabilityAndCogsReport(
    invoices,
    products,
    accessoryCosts,
    treasuryTransactions,
    filters
  );

  const fin = calculateFinancialStatementsReport(
    accounts,
    vouchers,
    invoices,
    products,
    persons,
    treasuryAccounts,
    treasuryTransactions,
    cheques,
    accessoryCosts,
    filters
  );

  const grossSales = prof.summary.grossSales + prof.summary.salesTax;
  const salesReturnsAndDiscounts = prof.summary.salesReturns + prof.summary.salesDiscounts;
  const netSales = prof.summary.netSales;
  const cogs = prof.summary.cogs;
  const operatingExpenses = prof.summary.operatingExpenses;
  const accessoryExpenses = prof.summary.accessoryOverheadExpenses;
  const totalExpenses = prof.summary.totalExpenses;
  const otherIncome = prof.summary.otherIncome;
  const netProfit = prof.summary.netProfit;

  // =========================================================================
  // ۱. سند بستن حساب‌های موقت (درآمدها، بهای تمام‌شده و هزینه‌ها به سود و زیان انباشته ۳۰۲)
  // =========================================================================
  const tempLines: VoucherLine[] = [];

  if (grossSales > 0) {
    tempLines.push({
      id: `cl-tmp-401-${fyCode}`,
      accountCode: '401',
      accountTitle: 'فروش کالا و ملزومات خرازی (بستن حساب موقت)',
      debit: grossSales,
      credit: 0,
      description: `بستن حساب درآمد فروش دوره مالی ${closingFiscalYear.title}`,
    });
  }

  if (otherIncome > 0) {
    tempLines.push({
      id: `cl-tmp-403-${fyCode}`,
      accountCode: '403',
      accountTitle: 'سایر درآمدهای عملیاتی (بستن حساب موقت)',
      debit: otherIncome,
      credit: 0,
      description: `بستن سایر درآمدهای دوره مالی ${closingFiscalYear.title}`,
    });
  }

  if (salesReturnsAndDiscounts > 0) {
    tempLines.push({
      id: `cl-tmp-402-${fyCode}`,
      accountCode: '402',
      accountTitle: 'برگشت از فروش و تخفیفات (بستن حساب موقت)',
      debit: 0,
      credit: salesReturnsAndDiscounts,
      description: `بستن حساب برگشت از فروش و تخفیفات ${closingFiscalYear.title}`,
    });
  }

  if (cogs > 0) {
    tempLines.push({
      id: `cl-tmp-501-${fyCode}`,
      accountCode: '501',
      accountTitle: 'بهای تمام‌شده کالای فروش‌رفته - COGS (بستن حساب موقت)',
      debit: 0,
      credit: cogs,
      description: `ثبت و بستن بهای تمام‌شده کالای فروش‌رفته دوره ${closingFiscalYear.title}`,
    });
  }

  if (operatingExpenses > 0) {
    tempLines.push({
      id: `cl-tmp-601-${fyCode}`,
      accountCode: '601',
      accountTitle: 'هزینه‌های عمومی، اداری و حقوق فروشگاه (بستن حساب موقت)',
      debit: 0,
      credit: operatingExpenses,
      description: `بستن هزینه‌های عملیاتی و اداری دوره ${closingFiscalYear.title}`,
    });
  }

  if (accessoryExpenses > 0) {
    tempLines.push({
      id: `cl-tmp-602-${fyCode}`,
      accountCode: '602',
      accountTitle: 'هزینه‌های باربری و خرج‌کار ملزومات (بستن حساب موقت)',
      debit: 0,
      credit: accessoryExpenses,
      description: `بستن هزینه‌های خرج‌کار و باربری دوره ${closingFiscalYear.title}`,
    });
  }

  // انتقال سود یا زیان خالص دوره به حساب سود و زیان انباشته (۳۰۲)
  if (netProfit > 0) {
    tempLines.push({
      id: `cl-tmp-302-profit-${fyCode}`,
      accountCode: '302',
      accountTitle: 'سود و زیان انباشته (انتقال سود ویژه دوره)',
      debit: 0,
      credit: netProfit,
      description: `انتقال سود خالص سال مالی ${closingFiscalYear.title} به حساب سود انباشته`,
    });
  } else if (netProfit < 0) {
    tempLines.push({
      id: `cl-tmp-302-loss-${fyCode}`,
      accountCode: '302',
      accountTitle: 'سود و زیان انباشته (انتقال زیان دوره)',
      debit: Math.abs(netProfit),
      credit: 0,
      description: `انتقال زیان خالص سال مالی ${closingFiscalYear.title} به حساب سود و زیان انباشته`,
    });
  }

  // در صورتی که هیچ گردش سود و زیانی در دوره نبوده باشد، یک جفت سطر صفر/نمادین یا تراز می‌سازیم
  const tempDebit = tempLines.reduce((s, l) => s + l.debit, 0);
  const tempCredit = tempLines.reduce((s, l) => s + l.credit, 0);

  const closingTemporaryVoucher: AccountingVoucher = {
    id: `vch-close-temp-${fyCode}`,
    voucherNumber: `CLS-PL-${fyCode}`,
    date: endDate,
    description: `سند بستن حساب‌های موقت (سود و زیانی) و انتقال سود خالص به سود انباشته - پایان ${closingFiscalYear.title}`,
    fiscalYearId: fyCode,
    status: 'permanent',
    referenceType: 'closing_temporary',
    referenceId: closingFiscalYear.id,
    referenceNumber: `PL-${fyCode}`,
    lines: tempLines,
    totalDebit: tempDebit,
    totalCredit: tempCredit,
    isBalanced: tempDebit === tempCredit,
    createdBy,
    createdAt: endDate,
  };

  // =========================================================================
  // ۲. سند اختتامیه حساب‌های دائمی (ترازنامه‌ای) در پایان سال مالی قدیم
  // و ۳. سند افتتاحیه حساب‌های دائمی در ابتدای سال مالی جدید
  // =========================================================================
  // در سند اختتامیه: کلیه بدهی‌ها و حقوق صاحبان سهام «بدهکار» و کلیه دارایی‌ها «بستانکار» می‌شوند تا حساب‌های سال قدیم صفر شوند.
  // در سند افتتاحیه سال جدید: کلیه دارایی‌ها «بدهکار» و کلیه بدهی‌ها و حقوق صاحبان سهام «بستانکار» می‌شوند.

  const closingPermLines: VoucherLine[] = [];
  const openingNextLines: VoucherLine[] = [];

  // الف) دارایی‌ها: صندوق‌ها، بانک‌ها و کارتخوان‌ها
  for (const tr of treasuryAccounts) {
    const bal = Math.round(Number(tr.balance) || 0);
    if (bal <= 0) continue;
    const code =
      tr.accountingAccountCode ||
      (tr.type === 'cash' ? '10101' : tr.type === 'pos' ? '10103' : '10102');

    // در اختتامیه: بستانکار
    closingPermLines.push({
      id: `cl-perm-tr-${tr.id}-${fyCode}`,
      accountCode: code,
      accountTitle: tr.title,
      debit: 0,
      credit: bal,
      description: `بستن مانده پایان دوره ${tr.title} در سند اختتامیه ${fyCode}`,
    });

    // در افتتاحیه سال بعد: بدهکار
    openingNextLines.push({
      id: `op-next-tr-${tr.id}-${nextFiscalYearCode}`,
      accountCode: code,
      accountTitle: tr.title,
      debit: bal,
      credit: 0,
      description: `مانده انتقالی اول دوره ${tr.title} از سال مالی ${fyCode}`,
    });
  }

  // ب) دارایی‌ها: چک‌های دریافتنی در جریان وصول / نزد صندوق (اسناد دریافتنی ۱۰۲)
  const pendingReceivedCheques = cheques.filter(
    (c) =>
      c.chequeType === 'received' &&
      (c.status === 'registered' || c.status === 'deposited' || c.status === 'in_process')
  );
  const notesReceivableTotal = pendingReceivedCheques.reduce(
    (s, c) => s + (Number(c.amount) || 0),
    0
  );
  if (notesReceivableTotal > 0) {
    closingPermLines.push({
      id: `cl-perm-102-${fyCode}`,
      accountCode: '102',
      accountTitle: 'اسناد دریافتنی تجاری (چک‌های صیادی نزد صندوق و بانک)',
      debit: 0,
      credit: notesReceivableTotal,
      description: `بستن مانده ${pendingReceivedCheques.length} فقره چک دریافتنی در سند اختتامیه`,
    });
    openingNextLines.push({
      id: `op-next-102-${nextFiscalYearCode}`,
      accountCode: '102',
      accountTitle: 'اسناد دریافتنی تجاری (چک‌های صیادی انتقالی)',
      debit: notesReceivableTotal,
      credit: 0,
      description: `انتقال ${pendingReceivedCheques.length} فقره چک دریافتنی به سال مالی ${nextFiscalYearCode}`,
    });
  }

  // ج) دارایی‌ها: اشخاص بدهکار (حساب‌های دریافتنی ۱۰۳ به تفکیک هر شخص)
  const debtors = persons.filter((p) => (Number(p.currentBalance) || 0) > 0);
  for (const d of debtors) {
    const bal = Math.round(Number(d.currentBalance) || 0);
    closingPermLines.push({
      id: `cl-perm-103-${d.id}-${fyCode}`,
      accountCode: '103',
      accountTitle: `حساب‌های دریافتنی تجاری - ${d.name}`,
      personId: d.id,
      personName: d.name,
      debit: 0,
      credit: bal,
      description: `بستن مانده بدهکاری ${d.name} (کد ${d.code}) در اختتامیه ${fyCode}`,
    });
    openingNextLines.push({
      id: `op-next-103-${d.id}-${nextFiscalYearCode}`,
      accountCode: '103',
      accountTitle: `حساب‌های دریافتنی تجاری - ${d.name}`,
      personId: d.id,
      personName: d.name,
      debit: bal,
      credit: 0,
      description: `انتقال مانده بدهکاری ${d.name} (کد ${d.code}) از سال ${fyCode}`,
    });
  }

  // د) دارایی‌ها: موجودی کالای پایان دوره انبارها (۱۰۴)
  const inventoryValuation = products.reduce(
    (s, p) => s + Math.max(0, Number(p.currentStock) || 0) * (Number(p.purchasePrice) || 0),
    0
  );
  if (inventoryValuation > 0) {
    closingPermLines.push({
      id: `cl-perm-104-${fyCode}`,
      accountCode: '104',
      accountTitle: 'موجودی کالای انبار پایان دوره',
      debit: 0,
      credit: inventoryValuation,
      description: `بستن موجودی کالای پایان دوره (${products.length} قلم کالا) در اختتامیه ${fyCode}`,
    });
    openingNextLines.push({
      id: `op-next-104-${nextFiscalYearCode}`,
      accountCode: '104',
      accountTitle: 'موجودی کالای اول دوره انبار',
      debit: inventoryValuation,
      credit: 0,
      description: `انتقال موجودی کالای اول دوره (${products.length} قلم کالا) از سال ${fyCode}`,
    });
  }

  // هـ) بدهی‌ها: اشخاص بستانکار (حساب‌های پرداختنی ۲۰۱ به تفکیک هر تأمین‌کننده/شخص)
  const creditors = persons.filter((p) => (Number(p.currentBalance) || 0) < 0);
  for (const c of creditors) {
    const absBal = Math.round(Math.abs(Number(c.currentBalance) || 0));
    // در اختتامیه: بدهکار می‌شود تا صفر شود
    closingPermLines.push({
      id: `cl-perm-201-${c.id}-${fyCode}`,
      accountCode: '201',
      accountTitle: `حساب‌های پرداختنی تجاری - ${c.name}`,
      personId: c.id,
      personName: c.name,
      debit: absBal,
      credit: 0,
      description: `بستن مانده بستانکاری ${c.name} (کد ${c.code}) در اختتامیه ${fyCode}`,
    });
    // در افتتاحیه سال جدید: بستانکار می‌شود
    openingNextLines.push({
      id: `op-next-201-${c.id}-${nextFiscalYearCode}`,
      accountCode: '201',
      accountTitle: `حساب‌های پرداختنی تجاری - ${c.name}`,
      personId: c.id,
      personName: c.name,
      debit: 0,
      credit: absBal,
      description: `انتقال مانده بستانکاری ${c.name} (کد ${c.code}) از سال ${fyCode}`,
    });
  }

  // و) بدهی‌ها: چک‌های پرداختنی در جریان (اسناد پرداختنی ۲۰۲)
  const pendingIssuedCheques = cheques.filter(
    (c) =>
      c.chequeType === 'issued' &&
      (c.status === 'registered' || c.status === 'deposited' || c.status === 'in_process')
  );
  const notesPayableTotal = pendingIssuedCheques.reduce(
    (s, c) => s + (Number(c.amount) || 0),
    0
  );
  if (notesPayableTotal > 0) {
    closingPermLines.push({
      id: `cl-perm-202-${fyCode}`,
      accountCode: '202',
      accountTitle: 'اسناد پرداختنی تجاری (چک‌های صادره در جریان)',
      debit: notesPayableTotal,
      credit: 0,
      description: `بستن مانده ${pendingIssuedCheques.length} فقره چک پرداختنی در سند اختتامیه`,
    });
    openingNextLines.push({
      id: `op-next-202-${nextFiscalYearCode}`,
      accountCode: '202',
      accountTitle: 'اسناد پرداختنی تجاری (چک‌های صادره انتقالی)',
      debit: 0,
      credit: notesPayableTotal,
      description: `انتقال ${pendingIssuedCheques.length} فقره چک پرداختنی به سال مالی ${nextFiscalYearCode}`,
    });
  }

  // ز) حقوق صاحبان سهام (سرمایه اولیه ۳۰۱ و سود و زیان انباشته ۳۰۲)
  const bs = fin.balanceSheet;
  const initialCapital = bs.equity.initialCapital;
  const retainedAndNetProfit = bs.equity.retainedAndOpeningEquity + bs.equity.currentPeriodNetProfit;

  if (initialCapital > 0) {
    closingPermLines.push({
      id: `cl-perm-301-${fyCode}`,
      accountCode: '301',
      accountTitle: 'سرمایه اولیه فروشگاه خرازی',
      debit: initialCapital,
      credit: 0,
      description: `بستن حساب سرمایه اولیه در سند اختتامیه ${fyCode}`,
    });
    openingNextLines.push({
      id: `op-next-301-${nextFiscalYearCode}`,
      accountCode: '301',
      accountTitle: 'سرمایه اولیه فروشگاه خرازی',
      debit: 0,
      credit: initialCapital,
      description: `انتقال سرمایه اولیه به سال مالی ${nextFiscalYearCode}`,
    });
  }

  if (retainedAndNetProfit > 0) {
    closingPermLines.push({
      id: `cl-perm-302-${fyCode}`,
      accountCode: '302',
      accountTitle: 'سود و زیان انباشته و اندوخته پایان دوره',
      debit: retainedAndNetProfit,
      credit: 0,
      description: `بستن حساب سود انباشته (شامل سود خالص دوره) در اختتامیه ${fyCode}`,
    });
    openingNextLines.push({
      id: `op-next-302-${nextFiscalYearCode}`,
      accountCode: '302',
      accountTitle: 'سود و زیان انباشته سنواتی (انتقالی از سال قبل)',
      debit: 0,
      credit: retainedAndNetProfit,
      description: `انتقال سود انباشته به ابتدای سال مالی ${nextFiscalYearCode}`,
    });
  } else if (retainedAndNetProfit < 0) {
    const absLoss = Math.abs(retainedAndNetProfit);
    closingPermLines.push({
      id: `cl-perm-302-loss-${fyCode}`,
      accountCode: '302',
      accountTitle: 'زیان انباشته پایان دوره',
      debit: 0,
      credit: absLoss,
      description: `بستن حساب زیان انباشته در اختتامیه ${fyCode}`,
    });
    openingNextLines.push({
      id: `op-next-302-loss-${nextFiscalYearCode}`,
      accountCode: '302',
      accountTitle: 'زیان انباشته سنواتی (انتقالی از سال قبل)',
      debit: absLoss,
      credit: 0,
      description: `انتقال زیان انباشته به ابتدای سال مالی ${nextFiscalYearCode}`,
    });
  }

  // مرتب‌سازی سطور بدهکار قبل از بستانکار جهت خوانایی استاندارد حسابداری
  closingPermLines.sort((a, b) => (b.debit > 0 ? 1 : -1) - (a.debit > 0 ? 1 : -1));
  openingNextLines.sort((a, b) => (b.debit > 0 ? 1 : -1) - (a.debit > 0 ? 1 : -1));

  const permDebit = closingPermLines.reduce((s, l) => s + l.debit, 0);
  const permCredit = closingPermLines.reduce((s, l) => s + l.credit, 0);

  const openNextDebit = openingNextLines.reduce((s, l) => s + l.debit, 0);
  const openNextCredit = openingNextLines.reduce((s, l) => s + l.credit, 0);

  const closingPermanentVoucher: AccountingVoucher = {
    id: `vch-close-perm-${fyCode}`,
    voucherNumber: `CLS-BS-${fyCode}`,
    date: endDate,
    description: `سند اختتامیه حساب‌های دائمی (ترازنامه‌ای) پایان ${closingFiscalYear.title}`,
    fiscalYearId: fyCode,
    status: 'permanent',
    referenceType: 'closing_permanent',
    referenceId: closingFiscalYear.id,
    referenceNumber: `CLS-${fyCode}`,
    lines: closingPermLines,
    totalDebit: permDebit,
    totalCredit: permCredit,
    isBalanced: permDebit === permCredit,
    createdBy,
    createdAt: endDate,
  };

  const nextYearOpeningVoucher: AccountingVoucher = {
    id: `vch-open-${toEnglishDigits(nextFiscalYearCode)}`,
    voucherNumber: `OPN-${toEnglishDigits(nextFiscalYearCode)}-1001`,
    date: normalizePersianDate(nextFiscalYearStartDate) || `${toEnglishDigits(nextFiscalYearCode)}/01/01`,
    description: `سند افتتاحیه اتوماتیک ${nextFiscalYearTitle} (انتقال مانده نقد و بانک، اشخاص، چک‌ها، موجودی انبار و سرمایه از سال ${fyCode})`,
    fiscalYearId: toEnglishDigits(nextFiscalYearCode),
    status: 'permanent',
    referenceType: 'opening_balance',
    referenceId: `fy-${toEnglishDigits(nextFiscalYearCode)}`,
    referenceNumber: `OPN-${toEnglishDigits(nextFiscalYearCode)}`,
    lines: openingNextLines,
    totalDebit: openNextDebit,
    totalCredit: openNextCredit,
    isBalanced: openNextDebit === openNextCredit,
    createdBy,
    createdAt: normalizePersianDate(nextFiscalYearStartDate) || `${toEnglishDigits(nextFiscalYearCode)}/01/01`,
  };

  return {
    closingTemporaryVoucher,
    closingPermanentVoucher,
    nextYearOpeningVoucher,
    financialSummary: {
      grossSales,
      salesReturnsAndDiscounts,
      netSales,
      cogs,
      grossProfit: prof.summary.grossProfit,
      operatingExpenses,
      accessoryExpenses,
      totalExpenses,
      otherIncome,
      netProfit,
      totalAssets: bs.assets.totalAssets,
      totalLiabilities: bs.liabilities.totalLiabilities,
      totalEquity: bs.equity.totalEquity,
    },
  };
}

/**
 * اجرای ممیزی و کنترل‌های ۸ گانه پیش از بستن سال مالی (Pre-Closing Audit)
 */
export function runPreClosingAudit(params: {
  fiscalYear: FiscalYear;
  accounts: AccountingAccount[];
  vouchers: AccountingVoucher[];
  invoices: Invoice[];
  products: Product[];
  persons: Person[];
  treasuryAccounts: TreasuryAccount[];
  treasuryTransactions: TreasuryTransaction[];
  cheques: Cheque[];
  warehouses: Warehouse[];
  warehouseStocks: WarehouseStock[];
  accessoryCosts: AccessoryCostEntry[];
  goodsReceipts?: GoodsReceipt[];
  warehouseTransfers?: WarehouseTransfer[];
  stocktakingSessions?: StocktakingSession[];
  inventoryAdjustments?: InventoryAdjustment[];
}): FiscalPreClosingAudit {
  const {
    fiscalYear,
    accounts,
    vouchers,
    invoices,
    products,
    persons,
    treasuryAccounts,
    treasuryTransactions,
    cheques,
    warehouseStocks,
    accessoryCosts,
    goodsReceipts = [],
    warehouseTransfers = [],
    stocktakingSessions = [],
    inventoryAdjustments = [],
  } = params;

  const fyCode = toEnglishDigits(fiscalYear.code);
  const startDate = normalizePersianDate(fiscalYear.startDate) || `${fyCode}/01/01`;
  const endDate = normalizePersianDate(fiscalYear.endDate) || `${fyCode}/12/29`;

  const nextCode = String((parseInt(fyCode, 10) || 1403) + 1);
  const nextTitle = `سال مالی ${nextCode.replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[+d])}`;
  const nextStartDate = `${nextCode}/01/01`;

  // فیلتر اسناد متعلق به این سال مالی
  const fyVouchers = vouchers.filter(
    (v) =>
      toEnglishDigits(v.fiscalYearId) === fyCode ||
      isDateInRange(v.date, startDate, endDate)
  );
  const fyInvoices = invoices.filter(
    (inv) =>
      toEnglishDigits(inv.fiscalYearId) === fyCode ||
      isDateInRange(inv.date, startDate, endDate)
  );

  const checks: FiscalPreCheckItem[] = [];

  // ۱. کنترل اسناد حسابداری ثبت‌نشده / پیش‌نویس (Draft Vouchers)
  const draftVouchers = fyVouchers.filter((v) => v.status === 'draft');
  checks.push({
    id: 'chk-unposted-vouchers',
    category: 'unposted_docs',
    categoryLabel: 'کنترل اسناد ثبت‌نشده',
    title: 'بررسی عدم وجود سند حسابداری موقت یا پیش‌نویس (Draft Vouchers)',
    severity: draftVouchers.length === 0 ? 'ok' : 'blocking_error',
    passed: draftVouchers.length === 0,
    blocking: draftVouchers.length > 0,
    expectedValue: '۰ سند پیش‌نویس',
    actualValue: `${draftVouchers.length} سند پیش‌نویس`,
    description:
      draftVouchers.length === 0
        ? 'تمامی اسناد حسابداری دوره مالی در وضعیت قطعی یا تایید‌شده قرار دارند.'
        : `تعداد ${draftVouchers.length} سند حسابداری در حالت «پیش‌نویس» باقی مانده است. قبل از بستن سال مالی باید این اسناد را تایید/قطعی یا حذف نمایید.`,
    affectedItems: draftVouchers.map((v) => ({
      id: v.id,
      code: `سند ${v.voucherNumber}`,
      title: v.description,
      amountOrQty: `${v.totalDebit.toLocaleString('fa-IR')} تومان`,
      statusLabel: 'پیش‌نویس (ثبت‌نشده)',
    })),
  });

  // ۲. کنترل فاکتورهای خرید و فروش ثبت‌نشده / پیش‌نویس (به جز پیش‌فاکتورهای اطلاع‌رسانی)
  const draftInvoices = fyInvoices.filter(
    (i) => i.status === 'draft' && i.invoiceType !== 'proforma'
  );
  checks.push({
    id: 'chk-unposted-invoices',
    category: 'unposted_docs',
    categoryLabel: 'کنترل اسناد ثبت‌نشده',
    title: 'بررسی عدم وجود فاکتور خرید یا فروش بلاتکلیف (Draft Invoices)',
    severity: draftInvoices.length === 0 ? 'ok' : 'blocking_error',
    passed: draftInvoices.length === 0,
    blocking: draftInvoices.length > 0,
    expectedValue: '۰ فاکتور پیش‌نویس',
    actualValue: `${draftInvoices.length} فاکتور پیش‌نویس`,
    description:
      draftInvoices.length === 0
        ? 'هیچ فاکتور خرید یا فروش ثبت‌نشده‌ای در این سال مالی وجود ندارد.'
        : `تعداد ${draftInvoices.length} فاکتور عملیاتی در وضعیت پیش‌نویس است که اثر انبار و حسابداری آن‌ها ثبت نهایی نشده است.`,
    affectedItems: draftInvoices.map((inv) => ({
      id: inv.id,
      code: `فاکتور ${inv.invoiceNumber}`,
      title: `${inv.personName} (${inv.invoiceType === 'sale' ? 'فروش' : 'خرید'})`,
      amountOrQty: `${inv.finalAmount.toLocaleString('fa-IR')} تومان`,
      statusLabel: 'پیش‌نویس',
    })),
  });

  // ۳. کنترل اسناد انبار ثبت‌نشده (رسید، انتقال، انبارگردانی، تعدیل)
  const draftReceipts = goodsReceipts.filter(
    (r) => r.status === 'draft' && isDateInRange(r.date, startDate, endDate)
  );
  const draftTransfers = warehouseTransfers.filter(
    (t) => t.status === 'draft' && isDateInRange(t.date, startDate, endDate)
  );
  const draftStocktakings = stocktakingSessions.filter(
    (s) => s.status === 'draft' && isDateInRange(s.date, startDate, endDate)
  );
  const draftAdjustments = inventoryAdjustments.filter(
    (a) => a.status === 'draft' && isDateInRange(a.date, startDate, endDate)
  );
  const totalDraftWarehouseDocs =
    draftReceipts.length + draftTransfers.length + draftStocktakings.length + draftAdjustments.length;

  checks.push({
    id: 'chk-unposted-warehouse-docs',
    category: 'unposted_docs',
    categoryLabel: 'کنترل اسناد ثبت‌نشده',
    title: 'بررسی برگه‌های انبار، رسیدها و جلسات انبارگردانی تاییدنشده',
    severity: totalDraftWarehouseDocs === 0 ? 'ok' : 'blocking_error',
    passed: totalDraftWarehouseDocs === 0,
    blocking: totalDraftWarehouseDocs > 0,
    expectedValue: '۰ برگه پیش‌نویس انبار',
    actualValue: `${totalDraftWarehouseDocs} برگه تاییدنشده`,
    description:
      totalDraftWarehouseDocs === 0
        ? 'کلیه رسیدهای انبار، حواله‌های انتقال، انبارگردانی‌ها و تعدیلات موجودی قطعی شده‌اند.'
        : `تعداد ${totalDraftWarehouseDocs} سند انباری در وضعیت پیش‌نویس قرار دارد و باید پیش از بستن سال تعیین تکلیف شوند.`,
    affectedItems: [
      ...draftReceipts.map((r) => ({
        id: r.id,
        code: r.receiptNumber,
        title: `رسید ورود کالا (${r.supplierName})`,
        amountOrQty: `${r.totalQuantity} واحد`,
        statusLabel: 'رسید پیش‌نویس',
      })),
      ...draftTransfers.map((t) => ({
        id: t.id,
        code: t.transferNumber,
        title: `انتقال از ${t.sourceWarehouseName} به ${t.destinationWarehouseName}`,
        amountOrQty: `${t.totalQuantity} واحد`,
        statusLabel: 'انتقال پیش‌نویس',
      })),
      ...draftStocktakings.map((s) => ({
        id: s.id,
        code: s.code,
        title: s.title,
        amountOrQty: `${s.totalItemsCount} قلم`,
        statusLabel: 'انبارگردانی پیش‌نویس',
      })),
      ...draftAdjustments.map((a) => ({
        id: a.id,
        code: a.adjustmentNumber,
        title: a.reasonTitle,
        amountOrQty: `${a.totalQuantity} واحد`,
        statusLabel: 'تعدیل پیش‌نویس',
      })),
    ],
  });

  // ۴. کنترل توازن اسناد حسابداری و تراز آزمایشی (Double-Entry & Trial Balance)
  const unbalancedVouchers = fyVouchers.filter((v) => {
    const val = validateDoubleEntryVoucher(v.lines);
    return !val.isBalanced || v.totalDebit !== v.totalCredit;
  });
  const tb = generateTrialBalance(fyVouchers, accounts, 'general');
  const isTrialBalanced = tb.isTurnoverBalanced && tb.isClosingBalanced && unbalancedVouchers.length === 0;

  checks.push({
    id: 'chk-voucher-and-trial-equilibrium',
    category: 'voucher_equilibrium',
    categoryLabel: 'توازن حسابداری و تراز آزمایشی',
    title: 'کنترل توازن بدهکار و بستانکار اسناد روزنامه و تراز آزمایشی کل',
    severity: isTrialBalanced ? 'ok' : 'blocking_error',
    passed: isTrialBalanced,
    blocking: !isTrialBalanced,
    expectedValue: `برابری کامل بدهکار و بستانکار (اختلاف: ۰)`,
    actualValue: isTrialBalanced
      ? `تراز کامل (گردش: ${tb.totalTurnoverDebit.toLocaleString('fa-IR')} تومان)`
      : `${unbalancedVouchers.length} سند نامتوازن`,
    description: isTrialBalanced
      ? 'کلیه اسناد حسابداری دوره متوازن بوده و جمع بدهکار و بستانکار تراز آزمایشی ۱۰۰٪ منطبق است.'
      : 'در اسناد حسابداری یا تراز آزمایشی عدم توازن بدهکار و بستانکار مشاهده شد.',
    affectedItems: unbalancedVouchers.map((v) => ({
      id: v.id,
      code: `سند ${v.voucherNumber}`,
      title: v.description,
      amountOrQty: `بدهکار: ${v.totalDebit.toLocaleString('fa-IR')} | بستانکار: ${v.totalCredit.toLocaleString('fa-IR')}`,
      statusLabel: 'نامتوازن',
    })),
  });

  // ۵. بررسی مانده اشخاص (بدهکاران و بستانکاران) و کنترل سقف اعتبار
  const debtors = persons.filter((p) => (Number(p.currentBalance) || 0) > 0);
  const creditors = persons.filter((p) => (Number(p.currentBalance) || 0) < 0);
  const totalReceivables = debtors.reduce((s, p) => s + p.currentBalance, 0);
  const totalPayables = creditors.reduce((s, p) => s + Math.abs(p.currentBalance), 0);
  const overCreditPersons = debtors.filter((p) => p.creditLimit > 0 && p.currentBalance > p.creditLimit);

  checks.push({
    id: 'chk-persons-balances',
    category: 'persons',
    categoryLabel: 'بررسی مانده اشخاص',
    title: 'بررسی مانده تفصیلی بدهکاران و بستانکاران جهت انتقال به سال جدید',
    severity: overCreditPersons.length > 0 ? 'warning' : 'ok',
    passed: true,
    blocking: false,
    expectedValue: `تطبیق کامل مانده اشخاص (${debtors.length} بدهکار، ${creditors.length} بستانکار)`,
    actualValue: `مطالبات: ${totalReceivables.toLocaleString('fa-IR')} | بدهی‌ها: ${totalPayables.toLocaleString('fa-IR')} تومان`,
    description:
      overCreditPersons.length > 0
        ? `مانده حساب کلیه اشخاص آماده انتقال به سال بعد است، اما ${overCreditPersons.length} مشتری بالاتر از سقف اعتبار مجاز بدهی دارند (هشدار کنترلی).`
        : `مانده تفصیلی ${debtors.length} بدهکار و ${creditors.length} بستانکار با سرفصل‌های دریافتنی (۱۰۳) و پرداختنی (۲۰۱) منطبق و آماده انتقال به سال بعد است.`,
    affectedItems: [
      ...debtors.map((d) => ({
        id: d.id,
        code: d.code,
        title: `${d.name} (بدهکار انتقالی)`,
        amountOrQty: `${d.currentBalance.toLocaleString('fa-IR')} تومان`,
        statusLabel:
          d.creditLimit > 0 && d.currentBalance > d.creditLimit
            ? 'عبور از سقف اعتبار'
            : 'تایید جهت انتقال',
      })),
      ...creditors.map((c) => ({
        id: c.id,
        code: c.code,
        title: `${c.name} (بستانکار انتقالی)`,
        amountOrQty: `${Math.abs(c.currentBalance).toLocaleString('fa-IR')} تومان`,
        statusLabel: 'تایید جهت انتقال',
      })),
    ],
  });

  // ۶. بررسی مانده صندوق، بانک و کارتخوان‌ها
  const negativeTreasury = treasuryAccounts.filter((a) => (Number(a.balance) || 0) < 0);
  const cashBalance = treasuryAccounts
    .filter((a) => a.type === 'cash')
    .reduce((s, a) => s + a.balance, 0);
  const bankBalance = treasuryAccounts
    .filter((a) => a.type === 'bank')
    .reduce((s, a) => s + a.balance, 0);
  const posBalance = treasuryAccounts
    .filter((a) => a.type === 'pos')
    .reduce((s, a) => s + a.balance, 0);
  const totalTreasuryBalance = cashBalance + bankBalance + posBalance;

  checks.push({
    id: 'chk-treasury-balances',
    category: 'treasury_cheques',
    categoryLabel: 'بررسی صندوق، بانک و چک‌ها',
    title: 'کنترل سلامت مانده صندوق‌ها، حساب‌های بانکی و کارتخوان‌ها',
    severity: negativeTreasury.length === 0 ? 'ok' : 'blocking_error',
    passed: negativeTreasury.length === 0,
    blocking: negativeTreasury.length > 0,
    expectedValue: 'مانده غیرمنفی در تمام حساب‌های خزانه',
    actualValue:
      negativeTreasury.length === 0
        ? `جمع نقد و بانک: ${totalTreasuryBalance.toLocaleString('fa-IR')} تومان`
        : `${negativeTreasury.length} حساب دارای مانده منفی`,
    description:
      negativeTreasury.length === 0
        ? `مانده صندوق (${cashBalance.toLocaleString('fa-IR')})، بانک (${bankBalance.toLocaleString('fa-IR')}) و کارتخوان (${posBalance.toLocaleString('fa-IR')} تومان) صحیح و آماده انتقال به افتتاحیه سال جدید است.`
        : 'مانده صندوق یا حساب بانکی نمی‌تواند در پایان سال مالی منفی (بستانکار) باشد.',
    affectedItems: treasuryAccounts.map((a) => ({
      id: a.id,
      code: a.accountingAccountCode || '101',
      title: a.title,
      amountOrQty: `${a.balance.toLocaleString('fa-IR')} تومان`,
      statusLabel: a.balance < 0 ? 'مانده منفی (خطا)' : 'آماده انتقال به سال بعد',
    })),
  });

  // ۷. بررسی چک‌های دریافتی و پرداختی در جریان جهت انتقال به سال بعد
  const pendingReceivedCheques = cheques.filter(
    (c) =>
      c.chequeType === 'received' &&
      (c.status === 'registered' || c.status === 'deposited' || c.status === 'in_process')
  );
  const pendingIssuedCheques = cheques.filter(
    (c) =>
      c.chequeType === 'issued' &&
      (c.status === 'registered' || c.status === 'deposited' || c.status === 'in_process')
  );
  const pendingRecAmount = pendingReceivedCheques.reduce((s, c) => s + c.amount, 0);
  const pendingIssAmount = pendingIssuedCheques.reduce((s, c) => s + c.amount, 0);
  const totalPendingChequesCount = pendingReceivedCheques.length + pendingIssuedCheques.length;

  checks.push({
    id: 'chk-pending-cheques-rollover',
    category: 'treasury_cheques',
    categoryLabel: 'بررسی صندوق، بانک و چک‌ها',
    title: 'بررسی چک‌های صیادی در جریان وصول و سررسید نشده (انتقالی به سال جدید)',
    severity: totalPendingChequesCount > 0 ? 'warning' : 'ok',
    passed: true,
    blocking: false,
    expectedValue: 'انتقال خودکار چک‌های تعیین‌تکلیف‌نشده به سال بعد',
    actualValue: `${pendingReceivedCheques.length} چک دریافتی (${pendingRecAmount.toLocaleString('fa-IR')}) و ${pendingIssuedCheques.length} چک پرداختی (${pendingIssAmount.toLocaleString('fa-IR')} تومان)`,
    description:
      totalPendingChequesCount > 0
        ? `تعداد ${totalPendingChequesCount} فقره چک صیادی در وضعیت نزد صندوق یا در جریان وصول قرار دارند که عیناً در اسناد دریافتنی (۱۰۲) و پرداختنی (۲۰۲) به سال مالی بعد منتقل می‌شوند.`
        : 'تمامی چک‌های دوره تعیین تکلیف شده‌اند.',
    affectedItems: [...pendingReceivedCheques, ...pendingIssuedCheques].map((c) => ({
      id: c.id,
      code: `چک ${c.chequeNumber}`,
      title: `${c.chequeType === 'received' ? 'دریافتی از' : 'صادره به'} ${c.personName} (${c.bankName})`,
      amountOrQty: `${c.amount.toLocaleString('fa-IR')} تومان - سررسید ${c.dueDate}`,
      statusLabel: 'انتقال به سال بعد',
    })),
  });

  // ۸. بررسی موجودی انبارها، عدم وجود موجودی منفی و تطبیق کاردکس
  const negativeProducts = products.filter((p) => (Number(p.currentStock) || 0) < 0);
  const totalEndingInventoryValue = products.reduce(
    (s, p) => s + Math.max(0, Number(p.currentStock) || 0) * (Number(p.purchasePrice) || 0),
    0
  );

  // بررسی تطبیق موجودی کل کالا با جمع موجودی انبارهای تفکیکی
  const stockMismatchProducts = products.filter((p) => {
    const whEntries = warehouseStocks.filter((ws) => ws.productId === p.id);
    if (whEntries.length === 0) return false;
    const sumWh = whEntries.reduce((s, ws) => s + ws.quantity, 0);
    return Math.abs(sumWh - p.currentStock) > 0.001;
  });

  const inventoryPassed = negativeProducts.length === 0 && stockMismatchProducts.length === 0;

  checks.push({
    id: 'chk-inventory-reconciliation',
    category: 'inventory',
    categoryLabel: 'بررسی موجودی انبار',
    title: 'کنترل موجودی پایان دوره کالاها، عدم موجودی منفی و تطبیق انبارها',
    severity: inventoryPassed ? 'ok' : 'blocking_error',
    passed: inventoryPassed,
    blocking: !inventoryPassed,
    expectedValue: `موجودی غیرمنفی و منطبق در ${products.length} قلم کالا`,
    actualValue: inventoryPassed
      ? `ارزش موجودی پایان دوره: ${totalEndingInventoryValue.toLocaleString('fa-IR')} تومان (${products.length} کالا)`
      : `${negativeProducts.length} کالای منفی / ${stockMismatchProducts.length} مغایرت انبار`,
    description: inventoryPassed
      ? `موجودی تمامی ${products.length} قلم کالای خرازی غیرمنفی بوده و ارزش ریالی پایان دوره (${totalEndingInventoryValue.toLocaleString('fa-IR')} تومان) آماده انتقال به موجودی اول دوره سال جدید است.`
      : 'برخی کالاها دارای موجودی منفی یا مغایرت بین موجودی کل و انبارهای تفکیکی هستند که باید قبل از بستن سال اصلاح شوند.',
    affectedItems: products.slice(0, 8).map((p) => ({
      id: p.id,
      code: p.code,
      title: p.name,
      amountOrQty: `${p.currentStock} ${p.baseUnitName || 'عدد'} (${(p.currentStock * p.purchasePrice).toLocaleString('fa-IR')} تومان)`,
      statusLabel: p.currentStock < 0 ? 'موجودی منفی (خطا)' : 'آماده انتقال به سال بعد',
    })),
  });

  // تولید پیش‌نمایش اسناد اختتامیه و افتتاحیه
  const previewVouchers = generateClosingAndRolloverVouchers({
    closingFiscalYear: fiscalYear,
    nextFiscalYearCode: nextCode,
    nextFiscalYearTitle: nextTitle,
    nextFiscalYearStartDate: nextStartDate,
    accounts,
    vouchers,
    invoices,
    products,
    persons,
    treasuryAccounts,
    treasuryTransactions,
    cheques,
    accessoryCosts,
  });

  const blockingErrorsCount = checks.filter((c) => c.blocking && !c.passed).length;
  const warningsCount = checks.filter((c) => c.severity === 'warning').length;
  const passedChecksCount = checks.filter((c) => c.passed).length;

  return {
    fiscalYearId: fiscalYear.id,
    fiscalYearCode: fiscalYear.code,
    fiscalYearTitle: fiscalYear.title,
    canClose: blockingErrorsCount === 0 && !fiscalYear.isClosed,
    blockingErrorsCount,
    warningsCount,
    passedChecksCount,
    totalChecksCount: checks.length,
    summary: {
      draftVouchersCount: draftVouchers.length,
      draftInvoicesCount: draftInvoices.length,
      draftWarehouseDocsCount: totalDraftWarehouseDocs,
      unbalancedVouchersCount: unbalancedVouchers.length,
      debtorsCount: debtors.length,
      totalReceivables,
      creditorsCount: creditors.length,
      totalPayables,
      cashBalance,
      bankBalance,
      posBalance,
      totalTreasuryBalance,
      pendingReceivedChequesCount: pendingReceivedCheques.length,
      pendingReceivedChequesAmount: pendingRecAmount,
      pendingIssuedChequesCount: pendingIssuedCheques.length,
      pendingIssuedChequesAmount: pendingIssAmount,
      totalProductsCount: products.length,
      negativeStockProductsCount: negativeProducts.length,
      totalEndingInventoryValue,
      netSales: previewVouchers.financialSummary.netSales,
      cogs: previewVouchers.financialSummary.cogs,
      grossProfit: previewVouchers.financialSummary.grossProfit,
      totalExpenses: previewVouchers.financialSummary.totalExpenses,
      otherIncome: previewVouchers.financialSummary.otherIncome,
      netProfit: previewVouchers.financialSummary.netProfit,
      totalAssets: previewVouchers.financialSummary.totalAssets,
      totalLiabilities: previewVouchers.financialSummary.totalLiabilities,
      totalEquity: previewVouchers.financialSummary.totalEquity,
    },
    checks,
    previewVouchers: {
      closingTemporaryVoucher: previewVouchers.closingTemporaryVoucher,
      closingPermanentVoucher: previewVouchers.closingPermanentVoucher,
      nextYearOpeningVoucher: previewVouchers.nextYearOpeningVoucher,
    },
  };
}

/**
 * ساخت اسنپ‌شات آرشیوی کامل و تغییرناپذیر از وضعیت سال مالی در لحظه بستن
 */
export function buildFiscalYearArchiveSnapshot(params: {
  fiscalYear: FiscalYear;
  capturedBy: string;
  vouchers: AccountingVoucher[];
  invoices: Invoice[];
  products: Product[];
  persons: Person[];
  treasuryAccounts: TreasuryAccount[];
  cheques: Cheque[];
  financialSummary: {
    netSales: number;
    cogs: number;
    grossProfit: number;
    totalExpenses: number;
    otherIncome: number;
    netProfit: number;
    totalAssets: number;
    totalLiabilities: number;
    totalEquity: number;
  };
}): FiscalYearArchiveSnapshot {
  const {
    fiscalYear,
    capturedBy,
    vouchers,
    invoices,
    products,
    persons,
    treasuryAccounts,
    cheques,
    financialSummary,
  } = params;

  const fyCode = toEnglishDigits(fiscalYear.code);
  const startDate = normalizePersianDate(fiscalYear.startDate) || `${fyCode}/01/01`;
  const endDate = normalizePersianDate(fiscalYear.endDate) || `${fyCode}/12/29`;

  const fyVouchers = vouchers.filter(
    (v) =>
      toEnglishDigits(v.fiscalYearId) === fyCode ||
      isDateInRange(v.date, startDate, endDate)
  );
  const fyInvoices = invoices.filter(
    (inv) =>
      toEnglishDigits(inv.fiscalYearId) === fyCode ||
      isDateInRange(inv.date, startDate, endDate)
  );

  const cashAndBankBalance = treasuryAccounts.reduce((s, a) => s + a.balance, 0);
  const accountsReceivable = persons
    .filter((p) => p.currentBalance > 0)
    .reduce((s, p) => s + p.currentBalance, 0);
  const accountsPayable = persons
    .filter((p) => p.currentBalance < 0)
    .reduce((s, p) => s + Math.abs(p.currentBalance), 0);
  const pendingCheques = cheques.filter(
    (c) => c.status === 'registered' || c.status === 'deposited' || c.status === 'in_process'
  );
  const notesReceivable = pendingCheques
    .filter((c) => c.chequeType === 'received')
    .reduce((s, c) => s + c.amount, 0);
  const notesPayable = pendingCheques
    .filter((c) => c.chequeType === 'issued')
    .reduce((s, c) => s + c.amount, 0);
  const inventoryValuation = products.reduce(
    (s, p) => s + Math.max(0, p.currentStock) * p.purchasePrice,
    0
  );

  return {
    capturedAt: endDate,
    capturedBy,
    summary: {
      ...financialSummary,
      cashAndBankBalance,
      accountsReceivable,
      notesReceivable,
      inventoryValuation,
      accountsPayable,
      notesPayable,
      invoicesCount: fyInvoices.length,
      vouchersCount: fyVouchers.length,
    },
    personBalances: persons
      .filter((p) => p.currentBalance !== 0)
      .map((p) => ({
        personId: p.id,
        code: p.code,
        name: p.name,
        personType: p.personType,
        balance: p.currentBalance,
      })),
    treasuryBalances: treasuryAccounts.map((a) => ({
      accountId: a.id,
      title: a.title,
      type: a.type,
      balance: a.balance,
    })),
    inventoryBalances: products.map((p) => ({
      productId: p.id,
      code: p.code,
      name: p.name,
      unitName: p.baseUnitName || 'عدد',
      quantity: p.currentStock,
      unitCost: p.purchasePrice,
      totalValuation: p.currentStock * p.purchasePrice,
    })),
    pendingCheques: pendingCheques.map((c) => ({
      chequeId: c.id,
      chequeNumber: c.chequeNumber,
      chequeType: c.chequeType,
      personName: c.personName,
      bankName: c.bankName,
      dueDate: c.dueDate,
      amount: c.amount,
      status: c.status,
    })),
    vouchers: JSON.parse(JSON.stringify(fyVouchers)),
    invoices: JSON.parse(JSON.stringify(fyInvoices)),
  };
}

/**
 * اجرای تست کامل و خودکار انتقال سال مالی با داده آزمایشی (End-to-End Fiscal Year Rollover Test)
 */
export interface FiscalRolloverSimulationStep {
  stepNumber: number;
  title: string;
  passed: boolean;
  expected: string;
  actual: string;
  details: string;
}

export interface FiscalRolloverSimulationResult {
  allPassed: boolean;
  totalSteps: number;
  passedSteps: number;
  executedAt: string;
  steps: FiscalRolloverSimulationStep[];
  sampleDataSummary: {
    closedYearCode: string;
    newYearCode: string;
    transferredCashAndBank: number;
    transferredReceivables: number;
    transferredPayables: number;
    transferredInventoryValuation: number;
    closedYearNetProfit: number;
    closingTempVoucherTotal: number;
    closingPermVoucherTotal: number;
    openingNewYearVoucherTotal: number;
  };
}

export function runFiscalRolloverSimulationTest(): FiscalRolloverSimulationResult {
  const steps: FiscalRolloverSimulationStep[] = [];

  // ۱. تعریف سال مالی آزمایشی ۱۴۰۳ و بررسی اعتبارسنجی
  const fy1403: FiscalYear = {
    id: 'fy-test-1403',
    code: '1403',
    title: 'سال مالی آزمایشی ۱۴۰۳',
    startDate: '1403/01/01',
    endDate: '1403/12/30',
    status: 'open',
    isClosed: false,
    isActive: true,
    isLeapYear: true,
    auditTrail: [],
    createdBy: 'سیستم تست',
    createdAt: '1403/01/01',
  };

  const defValidation = validateFiscalYearDefinition(
    {
      code: '1404',
      title: 'سال مالی آزمایشی ۱۴۰۴',
      startDate: '1404/01/01',
      endDate: '1404/12/29',
    },
    [fy1403]
  );

  const dupValidation = validateFiscalYearDefinition(
    {
      code: '1403',
      title: 'سال تکراری ۱۴۰۳',
      startDate: '1403/01/01',
      endDate: '1403/12/29',
    },
    [fy1403]
  );

  steps.push({
    stepNumber: 1,
    title: 'تعریف سال مالی شمسی، تشخیص کبیسه و جلوگیری از هم‌پوشانی تاریخ',
    passed: defValidation.isValid === true && dupValidation.isValid === false && isShamsiLeapYear(1403) === true,
    expected: 'سال ۱۴۰۴ معتبر، سال کبیسه ۱۴۰۳ شناسایی‌شده، کد تکراری مسدود',
    actual: `معتبر: ${defValidation.isValid} | کبیسه ۱۴۰۳: ${isShamsiLeapYear(1403)} | مسدودی تکراری: ${!dupValidation.isValid}`,
    details: 'اعتبارسنجی کد ۴ رقمی، بازه تاریخ شمسی، سال کبیسه و عدم تکرار دوره مالی با موفقیت انجام شد.',
  });

  // ۲. آماده‌سازی داده‌های آزمایشی (صندوق، بانک، اشخاص، کالاها) و ثبت سند افتتاحیه ۱۴۰۳
  const testTreasury: TreasuryAccount[] = [
    { id: 't-cash', type: 'cash', title: 'صندوق نقدی آزمایشی', initialBalance: 20000000, balance: 20000000, accountingAccountCode: '10101', isActive: true },
    { id: 't-bank', type: 'bank', title: 'بانک ملت آزمایشی', initialBalance: 80000000, balance: 80000000, accountingAccountCode: '10102', isActive: true },
  ];

  const testPersons: Person[] = [
    { id: 'p-cust-1', code: 'C-01', name: 'مزون ابریشم (مشتری بدهکار)', personType: 'customer', mobile: '09121111111', creditLimit: 50000000, currentBalance: 15000000, isActive: true, createdAt: '1403/01/01' },
    { id: 'p-supp-1', code: 'S-01', name: 'بنکداری نخ و زیپ رازی (بستانکار)', personType: 'supplier', mobile: '09122222222', creditLimit: 0, currentBalance: -25000000, isActive: true, createdAt: '1403/01/01' },
  ];

  const testProducts: Product[] = [
    {
      id: 'prd-1',
      code: 'K-101',
      barcode: '626001',
      name: 'روبان ساتن طلایی ۴ سانت',
      categoryId: 'cat-1',
      baseUnitId: 'u-meter',
      baseUnitName: 'متر',
      purchasePrice: 10000,
      retailPrice: 18000,
      wholesalePrice: 15000,
      minAllowedPrice: 14000,
      allowDecimal: true,
      unitConversions: [],
      currentStock: 3000, // 3000 * 10,000 = 30,000,000 تومان
      minStockAlert: 200,
      isActive: true,
      createdAt: '1403/01/01',
      updatedAt: '1403/01/01',
    },
  ];

  const openPayload1403: OpeningBalancePayload = {
    fiscalYearId: fy1403.id,
    date: '1403/01/01',
    treasuryBalances: [
      { accountId: 't-cash', amount: 20000000 },
      { accountId: 't-bank', amount: 80000000 },
    ],
    personBalances: [
      { personId: 'p-cust-1', balance: 15000000 },
      { personId: 'p-supp-1', balance: -25000000 },
    ],
    inventoryBalances: [
      { productId: 'prd-1', quantity: 3000, unitPurchasePrice: 10000 },
    ],
  };

  // دارایی‌های اول دوره: نقد و بانک (100M) + بدهکاران (15M) + موجودی کالا (30M) = 145,000,000
  // بدهی اول دوره: بستانکاران (25M) => سرمایه اولیه خودکار: 120,000,000
  const openVoucher1403 = generateOpeningBalanceVoucherFromPayload(
    openPayload1403,
    fy1403,
    testTreasury,
    testPersons,
    testProducts,
    '1001'
  );

  steps.push({
    stepNumber: 2,
    title: 'ثبت مانده‌های افتتاحیه و صدور سند افتتاحیه متوازن (دارایی = بدهی + سرمایه)',
    passed:
      openVoucher1403.isBalanced &&
      openVoucher1403.totalDebit === 145000000 &&
      openVoucher1403.totalCredit === 145000000,
    expected: 'جمع بدهکار و بستانکار سند افتتاحیه: ۱۴۵,۰۰۰,۰۰۰ تومان (سرمایه: ۱۲۰,۰۰۰,۰۰۰ تومان)',
    actual: `بدهکار: ${openVoucher1403.totalDebit.toLocaleString('fa-IR')} | بستانکار: ${openVoucher1403.totalCredit.toLocaleString('fa-IR')} تومان`,
    details: 'سند افتتاحیه شامل ۱۰۰ میلیون نقد و بانک، ۱۵ میلیون طلب، ۳۰ میلیون موجودی کالا، ۲۵ میلیون بدهی و ۱۲۰ میلیون سرمایه اولیه صادر شد.',
  });

  // ۳. شبیه‌سازی عملیات طی دوره ۱۴۰۳ (فروش، هزینه، دریافت) + یک سند پیش‌نویس جهت تست خطای مسدودکننده
  // فروش ۱۰۰۰ متر روبان به قیمت ۱۸,۰۰۰ تومان = ۱۸,۰۰۰,۰۰۰ تومان (نقد به بانک ملت)
  // بهای تمام‌شده (COGS): ۱۰۰۰ * ۱۰,۰۰۰ = ۱۰,۰۰۰,۰۰۰ تومان -> موجودی پایان دوره: ۲۰۰۰ متر (۲۰,۰۰۰,۰۰۰ تومان)
  // هزینه عملیاتی از صندوق: ۲,۰۰۰,۰۰۰ تومان -> صندوق پایان دوره: ۱۸,۰۰۰,۰۰۰ تومان، بانک ملت: ۹۸,۰۰۰,۰۰۰ تومان
  testProducts[0].currentStock = 2000; // پس از فروش ۱۰۰۰ متر
  testTreasury[0].balance = 18000000; // ۲۰M - ۲M هزینه
  testTreasury[1].balance = 98000000; // ۸۰M + ۱۸M فروش

  const testInvoices: Invoice[] = [
    {
      id: 'inv-sim-1',
      invoiceNumber: 'S-1403-01',
      invoiceType: 'sale',
      personId: 'p-cust-1',
      personName: 'مزون ابریشم',
      fiscalYearId: '1403',
      date: '1403/06/15',
      status: 'approved',
      items: [
        {
          id: 'it-1',
          productId: 'prd-1',
          productCode: 'K-101',
          productName: 'روبان ساتن طلایی ۴ سانت',
          unitId: 'u-meter',
          unitName: 'متر',
          conversionFactor: 1,
          quantity: 1000,
          baseQuantity: 1000,
          unitPrice: 18000,
          discount: 0,
          tax: 0,
          totalPrice: 18000000,
        },
      ],
      subtotal: 18000000,
      totalDiscount: 0,
      taxAmount: 0,
      finalAmount: 18000000,
      paidAmount: 18000000,
      remainingAmount: 0,
      createdBy: 'سیستم تست',
      createdAt: '1403/06/15',
    },
  ];

  const testTreasuryTxs: TreasuryTransaction[] = [
    {
      id: 'tx-sim-1',
      transactionType: 'receive',
      treasuryAccountId: 't-bank',
      treasuryAccountTitle: 'بانک ملت آزمایشی',
      amount: 18000000,
      date: '1403/06/15',
      description: 'دریافت وجه فاکتور فروش S-1403-01',
      createdBy: 'سیستم تست',
      createdAt: '1403/06/15',
    },
    {
      id: 'tx-sim-2',
      transactionType: 'expense',
      treasuryAccountId: 't-cash',
      treasuryAccountTitle: 'صندوق نقدی آزمایشی',
      amount: 2000000,
      date: '1403/08/10',
      description: 'هزینه قبوض و ملزومات بسته‌بندی',
      createdBy: 'سیستم تست',
      createdAt: '1403/08/10',
    },
  ];

  const saleVoucher: AccountingVoucher = {
    id: 'vch-sim-sale',
    voucherNumber: '1002',
    date: '1403/06/15',
    description: 'سند فروش فاکتور S-1403-01',
    fiscalYearId: '1403',
    status: 'approved',
    referenceType: 'sale_invoice',
    lines: [
      { id: 'l-s1', accountCode: '10102', accountTitle: 'بانک ملت آزمایشی', debit: 18000000, credit: 0 },
      { id: 'l-s2', accountCode: '401', accountTitle: 'فروش کالا', debit: 0, credit: 18000000 },
    ],
    totalDebit: 18000000,
    totalCredit: 18000000,
    isBalanced: true,
    createdBy: 'سیستم تست',
    createdAt: '1403/06/15',
  };

  const expenseVoucher: AccountingVoucher = {
    id: 'vch-sim-exp',
    voucherNumber: '1003',
    date: '1403/08/10',
    description: 'سند هزینه بسته‌بندی',
    fiscalYearId: '1403',
    status: 'approved',
    referenceType: 'treasury',
    lines: [
      { id: 'l-e1', accountCode: '601', accountTitle: 'هزینه‌های عمومی و اداری', debit: 2000000, credit: 0 },
      { id: 'l-e2', accountCode: '10101', accountTitle: 'صندوق نقدی آزمایشی', debit: 0, credit: 2000000 },
    ],
    totalDebit: 2000000,
    totalCredit: 2000000,
    isBalanced: true,
    createdBy: 'سیستم تست',
    createdAt: '1403/08/10',
  };

  const draftTestVoucher: AccountingVoucher = {
    id: 'vch-sim-draft',
    voucherNumber: '1004',
    date: '1403/11/20',
    description: 'سند موقت ثبت‌نشده آزمایشی',
    fiscalYearId: '1403',
    status: 'draft', // پیش‌نویس! باید مانع بستن سال شود
    referenceType: 'manual',
    lines: [
      { id: 'l-d1', accountCode: '601', accountTitle: 'هزینه', debit: 500000, credit: 0 },
      { id: 'l-d2', accountCode: '10101', accountTitle: 'صندوق', debit: 0, credit: 500000 },
    ],
    totalDebit: 500000,
    totalCredit: 500000,
    isBalanced: true,
    createdBy: 'سیستم تست',
    createdAt: '1403/11/20',
  };

  const testAccounts: AccountingAccount[] = [
    { id: 'a-101', code: '101', title: 'موجودی نقد و بانک', level: 'general', type: 'asset', balance: 116000000, isActive: true },
    { id: 'a-103', code: '103', title: 'حساب‌های دریافتنی تجاری', level: 'general', type: 'asset', balance: 15000000, isActive: true },
    { id: 'a-104', code: '104', title: 'موجودی کالای انبار', level: 'general', type: 'asset', balance: 20000000, isActive: true },
    { id: 'a-201', code: '201', title: 'حساب‌های پرداختنی تجاری', level: 'general', type: 'liability', balance: 25000000, isActive: true },
    { id: 'a-301', code: '301', title: 'سرمایه اولیه', level: 'general', type: 'equity', balance: 120000000, isActive: true },
    { id: 'a-302', code: '302', title: 'سود و زیان انباشته', level: 'general', type: 'equity', balance: 0, isActive: true },
    { id: 'a-401', code: '401', title: 'فروش کالا', level: 'general', type: 'revenue', balance: 18000000, isActive: true },
    { id: 'a-501', code: '501', title: 'بهای تمام‌شده کالای فروش‌رفته', level: 'general', type: 'expense', balance: 10000000, isActive: true },
    { id: 'a-601', code: '601', title: 'هزینه‌های عمومی و اداری', level: 'general', type: 'expense', balance: 2000000, isActive: true },
  ];

  const auditWithDraft = runPreClosingAudit({
    fiscalYear: fy1403,
    accounts: testAccounts,
    vouchers: [openVoucher1403, saleVoucher, expenseVoucher, draftTestVoucher],
    invoices: testInvoices,
    products: testProducts,
    persons: testPersons,
    treasuryAccounts: testTreasury,
    treasuryTransactions: testTreasuryTxs,
    cheques: [],
    warehouses: [{ id: 'wh-1', code: '01', name: 'انبار مرکزی', type: 'central', location: 'تهران', isActive: true, createdAt: '1403/01/01' }],
    warehouseStocks: [{ productId: 'prd-1', warehouseId: 'wh-1', quantity: 2000, lastUpdated: '1403/06/15' }],
    accessoryCosts: [],
  });

  steps.push({
    stepNumber: 3,
    title: 'کنترل اسناد ثبت‌نشده (پیش‌نویس) و جلوگیری خودکار از بستن سال در صورت وجود مغایرت',
    passed: auditWithDraft.canClose === false && auditWithDraft.blockingErrorsCount === 1 && auditWithDraft.summary.draftVouchersCount === 1,
    expected: 'مسدود شدن بستن سال (canClose: false) به علت وجود ۱ سند پیش‌نویس',
    actual: `امکان بستن: ${auditWithDraft.canClose} | خطاهای مسدودکننده: ${auditWithDraft.blockingErrorsCount} (سند پیش‌نویس: ${auditWithDraft.summary.draftVouchersCount})`,
    details: 'موتور کنترلی پیش از بستن سال، سند پیش‌نویس شماره ۱۰۰۴ را شناسایی کرد و مانع بستن ناقص سال مالی شد.',
  });

  // ۴. تعیین تکلیف سند پیش‌نویس و اجرای مجدد ممیزی پیش از بستن سال
  const cleanVouchers = [openVoucher1403, saleVoucher, expenseVoucher];
  const auditClean = runPreClosingAudit({
    fiscalYear: fy1403,
    accounts: testAccounts,
    vouchers: cleanVouchers,
    invoices: testInvoices,
    products: testProducts,
    persons: testPersons,
    treasuryAccounts: testTreasury,
    treasuryTransactions: testTreasuryTxs,
    cheques: [],
    warehouses: [{ id: 'wh-1', code: '01', name: 'انبار مرکزی', type: 'central', location: 'تهران', isActive: true, createdAt: '1403/01/01' }],
    warehouseStocks: [{ productId: 'prd-1', warehouseId: 'wh-1', quantity: 2000, lastUpdated: '1403/06/15' }],
    accessoryCosts: [],
  });

  steps.push({
    stepNumber: 4,
    title: 'تایید ۸ چک‌لیست کنترلی پس از تعیین تکلیف اسناد پیش‌نویس (تراز، اشخاص، خزانه، انبار)',
    passed: auditClean.canClose === true && auditClean.blockingErrorsCount === 0 && auditClean.passedChecksCount === 8,
    expected: 'تایید هر ۸ کنترل پیش‌نیاز و مجاز شدن بستن سال (canClose: true)',
    actual: `امکان بستن: ${auditClean.canClose} | کنترل‌های موفق: ${auditClean.passedChecksCount} از ${auditClean.totalChecksCount}`,
    details: 'کلیه کنترل‌های توازن دفتر روزنامه، تراز آزمایشی، مانده اشخاص، مانده نقد و بانک و موجودی انبار تایید شدند.',
  });

  // ۵. بررسی سند بستن حساب‌های موقت (سود و زیان ۱۴۰۳)
  // فروش: 18,000,000 | بهای تمام‌شده: 10,000,000 | هزینه: 2,000,000 => سود خالص: 6,000,000
  const tempCloseVch = auditClean.previewVouchers.closingTemporaryVoucher;
  steps.push({
    stepNumber: 5,
    title: 'صدور سند بستن حساب‌های موقت و انتقال سود خالص به سود انباشته (۳۰۲)',
    passed:
      tempCloseVch.isBalanced &&
      tempCloseVch.totalDebit === 18000000 &&
      tempCloseVch.totalCredit === 18000000 &&
      auditClean.summary.netProfit === 6000000,
    expected: 'فروش ۱۸M بدهکار | COGS ۱۰M + هزینه ۲M + سود انباشته ۶M بستانکار (تراز ۱۸,۰۰۰,۰۰۰ تومان)',
    actual: `سود خالص: ${auditClean.summary.netProfit.toLocaleString('fa-IR')} | تراز سند موقت: ${tempCloseVch.totalDebit.toLocaleString('fa-IR')} تومان`,
    details: 'حساب‌های موقت فروش (۴۰۱)، بهای تمام‌شده (۵۰۱) و هزینه‌ها (۶۰۱) صفر شده و ۶,۰۰۰,۰۰۰ تومان سود خالص به حساب ۳۰۲ منتقل شد.',
  });

  // ۶. بررسی سند اختتامیه دائمی ۱۴۰۳ و سند افتتاحیه ۱۴۰۴
  // دارایی‌های پایان ۱۴۰۳: صندوق (18M) + بانک ملت (98M) + بدهکاران (15M) + موجودی کالا (20M) = 151,000,000 تومان
  // بدهی و حقوق صاحبان سهام پایان ۱۴۰۳: بستانکاران (25M) + سرمایه اولیه (120M) + سود انباشته (6M) = 151,000,000 تومان
  const permCloseVch = auditClean.previewVouchers.closingPermanentVoucher;
  const nextOpenVch = auditClean.previewVouchers.nextYearOpeningVoucher;

  steps.push({
    stepNumber: 6,
    title: 'صدور سند اختتامیه ۱۴۰۳ و تطبیق ۱۰۰٪ با سند افتتاحیه سال مالی ۱۴۰۴',
    passed:
      permCloseVch.isBalanced &&
      nextOpenVch.isBalanced &&
      permCloseVch.totalDebit === 151000000 &&
      nextOpenVch.totalDebit === 151000000 &&
      permCloseVch.totalDebit === nextOpenVch.totalCredit,
    expected: 'تراز کامل اختتامیه ۱۴۰۳ و افتتاحیه ۱۴۰۴ به مبلغ ۱۵۱,۰۰۰,۰۰۰ تومان',
    actual: `اختتامیه ۱۴۰۳: ${permCloseVch.totalDebit.toLocaleString('fa-IR')} | افتتاحیه ۱۴۰۴: ${nextOpenVch.totalDebit.toLocaleString('fa-IR')} تومان`,
    details: 'کلیه دارایی‌ها (۱۱۶M نقد و بانک، ۱۵M بدهکاران، ۲۰M انبار) و بدهی/حقوق مالکانه (۲۵M بستانکاران، ۱۲۰M سرمایه، ۶M سود انباشته) بدون ۱ ریال اختلاف به سال ۱۴۰۴ منتقل شدند.',
  });

  // ۷. بررسی حفاظت از اسناد و گزارش‌های سال قبلی (آرشیو تغییرناپذیر ۱۴۰۳)
  const snapshot1403 = buildFiscalYearArchiveSnapshot({
    fiscalYear: fy1403,
    capturedBy: 'سیستم تست',
    vouchers: [...cleanVouchers, tempCloseVch, permCloseVch],
    invoices: testInvoices,
    products: testProducts,
    persons: testPersons,
    treasuryAccounts: testTreasury,
    cheques: [],
    financialSummary: {
      netSales: auditClean.summary.netSales,
      cogs: auditClean.summary.cogs,
      grossProfit: auditClean.summary.grossProfit,
      totalExpenses: auditClean.summary.totalExpenses,
      otherIncome: auditClean.summary.otherIncome,
      netProfit: auditClean.summary.netProfit,
      totalAssets: auditClean.summary.totalAssets,
      totalLiabilities: auditClean.summary.totalLiabilities,
      totalEquity: auditClean.summary.totalEquity,
    },
  });

  steps.push({
    stepNumber: 7,
    title: 'حفاظت کامل از اسناد، فاکتورها و گزارش‌های سال مالی بسته‌شده (آرشیو ۱۴۰۳)',
    passed:
      snapshot1403.vouchers.length === 5 &&
      snapshot1403.invoices.length === 1 &&
      snapshot1403.summary.netProfit === 6000000 &&
      snapshot1403.summary.inventoryValuation === 20000000,
    expected: 'نگهداری ۵ سند قطعی، ۱ فاکتور و صورت‌های مالی ۱۴۰۳ در آرشیو تغییرناپذیر',
    actual: `اسناد محفوظ: ${snapshot1403.vouchers.length} | فاکتورها: ${snapshot1403.invoices.length} | سود آرشیوی: ${snapshot1403.summary.netProfit.toLocaleString('fa-IR')} تومان`,
    details: 'اسناد و گزارش‌های سال مالی ۱۴۰۳ پس از بسته شدن سال کاملاً محفوظ و در هر زمان قابل مشاهده و چاپ هستند.',
  });

  const passedSteps = steps.filter((s) => s.passed).length;

  return {
    allPassed: passedSteps === steps.length,
    totalSteps: steps.length,
    passedSteps,
    executedAt: new Date().toLocaleTimeString('fa-IR'),
    steps,
    sampleDataSummary: {
      closedYearCode: '1403',
      newYearCode: '1404',
      transferredCashAndBank: 116000000,
      transferredReceivables: 15000000,
      transferredPayables: 25000000,
      transferredInventoryValuation: 20000000,
      closedYearNetProfit: 6000000,
      closingTempVoucherTotal: tempCloseVch.totalDebit,
      closingPermVoucherTotal: permCloseVch.totalDebit,
      openingNewYearVoucherTotal: nextOpenVch.totalDebit,
    },
  };
}
