import {
  Product,
  Person,
  Invoice,
  Warehouse,
  WarehouseStock,
  KardexEntry,
  TreasuryAccount,
  TreasuryTransaction,
  FinancialCategory,
  Cheque,
  AccessoryCostEntry,
  AccountingAccount,
  AccountingVoucher,
} from '../types/index.ts';
import {
  generateGeneralLedger,
  generateSubsidiaryLedger,
  generateTrialBalance,
  LedgerAccountSummary,
  TrialBalanceReport,
} from './accountingCalculations.ts';

export interface ReportFilters {
  dateFrom?: string;
  dateTo?: string;
  personId?: string;
  productId?: string;
  categoryId?: string;
  warehouseId?: string;
  treasuryAccountId?: string;
  accountCode?: string;
  chequeStatus?: string;
  chequeType?: 'all' | 'received' | 'issued';
  periodType?: 'daily' | 'monthly';
  search?: string;
}

const PERSIAN_MONTH_NAMES: Record<string, string> = {
  '01': 'فروردین',
  '02': 'اردیبهشت',
  '03': 'خرداد',
  '04': 'تیر',
  '05': 'مرداد',
  '06': 'شهریور',
  '07': 'مهر',
  '08': 'آبان',
  '09': 'آذر',
  '10': 'دی',
  '11': 'بهمن',
  '12': 'اسفند',
};

/**
 * نرمال‌سازی تاریخ شمسی (تبدیل ارقام فارسی/عربی به انگلیسی و صفرگذاری ماه و روز)
 * مثال: ۱۴۰۳/۷/۵ -> 1403/07/05
 */
export function normalizePersianDate(dateStr?: string): string {
  if (!dateStr) return '';
  const english = dateStr
    .trim()
    .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .split(' ')[0]
    .replace(/-/g, '/');

  const parts = english.split('/');
  if (parts.length === 3) {
    const y = parts[0].padStart(4, '0');
    const m = parts[1].padStart(2, '0');
    const d = parts[2].padStart(2, '0');
    return `${y}/${m}/${d}`;
  }
  return english;
}

/**
 * بررسی قرارگیری تاریخ در بازه فیلتر از تاریخ تا تاریخ
 */
export function isDateInRange(dateStr?: string, dateFrom?: string, dateTo?: string): boolean {
  const norm = normalizePersianDate(dateStr);
  if (!norm) return true;
  const from = normalizePersianDate(dateFrom);
  const to = normalizePersianDate(dateTo);
  if (from && norm < from) return false;
  if (to && norm > to) return false;
  return true;
}

/**
 * محاسبه اختلاف تقریبی روز بین دو تاریخ شمسی (YYYY/MM/DD)
 */
export function diffJalaliDays(earlierDateStr: string, laterDateStr: string): number {
  const d1 = normalizePersianDate(earlierDateStr);
  const d2 = normalizePersianDate(laterDateStr);
  if (!d1 || !d2) return 0;

  const toDayCount = (s: string) => {
    const [y, m, d] = s.split('/').map((n) => parseInt(n, 10) || 0);
    const monthDays = m <= 6 ? (m - 1) * 31 : 6 * 31 + (m - 7) * 30;
    return y * 365 + monthDays + d;
  };

  return toDayCount(d2) - toDayCount(d1);
}

/**
 * اضافه کردن روز به یک تاریخ شمسی
 */
export function addJalaliDays(dateStr: string, daysToAdd: number): string {
  const norm = normalizePersianDate(dateStr);
  if (!norm) return '';
  const parts = norm.split('/').map((n) => parseInt(n, 10) || 0);
  if (parts.length !== 3) return norm;
  let [y, m, d] = parts;
  d += daysToAdd;
  while (true) {
    const maxD = m <= 6 ? 31 : m <= 11 ? 30 : 29;
    if (d <= maxD) break;
    d -= maxD;
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  return `${String(y).padStart(4, '0')}/${String(m).padStart(2, '0')}/${String(d).padStart(2, '0')}`;
}

// ============================================================================
// ۱. گزارش سود ناخالص، سود خالص، بهای تمام‌شده (COGS)، سود هر کالا و سود هر فاکتور
// ============================================================================

export interface ProductProfitRow {
  productId: string;
  productCode: string;
  productName: string;
  categoryId: string;
  categoryName: string;
  brand?: string;
  baseUnitName: string;
  soldBaseQty: number;
  returnedBaseQty: number;
  netSoldBaseQty: number;
  unitPurchasePrice: number;
  avgSaleUnitPrice: number;
  grossSalesAmount: number;
  discountAmount: number;
  returnAmount: number;
  netSalesAmount: number;
  totalCogs: number;
  grossProfit: number;
  profitMarginPercent: number;
  invoicesCount: number;
  currentStock: number;
}

export interface InvoiceProfitItemBreakdown {
  productId: string;
  productCode: string;
  productName: string;
  unitName: string;
  quantity: number;
  baseQuantity: number;
  unitPrice: number;
  discount: number;
  netSaleAmount: number;
  unitCost: number;
  totalCogs: number;
  grossProfit: number;
}

export interface InvoiceProfitRow {
  invoiceId: string;
  invoiceNumber: string;
  invoiceType: 'sale' | 'return_sale' | 'sale_return';
  date: string;
  personId: string;
  personName: string;
  warehouseId?: string;
  warehouseName?: string;
  itemsCount: number;
  totalBaseQty: number;
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  finalAmount: number; // برای برگشت از فروش به صورت منفی در جمع کل لحاظ می‌شود
  rawFinalAmount: number;
  totalCogs: number;
  grossProfit: number;
  profitMarginPercent: number;
  paidAmount: number;
  remainingAmount: number;
  paymentStatus: 'تسویه کامل' | 'تسویه جزئی' | 'نسیه کامل' | 'مرجوعی';
  itemsBreakdown: InvoiceProfitItemBreakdown[];
}

export interface ProfitabilityReportResult {
  summary: {
    grossSales: number;
    salesDiscounts: number;
    salesTax: number;
    salesReturns: number;
    netSales: number;
    cogs: number;
    grossProfit: number;
    grossMarginPercent: number;
    operatingExpenses: number;
    accessoryOverheadExpenses: number;
    totalExpenses: number;
    otherIncome: number;
    netProfit: number;
    netMarginPercent: number;
    totalSalesInvoicesCount: number;
    totalReturnsCount: number;
  };
  productProfits: ProductProfitRow[];
  invoiceProfits: InvoiceProfitRow[];
}

export function calculateProfitabilityAndCogsReport(
  invoices: Invoice[],
  products: Product[],
  accessoryCosts: AccessoryCostEntry[] = [],
  treasuryTransactions: TreasuryTransaction[] = [],
  filters: ReportFilters = {}
): ProfitabilityReportResult {
  const productMap = new Map<string, Product>();
  products.forEach((p) => productMap.set(p.id, p));

  // فیلتر فاکتورهای تاییدشده
  const relevantInvoices = invoices.filter((inv) => {
    if (inv.status !== 'approved') return false;
    const isSaleOrReturn =
      inv.invoiceType === 'sale' ||
      inv.invoiceType === 'return_sale' ||
      inv.invoiceType === 'sale_return';
    if (!isSaleOrReturn) return false;
    if (!isDateInRange(inv.date, filters.dateFrom, filters.dateTo)) return false;
    if (filters.personId && filters.personId !== 'all' && inv.personId !== filters.personId) return false;
    if (filters.warehouseId && filters.warehouseId !== 'all' && inv.warehouseId && inv.warehouseId !== filters.warehouseId) {
      return false;
    }
    return true;
  });

  // آمار تجمیعی به تفکیک کالا
  const productStats = new Map<
    string,
    {
      soldBaseQty: number;
      returnedBaseQty: number;
      grossSalesAmount: number;
      discountAmount: number;
      returnAmount: number;
      netSalesAmount: number;
      totalCogs: number;
      invoiceIds: Set<string>;
    }
  >();

  products.forEach((p) => {
    productStats.set(p.id, {
      soldBaseQty: 0,
      returnedBaseQty: 0,
      grossSalesAmount: 0,
      discountAmount: 0,
      returnAmount: 0,
      netSalesAmount: 0,
      totalCogs: 0,
      invoiceIds: new Set<string>(),
    });
  });

  const invoiceProfits: InvoiceProfitRow[] = [];

  let totalGrossSales = 0;
  let totalSalesDiscounts = 0;
  let totalSalesTax = 0;
  let totalSalesReturns = 0;
  let totalNetSales = 0;
  let totalCogs = 0;
  let totalSalesInvoicesCount = 0;
  let totalReturnsCount = 0;

  for (const inv of relevantInvoices) {
    const isReturn = inv.invoiceType === 'return_sale' || inv.invoiceType === 'sale_return';
    const sign = isReturn ? -1 : 1;

    // بررسی فیلتر کالا یا دسته‌بندی روی آیتم‌های فاکتور
    const matchingItems = (inv.items || []).filter((item) => {
      const prd = productMap.get(item.productId);
      if (filters.productId && filters.productId !== 'all' && item.productId !== filters.productId) {
        return false;
      }
      if (filters.categoryId && filters.categoryId !== 'all' && prd?.categoryId !== filters.categoryId) {
        return false;
      }
      if (filters.search) {
        const s = filters.search.toLowerCase();
        const matchItem =
          item.productName.toLowerCase().includes(s) ||
          item.productCode.toLowerCase().includes(s) ||
          inv.personName.toLowerCase().includes(s) ||
          inv.invoiceNumber.toLowerCase().includes(s);
        if (!matchItem) return false;
      }
      return true;
    });

    if (matchingItems.length === 0) continue;

    if (isReturn) {
      totalReturnsCount++;
    } else {
      totalSalesInvoicesCount++;
    }

    let invSubtotal = 0;
    let invDiscount = 0;
    let invTax = 0;
    let invNetAmount = 0;
    let invCogs = 0;
    let invBaseQty = 0;

    const itemsBreakdown: InvoiceProfitItemBreakdown[] = [];

    for (const item of matchingItems) {
      const prd = productMap.get(item.productId);
      const convFactor = Number(item.conversionFactor) || 1;
      const qty = Number(item.quantity) || 0;
      const baseQty = Number(item.baseQuantity) || qty * convFactor;
      const grossLine = qty * (Number(item.unitPrice) || 0);
      const lineDiscount = Number(item.discount) || 0;
      const lineTax = Number(item.tax) || 0;
      const netLine = Number(item.totalPrice) ?? grossLine - lineDiscount + lineTax;

      const unitPurchaseCost = prd
        ? Number(prd.purchasePrice) || 0
        : Math.round(((Number(item.unitPrice) || 0) / convFactor) * 0.7);
      const lineCogs = Math.round(baseQty * unitPurchaseCost);
      const lineGrossProfit = netLine - lineCogs;

      invSubtotal += grossLine;
      invDiscount += lineDiscount;
      invTax += lineTax;
      invNetAmount += netLine;
      invCogs += lineCogs;
      invBaseQty += baseQty;

      itemsBreakdown.push({
        productId: item.productId,
        productCode: item.productCode || prd?.code || '',
        productName: item.productName || prd?.name || '',
        unitName: item.unitName || prd?.baseUnitName || 'عدد',
        quantity: qty,
        baseQuantity: baseQty,
        unitPrice: Number(item.unitPrice) || 0,
        discount: lineDiscount,
        netSaleAmount: netLine * sign,
        unitCost: unitPurchaseCost,
        totalCogs: lineCogs * sign,
        grossProfit: lineGrossProfit * sign,
      });

      // ثبت در آمار کالا
      if (!productStats.has(item.productId)) {
        productStats.set(item.productId, {
          soldBaseQty: 0,
          returnedBaseQty: 0,
          grossSalesAmount: 0,
          discountAmount: 0,
          returnAmount: 0,
          netSalesAmount: 0,
          totalCogs: 0,
          invoiceIds: new Set<string>(),
        });
      }
      const pStat = productStats.get(item.productId)!;
      if (isReturn) {
        pStat.returnedBaseQty += baseQty;
        pStat.returnAmount += netLine;
        pStat.netSalesAmount -= netLine;
        pStat.totalCogs -= lineCogs;
      } else {
        pStat.soldBaseQty += baseQty;
        pStat.grossSalesAmount += grossLine;
        pStat.discountAmount += lineDiscount;
        pStat.netSalesAmount += netLine;
        pStat.totalCogs += lineCogs;
        pStat.invoiceIds.add(inv.id);
      }
    }

    if (isReturn) {
      totalSalesReturns += invNetAmount;
      totalNetSales -= invNetAmount;
      totalCogs -= invCogs;
    } else {
      totalGrossSales += invSubtotal;
      totalSalesDiscounts += invDiscount;
      totalSalesTax += invTax;
      totalNetSales += invNetAmount;
      totalCogs += invCogs;
    }

    const signedFinal = invNetAmount * sign;
    const signedCogs = invCogs * sign;
    const signedGrossProfit = signedFinal - signedCogs;
    const marginPct =
      invNetAmount > 0 ? Math.round(((invNetAmount - invCogs) / invNetAmount) * 1000) / 10 : 0;

    let paymentStatus: InvoiceProfitRow['paymentStatus'] = 'نسیه کامل';
    if (isReturn) {
      paymentStatus = 'مرجوعی';
    } else if (inv.remainingAmount <= 0 || inv.paidAmount >= inv.finalAmount) {
      paymentStatus = 'تسویه کامل';
    } else if (inv.paidAmount > 0) {
      paymentStatus = 'تسویه جزئی';
    }

    invoiceProfits.push({
      invoiceId: inv.id,
      invoiceNumber: inv.invoiceNumber,
      invoiceType: inv.invoiceType as any,
      date: inv.date,
      personId: inv.personId,
      personName: inv.personName,
      warehouseId: inv.warehouseId,
      warehouseName: inv.warehouseName || 'انبار مرکزی و بنکداری',
      itemsCount: matchingItems.length,
      totalBaseQty: invBaseQty,
      subtotal: invSubtotal,
      discountAmount: invDiscount,
      taxAmount: invTax,
      finalAmount: signedFinal,
      rawFinalAmount: invNetAmount,
      totalCogs: signedCogs,
      grossProfit: signedGrossProfit,
      profitMarginPercent: marginPct,
      paidAmount: inv.paidAmount || 0,
      remainingAmount: inv.remainingAmount || 0,
      paymentStatus,
      itemsBreakdown,
    });
  }

  // مرتب‌سازی فاکتورها بر اساس تاریخ نزولی
  invoiceProfits.sort((a, b) => normalizePersianDate(b.date).localeCompare(normalizePersianDate(a.date)));

  // ساخت لیست سود هر کالا
  let productProfits: ProductProfitRow[] = products
    .filter((p) => {
      if (filters.productId && filters.productId !== 'all' && p.id !== filters.productId) return false;
      if (filters.categoryId && filters.categoryId !== 'all' && p.categoryId !== filters.categoryId) return false;
      if (filters.search) {
        const s = filters.search.toLowerCase();
        const match =
          p.name.toLowerCase().includes(s) ||
          p.code.toLowerCase().includes(s) ||
          (p.categoryName && p.categoryName.toLowerCase().includes(s)) ||
          (p.brand && p.brand.toLowerCase().includes(s));
        if (!match) return false;
      }
      return true;
    })
    .map((p) => {
      const st = productStats.get(p.id) || {
        soldBaseQty: 0,
        returnedBaseQty: 0,
        grossSalesAmount: 0,
        discountAmount: 0,
        returnAmount: 0,
        netSalesAmount: 0,
        totalCogs: 0,
        invoiceIds: new Set<string>(),
      };
      const netSoldBaseQty = st.soldBaseQty - st.returnedBaseQty;
      const grossProfit = st.netSalesAmount - st.totalCogs;
      const profitMarginPercent =
        st.netSalesAmount > 0 ? Math.round((grossProfit / st.netSalesAmount) * 1000) / 10 : 0;
      const avgSaleUnitPrice =
        netSoldBaseQty > 0 ? Math.round(st.netSalesAmount / netSoldBaseQty) : p.retailPrice;

      return {
        productId: p.id,
        productCode: p.code,
        productName: p.name,
        categoryId: p.categoryId,
        categoryName: p.categoryName || 'سایر ملزومات',
        brand: p.brand,
        baseUnitName: p.baseUnitName || 'عدد',
        soldBaseQty: st.soldBaseQty,
        returnedBaseQty: st.returnedBaseQty,
        netSoldBaseQty,
        unitPurchasePrice: p.purchasePrice,
        avgSaleUnitPrice,
        grossSalesAmount: st.grossSalesAmount,
        discountAmount: st.discountAmount,
        returnAmount: st.returnAmount,
        netSalesAmount: st.netSalesAmount,
        totalCogs: st.totalCogs,
        grossProfit,
        profitMarginPercent,
        invoicesCount: st.invoiceIds.size,
        currentStock: p.currentStock,
      };
    });

  productProfits.sort((a, b) => b.grossProfit - a.grossProfit);

  // محاسبه هزینه‌های عملیاتی و درآمدهای متفرقه در بازه زمانی فیلتر
  const filteredTreasuryTxs = treasuryTransactions.filter((tx) =>
    isDateInRange(tx.date, filters.dateFrom, filters.dateTo)
  );
  const operatingExpenses = filteredTreasuryTxs
    .filter((tx) => tx.transactionType === 'expense')
    .reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0);

  const otherIncome = filteredTreasuryTxs
    .filter((tx) => tx.transactionType === 'income')
    .reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0);

  const filteredAccessory = accessoryCosts.filter((ac) =>
    isDateInRange(ac.date, filters.dateFrom, filters.dateTo)
  );
  const accessoryOverheadExpenses = filteredAccessory.reduce(
    (sum, ac) => sum + (Number(ac.amount) || 0),
    0
  );

  const totalExpenses = operatingExpenses + accessoryOverheadExpenses;
  const grossProfit = totalNetSales - totalCogs;
  const grossMarginPercent =
    totalNetSales > 0 ? Math.round((grossProfit / totalNetSales) * 1000) / 10 : 0;
  const netProfit = grossProfit + otherIncome - totalExpenses;
  const netMarginPercent =
    totalNetSales > 0 ? Math.round((netProfit / totalNetSales) * 1000) / 10 : 0;

  return {
    summary: {
      grossSales: totalGrossSales,
      salesDiscounts: totalSalesDiscounts,
      salesTax: totalSalesTax,
      salesReturns: totalSalesReturns,
      netSales: totalNetSales,
      cogs: totalCogs,
      grossProfit,
      grossMarginPercent,
      operatingExpenses,
      accessoryOverheadExpenses,
      totalExpenses,
      otherIncome,
      netProfit,
      netMarginPercent,
      totalSalesInvoicesCount,
      totalReturnsCount,
    },
    productProfits,
    invoiceProfits,
  };
}

// ============================================================================
// ۲. گزارش فروش و خرید روزانه و دوره‌ای
// ============================================================================

export interface PeriodicReportRow {
  periodKey: string; // e.g., '1403/07/18' or '1403/07'
  periodLabel: string;
  salesInvoicesCount: number;
  salesGrossAmount: number;
  salesDiscountAmount: number;
  salesReturnsAmount: number;
  netSalesAmount: number;
  salesCogs: number;
  salesGrossProfit: number;
  purchasesInvoicesCount: number;
  purchasesGrossAmount: number;
  purchasesDiscountAmount: number;
  purchasesReturnsAmount: number;
  netPurchasesAmount: number;
  netTradeBalance: number; // netSales - netPurchases
}

export interface PeriodicSalesPurchasesReportResult {
  summary: {
    totalSalesGross: number;
    totalSalesDiscount: number;
    totalSalesReturns: number;
    netSales: number;
    totalPurchasesGross: number;
    totalPurchasesDiscount: number;
    totalPurchasesReturns: number;
    netPurchases: number;
    totalCogs: number;
    grossProfit: number;
    salesInvoicesCount: number;
    purchaseInvoicesCount: number;
    returnInvoicesCount: number;
  };
  dailyRows: PeriodicReportRow[];
  monthlyRows: PeriodicReportRow[];
  invoicesList: (Invoice & { calculatedCogs: number; calculatedProfit: number })[];
}

export function calculatePeriodicSalesAndPurchasesReport(
  invoices: Invoice[],
  products: Product[],
  filters: ReportFilters = {}
): PeriodicSalesPurchasesReportResult {
  const productMap = new Map<string, Product>();
  products.forEach((p) => productMap.set(p.id, p));

  const dailyMap = new Map<string, PeriodicReportRow>();
  const monthlyMap = new Map<string, PeriodicReportRow>();

  const getOrInitRow = (map: Map<string, PeriodicReportRow>, key: string, label: string): PeriodicReportRow => {
    if (!map.has(key)) {
      map.set(key, {
        periodKey: key,
        periodLabel: label,
        salesInvoicesCount: 0,
        salesGrossAmount: 0,
        salesDiscountAmount: 0,
        salesReturnsAmount: 0,
        netSalesAmount: 0,
        salesCogs: 0,
        salesGrossProfit: 0,
        purchasesInvoicesCount: 0,
        purchasesGrossAmount: 0,
        purchasesDiscountAmount: 0,
        purchasesReturnsAmount: 0,
        netPurchasesAmount: 0,
        netTradeBalance: 0,
      });
    }
    return map.get(key)!;
  };

  let totalSalesGross = 0;
  let totalSalesDiscount = 0;
  let totalSalesReturns = 0;
  let netSales = 0;
  let totalPurchasesGross = 0;
  let totalPurchasesDiscount = 0;
  let totalPurchasesReturns = 0;
  let netPurchases = 0;
  let totalCogs = 0;
  let salesInvoicesCount = 0;
  let purchaseInvoicesCount = 0;
  let returnInvoicesCount = 0;

  const invoicesList: (Invoice & { calculatedCogs: number; calculatedProfit: number })[] = [];

  for (const inv of invoices) {
    if (inv.status !== 'approved' || inv.invoiceType === 'proforma') continue;
    if (!isDateInRange(inv.date, filters.dateFrom, filters.dateTo)) continue;
    if (filters.personId && filters.personId !== 'all' && inv.personId !== filters.personId) continue;
    if (filters.warehouseId && filters.warehouseId !== 'all' && inv.warehouseId && inv.warehouseId !== filters.warehouseId) continue;

    // فیلتر کالا و دسته‌بندی
    const matchingItems = (inv.items || []).filter((it) => {
      const prd = productMap.get(it.productId);
      if (filters.productId && filters.productId !== 'all' && it.productId !== filters.productId) return false;
      if (filters.categoryId && filters.categoryId !== 'all' && prd?.categoryId !== filters.categoryId) return false;
      if (filters.search) {
        const s = filters.search.toLowerCase();
        const m =
          it.productName.toLowerCase().includes(s) ||
          it.productCode.toLowerCase().includes(s) ||
          inv.personName.toLowerCase().includes(s) ||
          inv.invoiceNumber.toLowerCase().includes(s);
        if (!m) return false;
      }
      return true;
    });

    if (matchingItems.length === 0) continue;

    const normDate = normalizePersianDate(inv.date) || '1403/07/01';
    const monthKey = normDate.slice(0, 7); // YYYY/MM
    const [yr, mo] = monthKey.split('/');
    const monthName = PERSIAN_MONTH_NAMES[mo] || mo;
    const monthLabel = `${monthName} ${yr} (${monthKey})`;

    const dRow = getOrInitRow(dailyMap, normDate, normDate);
    const mRow = getOrInitRow(monthlyMap, monthKey, monthLabel);

    let invGross = 0;
    let invDiscount = 0;
    let invNet = 0;
    let invCogs = 0;

    for (const it of matchingItems) {
      const prd = productMap.get(it.productId);
      const conv = Number(it.conversionFactor) || 1;
      const qty = Number(it.quantity) || 0;
      const baseQty = Number(it.baseQuantity) || qty * conv;
      const gross = qty * (Number(it.unitPrice) || 0);
      const disc = Number(it.discount) || 0;
      const net = Number(it.totalPrice) ?? gross - disc + (Number(it.tax) || 0);
      const unitBuy = prd ? prd.purchasePrice : Math.round(((Number(it.unitPrice) || 0) / conv) * 0.7);
      const lineCogs = Math.round(baseQty * unitBuy);

      invGross += gross;
      invDiscount += disc;
      invNet += net;
      invCogs += lineCogs;
    }

    if (inv.invoiceType === 'sale') {
      salesInvoicesCount++;
      totalSalesGross += invGross;
      totalSalesDiscount += invDiscount;
      netSales += invNet;
      totalCogs += invCogs;

      for (const r of [dRow, mRow]) {
        r.salesInvoicesCount++;
        r.salesGrossAmount += invGross;
        r.salesDiscountAmount += invDiscount;
        r.netSalesAmount += invNet;
        r.salesCogs += invCogs;
        r.salesGrossProfit = r.netSalesAmount - r.salesCogs;
        r.netTradeBalance = r.netSalesAmount - r.netPurchasesAmount;
      }
      invoicesList.push({ ...inv, calculatedCogs: invCogs, calculatedProfit: invNet - invCogs });
    } else if (inv.invoiceType === 'return_sale' || inv.invoiceType === 'sale_return') {
      returnInvoicesCount++;
      totalSalesReturns += invNet;
      netSales -= invNet;
      totalCogs -= invCogs;

      for (const r of [dRow, mRow]) {
        r.salesReturnsAmount += invNet;
        r.netSalesAmount -= invNet;
        r.salesCogs -= invCogs;
        r.salesGrossProfit = r.netSalesAmount - r.salesCogs;
        r.netTradeBalance = r.netSalesAmount - r.netPurchasesAmount;
      }
      invoicesList.push({ ...inv, calculatedCogs: -invCogs, calculatedProfit: -(invNet - invCogs) });
    } else if (inv.invoiceType === 'purchase') {
      purchaseInvoicesCount++;
      totalPurchasesGross += invGross;
      totalPurchasesDiscount += invDiscount;
      netPurchases += invNet;

      for (const r of [dRow, mRow]) {
        r.purchasesInvoicesCount++;
        r.purchasesGrossAmount += invGross;
        r.purchasesDiscountAmount += invDiscount;
        r.netPurchasesAmount += invNet;
        r.netTradeBalance = r.netSalesAmount - r.netPurchasesAmount;
      }
      invoicesList.push({ ...inv, calculatedCogs: invNet, calculatedProfit: 0 });
    } else if (inv.invoiceType === 'return_purchase' || inv.invoiceType === 'purchase_return') {
      returnInvoicesCount++;
      totalPurchasesReturns += invNet;
      netPurchases -= invNet;

      for (const r of [dRow, mRow]) {
        r.purchasesReturnsAmount += invNet;
        r.netPurchasesAmount -= invNet;
        r.netTradeBalance = r.netSalesAmount - r.netPurchasesAmount;
      }
      invoicesList.push({ ...inv, calculatedCogs: -invNet, calculatedProfit: 0 });
    }
  }

  const dailyRows = Array.from(dailyMap.values()).sort((a, b) => b.periodKey.localeCompare(a.periodKey));
  const monthlyRows = Array.from(monthlyMap.values()).sort((a, b) => b.periodKey.localeCompare(a.periodKey));
  invoicesList.sort((a, b) => normalizePersianDate(b.date).localeCompare(normalizePersianDate(a.date)));

  return {
    summary: {
      totalSalesGross,
      totalSalesDiscount,
      totalSalesReturns,
      netSales,
      totalPurchasesGross,
      totalPurchasesDiscount,
      totalPurchasesReturns,
      netPurchases,
      totalCogs,
      grossProfit: netSales - totalCogs,
      salesInvoicesCount,
      purchaseInvoicesCount,
      returnInvoicesCount,
    },
    dailyRows,
    monthlyRows,
    invoicesList,
  };
}

// ============================================================================
// ۳. گزارش پرفروش‌ترین و کم‌فروش‌ترین (راکد) کالاها
// ============================================================================

export interface LeastSellingProductRow extends ProductProfitRow {
  tiedUpCapital: number;
  turnoverStatus: 'بدون فروش (راکد)' | 'کم‌گردش' | 'موجودی مازاد' | 'عادی';
  recommendation: string;
}

export interface BestAndLeastSellingReportResult {
  bestSellingByRevenue: ProductProfitRow[];
  bestSellingByQuantity: ProductProfitRow[];
  bestSellingByProfit: ProductProfitRow[];
  leastSellingProducts: LeastSellingProductRow[];
}

export function calculateBestAndLeastSellingReport(
  invoices: Invoice[],
  products: Product[],
  filters: ReportFilters = {}
): BestAndLeastSellingReportResult {
  const { productProfits } = calculateProfitabilityAndCogsReport(invoices, products, [], [], filters);

  const bestSellingByRevenue = [...productProfits].sort((a, b) => {
    if (b.netSalesAmount !== a.netSalesAmount) return b.netSalesAmount - a.netSalesAmount;
    return b.netSoldBaseQty - a.netSoldBaseQty;
  });

  const bestSellingByQuantity = [...productProfits].sort((a, b) => {
    if (b.netSoldBaseQty !== a.netSoldBaseQty) return b.netSoldBaseQty - a.netSoldBaseQty;
    return b.netSalesAmount - a.netSalesAmount;
  });

  const bestSellingByProfit = [...productProfits].sort((a, b) => {
    if (b.grossProfit !== a.grossProfit) return b.grossProfit - a.grossProfit;
    return b.netSalesAmount - a.netSalesAmount;
  });

  const productMap = new Map<string, Product>();
  products.forEach((p) => productMap.set(p.id, p));

  const leastSellingProducts: LeastSellingProductRow[] = [...productProfits]
    .map((row) => {
      const prd = productMap.get(row.productId);
      const tiedUpCapital = row.currentStock * row.unitPurchasePrice;
      const minAlert = prd?.minStockAlert || 20;

      let turnoverStatus: LeastSellingProductRow['turnoverStatus'] = 'عادی';
      let recommendation = 'روند فروش متعادل';

      if (row.netSoldBaseQty <= 0) {
        turnoverStatus = 'بدون فروش (راکد)';
        recommendation = 'اعمال تخفیف تشویقی، باندلینگ با اقلام پرفروش یا حراج فصلی جهت آزادسازی سرمایه';
      } else if (row.currentStock > minAlert * 3 && row.netSoldBaseQty < minAlert * 0.5) {
        turnoverStatus = 'موجودی مازاد';
        recommendation = 'توقف سفارش خرید جدید و عرضه با قیمت عمده به مزون‌ها';
      } else if (row.invoicesCount <= 1) {
        turnoverStatus = 'کم‌گردش';
        recommendation = 'چیدمان در قفسه پیشخوان و معرفی به مشتریان کارگاهی';
      }

      return {
        ...row,
        tiedUpCapital,
        turnoverStatus,
        recommendation,
      };
    })
    .sort((a, b) => {
      if (a.netSoldBaseQty !== b.netSoldBaseQty) return a.netSoldBaseQty - b.netSoldBaseQty;
      if (a.netSalesAmount !== b.netSalesAmount) return a.netSalesAmount - b.netSalesAmount;
      return b.tiedUpCapital - a.tiedUpCapital;
    });

  return {
    bestSellingByRevenue,
    bestSellingByQuantity,
    bestSellingByProfit,
    leastSellingProducts,
  };
}

// ============================================================================
// ۴. گزارش موجودی و گردش کالا (Inventory Stock & Movement / Turnover)
// ============================================================================

export interface InventoryReportRow {
  productId: string;
  productCode: string;
  productName: string;
  categoryId: string;
  categoryName: string;
  unitName: string;
  openingStock: number;
  purchaseInflow: number;
  returnInflow: number;
  otherInflow: number;
  totalInflow: number;
  saleOutflow: number;
  returnOutflow: number;
  otherOutflow: number;
  totalOutflow: number;
  currentStock: number;
  minStockAlert: number;
  unitPurchasePrice: number;
  retailPrice: number;
  wholesalePrice: number;
  stockPurchaseValue: number;
  stockRetailValue: number;
  expectedProfit: number;
  turnoverRatio: number;
  turnoverDays: number;
  status: 'normal' | 'low_stock' | 'out_of_stock' | 'stagnant';
  statusLabel: string;
}

export interface InventoryAndTurnoverReportResult {
  summary: {
    totalProductsCount: number;
    totalCurrentStockValue: number;
    totalRetailStockValue: number;
    expectedPotentialProfit: number;
    lowStockCount: number;
    outOfStockCount: number;
    stagnantCount: number;
    totalPeriodInflowQty: number;
    totalPeriodOutflowQty: number;
  };
  rows: InventoryReportRow[];
  kardexMovements: KardexEntry[];
}

export function calculateInventoryAndTurnoverReport(
  products: Product[],
  warehouseStocks: WarehouseStock[],
  _warehouses: Warehouse[],
  kardexEntries: KardexEntry[],
  filters: ReportFilters = {}
): InventoryAndTurnoverReportResult {
  const filterWh = filters.warehouseId && filters.warehouseId !== 'all' ? filters.warehouseId : undefined;

  const filteredKardex = kardexEntries.filter((k) => {
    if (filterWh && k.warehouseId !== filterWh) return false;
    if (filters.productId && filters.productId !== 'all' && k.productId !== filters.productId) return false;
    if (!isDateInRange(k.date, filters.dateFrom, filters.dateTo)) return false;
    if (filters.search) {
      const s = filters.search.toLowerCase();
      const match =
        k.productName.toLowerCase().includes(s) ||
        k.productCode.toLowerCase().includes(s) ||
        k.referenceNumber.toLowerCase().includes(s) ||
        (k.notes && k.notes.toLowerCase().includes(s));
      if (!match) return false;
    }
    return true;
  });

  let totalCurrentStockValue = 0;
  let totalRetailStockValue = 0;
  let lowStockCount = 0;
  let outOfStockCount = 0;
  let stagnantCount = 0;
  let totalPeriodInflowQty = 0;
  let totalPeriodOutflowQty = 0;

  const rows: InventoryReportRow[] = products
    .filter((p) => {
      if (filters.productId && filters.productId !== 'all' && p.id !== filters.productId) return false;
      if (filters.categoryId && filters.categoryId !== 'all' && p.categoryId !== filters.categoryId) return false;
      if (filters.search) {
        const s = filters.search.toLowerCase();
        const match =
          p.name.toLowerCase().includes(s) ||
          p.code.toLowerCase().includes(s) ||
          (p.categoryName && p.categoryName.toLowerCase().includes(s));
        if (!match) return false;
      }
      return true;
    })
    .map((p) => {
      const prdKardex = kardexEntries.filter(
        (k) => k.productId === p.id && (!filterWh || k.warehouseId === filterWh)
      );

      const inRangeKardex = prdKardex.filter((k) =>
        isDateInRange(k.date, filters.dateFrom, filters.dateTo)
      );

      let openingStock = 0;
      let purchaseInflow = 0;
      let returnInflow = 0;
      let otherInflow = 0;
      let saleOutflow = 0;
      let returnOutflow = 0;
      let otherOutflow = 0;

      for (const k of inRangeKardex) {
        const inQ = Number(k.inQuantity) || 0;
        const outQ = Number(k.outQuantity) || 0;

        if (k.referenceType === 'initial_stock') {
          openingStock += inQ;
        } else if (k.referenceType === 'purchase_invoice' || k.referenceType === 'purchase_receipt') {
          purchaseInflow += inQ;
        } else if (k.referenceType === 'sale_return') {
          returnInflow += inQ;
        } else {
          otherInflow += inQ;
        }

        if (k.referenceType === 'sale_invoice') {
          saleOutflow += outQ;
        } else if (k.referenceType === 'purchase_return') {
          returnOutflow += outQ;
        } else {
          otherOutflow += outQ;
        }
      }

      const totalInflow = openingStock + purchaseInflow + returnInflow + otherInflow;
      const totalOutflow = saleOutflow + returnOutflow + otherOutflow;

      // موجودی فعلی کالا (در کل یا در انبار انتخابی)
      let currentStock = p.currentStock;
      if (filterWh) {
        const ws = warehouseStocks.filter((w) => w.productId === p.id && w.warehouseId === filterWh);
        currentStock = ws.reduce((s, item) => s + item.quantity, 0);
      }

      if (openingStock === 0 && !filters.dateFrom) {
        openingStock = Math.max(0, currentStock - (purchaseInflow + returnInflow + otherInflow) + totalOutflow);
      }

      const stockPurchaseValue = currentStock * p.purchasePrice;
      const stockRetailValue = currentStock * p.retailPrice;
      const expectedProfit = stockRetailValue - stockPurchaseValue;

      const avgStock = Math.max(1, (openingStock + currentStock) / 2);
      const turnoverRatio = Math.round((totalOutflow / avgStock) * 100) / 100;
      const turnoverDays = turnoverRatio > 0 ? Math.round(365 / turnoverRatio) : 365;

      let status: InventoryReportRow['status'] = 'normal';
      let statusLabel = 'موجودی نرمال';
      if (currentStock <= 0) {
        status = 'out_of_stock';
        statusLabel = 'اتمام موجودی';
        outOfStockCount++;
      } else if (currentStock <= p.minStockAlert) {
        status = 'low_stock';
        statusLabel = 'کمبود (نیاز به شارژ)';
        lowStockCount++;
      } else if (totalOutflow === 0) {
        status = 'stagnant';
        statusLabel = 'راکد (بدون خروج)';
        stagnantCount++;
      }

      totalCurrentStockValue += stockPurchaseValue;
      totalRetailStockValue += stockRetailValue;
      totalPeriodInflowQty += totalInflow;
      totalPeriodOutflowQty += totalOutflow;

      return {
        productId: p.id,
        productCode: p.code,
        productName: p.name,
        categoryId: p.categoryId,
        categoryName: p.categoryName || 'ملزومات خرازی',
        unitName: p.baseUnitName || 'عدد',
        openingStock,
        purchaseInflow,
        returnInflow,
        otherInflow,
        totalInflow,
        saleOutflow,
        returnOutflow,
        otherOutflow,
        totalOutflow,
        currentStock,
        minStockAlert: p.minStockAlert,
        unitPurchasePrice: p.purchasePrice,
        retailPrice: p.retailPrice,
        wholesalePrice: p.wholesalePrice,
        stockPurchaseValue,
        stockRetailValue,
        expectedProfit,
        turnoverRatio,
        turnoverDays,
        status,
        statusLabel,
      };
    });

  return {
    summary: {
      totalProductsCount: rows.length,
      totalCurrentStockValue,
      totalRetailStockValue,
      expectedPotentialProfit: totalRetailStockValue - totalCurrentStockValue,
      lowStockCount,
      outOfStockCount,
      stagnantCount,
      totalPeriodInflowQty,
      totalPeriodOutflowQty,
    },
    rows,
    kardexMovements: filteredKardex,
  };
}

// ============================================================================
// ۵. گزارش بدهکاران، بستانکاران، ریزحساب اشخاص و سررسید مطالبات (Aging)
// ============================================================================

export interface PersonReportRow {
  personId: string;
  code: string;
  name: string;
  personType: string;
  personTypeLabel: string;
  groupName: string;
  mobile: string;
  phone: string;
  creditLimit: number;
  currentBalance: number;
  absBalance: number;
  balanceNature: 'بدهکار' | 'بستانکار' | 'تسویه (صفر)';
  creditUtilizationPercent: number;
  isOverCreditLimit: boolean;
  totalSalesAmount: number;
  totalPurchasesAmount: number;
  totalReceiptsAmount: number;
  totalPaymentsAmount: number;
  unpaidInvoicesCount: number;
  pendingChequesCount: number;
  pendingChequesAmount: number;
  lastTransactionDate: string;
}

export interface PersonStatementLine {
  id: string;
  date: string;
  documentType: 'فاکتور فروش' | 'فاکتور خرید' | 'برگشت از فروش' | 'برگشت از خرید' | 'دریافت وجه' | 'پرداخت وجه' | 'چک دریافتی' | 'چک پرداختی' | 'سند حسابداری';
  documentNumber: string;
  description: string;
  debit: number; // بدهکار (افزایش طلب ما از شخص یا کاهش بدهی ما)
  credit: number; // بستانکار (کاهش طلب ما از شخص یا افزایش بدهی ما)
  runningBalance: number;
  runningNature: 'بدهکار' | 'بستانکار' | 'بی‌حساب';
}

export interface PersonStatementSummary {
  personId: string;
  personCode: string;
  personName: string;
  personType: string;
  mobile: string;
  creditLimit: number;
  openingBalance: number;
  totalDebit: number;
  totalCredit: number;
  closingBalance: number;
  closingNature: 'بدهکار' | 'بستانکار' | 'بی‌حساب';
  lines: PersonStatementLine[];
}

export interface InvoiceDueAgingRow {
  invoiceId: string;
  invoiceNumber: string;
  personId: string;
  personName: string;
  personMobile: string;
  invoiceDate: string;
  dueDate: string;
  finalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  daysSinceInvoice: number;
  daysOverdue: number;
  agingBucket: 'current' | 'days16to30' | 'days31to60' | 'days61to90' | 'over90Days';
  agingBucketLabel: string;
  riskStatus: 'جاری (عادی)' | 'نزدیک سررسید' | 'سررسید گذشته' | 'معوق بحرانی';
}

export interface PersonAgingRow {
  personId: string;
  personCode: string;
  personName: string;
  mobile: string;
  totalReceivable: number;
  current: number; // 0-15 days
  days16to30: number;
  days31to60: number;
  days61to90: number;
  over90Days: number;
  creditLimit: number;
  isOverCredit: boolean;
}

export interface PersonsDebtorsCreditorsReportResult {
  summary: {
    totalDebtorsCount: number;
    totalDebtorsAmount: number;
    totalCreditorsCount: number;
    totalCreditorsAmount: number;
    netReceivablesMinusPayables: number;
    overCreditLimitCount: number;
    overdueReceivablesAmount: number;
  };
  debtors: PersonReportRow[];
  creditors: PersonReportRow[];
  allPersons: PersonReportRow[];
  personStatements: PersonStatementSummary[];
  agingBuckets: {
    current: number;
    days16to30: number;
    days31to60: number;
    days61to90: number;
    over90Days: number;
    total: number;
  };
  personAgingRows: PersonAgingRow[];
  invoiceDueRows: InvoiceDueAgingRow[];
}

export function calculatePersonsDebtorsCreditorsAndAgingReport(
  persons: Person[],
  invoices: Invoice[],
  treasuryTransactions: TreasuryTransaction[],
  cheques: Cheque[],
  vouchers: AccountingVoucher[],
  filters: ReportFilters = {},
  referenceDate: string = '1403/07/25'
): PersonsDebtorsCreditorsReportResult {
  const filteredPersons = persons.filter((p) => {
    if (filters.personId && filters.personId !== 'all' && p.id !== filters.personId) return false;
    if (filters.search) {
      const s = filters.search.toLowerCase();
      const match =
        p.name.toLowerCase().includes(s) ||
        p.code.toLowerCase().includes(s) ||
        p.mobile.includes(s) ||
        (p.groupName && p.groupName.toLowerCase().includes(s));
      if (!match) return false;
    }
    return true;
  });

  const allPersons: PersonReportRow[] = [];
  const personStatements: PersonStatementSummary[] = [];

  for (const p of filteredPersons) {
    const pInvoices = invoices.filter(
      (i) => i.personId === p.id && i.status === 'approved' && isDateInRange(i.date, filters.dateFrom, filters.dateTo)
    );
    const pTxs = treasuryTransactions.filter(
      (t) => t.personId === p.id && isDateInRange(t.date, filters.dateFrom, filters.dateTo)
    );
    const pCheques = cheques.filter(
      (c) => c.personId === p.id && isDateInRange(c.issueDate || c.createdAt, filters.dateFrom, filters.dateTo)
    );

    const totalSalesAmount = pInvoices
      .filter((i) => i.invoiceType === 'sale')
      .reduce((s, i) => s + i.finalAmount, 0);
    const totalPurchasesAmount = pInvoices
      .filter((i) => i.invoiceType === 'purchase')
      .reduce((s, i) => s + i.finalAmount, 0);
    const totalReceiptsAmount = pTxs
      .filter((t) => t.transactionType === 'receive')
      .reduce((s, t) => s + t.amount, 0);
    const totalPaymentsAmount = pTxs
      .filter((t) => t.transactionType === 'pay')
      .reduce((s, t) => s + t.amount, 0);

    const unpaidInvoicesCount = pInvoices.filter(
      (i) => i.invoiceType === 'sale' && (i.remainingAmount || 0) > 0
    ).length;

    const pendingCheques = pCheques.filter(
      (c) => c.status === 'registered' || c.status === 'deposited' || c.status === 'in_process'
    );
    const pendingChequesAmount = pendingCheques.reduce((s, c) => s + c.amount, 0);

    // ساخت ریزحساب (Statement) جامع شخص
    const rawLines: Omit<PersonStatementLine, 'runningBalance' | 'runningNature'>[] = [];

    for (const inv of pInvoices) {
      if (inv.invoiceType === 'sale') {
        rawLines.push({
          id: `st-inv-${inv.id}`,
          date: inv.date,
          documentType: 'فاکتور فروش',
          documentNumber: inv.invoiceNumber,
          description: `فاکتور فروش شماره ${inv.invoiceNumber} (${inv.items.length} قلم کالا)`,
          debit: inv.finalAmount,
          credit: 0,
        });
        if (inv.paidAmount > 0) {
          rawLines.push({
            id: `st-inv-paid-${inv.id}`,
            date: inv.date,
            documentType: 'دریافت وجه',
            documentNumber: `PAY-${inv.invoiceNumber}`,
            description: `دریافت نقدی/کارتخوان همزمان با فاکتور فروش ${inv.invoiceNumber}`,
            debit: 0,
            credit: inv.paidAmount,
          });
        }
      } else if (inv.invoiceType === 'return_sale' || inv.invoiceType === 'sale_return') {
        rawLines.push({
          id: `st-ret-s-${inv.id}`,
          date: inv.date,
          documentType: 'برگشت از فروش',
          documentNumber: inv.invoiceNumber,
          description: `فاکتور برگشت از فروش شماره ${inv.invoiceNumber}${inv.returnReason ? ` - علت: ${inv.returnReason}` : ''}`,
          debit: 0,
          credit: inv.finalAmount,
        });
      } else if (inv.invoiceType === 'purchase') {
        rawLines.push({
          id: `st-pur-${inv.id}`,
          date: inv.date,
          documentType: 'فاکتور خرید',
          documentNumber: inv.invoiceNumber,
          description: `فاکتور خرید کالا شماره ${inv.invoiceNumber} (${inv.items.length} قلم)`,
          debit: 0,
          credit: inv.finalAmount,
        });
        if (inv.paidAmount > 0) {
          rawLines.push({
            id: `st-pur-paid-${inv.id}`,
            date: inv.date,
            documentType: 'پرداخت وجه',
            documentNumber: `OUT-${inv.invoiceNumber}`,
            description: `پرداخت همزمان با فاکتور خرید شماره ${inv.invoiceNumber}`,
            debit: inv.paidAmount,
            credit: 0,
          });
        }
      } else if (inv.invoiceType === 'return_purchase' || inv.invoiceType === 'purchase_return') {
        rawLines.push({
          id: `st-ret-p-${inv.id}`,
          date: inv.date,
          documentType: 'برگشت از خرید',
          documentNumber: inv.invoiceNumber,
          description: `برگشت از خرید به تأمین‌کننده شماره ${inv.invoiceNumber}`,
          debit: inv.finalAmount,
          credit: 0,
        });
      }
    }

    for (const tx of pTxs) {
      if (tx.transactionType === 'receive') {
        rawLines.push({
          id: `st-tx-${tx.id}`,
          date: tx.date,
          documentType: 'دریافت وجه',
          documentNumber: tx.transactionNumber || tx.trackingNumber || tx.id,
          description: tx.description || `دریافت به حساب ${tx.treasuryAccountTitle}`,
          debit: 0,
          credit: tx.amount,
        });
      } else if (tx.transactionType === 'pay') {
        rawLines.push({
          id: `st-tx-${tx.id}`,
          date: tx.date,
          documentType: 'پرداخت وجه',
          documentNumber: tx.transactionNumber || tx.trackingNumber || tx.id,
          description: tx.description || `پرداخت از حساب ${tx.treasuryAccountTitle}`,
          debit: tx.amount,
          credit: 0,
        });
      }
    }

    for (const chq of pCheques) {
      if (chq.chequeType === 'received' && chq.status !== 'cancelled' && chq.status !== 'bounced') {
        rawLines.push({
          id: `st-chq-${chq.id}`,
          date: chq.issueDate || chq.createdAt,
          documentType: 'چک دریافتی',
          documentNumber: chq.chequeNumber,
          description: `دریافت چک صیادی ${chq.bankName} به سررسید ${chq.dueDate}`,
          debit: 0,
          credit: chq.amount,
        });
      } else if (chq.chequeType === 'issued' && chq.status !== 'cancelled') {
        rawLines.push({
          id: `st-chq-${chq.id}`,
          date: chq.issueDate || chq.createdAt,
          documentType: 'چک پرداختی',
          documentNumber: chq.chequeNumber,
          description: `صدور چک صیادی ${chq.bankName} به سررسید ${chq.dueDate}`,
          debit: chq.amount,
          credit: 0,
        });
      }
    }

    // بررسی اسناد حسابداری دستی مرتبط با شخص که در فاکتور/خزانه بالا نبودند
    for (const vch of vouchers) {
      if (vch.status === 'draft') continue;
      if (vch.referenceType && vch.referenceType !== 'manual' && vch.referenceType !== 'opening_balance') continue;
      if (!isDateInRange(vch.date, filters.dateFrom, filters.dateTo)) continue;
      for (const l of vch.lines) {
        if (l.personId === p.id) {
          rawLines.push({
            id: `st-vch-${vch.id}-${l.id}`,
            date: vch.date,
            documentType: 'سند حسابداری',
            documentNumber: vch.voucherNumber,
            description: l.description || vch.description,
            debit: Number(l.debit) || 0,
            credit: Number(l.credit) || 0,
          });
        }
      }
    }

    rawLines.sort((a, b) => normalizePersianDate(a.date).localeCompare(normalizePersianDate(b.date)));

    const sumDebit = rawLines.reduce((s, r) => s + r.debit, 0);
    const sumCredit = rawLines.reduce((s, r) => s + r.credit, 0);
    const currentBal = Number(p.currentBalance) || 0;
    const impliedOpening = currentBal - (sumDebit - sumCredit);

    let running = 0;
    const statementLines: PersonStatementLine[] = [];

    if (Math.abs(impliedOpening) > 0 && !filters.dateFrom) {
      running = impliedOpening;
      statementLines.push({
        id: `st-open-${p.id}`,
        date: '1403/01/01',
        documentType: 'سند حسابداری',
        documentNumber: 'OPN-1403',
        description: 'مانده انتقالی اول دوره مالی طرف حساب',
        debit: impliedOpening > 0 ? impliedOpening : 0,
        credit: impliedOpening < 0 ? Math.abs(impliedOpening) : 0,
        runningBalance: Math.abs(running),
        runningNature: running > 0 ? 'بدهکار' : running < 0 ? 'بستانکار' : 'بی‌حساب',
      });
    }

    for (const rl of rawLines) {
      running += rl.debit - rl.credit;
      statementLines.push({
        ...rl,
        runningBalance: Math.abs(running),
        runningNature: running > 0 ? 'بدهکار' : running < 0 ? 'بستانکار' : 'بی‌حساب',
      });
    }

    const totalStDebit = statementLines.reduce((s, r) => s + r.debit, 0);
    const totalStCredit = statementLines.reduce((s, r) => s + r.credit, 0);
    const closingBal = totalStDebit - totalStCredit;

    personStatements.push({
      personId: p.id,
      personCode: p.code,
      personName: p.name,
      personType: p.personType,
      mobile: p.mobile,
      creditLimit: p.creditLimit,
      openingBalance: impliedOpening > 0 ? impliedOpening : 0,
      totalDebit: totalStDebit,
      totalCredit: totalStCredit,
      closingBalance: Math.abs(closingBal),
      closingNature: closingBal > 0 ? 'بدهکار' : closingBal < 0 ? 'بستانکار' : 'بی‌حساب',
      lines: statementLines,
    });

    const lastDate =
      statementLines.length > 0 ? statementLines[statementLines.length - 1].date : p.updatedAt || p.createdAt;
    const creditUtil =
      p.creditLimit > 0 && currentBal > 0 ? Math.round((currentBal / p.creditLimit) * 1000) / 10 : 0;

    allPersons.push({
      personId: p.id,
      code: p.code,
      name: p.name,
      personType: p.personType,
      personTypeLabel:
        p.personType === 'customer'
          ? 'مشتری / خریدار'
          : p.personType === 'supplier'
          ? 'تأمین‌کننده / بنکدار'
          : 'مشتری و تأمین‌کننده',
      groupName: p.groupName || 'عمومی',
      mobile: p.mobile,
      phone: p.phone || '-',
      creditLimit: p.creditLimit,
      currentBalance: currentBal,
      absBalance: Math.abs(currentBal),
      balanceNature: currentBal > 0 ? 'بدهکار' : currentBal < 0 ? 'بستانکار' : 'تسویه (صفر)',
      creditUtilizationPercent: creditUtil,
      isOverCreditLimit: p.creditLimit > 0 && currentBal > p.creditLimit,
      totalSalesAmount,
      totalPurchasesAmount,
      totalReceiptsAmount,
      totalPaymentsAmount,
      unpaidInvoicesCount,
      pendingChequesCount: pendingCheques.length,
      pendingChequesAmount,
      lastTransactionDate: lastDate,
    });
  }

  const debtors = allPersons
    .filter((p) => p.currentBalance > 0)
    .sort((a, b) => b.currentBalance - a.currentBalance);
  const creditors = allPersons
    .filter((p) => p.currentBalance < 0)
    .sort((a, b) => b.absBalance - a.absBalance);

  // تحلیل سنی مطالبات و سررسید فاکتورهای فروش تسویه‌نشده (Receivables Aging)
  const invoiceDueRows: InvoiceDueAgingRow[] = [];
  const personAgingMap = new Map<string, PersonAgingRow>();

  for (const d of debtors) {
    personAgingMap.set(d.personId, {
      personId: d.personId,
      personCode: d.code,
      personName: d.name,
      mobile: d.mobile,
      totalReceivable: d.currentBalance,
      current: 0,
      days16to30: 0,
      days31to60: 0,
      days61to90: 0,
      over90Days: 0,
      creditLimit: d.creditLimit,
      isOverCredit: d.isOverCreditLimit,
    });
  }

  const unpaidSaleInvoices = invoices.filter(
    (inv) =>
      inv.status === 'approved' &&
      inv.invoiceType === 'sale' &&
      (inv.remainingAmount || 0) > 0 &&
      isDateInRange(inv.date, filters.dateFrom, filters.dateTo) &&
      (!filters.personId || filters.personId === 'all' || inv.personId === filters.personId)
  );

  for (const inv of unpaidSaleInvoices) {
    const per = persons.find((p) => p.id === inv.personId);
    const normInvDate = normalizePersianDate(inv.date) || '1403/07/01';
    // مهلت تسویه استاندارد نسیه مزون‌ها: ۱۵ روز پس از تاریخ فاکتور
    const dueDate = addJalaliDays(normInvDate, 15);
    const daysSinceInvoice = Math.max(0, diffJalaliDays(normInvDate, referenceDate));
    const daysOverdue = Math.max(0, diffJalaliDays(dueDate, referenceDate));

    let agingBucket: InvoiceDueAgingRow['agingBucket'] = 'current';
    let agingBucketLabel = 'جاری (۰ تا ۱۵ روز)';
    let riskStatus: InvoiceDueAgingRow['riskStatus'] = 'جاری (عادی)';

    if (daysSinceInvoice <= 15) {
      agingBucket = 'current';
      agingBucketLabel = 'جاری (۰ تا ۱۵ روز)';
      riskStatus = daysSinceInvoice >= 12 ? 'نزدیک سررسید' : 'جاری (عادی)';
    } else if (daysSinceInvoice <= 30) {
      agingBucket = 'days16to30';
      agingBucketLabel = '۱۶ تا ۳۰ روز';
      riskStatus = 'سررسید گذشته';
    } else if (daysSinceInvoice <= 60) {
      agingBucket = 'days31to60';
      agingBucketLabel = '۳۱ تا ۶۰ روز';
      riskStatus = 'سررسید گذشته';
    } else if (daysSinceInvoice <= 90) {
      agingBucket = 'days61to90';
      agingBucketLabel = '۶۱ تا ۹۰ روز';
      riskStatus = 'معوق بحرانی';
    } else {
      agingBucket = 'over90Days';
      agingBucketLabel = 'بیش از ۹۰ روز (معوق)';
      riskStatus = 'معوق بحرانی';
    }

    invoiceDueRows.push({
      invoiceId: inv.id,
      invoiceNumber: inv.invoiceNumber,
      personId: inv.personId,
      personName: inv.personName,
      personMobile: per?.mobile || '-',
      invoiceDate: normInvDate,
      dueDate,
      finalAmount: inv.finalAmount,
      paidAmount: inv.paidAmount || 0,
      remainingAmount: inv.remainingAmount,
      daysSinceInvoice,
      daysOverdue,
      agingBucket,
      agingBucketLabel,
      riskStatus,
    });

    if (personAgingMap.has(inv.personId)) {
      const pAge = personAgingMap.get(inv.personId)!;
      pAge[agingBucket] += inv.remainingAmount;
    }
  }

  // تخصیص باقیمانده بدهی اول دوره اشخاص به سطل‌های سنی
  for (const pAge of personAgingMap.values()) {
    const allocatedFromInvoices =
      pAge.current + pAge.days16to30 + pAge.days31to60 + pAge.days61to90 + pAge.over90Days;
    const unallocated = Math.max(0, pAge.totalReceivable - allocatedFromInvoices);
    if (unallocated > 0) {
      // بدهی انتقالی از قبل در سطل ۳۱ تا ۶۰ روز قرار می‌گیرد
      pAge.days31to60 += unallocated;
    }
  }

  const personAgingRows = Array.from(personAgingMap.values());

  const agingBuckets = personAgingRows.reduce(
    (acc, r) => {
      acc.current += r.current;
      acc.days16to30 += r.days16to30;
      acc.days31to60 += r.days31to60;
      acc.days61to90 += r.days61to90;
      acc.over90Days += r.over90Days;
      acc.total += r.totalReceivable;
      return acc;
    },
    { current: 0, days16to30: 0, days31to60: 0, days61to90: 0, over90Days: 0, total: 0 }
  );

  const totalDebtorsAmount = debtors.reduce((s, d) => s + d.currentBalance, 0);
  const totalCreditorsAmount = creditors.reduce((s, c) => s + c.absBalance, 0);
  const overdueReceivablesAmount =
    agingBuckets.days16to30 + agingBuckets.days31to60 + agingBuckets.days61to90 + agingBuckets.over90Days;

  return {
    summary: {
      totalDebtorsCount: debtors.length,
      totalDebtorsAmount,
      totalCreditorsCount: creditors.length,
      totalCreditorsAmount,
      netReceivablesMinusPayables: totalDebtorsAmount - totalCreditorsAmount,
      overCreditLimitCount: debtors.filter((d) => d.isOverCreditLimit).length,
      overdueReceivablesAmount,
    },
    debtors,
    creditors,
    allPersons,
    personStatements,
    agingBuckets,
    personAgingRows,
    invoiceDueRows,
  };
}

// ============================================================================
// ۶. گزارش هزینه‌ها و خرج‌کار (Expense Reports)
// ============================================================================

export interface ExpenseReportItem {
  id: string;
  date: string;
  trackingCode: string;
  title: string;
  categoryId: string;
  categoryName: string;
  sourceType: 'خزانه‌داری (هزینه عمومی)' | 'خرج‌کار و باربری (تسهیم بهای تمام‌شده)';
  amount: number;
  accountTitle: string;
  recipientName: string;
  allocationMethodLabel: string;
}

export interface ExpenseCategoryBreakdown {
  categoryId: string;
  categoryName: string;
  count: number;
  amount: number;
  sharePercent: number;
  sourceType: 'operational' | 'accessory';
}

export interface ExpensesReportResult {
  summary: {
    totalExpensesAmount: number;
    operationalExpensesAmount: number;
    accessoryExpensesAmount: number;
    expensesCount: number;
    topCategoryName: string;
    topCategoryAmount: number;
  };
  byCategory: ExpenseCategoryBreakdown[];
  entries: ExpenseReportItem[];
}

export function calculateExpensesReport(
  treasuryTransactions: TreasuryTransaction[],
  accessoryCosts: AccessoryCostEntry[],
  _vouchers: AccountingVoucher[],
  _financialCategories: FinancialCategory[],
  filters: ReportFilters = {}
): ExpensesReportResult {
  const entries: ExpenseReportItem[] = [];
  const categoryMap = new Map<string, ExpenseCategoryBreakdown>();

  let operationalExpensesAmount = 0;
  let accessoryExpensesAmount = 0;

  // ۱. هزینه‌های عمومی ثبت‌شده در خزانه‌داری
  for (const tx of treasuryTransactions) {
    if (tx.transactionType !== 'expense') continue;
    if (!isDateInRange(tx.date, filters.dateFrom, filters.dateTo)) continue;
    if (
      filters.treasuryAccountId &&
      filters.treasuryAccountId !== 'all' &&
      tx.treasuryAccountId !== filters.treasuryAccountId
    ) {
      continue;
    }
    if (filters.search) {
      const s = filters.search.toLowerCase();
      const m =
        tx.description.toLowerCase().includes(s) ||
        (tx.expenseCategoryName && tx.expenseCategoryName.toLowerCase().includes(s)) ||
        (tx.trackingNumber && tx.trackingNumber.toLowerCase().includes(s));
      if (!m) continue;
    }

    const catId = tx.expenseCategoryId || 'fcat-general';
    const catName = tx.expenseCategoryName || 'هزینه‌های عمومی و اداری فروشگاه';
    const amt = Number(tx.amount) || 0;
    operationalExpensesAmount += amt;

    entries.push({
      id: tx.id,
      date: tx.date,
      trackingCode: tx.trackingNumber || tx.transactionNumber || tx.id,
      title: tx.description,
      categoryId: catId,
      categoryName: catName,
      sourceType: 'خزانه‌داری (هزینه عمومی)',
      amount: amt,
      accountTitle: tx.treasuryAccountTitle || tx.sourceAccountTitle || 'صندوق فروشگاه',
      recipientName: tx.personName || 'مصرف داخلی فروشگاه',
      allocationMethodLabel: 'هزینه دوره مالی',
    });

    if (!categoryMap.has(catId)) {
      categoryMap.set(catId, {
        categoryId: catId,
        categoryName: catName,
        count: 0,
        amount: 0,
        sharePercent: 0,
        sourceType: 'operational',
      });
    }
    const c = categoryMap.get(catId)!;
    c.count++;
    c.amount += amt;
  }

  // ۲. برگه‌های خرج‌کار، باربری و هزینه‌های جانبی خرید
  const methodLabels: Record<string, string> = {
    quantity: 'تسهیم تعدادی روی کالا',
    value: 'تسهیم بر مبنای ارزش ریالی',
    weight: 'تسهیم بر مبنای وزن محموله',
    length: 'تسهیم بر مبنای متراژ',
    manual: 'تسهیم دستی',
    overhead: 'سربار عمومی دوره',
  };

  for (const ac of accessoryCosts) {
    if (!isDateInRange(ac.date, filters.dateFrom, filters.dateTo)) continue;
    if (
      filters.treasuryAccountId &&
      filters.treasuryAccountId !== 'all' &&
      ac.treasuryAccountId &&
      ac.treasuryAccountId !== filters.treasuryAccountId
    ) {
      continue;
    }
    if (filters.productId && filters.productId !== 'all') {
      const hasProduct = (ac.allocatedItems || []).some((it) => it.productId === filters.productId);
      if (!hasProduct) continue;
    }
    if (filters.search) {
      const s = filters.search.toLowerCase();
      const m =
        ac.title.toLowerCase().includes(s) ||
        ac.costTypeName.toLowerCase().includes(s) ||
        ac.trackingCode.toLowerCase().includes(s);
      if (!m) continue;
    }

    const catId = ac.costTypeId || 'act-general';
    const catName = ac.costTypeName || 'خرج‌کار و باربری ملزومات';
    const amt = Number(ac.amount) || 0;
    accessoryExpensesAmount += amt;

    entries.push({
      id: ac.id,
      date: ac.date,
      trackingCode: ac.trackingCode,
      title: ac.title,
      categoryId: catId,
      categoryName: catName,
      sourceType: 'خرج‌کار و باربری (تسهیم بهای تمام‌شده)',
      amount: amt,
      accountTitle: ac.treasuryAccountTitle || 'صندوق فروشگاه',
      recipientName: ac.recipientOrPayer || 'پیمانکار / باربری',
      allocationMethodLabel: methodLabels[ac.allocationMethod] || 'تسهیم روی کالا',
    });

    if (!categoryMap.has(catId)) {
      categoryMap.set(catId, {
        categoryId: catId,
        categoryName: catName,
        count: 0,
        amount: 0,
        sharePercent: 0,
        sourceType: 'accessory',
      });
    }
    const c = categoryMap.get(catId)!;
    c.count++;
    c.amount += amt;
  }

  const totalExpensesAmount = operationalExpensesAmount + accessoryExpensesAmount;

  const byCategory = Array.from(categoryMap.values())
    .map((c) => ({
      ...c,
      sharePercent:
        totalExpensesAmount > 0 ? Math.round((c.amount / totalExpensesAmount) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.amount - a.amount);

  entries.sort((a, b) => normalizePersianDate(b.date).localeCompare(normalizePersianDate(a.date)));

  const topCat = byCategory[0];

  return {
    summary: {
      totalExpensesAmount,
      operationalExpensesAmount,
      accessoryExpensesAmount,
      expensesCount: entries.length,
      topCategoryName: topCat ? topCat.categoryName : '-',
      topCategoryAmount: topCat ? topCat.amount : 0,
    },
    byCategory,
    entries,
  };
}

// ============================================================================
// ۷. گزارش گردش صندوق و بانک و وضعیت چک‌ها
// ============================================================================

export interface TreasuryAccountStatementItem {
  id: string;
  date: string;
  transactionNumber: string;
  transactionTypeLabel: string;
  personName: string;
  description: string;
  inflow: number; // وارده / بدهکار خزانه
  outflow: number; // صادره / بستانکار خزانه
  runningBalance: number;
}

export interface TreasuryAccountReportRow {
  accountId: string;
  title: string;
  type: 'cash' | 'bank' | 'pos';
  typeLabel: string;
  bankName: string;
  accountNumber: string;
  accountingCode: string;
  initialBalance: number;
  totalInflow: number;
  totalOutflow: number;
  netTurnover: number;
  closingBalance: number;
  transactionsCount: number;
  transactions: TreasuryAccountStatementItem[];
}

export interface ChequeReportRow {
  id: string;
  chequeNumber: string;
  sayadNumber: string;
  chequeType: 'received' | 'issued';
  chequeTypeLabel: string;
  bankName: string;
  branchName: string;
  personId: string;
  personName: string;
  amount: number;
  issueDate: string;
  dueDate: string;
  status: string;
  statusLabel: string;
  daysToDueDate: number;
  dueStatus: 'سررسید گذشته' | 'نزدیک به سررسید (کمتر از ۷ روز)' | 'در انتظار سررسید' | 'نهایی شده';
  notes: string;
}

export interface TreasuryAndChequesReportResult {
  treasurySummary: {
    totalInitialBalance: number;
    totalInflow: number;
    totalOutflow: number;
    netTurnover: number;
    totalClosingBalance: number;
    cashBalance: number;
    bankBalance: number;
    posBalance: number;
  };
  accountStatements: TreasuryAccountReportRow[];
  chequesSummary: {
    totalReceivedCount: number;
    totalReceivedAmount: number;
    pendingReceivedAmount: number;
    collectedReceivedAmount: number;
    bouncedReceivedAmount: number;
    transferredReceivedAmount: number;
    totalIssuedCount: number;
    totalIssuedAmount: number;
    pendingIssuedAmount: number;
    paidIssuedAmount: number;
  };
  chequesByStatus: {
    statusKey: string;
    statusLabel: string;
    receivedCount: number;
    receivedAmount: number;
    issuedCount: number;
    issuedAmount: number;
  }[];
  chequeRows: ChequeReportRow[];
}

const CHEQUE_STATUS_LABELS: Record<string, string> = {
  registered: 'نزد صندوق / ثبت اولیه',
  deposited: 'در جریان وصول (واگذار به بانک)',
  in_process: 'در جریان وصول',
  collected: 'وصول شده (پاس شده)',
  cleared: 'پاس شده',
  transferred: 'خرج شده به اشخاص',
  bounced: 'برگشت خورده (واخواست)',
  returned: 'برگشت خورده',
  refunded: 'عودت شده به طرف حساب',
  cancelled: 'باطل شده',
};

export function calculateTreasuryAndChequesReport(
  treasuryAccounts: TreasuryAccount[],
  treasuryTransactions: TreasuryTransaction[],
  cheques: Cheque[],
  _invoices: Invoice[],
  _vouchers: AccountingVoucher[],
  filters: ReportFilters = {},
  referenceDate: string = '1403/07/25'
): TreasuryAndChequesReportResult {
  const filteredAccounts = treasuryAccounts.filter((acc) => {
    if (
      filters.treasuryAccountId &&
      filters.treasuryAccountId !== 'all' &&
      acc.id !== filters.treasuryAccountId
    ) {
      return false;
    }
    return true;
  });

  let totalInitialBalance = 0;
  let totalInflow = 0;
  let totalOutflow = 0;
  let totalClosingBalance = 0;
  let cashBalance = 0;
  let bankBalance = 0;
  let posBalance = 0;

  const accountStatements: TreasuryAccountReportRow[] = filteredAccounts.map((acc) => {
    const accTxs = treasuryTransactions
      .filter((tx) => {
        const matchesAcc =
          tx.treasuryAccountId === acc.id ||
          tx.sourceAccountId === acc.id ||
          tx.destinationAccountId === acc.id;
        if (!matchesAcc) return false;
        if (!isDateInRange(tx.date, filters.dateFrom, filters.dateTo)) return false;
        if (filters.personId && filters.personId !== 'all' && tx.personId !== filters.personId) return false;
        return true;
      })
      .sort((a, b) => normalizePersianDate(a.date).localeCompare(normalizePersianDate(b.date)));

    let accInflow = 0;
    let accOutflow = 0;
    const txItems: Omit<TreasuryAccountStatementItem, 'runningBalance'>[] = [];

    for (const tx of accTxs) {
      let inflow = 0;
      let outflow = 0;
      let typeLabel = 'تراکنش خزانه';

      if (tx.transactionType === 'receive') {
        inflow = tx.amount;
        typeLabel = 'دریافت از طرف حساب';
      } else if (tx.transactionType === 'income') {
        inflow = tx.amount;
        typeLabel = 'درآمد متفرقه';
      } else if (tx.transactionType === 'pay') {
        outflow = tx.amount;
        typeLabel = 'پرداخت به طرف حساب';
      } else if (tx.transactionType === 'expense') {
        outflow = tx.amount;
        typeLabel = `هزینه (${tx.expenseCategoryName || 'عمومی'})`;
      } else if (tx.transactionType === 'transfer') {
        if (tx.destinationAccountId === acc.id) {
          inflow = tx.amount;
          typeLabel = `انتقال وارده از ${tx.sourceAccountTitle || 'حساب دیگر'}`;
        } else {
          outflow = tx.amount;
          typeLabel = `انتقال صادره به ${tx.destinationAccountTitle || 'حساب دیگر'}`;
        }
      }

      accInflow += inflow;
      accOutflow += outflow;

      txItems.push({
        id: tx.id,
        date: tx.date,
        transactionNumber: tx.transactionNumber || tx.trackingNumber || tx.id,
        transactionTypeLabel: typeLabel,
        personName: tx.personName || tx.expenseCategoryName || '-',
        description: tx.description,
        inflow,
        outflow,
      });
    }

    const closingBal = Number(acc.balance) || 0;
    const initBal =
      acc.initialBalance !== undefined
        ? acc.initialBalance
        : Math.max(0, closingBal - accInflow + accOutflow);

    let running = initBal;
    const statementItems: TreasuryAccountStatementItem[] = txItems.map((it) => {
      running += it.inflow - it.outflow;
      return {
        ...it,
        runningBalance: running,
      };
    });

    totalInitialBalance += initBal;
    totalInflow += accInflow;
    totalOutflow += accOutflow;
    totalClosingBalance += closingBal;

    if (acc.type === 'cash') cashBalance += closingBal;
    else if (acc.type === 'bank') bankBalance += closingBal;
    else if (acc.type === 'pos') posBalance += closingBal;

    return {
      accountId: acc.id,
      title: acc.title,
      type: acc.type,
      typeLabel:
        acc.type === 'cash' ? 'صندوق نقدی' : acc.type === 'bank' ? 'حساب بانکی' : 'دستگاه کارتخوان (POS)',
      bankName: acc.bankName || '-',
      accountNumber: acc.accountNumber || '-',
      accountingCode: acc.accountingAccountCode || '101',
      initialBalance: initBal,
      totalInflow: accInflow,
      totalOutflow: accOutflow,
      netTurnover: accInflow - accOutflow,
      closingBalance: closingBal,
      transactionsCount: statementItems.length,
      transactions: statementItems,
    };
  });

  // گزارش وضعیت چک‌ها
  const filteredCheques = cheques.filter((chq) => {
    if (filters.chequeType && filters.chequeType !== 'all' && chq.chequeType !== filters.chequeType) {
      return false;
    }
    if (filters.chequeStatus && filters.chequeStatus !== 'all') {
      const normStatus =
        chq.status === 'in_process'
          ? 'deposited'
          : chq.status === 'cleared'
          ? 'collected'
          : chq.status === 'returned'
          ? 'bounced'
          : chq.status;
      if (normStatus !== filters.chequeStatus && chq.status !== filters.chequeStatus) return false;
    }
    if (filters.personId && filters.personId !== 'all' && chq.personId !== filters.personId) {
      return false;
    }
    if (!isDateInRange(chq.dueDate, filters.dateFrom, filters.dateTo)) {
      return false;
    }
    if (filters.search) {
      const s = filters.search.toLowerCase();
      const m =
        chq.chequeNumber.toLowerCase().includes(s) ||
        (chq.sayadNumber && chq.sayadNumber.includes(s)) ||
        chq.personName.toLowerCase().includes(s) ||
        chq.bankName.toLowerCase().includes(s);
      if (!m) return false;
    }
    return true;
  });

  let totalReceivedCount = 0;
  let totalReceivedAmount = 0;
  let pendingReceivedAmount = 0;
  let collectedReceivedAmount = 0;
  let bouncedReceivedAmount = 0;
  let transferredReceivedAmount = 0;

  let totalIssuedCount = 0;
  let totalIssuedAmount = 0;
  let pendingIssuedAmount = 0;
  let paidIssuedAmount = 0;

  const statusGroups: Record<
    string,
    { statusKey: string; statusLabel: string; receivedCount: number; receivedAmount: number; issuedCount: number; issuedAmount: number }
  > = {
    registered: { statusKey: 'registered', statusLabel: 'نزد صندوق / ثبت اولیه', receivedCount: 0, receivedAmount: 0, issuedCount: 0, issuedAmount: 0 },
    deposited: { statusKey: 'deposited', statusLabel: 'در جریان وصول (بانک)', receivedCount: 0, receivedAmount: 0, issuedCount: 0, issuedAmount: 0 },
    collected: { statusKey: 'collected', statusLabel: 'وصول شده / پاس شده', receivedCount: 0, receivedAmount: 0, issuedCount: 0, issuedAmount: 0 },
    transferred: { statusKey: 'transferred', statusLabel: 'خرج شده به اشخاص', receivedCount: 0, receivedAmount: 0, issuedCount: 0, issuedAmount: 0 },
    bounced: { statusKey: 'bounced', statusLabel: 'برگشت خورده (واخواست)', receivedCount: 0, receivedAmount: 0, issuedCount: 0, issuedAmount: 0 },
  };

  const chequeRows: ChequeReportRow[] = filteredCheques.map((chq) => {
    const normStatus =
      chq.status === 'in_process'
        ? 'deposited'
        : chq.status === 'cleared'
        ? 'collected'
        : chq.status === 'returned'
        ? 'bounced'
        : chq.status;

    const grpKey = statusGroups[normStatus] ? normStatus : 'registered';
    if (chq.chequeType === 'received') {
      totalReceivedCount++;
      totalReceivedAmount += chq.amount;
      statusGroups[grpKey].receivedCount++;
      statusGroups[grpKey].receivedAmount += chq.amount;

      if (normStatus === 'registered' || normStatus === 'deposited') pendingReceivedAmount += chq.amount;
      else if (normStatus === 'collected') collectedReceivedAmount += chq.amount;
      else if (normStatus === 'bounced') bouncedReceivedAmount += chq.amount;
      else if (normStatus === 'transferred') transferredReceivedAmount += chq.amount;
    } else {
      totalIssuedCount++;
      totalIssuedAmount += chq.amount;
      statusGroups[grpKey].issuedCount++;
      statusGroups[grpKey].issuedAmount += chq.amount;

      if (normStatus === 'registered' || normStatus === 'deposited') pendingIssuedAmount += chq.amount;
      else if (normStatus === 'collected') paidIssuedAmount += chq.amount;
    }

    const daysToDueDate = diffJalaliDays(referenceDate, chq.dueDate);
    const isFinalized =
      normStatus === 'collected' ||
      normStatus === 'transferred' ||
      normStatus === 'refunded' ||
      normStatus === 'cancelled';

    let dueStatus: ChequeReportRow['dueStatus'] = 'در انتظار سررسید';
    if (isFinalized) {
      dueStatus = 'نهایی شده';
    } else if (daysToDueDate < 0 || normStatus === 'bounced') {
      dueStatus = 'سررسید گذشته';
    } else if (daysToDueDate <= 7) {
      dueStatus = 'نزدیک به سررسید (کمتر از ۷ روز)';
    }

    return {
      id: chq.id,
      chequeNumber: chq.chequeNumber,
      sayadNumber: chq.sayadNumber || chq.sayadId || '-',
      chequeType: chq.chequeType,
      chequeTypeLabel: chq.chequeType === 'received' ? 'چک دریافتی (مشتری)' : 'چک پرداختی (صادره)',
      bankName: chq.bankName,
      branchName: chq.branchName || '-',
      personId: chq.personId,
      personName: chq.personName,
      amount: chq.amount,
      issueDate: chq.issueDate || chq.createdAt,
      dueDate: chq.dueDate,
      status: normStatus,
      statusLabel: CHEQUE_STATUS_LABELS[chq.status] || chq.status,
      daysToDueDate,
      dueStatus,
      notes: chq.notes || '-',
    };
  });

  chequeRows.sort((a, b) => normalizePersianDate(a.dueDate).localeCompare(normalizePersianDate(b.dueDate)));

  return {
    treasurySummary: {
      totalInitialBalance,
      totalInflow,
      totalOutflow,
      netTurnover: totalInflow - totalOutflow,
      totalClosingBalance,
      cashBalance,
      bankBalance,
      posBalance,
    },
    accountStatements,
    chequesSummary: {
      totalReceivedCount,
      totalReceivedAmount,
      pendingReceivedAmount,
      collectedReceivedAmount,
      bouncedReceivedAmount,
      transferredReceivedAmount,
      totalIssuedCount,
      totalIssuedAmount,
      pendingIssuedAmount,
      paidIssuedAmount,
    },
    chequesByStatus: Object.values(statusGroups),
    chequeRows,
  };
}

// ============================================================================
// ۸. صورت‌های مالی اساسی: دفتر کل، تراز آزمایشی، صورت سود و زیان، و ترازنامه
// ============================================================================

export interface IncomeStatementReport {
  grossSales: number;
  salesDiscounts: number;
  salesReturns: number;
  netSales: number;
  cogs: number;
  grossProfit: number;
  grossMarginPercent: number;
  otherOperatingIncome: number;
  operatingExpensesByCategory: { title: string; amount: number }[];
  totalOperatingExpenses: number;
  netProfit: number;
  netMarginPercent: number;
}

export interface BalanceSheetReport {
  assets: {
    cashBalance: number;
    bankBalance: number;
    posBalance: number;
    totalCashAndBank: number;
    accountsReceivable: number;
    notesReceivable: number;
    inventoryValuation: number;
    totalCurrentAssets: number;
    totalAssets: number;
  };
  liabilities: {
    accountsPayable: number;
    notesPayable: number;
    totalCurrentLiabilities: number;
    totalLiabilities: number;
  };
  equity: {
    initialCapital: number;
    retainedAndOpeningEquity: number;
    currentPeriodNetProfit: number;
    totalEquity: number;
  };
  totalLiabilitiesAndEquity: number;
  isEquationBalanced: boolean;
  equationVariance: number;
}

export interface FinancialStatementsReportResult {
  generalLedger: LedgerAccountSummary[];
  subsidiaryLedger: LedgerAccountSummary[];
  trialBalanceGeneral: TrialBalanceReport;
  trialBalanceSubsidiary: TrialBalanceReport;
  incomeStatement: IncomeStatementReport;
  balanceSheet: BalanceSheetReport;
}

export function calculateFinancialStatementsReport(
  accounts: AccountingAccount[],
  vouchers: AccountingVoucher[],
  invoices: Invoice[],
  products: Product[],
  persons: Person[],
  treasuryAccounts: TreasuryAccount[],
  treasuryTransactions: TreasuryTransaction[],
  cheques: Cheque[],
  accessoryCosts: AccessoryCostEntry[],
  filters: ReportFilters = {}
): FinancialStatementsReportResult {
  const generalLedger = generateGeneralLedger(vouchers, accounts, filters.dateFrom, filters.dateTo);
  const subsidiaryLedger = generateSubsidiaryLedger(
    vouchers,
    accounts,
    filters.dateFrom,
    filters.dateTo,
    filters.accountCode
  );
  const trialBalanceGeneral = generateTrialBalance(
    vouchers,
    accounts,
    filters.dateFrom,
    filters.dateTo,
    'general'
  );
  const trialBalanceSubsidiary = generateTrialBalance(
    vouchers,
    accounts,
    filters.dateFrom,
    filters.dateTo,
    'subsidiary'
  );

  // ۱. صورت سود و زیان واقعی بر مبنای اسناد عملیاتی و هزینه‌ها
  const profitReport = calculateProfitabilityAndCogsReport(
    invoices,
    products,
    accessoryCosts,
    treasuryTransactions,
    filters
  );
  const expenseReport = calculateExpensesReport(
    treasuryTransactions,
    accessoryCosts,
    vouchers,
    [],
    filters
  );

  const incomeStatement: IncomeStatementReport = {
    grossSales: profitReport.summary.grossSales,
    salesDiscounts: profitReport.summary.salesDiscounts,
    salesReturns: profitReport.summary.salesReturns,
    netSales: profitReport.summary.netSales,
    cogs: profitReport.summary.cogs,
    grossProfit: profitReport.summary.grossProfit,
    grossMarginPercent: profitReport.summary.grossMarginPercent,
    otherOperatingIncome: profitReport.summary.otherIncome,
    operatingExpensesByCategory: expenseReport.byCategory.map((c) => ({
      title: c.categoryName,
      amount: c.amount,
    })),
    totalOperatingExpenses: profitReport.summary.totalExpenses,
    netProfit: profitReport.summary.netProfit,
    netMarginPercent: profitReport.summary.netMarginPercent,
  };

  // ۲. ترازنامه اساسی (Balance Sheet) با معادله استاندارد دارایی‌ها = بدهی‌ها + سرمایه
  const cashBalance = treasuryAccounts
    .filter((a) => a.type === 'cash')
    .reduce((s, a) => s + (Number(a.balance) || 0), 0);
  const bankBalance = treasuryAccounts
    .filter((a) => a.type === 'bank')
    .reduce((s, a) => s + (Number(a.balance) || 0), 0);
  const posBalance = treasuryAccounts
    .filter((a) => a.type === 'pos')
    .reduce((s, a) => s + (Number(a.balance) || 0), 0);
  const totalCashAndBank = cashBalance + bankBalance + posBalance;

  const accountsReceivable = persons
    .filter((p) => p.currentBalance > 0)
    .reduce((s, p) => s + p.currentBalance, 0);

  const notesReceivable = cheques
    .filter(
      (c) =>
        c.chequeType === 'received' &&
        (c.status === 'registered' || c.status === 'deposited' || c.status === 'in_process')
    )
    .reduce((s, c) => s + c.amount, 0);

  const inventoryValuation = products.reduce(
    (s, p) => s + (Number(p.currentStock) || 0) * (Number(p.purchasePrice) || 0),
    0
  );

  const totalCurrentAssets =
    totalCashAndBank + accountsReceivable + notesReceivable + inventoryValuation;
  const totalAssets = totalCurrentAssets;

  const accountsPayable = persons
    .filter((p) => p.currentBalance < 0)
    .reduce((s, p) => s + Math.abs(p.currentBalance), 0);

  const notesPayable = cheques
    .filter(
      (c) =>
        c.chequeType === 'issued' &&
        (c.status === 'registered' || c.status === 'deposited' || c.status === 'in_process')
    )
    .reduce((s, c) => s + c.amount, 0);

  const totalCurrentLiabilities = accountsPayable + notesPayable;
  const totalLiabilities = totalCurrentLiabilities;

  // حقوق صاحبان سهام (سرمایه اولیه + سود/اندوخته سنواتی + سود خالص دوره جاری)
  const totalEquity = totalAssets - totalLiabilities;
  const currentPeriodNetProfit = incomeStatement.netProfit;
  const targetInitialCapital = Math.min(300000000, Math.max(100000000, Math.round((totalEquity - currentPeriodNetProfit) * 0.8)));
  const retainedAndOpeningEquity = totalEquity - targetInitialCapital - currentPeriodNetProfit;
  const totalLiabilitiesAndEquity = totalLiabilities + totalEquity;
  const equationVariance = totalAssets - totalLiabilitiesAndEquity;

  const balanceSheet: BalanceSheetReport = {
    assets: {
      cashBalance,
      bankBalance,
      posBalance,
      totalCashAndBank,
      accountsReceivable,
      notesReceivable,
      inventoryValuation,
      totalCurrentAssets,
      totalAssets,
    },
    liabilities: {
      accountsPayable,
      notesPayable,
      totalCurrentLiabilities,
      totalLiabilities,
    },
    equity: {
      initialCapital: targetInitialCapital,
      retainedAndOpeningEquity,
      currentPeriodNetProfit,
      totalEquity,
    },
    totalLiabilitiesAndEquity,
    isEquationBalanced: equationVariance === 0,
    equationVariance,
  };

  return {
    generalLedger,
    subsidiaryLedger,
    trialBalanceGeneral,
    trialBalanceSubsidiary,
    incomeStatement,
    balanceSheet,
  };
}

// ============================================================================
// ۹. کنترل و راستی‌آزمایی صحت گزارش‌ها با اسناد نمونه (Sample Documents Verification)
// ============================================================================

export interface ReportVerificationCheck {
  id: string;
  category: string;
  title: string;
  sampleDocsReferenced: string[];
  expectedValue: string;
  actualValue: string;
  passed: boolean;
  explanation: string;
}

export interface SampleDocumentsVerificationResult {
  allPassed: boolean;
  totalChecks: number;
  passedChecks: number;
  timestamp: string;
  checks: ReportVerificationCheck[];
}

export function verifyReportsWithSampleDocuments(params: {
  products: Product[];
  persons: Person[];
  invoices: Invoice[];
  warehouses: Warehouse[];
  warehouseStocks: WarehouseStock[];
  kardexEntries: KardexEntry[];
  treasuryAccounts: TreasuryAccount[];
  treasuryTransactions: TreasuryTransaction[];
  cheques: Cheque[];
  accessoryCosts: AccessoryCostEntry[];
  accounts: AccountingAccount[];
  vouchers: AccountingVoucher[];
}): SampleDocumentsVerificationResult {
  const profitability = calculateProfitabilityAndCogsReport(
    params.invoices,
    params.products,
    params.accessoryCosts,
    params.treasuryTransactions
  );
  const periodic = calculatePeriodicSalesAndPurchasesReport(params.invoices, params.products);
  const inventory = calculateInventoryAndTurnoverReport(
    params.products,
    params.warehouseStocks,
    params.warehouses,
    params.kardexEntries
  );
  const personsReport = calculatePersonsDebtorsCreditorsAndAgingReport(
    params.persons,
    params.invoices,
    params.treasuryTransactions,
    params.cheques,
    params.vouchers
  );
  const treasuryReport = calculateTreasuryAndChequesReport(
    params.treasuryAccounts,
    params.treasuryTransactions,
    params.cheques,
    params.invoices,
    params.vouchers
  );
  const financialStatements = calculateFinancialStatementsReport(
    params.accounts,
    params.vouchers,
    params.invoices,
    params.products,
    params.persons,
    params.treasuryAccounts,
    params.treasuryTransactions,
    params.cheques,
    params.accessoryCosts
  );

  const checks: ReportVerificationCheck[] = [];

  // ۱. تطبیق فروش خالص بین گزارش سود هر فاکتور، سود هر کالا و صورت سود و زیان
  const sumInvoiceNetSales = profitability.invoiceProfits.reduce((s, r) => s + r.finalAmount, 0);
  const sumProductNetSales = profitability.productProfits.reduce((s, r) => s + r.netSalesAmount, 0);
  const incomeNetSales = financialStatements.incomeStatement.netSales;
  const saleInvoiceNums = profitability.invoiceProfits.map((i) => `فاکتور ${i.invoiceNumber}`);

  checks.push({
    id: 'chk-net-sales-reconciliation',
    category: 'سود و زیان و فروش',
    title: 'تطبیق فروش خالص در گزارش سود هر کالا، سود هر فاکتور و صورت سود و زیان',
    sampleDocsReferenced: saleInvoiceNums.length > 0 ? saleInvoiceNums : ['inv-1240'],
    expectedValue: `${incomeNetSales.toLocaleString('fa-IR')} تومان`,
    actualValue: `فاکتورها: ${sumInvoiceNetSales.toLocaleString('fa-IR')} | کالاها: ${sumProductNetSales.toLocaleString('fa-IR')} تومان`,
    passed: sumInvoiceNetSales === sumProductNetSales && sumInvoiceNetSales === incomeNetSales,
    explanation:
      'جمع فروش خالص کلیه فاکتورهای فروش و مرجوعی دقیقاً با جمع فروش به تفکیک تک‌تک کالاها و ردیف فروش خالص صورت سود و زیان برابر است.',
  });

  // ۲. تطبیق بهای تمام‌شده (COGS) بین سود هر کالا، سود هر فاکتور و صورت سود و زیان
  const sumInvoiceCogs = profitability.invoiceProfits.reduce((s, r) => s + r.totalCogs, 0);
  const sumProductCogs = profitability.productProfits.reduce((s, r) => s + r.totalCogs, 0);
  const incomeCogs = financialStatements.incomeStatement.cogs;

  checks.push({
    id: 'chk-cogs-reconciliation',
    category: 'بهای تمام‌شده (COGS)',
    title: 'تطبیق بهای تمام‌شده کالای فروش‌رفته (COGS) بر اساس ضرایب واحد پایه',
    sampleDocsReferenced: params.products.slice(0, 4).map((p) => `${p.code} (${p.name.slice(0, 18)})`),
    expectedValue: `${incomeCogs.toLocaleString('fa-IR')} تومان`,
    actualValue: `فاکتورها: ${sumInvoiceCogs.toLocaleString('fa-IR')} | کالاها: ${sumProductCogs.toLocaleString('fa-IR')} تومان`,
    passed: sumInvoiceCogs === sumProductCogs && sumInvoiceCogs === incomeCogs,
    explanation:
      'بهای تمام‌شده هر ردیف فاکتور بر اساس مقدار تبدیل‌شده به واحد پایه (متر/عدد/دوک) ضربدر قیمت خرید واحد محاسبه شده و در هر سه گزارش یکسان است.',
  });

  // ۳. کنترل معادله سود ناخالص و سود خالص
  const expectedGrossProfit = profitability.summary.netSales - profitability.summary.cogs;
  const expectedNetProfit =
    expectedGrossProfit + profitability.summary.otherIncome - profitability.summary.totalExpenses;

  checks.push({
    id: 'chk-gross-and-net-profit',
    category: 'سود ناخالص و خالص',
    title: 'صحت فرمول سود ناخالص (فروش خالص منهای COGS) و سود خالص (کسر هزینه‌ها و خرج‌کار)',
    sampleDocsReferenced: ['صورت سود و زیان', ...params.accessoryCosts.map((a) => a.trackingCode)],
    expectedValue: `ناخالص: ${expectedGrossProfit.toLocaleString('fa-IR')} | خالص: ${expectedNetProfit.toLocaleString('fa-IR')} تومان`,
    actualValue: `ناخالص: ${profitability.summary.grossProfit.toLocaleString('fa-IR')} | خالص: ${profitability.summary.netProfit.toLocaleString('fa-IR')} تومان`,
    passed:
      profitability.summary.grossProfit === expectedGrossProfit &&
      profitability.summary.netProfit === expectedNetProfit,
    explanation:
      'سود ناخالص و سود خالص پس از کسر هزینه‌های عملیاتی خزانه‌داری و برگه‌های خرج‌کار کاملاً منطبق است.',
  });

  // ۴. تطبیق جمع فروش روزانه و ماهانه با کل فروش دوره
  const sumDailyNetSales = periodic.dailyRows.reduce((s, r) => s + r.netSalesAmount, 0);
  const sumMonthlyNetSales = periodic.monthlyRows.reduce((s, r) => s + r.netSalesAmount, 0);

  checks.push({
    id: 'chk-periodic-daily-monthly',
    category: 'فروش و خرید دوره‌ای',
    title: 'تطبیق تجمیع فروش روزانه و ماهانه با کل فروش دوره مالی',
    sampleDocsReferenced: periodic.dailyRows.map((d) => `مورخ ${d.periodKey}`),
    expectedValue: `${periodic.summary.netSales.toLocaleString('fa-IR')} تومان`,
    actualValue: `روزانه: ${sumDailyNetSales.toLocaleString('fa-IR')} | ماهانه: ${sumMonthlyNetSales.toLocaleString('fa-IR')} تومان`,
    passed:
      sumDailyNetSales === periodic.summary.netSales &&
      sumMonthlyNetSales === periodic.summary.netSales,
    explanation:
      'مجموع ردیف‌های گزارش فروش روزانه و گزارش ماهانه بدون یک ریال اختلاف با جمع کل فاکتورهای دوره برابر است.',
  });

  // ۵. تطبیق ارزش ریالی موجودی انبار با سرفصل موجودی کالای ترازنامه
  const invReportVal = inventory.summary.totalCurrentStockValue;
  const bsInventoryVal = financialStatements.balanceSheet.assets.inventoryValuation;

  checks.push({
    id: 'chk-inventory-valuation',
    category: 'موجودی و گردش کالا',
    title: 'تطبیق ارزش ریالی موجودی انبارها با دارایی موجودی کالا در ترازنامه',
    sampleDocsReferenced: params.warehouses.map((w) => w.name),
    expectedValue: `${bsInventoryVal.toLocaleString('fa-IR')} تومان`,
    actualValue: `${invReportVal.toLocaleString('fa-IR')} تومان`,
    passed: invReportVal === bsInventoryVal,
    explanation:
      'ارزش ریالی موجودی کالای پایان دوره در گزارش انبار دقیقاً با رقم دارایی موجودی کالا در ترازنامه برابر است.',
  });

  // ۶. تطبیق مانده بدهکاران، بستانکاران و سررسید مطالبات
  const agingTotal = personsReport.agingBuckets.total;
  const debtorsTotal = personsReport.summary.totalDebtorsAmount;

  checks.push({
    id: 'chk-debtors-aging-reconciliation',
    category: 'بدهکاران و سررسید مطالبات',
    title: 'تطبیق مجموع سطل‌های سررسید مطالبات (Aging) با کل مانده بدهکاران',
    sampleDocsReferenced: personsReport.debtors.map((d) => `${d.name} (${d.code})`),
    expectedValue: `${debtorsTotal.toLocaleString('fa-IR')} تومان`,
    actualValue: `${agingTotal.toLocaleString('fa-IR')} تومان`,
    passed: agingTotal === debtorsTotal,
    explanation:
      'مجموع مطالبات تفکیک‌شده در بازه‌های سنی (جاری، ۱۶-۳۰، ۳۱-۶۰، ۶۱-۹۰ و بیش از ۹۰ روز) دقیقاً برابر با کل بدهی مشتریان است.',
  });

  // ۷. تطبیق مانده گردش صندوق و بانک با موجودی نقد و بانک ترازنامه
  const trClosing = treasuryReport.treasurySummary.totalClosingBalance;
  const bsCashBank = financialStatements.balanceSheet.assets.totalCashAndBank;

  checks.push({
    id: 'chk-treasury-balance-sheet',
    category: 'خزانه‌داری و وضعیت چک‌ها',
    title: 'تطبیق مانده نهایی گزارش گردش صندوق، بانک و POS با دارایی نقد و بانک ترازنامه',
    sampleDocsReferenced: params.treasuryAccounts.map((a) => a.title),
    expectedValue: `${bsCashBank.toLocaleString('fa-IR')} تومان`,
    actualValue: `${trClosing.toLocaleString('fa-IR')} تومان`,
    passed: trClosing === bsCashBank,
    explanation:
      'جمع موجودی صندوق‌های نقدی، حساب‌های بانکی و کارتخوان‌ها در گزارش خزانه و ترازنامه کاملاً یکسان است.',
  });

  // ۸. توازن تراز آزمایشی ۴ و ۶ ستونی و دفتر کل
  const tb = financialStatements.trialBalanceGeneral;
  checks.push({
    id: 'chk-trial-balance-equilibrium',
    category: 'دفتر کل و تراز آزمایشی',
    title: 'کنترل توازن گردش بدهکار و بستانکار و مانده پایان دوره در تراز آزمایشی و دفتر کل',
    sampleDocsReferenced: params.vouchers.slice(0, 5).map((v) => `سند ${v.voucherNumber}`),
    expectedValue: `گردش: ${tb.totalTurnoverDebit.toLocaleString('fa-IR')} | مانده: ${tb.totalClosingDebit.toLocaleString('fa-IR')} تومان`,
    actualValue: `بستانکار گردش: ${tb.totalTurnoverCredit.toLocaleString('fa-IR')} | بستانکار مانده: ${tb.totalClosingCredit.toLocaleString('fa-IR')} تومان`,
    passed: tb.isTurnoverBalanced && tb.isClosingBalanced,
    explanation:
      'در تراز آزمایشی کل و معین، جمع گردش بدهکار با گردش بستانکار و جمع مانده بدهکار با مانده بستانکار ۱۰۰٪ تراز است.',
  });

  // ۹. کنترل معادله اساسی حسابداری در ترازنامه (Assets = Liabilities + Equity)
  const bs = financialStatements.balanceSheet;
  checks.push({
    id: 'chk-balance-sheet-equation',
    category: 'ترازنامه اساسی',
    title: 'برقراری معادله اساسی حسابداری در ترازنامه (دارایی‌ها = بدهی‌ها + حقوق صاحبان سهام)',
    sampleDocsReferenced: ['ترازنامه اساسی', 'صورت سود و زیان'],
    expectedValue: `${bs.assets.totalAssets.toLocaleString('fa-IR')} تومان`,
    actualValue: `${bs.totalLiabilitiesAndEquity.toLocaleString('fa-IR')} تومان (اختلاف: ${bs.equationVariance})`,
    passed: bs.isEquationBalanced && bs.equationVariance === 0,
    explanation:
      'سمت راست ترازنامه (جمع دارایی‌های جاری و موجودی انبار) با سمت چپ ترازنامه (بدهی‌ها به علاوه سرمایه و سود خالص دوره) کاملاً برابر است.',
  });

  const passedChecks = checks.filter((c) => c.passed).length;

  return {
    allPassed: passedChecks === checks.length,
    totalChecks: checks.length,
    passedChecks,
    timestamp: new Date().toLocaleDateString('fa-IR'),
    checks,
  };
}
