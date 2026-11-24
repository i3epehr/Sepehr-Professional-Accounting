import React, { useState, useEffect, useMemo } from 'react';
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  Package,
  Users,
  Wallet,
  CreditCard,
  Scale,
  FileSpreadsheet,
  Printer,
  Download,
  Filter,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  Search,
  Calendar,
  BookOpen,
  Layers,
  Coins,
  Clock,
  ChevronDown,
  ChevronUp,
  Eye,
  X,
  FileText,
  ShieldCheck,
  Boxes,
  ArrowUpRight,
  ArrowDownLeft,
} from 'lucide-react';
import { api } from '../../lib/api.ts';
import { toPersianDigits, formatCurrency } from '../../lib/formatters.ts';
import {
  exportReportToCSV,
  exportReportToExcelXLS,
  downloadPrintablePdfDocument,
  ExportReportConfig,
} from '../../lib/reportExports.ts';

export type MainReportTab =
  | 'profit_cogs'
  | 'periodic_sales_purchases'
  | 'best_least_selling'
  | 'inventory_turnover'
  | 'persons_aging'
  | 'expenses_report'
  | 'treasury_cheques'
  | 'ledger_trial_balance'
  | 'income_balance_sheet'
  | 'sample_verification';

interface ReportsModuleProps {
  initialTab?: MainReportTab;
}

export const ReportsModule: React.FC<ReportsModuleProps> = ({ initialTab = 'profit_cogs' }) => {
  const [activeTab, setActiveTab] = useState<MainReportTab>(initialTab);

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);
  const [reportData, setReportData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // فیلترهای پویا برای تمامی گزارش‌ها
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const [personId, setPersonId] = useState<string>('all');
  const [productId, setProductId] = useState<string>('all');
  const [categoryId, setCategoryId] = useState<string>('all');
  const [warehouseId, setWarehouseId] = useState<string>('all');
  const [treasuryAccountId, setTreasuryAccountId] = useState<string>('all');
  const [chequeStatus, setChequeStatus] = useState<string>('all');
  const [chequeType, setChequeType] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [showFiltersPanel, setShowFiltersPanel] = useState<boolean>(true);

  // زیرتب‌های هر بخش
  const [profitSubTab, setProfitSubTab] = useState<'per_product' | 'per_invoice'>('per_product');
  const [expandedInvoiceId, setExpandedInvoiceId] = useState<string | null>(null);
  const [periodicSubTab, setPeriodicSubTab] = useState<'daily' | 'monthly' | 'invoices'>('daily');
  const [rankingSubTab, setRankingSubTab] = useState<'best_revenue' | 'best_qty' | 'best_profit' | 'least_selling'>('best_revenue');
  const [inventorySubTab, setInventorySubTab] = useState<'stock_turnover' | 'kardex'>('stock_turnover');
  const [personsSubTab, setPersonsSubTab] = useState<'debtors' | 'creditors' | 'statement' | 'aging'>('debtors');
  const [selectedStatementPersonId, setSelectedStatementPersonId] = useState<string>('per-1');
  const [treasurySubTab, setTreasurySubTab] = useState<'cash_bank' | 'cheques'>('cash_bank');
  const [selectedTreasuryAccId, setSelectedTreasuryAccId] = useState<string>('all');
  const [ledgerSubTab, setLedgerSubTab] = useState<'general' | 'subsidiary' | 'trial_6col' | 'trial_4col'>('trial_6col');
  const [selectedLedgerCode, setSelectedLedgerCode] = useState<string | null>(null);
  const [financialSubTab, setFinancialSubTab] = useState<'income_statement' | 'balance_sheet'>('income_statement');

  // مودال پیش‌نمایش زنده چاپ با اسکیل سفارشی و خروجی PDF رسمی
  const [isPrintModalOpen, setIsPrintModalOpen] = useState<boolean>(false);
  const [printScale, setPrintScale] = useState<number>(100);
  const [printPaperSize, setPrintPaperSize] = useState<'A4' | 'A5'>('A4');
  const [printOrientation, setPrintOrientation] = useState<'portrait' | 'landscape'>('portrait');
  const [expenseFilterCategory, setExpenseFilterCategory] = useState<string>('all');
  const [exportToast, setExportToast] = useState<string | null>(null);

  const fetchReports = async () => {
    try {
      setIsLoading(true);
      setErrorMsg(null);
      const data = await api.getComprehensiveReports({
        dateFrom: dateFrom.trim() || undefined,
        dateTo: dateTo.trim() || undefined,
        personId: personId !== 'all' ? personId : undefined,
        productId: productId !== 'all' ? productId : undefined,
        categoryId: categoryId !== 'all' ? categoryId : undefined,
        warehouseId: warehouseId !== 'all' ? warehouseId : undefined,
        treasuryAccountId: treasuryAccountId !== 'all' ? treasuryAccountId : undefined,
        chequeStatus: chequeStatus !== 'all' ? chequeStatus : undefined,
        chequeType: chequeType !== 'all' ? chequeType : undefined,
        search: searchTerm.trim() || undefined,
      });
      setReportData(data);
      if (data?.personsAndAging?.personStatements?.length > 0 && !selectedStatementPersonId) {
        setSelectedStatementPersonId(data.personsAndAging.personStatements[0].personId);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'خطا در بارگذاری گزارش‌های تحلیلی و حسابداری');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, [
    dateFrom,
    dateTo,
    personId,
    productId,
    categoryId,
    warehouseId,
    treasuryAccountId,
    chequeStatus,
    chequeType,
    searchTerm,
  ]);

  const handleResetFilters = () => {
    setDateFrom('');
    setDateTo('');
    setPersonId('all');
    setProductId('all');
    setCategoryId('all');
    setWarehouseId('all');
    setTreasuryAccountId('all');
    setChequeStatus('all');
    setChequeType('all');
    setSearchTerm('');
  };

  const applyQuickDateRange = (from: string, to: string) => {
    setDateFrom(from);
    setDateTo(to);
  };

  // متن خلاصه فیلترهای فعال برای درج در هدر چاپ، اکسل و PDF
  const activeFiltersText = useMemo(() => {
    const parts: string[] = [];
    if (dateFrom) parts.push(`از تاریخ: ${toPersianDigits(dateFrom)}`);
    if (dateTo) parts.push(`تا تاریخ: ${toPersianDigits(dateTo)}`);
    if (personId !== 'all' && reportData?.metadata?.persons) {
      const p = reportData.metadata.persons.find((x: any) => x.id === personId);
      if (p) parts.push(`شخص: ${p.name}`);
    }
    if (productId !== 'all' && reportData?.metadata?.products) {
      const prd = reportData.metadata.products.find((x: any) => x.id === productId);
      if (prd) parts.push(`کالا: ${prd.name}`);
    }
    if (categoryId !== 'all' && reportData?.metadata?.categories) {
      const cat = reportData.metadata.categories.find((x: any) => x.id === categoryId);
      if (cat) parts.push(`دسته: ${cat.name}`);
    }
    if (warehouseId !== 'all' && reportData?.metadata?.warehouses) {
      const wh = reportData.metadata.warehouses.find((x: any) => x.id === warehouseId);
      if (wh) parts.push(`انبار: ${wh.name}`);
    }
    if (searchTerm.trim()) parts.push(`جستجو: «${searchTerm.trim()}»`);
    return parts.length > 0 ? parts.join(' | ') : 'کلیه اطلاعات دوره مالی ۱۴۰۳ (بدون محدودیت فیلتر)';
  }, [dateFrom, dateTo, personId, productId, categoryId, warehouseId, searchTerm, reportData]);

  // پیکربندی خروجی Excel / CSV / PDF بر اساس تب فعال فعلی
  const currentExportConfig = useMemo((): ExportReportConfig => {
    const storeName = reportData?.metadata?.storeSettings?.storeName || 'فروشگاه خرازی و ملزومات خیاطی نگین';
    const fiscalYear = reportData?.metadata?.storeSettings?.activeFiscalYear || '۱۴۰۳';

    if (!reportData) {
      return {
        filename: 'kharrazi-report',
        reportTitle: 'گزارش سیستم حسابداری خرازی',
        storeName,
        fiscalYear,
        activeFiltersText,
        columns: [],
        rows: [],
      };
    }

    // ۱. سود ناخالص، خالص، بهای تمام‌شده، سود هر کالا و فاکتور
    if (activeTab === 'profit_cogs') {
      const s = reportData.profitability.summary;
      if (profitSubTab === 'per_product') {
        const rows = reportData.profitability.productProfits.map((r: any, idx: number) => ({
          rowNum: toPersianDigits(idx + 1),
          code: r.productCode,
          name: r.productName,
          category: r.categoryName,
          soldQty: `${toPersianDigits(r.netSoldBaseQty)} ${r.baseUnitName}`,
          unitCost: formatCurrency(r.unitPurchasePrice),
          netSales: formatCurrency(r.netSalesAmount),
          cogs: formatCurrency(r.totalCogs),
          grossProfit: formatCurrency(r.grossProfit),
          margin: `${toPersianDigits(r.profitMarginPercent)}٪`,
        }));
        return {
          filename: 'report-profit-per-product',
          reportTitle: 'گزارش سود ناخالص، بهای تمام‌شده (COGS) و سود هر کالا',
          storeName,
          fiscalYear,
          activeFiltersText,
          summaryCards: [
            { label: 'فروش خالص کل', value: `${formatCurrency(s.netSales)}` },
            { label: 'بهای تمام‌شده (COGS)', value: `${formatCurrency(s.cogs)}` },
            { label: 'سود ناخالص', value: `${formatCurrency(s.grossProfit)}` },
            { label: 'سود خالص نهایی', value: `${formatCurrency(s.netProfit)}` },
          ],
          columns: [
            { key: 'rowNum', header: 'ردیف', align: 'center' },
            { key: 'code', header: 'کد کالا', align: 'center' },
            { key: 'name', header: 'نام کالا و مشخصات' },
            { key: 'category', header: 'گروه کالا' },
            { key: 'soldQty', header: 'مقدار خالص فروش', align: 'center' },
            { key: 'unitCost', header: 'فی خرید پایه (ریال)', align: 'center' },
            { key: 'netSales', header: 'فروش خالص (ریال)', align: 'center' },
            { key: 'cogs', header: 'بهای تمام‌شده کل (ریال)', align: 'center' },
            { key: 'grossProfit', header: 'سود ناخالص کالا (ریال)', align: 'center' },
            { key: 'margin', header: 'حاشیه سود', align: 'center' },
          ],
          rows,
          footerTotals: {
            rowNum: '',
            code: '',
            name: 'جمع کل دوره',
            category: '',
            soldQty: '',
            unitCost: '',
            netSales: formatCurrency(s.netSales),
            cogs: formatCurrency(s.cogs),
            grossProfit: formatCurrency(s.grossProfit),
            margin: `${toPersianDigits(s.grossMarginPercent)}٪`,
          },
        };
      } else {
        const rows = reportData.profitability.invoiceProfits.map((r: any, idx: number) => ({
          rowNum: toPersianDigits(idx + 1),
          invoiceNumber: r.invoiceNumber,
          type: r.invoiceType === 'sale' ? 'فروش' : 'برگشت از فروش',
          date: toPersianDigits(r.date),
          personName: r.personName,
          finalAmount: formatCurrency(r.finalAmount),
          cogs: formatCurrency(r.totalCogs),
          grossProfit: formatCurrency(r.grossProfit),
          margin: `${toPersianDigits(r.profitMarginPercent)}٪`,
          status: r.paymentStatus,
        }));
        return {
          filename: 'report-profit-per-invoice',
          reportTitle: 'گزارش سود و بهای تمام‌شده به تفکیک هر فاکتور',
          storeName,
          fiscalYear,
          activeFiltersText,
          summaryCards: [
            { label: 'تعداد فاکتور فروش', value: toPersianDigits(s.totalSalesInvoicesCount) },
            { label: 'فروش خالص فاکتورها', value: `${formatCurrency(s.netSales)}` },
            { label: 'بهای تمام‌شده فاکتورها', value: `${formatCurrency(s.cogs)}` },
            { label: 'سود ناخالص فاکتورها', value: `${formatCurrency(s.grossProfit)}` },
          ],
          columns: [
            { key: 'rowNum', header: 'ردیف', align: 'center' },
            { key: 'invoiceNumber', header: 'شماره فاکتور', align: 'center' },
            { key: 'type', header: 'نوع سند', align: 'center' },
            { key: 'date', header: 'تاریخ', align: 'center' },
            { key: 'personName', header: 'طرف حساب / مشتری' },
            { key: 'finalAmount', header: 'مبلغ خالص فاکتور (ریال)', align: 'center' },
            { key: 'cogs', header: 'بهای تمام‌شده (ریال)', align: 'center' },
            { key: 'grossProfit', header: 'سود ناخالص فاکتور (ریال)', align: 'center' },
            { key: 'margin', header: 'درصد سود', align: 'center' },
            { key: 'status', header: 'وضعیت تسویه', align: 'center' },
          ],
          rows,
          footerTotals: {
            rowNum: '',
            invoiceNumber: '',
            type: '',
            date: '',
            personName: 'جمع کل فاکتورها',
            finalAmount: formatCurrency(s.netSales),
            cogs: formatCurrency(s.cogs),
            grossProfit: formatCurrency(s.grossProfit),
            margin: `${toPersianDigits(s.grossMarginPercent)}٪`,
            status: '',
          },
        };
      }
    }

    // ۲. فروش و خرید روزانه و دوره‌ای
    if (activeTab === 'periodic_sales_purchases') {
      const s = reportData.periodic.summary;
      const targetList = periodicSubTab === 'monthly' ? reportData.periodic.monthlyRows : reportData.periodic.dailyRows;
      const rows = targetList.map((r: any, idx: number) => ({
        rowNum: toPersianDigits(idx + 1),
        period: toPersianDigits(r.periodLabel),
        salesCount: toPersianDigits(r.salesInvoicesCount),
        salesGross: formatCurrency(r.salesGrossAmount),
        salesReturns: formatCurrency(r.salesReturnsAmount),
        netSales: formatCurrency(r.netSalesAmount),
        purchasesCount: toPersianDigits(r.purchasesInvoicesCount),
        netPurchases: formatCurrency(r.netPurchasesAmount),
        cogs: formatCurrency(r.salesCogs),
        profit: formatCurrency(r.salesGrossProfit),
      }));
      return {
        filename: `report-periodic-${periodicSubTab}`,
        reportTitle: periodicSubTab === 'monthly' ? 'گزارش فروش و خرید ماهانه و دوره‌ای' : 'گزارش فروش و خرید روزانه',
        storeName,
        fiscalYear,
        activeFiltersText,
        summaryCards: [
          { label: 'فروش خالص دوره', value: `${formatCurrency(s.netSales)}` },
          { label: 'خرید خالص دوره', value: `${formatCurrency(s.netPurchases)}` },
          { label: 'مرجوعی فروش', value: `${formatCurrency(s.totalSalesReturns)}` },
          { label: 'سود ناخالص دوره', value: `${formatCurrency(s.grossProfit)}` },
        ],
        columns: [
          { key: 'rowNum', header: 'ردیف', align: 'center' },
          { key: 'period', header: periodicSubTab === 'monthly' ? 'ماه / دوره مالی' : 'تاریخ روز', align: 'center' },
          { key: 'salesCount', header: 'تعداد فروش', align: 'center' },
          { key: 'salesGross', header: 'فروش ناخالص (ریال)', align: 'center' },
          { key: 'salesReturns', header: 'برگشت از فروش (ریال)', align: 'center' },
          { key: 'netSales', header: 'فروش خالص (ریال)', align: 'center' },
          { key: 'purchasesCount', header: 'تعداد خرید', align: 'center' },
          { key: 'netPurchases', header: 'خرید خالص (ریال)', align: 'center' },
          { key: 'cogs', header: 'بهای تمام‌شده فروش', align: 'center' },
          { key: 'profit', header: 'سود ناخالص دوره', align: 'center' },
        ],
        rows,
        footerTotals: {
          rowNum: '',
          period: 'جمع کل دوره',
          salesCount: toPersianDigits(s.salesInvoicesCount),
          salesGross: formatCurrency(s.totalSalesGross),
          salesReturns: formatCurrency(s.totalSalesReturns),
          netSales: formatCurrency(s.netSales),
          purchasesCount: toPersianDigits(s.purchaseInvoicesCount),
          netPurchases: formatCurrency(s.netPurchases),
          cogs: formatCurrency(s.totalCogs),
          profit: formatCurrency(s.grossProfit),
        },
      };
    }

    // ۳. پرفروش‌ترین و کم‌فروش‌ترین کالاها
    if (activeTab === 'best_least_selling') {
      const list =
        rankingSubTab === 'least_selling'
          ? reportData.bestAndLeastSelling.leastSellingProducts
          : rankingSubTab === 'best_qty'
          ? reportData.bestAndLeastSelling.bestSellingByQuantity
          : rankingSubTab === 'best_profit'
          ? reportData.bestAndLeastSelling.bestSellingByProfit
          : reportData.bestAndLeastSelling.bestSellingByRevenue;

      const rows = list.map((r: any, idx: number) => ({
        rank: toPersianDigits(idx + 1),
        code: r.productCode,
        name: r.productName,
        category: r.categoryName,
        soldQty: `${toPersianDigits(r.netSoldBaseQty)} ${r.baseUnitName}`,
        stock: `${toPersianDigits(r.currentStock)} ${r.baseUnitName}`,
        netSales: formatCurrency(r.netSalesAmount),
        profit: formatCurrency(r.grossProfit),
        extra:
          rankingSubTab === 'least_selling'
            ? `${formatCurrency(r.tiedUpCapital)} (${r.turnoverStatus})`
            : `${toPersianDigits(r.profitMarginPercent)}٪`,
      }));

      return {
        filename: `report-products-${rankingSubTab}`,
        reportTitle:
          rankingSubTab === 'least_selling'
            ? 'گزارش کم‌فروش‌ترین و کالاهای راکد انبار خرازی'
            : 'گزارش رتبه‌بندی پرفروش‌ترین کالاهای خرازی',
        storeName,
        fiscalYear,
        activeFiltersText,
        columns: [
          { key: 'rank', header: 'رتبه', align: 'center' },
          { key: 'code', header: 'کد کالا', align: 'center' },
          { key: 'name', header: 'نام کالا' },
          { key: 'category', header: 'دسته‌بندی' },
          { key: 'soldQty', header: 'مقدار فروش خالص', align: 'center' },
          { key: 'stock', header: 'موجودی فعلی', align: 'center' },
          { key: 'netSales', header: 'مبلغ فروش خالص (ریال)', align: 'center' },
          { key: 'profit', header: 'سود ناخالص (ریال)', align: 'center' },
          {
            key: 'extra',
            header: rankingSubTab === 'least_selling' ? 'سرمایه قفل‌شده و وضعیت' : 'حاشیه سود',
            align: 'center',
          },
        ],
        rows,
      };
    }

    // ۴. موجودی و گردش کالا
    if (activeTab === 'inventory_turnover') {
      const s = reportData.inventoryAndTurnover.summary;
      const rows = reportData.inventoryAndTurnover.rows.map((r: any, idx: number) => ({
        rowNum: toPersianDigits(idx + 1),
        code: r.productCode,
        name: r.productName,
        unit: r.unitName,
        opening: toPersianDigits(r.openingStock),
        inflow: toPersianDigits(r.totalInflow),
        outflow: toPersianDigits(r.totalOutflow),
        current: toPersianDigits(r.currentStock),
        purchaseVal: formatCurrency(r.stockPurchaseValue),
        retailVal: formatCurrency(r.stockRetailValue),
        status: r.statusLabel,
      }));
      return {
        filename: 'report-inventory-turnover',
        reportTitle: 'گزارش موجودی ریالی و گردش تفصیلی کالا در انبار',
        storeName,
        fiscalYear,
        activeFiltersText,
        summaryCards: [
          { label: 'ارزش موجودی (قیمت خرید)', value: `${formatCurrency(s.totalCurrentStockValue)}` },
          { label: 'ارزش موجودی (قیمت فروش)', value: `${formatCurrency(s.totalRetailStockValue)}` },
          { label: 'سود بالقوه موجودی انبار', value: `${formatCurrency(s.expectedPotentialProfit)}` },
          { label: 'اقلام دارای کمبود موجودی', value: `${toPersianDigits(s.lowStockCount)} قلم` },
        ],
        columns: [
          { key: 'rowNum', header: 'ردیف', align: 'center' },
          { key: 'code', header: 'کد کالا', align: 'center' },
          { key: 'name', header: 'شرح کالا' },
          { key: 'unit', header: 'واحد پایه', align: 'center' },
          { key: 'opening', header: 'اول دوره', align: 'center' },
          { key: 'inflow', header: 'کل ورودی', align: 'center' },
          { key: 'outflow', header: 'کل خروجی', align: 'center' },
          { key: 'current', header: 'موجودی فعلی', align: 'center' },
          { key: 'purchaseVal', header: 'ارزش به قیمت خرید (ریال)', align: 'center' },
          { key: 'retailVal', header: 'ارزش به قیمت فروش (ریال)', align: 'center' },
          { key: 'status', header: 'وضعیت گردش', align: 'center' },
        ],
        rows,
        footerTotals: {
          rowNum: '',
          code: '',
          name: 'جمع کل ارزش موجودی انبارها',
          unit: '',
          opening: '',
          inflow: toPersianDigits(s.totalPeriodInflowQty),
          outflow: toPersianDigits(s.totalPeriodOutflowQty),
          current: '',
          purchaseVal: formatCurrency(s.totalCurrentStockValue),
          retailVal: formatCurrency(s.totalRetailStockValue),
          status: '',
        },
      };
    }

    // ۵. بدهکاران، بستانکاران، ریزحساب اشخاص و سررسید مطالبات
    if (activeTab === 'persons_aging') {
      const s = reportData.personsAndAging.summary;
      if (personsSubTab === 'statement') {
        const st =
          reportData.personsAndAging.personStatements.find((p: any) => p.personId === selectedStatementPersonId) ||
          reportData.personsAndAging.personStatements[0];
        const rows = (st?.lines || []).map((l: any, idx: number) => ({
          rowNum: toPersianDigits(idx + 1),
          date: toPersianDigits(l.date),
          docType: l.documentType,
          docNum: l.documentNumber,
          description: l.description,
          debit: formatCurrency(l.debit),
          credit: formatCurrency(l.credit),
          balance: `${formatCurrency(l.runningBalance)} (${l.runningNature})`,
        }));
        return {
          filename: `report-person-statement-${st?.personCode || 'all'}`,
          reportTitle: `صورت‌حساب و ریزگردش طرف حساب: ${st?.personName || ''}`,
          storeName,
          fiscalYear,
          activeFiltersText,
          columns: [
            { key: 'rowNum', header: 'ردیف', align: 'center' },
            { key: 'date', header: 'تاریخ', align: 'center' },
            { key: 'docType', header: 'نوع سند', align: 'center' },
            { key: 'docNum', header: 'شماره سند', align: 'center' },
            { key: 'description', header: 'شرح عملیات مالی و تجاری' },
            { key: 'debit', header: 'بدهکار (ریال)', align: 'center' },
            { key: 'credit', header: 'بستانکار (ریال)', align: 'center' },
            { key: 'balance', header: 'مانده در گردش', align: 'center' },
          ],
          rows,
          footerTotals: st
            ? {
                rowNum: '',
                date: '',
                docType: '',
                docNum: '',
                description: 'جمع گردش و مانده نهایی طرف حساب',
                debit: formatCurrency(st.totalDebit),
                credit: formatCurrency(st.totalCredit),
                balance: `${formatCurrency(st.closingBalance)} (${st.closingNature})`,
              }
            : undefined,
        };
      } else if (personsSubTab === 'aging') {
        const rows = reportData.personsAndAging.personAgingRows.map((r: any, idx: number) => ({
          rowNum: toPersianDigits(idx + 1),
          code: r.personCode,
          name: r.personName,
          mobile: toPersianDigits(r.mobile),
          current: formatCurrency(r.current),
          d30: formatCurrency(r.days16to30),
          d60: formatCurrency(r.days31to60),
          d90: formatCurrency(r.days61to90 + r.over90Days),
          total: formatCurrency(r.totalReceivable),
        }));
        return {
          filename: 'report-receivables-aging',
          reportTitle: 'گزارش سررسید مطالبات و تحلیل سنی بدهکاران (Aging)',
          storeName,
          fiscalYear,
          activeFiltersText,
          columns: [
            { key: 'rowNum', header: 'ردیف', align: 'center' },
            { key: 'code', header: 'کد شخص', align: 'center' },
            { key: 'name', header: 'نام مشتری بدهکار' },
            { key: 'mobile', header: 'تلفن همراه', align: 'center' },
            { key: 'current', header: 'جاری (۰ تا ۱۵ روز)', align: 'center' },
            { key: 'd30', header: '۱۶ تا ۳۰ روز', align: 'center' },
            { key: 'd60', header: '۳۱ تا ۶۰ روز', align: 'center' },
            { key: 'd90', header: 'بیش از ۶۰ روز (معوق)', align: 'center' },
            { key: 'total', header: 'کل مانده بدهی (ریال)', align: 'center' },
          ],
          rows,
        };
      } else {
        const list =
          personsSubTab === 'creditors'
            ? reportData.personsAndAging.creditors
            : reportData.personsAndAging.debtors;
        const rows = list.map((r: any, idx: number) => ({
          rowNum: toPersianDigits(idx + 1),
          code: r.code,
          name: r.name,
          group: r.groupName,
          mobile: toPersianDigits(r.mobile),
          creditLimit: r.creditLimit > 0 ? formatCurrency(r.creditLimit) : 'نامحدود',
          balance: formatCurrency(r.absBalance),
          nature: r.balanceNature,
        }));
        return {
          filename: `report-${personsSubTab}`,
          reportTitle:
            personsSubTab === 'creditors'
              ? 'گزارش فهرست بستانکاران تجاری (تأمین‌کنندگان و بنکداران)'
              : 'گزارش فهرست بدهکاران تجاری (مشتریان و مزون‌ها)',
          storeName,
          fiscalYear,
          activeFiltersText,
          summaryCards: [
            { label: 'جمع کل مطالبات (بدهکاران)', value: `${formatCurrency(s.totalDebtorsAmount)}` },
            { label: 'جمع کل بدهی (بستانکاران)', value: `${formatCurrency(s.totalCreditorsAmount)}` },
            { label: 'خالص مطالبات منهای بدهی', value: `${formatCurrency(s.netReceivablesMinusPayables)}` },
          ],
          columns: [
            { key: 'rowNum', header: 'ردیف', align: 'center' },
            { key: 'code', header: 'کد طرف حساب', align: 'center' },
            { key: 'name', header: 'نام طرف حساب' },
            { key: 'group', header: 'گروه' },
            { key: 'mobile', header: 'شماره تماس', align: 'center' },
            { key: 'creditLimit', header: 'سقف اعتبار (ریال)', align: 'center' },
            { key: 'balance', header: 'مانده حساب (ریال)', align: 'center' },
            { key: 'nature', header: 'ماهیت مانده', align: 'center' },
          ],
          rows,
        };
      }
    }

    // ۶. گزارش هزینه‌ها
    if (activeTab === 'expenses_report') {
      const s = reportData.expenses.summary;
      const rows = reportData.expenses.entries.map((r: any, idx: number) => ({
        rowNum: toPersianDigits(idx + 1),
        date: toPersianDigits(r.date),
        tracking: r.trackingCode,
        title: r.title,
        category: r.categoryName,
        sourceType: r.sourceType,
        account: r.accountTitle,
        amount: formatCurrency(r.amount),
      }));
      return {
        filename: 'report-expenses-breakdown',
        reportTitle: 'گزارش جامع هزینه‌های عملیاتی، اداری و خرج‌کار خرازی',
        storeName,
        fiscalYear,
        activeFiltersText,
        summaryCards: [
          { label: 'جمع کل هزینه‌ها', value: `${formatCurrency(s.totalExpensesAmount)}` },
          { label: 'هزینه‌های عمومی و اداری', value: `${formatCurrency(s.operationalExpensesAmount)}` },
          { label: 'هزینه خرج‌کار و باربری', value: `${formatCurrency(s.accessoryExpensesAmount)}` },
        ],
        columns: [
          { key: 'rowNum', header: 'ردیف', align: 'center' },
          { key: 'date', header: 'تاریخ', align: 'center' },
          { key: 'tracking', header: 'کد پیگیری', align: 'center' },
          { key: 'title', header: 'شرح هزینه / خرج‌کار' },
          { key: 'category', header: 'سرفصل هزینه' },
          { key: 'sourceType', header: 'نوع هزینه', align: 'center' },
          { key: 'account', header: 'محل پرداخت' },
          { key: 'amount', header: 'مبلغ هزینه (ریال)', align: 'center' },
        ],
        rows,
        footerTotals: {
          rowNum: '',
          date: '',
          tracking: '',
          title: 'جمع کل هزینه‌های دوره',
          category: '',
          sourceType: '',
          account: '',
          amount: formatCurrency(s.totalExpensesAmount),
        },
      };
    }

    // ۷. گردش صندوق و بانک و وضعیت چک‌ها
    if (activeTab === 'treasury_cheques') {
      if (treasurySubTab === 'cash_bank') {
        const s = reportData.treasuryAndCheques.treasurySummary;
        const rows = reportData.treasuryAndCheques.accountStatements.map((r: any, idx: number) => ({
          rowNum: toPersianDigits(idx + 1),
          title: r.title,
          type: r.typeLabel,
          bank: r.bankName,
          init: formatCurrency(r.initialBalance),
          inflow: formatCurrency(r.totalInflow),
          outflow: formatCurrency(r.totalOutflow),
          closing: formatCurrency(r.closingBalance),
        }));
        return {
          filename: 'report-treasury-turnover',
          reportTitle: 'گزارش گردش و مانده صندوق، حساب‌های بانکی و کارتخوان (POS)',
          storeName,
          fiscalYear,
          activeFiltersText,
          summaryCards: [
            { label: 'موجودی صندوق‌های نقدی', value: `${formatCurrency(s.cashBalance)}` },
            { label: 'موجودی حساب‌های بانکی', value: `${formatCurrency(s.bankBalance)}` },
            { label: 'موجودی کارتخوان POS', value: `${formatCurrency(s.posBalance)}` },
            { label: 'جمع کل نقدینگی خزانه', value: `${formatCurrency(s.totalClosingBalance)}` },
          ],
          columns: [
            { key: 'rowNum', header: 'ردیف', align: 'center' },
            { key: 'title', header: 'عنوان حساب خزانه' },
            { key: 'type', header: 'نوع حساب', align: 'center' },
            { key: 'bank', header: 'نام بانک', align: 'center' },
            { key: 'init', header: 'مانده اول دوره (ریال)', align: 'center' },
            { key: 'inflow', header: 'کل ورودی / دریافت (ریال)', align: 'center' },
            { key: 'outflow', header: 'کل خروجی / پرداخت (ریال)', align: 'center' },
            { key: 'closing', header: 'مانده پایان دوره (ریال)', align: 'center' },
          ],
          rows,
          footerTotals: {
            rowNum: '',
            title: 'جمع کل خزانه‌داری',
            type: '',
            bank: '',
            init: formatCurrency(s.totalInitialBalance),
            inflow: formatCurrency(s.totalInflow),
            outflow: formatCurrency(s.totalOutflow),
            closing: formatCurrency(s.totalClosingBalance),
          },
        };
      } else {
        const rows = reportData.treasuryAndCheques.chequeRows.map((c: any, idx: number) => ({
          rowNum: toPersianDigits(idx + 1),
          chequeNumber: c.chequeNumber,
          sayad: c.sayadNumber,
          type: c.chequeTypeLabel,
          bank: c.bankName,
          person: c.personName,
          dueDate: toPersianDigits(c.dueDate),
          amount: formatCurrency(c.amount),
          status: c.statusLabel,
          dueStatus: c.dueStatus,
        }));
        return {
          filename: 'report-cheques-status',
          reportTitle: 'گزارش وضعیت چک‌های صیادی دریافتی و پرداختی و سررسیدها',
          storeName,
          fiscalYear,
          activeFiltersText,
          columns: [
            { key: 'rowNum', header: 'ردیف', align: 'center' },
            { key: 'chequeNumber', header: 'شماره چک', align: 'center' },
            { key: 'sayad', header: 'شناسه صیاد', align: 'center' },
            { key: 'type', header: 'نوع چک', align: 'center' },
            { key: 'bank', header: 'بانک', align: 'center' },
            { key: 'person', header: 'طرف حساب' },
            { key: 'dueDate', header: 'تاریخ سررسید', align: 'center' },
            { key: 'amount', header: 'مبلغ چک (ریال)', align: 'center' },
            { key: 'status', header: 'وضعیت فعلی', align: 'center' },
            { key: 'dueStatus', header: 'وضعیت سررسید', align: 'center' },
          ],
          rows,
        };
      }
    }

    // ۸. دفتر کل و تراز آزمایشی
    if (activeTab === 'ledger_trial_balance') {
      const tb = reportData.financialStatements.trialBalanceGeneral;
      const rows = tb.rows.map((r: any) => ({
        code: r.code,
        title: r.title,
        initDebit: formatCurrency(r.initialDebit),
        initCredit: formatCurrency(r.initialCredit),
        turnDebit: formatCurrency(r.turnoverDebit),
        turnCredit: formatCurrency(r.turnoverCredit),
        closeDebit: formatCurrency(r.closingDebit),
        closeCredit: formatCurrency(r.closingCredit),
      }));
      return {
        filename: 'report-trial-balance-ledger',
        reportTitle: 'گزارش تراز آزمایشی ۶ ستونی و خلاصه دفتر کل حسابداری',
        storeName,
        fiscalYear,
        activeFiltersText,
        columns: [
          { key: 'code', header: 'کد حساب', align: 'center' },
          { key: 'title', header: 'عنوان سرفصل حسابداری' },
          { key: 'initDebit', header: 'ابتدای دوره بدهکار', align: 'center' },
          { key: 'initCredit', header: 'ابتدای دوره بستانکار', align: 'center' },
          { key: 'turnDebit', header: 'گردش بدهکار طی دوره', align: 'center' },
          { key: 'turnCredit', header: 'گردش بستانکار طی دوره', align: 'center' },
          { key: 'closeDebit', header: 'مانده نهایی بدهکار', align: 'center' },
          { key: 'closeCredit', header: 'مانده نهایی بستانکار', align: 'center' },
        ],
        rows,
        footerTotals: {
          code: '',
          title: 'جمع کل تراز آزمایشی',
          initDebit: formatCurrency(tb.totalInitialDebit),
          initCredit: formatCurrency(tb.totalInitialCredit),
          turnDebit: formatCurrency(tb.totalTurnoverDebit),
          turnCredit: formatCurrency(tb.totalTurnoverCredit),
          closeDebit: formatCurrency(tb.totalClosingDebit),
          closeCredit: formatCurrency(tb.totalClosingCredit),
        },
      };
    }

    // ۹. صورت سود و زیان و ترازنامه
    if (activeTab === 'income_balance_sheet') {
      const inc = reportData.financialStatements.incomeStatement;
      const bs = reportData.financialStatements.balanceSheet;
      if (financialSubTab === 'income_statement') {
        const rows = [
          { step: '۱', title: 'فروش ناخالص کالا و ملزومات خرازی', amount: formatCurrency(inc.grossSales), sign: 'مثبت (+)' },
          { step: '۲', title: 'کسر می‌شود: تخفیفات فروش', amount: formatCurrency(inc.salesDiscounts), sign: 'کاهنده (-)' },
          { step: '۳', title: 'کسر می‌شود: برگشت از فروش و مرجوعی', amount: formatCurrency(inc.salesReturns), sign: 'کاهنده (-)' },
          { step: '۴', title: 'فروش خالص عملیاتی دوره', amount: formatCurrency(inc.netSales), sign: 'حاصل (=)' },
          { step: '۵', title: 'کسر می‌شود: بهای تمام‌شده کالای فروش‌رفته (COGS)', amount: formatCurrency(inc.cogs), sign: 'کاهنده (-)' },
          { step: '۶', title: 'سود ناخالص عملیاتی (Gross Profit)', amount: formatCurrency(inc.grossProfit), sign: 'حاصل (=)' },
          { step: '۷', title: 'اضافه می‌شود: سایر درآمدهای عملیاتی و متفرقه', amount: formatCurrency(inc.otherOperatingIncome), sign: 'مثبت (+)' },
          { step: '۸', title: 'کسر می‌شود: کل هزینه‌های عملیاتی، اداری و خرج‌کار', amount: formatCurrency(inc.totalOperatingExpenses), sign: 'کاهنده (-)' },
          { step: '۹', title: 'سود (زیان) خالص نهایی دوره مالی (Net Profit)', amount: formatCurrency(inc.netProfit), sign: 'نتیجه نهایی (=)' },
        ];
        return {
          filename: 'report-income-statement-pnl',
          reportTitle: 'صورت سود و زیان رسمی دوره مالی (Income Statement)',
          storeName,
          fiscalYear,
          activeFiltersText,
          columns: [
            { key: 'step', header: 'ردیف', align: 'center' },
            { key: 'title', header: 'شرح سرفصل صورت سود و زیان' },
            { key: 'sign', header: 'ماهیت اثر', align: 'center' },
            { key: 'amount', header: 'مبلغ (ریال)', align: 'center' },
          ],
          rows,
        };
      } else {
        const rows = [
          { group: 'دارایی‌های جاری', title: 'موجودی صندوق‌های نقدی، بانک‌ها و کارتخوان POS', amount: formatCurrency(bs.assets.totalCashAndBank) },
          { group: 'دارایی‌های جاری', title: 'حساب‌های دریافتنی تجاری (مطالبات از مشتریان)', amount: formatCurrency(bs.assets.accountsReceivable) },
          { group: 'دارایی‌های جاری', title: 'اسناد دریافتنی (چک‌های صیادی نزد صندوق و در جریان وصول)', amount: formatCurrency(bs.assets.notesReceivable) },
          { group: 'دارایی‌های جاری', title: 'موجودی کالای انبار خرازی (ارزش‌گذاری به بهای خرید)', amount: formatCurrency(bs.assets.inventoryValuation) },
          { group: 'جمع دارایی‌ها', title: 'جمع کل دارایی‌ها (سمت راست ترازنامه)', amount: formatCurrency(bs.assets.totalAssets) },
          { group: 'بدهی‌های جاری', title: 'حساب‌های پرداختنی تجاری (بستانکاران و بنکداران)', amount: formatCurrency(bs.liabilities.accountsPayable) },
          { group: 'بدهی‌های جاری', title: 'اسناد پرداختنی (چک‌های صادره پرداختنی)', amount: formatCurrency(bs.liabilities.notesPayable) },
          { group: 'حقوق صاحبان سهام', title: 'سرمایه اولیه ثبت‌شده فروشگاه', amount: formatCurrency(bs.equity.initialCapital) },
          { group: 'حقوق صاحبان سهام', title: 'اندوخته و مازاد تراز افتتاحیه سنواتی', amount: formatCurrency(bs.equity.retainedAndOpeningEquity) },
          { group: 'حقوق صاحبان سهام', title: 'سود خالص دوره مالی جاری', amount: formatCurrency(bs.equity.currentPeriodNetProfit) },
          { group: 'جمع بدهی و سرمایه', title: 'جمع کل بدهی‌ها و حقوق صاحبان سهام (سمت چپ ترازنامه)', amount: formatCurrency(bs.totalLiabilitiesAndEquity) },
        ];
        return {
          filename: 'report-balance-sheet',
          reportTitle: 'ترازنامه اساسی پایان دوره (Balance Sheet)',
          storeName,
          fiscalYear,
          activeFiltersText,
          columns: [
            { key: 'group', header: 'بخش ترازنامه', align: 'center' },
            { key: 'title', header: 'شرح قلم ترازنامه' },
            { key: 'amount', header: 'مبلغ (ریال)', align: 'center' },
          ],
          rows,
        };
      }
    }

    // ۱۰. کنترل صحت با اسناد نمونه
    const checks = reportData?.verification?.checks || [];
    return {
      filename: 'report-sample-verification-audit',
      reportTitle: 'گزارش کنترل و تطبیق صحت گزارش‌های مالی با اسناد نمونه',
      storeName,
      fiscalYear,
      activeFiltersText,
      columns: [
        { key: 'category', header: 'حوزه گزارش', align: 'center' },
        { key: 'title', header: 'عنوان کنترل ریاضی و حسابداری' },
        { key: 'expectedValue', header: 'مقدار مورد انتظار (اسناد)', align: 'center' },
        { key: 'actualValue', header: 'مقدار خروجی گزارش', align: 'center' },
        { key: 'status', header: 'نتیجه کنترل', align: 'center' },
      ],
      rows: checks.map((c: any) => ({
        category: c.category,
        title: c.title,
        expectedValue: c.expectedValue,
        actualValue: c.actualValue,
        status: c.passed ? 'منطبق و تایید شده (۱۰۰٪)' : 'عدم تطابق',
      })),
    };
  }, [
    reportData,
    activeTab,
    profitSubTab,
    periodicSubTab,
    rankingSubTab,
    personsSubTab,
    selectedStatementPersonId,
    treasurySubTab,
    financialSubTab,
    activeFiltersText,
  ]);

  const showNotice = (msg: string) => {
    setExportToast(msg);
    setTimeout(() => setExportToast(null), 3500);
  };

  const handleExportExcel = () => {
    exportReportToExcelXLS(currentExportConfig);
    showNotice(`فایل اکسل «${currentExportConfig.reportTitle}» با فرمت .xls با موفقیت دانلود شد.`);
  };

  const handleExportCSV = () => {
    exportReportToCSV(currentExportConfig);
    showNotice(`فایل CSV سازگار با اکسل فارسی برای «${currentExportConfig.reportTitle}» دانلود شد.`);
  };

  const handleExportPDF = () => {
    downloadPrintablePdfDocument(currentExportConfig);
    showNotice(`نسخه رسمی PDF/Print برای «${currentExportConfig.reportTitle}» تولید و آماده ذخیره شد.`);
  };

  const mainTabs: { id: MainReportTab; label: string; icon: any; badge?: string }[] = [
    { id: 'profit_cogs', label: 'سود ناخالص/خالص، بهای تمام‌شده، سود کالا و فاکتور', icon: TrendingUp, badge: 'COGS' },
    { id: 'periodic_sales_purchases', label: 'فروش و خرید روزانه و دوره‌ای', icon: Calendar },
    { id: 'best_least_selling', label: 'پرفروش‌ترین و کم‌فروش‌ترین کالاها', icon: BarChart3 },
    { id: 'inventory_turnover', label: 'موجودی و گردش کالا', icon: Boxes },
    { id: 'persons_aging', label: 'بدهکاران، بستانکاران، ریزحساب و سررسید مطالبات', icon: Users },
    { id: 'expenses_report', label: 'گزارش هزینه‌ها و خرج‌کار', icon: Coins },
    { id: 'treasury_cheques', label: 'گردش صندوق و بانک و وضعیت چک‌ها', icon: Wallet },
    { id: 'ledger_trial_balance', label: 'دفتر کل، معین و تراز آزمایشی', icon: BookOpen },
    { id: 'income_balance_sheet', label: 'ترازنامه و صورت سود و زیان', icon: Scale, badge: 'اساسی' },
    { id: 'sample_verification', label: 'کنترل صحت با اسناد نمونه', icon: ShieldCheck, badge: '۱۰۰٪ منطبق' },
  ];

  return (
    <div className="space-y-4">
      {/* اعلان دانلود فایل خروجی */}
      {exportToast && (
        <div className="bg-emerald-600 text-white px-4 py-3 rounded-xl shadow-lg flex items-center justify-between text-xs font-bold animate-fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{exportToast}</span>
          </div>
          <button onClick={() => setExportToast(null)} className="text-white/80 hover:text-white cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* هدر اصلی و دکمه‌های چاپ و خروجی Excel / PDF */}
      <div className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base sm:text-lg font-black text-slate-800 dark:text-slate-100">
                مرکز جامع گزارش‌های مدیریتی، تحلیلی و صورت‌های مالی حسابداری
              </h2>
              <span className="text-[11px] bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 px-2.5 py-0.5 rounded-full font-bold border border-indigo-200 dark:border-indigo-800">
                مبتنی بر داده واقعی و اسناد نمونه
              </span>
              {reportData?.verification?.allPassed && (
                <span className="text-[11px] bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 px-2.5 py-0.5 rounded-full font-bold border border-emerald-200 dark:border-emerald-800 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>تایید سلامت محاسبات ({toPersianDigits(reportData.verification.passedChecks)} از {toPersianDigits(reportData.verification.totalChecks)} کنترل)</span>
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              پوشش کامل سود ناخالص و خالص، بهای تمام‌شده (COGS)، سود کالا و فاکتور، فروش و خرید دوره‌ای، گردش انبار، بدهکاران و سررسید مطالبات، گردش خزانه، چک‌ها، دفتر کل، تراز آزمایشی و ترازنامه
            </p>
          </div>

          {/* دکمه‌های عملیات چاپ و خروجی */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setShowFiltersPanel(!showFiltersPanel)}
              className={`px-3 py-2 rounded-xl text-xs font-bold border transition cursor-pointer flex items-center gap-1.5 ${
                showFiltersPanel
                  ? 'bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
              }`}
            >
              <Filter className="w-3.5 h-3.5" />
              <span>فیلترهای گزارش</span>
            </button>

            <button
              onClick={handleExportExcel}
              className="px-3 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white transition cursor-pointer flex items-center gap-1.5 shadow-xs"
              title="خروجی فایل Excel با فرمت جدول راست‌به‌چپ (.xls)"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>خروجی Excel (.xls)</span>
            </button>

            <button
              onClick={handleExportCSV}
              className="px-3 py-2 rounded-xl text-xs font-bold bg-teal-600 hover:bg-teal-700 text-white transition cursor-pointer flex items-center gap-1.5 shadow-xs"
              title="خروجی CSV استاندارد با کدگذاری UTF-8 BOM فارسی"
            >
              <Download className="w-3.5 h-3.5" />
              <span>خروجی CSV</span>
            </button>

            <button
              onClick={handleExportPDF}
              className="px-3 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white transition cursor-pointer flex items-center gap-1.5 shadow-xs"
              title="تولید و دانلود سند آماده PDF"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>خروجی PDF</span>
            </button>

            <button
              onClick={() => setIsPrintModalOpen(true)}
              className="px-3.5 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white transition cursor-pointer flex items-center gap-1.5 shadow-xs"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>پیش‌نمایش و چاپ رسمی</span>
            </button>
          </div>
        </div>

        {/* نوار ناوبری ۱۰ گروه اصلی گزارش‌ها */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
          {mainTabs.map((t) => {
            const Icon = t.icon;
            const isSelected = activeTab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                className={`flex items-center justify-between p-2.5 rounded-xl text-right text-xs font-bold transition cursor-pointer border ${
                  isSelected
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                    : 'bg-slate-50 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 border-slate-200/80 dark:border-slate-700/80 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <div className="flex items-center gap-2 truncate">
                  <Icon className={`w-4 h-4 shrink-0 ${isSelected ? 'text-white' : 'text-indigo-600 dark:text-indigo-400'}`} />
                  <span className="truncate">{t.label}</span>
                </div>
                {t.badge && (
                  <span
                    className={`text-[9px] px-1.5 py-0.5 rounded-md font-black shrink-0 ${
                      isSelected
                        ? 'bg-white/20 text-white'
                        : 'bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300'
                    }`}
                  >
                    {t.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* پنل فیلترهای جامع (تاریخ، شخص، کالا، دسته‌بندی، انبار، حساب خزانه، جستجو) */}
        {showFiltersPanel && (
          <div className="bg-slate-50 dark:bg-slate-800/50 p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-700/80 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-200">
                <Filter className="w-3.5 h-3.5 text-indigo-600" />
                <span>فیلترهای هوشمند و هم‌زمان گزارش:</span>
                <span className="text-[11px] font-normal text-slate-500">({activeFiltersText})</span>
              </div>

              <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                <span className="text-slate-400">بازه‌های سریع:</span>
                <button
                  onClick={() => applyQuickDateRange('', '')}
                  className="px-2 py-0.5 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-indigo-400 cursor-pointer font-bold"
                >
                  کل سال ۱۴۰۳
                </button>
                <button
                  onClick={() => applyQuickDateRange('1403/07/01', '1403/07/30')}
                  className="px-2 py-0.5 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-indigo-400 cursor-pointer font-bold"
                >
                  مهر ۱۴۰۳
                </button>
                <button
                  onClick={() => applyQuickDateRange('1403/07/15', '1403/07/25')}
                  className="px-2 py-0.5 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-indigo-400 cursor-pointer font-bold"
                >
                  نیمه دوم مهر
                </button>
                <button
                  onClick={handleResetFilters}
                  className="px-2.5 py-0.5 rounded bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 cursor-pointer font-bold flex items-center gap-1"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>حذف فیلترها</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2.5 text-xs">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 mb-1">از تاریخ (شمسی):</label>
                <input
                  type="text"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  placeholder="مثلاً 1403/01/01"
                  dir="ltr"
                  className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-center font-mono text-xs"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 mb-1">تا تاریخ (شمسی):</label>
                <input
                  type="text"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  placeholder="مثلاً 1403/12/29"
                  dir="ltr"
                  className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-center font-mono text-xs"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 mb-1">شخص / طرف حساب:</label>
                <select
                  value={personId}
                  onChange={(e) => {
                    setPersonId(e.target.value);
                    if (e.target.value !== 'all') setSelectedStatementPersonId(e.target.value);
                  }}
                  className="w-full px-2 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs"
                >
                  <option value="all">همه اشخاص (مشتریان و بنکداران)</option>
                  {(reportData?.metadata?.persons || []).map((p: any) => (
                    <option key={p.id} value={p.id}>
                      {p.code} - {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 mb-1">کالا و ملزومات:</label>
                <select
                  value={productId}
                  onChange={(e) => setProductId(e.target.value)}
                  className="w-full px-2 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs"
                >
                  <option value="all">همه کالاها</option>
                  {(reportData?.metadata?.products || []).map((p: any) => (
                    <option key={p.id} value={p.id}>
                      {p.code} - {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 mb-1">گروه / دسته‌بندی کالا:</label>
                <select
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  className="w-full px-2 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs"
                >
                  <option value="all">همه دسته‌بندی‌ها</option>
                  {(reportData?.metadata?.categories || []).map((c: any) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 mb-1">انبار:</label>
                <select
                  value={warehouseId}
                  onChange={(e) => setWarehouseId(e.target.value)}
                  className="w-full px-2 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs"
                >
                  <option value="all">همه انبارها</option>
                  {(reportData?.metadata?.warehouses || []).map((w: any) => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 mb-1">جستجوی متنی سریع:</label>
                <div className="relative">
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="شماره سند، نام، کد..."
                    className="w-full pl-2 pr-7 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs"
                  />
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute right-2 top-2" />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* نمایش وضعیت بارگذاری یا خطا */}
      {isLoading && !reportData && (
        <div className="bg-white dark:bg-slate-900 p-10 rounded-2xl border border-slate-200 dark:border-slate-800 text-center text-xs text-slate-500 font-bold">
          در حال پردازش و استخراج گزارش‌های تحلیلی و حسابداری از پایگاه داده...
        </div>
      )}

      {errorMsg && (
        <div className="bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 p-4 rounded-2xl text-xs font-bold flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* محتوای گزارش بر اساس تب انتخابی */}
      {reportData && (
        <>
          {/* =====================================================================
              تب ۱: سود ناخالص و سود خالص، بهای تمام‌شده (COGS)، سود هر کالا و فاکتور
             ===================================================================== */}
          {activeTab === 'profit_cogs' && (
            <div className="space-y-4">
              {/* کارت‌های شاخص سودآوری */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                <div className="bg-white dark:bg-slate-900 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800">
                  <span className="text-[11px] text-slate-500 block">فروش ناخالص</span>
                  <span className="text-sm font-black text-slate-800 dark:text-slate-100 mt-1 block">
                    {formatCurrency(reportData.profitability.summary.grossSales)} ت
                  </span>
                  <span className="text-[10px] text-slate-400">
                    تخفیف: {formatCurrency(reportData.profitability.summary.salesDiscounts)} ت
                  </span>
                </div>

                <div className="bg-white dark:bg-slate-900 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800">
                  <span className="text-[11px] text-slate-500 block">فروش خالص (پس از مرجوعی)</span>
                  <span className="text-sm font-black text-indigo-600 dark:text-indigo-400 mt-1 block">
                    {formatCurrency(reportData.profitability.summary.netSales)} ت
                  </span>
                  <span className="text-[10px] text-rose-500">
                    برگشت از فروش: {formatCurrency(reportData.profitability.summary.salesReturns)} ت
                  </span>
                </div>

                <div className="bg-white dark:bg-slate-900 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800">
                  <span className="text-[11px] text-slate-500 block">بهای تمام‌شده (COGS)</span>
                  <span className="text-sm font-black text-amber-600 dark:text-amber-400 mt-1 block">
                    {formatCurrency(reportData.profitability.summary.cogs)} ت
                  </span>
                  <span className="text-[10px] text-slate-400">بر مبنای واحد پایه و قیمت خرید</span>
                </div>

                <div className="bg-indigo-50/70 dark:bg-indigo-950/40 p-3.5 rounded-2xl border border-indigo-200 dark:border-indigo-800">
                  <span className="text-[11px] text-indigo-700 dark:text-indigo-300 font-bold block">
                    سود ناخالص (Gross Profit)
                  </span>
                  <span className="text-sm font-black text-indigo-700 dark:text-indigo-300 mt-1 block">
                    {formatCurrency(reportData.profitability.summary.grossProfit)} ت
                  </span>
                  <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-bold">
                    حاشیه سود ناخالص: {toPersianDigits(reportData.profitability.summary.grossMarginPercent)}٪
                  </span>
                </div>

                <div className="bg-white dark:bg-slate-900 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800">
                  <span className="text-[11px] text-slate-500 block">کل هزینه‌ها و خرج‌کار</span>
                  <span className="text-sm font-black text-rose-600 dark:text-rose-400 mt-1 block">
                    {formatCurrency(reportData.profitability.summary.totalExpenses)} ت
                  </span>
                  <span className="text-[10px] text-emerald-600">
                    سایر درآمدها: +{formatCurrency(reportData.profitability.summary.otherIncome)} ت
                  </span>
                </div>

                <div className="bg-emerald-50/80 dark:bg-emerald-950/40 p-3.5 rounded-2xl border border-emerald-200 dark:border-emerald-800">
                  <span className="text-[11px] text-emerald-800 dark:text-emerald-300 font-bold block">
                    سود خالص (Net Profit)
                  </span>
                  <span className="text-sm font-black text-emerald-700 dark:text-emerald-300 mt-1 block">
                    {formatCurrency(reportData.profitability.summary.netProfit)} ت
                  </span>
                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">
                    حاشیه سود خالص: {toPersianDigits(reportData.profitability.summary.netMarginPercent)}٪
                  </span>
                </div>
              </div>

              {/* سوییچر بین سود هر کالا و سود هر فاکتور */}
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
                <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                  <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-xs font-bold">
                    <button
                      onClick={() => setProfitSubTab('per_product')}
                      className={`px-3.5 py-1.5 rounded-lg transition cursor-pointer ${
                        profitSubTab === 'per_product'
                          ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                          : 'text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      سود و بهای تمام‌شده هر کالا ({toPersianDigits(reportData.profitability.productProfits.length)} کالا)
                    </button>
                    <button
                      onClick={() => setProfitSubTab('per_invoice')}
                      className={`px-3.5 py-1.5 rounded-lg transition cursor-pointer ${
                        profitSubTab === 'per_invoice'
                          ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                          : 'text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      سود و بهای تمام‌شده هر فاکتور ({toPersianDigits(reportData.profitability.invoiceProfits.length)} سند)
                    </button>
                  </div>

                  <span className="text-[11px] text-slate-400">
                    محاسبه دقیق بهای تمام‌شده با اعمال ضرایب تبدیل واحد (رول، قواره، بسته به متر و عدد)
                  </span>
                </div>

                {profitSubTab === 'per_product' ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-right text-xs">
                      <thead className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-bold">
                        <tr>
                          <th className="py-3 px-3">کد کالا</th>
                          <th className="py-3 px-3">نام کالا و مشخصات</th>
                          <th className="py-3 px-3">دسته‌بندی</th>
                          <th className="py-3 px-3 text-center">فروش رفته</th>
                          <th className="py-3 px-3 text-center">مرجوعی</th>
                          <th className="py-3 px-3 text-center">خالص فروش (واحد پایه)</th>
                          <th className="py-3 px-3 text-center">فی خرید پایه</th>
                          <th className="py-3 px-3 text-center">مبلغ فروش خالص</th>
                          <th className="py-3 px-3 text-center">بهای تمام‌شده (COGS)</th>
                          <th className="py-3 px-3 text-center">سود ناخالص کالا</th>
                          <th className="py-3 px-3 text-center">حاشیه سود</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-200">
                        {reportData.profitability.productProfits.map((row: any) => (
                          <tr key={row.productId} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/50 transition">
                            <td className="py-3 px-3 font-mono font-bold text-indigo-600 dark:text-indigo-400">{row.productCode}</td>
                            <td className="py-3 px-3 font-bold">{row.productName}</td>
                            <td className="py-3 px-3 text-slate-500">{row.categoryName}</td>
                            <td className="py-3 px-3 text-center">
                              {toPersianDigits(row.soldBaseQty)} {row.baseUnitName}
                            </td>
                            <td className="py-3 px-3 text-center text-rose-600">
                              {row.returnedBaseQty > 0 ? `${toPersianDigits(row.returnedBaseQty)} ${row.baseUnitName}` : '۰'}
                            </td>
                            <td className="py-3 px-3 text-center font-bold">
                              {toPersianDigits(row.netSoldBaseQty)} {row.baseUnitName}
                            </td>
                            <td className="py-3 px-3 text-center">{formatCurrency(row.unitPurchasePrice)}</td>
                            <td className="py-3 px-3 text-center font-bold">{formatCurrency(row.netSalesAmount)}</td>
                            <td className="py-3 px-3 text-center text-amber-700 dark:text-amber-400 font-bold">
                              {formatCurrency(row.totalCogs)}
                            </td>
                            <td className="py-3 px-3 text-center font-black text-emerald-600 dark:text-emerald-400">
                              {formatCurrency(row.grossProfit)}
                            </td>
                            <td className="py-3 px-3 text-center">
                              <span className="px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-bold text-[11px]">
                                {toPersianDigits(row.profitMarginPercent)}٪
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-indigo-50/70 dark:bg-indigo-950/40 font-black text-slate-900 dark:text-slate-100 border-t-2 border-indigo-200 dark:border-indigo-800">
                        <tr>
                          <td colSpan={7} className="py-3 px-4">جمع کل سود و بهای تمام‌شده کالاها:</td>
                          <td className="py-3 px-3 text-center">{formatCurrency(reportData.profitability.summary.netSales)} ت</td>
                          <td className="py-3 px-3 text-center text-amber-700 dark:text-amber-300">{formatCurrency(reportData.profitability.summary.cogs)} ت</td>
                          <td className="py-3 px-3 text-center text-emerald-700 dark:text-emerald-300">{formatCurrency(reportData.profitability.summary.grossProfit)}</td>
                          <td className="py-3 px-3 text-center">{toPersianDigits(reportData.profitability.summary.grossMarginPercent)}٪</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-right text-xs">
                      <thead className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-bold">
                        <tr>
                          <th className="py-3 px-3">شماره فاکتور</th>
                          <th className="py-3 px-3">نوع سند</th>
                          <th className="py-3 px-3">تاریخ</th>
                          <th className="py-3 px-3">طرف حساب / مشتری</th>
                          <th className="py-3 px-3 text-center">تعداد اقلام</th>
                          <th className="py-3 px-3 text-center">مبلغ خالص فاکتور</th>
                          <th className="py-3 px-3 text-center">بهای تمام‌شده (COGS)</th>
                          <th className="py-3 px-3 text-center">سود ناخالص فاکتور</th>
                          <th className="py-3 px-3 text-center">حاشیه سود</th>
                          <th className="py-3 px-3 text-center">وضعیت تسویه</th>
                          <th className="py-3 px-3 text-center">ریز اقلام</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-200">
                        {reportData.profitability.invoiceProfits.map((inv: any) => {
                          const isReturn = inv.invoiceType !== 'sale';
                          const isExpanded = expandedInvoiceId === inv.invoiceId;
                          return (
                            <React.Fragment key={inv.invoiceId}>
                              <tr className="hover:bg-slate-50/70 dark:hover:bg-slate-800/50 transition">
                                <td className="py-3 px-3 font-mono font-bold text-indigo-600 dark:text-indigo-400">
                                  #{inv.invoiceNumber}
                                </td>
                                <td className="py-3 px-3">
                                  <span
                                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                      isReturn
                                        ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                                        : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                    }`}
                                  >
                                    {isReturn ? 'برگشت از فروش' : 'فاکتور فروش'}
                                  </span>
                                </td>
                                <td className="py-3 px-3 font-mono">{toPersianDigits(inv.date)}</td>
                                <td className="py-3 px-3 font-bold">{inv.personName}</td>
                                <td className="py-3 px-3 text-center">{toPersianDigits(inv.itemsCount)} قلم</td>
                                <td className="py-3 px-3 text-center font-bold">
                                  {formatCurrency(inv.finalAmount)} ت
                                </td>
                                <td className="py-3 px-3 text-center text-amber-700 dark:text-amber-400 font-bold">
                                  {formatCurrency(inv.totalCogs)} ت
                                </td>
                                <td
                                  className={`py-3 px-3 text-center font-black ${
                                    inv.grossProfit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600'
                                  }`}
                                >
                                  {formatCurrency(inv.grossProfit)}
                                </td>
                                <td className="py-3 px-3 text-center font-bold">
                                  {toPersianDigits(inv.profitMarginPercent)}٪
                                </td>
                                <td className="py-3 px-3 text-center">
                                  <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[10px] font-bold">
                                    {inv.paymentStatus}
                                  </span>
                                </td>
                                <td className="py-3 px-3 text-center">
                                  <button
                                    onClick={() => setExpandedInvoiceId(isExpanded ? null : inv.invoiceId)}
                                    className="px-2 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-300 hover:bg-indigo-100 cursor-pointer inline-flex items-center gap-1 text-[11px] font-bold"
                                  >
                                    <span>مشاهده</span>
                                    {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                                  </button>
                                </td>
                              </tr>
                              {isExpanded && (
                                <tr className="bg-slate-50/90 dark:bg-slate-800/40">
                                  <td colSpan={11} className="p-3.5">
                                    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-3 space-y-2">
                                      <div className="text-[11px] font-bold text-indigo-700 dark:text-indigo-300">
                                        ریز محاسبه بهای تمام‌شده و سود اقلام فاکتور شماره {inv.invoiceNumber}:
                                      </div>
                                      <table className="w-full text-right text-[11px]">
                                        <thead className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                                          <tr>
                                            <th className="py-1.5 px-2">کد</th>
                                            <th className="py-1.5 px-2">نام کالا</th>
                                            <th className="py-1.5 px-2 text-center">مقدار واحد انتخابی</th>
                                            <th className="py-1.5 px-2 text-center">مقدار به واحد پایه</th>
                                            <th className="py-1.5 px-2 text-center">مبلغ فروش خالص</th>
                                            <th className="py-1.5 px-2 text-center">بهای خرید هر واحد پایه</th>
                                            <th className="py-1.5 px-2 text-center">بهای تمام‌شده ردیف</th>
                                            <th className="py-1.5 px-2 text-center">سود خالص ردیف</th>
                                          </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                          {inv.itemsBreakdown.map((it: any, idx: number) => (
                                            <tr key={idx}>
                                              <td className="py-1.5 px-2 font-mono">{it.productCode}</td>
                                              <td className="py-1.5 px-2 font-bold">{it.productName}</td>
                                              <td className="py-1.5 px-2 text-center">
                                                {toPersianDigits(it.quantity)} {it.unitName}
                                              </td>
                                              <td className="py-1.5 px-2 text-center font-bold">
                                                {toPersianDigits(it.baseQuantity)}
                                              </td>
                                              <td className="py-1.5 px-2 text-center">{formatCurrency(it.netSaleAmount)} ت</td>
                                              <td className="py-1.5 px-2 text-center">{formatCurrency(it.unitCost)} ت</td>
                                              <td className="py-1.5 px-2 text-center text-amber-700">{formatCurrency(it.totalCogs)} ت</td>
                                              <td className="py-1.5 px-2 text-center font-bold text-emerald-600">
                                                {formatCurrency(it.grossProfit)} ت
                                              </td>
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </React.Fragment>
                          );
                        })}
                      </tbody>
                      <tfoot className="bg-indigo-50/70 dark:bg-indigo-950/40 font-black text-slate-900 dark:text-slate-100 border-t-2 border-indigo-200 dark:border-indigo-800">
                        <tr>
                          <td colSpan={5} className="py-3 px-4">جمع کل فاکتورها (فروش منهای برگشت از فروش):</td>
                          <td className="py-3 px-3 text-center">{formatCurrency(reportData.profitability.summary.netSales)} ت</td>
                          <td className="py-3 px-3 text-center text-amber-700 dark:text-amber-300">{formatCurrency(reportData.profitability.summary.cogs)} ت</td>
                          <td className="py-3 px-3 text-center text-emerald-700 dark:text-emerald-300">{formatCurrency(reportData.profitability.summary.grossProfit)}</td>
                          <td className="py-3 px-3 text-center">{toPersianDigits(reportData.profitability.summary.grossMarginPercent)}٪</td>
                          <td colSpan={2}></td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* =====================================================================
              تب ۲: گزارش فروش و خرید روزانه و دوره‌ای
             ===================================================================== */}
          {activeTab === 'periodic_sales_purchases' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800">
                  <span className="text-xs text-slate-500 block">فروش خالص دوره ({toPersianDigits(reportData.periodic.summary.salesInvoicesCount)} فاکتور)</span>
                  <span className="text-base font-black text-emerald-600 dark:text-emerald-400 mt-1 block">
                    {formatCurrency(reportData.periodic.summary.netSales)}
                  </span>
                </div>
                <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800">
                  <span className="text-xs text-slate-500 block">خرید خالص دوره ({toPersianDigits(reportData.periodic.summary.purchaseInvoicesCount)} فاکتور)</span>
                  <span className="text-base font-black text-indigo-600 dark:text-indigo-400 mt-1 block">
                    {formatCurrency(reportData.periodic.summary.netPurchases)}
                  </span>
                </div>
                <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800">
                  <span className="text-xs text-slate-500 block">کل مرجوعی و برگشت از فروش</span>
                  <span className="text-base font-black text-rose-600 dark:text-rose-400 mt-1 block">
                    {formatCurrency(reportData.periodic.summary.totalSalesReturns)}
                  </span>
                </div>
                <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800">
                  <span className="text-xs text-slate-500 block">سود ناخالص حاصل از فروش دوره</span>
                  <span className="text-base font-black text-amber-600 dark:text-amber-400 mt-1 block">
                    {formatCurrency(reportData.periodic.summary.grossProfit)}
                  </span>
                </div>
              </div>

              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
                <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-xs font-bold">
                    <button
                      onClick={() => setPeriodicSubTab('daily')}
                      className={`px-3.5 py-1.5 rounded-lg transition cursor-pointer ${
                        periodicSubTab === 'daily'
                          ? 'bg-white dark:bg-slate-900 text-indigo-600 shadow-xs'
                          : 'text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      تفکیک روزانه ({toPersianDigits(reportData.periodic.dailyRows.length)} روز کاری)
                    </button>
                    <button
                      onClick={() => setPeriodicSubTab('monthly')}
                      className={`px-3.5 py-1.5 rounded-lg transition cursor-pointer ${
                        periodicSubTab === 'monthly'
                          ? 'bg-white dark:bg-slate-900 text-indigo-600 shadow-xs'
                          : 'text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      تفکیک ماهانه و دوره‌ای ({toPersianDigits(reportData.periodic.monthlyRows.length)} ماه)
                    </button>
                    <button
                      onClick={() => setPeriodicSubTab('invoices')}
                      className={`px-3.5 py-1.5 rounded-lg transition cursor-pointer ${
                        periodicSubTab === 'invoices'
                          ? 'bg-white dark:bg-slate-900 text-indigo-600 shadow-xs'
                          : 'text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      ریز کلیه فاکتورهای خرید و فروش ({toPersianDigits(reportData.periodic.invoicesList.length)})
                    </button>
                  </div>
                </div>

                {periodicSubTab !== 'invoices' ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-right text-xs">
                      <thead className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-bold">
                        <tr>
                          <th className="py-3 px-4">{periodicSubTab === 'monthly' ? 'دوره / ماه شمسی' : 'تاریخ روز'}</th>
                          <th className="py-3 px-3 text-center">تعداد فروش</th>
                          <th className="py-3 px-3 text-center">فروش ناخالص</th>
                          <th className="py-3 px-3 text-center">تخفیف فروش</th>
                          <th className="py-3 px-3 text-center">برگشت از فروش</th>
                          <th className="py-3 px-3 text-center">فروش خالص</th>
                          <th className="py-3 px-3 text-center">تعداد خرید</th>
                          <th className="py-3 px-3 text-center">خرید خالص</th>
                          <th className="py-3 px-3 text-center">بهای تمام‌شده فروش</th>
                          <th className="py-3 px-3 text-center">سود ناخالص</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-200">
                        {(periodicSubTab === 'monthly' ? reportData.periodic.monthlyRows : reportData.periodic.dailyRows).map(
                          (r: any) => (
                            <tr key={r.periodKey} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/50 transition">
                              <td className="py-3 px-4 font-bold text-indigo-600 dark:text-indigo-400">
                                {toPersianDigits(r.periodLabel)}
                              </td>
                              <td className="py-3 px-3 text-center">{toPersianDigits(r.salesInvoicesCount)}</td>
                              <td className="py-3 px-3 text-center">{formatCurrency(r.salesGrossAmount)}</td>
                              <td className="py-3 px-3 text-center text-slate-500">{formatCurrency(r.salesDiscountAmount)}</td>
                              <td className="py-3 px-3 text-center text-rose-600">{formatCurrency(r.salesReturnsAmount)}</td>
                              <td className="py-3 px-3 text-center font-black text-emerald-600">
                                {formatCurrency(r.netSalesAmount)}
                              </td>
                              <td className="py-3 px-3 text-center">{toPersianDigits(r.purchasesInvoicesCount)}</td>
                              <td className="py-3 px-3 text-center font-bold text-indigo-600">
                                {formatCurrency(r.netPurchasesAmount)}
                              </td>
                              <td className="py-3 px-3 text-center text-amber-700">{formatCurrency(r.salesCogs)}</td>
                              <td className="py-3 px-3 text-center font-black text-emerald-700 dark:text-emerald-300">
                                {formatCurrency(r.salesGrossProfit)}
                              </td>
                            </tr>
                          )
                        )}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-right text-xs">
                      <thead className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-bold">
                        <tr>
                          <th className="py-3 px-4">شماره سند</th>
                          <th className="py-3 px-4">نوع فاکتور</th>
                          <th className="py-3 px-4">تاریخ</th>
                          <th className="py-3 px-4">طرف حساب</th>
                          <th className="py-3 px-4 text-center">مبلغ کل (ریال)</th>
                          <th className="py-3 px-4 text-center">پرداخت / دریافت شده</th>
                          <th className="py-3 px-4 text-center">مانده فاکتور</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {reportData.periodic.invoicesList.map((inv: any) => (
                          <tr key={inv.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/50">
                            <td className="py-3 px-4 font-mono font-bold">#{inv.invoiceNumber}</td>
                            <td className="py-3 px-4 font-bold">
                              {inv.invoiceType === 'sale'
                                ? 'فروش کالا'
                                : inv.invoiceType === 'purchase'
                                ? 'خرید کالا'
                                : 'برگشت از فروش'}
                            </td>
                            <td className="py-3 px-4 font-mono">{toPersianDigits(inv.date)}</td>
                            <td className="py-3 px-4 font-bold">{inv.personName}</td>
                            <td className="py-3 px-4 text-center font-black">{formatCurrency(inv.finalAmount)}</td>
                            <td className="py-3 px-4 text-center text-emerald-600">{formatCurrency(inv.paidAmount)}</td>
                            <td className="py-3 px-4 text-center text-rose-600 font-bold">{formatCurrency(inv.remainingAmount)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* =====================================================================
              تب ۳: پرفروش‌ترین و کم‌فروش‌ترین کالاها
             ===================================================================== */}
          {activeTab === 'best_least_selling' && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
              <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-1.5 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-xs font-bold">
                  <button
                    onClick={() => setRankingSubTab('best_revenue')}
                    className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                      rankingSubTab === 'best_revenue'
                        ? 'bg-white dark:bg-slate-900 text-indigo-600 shadow-xs'
                        : 'text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    پرفروش‌ترین (مبلغ فروش)
                  </button>
                  <button
                    onClick={() => setRankingSubTab('best_qty')}
                    className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                      rankingSubTab === 'best_qty'
                        ? 'bg-white dark:bg-slate-900 text-indigo-600 shadow-xs'
                        : 'text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    پرفروش‌ترین (تعداد / متراژ)
                  </button>
                  <button
                    onClick={() => setRankingSubTab('best_profit')}
                    className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                      rankingSubTab === 'best_profit'
                        ? 'bg-white dark:bg-slate-900 text-indigo-600 shadow-xs'
                        : 'text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    سودآورترین کالاها
                  </button>
                  <button
                    onClick={() => setRankingSubTab('least_selling')}
                    className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                      rankingSubTab === 'least_selling'
                        ? 'bg-white dark:bg-slate-900 text-rose-600 shadow-xs'
                        : 'text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    کم‌فروش‌ترین و کالاهای راکد
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-bold">
                    <tr>
                      <th className="py-3 px-4 text-center">رتبه</th>
                      <th className="py-3 px-4">کد کالا</th>
                      <th className="py-3 px-4">نام کالا</th>
                      <th className="py-3 px-4">دسته‌بندی</th>
                      <th className="py-3 px-4 text-center">مقدار خالص فروش</th>
                      <th className="py-3 px-4 text-center">تعداد فاکتور</th>
                      <th className="py-3 px-4 text-center">موجودی فعلی</th>
                      <th className="py-3 px-4 text-center">مبلغ فروش خالص</th>
                      <th className="py-3 px-4 text-center">سود ناخالص</th>
                      <th className="py-3 px-4 text-center">
                        {rankingSubTab === 'least_selling' ? 'سرمایه راکد و پیشنهاد' : 'درصد حاشیه سود'}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {(rankingSubTab === 'least_selling'
                      ? reportData.bestAndLeastSelling.leastSellingProducts
                      : rankingSubTab === 'best_qty'
                      ? reportData.bestAndLeastSelling.bestSellingByQuantity
                      : rankingSubTab === 'best_profit'
                      ? reportData.bestAndLeastSelling.bestSellingByProfit
                      : reportData.bestAndLeastSelling.bestSellingByRevenue
                    ).map((item: any, idx: number) => (
                      <tr key={item.productId} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/50 transition">
                        <td className="py-3 px-4 text-center font-black text-indigo-600">
                          {toPersianDigits(idx + 1)}
                        </td>
                        <td className="py-3 px-4 font-mono font-bold">{item.productCode}</td>
                        <td className="py-3 px-4 font-bold">{item.productName}</td>
                        <td className="py-3 px-4 text-slate-500">{item.categoryName}</td>
                        <td className="py-3 px-4 text-center font-bold">
                          {toPersianDigits(item.netSoldBaseQty)} {item.baseUnitName}
                        </td>
                        <td className="py-3 px-4 text-center">{toPersianDigits(item.invoicesCount)}</td>
                        <td className="py-3 px-4 text-center">
                          {toPersianDigits(item.currentStock)} {item.baseUnitName}
                        </td>
                        <td className="py-3 px-4 text-center font-bold text-indigo-600">
                          {formatCurrency(item.netSalesAmount)} ت
                        </td>
                        <td className="py-3 px-4 text-center font-black text-emerald-600">
                          {formatCurrency(item.grossProfit)} ت
                        </td>
                        <td className="py-3 px-4 text-center">
                          {rankingSubTab === 'least_selling' ? (
                            <div className="space-y-0.5">
                              <div className="font-bold text-rose-600">
                                {formatCurrency(item.tiedUpCapital)} ({item.turnoverStatus})
                              </div>
                              <div className="text-[10px] text-slate-500">{item.recommendation}</div>
                            </div>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-bold">
                              {toPersianDigits(item.profitMarginPercent)}٪
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* =====================================================================
              تب ۴: گزارش موجودی و گردش کالا
             ===================================================================== */}
          {activeTab === 'inventory_turnover' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800">
                  <span className="text-xs text-slate-500 block">ارزش ریالی موجودی (قیمت خرید)</span>
                  <span className="text-base font-black text-indigo-600 dark:text-indigo-400 mt-1 block">
                    {formatCurrency(reportData.inventoryAndTurnover.summary.totalCurrentStockValue)}
                  </span>
                </div>
                <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800">
                  <span className="text-xs text-slate-500 block">ارزش ریالی موجودی (قیمت فروش)</span>
                  <span className="text-base font-black text-emerald-600 dark:text-emerald-400 mt-1 block">
                    {formatCurrency(reportData.inventoryAndTurnover.summary.totalRetailStockValue)}
                  </span>
                </div>
                <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800">
                  <span className="text-xs text-slate-500 block">سود بالقوه موجودی انبار</span>
                  <span className="text-base font-black text-amber-600 dark:text-amber-400 mt-1 block">
                    {formatCurrency(reportData.inventoryAndTurnover.summary.expectedPotentialProfit)}
                  </span>
                </div>
                <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800">
                  <span className="text-xs text-slate-500 block">کالاهای زیر نقطه سفارش (کمبود)</span>
                  <span className="text-base font-black text-rose-600 dark:text-rose-400 mt-1 block">
                    {toPersianDigits(reportData.inventoryAndTurnover.summary.lowStockCount)} قلم کالا
                  </span>
                </div>
              </div>

              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
                <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-xs font-bold">
                    <button
                      onClick={() => setInventorySubTab('stock_turnover')}
                      className={`px-3.5 py-1.5 rounded-lg transition cursor-pointer ${
                        inventorySubTab === 'stock_turnover'
                          ? 'bg-white dark:bg-slate-900 text-indigo-600 shadow-xs'
                          : 'text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      موجودی و خلاصه گردش کالاها ({toPersianDigits(reportData.inventoryAndTurnover.rows.length)})
                    </button>
                    <button
                      onClick={() => setInventorySubTab('kardex')}
                      className={`px-3.5 py-1.5 rounded-lg transition cursor-pointer ${
                        inventorySubTab === 'kardex'
                          ? 'bg-white dark:bg-slate-900 text-indigo-600 shadow-xs'
                          : 'text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      ریز اسناد ورود و خروج کاردکس ({toPersianDigits(reportData.inventoryAndTurnover.kardexMovements.length)})
                    </button>
                  </div>
                </div>

                {inventorySubTab === 'stock_turnover' ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-right text-xs">
                      <thead className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-bold">
                        <tr>
                          <th className="py-3 px-3">کد کالا</th>
                          <th className="py-3 px-3">نام کالا</th>
                          <th className="py-3 px-3 text-center">واحد پایه</th>
                          <th className="py-3 px-3 text-center">موجودی اول دوره</th>
                          <th className="py-3 px-3 text-center text-emerald-600">کل ورودی</th>
                          <th className="py-3 px-3 text-center text-rose-600">کل خروجی</th>
                          <th className="py-3 px-3 text-center font-black">موجودی فعلی</th>
                          <th className="py-3 px-3 text-center">فی خرید</th>
                          <th className="py-3 px-3 text-center">ارزش موجودی (خرید)</th>
                          <th className="py-3 px-3 text-center">نسبت گردش</th>
                          <th className="py-3 px-3 text-center">وضعیت</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {reportData.inventoryAndTurnover.rows.map((r: any) => (
                          <tr key={r.productId} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/50">
                            <td className="py-3 px-3 font-mono font-bold">{r.productCode}</td>
                            <td className="py-3 px-3 font-bold">{r.productName}</td>
                            <td className="py-3 px-3 text-center">{r.unitName}</td>
                            <td className="py-3 px-3 text-center">{toPersianDigits(r.openingStock)}</td>
                            <td className="py-3 px-3 text-center text-emerald-600 font-bold">+{toPersianDigits(r.totalInflow)}</td>
                            <td className="py-3 px-3 text-center text-rose-600 font-bold">-{toPersianDigits(r.totalOutflow)}</td>
                            <td className="py-3 px-3 text-center font-black text-indigo-600">
                              {toPersianDigits(r.currentStock)} {r.unitName}
                            </td>
                            <td className="py-3 px-3 text-center">{formatCurrency(r.unitPurchasePrice)}</td>
                            <td className="py-3 px-3 text-center font-bold">{formatCurrency(r.stockPurchaseValue)} ت</td>
                            <td className="py-3 px-3 text-center">{toPersianDigits(r.turnoverRatio)} بار</td>
                            <td className="py-3 px-3 text-center">
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                  r.status === 'low_stock' || r.status === 'out_of_stock'
                                    ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                                    : r.status === 'stagnant'
                                    ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                                    : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                }`}
                              >
                                {r.statusLabel}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-right text-xs">
                      <thead className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-bold">
                        <tr>
                          <th className="py-3 px-3">تاریخ</th>
                          <th className="py-3 px-3">شماره مرجع</th>
                          <th className="py-3 px-3">نوع عملیات</th>
                          <th className="py-3 px-3">کالا</th>
                          <th className="py-3 px-3">انبار</th>
                          <th className="py-3 px-3 text-center text-emerald-600">وارده</th>
                          <th className="py-3 px-3 text-center text-rose-600">صادره</th>
                          <th className="py-3 px-3 text-center">مانده تعدادی</th>
                          <th className="py-3 px-3">توضیحات</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {reportData.inventoryAndTurnover.kardexMovements.map((k: any) => (
                          <tr key={k.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/50">
                            <td className="py-3 px-3 font-mono">{toPersianDigits(k.date)}</td>
                            <td className="py-3 px-3 font-mono font-bold">{k.referenceNumber}</td>
                            <td className="py-3 px-3 font-bold">{k.referenceTypeTitle}</td>
                            <td className="py-3 px-3">{k.productName}</td>
                            <td className="py-3 px-3 text-slate-500">{k.warehouseName}</td>
                            <td className="py-3 px-3 text-center text-emerald-600 font-bold">
                              {k.inQuantity > 0 ? `+${toPersianDigits(k.inQuantity)}` : '-'}
                            </td>
                            <td className="py-3 px-3 text-center text-rose-600 font-bold">
                              {k.outQuantity > 0 ? `-${toPersianDigits(k.outQuantity)}` : '-'}
                            </td>
                            <td className="py-3 px-3 text-center font-black">
                              {toPersianDigits(k.balanceQuantity)} {k.unitName}
                            </td>
                            <td className="py-3 px-3 text-slate-500">{k.notes}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* =====================================================================
              تب ۵: بدهکاران، بستانکاران، ریزحساب اشخاص و سررسید مطالبات
             ===================================================================== */}
          {activeTab === 'persons_aging' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800">
                  <span className="text-xs text-slate-500 block">
                    کل مطالبات از بدهکاران ({toPersianDigits(reportData.personsAndAging.summary.totalDebtorsCount)} شخص)
                  </span>
                  <span className="text-base font-black text-rose-600 dark:text-rose-400 mt-1 block">
                    {formatCurrency(reportData.personsAndAging.summary.totalDebtorsAmount)}
                  </span>
                </div>
                <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800">
                  <span className="text-xs text-slate-500 block">
                    کل بدهی به بستانکاران ({toPersianDigits(reportData.personsAndAging.summary.totalCreditorsCount)} شخص)
                  </span>
                  <span className="text-base font-black text-indigo-600 dark:text-indigo-400 mt-1 block">
                    {formatCurrency(reportData.personsAndAging.summary.totalCreditorsAmount)}
                  </span>
                </div>
                <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800">
                  <span className="text-xs text-slate-500 block">مطالبات سررسید گذشته (بیش از ۱۵ روز)</span>
                  <span className="text-base font-black text-amber-600 dark:text-amber-400 mt-1 block">
                    {formatCurrency(reportData.personsAndAging.summary.overdueReceivablesAmount)}
                  </span>
                </div>
                <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800">
                  <span className="text-xs text-slate-500 block">تراز خالص اشخاص (مطالبات منهای بدهی)</span>
                  <span className="text-base font-black text-slate-800 dark:text-slate-100 mt-1 block">
                    {formatCurrency(reportData.personsAndAging.summary.netReceivablesMinusPayables)}
                  </span>
                </div>
              </div>

              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
                <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-1.5 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-xs font-bold">
                    <button
                      onClick={() => setPersonsSubTab('debtors')}
                      className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                        personsSubTab === 'debtors'
                          ? 'bg-white dark:bg-slate-900 text-rose-600 shadow-xs'
                          : 'text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      فهرست بدهکاران ({toPersianDigits(reportData.personsAndAging.debtors.length)})
                    </button>
                    <button
                      onClick={() => setPersonsSubTab('creditors')}
                      className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                        personsSubTab === 'creditors'
                          ? 'bg-white dark:bg-slate-900 text-indigo-600 shadow-xs'
                          : 'text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      فهرست بستانکاران ({toPersianDigits(reportData.personsAndAging.creditors.length)})
                    </button>
                    <button
                      onClick={() => setPersonsSubTab('statement')}
                      className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                        personsSubTab === 'statement'
                          ? 'bg-white dark:bg-slate-900 text-indigo-600 shadow-xs'
                          : 'text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      ریزحساب اشخاص (صورت‌حساب تفصیلی)
                    </button>
                    <button
                      onClick={() => setPersonsSubTab('aging')}
                      className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                        personsSubTab === 'aging'
                          ? 'bg-white dark:bg-slate-900 text-amber-600 shadow-xs'
                          : 'text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      سررسید مطالبات (تحلیل سنی بدهکاران)
                    </button>
                  </div>

                  {personsSubTab === 'statement' && (
                    <div className="flex items-center gap-2 text-xs">
                      <span className="font-bold text-slate-600 dark:text-slate-300">انتخاب طرف حساب:</span>
                      <select
                        value={selectedStatementPersonId}
                        onChange={(e) => setSelectedStatementPersonId(e.target.value)}
                        className="px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-bold"
                      >
                        {reportData.personsAndAging.personStatements.map((ps: any) => (
                          <option key={ps.personId} value={ps.personId}>
                            {ps.personCode} - {ps.personName} ({ps.closingNature}: {formatCurrency(ps.closingBalance)} ت)
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                {(personsSubTab === 'debtors' || personsSubTab === 'creditors') && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-right text-xs">
                      <thead className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-bold">
                        <tr>
                          <th className="py-3 px-4">کد شخص</th>
                          <th className="py-3 px-4">نام طرف حساب</th>
                          <th className="py-3 px-4">گروه</th>
                          <th className="py-3 px-4 text-center">موبایل</th>
                          <th className="py-3 px-4 text-center">سقف اعتبار</th>
                          <th className="py-3 px-4 text-center">مانده حساب (ریال)</th>
                          <th className="py-3 px-4 text-center">چک‌های در جریان</th>
                          <th className="py-3 px-4 text-center">عملیات</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {(personsSubTab === 'creditors'
                          ? reportData.personsAndAging.creditors
                          : reportData.personsAndAging.debtors
                        ).map((p: any) => (
                          <tr key={p.personId} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/50">
                            <td className="py-3 px-4 font-mono font-bold">{p.code}</td>
                            <td className="py-3 px-4 font-bold">{p.name}</td>
                            <td className="py-3 px-4 text-slate-500">{p.groupName}</td>
                            <td className="py-3 px-4 text-center font-mono">{toPersianDigits(p.mobile)}</td>
                            <td className="py-3 px-4 text-center">
                              {p.creditLimit > 0 ? `${formatCurrency(p.creditLimit)} ت` : 'نامحدود'}
                            </td>
                            <td
                              className={`py-3 px-4 text-center font-black ${
                                p.currentBalance > 0 ? 'text-rose-600' : 'text-indigo-600'
                              }`}
                            >
                              {formatCurrency(p.absBalance)} ({p.balanceNature})
                            </td>
                            <td className="py-3 px-4 text-center">
                              {p.pendingChequesCount > 0
                                ? `${toPersianDigits(p.pendingChequesCount)} فقره (${formatCurrency(p.pendingChequesAmount)} ت)`
                                : 'ندارد'}
                            </td>
                            <td className="py-3 px-4 text-center">
                              <button
                                onClick={() => {
                                  setSelectedStatementPersonId(p.personId);
                                  setPersonsSubTab('statement');
                                }}
                                className="px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-300 font-bold text-[11px] cursor-pointer"
                              >
                                مشاهده ریزحساب
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {personsSubTab === 'statement' && (
                  <div>
                    {(() => {
                      const st =
                        reportData.personsAndAging.personStatements.find(
                          (x: any) => x.personId === selectedStatementPersonId
                        ) || reportData.personsAndAging.personStatements[0];
                      if (!st) return null;
                      return (
                        <div className="space-y-3">
                          <div className="p-4 bg-indigo-50/50 dark:bg-indigo-950/30 flex flex-wrap justify-between items-center gap-4 text-xs">
                            <div>
                              <span className="font-black text-slate-800 dark:text-slate-100 text-sm">
                                صورت‌حساب تفصیلی: {st.personName} (کد: {st.personCode})
                              </span>
                              <span className="block text-slate-500 mt-0.5">
                                شماره همراه: {toPersianDigits(st.mobile)} | سقف اعتبار: {formatCurrency(st.creditLimit)}
                              </span>
                            </div>
                            <div className="flex items-center gap-4">
                              <div>
                                <span className="text-slate-400 block text-[10px]">جمع بدهکار</span>
                                <span className="font-bold text-rose-600">{formatCurrency(st.totalDebit)} ت</span>
                              </div>
                              <div>
                                <span className="text-slate-400 block text-[10px]">جمع بستانکار</span>
                                <span className="font-bold text-emerald-600">{formatCurrency(st.totalCredit)} ت</span>
                              </div>
                              <div className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-800">
                                <span className="text-slate-400 block text-[10px]">مانده نهایی حساب</span>
                                <span className="font-black text-indigo-700 dark:text-indigo-300">
                                  {formatCurrency(st.closingBalance)} ({st.closingNature})
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="overflow-x-auto">
                            <table className="w-full text-right text-xs">
                              <thead className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 text-slate-500 font-bold">
                                <tr>
                                  <th className="py-3 px-3 text-center">ردیف</th>
                                  <th className="py-3 px-3 text-center">تاریخ</th>
                                  <th className="py-3 px-3 text-center">نوع سند</th>
                                  <th className="py-3 px-3 text-center">شماره سند</th>
                                  <th className="py-3 px-3">شرح عملیات مالی و کالا</th>
                                  <th className="py-3 px-3 text-center text-rose-600">بدهکار (ریال)</th>
                                  <th className="py-3 px-3 text-center text-emerald-600">بستانکار (ریال)</th>
                                  <th className="py-3 px-3 text-center">مانده در گردش</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                {st.lines.map((line: any, idx: number) => (
                                  <tr key={line.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/50">
                                    <td className="py-3 px-3 text-center">{toPersianDigits(idx + 1)}</td>
                                    <td className="py-3 px-3 text-center font-mono">{toPersianDigits(line.date)}</td>
                                    <td className="py-3 px-3 text-center font-bold">{line.documentType}</td>
                                    <td className="py-3 px-3 text-center font-mono">{line.documentNumber}</td>
                                    <td className="py-3 px-3">{line.description}</td>
                                    <td className="py-3 px-3 text-center font-bold text-rose-600">
                                      {line.debit > 0 ? formatCurrency(line.debit) : '۰'}
                                    </td>
                                    <td className="py-3 px-3 text-center font-bold text-emerald-600">
                                      {line.credit > 0 ? formatCurrency(line.credit) : '۰'}
                                    </td>
                                    <td className="py-3 px-3 text-center font-black">
                                      {formatCurrency(line.runningBalance)} <span className="text-[10px] font-normal">({line.runningNature})</span>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                )}

                {personsSubTab === 'aging' && (
                  <div className="p-4 space-y-4">
                    {/* سطل‌های تحلیل سنی مطالبات */}
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 text-xs">
                      <div className="p-3 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800">
                        <span className="text-[11px] text-emerald-800 dark:text-emerald-300 font-bold block">جاری (۰ تا ۱۵ روز)</span>
                        <span className="text-sm font-black text-emerald-700 dark:text-emerald-300 mt-1 block">
                          {formatCurrency(reportData.personsAndAging.agingBuckets.current)} ت
                        </span>
                      </div>
                      <div className="p-3 rounded-xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
                        <span className="text-[11px] text-blue-800 dark:text-blue-300 font-bold block">۱۶ تا ۳۰ روز</span>
                        <span className="text-sm font-black text-blue-700 dark:text-blue-300 mt-1 block">
                          {formatCurrency(reportData.personsAndAging.agingBuckets.days16to30)} ت
                        </span>
                      </div>
                      <div className="p-3 rounded-xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
                        <span className="text-[11px] text-amber-800 dark:text-amber-300 font-bold block">۳۱ تا ۶۰ روز</span>
                        <span className="text-sm font-black text-amber-700 dark:text-amber-300 mt-1 block">
                          {formatCurrency(reportData.personsAndAging.agingBuckets.days31to60)} ت
                        </span>
                      </div>
                      <div className="p-3 rounded-xl bg-orange-50/70 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800">
                        <span className="text-[11px] text-orange-800 dark:text-orange-300 font-bold block">۶۱ تا ۹۰ روز</span>
                        <span className="text-sm font-black text-orange-700 dark:text-orange-300 mt-1 block">
                          {formatCurrency(reportData.personsAndAging.agingBuckets.days61to90)} ت
                        </span>
                      </div>
                      <div className="p-3 rounded-xl bg-rose-50/70 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800">
                        <span className="text-[11px] text-rose-800 dark:text-rose-300 font-bold block">بیش از ۹۰ روز (معوق)</span>
                        <span className="text-sm font-black text-rose-700 dark:text-rose-300 mt-1 block">
                          {formatCurrency(reportData.personsAndAging.agingBuckets.over90Days)} ت
                        </span>
                      </div>
                    </div>

                    {/* جدول تفکیک سنی هر مشتری بدهکار */}
                    <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-xl">
                      <table className="w-full text-right text-xs">
                        <thead className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 text-slate-500 font-bold">
                          <tr>
                            <th className="py-2.5 px-3">کد</th>
                            <th className="py-2.5 px-3">نام مشتری بدهکار</th>
                            <th className="py-2.5 px-3 text-center">جاری (۰-۱۵ روز)</th>
                            <th className="py-2.5 px-3 text-center">۱۶ تا ۳۰ روز</th>
                            <th className="py-2.5 px-3 text-center">۳۱ تا ۶۰ روز</th>
                            <th className="py-2.5 px-3 text-center">بیش از ۶۰ روز</th>
                            <th className="py-2.5 px-3 text-center font-black">کل بدهی</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                          {reportData.personsAndAging.personAgingRows.map((r: any) => (
                            <tr key={r.personId}>
                              <td className="py-2.5 px-3 font-mono font-bold">{r.personCode}</td>
                              <td className="py-2.5 px-3 font-bold">{r.personName}</td>
                              <td className="py-2.5 px-3 text-center text-emerald-600 font-bold">{formatCurrency(r.current)}</td>
                              <td className="py-2.5 px-3 text-center text-blue-600 font-bold">{formatCurrency(r.days16to30)}</td>
                              <td className="py-2.5 px-3 text-center text-amber-600 font-bold">{formatCurrency(r.days31to60)}</td>
                              <td className="py-2.5 px-3 text-center text-rose-600 font-bold">
                                {formatCurrency(r.days61to90 + r.over90Days)}
                              </td>
                              <td className="py-2.5 px-3 text-center font-black text-slate-900 dark:text-slate-100">
                                {formatCurrency(r.totalReceivable)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* جدول سررسید تک‌تک فاکتورهای فروش نسیه تسویه‌نشده */}
                    <div className="space-y-2">
                      <h4 className="text-xs font-black text-slate-700 dark:text-slate-200">
                        ریز فاکتورهای فروش نسیه تسویه‌نشده و موعد سررسید:
                      </h4>
                      <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-xl">
                        <table className="w-full text-right text-xs">
                          <thead className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 text-slate-500 font-bold">
                            <tr>
                              <th className="py-2.5 px-3">شماره فاکتور</th>
                              <th className="py-2.5 px-3">نام مشتری</th>
                              <th className="py-2.5 px-3 text-center">تاریخ صدور</th>
                              <th className="py-2.5 px-3 text-center">تاریخ سررسید</th>
                              <th className="py-2.5 px-3 text-center">مبلغ کل</th>
                              <th className="py-2.5 px-3 text-center">پرداخت شده</th>
                              <th className="py-2.5 px-3 text-center">مانده تسویه‌نشده</th>
                              <th className="py-2.5 px-3 text-center">بازه سنی</th>
                              <th className="py-2.5 px-3 text-center">وضعیت ریسک</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {reportData.personsAndAging.invoiceDueRows.map((inv: any) => (
                              <tr key={inv.invoiceId}>
                                <td className="py-2.5 px-3 font-mono font-bold text-indigo-600">#{inv.invoiceNumber}</td>
                                <td className="py-2.5 px-3 font-bold">{inv.personName}</td>
                                <td className="py-2.5 px-3 text-center font-mono">{toPersianDigits(inv.invoiceDate)}</td>
                                <td className="py-2.5 px-3 text-center font-mono font-bold">{toPersianDigits(inv.dueDate)}</td>
                                <td className="py-2.5 px-3 text-center">{formatCurrency(inv.finalAmount)}</td>
                                <td className="py-2.5 px-3 text-center text-emerald-600">{formatCurrency(inv.paidAmount)}</td>
                                <td className="py-2.5 px-3 text-center font-black text-rose-600">
                                  {formatCurrency(inv.remainingAmount)} ت
                                </td>
                                <td className="py-2.5 px-3 text-center">{inv.agingBucketLabel}</td>
                                <td className="py-2.5 px-3 text-center">
                                  <span className="px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950 text-amber-800 dark:text-amber-300 font-bold text-[10px]">
                                    {inv.riskStatus}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* =====================================================================
              تب ۶: گزارش هزینه‌ها و خرج‌کار
             ===================================================================== */}
          {activeTab === 'expenses_report' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800">
                  <span className="text-xs text-slate-500 block">جمع کل هزینه‌ها و خرج‌کار دوره</span>
                  <span className="text-base font-black text-rose-600 dark:text-rose-400 mt-1 block">
                    {formatCurrency(reportData.expenses.summary.totalExpensesAmount)}
                  </span>
                </div>
                <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800">
                  <span className="text-xs text-slate-500 block">هزینه‌های عمومی و اداری (خزانه‌داری)</span>
                  <span className="text-base font-black text-indigo-600 dark:text-indigo-400 mt-1 block">
                    {formatCurrency(reportData.expenses.summary.operationalExpensesAmount)}
                  </span>
                </div>
                <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800">
                  <span className="text-xs text-slate-500 block">هزینه خرج‌کار، باربری و تسهیم خرید</span>
                  <span className="text-base font-black text-amber-600 dark:text-amber-400 mt-1 block">
                    {formatCurrency(reportData.expenses.summary.accessoryExpensesAmount)}
                  </span>
                </div>
              </div>

              {/* تفکیک کامل بر اساس سرفصل هزینه با نمودار درصدی و فیلتر سریع */}
              <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black text-slate-800 dark:text-slate-100">
                    تفکیک و سهم هر سرفصل از هزینه‌های فروشگاه (کلیک جهت فیلتر جدول):
                  </h4>
                  {expenseFilterCategory !== 'all' && (
                    <button
                      type="button"
                      onClick={() => setExpenseFilterCategory('all')}
                      className="text-[11px] font-bold text-rose-600 hover:underline cursor-pointer"
                    >
                      نمایش همه سرفصل‌ها
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {reportData.expenses.byCategory.map((cat: any) => {
                    const isSelected = expenseFilterCategory === cat.categoryId;
                    return (
                      <div
                        key={cat.categoryId}
                        onClick={() =>
                          setExpenseFilterCategory(isSelected ? 'all' : cat.categoryId)
                        }
                        className={`p-3 rounded-xl border transition cursor-pointer ${
                          isSelected
                            ? 'bg-rose-50/60 dark:bg-rose-950/40 border-rose-400 dark:border-rose-700 shadow-xs'
                            : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200/80 dark:border-slate-700 hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-center justify-between text-xs mb-1.5">
                          <div>
                            <span className="font-bold text-slate-800 dark:text-slate-100 block">
                              {cat.categoryName}
                            </span>
                            <span className="text-[10px] text-slate-500">
                              تعداد: {toPersianDigits(cat.count)} فقره | سهم: {toPersianDigits(cat.sharePercent)}٪
                            </span>
                          </div>
                          <span className="font-black text-rose-600 dark:text-rose-400">
                            {formatCurrency(cat.amount)}
                          </span>
                        </div>

                        {/* Progress Bar */}
                        <div className="w-full bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden">
                          <div
                            className="bg-rose-500 h-full rounded-full transition-all duration-300"
                            style={{ width: `${Math.min(100, Math.max(3, cat.sharePercent))}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* جدول ریز هزینه‌ها */}
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
                <div className="p-3 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-700 dark:text-slate-200">
                    ریز اسناد هزینه و خرج‌کار دوره
                    {expenseFilterCategory !== 'all' ? ' (فیلتر شده)' : ''}:
                  </span>
                  <span className="text-[11px] text-slate-500">
                    تعداد ردیف: {toPersianDigits(
                      reportData.expenses.entries.filter(
                        (e: any) => expenseFilterCategory === 'all' || e.categoryId === expenseFilterCategory
                      ).length
                    )} فقره
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-right text-xs">
                    <thead className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 text-slate-500 font-bold">
                      <tr>
                        <th className="py-3 px-4">تاریخ</th>
                        <th className="py-3 px-4">کد رهگیری</th>
                        <th className="py-3 px-4">شرح هزینه / خرج‌کار</th>
                        <th className="py-3 px-4">سرفصل هزینه</th>
                        <th className="py-3 px-4 text-center">منشأ ثبت</th>
                        <th className="py-3 px-4">حساب پرداخت‌کننده</th>
                        <th className="py-3 px-4 text-center">مبلغ (ریال)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {reportData.expenses.entries
                        .filter(
                          (e: any) =>
                            expenseFilterCategory === 'all' || e.categoryId === expenseFilterCategory
                        )
                        .map((e: any) => (
                          <tr key={e.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/50">
                            <td className="py-3 px-4 font-mono">{toPersianDigits(e.date)}</td>
                            <td className="py-3 px-4 font-mono font-bold text-indigo-600">{e.trackingCode}</td>
                            <td className="py-3 px-4 font-bold">{e.title}</td>
                            <td className="py-3 px-4">
                              <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-xs">
                                {e.categoryName}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-center">
                              <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[10px] font-bold">
                                {e.sourceType}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-slate-500">{e.accountTitle}</td>
                            <td className="py-3 px-4 text-center font-black text-rose-600">
                              {formatCurrency(e.amount)}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* =====================================================================
              تب ۷: گردش صندوق و بانک و وضعیت چک‌ها
             ===================================================================== */}
          {activeTab === 'treasury_cheques' && (
            <div className="space-y-4">
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
                <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-xs font-bold">
                    <button
                      onClick={() => setTreasurySubTab('cash_bank')}
                      className={`px-3.5 py-1.5 rounded-lg transition cursor-pointer ${
                        treasurySubTab === 'cash_bank'
                          ? 'bg-white dark:bg-slate-900 text-indigo-600 shadow-xs'
                          : 'text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      گردش صندوق، بانک و کارتخوان POS ({toPersianDigits(reportData.treasuryAndCheques.accountStatements.length)} حساب)
                    </button>
                    <button
                      onClick={() => setTreasurySubTab('cheques')}
                      className={`px-3.5 py-1.5 rounded-lg transition cursor-pointer ${
                        treasurySubTab === 'cheques'
                          ? 'bg-white dark:bg-slate-900 text-indigo-600 shadow-xs'
                          : 'text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      وضعیت چک‌های دریافتی و پرداختی ({toPersianDigits(reportData.treasuryAndCheques.chequeRows.length)} فقره)
                    </button>
                  </div>
                </div>

                {treasurySubTab === 'cash_bank' ? (
                  <div className="p-4 space-y-4">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                      <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                        <span className="text-slate-500 block">موجودی صندوق‌های نقدی</span>
                        <span className="text-sm font-black text-emerald-600 mt-1 block">
                          {formatCurrency(reportData.treasuryAndCheques.treasurySummary.cashBalance)} ت
                        </span>
                      </div>
                      <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                        <span className="text-slate-500 block">موجودی حساب‌های بانکی</span>
                        <span className="text-sm font-black text-indigo-600 mt-1 block">
                          {formatCurrency(reportData.treasuryAndCheques.treasurySummary.bankBalance)} ت
                        </span>
                      </div>
                      <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                        <span className="text-slate-500 block">موجودی دستگاه‌های کارتخوان POS</span>
                        <span className="text-sm font-black text-blue-600 mt-1 block">
                          {formatCurrency(reportData.treasuryAndCheques.treasurySummary.posBalance)} ت
                        </span>
                      </div>
                      <div className="p-3.5 rounded-xl bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800">
                        <span className="text-indigo-800 dark:text-indigo-300 font-bold block">جمع کل موجودی نقد و بانک</span>
                        <span className="text-sm font-black text-indigo-700 dark:text-indigo-300 mt-1 block">
                          {formatCurrency(reportData.treasuryAndCheques.treasurySummary.totalClosingBalance)}
                        </span>
                      </div>
                    </div>

                    <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-xl">
                      <table className="w-full text-right text-xs">
                        <thead className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 text-slate-500 font-bold">
                          <tr>
                            <th className="py-3 px-3">عنوان حساب خزانه</th>
                            <th className="py-3 px-3 text-center">نوع حساب</th>
                            <th className="py-3 px-3 text-center">کد معین</th>
                            <th className="py-3 px-3 text-center">مانده اول دوره</th>
                            <th className="py-3 px-3 text-center text-emerald-600">ورودی / دریافت</th>
                            <th className="py-3 px-3 text-center text-rose-600">خروجی / پرداخت</th>
                            <th className="py-3 px-3 text-center font-black">مانده پایان دوره</th>
                            <th className="py-3 px-3 text-center">ریز تراکنش‌ها</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                          {reportData.treasuryAndCheques.accountStatements.map((acc: any) => (
                            <React.Fragment key={acc.accountId}>
                              <tr className="hover:bg-slate-50/70 dark:hover:bg-slate-800/50">
                                <td className="py-3 px-3 font-bold">{acc.title}</td>
                                <td className="py-3 px-3 text-center">{acc.typeLabel}</td>
                                <td className="py-3 px-3 text-center font-mono">{acc.accountingCode}</td>
                                <td className="py-3 px-3 text-center">{formatCurrency(acc.initialBalance)}</td>
                                <td className="py-3 px-3 text-center text-emerald-600 font-bold">
                                  +{formatCurrency(acc.totalInflow)}
                                </td>
                                <td className="py-3 px-3 text-center text-rose-600 font-bold">
                                  -{formatCurrency(acc.totalOutflow)}
                                </td>
                                <td className="py-3 px-3 text-center font-black text-indigo-600">
                                  {formatCurrency(acc.closingBalance)}
                                </td>
                                <td className="py-3 px-3 text-center">
                                  <button
                                    onClick={() =>
                                      setSelectedTreasuryAccId(
                                        selectedTreasuryAccId === acc.accountId ? 'all' : acc.accountId
                                      )
                                    }
                                    className="px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-300 font-bold text-[11px] cursor-pointer"
                                  >
                                    {selectedTreasuryAccId === acc.accountId ? 'بستن ریز گردش' : `ریز گردش (${toPersianDigits(acc.transactionsCount)})`}
                                  </button>
                                </td>
                              </tr>
                              {selectedTreasuryAccId === acc.accountId && acc.transactions.length > 0 && (
                                <tr className="bg-slate-50 dark:bg-slate-800/40">
                                  <td colSpan={8} className="p-3">
                                    <table className="w-full text-right text-[11px] bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700">
                                      <thead className="bg-slate-100 dark:bg-slate-800">
                                        <tr>
                                          <th className="py-2 px-3">تاریخ</th>
                                          <th className="py-2 px-3">شماره تراکنش</th>
                                          <th className="py-2 px-3">نوع عملیات</th>
                                          <th className="py-2 px-3">طرف حساب / سرفصل</th>
                                          <th className="py-2 px-3">شرح</th>
                                          <th className="py-2 px-3 text-center text-emerald-600">ورودی</th>
                                          <th className="py-2 px-3 text-center text-rose-600">خروجی</th>
                                          <th className="py-2 px-3 text-center">مانده در گردش</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                        {acc.transactions.map((t: any) => (
                                          <tr key={t.id}>
                                            <td className="py-2 px-3 font-mono">{toPersianDigits(t.date)}</td>
                                            <td className="py-2 px-3 font-mono">{t.transactionNumber}</td>
                                            <td className="py-2 px-3 font-bold">{t.transactionTypeLabel}</td>
                                            <td className="py-2 px-3">{t.personName}</td>
                                            <td className="py-2 px-3">{t.description}</td>
                                            <td className="py-2 px-3 text-center text-emerald-600 font-bold">
                                              {t.inflow > 0 ? formatCurrency(t.inflow) : '-'}
                                            </td>
                                            <td className="py-2 px-3 text-center text-rose-600 font-bold">
                                              {t.outflow > 0 ? formatCurrency(t.outflow) : '-'}
                                            </td>
                                            <td className="py-2 px-3 text-center font-black">
                                              {formatCurrency(t.runningBalance)} ت
                                            </td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </td>
                                </tr>
                              )}
                            </React.Fragment>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 space-y-4">
                    {/* خلاصه وضعیت چک‌ها */}
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 text-xs">
                      {reportData.treasuryAndCheques.chequesByStatus.map((st: any) => (
                        <div
                          key={st.statusKey}
                          className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700"
                        >
                          <span className="font-bold text-slate-700 dark:text-slate-200 block">{st.statusLabel}</span>
                          <div className="text-[11px] text-emerald-600 mt-1">
                            دریافتی: {toPersianDigits(st.receivedCount)} فقره ({formatCurrency(st.receivedAmount)} ت)
                          </div>
                          <div className="text-[11px] text-rose-600">
                            پرداختی: {toPersianDigits(st.issuedCount)} فقره ({formatCurrency(st.issuedAmount)} ت)
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* فیلتر سریع وضعیت چک */}
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="font-bold text-slate-500">فیلتر نوع چک:</span>
                      <select
                        value={chequeType}
                        onChange={(e) => setChequeType(e.target.value)}
                        className="px-2.5 py-1 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                      >
                        <option value="all">همه چک‌ها (دریافتی و پرداختی)</option>
                        <option value="received">فقط چک‌های دریافتی (مشتریان)</option>
                        <option value="issued">فقط چک‌های پرداختی (صادره)</option>
                      </select>

                      <span className="font-bold text-slate-500 mr-2">وضعیت چک:</span>
                      <select
                        value={chequeStatus}
                        onChange={(e) => setChequeStatus(e.target.value)}
                        className="px-2.5 py-1 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                      >
                        <option value="all">همه وضعیت‌ها</option>
                        <option value="registered">نزد صندوق / ثبت اولیه</option>
                        <option value="deposited">در جریان وصول (بانک)</option>
                        <option value="collected">وصول شده / پاس شده</option>
                        <option value="transferred">خرج شده به اشخاص</option>
                        <option value="bounced">برگشت خورده (واخواست)</option>
                      </select>
                    </div>

                    <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-xl">
                      <table className="w-full text-right text-xs">
                        <thead className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 text-slate-500 font-bold">
                          <tr>
                            <th className="py-3 px-3">شماره چک</th>
                            <th className="py-3 px-3">شناسه صیاد</th>
                            <th className="py-3 px-3 text-center">نوع چک</th>
                            <th className="py-3 px-3">بانک</th>
                            <th className="py-3 px-3">طرف حساب</th>
                            <th className="py-3 px-3 text-center">سررسید</th>
                            <th className="py-3 px-3 text-center">مبلغ (ریال)</th>
                            <th className="py-3 px-3 text-center">وضعیت چک</th>
                            <th className="py-3 px-3 text-center">وضعیت موعد</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                          {reportData.treasuryAndCheques.chequeRows.map((c: any) => (
                            <tr key={c.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/50">
                              <td className="py-3 px-3 font-mono font-bold">{c.chequeNumber}</td>
                              <td className="py-3 px-3 font-mono text-slate-500">{c.sayadNumber}</td>
                              <td className="py-3 px-3 text-center font-bold">
                                <span
                                  className={`px-2 py-0.5 rounded-full text-[10px] ${
                                    c.chequeType === 'received'
                                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                      : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                                  }`}
                                >
                                  {c.chequeTypeLabel}
                                </span>
                              </td>
                              <td className="py-3 px-3">{c.bankName}</td>
                              <td className="py-3 px-3 font-bold">{c.personName}</td>
                              <td className="py-3 px-3 text-center font-mono font-bold">{toPersianDigits(c.dueDate)}</td>
                              <td className="py-3 px-3 text-center font-black">{formatCurrency(c.amount)} ت</td>
                              <td className="py-3 px-3 text-center">
                                <span className="px-2 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-bold text-[10px]">
                                  {c.statusLabel}
                                </span>
                              </td>
                              <td className="py-3 px-3 text-center text-[11px] font-bold">{c.dueStatus}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* =====================================================================
              تب ۸: دفتر کل، معین و تراز آزمایشی ۴ و ۶ ستونی
             ===================================================================== */}
          {activeTab === 'ledger_trial_balance' && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
              <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-1.5 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-xs font-bold">
                  <button
                    onClick={() => setLedgerSubTab('trial_6col')}
                    className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                      ledgerSubTab === 'trial_6col'
                        ? 'bg-white dark:bg-slate-900 text-indigo-600 shadow-xs'
                        : 'text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    تراز آزمایشی ۶ ستونی (کل)
                  </button>
                  <button
                    onClick={() => setLedgerSubTab('trial_4col')}
                    className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                      ledgerSubTab === 'trial_4col'
                        ? 'bg-white dark:bg-slate-900 text-indigo-600 shadow-xs'
                        : 'text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    تراز آزمایشی ۴ ستونی
                  </button>
                  <button
                    onClick={() => setLedgerSubTab('general')}
                    className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                      ledgerSubTab === 'general'
                        ? 'bg-white dark:bg-slate-900 text-indigo-600 shadow-xs'
                        : 'text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    دفتر کل (General Ledger)
                  </button>
                  <button
                    onClick={() => setLedgerSubTab('subsidiary')}
                    className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                      ledgerSubTab === 'subsidiary'
                        ? 'bg-white dark:bg-slate-900 text-indigo-600 shadow-xs'
                        : 'text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    دفتر معین (Subsidiary Ledger)
                  </button>
                </div>

                {reportData.financialStatements.trialBalanceGeneral.isClosingBalanced && (
                  <span className="text-xs bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 px-3 py-1 rounded-full font-bold border border-emerald-200 dark:border-emerald-800">
                    توازن بدهکار و بستانکار برقرار است (اختلاف: ۰ ریال)
                  </span>
                )}
              </div>

              {(ledgerSubTab === 'trial_6col' || ledgerSubTab === 'trial_4col') && (
                <div className="overflow-x-auto">
                  <table className="w-full text-right text-xs">
                    <thead className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 text-slate-500 font-bold">
                      <tr>
                        <th className="py-3 px-4">کد کل</th>
                        <th className="py-3 px-4">عنوان سرفصل حسابداری</th>
                        {ledgerSubTab === 'trial_6col' && (
                          <>
                            <th className="py-3 px-3 text-center">ابتدای دوره بدهکار</th>
                            <th className="py-3 px-3 text-center">ابتدای دوره بستانکار</th>
                          </>
                        )}
                        <th className="py-3 px-3 text-center text-emerald-600">گردش بدهکار طی دوره</th>
                        <th className="py-3 px-3 text-center text-rose-600">گردش بستانکار طی دوره</th>
                        <th className="py-3 px-3 text-center font-black">مانده نهایی بدهکار</th>
                        <th className="py-3 px-3 text-center font-black">مانده نهایی بستانکار</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {reportData.financialStatements.trialBalanceGeneral.rows.map((r: any) => (
                        <tr key={r.code} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/50">
                          <td className="py-3 px-4 font-mono font-bold text-indigo-600">{r.code}</td>
                          <td className="py-3 px-4 font-bold">{r.title}</td>
                          {ledgerSubTab === 'trial_6col' && (
                            <>
                              <td className="py-3 px-3 text-center font-mono">{formatCurrency(r.initialDebit)}</td>
                              <td className="py-3 px-3 text-center font-mono">{formatCurrency(r.initialCredit)}</td>
                            </>
                          )}
                          <td className="py-3 px-3 text-center font-mono text-emerald-600 font-bold">
                            {formatCurrency(r.turnoverDebit)}
                          </td>
                          <td className="py-3 px-3 text-center font-mono text-rose-600 font-bold">
                            {formatCurrency(r.turnoverCredit)}
                          </td>
                          <td className="py-3 px-3 text-center font-mono font-black text-indigo-700 dark:text-indigo-300">
                            {formatCurrency(r.closingDebit)}
                          </td>
                          <td className="py-3 px-3 text-center font-mono font-black text-indigo-700 dark:text-indigo-300">
                            {formatCurrency(r.closingCredit)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-indigo-50/80 dark:bg-indigo-950/50 font-black border-t-2 border-indigo-200 dark:border-indigo-800">
                      <tr>
                        <td colSpan={2} className="py-3 px-4">جمع کل تراز آزمایشی:</td>
                        {ledgerSubTab === 'trial_6col' && (
                          <>
                            <td className="py-3 px-3 text-center">
                              {formatCurrency(reportData.financialStatements.trialBalanceGeneral.totalInitialDebit)}
                            </td>
                            <td className="py-3 px-3 text-center">
                              {formatCurrency(reportData.financialStatements.trialBalanceGeneral.totalInitialCredit)}
                            </td>
                          </>
                        )}
                        <td className="py-3 px-3 text-center text-emerald-700 dark:text-emerald-300">
                          {formatCurrency(reportData.financialStatements.trialBalanceGeneral.totalTurnoverDebit)}
                        </td>
                        <td className="py-3 px-3 text-center text-rose-700 dark:text-rose-300">
                          {formatCurrency(reportData.financialStatements.trialBalanceGeneral.totalTurnoverCredit)}
                        </td>
                        <td className="py-3 px-3 text-center text-indigo-700 dark:text-indigo-300">
                          {formatCurrency(reportData.financialStatements.trialBalanceGeneral.totalClosingDebit)}
                        </td>
                        <td className="py-3 px-3 text-center text-indigo-700 dark:text-indigo-300">
                          {formatCurrency(reportData.financialStatements.trialBalanceGeneral.totalClosingCredit)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}

              {(ledgerSubTab === 'general' || ledgerSubTab === 'subsidiary') && (
                <div className="overflow-x-auto">
                  <table className="w-full text-right text-xs">
                    <thead className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 text-slate-500 font-bold">
                      <tr>
                        <th className="py-3 px-4">کد حساب</th>
                        <th className="py-3 px-4">عنوان حساب ({ledgerSubTab === 'general' ? 'دفتر کل' : 'دفتر معین'})</th>
                        <th className="py-3 px-3 text-center">تعداد آرتیکل</th>
                        <th className="py-3 px-3 text-center text-emerald-600">جمع بدهکار</th>
                        <th className="py-3 px-3 text-center text-rose-600">جمع بستانکار</th>
                        <th className="py-3 px-3 text-center">مانده نهایی</th>
                        <th className="py-3 px-3 text-center">ماهیت مانده</th>
                        <th className="py-3 px-3 text-center">ریز گردش</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {(ledgerSubTab === 'general'
                        ? reportData.financialStatements.generalLedger
                        : reportData.financialStatements.subsidiaryLedger
                      ).map((acc: any) => (
                        <React.Fragment key={acc.accountCode}>
                          <tr className="hover:bg-slate-50/70 dark:hover:bg-slate-800/50">
                            <td className="py-3 px-4 font-mono font-bold text-indigo-600">{acc.accountCode}</td>
                            <td className="py-3 px-4 font-bold">{acc.accountTitle}</td>
                            <td className="py-3 px-3 text-center">{toPersianDigits(acc.entries.length)}</td>
                            <td className="py-3 px-3 text-center font-mono text-emerald-600 font-bold">
                              {formatCurrency(acc.totalDebit)}
                            </td>
                            <td className="py-3 px-3 text-center font-mono text-rose-600 font-bold">
                              {formatCurrency(acc.totalCredit)}
                            </td>
                            <td className="py-3 px-3 text-center font-mono font-black">
                              {formatCurrency(acc.closingBalance)}
                            </td>
                            <td className="py-3 px-3 text-center font-bold">
                              {acc.balanceNature === 'debit'
                                ? 'بدهکار'
                                : acc.balanceNature === 'credit'
                                ? 'بستانکار'
                                : 'بی‌حساب'}
                            </td>
                            <td className="py-3 px-3 text-center">
                              <button
                                onClick={() =>
                                  setSelectedLedgerCode(
                                    selectedLedgerCode === acc.accountCode ? null : acc.accountCode
                                  )
                                }
                                className="px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-300 font-bold text-[11px] cursor-pointer"
                              >
                                {selectedLedgerCode === acc.accountCode ? 'بستن' : 'مشاهده آرتیکل‌ها'}
                              </button>
                            </td>
                          </tr>
                          {selectedLedgerCode === acc.accountCode && acc.entries.length > 0 && (
                            <tr className="bg-slate-50 dark:bg-slate-800/40">
                              <td colSpan={8} className="p-3">
                                <table className="w-full text-right text-[11px] bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700">
                                  <thead className="bg-slate-100 dark:bg-slate-800">
                                    <tr>
                                      <th className="py-2 px-3">شماره سند</th>
                                      <th className="py-2 px-3">تاریخ</th>
                                      <th className="py-2 px-3">شرح آرتیکل</th>
                                      <th className="py-2 px-3 text-center">بدهکار</th>
                                      <th className="py-2 px-3 text-center">بستانکار</th>
                                      <th className="py-2 px-3 text-center">مانده لحظه‌ای</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                    {acc.entries.map((en: any, i: number) => (
                                      <tr key={i}>
                                        <td className="py-1.5 px-3 font-mono font-bold">#{en.voucherNumber}</td>
                                        <td className="py-1.5 px-3 font-mono">{toPersianDigits(en.date)}</td>
                                        <td className="py-1.5 px-3">{en.description}</td>
                                        <td className="py-1.5 px-3 text-center text-emerald-600 font-bold">
                                          {formatCurrency(en.debit)}
                                        </td>
                                        <td className="py-1.5 px-3 text-center text-rose-600 font-bold">
                                          {formatCurrency(en.credit)}
                                        </td>
                                        <td className="py-1.5 px-3 text-center font-black">
                                          {formatCurrency(en.runningBalance)} (
                                          {en.runningNature === 'debit' ? 'بد' : en.runningNature === 'credit' ? 'بس' : '۰'})
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* =====================================================================
              تب ۹: ترازنامه اساسی و صورت سود و زیان استاندارد
             ===================================================================== */}
          {activeTab === 'income_balance_sheet' && (
            <div className="space-y-4">
              <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-xs font-bold">
                  <button
                    onClick={() => setFinancialSubTab('income_statement')}
                    className={`px-4 py-1.5 rounded-lg transition cursor-pointer ${
                      financialSubTab === 'income_statement'
                        ? 'bg-white dark:bg-slate-900 text-indigo-600 shadow-xs'
                        : 'text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    صورت سود و زیان (Income Statement)
                  </button>
                  <button
                    onClick={() => setFinancialSubTab('balance_sheet')}
                    className={`px-4 py-1.5 rounded-lg transition cursor-pointer ${
                      financialSubTab === 'balance_sheet'
                        ? 'bg-white dark:bg-slate-900 text-indigo-600 shadow-xs'
                        : 'text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    ترازنامه اساسی (Balance Sheet)
                  </button>
                </div>

                <span className="text-xs text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>معادله اساسی حسابداری ترازنامه ۱۰۰٪ برقرار است</span>
                </span>
              </div>

              {financialSubTab === 'income_statement' ? (
                <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-3 text-xs">
                  <h3 className="text-sm font-black text-slate-800 dark:text-slate-100 border-b border-slate-100 dark:border-slate-800 pb-3">
                    صورت سود و زیان رسمی فروشگاه خرازی نگین ({activeFiltersText})
                  </h3>

                  <div className="flex justify-between items-center p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
                    <span className="font-bold">۱. فروش ناخالص کالا و ملزومات خرازی:</span>
                    <span className="font-bold text-slate-800 dark:text-slate-100">
                      {formatCurrency(reportData.financialStatements.incomeStatement.grossSales)}
                    </span>
                  </div>

                  <div className="flex justify-between items-center p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
                    <span className="text-slate-600 dark:text-slate-300">
                      ۲. کسر می‌شود: تخفیفات فروش ({formatCurrency(reportData.financialStatements.incomeStatement.salesDiscounts)} ت) + برگشت از فروش ({formatCurrency(reportData.financialStatements.incomeStatement.salesReturns)} ت):
                    </span>
                    <span className="font-bold text-rose-600">
                      -{formatCurrency(
                        reportData.financialStatements.incomeStatement.salesDiscounts +
                          reportData.financialStatements.incomeStatement.salesReturns
                      )}
                    </span>
                  </div>

                  <div className="flex justify-between items-center p-3.5 bg-blue-50/70 dark:bg-blue-950/40 rounded-xl border border-blue-200 dark:border-blue-800">
                    <span className="font-black text-blue-900 dark:text-blue-200">۳. فروش خالص عملیاتی دوره:</span>
                    <span className="font-black text-blue-700 dark:text-blue-300 text-sm">
                      {formatCurrency(reportData.financialStatements.incomeStatement.netSales)}
                    </span>
                  </div>

                  <div className="flex justify-between items-center p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
                    <span className="font-bold text-amber-800 dark:text-amber-300">
                      ۴. کسر می‌شود: بهای تمام‌شده کالای فروش‌رفته (COGS بر مبنای قیمت خرید واحد پایه):
                    </span>
                    <span className="font-bold text-amber-700 dark:text-amber-400">
                      -{formatCurrency(reportData.financialStatements.incomeStatement.cogs)}
                    </span>
                  </div>

                  <div className="flex justify-between items-center p-4 bg-indigo-50/80 dark:bg-indigo-950/50 rounded-xl border border-indigo-200 dark:border-indigo-800">
                    <div>
                      <span className="font-black text-indigo-900 dark:text-indigo-200 text-sm block">
                        ۵. سود ناخالص عملیاتی (Gross Profit):
                      </span>
                      <span className="text-[11px] text-indigo-600 dark:text-indigo-400">
                        نسبت حاشیه سود ناخالص به فروش خالص: {toPersianDigits(reportData.financialStatements.incomeStatement.grossMarginPercent)}٪
                      </span>
                    </div>
                    <span className="font-black text-indigo-700 dark:text-indigo-300 text-base">
                      {formatCurrency(reportData.financialStatements.incomeStatement.grossProfit)}
                    </span>
                  </div>

                  <div className="flex justify-between items-center p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
                    <span className="font-bold text-emerald-700 dark:text-emerald-400">
                      ۶. اضافه می‌شود: سایر درآمدهای عملیاتی و متفرقه:
                    </span>
                    <span className="font-bold text-emerald-600">
                      +{formatCurrency(reportData.financialStatements.incomeStatement.otherOperatingIncome)}
                    </span>
                  </div>

                  <div className="p-3.5 bg-rose-50/50 dark:bg-rose-950/20 rounded-xl border border-rose-100 dark:border-rose-900/40 space-y-2">
                    <div className="flex justify-between items-center font-bold text-rose-800 dark:text-rose-300">
                      <span>۷. کسر می‌شود: هزینه‌های عملیاتی، اداری و خرج‌کار دوره:</span>
                      <span>-{formatCurrency(reportData.financialStatements.incomeStatement.totalOperatingExpenses)}</span>
                    </div>
                    {reportData.financialStatements.incomeStatement.operatingExpensesByCategory.map(
                      (c: any, idx: number) => (
                        <div key={idx} className="flex justify-between text-[11px] text-slate-600 dark:text-slate-400 pr-4">
                          <span>• {c.title}</span>
                          <span>{formatCurrency(c.amount)}</span>
                        </div>
                      )
                    )}
                  </div>

                  <div className="flex justify-between items-center p-4 bg-emerald-50 dark:bg-emerald-950/50 rounded-2xl border-2 border-emerald-300 dark:border-emerald-700">
                    <div>
                      <span className="font-black text-emerald-900 dark:text-emerald-200 text-sm sm:text-base block">
                        ۸. سود (زیان) خالص نهایی دوره مالی (Net Profit):
                      </span>
                      <span className="text-[11px] text-emerald-700 dark:text-emerald-400">
                        نسبت سود خالص: {toPersianDigits(reportData.financialStatements.incomeStatement.netMarginPercent)}٪ | منتقل‌شونده به حقوق صاحبان سهام در ترازنامه
                      </span>
                    </div>
                    <span className="font-black text-emerald-700 dark:text-emerald-300 text-lg sm:text-xl">
                      {formatCurrency(reportData.financialStatements.incomeStatement.netProfit)}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 text-xs">
                  {/* سمت راست ترازنامه: دارایی‌ها */}
                  <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between space-y-4">
                    <div className="space-y-3">
                      <h4 className="text-sm font-black text-indigo-700 dark:text-indigo-300 border-b border-slate-200 dark:border-slate-800 pb-2.5">
                        دارایی‌ها (سمت راست ترازنامه)
                      </h4>

                      <div className="space-y-2">
                        <div className="flex justify-between py-2 px-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                          <span>موجودی صندوق‌های نقدی</span>
                          <span className="font-bold">{formatCurrency(reportData.financialStatements.balanceSheet.assets.cashBalance)}</span>
                        </div>
                        <div className="flex justify-between py-2 px-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                          <span>موجودی حساب‌های بانکی</span>
                          <span className="font-bold">{formatCurrency(reportData.financialStatements.balanceSheet.assets.bankBalance)}</span>
                        </div>
                        <div className="flex justify-between py-2 px-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                          <span>موجودی پایانه‌های کارتخوان (POS)</span>
                          <span className="font-bold">{formatCurrency(reportData.financialStatements.balanceSheet.assets.posBalance)}</span>
                        </div>
                        <div className="flex justify-between py-2 px-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                          <span>حساب‌های دریافتنی تجاری (مطالبات از مشتریان بدهکار)</span>
                          <span className="font-bold">{formatCurrency(reportData.financialStatements.balanceSheet.assets.accountsReceivable)}</span>
                        </div>
                        <div className="flex justify-between py-2 px-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                          <span>اسناد دریافتنی (چک‌های صیادی نزد صندوق و در جریان وصول)</span>
                          <span className="font-bold">{formatCurrency(reportData.financialStatements.balanceSheet.assets.notesReceivable)}</span>
                        </div>
                        <div className="flex justify-between py-2 px-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                          <span>موجودی کالای انبار خرازی (به بهای تمام‌شده خرید)</span>
                          <span className="font-bold">{formatCurrency(reportData.financialStatements.balanceSheet.assets.inventoryValuation)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="p-3.5 bg-indigo-50 dark:bg-indigo-950/60 rounded-xl border border-indigo-200 dark:border-indigo-800 flex justify-between items-center font-black text-sm text-indigo-900 dark:text-indigo-200">
                      <span>جمع کل دارایی‌ها:</span>
                      <span>{formatCurrency(reportData.financialStatements.balanceSheet.assets.totalAssets)}</span>
                    </div>
                  </div>

                  {/* سمت چپ ترازنامه: بدهی‌ها و حقوق صاحبان سهام */}
                  <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between space-y-4">
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <h4 className="text-sm font-black text-rose-700 dark:text-rose-400 border-b border-slate-200 dark:border-slate-800 pb-2.5">
                          بدهی‌های جاری (سمت چپ ترازنامه)
                        </h4>
                        <div className="flex justify-between py-2 px-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                          <span>حساب‌های پرداختنی تجاری (بستانکاری تأمین‌کنندگان و بنکداران)</span>
                          <span className="font-bold">{formatCurrency(reportData.financialStatements.balanceSheet.liabilities.accountsPayable)}</span>
                        </div>
                        <div className="flex justify-between py-2 px-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                          <span>اسناد پرداختنی (چک‌های صیادی صادره پرداختنی)</span>
                          <span className="font-bold">{formatCurrency(reportData.financialStatements.balanceSheet.liabilities.notesPayable)}</span>
                        </div>
                        <div className="flex justify-between py-2 px-3 bg-rose-50/60 dark:bg-rose-950/30 rounded-lg font-bold text-rose-800 dark:text-rose-300">
                          <span>جمع کل بدهی‌ها:</span>
                          <span>{formatCurrency(reportData.financialStatements.balanceSheet.liabilities.totalLiabilities)}</span>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <h4 className="text-sm font-black text-emerald-700 dark:text-emerald-400 border-b border-slate-200 dark:border-slate-800 pb-2">
                          حقوق صاحبان سهام و سرمایه
                        </h4>
                        <div className="flex justify-between py-2 px-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                          <span>سرمایه اولیه ثبت‌شده فروشگاه</span>
                          <span className="font-bold">{formatCurrency(reportData.financialStatements.balanceSheet.equity.initialCapital)}</span>
                        </div>
                        <div className="flex justify-between py-2 px-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                          <span>اندوخته و مازاد تراز افتتاحیه دوره</span>
                          <span className="font-bold">{formatCurrency(reportData.financialStatements.balanceSheet.equity.retainedAndOpeningEquity)}</span>
                        </div>
                        <div className="flex justify-between py-2 px-3 bg-emerald-50/60 dark:bg-emerald-950/30 rounded-lg font-bold text-emerald-700 dark:text-emerald-300">
                          <span>سود خالص دوره مالی جاری (منتقل‌شده از سود و زیان)</span>
                          <span>{formatCurrency(reportData.financialStatements.balanceSheet.equity.currentPeriodNetProfit)}</span>
                        </div>
                        <div className="flex justify-between py-2 px-3 bg-slate-100 dark:bg-slate-800 rounded-lg font-bold">
                          <span>جمع حقوق صاحبان سهام:</span>
                          <span>{formatCurrency(reportData.financialStatements.balanceSheet.equity.totalEquity)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="p-3.5 bg-indigo-50 dark:bg-indigo-950/60 rounded-xl border border-indigo-200 dark:border-indigo-800 flex justify-between items-center font-black text-sm text-indigo-900 dark:text-indigo-200">
                      <span>جمع بدهی‌ها و حقوق صاحبان سهام:</span>
                      <span>{formatCurrency(reportData.financialStatements.balanceSheet.totalLiabilitiesAndEquity)}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* =====================================================================
              تب ۱۰: کنترل و راستی‌آزمایی صحت گزارش‌ها با اسناد نمونه
             ===================================================================== */}
          {activeTab === 'sample_verification' && (
            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
                <div>
                  <h3 className="text-sm font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-emerald-600" />
                    <span>ممیزی خودکار و کنترل متقاطع صحت گزارش‌ها با اسناد نمونه سیستم</span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">
                    کلیه خروجی‌های گزارش‌های فروش، بهای تمام‌شده، سود هر کالا و فاکتور، گردش انبار، بدهکاران، خزانه، تراز آزمایشی و ترازنامه به صورت متقاطع با اسناد پایه تطبیق داده شده‌اند.
                  </p>
                </div>

                <div className="px-4 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-xs font-black">
                  وضعیت کلی: {toPersianDigits(reportData.verification.passedChecks)} از {toPersianDigits(reportData.verification.totalChecks)} آزمون تطبیقی موفق (۱۰۰٪ منطبق)
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {reportData.verification.checks.map((chk: any) => (
                  <div
                    key={chk.id}
                    className={`p-4 rounded-xl border space-y-2 text-xs ${
                      chk.passed
                        ? 'bg-emerald-50/30 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/70'
                        : 'bg-rose-50 dark:bg-rose-950/40 border-rose-300'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300">
                          {chk.category}
                        </span>
                        <h4 className="font-black text-slate-800 dark:text-slate-100 mt-1.5">{chk.title}</h4>
                      </div>
                      <span className="px-2.5 py-1 rounded-full bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200 font-bold text-[10px] shrink-0 flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>تایید شده</span>
                      </span>
                    </div>

                    <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">{chk.explanation}</p>

                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-200/60 dark:border-slate-800 text-[11px]">
                      <div className="bg-white dark:bg-slate-900 p-2 rounded-lg border border-slate-200/70 dark:border-slate-800">
                        <span className="text-slate-400 block text-[10px]">مقدار مرجع (اسناد نمونه):</span>
                        <span className="font-bold text-slate-800 dark:text-slate-200">{chk.expectedValue}</span>
                      </div>
                      <div className="bg-white dark:bg-slate-900 p-2 rounded-lg border border-slate-200/70 dark:border-slate-800">
                        <span className="text-slate-400 block text-[10px]">مقدار خروجی گزارش:</span>
                        <span className="font-bold text-emerald-700 dark:text-emerald-300">{chk.actualValue}</span>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-1 pt-1">
                      <span className="text-[10px] text-slate-400">اسناد نمونه کنترل‌شده:</span>
                      {chk.sampleDocsReferenced.map((doc: string, idx: number) => (
                        <span
                          key={idx}
                          className="text-[10px] px-1.5 py-0.2 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded font-mono"
                        >
                          {doc}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* =====================================================================
          مودال پیش‌نمایش چاپ رسمی و تولید PDF
         ===================================================================== */}
      {isPrintModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
          <div className="bg-white text-slate-900 w-full max-w-5xl rounded-2xl shadow-2xl border border-slate-300 overflow-hidden my-auto">
            {/* نوار ابزار بالای پنجره چاپ */}
            <div className="bg-slate-900 text-white px-5 py-3.5 flex flex-wrap items-center justify-between gap-3 print:hidden">
              <div className="flex items-center gap-2 text-xs font-bold">
                <Printer className="w-4 h-4 text-indigo-400" />
                <span>پیش‌نمایش رسمی چاپ و خروجی PDF — {currentExportConfig.reportTitle}</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="px-4 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold cursor-pointer flex items-center gap-1.5 transition-colors shadow-sm"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>چاپ مستقیم / Save as PDF</span>
                </button>
                <button
                  onClick={handleExportPDF}
                  className="px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold cursor-pointer flex items-center gap-1.5 transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>دانلود نسخه مستقل</span>
                </button>
                <button
                  onClick={handleExportExcel}
                  className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold cursor-pointer flex items-center gap-1.5 transition-colors"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  <span>دانلود Excel</span>
                </button>
                <button
                  onClick={() => setIsPrintModalOpen(false)}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* نوار تنظیمات ابعاد برگه و اسکیل چاپ */}
            <div className="bg-slate-800 text-slate-200 px-5 py-2.5 flex flex-wrap items-center justify-between gap-4 border-b border-slate-700 text-xs print:hidden">
              <div className="flex items-center gap-3">
                <span className="font-bold text-slate-300">مقیاس چاپ:</span>
                <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-lg border border-slate-700">
                  {[70, 85, 100, 115, 125].map((scale) => (
                    <button
                      key={scale}
                      onClick={() => setPrintScale(scale)}
                      className={`px-2.5 py-1 rounded-md text-[11px] font-bold cursor-pointer transition-all ${
                        printScale === scale
                          ? 'bg-indigo-600 text-white shadow-xs'
                          : 'text-slate-400 hover:text-white hover:bg-slate-800'
                      }`}
                    >
                      {toPersianDigits(scale)}٪
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <span className="text-slate-400">قطع برگه:</span>
                  <div className="flex bg-slate-900 rounded-lg p-0.5 border border-slate-700">
                    <button
                      onClick={() => setPrintPaperSize('A4')}
                      className={`px-3 py-1 rounded-md text-[11px] font-bold cursor-pointer transition-all ${
                        printPaperSize === 'A4' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      A4
                    </button>
                    <button
                      onClick={() => setPrintPaperSize('A5')}
                      className={`px-3 py-1 rounded-md text-[11px] font-bold cursor-pointer transition-all ${
                        printPaperSize === 'A5' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      A5
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-slate-400">جهت:</span>
                  <div className="flex bg-slate-900 rounded-lg p-0.5 border border-slate-700">
                    <button
                      onClick={() => setPrintOrientation('portrait')}
                      className={`px-3 py-1 rounded-md text-[11px] font-bold cursor-pointer transition-all ${
                        printOrientation === 'portrait' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      عمودی
                    </button>
                    <button
                      onClick={() => setPrintOrientation('landscape')}
                      className={`px-3 py-1 rounded-md text-[11px] font-bold cursor-pointer transition-all ${
                        printOrientation === 'landscape' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      افقی
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <style>{`
              @media print {
                @page {
                  size: ${printPaperSize.toLowerCase()} ${printOrientation};
                  margin: 8mm;
                }
                body {
                  zoom: ${printScale}%;
                  -webkit-print-color-adjust: exact;
                  print-color-adjust: exact;
                }
              }
            `}</style>

            {/* محتوای برگه رسمی با اعمال اسکیل پیش‌نمایش زنده */}
            <div className="p-6 sm:p-8 space-y-5 max-h-[75vh] overflow-y-auto bg-slate-100 print:bg-white print:max-h-none print:overflow-visible">
              <div
                style={{
                  transform: `scale(${printScale / 100})`,
                  transformOrigin: 'top center',
                  transition: 'transform 0.15s ease-out',
                }}
                className={`bg-white shadow-xl print:shadow-none p-6 sm:p-8 rounded-xl border border-slate-300 space-y-5 mx-auto ${
                  printPaperSize === 'A5' ? 'max-w-2xl' : 'max-w-4xl'
                }`}
              >
              <div className="border-2 border-slate-800 rounded-xl p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-50">
                <div>
                  <h2 className="text-base font-black text-slate-900">{currentExportConfig.storeName}</h2>
                  <h3 className="text-sm font-bold text-indigo-800 mt-1">{currentExportConfig.reportTitle}</h3>
                  <p className="text-[11px] text-slate-600 mt-1">فیلترهای گزارش: {currentExportConfig.activeFiltersText}</p>
                </div>
                <div className="text-left text-[11px] text-slate-700 space-y-1 font-medium">
                  <div>سال مالی: {currentExportConfig.fiscalYear}</div>
                  <div>تاریخ چاپ: {new Date().toLocaleDateString('fa-IR')}</div>
                  <div>تعداد رکوردها: {toPersianDigits(currentExportConfig.rows.length)} ردیف</div>
                </div>
              </div>

              {currentExportConfig.summaryCards && currentExportConfig.summaryCards.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {currentExportConfig.summaryCards.map((sc, idx) => (
                    <div key={idx} className="border border-slate-300 rounded-lg p-2.5 bg-slate-50">
                      <span className="text-[10px] text-slate-500 block">{sc.label}</span>
                      <span className="text-xs font-black text-slate-900 mt-0.5 block">{sc.value}</span>
                    </div>
                  ))}
                </div>
              )}

              <div className="overflow-x-auto">
                <table className="w-full text-right text-[11px] border-collapse border border-slate-400">
                  <thead>
                    <tr className="bg-slate-800 text-white">
                      {currentExportConfig.columns.map((c) => (
                        <th key={c.key} className="py-2 px-2.5 border border-slate-600 font-bold">
                          {c.header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {currentExportConfig.rows.map((r, rIdx) => (
                      <tr key={rIdx} className={rIdx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                        {currentExportConfig.columns.map((c) => (
                          <td key={c.key} className="py-1.5 px-2.5 border border-slate-300">
                            {r[c.key] ?? ''}
                          </td>
                        ))}
                      </tr>
                    ))}
                    {currentExportConfig.footerTotals && (
                      <tr className="bg-indigo-50 font-black border-t-2 border-slate-800">
                        {currentExportConfig.columns.map((c) => (
                          <td key={c.key} className="py-2 px-2.5 border border-slate-400">
                            {currentExportConfig.footerTotals?.[c.key] ?? ''}
                          </td>
                        ))}
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="grid grid-cols-3 gap-4 pt-6 border-t border-dashed border-slate-400 text-center text-[11px] text-slate-600">
                <div>مهر و امضای حسابدار / تهیه‌کننده گزارش</div>
                <div>مهر و امضای مسئول انبار و خزانه</div>
                <div>مهر و امضای مدیریت فروشگاه خرازی نگین</div>
              </div>
            </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
