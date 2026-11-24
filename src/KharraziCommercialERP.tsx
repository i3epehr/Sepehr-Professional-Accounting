import React, { useState, useEffect, useMemo } from 'react';
import {
  ShoppingBag,
  Package,
  CreditCard,
  Printer,
  LogOut,
  Plus,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  X,
  ChevronDown,
  ChevronUp,
  PanelLeftClose,
  PanelLeftOpen,
  Lock,
  ShieldCheck,
  Layers,
  Sliders,
  ArrowUp,
  ArrowDown,
  FolderTree,
  Sun,
  Moon,
  BarChart3,
  Store,
  Landmark,
  FileSpreadsheet,
  Calculator,
  Save,
} from 'lucide-react';

// ============================================================================
// ۱. تعاریف انواع داده‌ها (Types & Interfaces)
// ============================================================================

export type UserRoleId = 'admin' | 'accountant' | 'cashier';

export interface RoleDefinition {
  id: UserRoleId;
  title: string;
  description: string;
  canSeePurchasePrice: boolean;
  canApproveCreditCeiling: boolean;
  canAccessSystemSettings: boolean;
  canAccessFinancialReports: boolean;
  canVoidInvoices: boolean;
}

export type DocumentTabType =
  | 'sales'
  | 'purchase'
  | 'proforma'
  | 'consignment'
  | 'sales_return'
  | 'purchase_return'
  | 'waste';

export type WarehouseLocation =
  | 'انبار مغازه'
  | 'انبار مرکزی بازار'
  | 'انبار مرجوعی و ضایعات';

export interface CategoryNode {
  id: string;
  title: string;
  parentId: string | null;
}

export interface BazaarProduct {
  id: string;
  code: string;
  name: string;
  categoryId: string;
  categoryTitle: string;
  baseUnit: string;
  subUnit: string;
  conversionRatio: number;
  purchasePrice: number;
  retailPrice: number;
  wholesalePrice: number;
  stockShop: number;
  stockCentral: number;
  stockDamaged: number;
  minOrderAlert: number;
  shelfLocation: string;
}

export interface Counterparty {
  id: string;
  code: string;
  fullName: string;
  titlePrefix: string;
  type: 'customer' | 'supplier' | 'both';
  phone: string;
  city: string;
  openBookBalance: number;
  unclearedChequesTotal: number;
  creditLimitBook: number;
  creditLimitCheques: number;
}

export interface HistoricalPriceEntry {
  counterpartyId: string;
  productId: string;
  lastUnitPrice: number;
  lastSoldDate: string;
  invoiceNumber: string;
}

export interface InvoiceLineItem {
  id: string;
  productId: string;
  productCode: string;
  productName: string;
  unitUsed: 'base' | 'sub';
  unitTitle: string;
  quantity: number;
  baseQuantityTotal: number;
  unitPrice: number;
  purchaseCostUnit: number;
  discountAmount: number;
  totalRowAmount: number;
  lastSoldPriceToCustomer: number | null;
}

export interface TradeDocument {
  id: string;
  docNumber: string;
  docType: DocumentTabType;
  date: string;
  counterpartyId: string;
  counterpartyName: string;
  warehouse: WarehouseLocation;
  items: InvoiceLineItem[];
  subtotal: number;
  totalDiscount: number;
  grandTotal: number;
  totalCostOfGoods: number;
  previousCustomerBalance: number;
  cashReceived: number;
  cashTenderedByCustomer: number;
  changeReturned: number;
  posReceived: number;
  posReferenceNumber: string;
  chequeReceived: number;
  chequeReferenceNumber: string;
  creditNesiyehAmount: number;
  notes: string;
  createdByRole: string;
  exceededCreditApprovedByAdmin: boolean;
}

export type BazaarExpenseCategory =
  | 'کرایه و شارژ مغازه'
  | 'پیک و وانت‌بار'
  | 'حقوق و مساعده شاگرد'
  | 'نایلون و ملزومات بسته‌بندی'
  | 'قبوض (برق، تلفن، آب)'
  | 'پذیرایی و چای مغازه'
  | 'تعمیرات و هزینه‌های متفرقه';

export type PaymentSourceType = 'صندوق' | 'بانک';

export interface ExpenseVoucher {
  id: string;
  voucherNumber: string;
  date: string;
  category: BazaarExpenseCategory;
  amount: number;
  paymentSource: PaymentSourceType;
  bankOrCashTitle: string;
  recipientName: string;
  description: string;
  registeredByRole: string;
}

export interface BazaarCheque {
  id: string;
  sayadiNumber: string;
  serialNumber: string;
  bankName: string;
  drawerName: string;
  counterpartyId: string;
  direction: 'incoming' | 'outgoing';
  amount: number;
  issueDate: string;
  dueDate: string;
  status: 'در جریان وصول' | 'وصول‌شده' | 'خرج‌شده به غیر' | 'برگشتی';
  endorsedToCounterpartyId?: string;
  endorsedToName?: string;
}

export interface KardexMovement {
  id: string;
  date: string;
  productId: string;
  productName: string;
  docNumber: string;
  movementType: string;
  warehouse: WarehouseLocation;
  inBaseQty: number;
  outBaseQty: number;
  balanceBaseQty: number;
  unitRatio: number;
  baseUnit: string;
  subUnit: string;
  counterpartyName: string;
}

export type PrintPaperSize = 'A4' | 'A5' | '80mm';
export type PrintVisualStyle = 'کلاسیک هلو' | 'رسمی اتحادیه' | 'فشرده بازاری';
export type PrintFontSizeScale = 'ریز' | 'متوسط' | 'بزرگ';

export type PrintSectionId =
  | 'storeLogoHeader'
  | 'unionLicenseNumber'
  | 'previousCustomerBalance'
  | 'settlementBreakdownBox'
  | 'invoiceNotes'
  | 'signatureStampBox';

export interface PrintSectionConfigItem {
  id: PrintSectionId;
  label: string;
  visible: boolean;
  order: number;
}

export interface PrintEngineConfig {
  paperSize: PrintPaperSize;
  visualStyle: PrintVisualStyle;
  fontSizeScale: PrintFontSizeScale;
  sections: PrintSectionConfigItem[];
}

export interface StoreBusinessConfig {
  storeSignboardName: string;
  guildTitle: string;
  unionLicenseNumber: string;
  phoneNumbers: string;
  storeAddress: string;
  invoiceFooterTerms: string;
  currencyLabel: 'تومان' | 'ریال';
}

// ============================================================================
// ۲. توابع کمکی اعداد و مبالغ فارسی (Persian Numerals & Formatting)
// ============================================================================

const PERSIAN_DIGITS = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];

export function toFaDigits(value: string | number | undefined | null): string {
  if (value === undefined || value === null) return '';
  return String(value).replace(/\d/g, (d) => PERSIAN_DIGITS[parseInt(d, 10)]);
}

export function formatFaMoney(amount: number | undefined | null): string {
  const num = Math.round(Number(amount) || 0);
  const absFormatted = Math.abs(num)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, '٬');
  return toFaDigits(num < 0 ? `${absFormatted}-` : absFormatted);
}

export function formatDualUnitStock(
  baseQty: number,
  baseUnit: string,
  subUnit: string,
  ratio: number
): string {
  if (!ratio || ratio <= 1) {
    return `${toFaDigits(baseQty)} ${baseUnit}`;
  }
  const subCount = Math.floor(baseQty / ratio);
  const remainder = Number((baseQty - subCount * ratio).toFixed(2));
  if (subCount === 0) {
    return `${toFaDigits(baseQty)} ${baseUnit}`;
  }
  if (remainder === 0) {
    return `${toFaDigits(subCount)} ${subUnit} (${toFaDigits(baseQty)} ${baseUnit})`;
  }
  return `${toFaDigits(subCount)} ${subUnit} و ${toFaDigits(remainder)} ${baseUnit} (جمعاً ${toFaDigits(baseQty)} ${baseUnit})`;
}
// ============================================================================
// ۳. داده‌های پیش‌فرض بازار خرازی و یراق‌آلات خیاطی (Authentic Bazaar Seed Data)
// ============================================================================

const ROLES_CATALOG: RoleDefinition[] = [
  {
    id: 'admin',
    title: 'مدیر سیستم',
    description: 'دسترسی کامل به خرید، فروش، قیمت تمام‌شده، سقف اعتبار، اسناد مالی و تنظیمات',
    canSeePurchasePrice: true,
    canApproveCreditCeiling: true,
    canAccessSystemSettings: true,
    canAccessFinancialReports: true,
    canVoidInvoices: true,
  },
  {
    id: 'accountant',
    title: 'حسابدار',
    description: 'دسترسی به ثبت فاکتورها، خزانه‌داری، چک‌ها، تفکیک هزینه‌ها و گزارشات جامع مالی',
    canSeePurchasePrice: true,
    canApproveCreditCeiling: false,
    canAccessSystemSettings: false,
    canAccessFinancialReports: true,
    canVoidInvoices: true,
  },
  {
    id: 'cashier',
    title: 'صندوقدار / شاگرد',
    description: 'ثبت سریع فاکتور فروش، پیش‌فاکتور و دریافت وجه نقد و کارتخوان (بدون مشاهده قیمت خرید)',
    canSeePurchasePrice: false,
    canApproveCreditCeiling: false,
    canAccessSystemSettings: false,
    canAccessFinancialReports: false,
    canVoidInvoices: false,
  },
];

const INITIAL_CATEGORY_TREE: CategoryNode[] = [
  { id: 'cat-all', title: 'همه گروه‌های کالایی', parentId: null },
  { id: 'cat-buttons', title: 'دکمه‌ها و قزن', parentId: null },
  { id: 'cat-buttons-shirt', title: 'دکمه پیراهنی و مانتویی', parentId: 'cat-buttons' },
  { id: 'cat-buttons-coat', title: 'دکمه پالتویی و مجلسی', parentId: 'cat-buttons' },
  { id: 'cat-zippers', title: 'زیپ و سرزیپ', parentId: null },
  { id: 'cat-zippers-hidden', title: 'زیپ مخفی و لباسی', parentId: 'cat-zippers' },
  { id: 'cat-zippers-metal', title: 'زیپ فلزی و کاپشنی', parentId: 'cat-zippers' },
  { id: 'cat-ribbons', title: 'روبان، نوار و یراق', parentId: null },
  { id: 'cat-ribbons-satin', title: 'روبان ساتن و حریر', parentId: 'cat-ribbons' },
  { id: 'cat-ribbons-curtain', title: 'نوار پرده و اریب', parentId: 'cat-ribbons' },
  { id: 'cat-threads', title: 'نخ دوخت و قرقره', parentId: null },
  { id: 'cat-accessories', title: 'سوزن، قیچی و ابزار خیاطی', parentId: null },
];

const INITIAL_PRODUCTS: BazaarProduct[] = [
  {
    id: 'prd-101',
    code: '۱۰۱۱',
    name: 'دکمه صدفی پیراهنی سایز ۱۸ (بسته قرقره‌ای)',
    categoryId: 'cat-buttons-shirt',
    categoryTitle: 'دکمه پیراهنی و مانتویی',
    baseUnit: 'عدد',
    subUnit: 'جین',
    conversionRatio: 12,
    purchasePrice: 2800,
    retailPrice: 4500,
    wholesalePrice: 3800,
    stockShop: 360,
    stockCentral: 1440,
    stockDamaged: 12,
    minOrderAlert: 240,
    shelfLocation: 'قفسه الف - ردیف ۲',
  },
  {
    id: 'prd-102',
    code: '۱۰۱۲',
    name: 'دکمه فلزی پایه طلایی مانتویی نگین‌دار',
    categoryId: 'cat-buttons-coat',
    categoryTitle: 'دکمه پالتویی و مجلسی',
    baseUnit: 'عدد',
    subUnit: 'جین',
    conversionRatio: 12,
    purchasePrice: 9500,
    retailPrice: 15000,
    wholesalePrice: 12800,
    stockShop: 144,
    stockCentral: 480,
    stockDamaged: 4,
    minOrderAlert: 120,
    shelfLocation: 'قفسه الف - ردیف ۴',
  },
  {
    id: 'prd-103',
    code: '۲۰۱۱',
    name: 'زیپ مخفی ۵۰ سانتی درجه یک مشکی',
    categoryId: 'cat-zippers-hidden',
    categoryTitle: 'زیپ مخفی و لباسی',
    baseUnit: 'عدد',
    subUnit: 'بسته صدتایی',
    conversionRatio: 100,
    purchasePrice: 6200,
    retailPrice: 11000,
    wholesalePrice: 8900,
    stockShop: 250,
    stockCentral: 1200,
    stockDamaged: 8,
    minOrderAlert: 200,
    shelfLocation: 'قفسه ب - کشو ۱',
  },
  {
    id: 'prd-104',
    code: '۲۰۱۲',
    name: 'زیپ فلزی برنجی کاپشنی ۷۰ سانتی دو سرزیپ',
    categoryId: 'cat-zippers-metal',
    categoryTitle: 'زیپ فلزی و کاپشنی',
    baseUnit: 'عدد',
    subUnit: 'جین',
    conversionRatio: 12,
    purchasePrice: 34000,
    retailPrice: 52000,
    wholesalePrice: 44000,
    stockShop: 72,
    stockCentral: 240,
    stockDamaged: 2,
    minOrderAlert: 60,
    shelfLocation: 'قفسه ب - کشو ۳',
  },
  {
    id: 'prd-105',
    code: '۳۰۱۱',
    name: 'روبان ساتن دو رو عرض ۲ سانت زرشکی',
    categoryId: 'cat-ribbons-satin',
    categoryTitle: 'روبان ساتن و حریر',
    baseUnit: 'متر',
    subUnit: 'رول ۲۵ متری',
    conversionRatio: 25,
    purchasePrice: 3200,
    retailPrice: 6000,
    wholesalePrice: 4800,
    stockShop: 175,
    stockCentral: 750,
    stockDamaged: 0,
    minOrderAlert: 100,
    shelfLocation: 'ویترین روبان - ستون ۱',
  },
  {
    id: 'prd-106',
    code: '۳۰۱۲',
    name: 'نوار پرده چهار نخ پلی‌استر اعلا',
    categoryId: 'cat-ribbons-curtain',
    categoryTitle: 'نوار پرده و اریب',
    baseUnit: 'متر',
    subUnit: 'طمار ۵۰ متری',
    conversionRatio: 50,
    purchasePrice: 7800,
    retailPrice: 12500,
    wholesalePrice: 10200,
    stockShop: 200,
    stockCentral: 1000,
    stockDamaged: 15,
    minOrderAlert: 150,
    shelfLocation: 'انبارک میانی - طبقه ۲',
  },
  {
    id: 'prd-107',
    code: '۴۰۱۱',
    name: 'نخ دوخت ترویرا ۴۰۰ متری سفید و مشکی',
    categoryId: 'cat-threads',
    categoryTitle: 'نخ دوخت و قرقره',
    baseUnit: 'حلقه',
    subUnit: 'جعبه ۱۰ تایی',
    conversionRatio: 10,
    purchasePrice: 18500,
    retailPrice: 28000,
    wholesalePrice: 23500,
    stockShop: 120,
    stockCentral: 600,
    stockDamaged: 3,
    minOrderAlert: 80,
    shelfLocation: 'پیشخوان اصلی - استند نخ',
  },
  {
    id: 'prd-108',
    code: '۵۰۱۱',
    name: 'سوزن چرخ خیاطی صنعتی ارگان ژاپن شماره ۱۴',
    categoryId: 'cat-accessories',
    categoryTitle: 'سوزن، قیچی و ابزار خیاطی',
    baseUnit: 'بسته ده تایی',
    subUnit: 'کارتن کوچک',
    conversionRatio: 10,
    purchasePrice: 42000,
    retailPrice: 68000,
    wholesalePrice: 56000,
    stockShop: 45,
    stockCentral: 150,
    stockDamaged: 0,
    minOrderAlert: 30,
    shelfLocation: 'کشوی ابزار دقیق',
  },
];

const INITIAL_COUNTERPARTIES: Counterparty[] = [
  {
    id: 'cp-walkin',
    code: '۱۰۰۰',
    fullName: 'مشتری رهگذر (فروش نقدی پیشخوان)',
    titlePrefix: 'مشتری نقدی',
    type: 'customer',
    phone: '۰۲۱-۵۵۶۶۰۰۰۰',
    city: 'تهران - بازار بزرگ',
    openBookBalance: 0,
    unclearedChequesTotal: 0,
    creditLimitBook: 0,
    creditLimitCheques: 0,
  },
  {
    id: 'cp-201',
    code: '۲۰۱۰',
    fullName: 'تولیدی مانتو و پوشاک بهارستان (حاج محمود رضایی)',
    titlePrefix: 'همکار عمده',
    type: 'customer',
    phone: '۰۹۱۲-۱۱۴۵۸۹۰',
    city: 'تهران - بهارستان',
    openBookBalance: 14500000,
    unclearedChequesTotal: 22000000,
    creditLimitBook: 20000000,
    creditLimitCheques: 30000000,
  },
  {
    id: 'cp-202',
    code: '۲۰۱۱',
    fullName: 'مزون عروس و مجلسی ترمه (خانم سادات حسینی)',
    titlePrefix: 'مشتری کارگاهی',
    type: 'customer',
    phone: '۰۹۱۲-۳۳۸۹۴۱۰',
    city: 'تهران - میرداماد',
    openBookBalance: 8900000,
    unclearedChequesTotal: 15000000,
    creditLimitBook: 10000000,
    creditLimitCheques: 15000000,
  },
  {
    id: 'cp-203',
    code: '۲۰۱۲',
    fullName: 'خرازی و یراق‌پذیر نصف جهان (اصفهان - آقای کریمی)',
    titlePrefix: 'بنکدار شهرستان',
    type: 'both',
    phone: '۰۳۱-۳۲۲۴۵۶۰۰',
    city: 'اصفهان - بازار بزرگ',
    openBookBalance: 4200000,
    unclearedChequesTotal: 8500000,
    creditLimitBook: 35000000,
    creditLimitCheques: 50000000,
  },
  {
    id: 'cp-301',
    code: '۳۰۱۰',
    fullName: 'بازرگانی پخش یراق و زیپ برادران توکلی',
    titlePrefix: 'تأمین‌کننده اصلی',
    type: 'supplier',
    phone: '۰۲۱-۵۵۸۹۱۲۳۴',
    city: 'تهران - سرای مشیرخلوت',
    openBookBalance: -38000000,
    unclearedChequesTotal: 25000000,
    creditLimitBook: 100000000,
    creditLimitCheques: 100000000,
  },
  {
    id: 'cp-302',
    code: '۳۰۱۱',
    fullName: 'کارخانه نخریسی و قرقره البرز بافت',
    titlePrefix: 'تولیدکننده',
    type: 'supplier',
    phone: '۰۲۶-۳۴۵۶۷۸۹۰',
    city: 'کرج - شهرک صنعتی بهارستان',
    openBookBalance: -19500000,
    unclearedChequesTotal: 12000000,
    creditLimitBook: 80000000,
    creditLimitCheques: 80000000,
  },
];

const INITIAL_HISTORICAL_PRICES: HistoricalPriceEntry[] = [
  { counterpartyId: 'cp-201', productId: 'prd-101', lastUnitPrice: 3750, lastSoldDate: '۱۴۰۴/۰۲/۱۰', invoiceNumber: 'ف-۱۴۰۴۰۱' },
  { counterpartyId: 'cp-201', productId: 'prd-103', lastUnitPrice: 8700, lastSoldDate: '۱۴۰۴/۰۲/۱۰', invoiceNumber: 'ف-۱۴۰۴۰۱' },
  { counterpartyId: 'cp-201', productId: 'prd-107', lastUnitPrice: 23000, lastSoldDate: '۱۴۰۴/۰۲/۱۴', invoiceNumber: 'ف-۱۴۰۴۰۴' },
  { counterpartyId: 'cp-202', productId: 'prd-102', lastUnitPrice: 13500, lastSoldDate: '۱۴۰۴/۰۲/۱۲', invoiceNumber: 'ف-۱۴۰۴۰۲' },
  { counterpartyId: 'cp-202', productId: 'prd-105', lastUnitPrice: 5200, lastSoldDate: '۱۴۰۴/۰۲/۱۲', invoiceNumber: 'ف-۱۴۰۴۰۲' },
  { counterpartyId: 'cp-203', productId: 'prd-104', lastUnitPrice: 43500, lastSoldDate: '۱۴۰۴/۰۲/۱۵', invoiceNumber: 'ف-۱۴۰۴۰۵' },
  { counterpartyId: 'cp-203', productId: 'prd-106', lastUnitPrice: 9900, lastSoldDate: '۱۴۰۴/۰۲/۱۵', invoiceNumber: 'ف-۱۴۰۴۰۵' },
];

const INITIAL_CHEQUES: BazaarCheque[] = [
  {
    id: 'chq-1',
    sayadiNumber: '۴۰۱۲۸۸۹۹۳۳۱۱۰۰۴۵',
    serialNumber: '۷۸۴۵۱۲',
    bankName: 'بانک ملت - شعبه بازار عباس‌آباد',
    drawerName: 'حاج محمود رضایی (تولیدی بهارستان)',
    counterpartyId: 'cp-201',
    direction: 'incoming',
    amount: 12000000,
    issueDate: '۱۴۰۴/۰۱/۲۵',
    dueDate: '۱۴۰۴/۰۲/۲۵',
    status: 'در جریان وصول',
  },
  {
    id: 'chq-2',
    sayadiNumber: '۴۰۱۲۹۹۰۰۱۱۴۴۷۷۸۲',
    serialNumber: '۹۶۳۲۱۴',
    bankName: 'بانک صادرات - شعبه سبزه میدان',
    drawerName: 'حاج محمود رضایی (تولیدی بهارستان)',
    counterpartyId: 'cp-201',
    direction: 'incoming',
    amount: 10000000,
    issueDate: '۱۴۰۴/۰۲/۰۱',
    dueDate: '۱۴۰۴/۰۳/۰۵',
    status: 'خرج‌شده به غیر',
    endorsedToCounterpartyId: 'cp-301',
    endorsedToName: 'بازرگانی پخش یراق و زیپ برادران توکلی',
  },
  {
    id: 'chq-3',
    sayadiNumber: '۴۰۱۲۵۵۶۶۷۷۸۸۹۹۰۰',
    serialNumber: '۴۵۱۲۳۶',
    bankName: 'بانک تجارت - شعبه میرداماد',
    drawerName: 'خانم سادات حسینی (مزون ترمه)',
    counterpartyId: 'cp-202',
    direction: 'incoming',
    amount: 15000000,
    issueDate: '۱۴۰۴/۰۲/۰۵',
    dueDate: '۱۴۰۴/۰۲/۲۲',
    status: 'در جریان وصول',
  },
  {
    id: 'chq-4',
    sayadiNumber: '۴۰۱۲۱۱۱۲۲۲۳۳۳۴۴۴',
    serialNumber: '۱۱۴۴۷۷',
    bankName: 'بانک ملی - شعبه بازار بزرگ',
    drawerName: 'فروشگاه خرازی و یراق‌آلات نقش جهان',
    counterpartyId: 'cp-301',
    direction: 'outgoing',
    amount: 25000000,
    issueDate: '۱۴۰۴/۰۲/۰۲',
    dueDate: '۱۴۰۴/۰۳/۱۰',
    status: 'در جریان وصول',
  },
];

const INITIAL_EXPENSES: ExpenseVoucher[] = [
  {
    id: 'exp-1',
    voucherNumber: 'هـ-۱۴۰۴۰۱',
    date: '۱۴۰۴/۰۲/۰۱',
    category: 'کرایه و شارژ مغازه',
    amount: 18500000,
    paymentSource: 'بانک',
    bankOrCashTitle: 'حساب جاری بانک ملت بازار',
    recipientName: 'حاج آقا مرتضوی (سرقفلی‌پذیر پاساژ)',
    description: 'اجاره و شارژ نگهبانی اردیبهشت‌ماه سرای مشیرخلوت',
    registeredByRole: 'مدیر سیستم',
  },
  {
    id: 'exp-2',
    voucherNumber: 'هـ-۱۴۰۴۰۲',
    date: '۱۴۰۴/۰۲/۰۸',
    category: 'پیک و وانت‌بار',
    amount: 650000,
    paymentSource: 'صندوق',
    bankOrCashTitle: 'صندوق نقد پیشخوان',
    recipientName: 'اصغر آقا چرخ‌دار بازار',
    description: 'حمل ۱۲ کارتن زیپ و نوار پرده از باربری شوش تا انبار مغازه',
    registeredByRole: 'حسابدار',
  },
  {
    id: 'exp-3',
    voucherNumber: 'هـ-۱۴۰۴۰۳',
    date: '۱۴۰۴/۰۲/۱۲',
    category: 'نایلون و ملزومات بسته‌بندی',
    amount: 1400000,
    paymentSource: 'صندوق',
    bankOrCashTitle: 'صندوق نقد پیشخوان',
    recipientName: 'پلاستیک‌فروشی اتحاد',
    description: 'خرید نایلون دسته‌دار چاپ‌دار، چسب پهن ۵ سانتی و گونی بسته‌بندی شهرستان',
    registeredByRole: 'حسابدار',
  },
  {
    id: 'exp-4',
    voucherNumber: 'هـ-۱۴۰۴۰۴',
    date: '۱۴۰۴/۰۲/۱۵',
    category: 'حقوق و مساعده شاگرد',
    amount: 4500000,
    paymentSource: 'بانک',
    bankOrCashTitle: 'کارت به کارت بانک ملت',
    recipientName: 'آقا رضا مرادی (شاگرد و انباردار)',
    description: 'مساعده نیمه اول اردیبهشت‌ماه',
    registeredByRole: 'مدیر سیستم',
  },
];

const INITIAL_DOCUMENTS: TradeDocument[] = [
  {
    id: 'doc-1001',
    docNumber: 'ف-۱۴۰۴۰۱',
    docType: 'sales',
    date: '۱۴۰۴/۰۲/۱۰',
    counterpartyId: 'cp-201',
    counterpartyName: 'تولیدی مانتو و پوشاک بهارستان (حاج محمود رضایی)',
    warehouse: 'انبار مغازه',
    items: [
      {
        id: 'li-1',
        productId: 'prd-101',
        productCode: '۱۰۱۱',
        productName: 'دکمه صدفی پیراهنی سایز ۱۸ (بسته قرقره‌ای)',
        unitUsed: 'sub',
        unitTitle: 'جین',
        quantity: 20,
        baseQuantityTotal: 240,
        unitPrice: 45000,
        purchaseCostUnit: 2800,
        discountAmount: 50000,
        totalRowAmount: 850000,
        lastSoldPriceToCustomer: 3750,
      },
      {
        id: 'li-2',
        productId: 'prd-103',
        productCode: '۲۰۱۱',
        productName: 'زیپ مخفی ۵۰ سانتی درجه یک مشکی',
        unitUsed: 'sub',
        unitTitle: 'بسته صدتایی',
        quantity: 5,
        baseQuantityTotal: 500,
        unitPrice: 870000,
        purchaseCostUnit: 6200,
        discountAmount: 0,
        totalRowAmount: 4350000,
        lastSoldPriceToCustomer: 8700,
      },
    ],
    subtotal: 5250000,
    totalDiscount: 50000,
    grandTotal: 5200000,
    totalCostOfGoods: 3772000,
    previousCustomerBalance: 11300000,
    cashReceived: 1000000,
    cashTenderedByCustomer: 1000000,
    changeReturned: 0,
    posReceived: 1000000,
    posReferenceNumber: '۸۸۴۱۲۵',
    chequeReceived: 0,
    chequeReferenceNumber: '',
    creditNesiyehAmount: 3200000,
    notes: 'ارسال با پیک موتوری به کارگاه بهارستان - تحویل سرکارگر',
    createdByRole: 'مدیر سیستم',
    exceededCreditApprovedByAdmin: false,
  },
  {
    id: 'doc-1002',
    docNumber: 'ف-۱۴۰۴۰۲',
    docType: 'sales',
    date: '۱۴۰۴/۰۲/۱۲',
    counterpartyId: 'cp-202',
    counterpartyName: 'مزون عروس و مجلسی ترمه (خانم سادات حسینی)',
    warehouse: 'انبار مغازه',
    items: [
      {
        id: 'li-3',
        productId: 'prd-102',
        productCode: '۱۰۱۲',
        productName: 'دکمه فلزی پایه طلایی مانتویی نگین‌دار',
        unitUsed: 'sub',
        unitTitle: 'جین',
        quantity: 10,
        baseQuantityTotal: 120,
        unitPrice: 162000,
        purchaseCostUnit: 9500,
        discountAmount: 20000,
        totalRowAmount: 1600000,
        lastSoldPriceToCustomer: 13500,
      },
      {
        id: 'li-4',
        productId: 'prd-105',
        productCode: '۳۰۱۱',
        productName: 'روبان ساتن دو رو عرض ۲ سانت زرشکی',
        unitUsed: 'sub',
        unitTitle: 'رول ۲۵ متری',
        quantity: 6,
        baseQuantityTotal: 150,
        unitPrice: 130000,
        purchaseCostUnit: 3200,
        discountAmount: 0,
        totalRowAmount: 780000,
        lastSoldPriceToCustomer: 5200,
      },
    ],
    subtotal: 2400000,
    totalDiscount: 20000,
    grandTotal: 2380000,
    totalCostOfGoods: 1620000,
    previousCustomerBalance: 6520000,
    cashReceived: 0,
    cashTenderedByCustomer: 0,
    changeReturned: 0,
    posReceived: 0,
    posReferenceNumber: '',
    chequeReceived: 0,
    chequeReferenceNumber: '',
    creditNesiyehAmount: 2380000,
    notes: 'فاکتور نسیه کارگاهی - تسویه آخر ماه',
    createdByRole: 'حسابدار',
    exceededCreditApprovedByAdmin: false,
  },
  {
    id: 'doc-1003',
    docNumber: 'ب-ف-۱۴۰۴۰۱',
    docType: 'sales_return',
    date: '۱۴۰۴/۰۲/۱۴',
    counterpartyId: 'cp-201',
    counterpartyName: 'تولیدی مانتو و پوشاک بهارستان (حاج محمود رضایی)',
    warehouse: 'انبار مغازه',
    items: [
      {
        id: 'li-5',
        productId: 'prd-103',
        productCode: '۲۰۱۱',
        productName: 'زیپ مخفی ۵۰ سانتی درجه یک مشکی',
        unitUsed: 'base',
        unitTitle: 'عدد',
        quantity: 30,
        baseQuantityTotal: 30,
        unitPrice: 8700,
        purchaseCostUnit: 6200,
        discountAmount: 0,
        totalRowAmount: 261000,
        lastSoldPriceToCustomer: 8700,
      },
    ],
    subtotal: 261000,
    totalDiscount: 0,
    grandTotal: 261000,
    totalCostOfGoods: 186000,
    previousCustomerBalance: 14761000,
    cashReceived: 0,
    cashTenderedByCustomer: 0,
    changeReturned: 0,
    posReceived: 0,
    posReferenceNumber: '',
    chequeReceived: 0,
    chequeReferenceNumber: '',
    creditNesiyehAmount: 261000,
    notes: 'مرجوعی بابت گیر داشتن سرزیپ در ۳۰ عدد از بسته',
    createdByRole: 'حسابدار',
    exceededCreditApprovedByAdmin: false,
  },
];

const INITIAL_KARDEX: KardexMovement[] = [
  {
    id: 'kdx-1',
    date: '۱۴۰۴/۰۲/۰۱',
    productId: 'prd-101',
    productName: 'دکمه صدفی پیراهنی سایز ۱۸ (بسته قرقره‌ای)',
    docNumber: 'اول دوره',
    movementType: 'موجودی اول دوره',
    warehouse: 'انبار مغازه',
    inBaseQty: 600,
    outBaseQty: 0,
    balanceBaseQty: 600,
    unitRatio: 12,
    baseUnit: 'عدد',
    subUnit: 'جین',
    counterpartyName: 'تراز افتتاحیه انبار',
  },
  {
    id: 'kdx-2',
    date: '۱۴۰۴/۰۲/۱۰',
    productId: 'prd-101',
    productName: 'دکمه صدفی پیراهنی سایز ۱۸ (بسته قرقره‌ای)',
    docNumber: 'ف-۱۴۰۴۰۱',
    movementType: 'فاکتور فروش',
    warehouse: 'انبار مغازه',
    inBaseQty: 0,
    outBaseQty: 240,
    balanceBaseQty: 360,
    unitRatio: 12,
    baseUnit: 'عدد',
    subUnit: 'جین',
    counterpartyName: 'تولیدی مانتو و پوشاک بهارستان (حاج محمود رضایی)',
  },
  {
    id: 'kdx-3',
    date: '۱۴۰۴/۰۲/۱۰',
    productId: 'prd-103',
    productName: 'زیپ مخفی ۵۰ سانتی درجه یک مشکی',
    docNumber: 'ف-۱۴۰۴۰۱',
    movementType: 'فاکتور فروش',
    warehouse: 'انبار مغازه',
    inBaseQty: 0,
    outBaseQty: 500,
    balanceBaseQty: 220,
    unitRatio: 100,
    baseUnit: 'عدد',
    subUnit: 'بسته صدتایی',
    counterpartyName: 'تولیدی مانتو و پوشاک بهارستان (حاج محمود رضایی)',
  },
  {
    id: 'kdx-4',
    date: '۱۴۰۴/۰۲/۱۴',
    productId: 'prd-103',
    productName: 'زیپ مخفی ۵۰ سانتی درجه یک مشکی',
    docNumber: 'ب-ف-۱۴۰۴۰۱',
    movementType: 'برگشت از فروش',
    warehouse: 'انبار مغازه',
    inBaseQty: 30,
    outBaseQty: 0,
    balanceBaseQty: 250,
    unitRatio: 100,
    baseUnit: 'عدد',
    subUnit: 'بسته صدتایی',
    counterpartyName: 'تولیدی مانتو و پوشاک بهارستان (حاج محمود رضایی)',
  },
];

const INITIAL_PRINT_CONFIG: PrintEngineConfig = {
  paperSize: 'A4',
  visualStyle: 'کلاسیک هلو',
  fontSizeScale: 'متوسط',
  sections: [
    { id: 'storeLogoHeader', label: 'لوگو و سرنسخه فروشگاه', visible: true, order: 1 },
    { id: 'unionLicenseNumber', label: 'شماره پروانه کسب و صنف', visible: true, order: 2 },
    { id: 'previousCustomerBalance', label: 'مانده حساب قبلی مشتری (بد/بس)', visible: true, order: 3 },
    { id: 'settlementBreakdownBox', label: 'کادر ریز تسویه، تخفیف و الباقی', visible: true, order: 4 },
    { id: 'invoiceNotes', label: 'توضیحات فاکتور و شرایط مرجوعی', visible: true, order: 5 },
    { id: 'signatureStampBox', label: 'کادر مهر و امضای فروشنده و خریدار', visible: true, order: 6 },
  ],
};

const INITIAL_STORE_CONFIG: StoreBusinessConfig = {
  storeSignboardName: 'بازرگانی خرازی و یراق‌آلات خیاطی نقش جهان',
  guildTitle: 'اتحادیه صنف خرازان، قماش‌فروشان و وابستگان تهران',
  unionLicenseNumber: '۰۴۵۸۹۱۲۳۶۷',
  phoneNumbers: '۰۲۱-۵۵۶۲۴۸۱۰  |  ۰۲۱-۵۵۶۲۴۸۱۱  |  همراه: ۰۹۱۲۱۱۴۸۵۲۰',
  storeAddress: 'تهران، بازار بزرگ، سرای مشیرخلوت، دالان دوم، پلاک ۴۴',
  invoiceFooterTerms: 'کالای فروخته‌شده در صورت سالم بودن بسته‌بندی جین یا طمار تا ۷۲ ساعت با ارائه فاکتور قابل تعویض می‌باشد.',
  currencyLabel: 'تومان',
};

const DOCUMENT_TABS_META: { id: DocumentTabType; title: string; prefix: string }[] = [
  { id: 'sales', title: 'فاکتور فروش', prefix: 'ف' },
  { id: 'purchase', title: 'فاکتور خرید', prefix: 'خ' },
  { id: 'proforma', title: 'پیش‌فاکتور', prefix: 'پ-ف' },
  { id: 'consignment', title: 'کالای امانی', prefix: 'امانی' },
  { id: 'sales_return', title: 'برگشت از فروش', prefix: 'ب-ف' },
  { id: 'purchase_return', title: 'برگشت از خرید', prefix: 'ب-خ' },
  { id: 'waste', title: 'ضایعات کالا', prefix: 'ضایعات' },
];

const EXPENSE_CATEGORIES_LIST: BazaarExpenseCategory[] = [
  'کرایه و شارژ مغازه',
  'پیک و وانت‌بار',
  'حقوق و مساعده شاگرد',
  'نایلون و ملزومات بسته‌بندی',
  'قبوض (برق، تلفن، آب)',
  'پذیرایی و چای مغازه',
  'تعمیرات و هزینه‌های متفرقه',
];
// ============================================================================
// ۴. کامپوننت اصلی سامانه جامع حسابداری و فروشگاهی خرازی
// ============================================================================

type MainScreenId =
  | 'dashboard'
  | 'unified_invoicing'
  | 'inventory_warehouse'
  | 'counterparties_credit'
  | 'treasury_cheques'
  | 'expenses_breakdown'
  | 'universal_reports'
  | 'system_settings';

type ReportSubType =
  | 'moein_ledger'
  | 'dual_kardex'
  | 'invoices_returns'
  | 'profit_loss'
  | 'cheques_status';

export default function KharraziCommercialERP() {
  // --- ۱. وضعیت احراز هویت و نقش فعال ---
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(true);
  const [activeRoleId, setActiveRoleId] = useState<UserRoleId>('admin');
  const [loginSelectedRole, setLoginSelectedRole] = useState<UserRoleId>('admin');
  const [loginPassword, setLoginPassword] = useState<string>('۱۲۳۴');
  const [loginError, setLoginError] = useState<string>('');
  const [currentUserFullName, setCurrentUserFullName] = useState<string>('حاج مهدی نقش‌جهانی');

  const activeRole = useMemo(
    () => ROLES_CATALOG.find((r) => r.id === activeRoleId) || ROLES_CATALOG[0],
    [activeRoleId]
  );

  // --- ۲. وضعیت پوسته (تاریک / روشن) و نوار کناری ---
  const [isDark, setIsDark] = useState<boolean>(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(false);
  // زیرمنوهای آکاردئونی به صورت پیش‌فرض بسته هستند (Accordion collapsed by default)
  const [openAccordionGroup, setOpenAccordionGroup] = useState<string | null>(null);
  const [activeScreen, setActiveScreen] = useState<MainScreenId>('unified_invoicing');

  useEffect(() => {
    const root = document.documentElement;
    if (isDark) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [isDark]);

  // --- ۳. داده‌های اصلی سامانه ---
  const [storeConfig, setStoreConfig] = useState<StoreBusinessConfig>(INITIAL_STORE_CONFIG);
  const [printConfig, setPrintConfig] = useState<PrintEngineConfig>(INITIAL_PRINT_CONFIG);
  const [products, setProducts] = useState<BazaarProduct[]>(INITIAL_PRODUCTS);
  const [counterparties, setCounterparties] = useState<Counterparty[]>(INITIAL_COUNTERPARTIES);
  const [historicalPrices, setHistoricalPrices] = useState<HistoricalPriceEntry[]>(INITIAL_HISTORICAL_PRICES);
  const [documents, setDocuments] = useState<TradeDocument[]>(INITIAL_DOCUMENTS);
  const [cheques, setCheques] = useState<BazaarCheque[]>(INITIAL_CHEQUES);
  const [expenses, setExpenses] = useState<ExpenseVoucher[]>(INITIAL_EXPENSES);
  const [kardexList, setKardexList] = useState<KardexMovement[]>(INITIAL_KARDEX);

  // --- ۴. وضعیت موتور یکپارچه صدور فاکتور (Unified 7-Tab Invoicing) ---
  const [activeInvoiceTab, setActiveInvoiceTab] = useState<DocumentTabType>('sales');
  const [selectedCounterpartyId, setSelectedCounterpartyId] = useState<string>('cp-201');
  const [selectedWarehouse, setSelectedWarehouse] = useState<WarehouseLocation>('انبار مغازه');
  const [invoiceDate, setInvoiceDate] = useState<string>('۱۴۰۴/۰۲/۱۸');
  const [invoiceNotes, setInvoiceNotes] = useState<string>('');
  const [invoiceLines, setInvoiceLines] = useState<InvoiceLineItem[]>([
    {
      id: 'init-row-1',
      productId: 'prd-101',
      productCode: '۱۰۱۱',
      productName: 'دکمه صدفی پیراهنی سایز ۱۸ (بسته قرقره‌ای)',
      unitUsed: 'sub',
      unitTitle: 'جین',
      quantity: 10,
      baseQuantityTotal: 120,
      unitPrice: 45600,
      purchaseCostUnit: 2800,
      discountAmount: 0,
      totalRowAmount: 456000,
      lastSoldPriceToCustomer: 3750,
    },
    {
      id: 'init-row-2',
      productId: 'prd-103',
      productCode: '۲۰۱۱',
      productName: 'زیپ مخفی ۵۰ سانتی درجه یک مشکی',
      unitUsed: 'sub',
      unitTitle: 'بسته صدتایی',
      quantity: 3,
      baseQuantityTotal: 300,
      unitPrice: 890000,
      purchaseCostUnit: 6200,
      discountAmount: 20000,
      totalRowAmount: 2650000,
      lastSoldPriceToCustomer: 8700,
    },
  ]);

  // تسویه به سبک هلو (Holoo Settlement Box)
  const [cashReceivedInput, setCashReceivedInput] = useState<number>(1000000);
  const [cashTenderedByCustomer, setCashTenderedByCustomer] = useState<number>(1500000);
  const [posReceivedInput, setPosReceivedInput] = useState<number>(500000);
  const [posReferenceInput, setPosReferenceInput] = useState<string>('۷۴۱۲۵۸');
  const [chequeReceivedInput, setChequeReceivedInput] = useState<number>(0);
  const [chequeReferenceInput, setChequeReferenceInput] = useState<string>('');
  const [invoiceStatusBanner, setInvoiceStatusBanner] = useState<{
    type: 'success' | 'error' | 'warning';
    text: string;
  } | null>(null);

  // --- ۵. وضعیت پنجره انتخاب سریع کالا (Instant Item Selector Modal) ---
  const [isItemModalOpen, setIsItemModalOpen] = useState<boolean>(false);
  const [activeRowIndexForModal, setActiveRowIndexForModal] = useState<number | null>(null);
  const [itemModalCategoryFilter, setItemModalCategoryFilter] = useState<string>('cat-all');
  const [itemModalSearchQuery, setItemModalSearchQuery] = useState<string>('');
  const [itemModalHighlightedIdx, setItemModalHighlightedIdx] = useState<number>(0);

  // --- ۶. وضعیت هشدار سقف اعتبار هوشمند (Smart Credit Ceiling Guard) ---
  const [creditCeilingAlertModal, setCreditCeilingAlertModal] = useState<{
    isOpen: boolean;
    bookExceededAmount: number;
    chequeExceededAmount: number;
    adminOverrideCode: string;
  }>({
    isOpen: false,
    bookExceededAmount: 0,
    chequeExceededAmount: 0,
    adminOverrideCode: '',
  });

  // --- ۷. وضعیت پنجره تنظیمات قالب چاپ و پیش‌نمایش چاپ ---
  const [isPrintConfigModalOpen, setIsPrintConfigModalOpen] = useState<boolean>(false);
  const [isPrintPreviewModalOpen, setIsPrintPreviewModalOpen] = useState<boolean>(false);
  const [documentToPrint, setDocumentToPrint] = useState<TradeDocument | null>(null);

  // --- ۸. وضعیت پنجره خرج چک (Endorsement) و ثبت چک جدید ---
  const [endorseModalChequeId, setEndorseModalChequeId] = useState<string | null>(null);
  const [endorseTargetSupplierId, setEndorseTargetSupplierId] = useState<string>('cp-301');
  const [newChequeForm, setNewChequeForm] = useState<{
    sayadiNumber: string;
    serialNumber: string;
    bankName: string;
    counterpartyId: string;
    direction: 'incoming' | 'outgoing';
    amount: number;
    dueDate: string;
  }>({
    sayadiNumber: '۴۰۱۲۷۷۸۸۹۹۰۰۱۱۲۲',
    serialNumber: '۵۵۸۸۴۴',
    bankName: 'بانک ملت - شعبه بازار',
    counterpartyId: 'cp-201',
    direction: 'incoming',
    amount: 8500000,
    dueDate: '۱۴۰۴/۰۳/۱۵',
  });

  // --- ۹. وضعیت فرم ثبت هزینه جدید ---
  const [newExpenseForm, setNewExpenseForm] = useState<{
    date: string;
    category: BazaarExpenseCategory;
    amount: number;
    paymentSource: PaymentSourceType;
    bankOrCashTitle: string;
    recipientName: string;
    description: string;
  }>({
    date: '۱۴۰۴/۰۲/۱۸',
    category: 'پیک و وانت‌بار',
    amount: 450000,
    paymentSource: 'صندوق',
    bankOrCashTitle: 'صندوق نقد پیشخوان',
    recipientName: 'موتورسوار بازار (آقا رحیم)',
    description: 'ارسال بار دکمه و زیپ به کارگاه میدان بهارستان',
  });

  // --- ۱۰. وضعیت سیستم گزارشات جامع (Multi-Scale Reports) ---
  const [activeReportTab, setActiveReportTab] = useState<ReportSubType>('moein_ledger');
  const [reportCounterpartyFilter, setReportCounterpartyFilter] = useState<string>('cp-201');
  const [reportProductFilter, setReportProductFilter] = useState<string>('prd-101');
  const [reportDateFrom, setReportDateFrom] = useState<string>('۱۴۰۴/۰۱/۰۱');
  const [reportDateTo, setReportDateTo] = useState<string>('۱۴۰۴/۱۲/۲۹');

  // --- ۱۱. وضعیت افزودن کالای جدید در انبار ---
  const [isNewProductModalOpen, setIsNewProductModalOpen] = useState<boolean>(false);
  const [newProductForm, setNewProductForm] = useState<{
    code: string;
    name: string;
    categoryTitle: string;
    baseUnit: string;
    subUnit: string;
    conversionRatio: number;
    purchasePrice: number;
    retailPrice: number;
    wholesalePrice: number;
    stockShop: number;
    stockCentral: number;
    shelfLocation: string;
  }>({
    code: '۶۰۱۱',
    name: 'قزن فلزی مانتویی مشکی بسته قرقره‌ای',
    categoryTitle: 'دکمه پیراهنی و مانتویی',
    baseUnit: 'عدد',
    subUnit: 'جین',
    conversionRatio: 12,
    purchasePrice: 3100,
    retailPrice: 5200,
    wholesalePrice: 4300,
    stockShop: 144,
    stockCentral: 720,
    shelfLocation: 'قفسه الف - ردیف ۵',
  });

  // --- ۱۲. محاسبات لحظه‌ای طرف حساب، آخرین قیمت فروش و جمع فاکتور ---
  const selectedCounterparty = useMemo(
    () => counterparties.find((c) => c.id === selectedCounterpartyId) || counterparties[0],
    [counterparties, selectedCounterpartyId]
  );

  const lookupLastSoldPrice = (counterpartyId: string, productId: string): number | null => {
    const found = historicalPrices.find(
      (h) => h.counterpartyId === counterpartyId && h.productId === productId
    );
    return found ? found.lastUnitPrice : null;
  };

  // بروزرسانی آخرین قیمت فروش مشتری هنگام تغییر طرف حساب
  useEffect(() => {
    setInvoiceLines((prev) =>
      prev.map((line) => ({
        ...line,
        lastSoldPriceToCustomer: lookupLastSoldPrice(selectedCounterpartyId, line.productId),
      }))
    );
  }, [selectedCounterpartyId, historicalPrices]);

  const invoiceTotals = useMemo(() => {
    let subtotal = 0;
    let totalDiscount = 0;
    let totalCostOfGoods = 0;

    for (const line of invoiceLines) {
      const gross = line.quantity * line.unitPrice;
      subtotal += gross;
      totalDiscount += line.discountAmount || 0;
      totalCostOfGoods += line.baseQuantityTotal * line.purchaseCostUnit;
    }

    const grandTotal = Math.max(0, subtotal - totalDiscount);
    const totalSettledImmediately =
      (Number(cashReceivedInput) || 0) +
      (Number(posReceivedInput) || 0) +
      (Number(chequeReceivedInput) || 0);
    const creditNesiyehAmount = Math.max(0, grandTotal - totalSettledImmediately);
    const changeReturned = Math.max(0, (Number(cashTenderedByCustomer) || 0) - (Number(cashReceivedInput) || 0));

    return {
      subtotal,
      totalDiscount,
      grandTotal,
      totalCostOfGoods,
      creditNesiyehAmount,
      changeReturned,
    };
  }, [invoiceLines, cashReceivedInput, cashTenderedByCustomer, posReceivedInput, chequeReceivedInput]);

  // فیلتر درختی کالاها در مودال انتخاب سریع کالا
  const filteredModalProducts = useMemo(() => {
    return products.filter((p) => {
      let matchesCategory = true;
      if (itemModalCategoryFilter !== 'cat-all') {
        const childCats = INITIAL_CATEGORY_TREE.filter(
          (c) => c.id === itemModalCategoryFilter || c.parentId === itemModalCategoryFilter
        ).map((c) => c.id);
        matchesCategory = childCats.includes(p.categoryId);
      }
      const q = itemModalSearchQuery.trim();
      const matchesQuery =
        !q || p.name.includes(q) || p.code.includes(q) || toFaDigits(p.code).includes(toFaDigits(q));
      return matchesCategory && matchesQuery;
    });
  }, [products, itemModalCategoryFilter, itemModalSearchQuery]);

  // مدیریت کلیدهای صفحه‌کلید (Escape برای بستن پنجره‌ها و حرکت با کلیدهای جهت‌نما در مودال کالا)
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isItemModalOpen) setIsItemModalOpen(false);
        if (isPrintConfigModalOpen) setIsPrintConfigModalOpen(false);
        if (isPrintPreviewModalOpen) setIsPrintPreviewModalOpen(false);
        if (creditCeilingAlertModal.isOpen) {
          setCreditCeilingAlertModal((prev) => ({ ...prev, isOpen: false }));
        }
        if (endorseModalChequeId) setEndorseModalChequeId(null);
        if (isNewProductModalOpen) setIsNewProductModalOpen(false);
      } else if (isItemModalOpen) {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          setItemModalHighlightedIdx((prev) =>
            Math.min(prev + 1, Math.max(0, filteredModalProducts.length - 1))
          );
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          setItemModalHighlightedIdx((prev) => Math.max(0, prev - 1));
        } else if (e.key === 'Enter' && filteredModalProducts[itemModalHighlightedIdx]) {
          e.preventDefault();
          handleSelectProductFromModal(filteredModalProducts[itemModalHighlightedIdx]);
        }
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [
    isItemModalOpen,
    isPrintConfigModalOpen,
    isPrintPreviewModalOpen,
    creditCeilingAlertModal.isOpen,
    endorseModalChequeId,
    isNewProductModalOpen,
    filteredModalProducts,
    itemModalHighlightedIdx,
  ]);

  // حرکت به فیلد بعدی با کلید Enter در فرم‌های ورود اطلاعات
  const handleEnterMoveNext = (e: React.KeyboardEvent<HTMLElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      const target = e.target as HTMLElement;
      if (target.tagName === 'TEXTAREA' || target.tagName === 'BUTTON') return;
      e.preventDefault();
      const formElements = Array.from(
        document.querySelectorAll<HTMLElement>(
          'input:not([disabled]), select:not([disabled]), [data-enter-nav="true"]'
        )
      );
      const idx = formElements.indexOf(target);
      if (idx > -1 && idx + 1 < formElements.length) {
        formElements[idx + 1].focus();
      }
    }
  };
  // --- ۱۳. توابع عملیاتی صدور فاکتور، انتخاب کالا و کنترل سقف اعتبار ---

  const openItemSelectorForRow = (rowIdx: number | null) => {
    setActiveRowIndexForModal(rowIdx);
    setItemModalHighlightedIdx(0);
    setIsItemModalOpen(true);
  };

  const handleSelectProductFromModal = (prd: BazaarProduct) => {
    const lastPrice = lookupLastSoldPrice(selectedCounterpartyId, prd.id);
    const defaultUnitUsed: 'base' | 'sub' = 'sub';
    const ratio = prd.conversionRatio || 1;
    const unitBasePrice =
      activeInvoiceTab === 'purchase' || activeInvoiceTab === 'purchase_return'
        ? prd.purchasePrice
        : lastPrice || prd.wholesalePrice;
    const computedUnitPrice = defaultUnitUsed === 'sub' ? unitBasePrice * ratio : unitBasePrice;

    const newLine: InvoiceLineItem = {
      id: `line-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      productId: prd.id,
      productCode: prd.code,
      productName: prd.name,
      unitUsed: defaultUnitUsed,
      unitTitle: defaultUnitUsed === 'sub' ? prd.subUnit : prd.baseUnit,
      quantity: 1,
      baseQuantityTotal: defaultUnitUsed === 'sub' ? ratio : 1,
      unitPrice: computedUnitPrice,
      purchaseCostUnit: prd.purchasePrice,
      discountAmount: 0,
      totalRowAmount: computedUnitPrice,
      lastSoldPriceToCustomer: lastPrice,
    };

    if (activeRowIndexForModal !== null && activeRowIndexForModal < invoiceLines.length) {
      setInvoiceLines((prev) =>
        prev.map((row, i) => (i === activeRowIndexForModal ? newLine : row))
      );
    } else {
      setInvoiceLines((prev) => [...prev, newLine]);
    }
    setIsItemModalOpen(false);
  };

  const handleLineUnitToggle = (index: number, newUnitUsed: 'base' | 'sub') => {
    setInvoiceLines((prev) =>
      prev.map((line, i) => {
        if (i !== index) return line;
        const prd = products.find((p) => p.id === line.productId);
        if (!prd) return line;
        const ratio = prd.conversionRatio || 1;
        const baseUnitPrice =
          line.unitUsed === 'sub' ? Math.round(line.unitPrice / ratio) : line.unitPrice;
        const updatedUnitPrice = newUnitUsed === 'sub' ? baseUnitPrice * ratio : baseUnitPrice;
        const updatedBaseQty = newUnitUsed === 'sub' ? line.quantity * ratio : line.quantity;
        const updatedTotal = Math.max(0, line.quantity * updatedUnitPrice - line.discountAmount);
        return {
          ...line,
          unitUsed: newUnitUsed,
          unitTitle: newUnitUsed === 'sub' ? prd.subUnit : prd.baseUnit,
          unitPrice: updatedUnitPrice,
          baseQuantityTotal: updatedBaseQty,
          totalRowAmount: updatedTotal,
        };
      })
    );
  };

  const handleLineFieldChange = (
    index: number,
    field: 'quantity' | 'unitPrice' | 'discountAmount',
    rawValue: number
  ) => {
    const val = Math.max(0, Number(rawValue) || 0);
    setInvoiceLines((prev) =>
      prev.map((line, i) => {
        if (i !== index) return line;
        const prd = products.find((p) => p.id === line.productId);
        const ratio = prd?.conversionRatio || 1;
        const nextQty = field === 'quantity' ? val : line.quantity;
        const nextPrice = field === 'unitPrice' ? val : line.unitPrice;
        const nextDisc = field === 'discountAmount' ? val : line.discountAmount;
        const baseQuantityTotal = line.unitUsed === 'sub' ? nextQty * ratio : nextQty;
        const totalRowAmount = Math.max(0, nextQty * nextPrice - nextDisc);
        return {
          ...line,
          quantity: nextQty,
          unitPrice: nextPrice,
          discountAmount: nextDisc,
          baseQuantityTotal,
          totalRowAmount,
        };
      })
    );
  };

  const handleRemoveInvoiceLine = (index: number) => {
    setInvoiceLines((prev) => prev.filter((_, i) => i !== index));
  };

  // بررسی سقف اعتبار دوگانه (سقف بدهی نسیه دفتری + سقف چک‌های در جریان) پیش از ثبت نهایی فاکتور
  const attemptFinalizeInvoice = (adminApprovedOverride = false) => {
    if (invoiceLines.length === 0) {
      setInvoiceStatusBanner({
        type: 'error',
        text: 'هیچ ردیف کالایی در فاکتور درج نشده است. لطفاً ابتدا کالا را انتخاب نمایید.',
      });
      return;
    }

    if (activeInvoiceTab === 'sales' && selectedCounterparty.id !== 'cp-walkin') {
      const projectedBookDebt =
        selectedCounterparty.openBookBalance + invoiceTotals.creditNesiyehAmount;
      const projectedChequeDebt =
        selectedCounterparty.unclearedChequesTotal + (Number(chequeReceivedInput) || 0);

      const bookExceeded =
        selectedCounterparty.creditLimitBook > 0
          ? Math.max(0, projectedBookDebt - selectedCounterparty.creditLimitBook)
          : 0;
      const chequeExceeded =
        selectedCounterparty.creditLimitCheques > 0
          ? Math.max(0, projectedChequeDebt - selectedCounterparty.creditLimitCheques)
          : 0;

      if ((bookExceeded > 0 || chequeExceeded > 0) && !adminApprovedOverride) {
        setCreditCeilingAlertModal({
          isOpen: true,
          bookExceededAmount: bookExceeded,
          chequeExceededAmount: chequeExceeded,
          adminOverrideCode: '',
        });
        return;
      }
    }

    const tabMeta =
      DOCUMENT_TABS_META.find((t) => t.id === activeInvoiceTab) || DOCUMENT_TABS_META[0];
    const newDocNumber = `${tabMeta.prefix}-${toFaDigits(140400 + documents.length + 1)}`;

    const createdDoc: TradeDocument = {
      id: `doc-${Date.now()}`,
      docNumber: newDocNumber,
      docType: activeInvoiceTab,
      date: invoiceDate,
      counterpartyId: selectedCounterparty.id,
      counterpartyName: selectedCounterparty.fullName,
      warehouse: selectedWarehouse,
      items: invoiceLines,
      subtotal: invoiceTotals.subtotal,
      totalDiscount: invoiceTotals.totalDiscount,
      grandTotal: invoiceTotals.grandTotal,
      totalCostOfGoods: invoiceTotals.totalCostOfGoods,
      previousCustomerBalance: selectedCounterparty.openBookBalance,
      cashReceived: Number(cashReceivedInput) || 0,
      cashTenderedByCustomer: Number(cashTenderedByCustomer) || 0,
      changeReturned: invoiceTotals.changeReturned,
      posReceived: Number(posReceivedInput) || 0,
      posReferenceNumber: posReferenceInput,
      chequeReceived: Number(chequeReceivedInput) || 0,
      chequeReferenceNumber: chequeReferenceInput,
      creditNesiyehAmount: invoiceTotals.creditNesiyehAmount,
      notes: invoiceNotes || `ثبت از طریق بخش ${tabMeta.title}`,
      createdByRole: activeRole.title,
      exceededCreditApprovedByAdmin: adminApprovedOverride,
    };

    // ۱. ثبت در فهرست اسناد
    setDocuments((prev) => [createdDoc, ...prev]);

    // ۲. بروزرسانی موجودی انبار و کاردکس دو واحدی (به جز پیش‌فاکتور)
    if (activeInvoiceTab !== 'proforma') {
      const isOutward =
        activeInvoiceTab === 'sales' ||
        activeInvoiceTab === 'purchase_return' ||
        activeInvoiceTab === 'waste' ||
        activeInvoiceTab === 'consignment';

      setProducts((prevProducts) =>
        prevProducts.map((p) => {
          const matchingLines = invoiceLines.filter((l) => l.productId === p.id);
          if (matchingLines.length === 0) return p;
          const totalBaseDelta = matchingLines.reduce((sum, l) => sum + l.baseQuantityTotal, 0);
          const sign = isOutward ? -1 : 1;
          if (selectedWarehouse === 'انبار مغازه') {
            return { ...p, stockShop: Math.max(0, p.stockShop + sign * totalBaseDelta) };
          }
          if (selectedWarehouse === 'انبار مرکزی بازار') {
            return { ...p, stockCentral: Math.max(0, p.stockCentral + sign * totalBaseDelta) };
          }
          return { ...p, stockDamaged: Math.max(0, p.stockDamaged + sign * totalBaseDelta) };
        })
      );

      // ثبت گردش کاردکس و آخرین قیمت فروش به مشتری
      const newKardexEntries: KardexMovement[] = invoiceLines.map((line, idx) => {
        const prd = products.find((p) => p.id === line.productId);
        const currentStock = prd ? prd.stockShop : 0;
        const isOut = isOutward;
        return {
          id: `kdx-${Date.now()}-${idx}`,
          date: invoiceDate,
          productId: line.productId,
          productName: line.productName,
          docNumber: newDocNumber,
          movementType: tabMeta.title,
          warehouse: selectedWarehouse,
          inBaseQty: isOut ? 0 : line.baseQuantityTotal,
          outBaseQty: isOut ? line.baseQuantityTotal : 0,
          balanceBaseQty: Math.max(
            0,
            currentStock + (isOut ? -line.baseQuantityTotal : line.baseQuantityTotal)
          ),
          unitRatio: prd?.conversionRatio || 1,
          baseUnit: prd?.baseUnit || 'عدد',
          subUnit: prd?.subUnit || 'بسته',
          counterpartyName: selectedCounterparty.fullName,
        };
      });
      setKardexList((prev) => [...newKardexEntries, ...prev]);

      if (activeInvoiceTab === 'sales') {
        setHistoricalPrices((prevHist) => {
          const updated = [...prevHist];
          for (const line of invoiceLines) {
            const prd = products.find((p) => p.id === line.productId);
            const ratio = prd?.conversionRatio || 1;
            const unitBasePrice =
              line.unitUsed === 'sub' ? Math.round(line.unitPrice / ratio) : line.unitPrice;
            const existingIdx = updated.findIndex(
              (h) => h.counterpartyId === selectedCounterparty.id && h.productId === line.productId
            );
            const entry: HistoricalPriceEntry = {
              counterpartyId: selectedCounterparty.id,
              productId: line.productId,
              lastUnitPrice: unitBasePrice,
              lastSoldDate: invoiceDate,
              invoiceNumber: newDocNumber,
            };
            if (existingIdx >= 0) {
              updated[existingIdx] = entry;
            } else {
              updated.push(entry);
            }
          }
          return updated;
        });
      }

      // ۳. بروزرسانی مانده حساب دفتری و چک طرف حساب
      setCounterparties((prevCps) =>
        prevCps.map((cp) => {
          if (cp.id !== selectedCounterparty.id) return cp;
          let bookDelta = 0;
          if (activeInvoiceTab === 'sales') bookDelta = invoiceTotals.creditNesiyehAmount;
          else if (activeInvoiceTab === 'sales_return') bookDelta = -invoiceTotals.grandTotal;
          else if (activeInvoiceTab === 'purchase') bookDelta = -invoiceTotals.creditNesiyehAmount;
          else if (activeInvoiceTab === 'purchase_return') bookDelta = invoiceTotals.grandTotal;

          return {
            ...cp,
            openBookBalance: cp.openBookBalance + bookDelta,
            unclearedChequesTotal:
              cp.unclearedChequesTotal +
              (activeInvoiceTab === 'sales' ? Number(chequeReceivedInput) || 0 : 0),
          };
        })
      );
    }

    setCreditCeilingAlertModal({
      isOpen: false,
      bookExceededAmount: 0,
      chequeExceededAmount: 0,
      adminOverrideCode: '',
    });
    setDocumentToPrint(createdDoc);
    setInvoiceStatusBanner({
      type: 'success',
      text: `${tabMeta.title} به شماره «${newDocNumber}» با موفقیت در دفتر روزنامه، معین و کاردکس انبار ثبت قطعی شد.`,
    });
  };

  // خرج چک به تأمین‌کننده (Endorsement)
  const handleConfirmEndorseCheque = () => {
    if (!endorseModalChequeId) return;
    const chq = cheques.find((c) => c.id === endorseModalChequeId);
    const supplier = counterparties.find((cp) => cp.id === endorseTargetSupplierId);
    if (!chq || !supplier) return;

    setCheques((prev) =>
      prev.map((c) =>
        c.id === endorseModalChequeId
          ? {
              ...c,
              status: 'خرج‌شده به غیر',
              endorsedToCounterpartyId: supplier.id,
              endorsedToName: supplier.fullName,
            }
          : c
      )
    );

    // کسر از بدهی ما به تأمین‌کننده
    setCounterparties((prev) =>
      prev.map((cp) =>
        cp.id === supplier.id ? { ...cp, openBookBalance: cp.openBookBalance + chq.amount } : cp
      )
    );

    setEndorseModalChequeId(null);
  };

  // تغییر وضعیت چک (وصول یا برگشت)
  const handleUpdateChequeStatus = (chequeId: string, nextStatus: BazaarCheque['status']) => {
    const target = cheques.find((c) => c.id === chequeId);
    if (!target) return;
    setCheques((prev) => prev.map((c) => (c.id === chequeId ? { ...c, status: nextStatus } : c)));
    if (nextStatus === 'وصول‌شده') {
      setCounterparties((prev) =>
        prev.map((cp) =>
          cp.id === target.counterpartyId
            ? { ...cp, unclearedChequesTotal: Math.max(0, cp.unclearedChequesTotal - target.amount) }
            : cp
        )
      );
    }
  };

  // ثبت چک جدید
  const handleCreateNewCheque = (e: React.FormEvent) => {
    e.preventDefault();
    const cp = counterparties.find((c) => c.id === newChequeForm.counterpartyId);
    if (!cp || newChequeForm.amount <= 0) return;
    const created: BazaarCheque = {
      id: `chq-${Date.now()}`,
      sayadiNumber: toFaDigits(newChequeForm.sayadiNumber),
      serialNumber: toFaDigits(newChequeForm.serialNumber),
      bankName: newChequeForm.bankName,
      drawerName: cp.fullName,
      counterpartyId: cp.id,
      direction: newChequeForm.direction,
      amount: Number(newChequeForm.amount),
      issueDate: '۱۴۰۴/۰۲/۱۸',
      dueDate: toFaDigits(newChequeForm.dueDate),
      status: 'در جریان وصول',
    };
    setCheques((prev) => [created, ...prev]);
    setCounterparties((prev) =>
      prev.map((item) =>
        item.id === cp.id
          ? {
              ...item,
              unclearedChequesTotal: item.unclearedChequesTotal + Number(newChequeForm.amount),
              openBookBalance:
                newChequeForm.direction === 'incoming'
                  ? item.openBookBalance - Number(newChequeForm.amount)
                  : item.openBookBalance + Number(newChequeForm.amount),
            }
          : item
      )
    );
  };

  // ثبت سند هزینه جدید
  const handleCreateExpense = (e: React.FormEvent) => {
    e.preventDefault();
    if (newExpenseForm.amount <= 0) return;
    const voucher: ExpenseVoucher = {
      id: `exp-${Date.now()}`,
      voucherNumber: `هـ-${toFaDigits(140400 + expenses.length + 1)}`,
      date: toFaDigits(newExpenseForm.date),
      category: newExpenseForm.category,
      amount: Number(newExpenseForm.amount),
      paymentSource: newExpenseForm.paymentSource,
      bankOrCashTitle: newExpenseForm.bankOrCashTitle,
      recipientName: newExpenseForm.recipientName,
      description: newExpenseForm.description,
      registeredByRole: activeRole.title,
    };
    setExpenses((prev) => [voucher, ...prev]);
  };

  // ثبت کالای جدید در انبار
  const handleCreateNewProduct = (e: React.FormEvent) => {
    e.preventDefault();
    const created: BazaarProduct = {
      id: `prd-${Date.now()}`,
      code: toFaDigits(newProductForm.code),
      name: newProductForm.name,
      categoryId: 'cat-buttons-shirt',
      categoryTitle: newProductForm.categoryTitle,
      baseUnit: newProductForm.baseUnit,
      subUnit: newProductForm.subUnit,
      conversionRatio: Math.max(1, Number(newProductForm.conversionRatio) || 1),
      purchasePrice: Number(newProductForm.purchasePrice) || 0,
      retailPrice: Number(newProductForm.retailPrice) || 0,
      wholesalePrice: Number(newProductForm.wholesalePrice) || 0,
      stockShop: Number(newProductForm.stockShop) || 0,
      stockCentral: Number(newProductForm.stockCentral) || 0,
      stockDamaged: 0,
      minOrderAlert: 50,
      shelfLocation: newProductForm.shelfLocation,
    };
    setProducts((prev) => [created, ...prev]);
    setIsNewProductModalOpen(false);
  };

  // تغییر چیدمان و نمایش بخش‌های قالب چاپ
  const togglePrintSectionVisibility = (secId: PrintSectionId) => {
    setPrintConfig((prev) => ({
      ...prev,
      sections: prev.sections.map((s) => (s.id === secId ? { ...s, visible: !s.visible } : s)),
    }));
  };

  const movePrintSectionOrder = (index: number, direction: 'up' | 'down') => {
    setPrintConfig((prev) => {
      const sorted = [...prev.sections].sort((a, b) => a.order - b.order);
      const swapIndex = direction === 'up' ? index - 1 : index + 1;
      if (swapIndex < 0 || swapIndex >= sorted.length) return prev;
      const tempOrder = sorted[index].order;
      sorted[index] = { ...sorted[index], order: sorted[swapIndex].order };
      sorted[swapIndex] = { ...sorted[swapIndex], order: tempOrder };
      return { ...prev, sections: sorted.sort((a, b) => a.order - b.order) };
    });
  };

  // ورود به سامانه
  const handleDesktopLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginPassword.trim()) {
      setLoginError('رمز عبور نمی‌تواند خالی باشد.');
      return;
    }
    setActiveRoleId(loginSelectedRole);
    if (loginSelectedRole === 'admin') setCurrentUserFullName('حاج مهدی نقش‌جهانی');
    else if (loginSelectedRole === 'accountant') setCurrentUserFullName('سرکار خانم محمدی (حسابدار)');
    else setCurrentUserFullName('آقا رضا مرادی (صندوقدار)');
    setLoginError('');
    setIsAuthenticated(true);
  };

  // ============================================================================
  // ۵. صفحه مستقل ورود دسکتاپ (Standalone Desktop Login Screen)
  // ============================================================================
  if (!isAuthenticated) {
    return (
      <div
        dir="rtl"
        className="min-h-screen w-full bg-slate-900 text-slate-100 flex items-center justify-center p-6 select-none"
      >
        <div className="w-full max-w-md bg-slate-800 border-2 border-slate-700 rounded-lg shadow-2xl overflow-hidden">
          <div className="bg-emerald-900/60 border-b border-slate-700 px-6 py-5 flex items-center gap-3">
            <div className="w-11 h-11 rounded bg-emerald-700 flex items-center justify-center text-white border border-emerald-500">
              <Store className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-lg font-black text-white">{storeConfig.storeSignboardName}</h1>
              <p className="text-xs text-emerald-200 mt-0.5">{storeConfig.guildTitle}</p>
            </div>
          </div>

          <form onSubmit={handleDesktopLogin} className="p-6 space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">
                انتخاب سمت و سطح دسترسی کاربر:
              </label>
              <div className="grid grid-cols-1 gap-2">
                {ROLES_CATALOG.map((role) => (
                  <button
                    key={role.id}
                    type="button"
                    onClick={() => setLoginSelectedRole(role.id)}
                    className={`w-full text-right px-3.5 py-2.5 rounded border flex items-center justify-between transition ${
                      loginSelectedRole === role.id
                        ? 'bg-emerald-950/90 border-emerald-500 text-emerald-200'
                        : 'bg-slate-900/70 border-slate-700 text-slate-300 hover:border-slate-500'
                    }`}
                  >
                    <div>
                      <div className="text-sm font-bold">{role.title}</div>
                      <div className="text-[11px] text-slate-400 mt-0.5">{role.description}</div>
                    </div>
                    <ShieldCheck
                      className={`w-5 h-5 shrink-0 ${
                        loginSelectedRole === role.id ? 'text-emerald-400' : 'text-slate-600'
                      }`}
                    />
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">
                رمز عبور سامانه (پیش‌فرض: ۱۲۳۴):
              </label>
              <div className="relative">
                <input
                  type="password"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-600 rounded px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none"
                  placeholder="رمز عبور را وارد کنید..."
                />
                <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
              </div>
            </div>

            {loginError && (
              <div className="bg-rose-950/80 border border-rose-700 text-rose-200 px-3 py-2 rounded text-xs font-bold">
                {loginError}
              </div>
            )}

            <button
              type="submit"
              className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black py-2.5 rounded border border-emerald-400 text-sm transition cursor-pointer"
            >
              ورود به میز کار حسابداری و فروش
            </button>

            <div className="pt-2 border-t border-slate-700 flex items-center justify-between text-[11px] text-slate-400">
              <span>سال مالی جاری: ۱۴۰۴ هجری شمسی</span>
              <span>شماره پروانه: {toFaDigits(storeConfig.unionLicenseNumber)}</span>
            </div>
          </form>
        </div>
      </div>
    );
  }
  // ============================================================================
  // ۶. ساختار منوهای آکاردئونی نوار کناری (Accordion Sidebar Navigation)
  // ============================================================================
  const sidebarGroups = [
    {
      id: 'grp-trade',
      title: 'عملیات بازرگانی و پیشخوان',
      icon: ShoppingBag,
      items: [
        { id: 'unified_invoicing' as MainScreenId, title: 'صدور یکپارچه فاکتور و اسناد کالا', allowed: true },
        { id: 'dashboard' as MainScreenId, title: 'میز کار و خلاصه وضعیت بازار', allowed: true },
      ],
    },
    {
      id: 'grp-inventory',
      title: 'انبارداری و کاردکس دو واحدی',
      icon: Package,
      items: [
        { id: 'inventory_warehouse' as MainScreenId, title: 'موجودی جین و طمار و قفسه‌بندی', allowed: true },
        { id: 'counterparties_credit' as MainScreenId, title: 'اشخاص، مشتریان و سقف اعتبار', allowed: true },
      ],
    },
    {
      id: 'grp-treasury',
      title: 'خزانه‌داری، چک و هزینه‌ها',
      icon: Landmark,
      items: [
        { id: 'treasury_cheques' as MainScreenId, title: 'عملیات چک، سررسید و خرج چک', allowed: true },
        { id: 'expenses_breakdown' as MainScreenId, title: 'تفکیک کامل هزینه‌های مغازه', allowed: true },
      ],
    },
    {
      id: 'grp-reports',
      title: 'گزارشات جامع و تنظیمات',
      icon: BarChart3,
      items: [
        {
          id: 'universal_reports' as MainScreenId,
          title: 'گزارشات معین، کاردکس و سود و زیان',
          allowed: activeRole.canAccessFinancialReports,
        },
        {
          id: 'system_settings' as MainScreenId,
          title: 'تنظیمات تابلو، صنف و قالب چاپ',
          allowed: activeRole.canAccessSystemSettings,
        },
      ],
    },
  ];

  const toggleAccordionGroup = (groupId: string) => {
    setOpenAccordionGroup((prev) => (prev === groupId ? null : groupId));
  };

  return (
    <div
      dir="rtl"
      onKeyDown={handleEnterMoveNext}
      className={`min-h-screen w-full flex flex-col md:flex-row overflow-x-hidden ${
        isDark ? 'bg-slate-950 text-slate-100' : 'bg-slate-100 text-slate-900'
      }`}
    >
      {/* ========================================================================
          نوار کناری تاشو با زیرمنوهای آکاردئونی و پروفایل کاربر در پایین
         ======================================================================== */}
      <aside
        className={`print:hidden shrink-0 flex flex-col justify-between border-l transition-all duration-200 ${
          isSidebarCollapsed ? 'w-16' : 'w-64'
        } ${
          isDark
            ? 'bg-slate-900 border-slate-800 text-slate-100'
            : 'bg-slate-900 border-slate-800 text-slate-100'
        }`}
      >
        {/* بخش بالایی: عنوان سامانه و منوهای آکاردئونی */}
        <div>
          <div className="h-12 px-3 border-b border-slate-800 flex items-center justify-between">
            {!isSidebarCollapsed && (
              <div className="flex items-center gap-2 truncate">
                <Store className="w-5 h-5 text-emerald-400 shrink-0" />
                <span className="font-black text-xs text-white truncate">
                  {storeConfig.storeSignboardName}
                </span>
              </div>
            )}
            <button
              type="button"
              onClick={() => setIsSidebarCollapsed((p) => !p)}
              title={isSidebarCollapsed ? 'باز کردن نوار منو' : 'جمع کردن نوار منو'}
              className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 cursor-pointer mx-auto md:mx-0"
            >
              {isSidebarCollapsed ? (
                <PanelLeftOpen className="w-4 h-4" />
              ) : (
                <PanelLeftClose className="w-4 h-4" />
              )}
            </button>
          </div>

          {/* دسترسی سریع به صفحه صدور فاکتور یکپارچه */}
          <div className="p-2 border-b border-slate-800">
            <button
              type="button"
              onClick={() => setActiveScreen('unified_invoicing')}
              className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded font-bold text-xs border transition cursor-pointer ${
                activeScreen === 'unified_invoicing'
                  ? 'bg-emerald-700 text-white border-emerald-500'
                  : 'bg-slate-800/80 text-slate-200 border-slate-700 hover:bg-slate-800'
              }`}
            >
              <FileSpreadsheet className="w-4 h-4 shrink-0 text-emerald-300" />
              {!isSidebarCollapsed && <span>میز صدور یکپارچه فاکتور</span>}
            </button>
          </div>

          {/* گروه‌های منوی آکاردئونی (به صورت پیش‌فرض بسته) */}
          <nav className="p-2 space-y-1.5">
            {sidebarGroups.map((group) => {
              const IconComp = group.icon;
              const isOpen = openAccordionGroup === group.id;
              const visibleItems = group.items.filter((i) => i.allowed);
              if (visibleItems.length === 0) return null;

              return (
                <div key={group.id} className="border border-slate-800 rounded bg-slate-950/40">
                  <button
                    type="button"
                    onClick={() => {
                      if (isSidebarCollapsed) {
                        setIsSidebarCollapsed(false);
                        setOpenAccordionGroup(group.id);
                      } else {
                        toggleAccordionGroup(group.id);
                      }
                    }}
                    className="w-full flex items-center justify-between px-2.5 py-2 text-xs font-bold text-slate-200 hover:bg-slate-800/60 transition cursor-pointer"
                  >
                    <div className="flex items-center gap-2 truncate">
                      <IconComp className="w-4 h-4 text-emerald-400 shrink-0" />
                      {!isSidebarCollapsed && <span className="truncate">{group.title}</span>}
                    </div>
                    {!isSidebarCollapsed &&
                      (isOpen ? (
                        <ChevronUp className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      ) : (
                        <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      ))}
                  </button>

                  {!isSidebarCollapsed && isOpen && (
                    <div className="border-t border-slate-800 px-2 py-1.5 space-y-1 bg-slate-950">
                      {visibleItems.map((subItem) => (
                        <button
                          key={subItem.id}
                          type="button"
                          onClick={() => setActiveScreen(subItem.id)}
                          className={`w-full text-right px-2.5 py-1.5 rounded text-xs font-semibold transition cursor-pointer flex items-center justify-between ${
                            activeScreen === subItem.id
                              ? 'bg-emerald-900/80 text-emerald-200 border border-emerald-700'
                              : 'text-slate-300 hover:bg-slate-800'
                          }`}
                        >
                          <span>{subItem.title}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </nav>
        </div>

        {/* بخش پایینی نوار کناری: مشخصات کاربر، تغییر نقش آزمایشی و دکمه خروج از حساب */}
        <div className="p-2.5 border-t border-slate-800 bg-slate-950/90 space-y-2">
          {!isSidebarCollapsed ? (
            <>
              <div className="px-2 py-1.5 rounded bg-slate-900 border border-slate-800">
                <div className="text-[11px] text-slate-400">کاربر فعال سامانه:</div>
                <div className="text-xs font-bold text-white truncate mt-0.5">
                  {currentUserFullName}
                </div>
                <div className="mt-1 flex items-center justify-between">
                  <span className="text-[11px] text-emerald-400 font-bold">
                    سمت: {activeRole.title}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-[10px] text-slate-400 mb-1">
                  تغییر سریع سطح دسترسی (جهت بررسی):
                </label>
                <select
                  value={activeRoleId}
                  onChange={(e) => {
                    const nextRole = e.target.value as UserRoleId;
                    setActiveRoleId(nextRole);
                    if (nextRole === 'cashier' && (activeScreen === 'universal_reports' || activeScreen === 'system_settings')) {
                      setActiveScreen('unified_invoicing');
                    }
                  }}
                  className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-slate-200"
                >
                  {ROLES_CATALOG.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.title}
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="button"
                onClick={() => setIsAuthenticated(false)}
                className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded bg-rose-900/70 hover:bg-rose-800 text-rose-100 border border-rose-700 text-xs font-bold transition cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>خروج از حساب</span>
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setIsAuthenticated(false)}
              title="خروج از حساب"
              className="w-full flex items-center justify-center p-2 rounded bg-rose-900/70 hover:bg-rose-800 text-rose-100 border border-rose-700 cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
            </button>
          )}
        </div>
      </aside>

      {/* ========================================================================
          محوطه اصلی کاربری (بدون هیچ‌گونه دکمه پروفایل یا نوار جستجو در هدر)
         ======================================================================== */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* نوار بالای صفحه (ساده، متراکم و بدون المان‌های پروفایل) */}
        <header
          className={`print:hidden h-12 px-4 border-b flex items-center justify-between shrink-0 ${
            isDark
              ? 'bg-slate-900 border-slate-800 text-slate-100'
              : 'bg-white border-slate-300 text-slate-900'
          }`}
        >
          <div className="flex items-center gap-3">
            <span className="font-black text-sm">{storeConfig.storeSignboardName}</span>
            <span className="text-xs text-slate-400">|</span>
            <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
              {storeConfig.guildTitle}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs px-2.5 py-1 rounded border bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-700 font-bold">
              واحد پول: {storeConfig.currencyLabel}
            </span>
            <span className="text-xs px-2.5 py-1 rounded border bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-700 font-bold">
              تاریخ روز: ۱۴۰۴/۰۲/۱۸
            </span>
            <button
              type="button"
              onClick={() => setIsPrintConfigModalOpen(true)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded border text-xs font-bold bg-amber-50 dark:bg-amber-950/50 border-amber-400 dark:border-amber-700 text-amber-900 dark:text-amber-200 cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>تنظیمات قالب چاپ</span>
            </button>
            <button
              type="button"
              onClick={() => setIsDark((d) => !d)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded border text-xs font-bold bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-700 cursor-pointer"
            >
              {isDark ? <Sun className="w-3.5 h-3.5 text-amber-400" /> : <Moon className="w-3.5 h-3.5 text-slate-700" />}
              <span>{isDark ? 'پوسته روشن' : 'پوسته تیره'}</span>
            </button>
          </div>
        </header>

        {/* محتوای صفحه فعال */}
        <main className="flex-1 p-3 md:p-4 overflow-y-auto print:p-0">
          {/* ====================================================================
              ۱. موتور یکپارچه صدور فاکتور (Unified 7-Tab Trade Invoicing Engine)
             ==================================================================== */}
          {activeScreen === 'unified_invoicing' && (
            <div className="space-y-3 print:hidden">
              {/* زبانه‌های هفت‌گانه اسناد بازرگانی (بدون هیچ‌گونه عدد یا نشانگر شمارنده) */}
              <div
                className={`flex flex-wrap items-center gap-1 p-1.5 rounded border ${
                  isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-300'
                }`}
              >
                {DOCUMENT_TABS_META.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => {
                      setActiveInvoiceTab(tab.id);
                      setInvoiceStatusBanner(null);
                    }}
                    className={`px-3.5 py-1.5 rounded text-xs font-black transition cursor-pointer border ${
                      activeInvoiceTab === tab.id
                        ? 'bg-emerald-700 text-white border-emerald-600 shadow-xs'
                        : isDark
                        ? 'bg-slate-800/70 text-slate-300 border-slate-700 hover:bg-slate-800'
                        : 'bg-slate-100 text-slate-700 border-slate-300 hover:bg-slate-200'
                    }`}
                  >
                    {tab.title}
                  </button>
                ))}
              </div>

              {/* پیام وضعیت ثبت سند */}
              {invoiceStatusBanner && (
                <div
                  className={`px-3.5 py-2 rounded border text-xs font-bold flex items-center justify-between ${
                    invoiceStatusBanner.type === 'success'
                      ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-400 text-emerald-900 dark:text-emerald-200'
                      : 'bg-rose-50 dark:bg-rose-950/60 border-rose-400 text-rose-900 dark:text-rose-200'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>{invoiceStatusBanner.text}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {documentToPrint && (
                      <button
                        type="button"
                        onClick={() => setIsPrintPreviewModalOpen(true)}
                        className="px-2.5 py-1 rounded bg-emerald-700 text-white text-xs font-bold cursor-pointer"
                      >
                        مشاهده و چاپ فاکتور
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setInvoiceStatusBanner(null)}
                      className="p-1 hover: opacity-80 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}

              {/* سربرگ فاکتور + نمایش لحظه‌ای مانده حساب و سقف اعتبار دوگانه مشتری */}
              <div
                className={`p-3 rounded border grid grid-cols-1 lg:grid-cols-12 gap-3 items-center ${
                  isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-300'
                }`}
              >
                <div className="lg:col-span-4">
                  <label className="block text-[11px] font-bold mb-1">
                    طرف حساب (مشتری / همکار / تأمین‌کننده):
                  </label>
                  <select
                    value={selectedCounterpartyId}
                    onChange={(e) => setSelectedCounterpartyId(e.target.value)}
                    className={`w-full rounded border px-2.5 py-1.5 text-xs font-bold ${
                      isDark
                        ? 'bg-slate-950 border-slate-700 text-slate-100'
                        : 'bg-slate-50 border-slate-300 text-slate-900'
                    }`}
                  >
                    {counterparties.map((cp) => (
                      <option key={cp.id} value={cp.id}>
                        {cp.code} - {cp.fullName} ({cp.titlePrefix})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="lg:col-span-2">
                  <label className="block text-[11px] font-bold mb-1">انبار مبدأ / مقصد:</label>
                  <select
                    value={selectedWarehouse}
                    onChange={(e) => setSelectedWarehouse(e.target.value as WarehouseLocation)}
                    className={`w-full rounded border px-2.5 py-1.5 text-xs font-bold ${
                      isDark
                        ? 'bg-slate-950 border-slate-700 text-slate-100'
                        : 'bg-slate-50 border-slate-300 text-slate-900'
                    }`}
                  >
                    <option value="انبار مغازه">انبار مغازه</option>
                    <option value="انبار مرکزی بازار">انبار مرکزی بازار</option>
                    <option value="انبار مرجوعی و ضایعات">انبار مرجوعی و ضایعات</option>
                  </select>
                </div>

                <div className="lg:col-span-2">
                  <label className="block text-[11px] font-bold mb-1">تاریخ سند شمسی:</label>
                  <input
                    type="text"
                    value={invoiceDate}
                    onChange={(e) => setInvoiceDate(toFaDigits(e.target.value))}
                    className={`w-full rounded border px-2.5 py-1.5 text-xs font-bold ${
                      isDark
                        ? 'bg-slate-950 border-slate-700 text-slate-100'
                        : 'bg-slate-50 border-slate-300 text-slate-900'
                    }`}
                  />
                </div>

                {/* کادر وضعیت لحظه‌ای مانده حساب و سقف اعتبار دوگانه */}
                <div className="lg:col-span-4 grid grid-cols-2 gap-2">
                  <div
                    className={`p-2 rounded border ${
                      selectedCounterparty.openBookBalance > 0
                        ? 'bg-amber-50/80 dark:bg-amber-950/40 border-amber-400 dark:border-amber-700'
                        : 'bg-emerald-50/80 dark:bg-emerald-950/40 border-emerald-400 dark:border-emerald-700'
                    }`}
                  >
                    <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400">
                      مانده حساب دفتری فعلی:
                    </div>
                    <div className="text-xs font-black mt-0.5">
                      {formatFaMoney(Math.abs(selectedCounterparty.openBookBalance))}{' '}
                      {storeConfig.currencyLabel}{' '}
                      <span className="underline">
                        {selectedCounterparty.openBookBalance > 0
                          ? 'بدهکار (بد)'
                          : selectedCounterparty.openBookBalance < 0
                          ? 'بستانکار (بس)'
                          : 'بی‌حساب'}
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-500 mt-0.5">
                      سقف نسیه:{' '}
                      {selectedCounterparty.creditLimitBook > 0
                        ? `${formatFaMoney(selectedCounterparty.creditLimitBook)} ${storeConfig.currencyLabel}`
                        : 'نقدی'}
                    </div>
                  </div>

                  <div className="p-2 rounded border bg-slate-100 dark:bg-slate-800/80 border-slate-300 dark:border-slate-700">
                    <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400">
                      چک‌های در جریان وصول شخص:
                    </div>
                    <div className="text-xs font-black mt-0.5">
                      {formatFaMoney(selectedCounterparty.unclearedChequesTotal)}{' '}
                      {storeConfig.currencyLabel}
                    </div>
                    <div className="text-[10px] text-slate-500 mt-0.5">
                      سقف چک:{' '}
                      {selectedCounterparty.creditLimitCheques > 0
                        ? `${formatFaMoney(selectedCounterparty.creditLimitCheques)} ${storeConfig.currencyLabel}`
                        : 'فاقد سقف چک'}
                    </div>
                  </div>
                </div>
              </div>
              {/* جدول اقلام فاکتور با قابلیت باز شدن مودال انتخاب کالا و نمایش آخرین فی فروش به مشتری */}
              <div
                className={`rounded border overflow-hidden ${
                  isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-300'
                }`}
              >
                <div className="px-3 py-2 border-b border-slate-300 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-950/60">
                  <div className="flex items-center gap-2">
                    <Layers className="w-4 h-4 text-emerald-600" />
                    <span className="text-xs font-black">
                      جدول اقلام سند (کلیک روی نام کالا جهت باز کردن فهرست درختی کالاها)
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => openItemSelectorForRow(null)}
                    className="flex items-center gap-1.5 px-3 py-1 rounded bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-bold cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>افزودن ردیف کالا (انتخاب از درخت کالا)</span>
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-right border-collapse text-xs">
                    <thead>
                      <tr
                        className={`border-b ${
                          isDark
                            ? 'bg-slate-950 border-slate-800 text-slate-300'
                            : 'bg-slate-100 border-slate-300 text-slate-700'
                        }`}
                      >
                        <th className="py-2 px-2 border-l border-slate-300 dark:border-slate-800 w-10 text-center">
                          ردیف
                        </th>
                        <th className="py-2 px-2.5 border-l border-slate-300 dark:border-slate-800">
                          کد و شرح کالای خرازی (کلیک جهت تغییر)
                        </th>
                        <th className="py-2 px-2 border-l border-slate-300 dark:border-slate-800 w-32">
                          واحد شمارش
                        </th>
                        <th className="py-2 px-2 border-l border-slate-300 dark:border-slate-800 w-24 text-center">
                          تعداد / مقدار
                        </th>
                        <th className="py-2 px-2 border-l border-slate-300 dark:border-slate-800 w-28 text-center">
                          معادل واحد جزء
                        </th>
                        <th className="py-2 px-2.5 border-l border-slate-300 dark:border-slate-800 w-36">
                          فی واحد ({storeConfig.currencyLabel})
                        </th>
                        <th className="py-2 px-2.5 border-l border-slate-300 dark:border-slate-800 w-40">
                          آخرین فی فروش به این مشتری
                        </th>
                        {activeRole.canSeePurchasePrice && (
                          <th className="py-2 px-2.5 border-l border-slate-300 dark:border-slate-800 w-28">
                            فی خرید واحد جزء
                          </th>
                        )}
                        <th className="py-2 px-2.5 border-l border-slate-300 dark:border-slate-800 w-28">
                          تخفیف ردیف
                        </th>
                        <th className="py-2 px-2.5 border-l border-slate-300 dark:border-slate-800 w-36">
                          مبلغ کل ردیف
                        </th>
                        <th className="py-2 px-2 w-12 text-center">حذف</th>
                      </tr>
                    </thead>
                    <tbody>
                      {invoiceLines.map((line, idx) => {
                        const prd = products.find((p) => p.id === line.productId);
                        return (
                          <tr
                            key={line.id}
                            className="border-b border-slate-200 dark:border-slate-800 hover:bg-emerald-50/30 dark:hover:bg-slate-800/40"
                          >
                            <td className="py-1.5 px-2 border-l border-slate-200 dark:border-slate-800 text-center font-bold">
                              {toFaDigits(idx + 1)}
                            </td>

                            <td className="py-1.5 px-2.5 border-l border-slate-200 dark:border-slate-800">
                              <button
                                type="button"
                                data-enter-nav="true"
                                onClick={() => openItemSelectorForRow(idx)}
                                className="w-full text-right font-bold hover:text-emerald-600 dark:hover:text-emerald-400 flex items-center justify-between gap-2 cursor-pointer"
                              >
                                <span>
                                  <span className="text-slate-400 ml-1.5">[{toFaDigits(line.productCode)}]</span>
                                  {line.productName}
                                </span>
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 shrink-0">
                                  تغییر کالا
                                </span>
                              </button>
                            </td>

                            <td className="py-1.5 px-2 border-l border-slate-200 dark:border-slate-800">
                              <select
                                value={line.unitUsed}
                                onChange={(e) =>
                                  handleLineUnitToggle(idx, e.target.value as 'base' | 'sub')
                                }
                                className={`w-full rounded border px-1.5 py-1 text-xs font-bold ${
                                  isDark
                                    ? 'bg-slate-950 border-slate-700 text-slate-100'
                                    : 'bg-slate-50 border-slate-300 text-slate-900'
                                }`}
                              >
                                <option value="sub">
                                  {prd?.subUnit || 'بسته'} (ضریب {toFaDigits(prd?.conversionRatio || 1)})
                                </option>
                                <option value="base">{prd?.baseUnit || 'عدد'} (واحد جزء)</option>
                              </select>
                            </td>

                            <td className="py-1.5 px-2 border-l border-slate-200 dark:border-slate-800">
                              <input
                                type="number"
                                min={1}
                                value={line.quantity}
                                onChange={(e) =>
                                  handleLineFieldChange(idx, 'quantity', Number(e.target.value))
                                }
                                className={`w-full text-center rounded border px-1.5 py-1 text-xs font-black ${
                                  isDark
                                    ? 'bg-slate-950 border-slate-700 text-slate-100'
                                    : 'bg-slate-50 border-slate-300 text-slate-900'
                                }`}
                              />
                            </td>

                            <td className="py-1.5 px-2 border-l border-slate-200 dark:border-slate-800 text-center font-semibold text-slate-500 dark:text-slate-400">
                              {toFaDigits(line.baseQuantityTotal)} {prd?.baseUnit || 'عدد'}
                            </td>

                            <td className="py-1.5 px-2 border-l border-slate-200 dark:border-slate-800">
                              <input
                                type="number"
                                step={500}
                                value={line.unitPrice}
                                onChange={(e) =>
                                  handleLineFieldChange(idx, 'unitPrice', Number(e.target.value))
                                }
                                className={`w-full rounded border px-2 py-1 text-xs font-black ${
                                  isDark
                                    ? 'bg-slate-950 border-slate-700 text-slate-100'
                                    : 'bg-slate-50 border-slate-300 text-slate-900'
                                }`}
                              />
                            </td>

                            <td className="py-1.5 px-2.5 border-l border-slate-200 dark:border-slate-800">
                              {line.lastSoldPriceToCustomer ? (
                                <div className="flex items-center justify-between gap-1">
                                  <span className="font-bold text-emerald-700 dark:text-emerald-400">
                                    {formatFaMoney(line.lastSoldPriceToCustomer)} (هر {prd?.baseUnit})
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const ratio = prd?.conversionRatio || 1;
                                      const targetPrice =
                                        line.unitUsed === 'sub'
                                          ? (line.lastSoldPriceToCustomer || 0) * ratio
                                          : line.lastSoldPriceToCustomer || 0;
                                      handleLineFieldChange(idx, 'unitPrice', targetPrice);
                                    }}
                                    className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-400 cursor-pointer"
                                  >
                                    اعمال
                                  </button>
                                </div>
                              ) : (
                                <span className="text-[11px] text-slate-400">سابقه فروش ندارد</span>
                              )}
                            </td>

                            {activeRole.canSeePurchasePrice && (
                              <td className="py-1.5 px-2.5 border-l border-slate-200 dark:border-slate-800 font-semibold text-slate-500">
                                {formatFaMoney(line.purchaseCostUnit)}
                              </td>
                            )}

                            <td className="py-1.5 px-2 border-l border-slate-200 dark:border-slate-800">
                              <input
                                type="number"
                                step={1000}
                                value={line.discountAmount}
                                onChange={(e) =>
                                  handleLineFieldChange(idx, 'discountAmount', Number(e.target.value))
                                }
                                className={`w-full rounded border px-2 py-1 text-xs font-bold ${
                                  isDark
                                    ? 'bg-slate-950 border-slate-700 text-slate-100'
                                    : 'bg-slate-50 border-slate-300 text-slate-900'
                                }`}
                              />
                            </td>

                            <td className="py-1.5 px-2.5 border-l border-slate-200 dark:border-slate-800 font-black text-emerald-800 dark:text-emerald-300">
                              {formatFaMoney(line.totalRowAmount)}
                            </td>

                            <td className="py-1.5 px-2 text-center">
                              <button
                                type="button"
                                onClick={() => handleRemoveInvoiceLine(idx)}
                                className="p-1 text-rose-600 hover:bg-rose-100 dark:hover:bg-rose-950 rounded cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* کادر تسویه حساب به سبک هلو (Holoo-Style Settlement Box) + محاسبه‌گر باقیه پول */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
                {/* ستون راست: فرم دریافت نقد، باقیه پول، کارتخوان، چک و توضیحات */}
                <div
                  className={`lg:col-span-8 p-3 rounded border space-y-3 ${
                    isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
                    <span className="text-xs font-black flex items-center gap-1.5">
                      <Calculator className="w-4 h-4 text-emerald-600" />
                      کادر تسویه ترکیبی پیشخوان (نقد، کارتخوان، چک و نسیه)
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setCashReceivedInput(invoiceTotals.grandTotal);
                          setCashTenderedByCustomer(invoiceTotals.grandTotal);
                          setPosReceivedInput(0);
                          setChequeReceivedInput(0);
                        }}
                        className="px-2 py-1 rounded bg-slate-200 dark:bg-slate-800 text-[11px] font-bold cursor-pointer"
                      >
                        تسویه کامل نقدی
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setPosReceivedInput(invoiceTotals.grandTotal);
                          setCashReceivedInput(0);
                          setChequeReceivedInput(0);
                        }}
                        className="px-2 py-1 rounded bg-slate-200 dark:bg-slate-800 text-[11px] font-bold cursor-pointer"
                      >
                        تسویه کامل کارتخوان
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setCashReceivedInput(0);
                          setPosReceivedInput(0);
                          setChequeReceivedInput(0);
                        }}
                        className="px-2 py-1 rounded bg-amber-100 dark:bg-amber-950/80 text-amber-900 dark:text-amber-200 text-[11px] font-bold cursor-pointer"
                      >
                        انتقال کل مبلغ به نسیه
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {/* ۱. دریافت نقد و محاسبه‌گر باقیه پول */}
                    <div className="p-2.5 rounded border border-slate-300 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/50 space-y-2">
                      <div className="text-xs font-black text-emerald-700 dark:text-emerald-400">
                        ۱. دریافت نقد و باقیه پول
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold mb-0.5">
                          مبلغ نقد کسر شده بابت فاکتور:
                        </label>
                        <input
                          type="number"
                          step={10000}
                          value={cashReceivedInput}
                          onChange={(e) => setCashReceivedInput(Number(e.target.value))}
                          className={`w-full rounded border px-2 py-1 text-xs font-black ${
                            isDark
                              ? 'bg-slate-900 border-slate-700 text-slate-100'
                              : 'bg-white border-slate-300 text-slate-900'
                          }`}
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold mb-0.5">
                          وجه پرداختی دست مشتری:
                        </label>
                        <input
                          type="number"
                          step={10000}
                          value={cashTenderedByCustomer}
                          onChange={(e) => setCashTenderedByCustomer(Number(e.target.value))}
                          className={`w-full rounded border px-2 py-1 text-xs font-black ${
                            isDark
                              ? 'bg-slate-900 border-slate-700 text-slate-100'
                              : 'bg-white border-slate-300 text-slate-900'
                          }`}
                        />
                      </div>
                      <div className="pt-1 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs">
                        <span className="font-bold">باقیه پول مشتری:</span>
                        <span className="font-black text-emerald-700 dark:text-emerald-400">
                          {formatFaMoney(invoiceTotals.changeReturned)} {storeConfig.currencyLabel}
                        </span>
                      </div>
                    </div>

                    {/* ۲. دریافت کارتخوان (POS) */}
                    <div className="p-2.5 rounded border border-slate-300 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/50 space-y-2">
                      <div className="text-xs font-black text-sky-700 dark:text-sky-400">
                        ۲. دریافت کارتخوان (پوز بانکی)
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold mb-0.5">
                          مبلغ کشیده‌شده در کارتخوان:
                        </label>
                        <input
                          type="number"
                          step={10000}
                          value={posReceivedInput}
                          onChange={(e) => setPosReceivedInput(Number(e.target.value))}
                          className={`w-full rounded border px-2 py-1 text-xs font-black ${
                            isDark
                              ? 'bg-slate-900 border-slate-700 text-slate-100'
                              : 'bg-white border-slate-300 text-slate-900'
                          }`}
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold mb-0.5">
                          شماره پیگیری رسید کارتخوان:
                        </label>
                        <input
                          type="text"
                          value={posReferenceInput}
                          onChange={(e) => setPosReferenceInput(toFaDigits(e.target.value))}
                          placeholder="مثال: ۷۴۱۲۵۸"
                          className={`w-full rounded border px-2 py-1 text-xs font-bold ${
                            isDark
                              ? 'bg-slate-900 border-slate-700 text-slate-100'
                              : 'bg-white border-slate-300 text-slate-900'
                          }`}
                        />
                      </div>
                    </div>

                    {/* ۳. دریافت چک صیادی */}
                    <div className="p-2.5 rounded border border-slate-300 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/50 space-y-2">
                      <div className="text-xs font-black text-amber-700 dark:text-amber-400">
                        ۳. دریافت چک صیادی
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold mb-0.5">مبلغ چک دریافتی:</label>
                        <input
                          type="number"
                          step={50000}
                          value={chequeReceivedInput}
                          onChange={(e) => setChequeReceivedInput(Number(e.target.value))}
                          className={`w-full rounded border px-2 py-1 text-xs font-black ${
                            isDark
                              ? 'bg-slate-900 border-slate-700 text-slate-100'
                              : 'bg-white border-slate-300 text-slate-900'
                          }`}
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold mb-0.5">
                          شناسه صیادی / سریال چک:
                        </label>
                        <input
                          type="text"
                          value={chequeReferenceInput}
                          onChange={(e) => setChequeReferenceInput(toFaDigits(e.target.value))}
                          placeholder="شناسه ۱۶ رقمی صیاد"
                          className={`w-full rounded border px-2 py-1 text-xs font-bold ${
                            isDark
                              ? 'bg-slate-900 border-slate-700 text-slate-100'
                              : 'bg-white border-slate-300 text-slate-900'
                          }`}
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold mb-1">
                      توضیحات فاکتور (نحوه ارسال باربری، شماره بیجک یا شرایط تسویه):
                    </label>
                    <input
                      type="text"
                      value={invoiceNotes}
                      onChange={(e) => setInvoiceNotes(e.target.value)}
                      placeholder="توضیحات تکمیلی سند..."
                      className={`w-full rounded border px-2.5 py-1.5 text-xs font-bold ${
                        isDark
                          ? 'bg-slate-950 border-slate-700 text-slate-100'
                          : 'bg-slate-50 border-slate-300 text-slate-900'
                      }`}
                    />
                  </div>
                </div>

                {/* ستون چپ: خلاصه ارقام نهایی، مانده نسیه و دکمه ثبت قطعی و چاپ */}
                <div
                  className={`lg:col-span-4 p-3 rounded border flex flex-col justify-between space-y-2.5 ${
                    isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-300'
                  }`}
                >
                  <div className="space-y-1.5 text-xs">
                    <div className="flex items-center justify-between py-1 border-b border-slate-200 dark:border-slate-800">
                      <span className="text-slate-500 font-bold">جمع ناخالص اقلام:</span>
                      <span className="font-black">
                        {formatFaMoney(invoiceTotals.subtotal)} {storeConfig.currencyLabel}
                      </span>
                    </div>
                    <div className="flex items-center justify-between py-1 border-b border-slate-200 dark:border-slate-800">
                      <span className="text-slate-500 font-bold">جمع تخفیفات ردیف‌ها:</span>
                      <span className="font-bold text-rose-600">
                        {formatFaMoney(invoiceTotals.totalDiscount)} {storeConfig.currencyLabel}
                      </span>
                    </div>
                    {activeRole.canSeePurchasePrice && (
                      <div className="flex items-center justify-between py-1 border-b border-slate-200 dark:border-slate-800">
                        <span className="text-slate-500 font-bold">بهای تمام‌شده کل فاکتور:</span>
                        <span className="font-bold text-slate-500">
                          {formatFaMoney(invoiceTotals.totalCostOfGoods)} {storeConfig.currencyLabel}
                        </span>
                      </div>
                    )}
                    <div className="flex items-center justify-between py-1.5 px-2 rounded bg-emerald-950/10 dark:bg-emerald-950/60 border border-emerald-500/40">
                      <span className="font-black text-sm">مبلغ قابل پرداخت فاکتور:</span>
                      <span className="font-black text-base text-emerald-700 dark:text-emerald-400">
                        {formatFaMoney(invoiceTotals.grandTotal)} {storeConfig.currencyLabel}
                      </span>
                    </div>
                    <div className="flex items-center justify-between py-1.5 px-2 rounded bg-amber-50 dark:bg-amber-950/40 border border-amber-400 dark:border-amber-700">
                      <span className="font-bold text-amber-900 dark:text-amber-200">
                        مانده نسیه این فاکتور (به حساب شخص):
                      </span>
                      <span className="font-black text-sm text-amber-900 dark:text-amber-300">
                        {formatFaMoney(invoiceTotals.creditNesiyehAmount)} {storeConfig.currencyLabel}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => attemptFinalizeInvoice(false)}
                      className="col-span-2 py-2.5 px-4 rounded bg-emerald-700 hover:bg-emerald-600 text-white font-black text-xs flex items-center justify-center gap-2 shadow-sm cursor-pointer"
                    >
                      <Save className="w-4 h-4" />
                      <span>ثبت قطعی سند و کنترل سقف اعتبار</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        const previewDoc: TradeDocument = {
                          id: 'preview-temp',
                          docNumber: 'پیش‌نمایش',
                          docType: activeInvoiceTab,
                          date: invoiceDate,
                          counterpartyId: selectedCounterparty.id,
                          counterpartyName: selectedCounterparty.fullName,
                          warehouse: selectedWarehouse,
                          items: invoiceLines,
                          subtotal: invoiceTotals.subtotal,
                          totalDiscount: invoiceTotals.totalDiscount,
                          grandTotal: invoiceTotals.grandTotal,
                          totalCostOfGoods: invoiceTotals.totalCostOfGoods,
                          previousCustomerBalance: selectedCounterparty.openBookBalance,
                          cashReceived: Number(cashReceivedInput) || 0,
                          cashTenderedByCustomer: Number(cashTenderedByCustomer) || 0,
                          changeReturned: invoiceTotals.changeReturned,
                          posReceived: Number(posReceivedInput) || 0,
                          posReferenceNumber: posReferenceInput,
                          chequeReceived: Number(chequeReceivedInput) || 0,
                          chequeReferenceNumber: chequeReferenceInput,
                          creditNesiyehAmount: invoiceTotals.creditNesiyehAmount,
                          notes: invoiceNotes,
                          createdByRole: activeRole.title,
                          exceededCreditApprovedByAdmin: false,
                        };
                        setDocumentToPrint(previewDoc);
                        setIsPrintPreviewModalOpen(true);
                      }}
                      className="py-1.5 px-3 rounded border border-slate-400 dark:border-slate-700 font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      <span>پیش‌نمایش چاپ</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setIsPrintConfigModalOpen(true)}
                      className="py-1.5 px-3 rounded border border-slate-400 dark:border-slate-700 font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Sliders className="w-3.5 h-3.5" />
                      <span>طراحی قالب چاپ</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ====================================================================
              ۲. میز کار و خلاصه وضعیت بازار (Dashboard + Upcoming Cheques)
             ==================================================================== */}
          {activeScreen === 'dashboard' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div
                  className={`p-3.5 rounded border ${
                    isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-300'
                  }`}
                >
                  <div className="text-xs text-slate-500 font-bold">جمع کل مطالبات دفتری بازار:</div>
                  <div className="text-base font-black text-emerald-700 dark:text-emerald-400 mt-1">
                    {formatFaMoney(
                      counterparties
                        .filter((c) => c.openBookBalance > 0)
                        .reduce((s, c) => s + c.openBookBalance, 0)
                    )}{' '}
                    {storeConfig.currencyLabel}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-1">
                    تعداد بدهکاران فعال: {toFaDigits(counterparties.filter((c) => c.openBookBalance > 0).length)} شخص
                  </div>
                </div>

                <div
                  className={`p-3.5 rounded border ${
                    isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-300'
                  }`}
                >
                  <div className="text-xs text-slate-500 font-bold">جمع بدهی ما به بنکداران و کارخانجات:</div>
                  <div className="text-base font-black text-rose-600 mt-1">
                    {formatFaMoney(
                      Math.abs(
                        counterparties
                          .filter((c) => c.openBookBalance < 0)
                          .reduce((s, c) => s + c.openBookBalance, 0)
                      )
                    )}{' '}
                    {storeConfig.currencyLabel}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-1">
                    بستانکاران تجاری ثبت‌شده
                  </div>
                </div>

                <div
                  className={`p-3.5 rounded border ${
                    isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-300'
                  }`}
                >
                  <div className="text-xs text-slate-500 font-bold">چک‌های دریافتی در جریان وصول:</div>
                  <div className="text-base font-black text-amber-600 mt-1">
                    {formatFaMoney(
                      cheques
                        .filter((c) => c.direction === 'incoming' && c.status === 'در جریان وصول')
                        .reduce((s, c) => s + c.amount, 0)
                    )}{' '}
                    {storeConfig.currencyLabel}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-1">
                    تعداد چک‌های نزد صندوق: {toFaDigits(cheques.filter((c) => c.status === 'در جریان وصول').length)} فقره
                  </div>
                </div>

                <div
                  className={`p-3.5 rounded border ${
                    isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-300'
                  }`}
                >
                  <div className="text-xs text-slate-500 font-bold">جمع هزینه‌های عملیاتی دوره:</div>
                  <div className="text-base font-black text-slate-800 dark:text-slate-200 mt-1">
                    {formatFaMoney(expenses.reduce((s, e) => s + e.amount, 0))}{' '}
                    {storeConfig.currencyLabel}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-1">
                    کرایه، وانت‌بار، نایلون و دستمزد شاگرد
                  </div>
                </div>
              </div>

              {/* فهرست چک‌های نزدیک به سررسید با عملیات سریع */}
              <div
                className={`rounded border overflow-hidden ${
                  isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-300'
                }`}
              >
                <div className="px-3.5 py-2.5 border-b border-slate-300 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-950/60">
                  <span className="text-xs font-black flex items-center gap-1.5">
                    <CreditCard className="w-4 h-4 text-amber-600" />
                    فهرست چک‌های نزدیک به سررسید و در جریان (عملیات سریع خزانه)
                  </span>
                  <button
                    type="button"
                    onClick={() => setActiveScreen('treasury_cheques')}
                    className="text-xs font-bold text-emerald-700 dark:text-emerald-400 cursor-pointer"
                  >
                    مدیریت کامل چک‌ها و خرج چک ←
                  </button>
                </div>
                <table className="w-full text-right border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-300 dark:border-slate-800 bg-slate-100 dark:bg-slate-950">
                      <th className="py-2 px-2.5 border-l border-slate-300 dark:border-slate-800">شناسه صیاد</th>
                      <th className="py-2 px-2.5 border-l border-slate-300 dark:border-slate-800">صاحب چک / طرف حساب</th>
                      <th className="py-2 px-2.5 border-l border-slate-300 dark:border-slate-800">بانک و شعبه</th>
                      <th className="py-2 px-2.5 border-l border-slate-300 dark:border-slate-800">تاریخ سررسید</th>
                      <th className="py-2 px-2.5 border-l border-slate-300 dark:border-slate-800">مبلغ چک</th>
                      <th className="py-2 px-2.5 border-l border-slate-300 dark:border-slate-800">وضعیت فعلی</th>
                      <th className="py-2 px-2.5">عملیات سریع</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cheques.map((chq) => (
                      <tr key={chq.id} className="border-b border-slate-200 dark:border-slate-800">
                        <td className="py-2 px-2.5 border-l border-slate-200 dark:border-slate-800 font-bold">
                          {toFaDigits(chq.sayadiNumber)}
                        </td>
                        <td className="py-2 px-2.5 border-l border-slate-200 dark:border-slate-800 font-bold">
                          {chq.drawerName}
                        </td>
                        <td className="py-2 px-2.5 border-l border-slate-200 dark:border-slate-800">
                          {chq.bankName}
                        </td>
                        <td className="py-2 px-2.5 border-l border-slate-200 dark:border-slate-800 font-black text-amber-700 dark:text-amber-400">
                          {toFaDigits(chq.dueDate)}
                        </td>
                        <td className="py-2 px-2.5 border-l border-slate-200 dark:border-slate-800 font-black">
                          {formatFaMoney(chq.amount)} {storeConfig.currencyLabel}
                        </td>
                        <td className="py-2 px-2.5 border-l border-slate-200 dark:border-slate-800 font-bold">
                          {chq.status}
                          {chq.endorsedToName && (
                            <span className="block text-[10px] text-emerald-600">
                              خرج‌شده به: {chq.endorsedToName}
                            </span>
                          )}
                        </td>
                        <td className="py-2 px-2.5 flex items-center gap-1.5">
                          {chq.status === 'در جریان وصول' && (
                            <>
                              <button
                                type="button"
                                onClick={() => handleUpdateChequeStatus(chq.id, 'وصول‌شده')}
                                className="px-2 py-1 rounded bg-emerald-700 text-white text-[11px] font-bold cursor-pointer"
                              >
                                ثبت وصول
                              </button>
                              {chq.direction === 'incoming' && (
                                <button
                                  type="button"
                                  onClick={() => setEndorseModalChequeId(chq.id)}
                                  className="px-2 py-1 rounded bg-amber-600 text-white text-[11px] font-bold cursor-pointer"
                                >
                                  خرج چک به بنکدار
                                </button>
                              )}
                            </>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          {/* ====================================================================
              ۳. انبارداری دو واحدی و قفسه‌بندی (Inventory & Dual-Unit Stock)
             ==================================================================== */}
          {activeScreen === 'inventory_warehouse' && (
            <div className="space-y-3">
              <div
                className={`p-3 rounded border flex flex-wrap items-center justify-between gap-2 ${
                  isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-300'
                }`}
              >
                <div>
                  <h2 className="text-sm font-black">
                    موجودی دو واحدی انبارها (جین / عدد، رول / متر، طمار / متر)
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    نمایش تفکیکی موجودی انبار مغازه، انبار مرکزی بازار و انبار مرجوعی و ضایعات
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsNewProductModalOpen(true)}
                  className="px-3 py-1.5 rounded bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>تعریف کالای جدید خرازی</span>
                </button>
              </div>

              <div
                className={`rounded border overflow-x-auto ${
                  isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-300'
                }`}
              >
                <table className="w-full text-right border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-300 dark:border-slate-800 bg-slate-100 dark:bg-slate-950">
                      <th className="py-2 px-2.5 border-l border-slate-300 dark:border-slate-800">کد کالا</th>
                      <th className="py-2 px-2.5 border-l border-slate-300 dark:border-slate-800">شرح کالای خرازی</th>
                      <th className="py-2 px-2.5 border-l border-slate-300 dark:border-slate-800">گروه کالایی</th>
                      <th className="py-2 px-2.5 border-l border-slate-300 dark:border-slate-800">ضریب تبدیل واحد</th>
                      <th className="py-2 px-2.5 border-l border-slate-300 dark:border-slate-800">موجودی انبار مغازه</th>
                      <th className="py-2 px-2.5 border-l border-slate-300 dark:border-slate-800">موجودی انبار مرکزی بازار</th>
                      <th className="py-2 px-2.5 border-l border-slate-300 dark:border-slate-800">ضایعات</th>
                      {activeRole.canSeePurchasePrice && (
                        <th className="py-2 px-2.5 border-l border-slate-300 dark:border-slate-800">فی خرید جزء</th>
                      )}
                      <th className="py-2 px-2.5 border-l border-slate-300 dark:border-slate-800">فی عمده (همکار)</th>
                      <th className="py-2 px-2.5">محل قفسه</th>
                    </tr>
                  </thead>
                  <tbody>
                    {products.map((p) => (
                      <tr key={p.id} className="border-b border-slate-200 dark:border-slate-800">
                        <td className="py-2 px-2.5 border-l border-slate-200 dark:border-slate-800 font-bold">
                          {toFaDigits(p.code)}
                        </td>
                        <td className="py-2 px-2.5 border-l border-slate-200 dark:border-slate-800 font-black">
                          {p.name}
                        </td>
                        <td className="py-2 px-2.5 border-l border-slate-200 dark:border-slate-800">
                          {p.categoryTitle}
                        </td>
                        <td className="py-2 px-2.5 border-l border-slate-200 dark:border-slate-800 font-bold text-slate-500">
                          هر {p.subUnit} = {toFaDigits(p.conversionRatio)} {p.baseUnit}
                        </td>
                        <td className="py-2 px-2.5 border-l border-slate-200 dark:border-slate-800 font-bold text-emerald-700 dark:text-emerald-400">
                          {formatDualUnitStock(p.stockShop, p.baseUnit, p.subUnit, p.conversionRatio)}
                        </td>
                        <td className="py-2 px-2.5 border-l border-slate-200 dark:border-slate-800 font-bold">
                          {formatDualUnitStock(p.stockCentral, p.baseUnit, p.subUnit, p.conversionRatio)}
                        </td>
                        <td className="py-2 px-2.5 border-l border-slate-200 dark:border-slate-800 font-bold text-rose-600">
                          {toFaDigits(p.stockDamaged)} {p.baseUnit}
                        </td>
                        {activeRole.canSeePurchasePrice && (
                          <td className="py-2 px-2.5 border-l border-slate-200 dark:border-slate-800 font-bold">
                            {formatFaMoney(p.purchasePrice)}
                          </td>
                        )}
                        <td className="py-2 px-2.5 border-l border-slate-200 dark:border-slate-800 font-black">
                          {formatFaMoney(p.wholesalePrice)}
                        </td>
                        <td className="py-2 px-2.5 text-slate-500 font-semibold">{p.shelfLocation}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ====================================================================
              ۴. اشخاص، مشتریان و مدیریت سقف اعتبار دوگانه (Counterparties & Credit Ceilings)
             ==================================================================== */}
          {activeScreen === 'counterparties_credit' && (
            <div className="space-y-3">
              <div
                className={`p-3 rounded border ${
                  isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-300'
                }`}
              >
                <h2 className="text-sm font-black">
                  مدیریت اشخاص، مشتریان کارگاهی، بنکداران و سقف اعتبار هوشمند
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  کنترل همزمان «سقف بدهی نسیه دفتری» و «سقف چک‌های در جریان وصول» برای هر طرف حساب
                </p>
              </div>

              <div
                className={`rounded border overflow-x-auto ${
                  isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-300'
                }`}
              >
                <table className="w-full text-right border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-300 dark:border-slate-800 bg-slate-100 dark:bg-slate-950">
                      <th className="py-2 px-2.5 border-l border-slate-300 dark:border-slate-800">کد شخص</th>
                      <th className="py-2 px-2.5 border-l border-slate-300 dark:border-slate-800">نام کامل طرف حساب</th>
                      <th className="py-2 px-2.5 border-l border-slate-300 dark:border-slate-800">تلفن و شهر</th>
                      <th className="py-2 px-2.5 border-l border-slate-300 dark:border-slate-800">مانده حساب دفتری فعلی</th>
                      <th className="py-2 px-2.5 border-l border-slate-300 dark:border-slate-800">سقف مجاز نسیه دفتری</th>
                      <th className="py-2 px-2.5 border-l border-slate-300 dark:border-slate-800">چک‌های در جریان وصول</th>
                      <th className="py-2 px-2.5">سقف مجاز چک در جریان</th>
                    </tr>
                  </thead>
                  <tbody>
                    {counterparties.map((cp) => (
                      <tr key={cp.id} className="border-b border-slate-200 dark:border-slate-800">
                        <td className="py-2 px-2.5 border-l border-slate-200 dark:border-slate-800 font-bold">
                          {toFaDigits(cp.code)}
                        </td>
                        <td className="py-2 px-2.5 border-l border-slate-200 dark:border-slate-800 font-black">
                          {cp.fullName}{' '}
                          <span className="text-[11px] font-semibold text-slate-400">
                            ({cp.titlePrefix})
                          </span>
                        </td>
                        <td className="py-2 px-2.5 border-l border-slate-200 dark:border-slate-800">
                          {toFaDigits(cp.phone)} - {cp.city}
                        </td>
                        <td className="py-2 px-2.5 border-l border-slate-200 dark:border-slate-800 font-black">
                          {formatFaMoney(Math.abs(cp.openBookBalance))} {storeConfig.currencyLabel}{' '}
                          <span
                            className={
                              cp.openBookBalance > 0
                                ? 'text-amber-600'
                                : cp.openBookBalance < 0
                                ? 'text-emerald-600'
                                : 'text-slate-400'
                            }
                          >
                            ({cp.openBookBalance > 0 ? 'بد' : cp.openBookBalance < 0 ? 'بس' : 'تسویه'})
                          </span>
                        </td>
                        <td className="py-2 px-2.5 border-l border-slate-200 dark:border-slate-800">
                          <input
                            type="number"
                            step={1000000}
                            disabled={!activeRole.canApproveCreditCeiling}
                            value={cp.creditLimitBook}
                            onChange={(e) => {
                              const val = Number(e.target.value) || 0;
                              setCounterparties((prev) =>
                                prev.map((item) =>
                                  item.id === cp.id ? { ...item, creditLimitBook: val } : item
                                )
                              );
                            }}
                            className={`w-36 rounded border px-2 py-1 text-xs font-black ${
                              isDark
                                ? 'bg-slate-950 border-slate-700 text-slate-100'
                                : 'bg-slate-50 border-slate-300 text-slate-900'
                            }`}
                          />
                        </td>
                        <td className="py-2 px-2.5 border-l border-slate-200 dark:border-slate-800 font-black text-amber-700 dark:text-amber-400">
                          {formatFaMoney(cp.unclearedChequesTotal)} {storeConfig.currencyLabel}
                        </td>
                        <td className="py-2 px-2.5">
                          <input
                            type="number"
                            step={1000000}
                            disabled={!activeRole.canApproveCreditCeiling}
                            value={cp.creditLimitCheques}
                            onChange={(e) => {
                              const val = Number(e.target.value) || 0;
                              setCounterparties((prev) =>
                                prev.map((item) =>
                                  item.id === cp.id ? { ...item, creditLimitCheques: val } : item
                                )
                              );
                            }}
                            className={`w-36 rounded border px-2 py-1 text-xs font-black ${
                              isDark
                                ? 'bg-slate-950 border-slate-700 text-slate-100'
                                : 'bg-slate-50 border-slate-300 text-slate-900'
                            }`}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ====================================================================
              ۵. خزانه‌داری، عملیات چک صیادی و خرج چک (Cheques & Endorsement)
             ==================================================================== */}
          {activeScreen === 'treasury_cheques' && (
            <div className="space-y-4">
              {/* فرم ثبت چک جدید */}
              <form
                onSubmit={handleCreateNewCheque}
                className={`p-3.5 rounded border space-y-3 ${
                  isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-300'
                }`}
              >
                <div className="text-xs font-black border-b border-slate-200 dark:border-slate-800 pb-2">
                  ثبت چک صیادی جدید (دریافتی از مشتری یا پرداختی به بنکدار)
                </div>
                <div className="grid grid-cols-1 md:grid-cols-6 gap-2.5 items-end">
                  <div>
                    <label className="block text-[11px] font-bold mb-1">نوع چک:</label>
                    <select
                      value={newChequeForm.direction}
                      onChange={(e) =>
                        setNewChequeForm((p) => ({
                          ...p,
                          direction: e.target.value as 'incoming' | 'outgoing',
                        }))
                      }
                      className={`w-full rounded border px-2 py-1.5 text-xs font-bold ${
                        isDark
                          ? 'bg-slate-950 border-slate-700 text-slate-100'
                          : 'bg-slate-50 border-slate-300 text-slate-900'
                      }`}
                    >
                      <option value="incoming">چک دریافتی از مشتری</option>
                      <option value="outgoing">چک پرداختی به تأمین‌کننده</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold mb-1">طرف حساب:</label>
                    <select
                      value={newChequeForm.counterpartyId}
                      onChange={(e) =>
                        setNewChequeForm((p) => ({ ...p, counterpartyId: e.target.value }))
                      }
                      className={`w-full rounded border px-2 py-1.5 text-xs font-bold ${
                        isDark
                          ? 'bg-slate-950 border-slate-700 text-slate-100'
                          : 'bg-slate-50 border-slate-300 text-slate-900'
                      }`}
                    >
                      {counterparties.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.fullName}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold mb-1">شناسه ۱۶ رقمی صیاد:</label>
                    <input
                      type="text"
                      value={newChequeForm.sayadiNumber}
                      onChange={(e) =>
                        setNewChequeForm((p) => ({
                          ...p,
                          sayadiNumber: toFaDigits(e.target.value),
                        }))
                      }
                      className={`w-full rounded border px-2 py-1.5 text-xs font-bold ${
                        isDark
                          ? 'bg-slate-950 border-slate-700 text-slate-100'
                          : 'bg-slate-50 border-slate-300 text-slate-900'
                      }`}
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold mb-1">نام بانک و شعبه:</label>
                    <input
                      type="text"
                      value={newChequeForm.bankName}
                      onChange={(e) =>
                        setNewChequeForm((p) => ({ ...p, bankName: e.target.value }))
                      }
                      className={`w-full rounded border px-2 py-1.5 text-xs font-bold ${
                        isDark
                          ? 'bg-slate-950 border-slate-700 text-slate-100'
                          : 'bg-slate-50 border-slate-300 text-slate-900'
                      }`}
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold mb-1">
                      مبلغ چک ({storeConfig.currencyLabel}):
                    </label>
                    <input
                      type="number"
                      step={100000}
                      value={newChequeForm.amount}
                      onChange={(e) =>
                        setNewChequeForm((p) => ({ ...p, amount: Number(e.target.value) }))
                      }
                      className={`w-full rounded border px-2 py-1.5 text-xs font-black ${
                        isDark
                          ? 'bg-slate-950 border-slate-700 text-slate-100'
                          : 'bg-slate-50 border-slate-300 text-slate-900'
                      }`}
                    />
                  </div>

                  <div className="flex items-end gap-2">
                    <div className="flex-1">
                      <label className="block text-[11px] font-bold mb-1">تاریخ سررسید:</label>
                      <input
                        type="text"
                        value={newChequeForm.dueDate}
                        onChange={(e) =>
                          setNewChequeForm((p) => ({ ...p, dueDate: toFaDigits(e.target.value) }))
                        }
                        className={`w-full rounded border px-2 py-1.5 text-xs font-bold ${
                          isDark
                            ? 'bg-slate-950 border-slate-700 text-slate-100'
                            : 'bg-slate-50 border-slate-300 text-slate-900'
                        }`}
                      />
                    </div>
                    <button
                      type="submit"
                      className="px-3 py-1.5 rounded bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-bold cursor-pointer"
                    >
                      ثبت چک
                    </button>
                  </div>
                </div>
              </form>

              {/* جدول چک‌ها و عملیات خرج چک */}
              <div
                className={`rounded border overflow-x-auto ${
                  isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-300'
                }`}
              >
                <table className="w-full text-right border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-300 dark:border-slate-800 bg-slate-100 dark:bg-slate-950">
                      <th className="py-2 px-2.5 border-l border-slate-300 dark:border-slate-800">نوع چک</th>
                      <th className="py-2 px-2.5 border-l border-slate-300 dark:border-slate-800">شناسه صیاد / سریال</th>
                      <th className="py-2 px-2.5 border-l border-slate-300 dark:border-slate-800">صادرکننده / طرف حساب</th>
                      <th className="py-2 px-2.5 border-l border-slate-300 dark:border-slate-800">بانک</th>
                      <th className="py-2 px-2.5 border-l border-slate-300 dark:border-slate-800">سررسید</th>
                      <th className="py-2 px-2.5 border-l border-slate-300 dark:border-slate-800">مبلغ</th>
                      <th className="py-2 px-2.5 border-l border-slate-300 dark:border-slate-800">وضعیت و گردش خرج چک</th>
                      <th className="py-2 px-2.5">عملیات خزانه‌داری</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cheques.map((chq) => (
                      <tr key={chq.id} className="border-b border-slate-200 dark:border-slate-800">
                        <td className="py-2 px-2.5 border-l border-slate-200 dark:border-slate-800 font-bold">
                          {chq.direction === 'incoming' ? 'دریافتی (مشتری)' : 'پرداختی (شخصی)'}
                        </td>
                        <td className="py-2 px-2.5 border-l border-slate-200 dark:border-slate-800 font-bold">
                          {toFaDigits(chq.sayadiNumber)} ({toFaDigits(chq.serialNumber)})
                        </td>
                        <td className="py-2 px-2.5 border-l border-slate-200 dark:border-slate-800 font-bold">
                          {chq.drawerName}
                        </td>
                        <td className="py-2 px-2.5 border-l border-slate-200 dark:border-slate-800">
                          {chq.bankName}
                        </td>
                        <td className="py-2 px-2.5 border-l border-slate-200 dark:border-slate-800 font-black">
                          {toFaDigits(chq.dueDate)}
                        </td>
                        <td className="py-2 px-2.5 border-l border-slate-200 dark:border-slate-800 font-black">
                          {formatFaMoney(chq.amount)} {storeConfig.currencyLabel}
                        </td>
                        <td className="py-2 px-2.5 border-l border-slate-200 dark:border-slate-800 font-bold">
                          {chq.status}
                          {chq.endorsedToName && (
                            <span className="block text-[11px] text-emerald-600">
                              واگذارشده به: {chq.endorsedToName}
                            </span>
                          )}
                        </td>
                        <td className="py-2 px-2.5 flex flex-wrap items-center gap-1.5">
                          {chq.status === 'در جریان وصول' && (
                            <>
                              <button
                                type="button"
                                onClick={() => handleUpdateChequeStatus(chq.id, 'وصول‌شده')}
                                className="px-2 py-1 rounded bg-emerald-700 text-white text-[11px] font-bold cursor-pointer"
                              >
                                ثبت وصول بانکی
                              </button>
                              {chq.direction === 'incoming' && (
                                <button
                                  type="button"
                                  onClick={() => setEndorseModalChequeId(chq.id)}
                                  className="px-2 py-1 rounded bg-amber-600 text-white text-[11px] font-bold cursor-pointer"
                                >
                                  خرج چک (انتقال به بنکدار)
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => handleUpdateChequeStatus(chq.id, 'برگشتی')}
                                className="px-2 py-1 rounded bg-rose-700 text-white text-[11px] font-bold cursor-pointer"
                              >
                                ثبت برگشتی
                              </button>
                            </>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ====================================================================
              ۶. تفکیک کامل هزینه‌های مغازه (Expense Accounting Breakdown)
             ==================================================================== */}
          {activeScreen === 'expenses_breakdown' && (
            <div className="space-y-4">
              <form
                onSubmit={handleCreateExpense}
                className={`p-3.5 rounded border space-y-3 ${
                  isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-300'
                }`}
              >
                <div className="text-xs font-black border-b border-slate-200 dark:border-slate-800 pb-2">
                  ثبت سند هزینه عملیاتی مغازه (با کسر مستقیم از صندوق نقد یا حساب بانک)
                </div>
                <div className="grid grid-cols-1 md:grid-cols-6 gap-2.5 items-end">
                  <div>
                    <label className="block text-[11px] font-bold mb-1">سرفصل هزینه بازار:</label>
                    <select
                      value={newExpenseForm.category}
                      onChange={(e) =>
                        setNewExpenseForm((p) => ({
                          ...p,
                          category: e.target.value as BazaarExpenseCategory,
                        }))
                      }
                      className={`w-full rounded border px-2 py-1.5 text-xs font-bold ${
                        isDark
                          ? 'bg-slate-950 border-slate-700 text-slate-100'
                          : 'bg-slate-50 border-slate-300 text-slate-900'
                      }`}
                    >
                      {EXPENSE_CATEGORIES_LIST.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold mb-1">
                      مبلغ هزینه ({storeConfig.currencyLabel}):
                    </label>
                    <input
                      type="number"
                      step={50000}
                      value={newExpenseForm.amount}
                      onChange={(e) =>
                        setNewExpenseForm((p) => ({ ...p, amount: Number(e.target.value) }))
                      }
                      className={`w-full rounded border px-2 py-1.5 text-xs font-black ${
                        isDark
                          ? 'bg-slate-950 border-slate-700 text-slate-100'
                          : 'bg-slate-50 border-slate-300 text-slate-900'
                      }`}
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold mb-1">محل پرداخت وجه:</label>
                    <select
                      value={newExpenseForm.paymentSource}
                      onChange={(e) =>
                        setNewExpenseForm((p) => ({
                          ...p,
                          paymentSource: e.target.value as PaymentSourceType,
                          bankOrCashTitle:
                            e.target.value === 'صندوق'
                              ? 'صندوق نقد پیشخوان'
                              : 'حساب جاری بانک ملت بازار',
                        }))
                      }
                      className={`w-full rounded border px-2 py-1.5 text-xs font-bold ${
                        isDark
                          ? 'bg-slate-950 border-slate-700 text-slate-100'
                          : 'bg-slate-50 border-slate-300 text-slate-900'
                      }`}
                    >
                      <option value="صندوق">صندوق نقد مغازه</option>
                      <option value="بانک">حساب بانکی / کارتخوان</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold mb-1">دریافت‌کننده وجه:</label>
                    <input
                      type="text"
                      value={newExpenseForm.recipientName}
                      onChange={(e) =>
                        setNewExpenseForm((p) => ({ ...p, recipientName: e.target.value }))
                      }
                      className={`w-full rounded border px-2 py-1.5 text-xs font-bold ${
                        isDark
                          ? 'bg-slate-950 border-slate-700 text-slate-100'
                          : 'bg-slate-50 border-slate-300 text-slate-900'
                      }`}
                    />
                  </div>

                  <div className="md:col-span-2 flex items-end gap-2">
                    <div className="flex-1">
                      <label className="block text-[11px] font-bold mb-1">شرح کامل هزینه:</label>
                      <input
                        type="text"
                        value={newExpenseForm.description}
                        onChange={(e) =>
                          setNewExpenseForm((p) => ({ ...p, description: e.target.value }))
                        }
                        className={`w-full rounded border px-2 py-1.5 text-xs font-bold ${
                          isDark
                            ? 'bg-slate-950 border-slate-700 text-slate-100'
                            : 'bg-slate-50 border-slate-300 text-slate-900'
                        }`}
                      />
                    </div>
                    <button
                      type="submit"
                      className="px-3.5 py-1.5 rounded bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-bold cursor-pointer"
                    >
                      ثبت هزینه
                    </button>
                  </div>
                </div>
              </form>

              {/* خلاصه تجمیعی به تفکیک سرفصل هزینه */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
                {EXPENSE_CATEGORIES_LIST.slice(0, 4).map((cat) => {
                  const sumCat = expenses
                    .filter((e) => e.category === cat)
                    .reduce((s, e) => s + e.amount, 0);
                  return (
                    <div
                      key={cat}
                      className={`p-3 rounded border ${
                        isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-300'
                      }`}
                    >
                      <div className="text-[11px] font-bold text-slate-500">{cat}</div>
                      <div className="text-sm font-black mt-1">
                        {formatFaMoney(sumCat)} {storeConfig.currencyLabel}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div
                className={`rounded border overflow-x-auto ${
                  isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-300'
                }`}
              >
                <table className="w-full text-right border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-300 dark:border-slate-800 bg-slate-100 dark:bg-slate-950">
                      <th className="py-2 px-2.5 border-l border-slate-300 dark:border-slate-800">شماره سند</th>
                      <th className="py-2 px-2.5 border-l border-slate-300 dark:border-slate-800">تاریخ</th>
                      <th className="py-2 px-2.5 border-l border-slate-300 dark:border-slate-800">سرفصل هزینه</th>
                      <th className="py-2 px-2.5 border-l border-slate-300 dark:border-slate-800">منبع پرداخت</th>
                      <th className="py-2 px-2.5 border-l border-slate-300 dark:border-slate-800">دریافت‌کننده</th>
                      <th className="py-2 px-2.5 border-l border-slate-300 dark:border-slate-800">شرح هزینه</th>
                      <th className="py-2 px-2.5">مبلغ ({storeConfig.currencyLabel})</th>
                    </tr>
                  </thead>
                  <tbody>
                    {expenses.map((exp) => (
                      <tr key={exp.id} className="border-b border-slate-200 dark:border-slate-800">
                        <td className="py-2 px-2.5 border-l border-slate-200 dark:border-slate-800 font-bold">
                          {exp.voucherNumber}
                        </td>
                        <td className="py-2 px-2.5 border-l border-slate-200 dark:border-slate-800">
                          {toFaDigits(exp.date)}
                        </td>
                        <td className="py-2 px-2.5 border-l border-slate-200 dark:border-slate-800 font-black">
                          {exp.category}
                        </td>
                        <td className="py-2 px-2.5 border-l border-slate-200 dark:border-slate-800 font-bold">
                          {exp.paymentSource} ({exp.bankOrCashTitle})
                        </td>
                        <td className="py-2 px-2.5 border-l border-slate-200 dark:border-slate-800">
                          {exp.recipientName}
                        </td>
                        <td className="py-2 px-2.5 border-l border-slate-200 dark:border-slate-800">
                          {exp.description}
                        </td>
                        <td className="py-2 px-2.5 font-black text-rose-600">
                          {formatFaMoney(exp.amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          {/* ====================================================================
              ۷. سیستم گزارشات جامع چندمقیاسه (Universal Multi-Scale Reporting Engine)
             ==================================================================== */}
          {activeScreen === 'universal_reports' && (
            <div className="space-y-3">
              {/* نوار انتخاب نوع گزارش و دکمه چاپ مستقیم */}
              <div
                className={`p-3 rounded border flex flex-wrap items-center justify-between gap-2 print:hidden ${
                  isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-300'
                }`}
              >
                <div className="flex flex-wrap items-center gap-1.5">
                  {[
                    { id: 'moein_ledger', label: 'دفتر معین اشخاص (دفتری و چکی)' },
                    { id: 'dual_kardex', label: 'کاردکس دو واحدی کالا' },
                    { id: 'invoices_returns', label: 'ریز فاکتورها و اقلام مرجوعی' },
                    { id: 'profit_loss', label: 'صورت سود و زیان خالص دوره‌ای' },
                    { id: 'cheques_status', label: 'گزارش چک‌های دریافتی، پرداختی و خرج‌شده' },
                  ].map((rep) => (
                    <button
                      key={rep.id}
                      type="button"
                      onClick={() => setActiveReportTab(rep.id as ReportSubType)}
                      className={`px-3 py-1.5 rounded text-xs font-black border cursor-pointer ${
                        activeReportTab === rep.id
                          ? 'bg-emerald-700 text-white border-emerald-600'
                          : isDark
                          ? 'bg-slate-800 text-slate-300 border-slate-700'
                          : 'bg-slate-100 text-slate-700 border-slate-300'
                      }`}
                    >
                      {rep.label}
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>چاپ مستقیم این گزارش</span>
                </button>
              </div>

              {/* فیلترهای تاریخ، شخص و کالا */}
              <div
                className={`p-3 rounded border grid grid-cols-1 md:grid-cols-4 gap-3 print:hidden ${
                  isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-300'
                }`}
              >
                <div>
                  <label className="block text-[11px] font-bold mb-1">از تاریخ شمسی:</label>
                  <input
                    type="text"
                    value={reportDateFrom}
                    onChange={(e) => setReportDateFrom(toFaDigits(e.target.value))}
                    className={`w-full rounded border px-2.5 py-1 text-xs font-bold ${
                      isDark
                        ? 'bg-slate-950 border-slate-700 text-slate-100'
                        : 'bg-slate-50 border-slate-300 text-slate-900'
                    }`}
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold mb-1">تا تاریخ شمسی:</label>
                  <input
                    type="text"
                    value={reportDateTo}
                    onChange={(e) => setReportDateTo(toFaDigits(e.target.value))}
                    className={`w-full rounded border px-2.5 py-1 text-xs font-bold ${
                      isDark
                        ? 'bg-slate-950 border-slate-700 text-slate-100'
                        : 'bg-slate-50 border-slate-300 text-slate-900'
                    }`}
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold mb-1">فیلتر طرف حساب (معین):</label>
                  <select
                    value={reportCounterpartyFilter}
                    onChange={(e) => setReportCounterpartyFilter(e.target.value)}
                    className={`w-full rounded border px-2.5 py-1 text-xs font-bold ${
                      isDark
                        ? 'bg-slate-950 border-slate-700 text-slate-100'
                        : 'bg-slate-50 border-slate-300 text-slate-900'
                    }`}
                  >
                    {counterparties.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.fullName}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold mb-1">فیلتر کالا (کاردکس):</label>
                  <select
                    value={reportProductFilter}
                    onChange={(e) => setReportProductFilter(e.target.value)}
                    className={`w-full rounded border px-2.5 py-1 text-xs font-bold ${
                      isDark
                        ? 'bg-slate-950 border-slate-700 text-slate-100'
                        : 'bg-slate-50 border-slate-300 text-slate-900'
                    }`}
                  >
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* ۷.۱ گزارش دفتر معین اشخاص با تفکیک بدهی دفتری و تعهدات چکی */}
              {activeReportTab === 'moein_ledger' && (() => {
                const targetCp =
                  counterparties.find((c) => c.id === reportCounterpartyFilter) || counterparties[1];
                const cpDocs = documents.filter((d) => d.counterpartyId === targetCp.id);
                const cpCheques = cheques.filter((c) => c.counterpartyId === targetCp.id);
                return (
                  <div
                    className={`p-4 rounded border space-y-3 ${
                      isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-300'
                    }`}
                  >
                    <div className="border-b border-slate-300 dark:border-slate-800 pb-2 flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <h3 className="text-sm font-black">
                          صورت‌حساب دفتر معین تفصیلی: {targetCp.fullName}
                        </h3>
                        <p className="text-xs text-slate-500 mt-0.5">
                          کد تفصیلی: {toFaDigits(targetCp.code)} | تلفن: {toFaDigits(targetCp.phone)} | بازه: {reportDateFrom} الی {reportDateTo}
                        </p>
                      </div>
                      <div className="flex items-center gap-3 text-xs">
                        <div className="px-3 py-1.5 rounded border border-amber-400 bg-amber-50 dark:bg-amber-950/50 font-black">
                          مانده بدهی دفتری باز: {formatFaMoney(Math.abs(targetCp.openBookBalance))}{' '}
                          {storeConfig.currencyLabel} ({targetCp.openBookBalance >= 0 ? 'بد' : 'بس'})
                        </div>
                        <div className="px-3 py-1.5 rounded border border-sky-400 bg-sky-50 dark:bg-sky-950/50 font-black">
                          تعهدات چک در جریان: {formatFaMoney(targetCp.unclearedChequesTotal)}{' '}
                          {storeConfig.currencyLabel}
                        </div>
                        <div className="px-3 py-1.5 rounded border border-emerald-500 bg-emerald-50 dark:bg-emerald-950/50 font-black">
                          جمع کل ریسک اعتباری شخص:{' '}
                          {formatFaMoney(targetCp.openBookBalance + targetCp.unclearedChequesTotal)}{' '}
                          {storeConfig.currencyLabel}
                        </div>
                      </div>
                    </div>

                    <table className="w-full text-right border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-slate-300 dark:border-slate-800 bg-slate-100 dark:bg-slate-950">
                          <th className="py-2 px-2.5 border-l border-slate-300 dark:border-slate-800">تاریخ</th>
                          <th className="py-2 px-2.5 border-l border-slate-300 dark:border-slate-800">شماره سند</th>
                          <th className="py-2 px-2.5 border-l border-slate-300 dark:border-slate-800">شرح گردش معین</th>
                          <th className="py-2 px-2.5 border-l border-slate-300 dark:border-slate-800">بدهکار (بد)</th>
                          <th className="py-2 px-2.5 border-l border-slate-300 dark:border-slate-800">بستانکار (بس)</th>
                          <th className="py-2 px-2.5">نحوه تسویه / توضیحات</th>
                        </tr>
                      </thead>
                      <tbody>
                        {cpDocs.map((doc) => {
                          const isDebit = doc.docType === 'sales' || doc.docType === 'purchase_return';
                          return (
                            <tr key={doc.id} className="border-b border-slate-200 dark:border-slate-800">
                              <td className="py-2 px-2.5 border-l border-slate-200 dark:border-slate-800">
                                {toFaDigits(doc.date)}
                              </td>
                              <td className="py-2 px-2.5 border-l border-slate-200 dark:border-slate-800 font-bold">
                                {doc.docNumber}
                              </td>
                              <td className="py-2 px-2.5 border-l border-slate-200 dark:border-slate-800 font-bold">
                                {DOCUMENT_TABS_META.find((t) => t.id === doc.docType)?.title} ({toFaDigits(doc.items.length)} ردیف کالا)
                              </td>
                              <td className="py-2 px-2.5 border-l border-slate-200 dark:border-slate-800 font-black text-amber-700 dark:text-amber-400">
                                {isDebit ? formatFaMoney(doc.grandTotal) : '۰'}
                              </td>
                              <td className="py-2 px-2.5 border-l border-slate-200 dark:border-slate-800 font-black text-emerald-700 dark:text-emerald-400">
                                {!isDebit ? formatFaMoney(doc.grandTotal) : formatFaMoney(doc.cashReceived + doc.posReceived)}
                              </td>
                              <td className="py-2 px-2.5">
                                نسیه فاکتور: {formatFaMoney(doc.creditNesiyehAmount)} {storeConfig.currencyLabel}
                              </td>
                            </tr>
                          );
                        })}
                        {cpCheques.map((chq) => (
                          <tr key={chq.id} className="border-b border-slate-200 dark:border-slate-800">
                            <td className="py-2 px-2.5 border-l border-slate-200 dark:border-slate-800">
                              {toFaDigits(chq.issueDate)}
                            </td>
                            <td className="py-2 px-2.5 border-l border-slate-200 dark:border-slate-800 font-bold">
                              چک-{toFaDigits(chq.serialNumber)}
                            </td>
                            <td className="py-2 px-2.5 border-l border-slate-200 dark:border-slate-800 font-bold">
                              دریافت چک صیادی سررسید {toFaDigits(chq.dueDate)} ({chq.bankName})
                            </td>
                            <td className="py-2 px-2.5 border-l border-slate-200 dark:border-slate-800">۰</td>
                            <td className="py-2 px-2.5 border-l border-slate-200 dark:border-slate-800 font-black text-emerald-700 dark:text-emerald-400">
                              {formatFaMoney(chq.amount)}
                            </td>
                            <td className="py-2 px-2.5 font-bold">وضعیت چک: {chq.status}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                );
              })()}

              {/* ۷.۲ گزارش کاردکس دو واحدی کالا */}
              {activeReportTab === 'dual_kardex' && (() => {
                const targetPrd =
                  products.find((p) => p.id === reportProductFilter) || products[0];
                const movements = kardexList.filter((k) => k.productId === targetPrd.id);
                return (
                  <div
                    className={`p-4 rounded border space-y-3 ${
                      isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-300'
                    }`}
                  >
                    <div className="border-b border-slate-300 dark:border-slate-800 pb-2 flex items-center justify-between">
                      <div>
                        <h3 className="text-sm font-black">
                          کاردکس تعدادی و دو واحدی کالا: {targetPrd.name}
                        </h3>
                        <p className="text-xs text-slate-500 mt-0.5">
                          واحد جزء: {targetPrd.baseUnit} | واحد کل: {targetPrd.subUnit} (ضریب تبدیل: {toFaDigits(targetPrd.conversionRatio)})
                        </p>
                      </div>
                      <div className="px-3 py-1.5 rounded bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-500 text-xs font-black">
                        موجودی فعلی انبار مغازه:{' '}
                        {formatDualUnitStock(
                          targetPrd.stockShop,
                          targetPrd.baseUnit,
                          targetPrd.subUnit,
                          targetPrd.conversionRatio
                        )}
                      </div>
                    </div>

                    <table className="w-full text-right border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-slate-300 dark:border-slate-800 bg-slate-100 dark:bg-slate-950">
                          <th className="py-2 px-2.5 border-l border-slate-300 dark:border-slate-800">تاریخ</th>
                          <th className="py-2 px-2.5 border-l border-slate-300 dark:border-slate-800">شماره سند</th>
                          <th className="py-2 px-2.5 border-l border-slate-300 dark:border-slate-800">نوع عملیات</th>
                          <th className="py-2 px-2.5 border-l border-slate-300 dark:border-slate-800">طرف حساب</th>
                          <th className="py-2 px-2.5 border-l border-slate-300 dark:border-slate-800">وارده (دو واحدی)</th>
                          <th className="py-2 px-2.5 border-l border-slate-300 dark:border-slate-800">صادره (دو واحدی)</th>
                          <th className="py-2 px-2.5">مانده کاردکس (کل و جزء)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {movements.map((m) => (
                          <tr key={m.id} className="border-b border-slate-200 dark:border-slate-800">
                            <td className="py-2 px-2.5 border-l border-slate-200 dark:border-slate-800">
                              {toFaDigits(m.date)}
                            </td>
                            <td className="py-2 px-2.5 border-l border-slate-200 dark:border-slate-800 font-bold">
                              {m.docNumber}
                            </td>
                            <td className="py-2 px-2.5 border-l border-slate-200 dark:border-slate-800 font-bold">
                              {m.movementType}
                            </td>
                            <td className="py-2 px-2.5 border-l border-slate-200 dark:border-slate-800">
                              {m.counterpartyName}
                            </td>
                            <td className="py-2 px-2.5 border-l border-slate-200 dark:border-slate-800 font-bold text-emerald-600">
                              {m.inBaseQty > 0
                                ? formatDualUnitStock(m.inBaseQty, m.baseUnit, m.subUnit, m.unitRatio)
                                : '—'}
                            </td>
                            <td className="py-2 px-2.5 border-l border-slate-200 dark:border-slate-800 font-bold text-rose-600">
                              {m.outBaseQty > 0
                                ? formatDualUnitStock(m.outBaseQty, m.baseUnit, m.subUnit, m.unitRatio)
                                : '—'}
                            </td>
                            <td className="py-2 px-2.5 font-black">
                              {formatDualUnitStock(m.balanceBaseQty, m.baseUnit, m.subUnit, m.unitRatio)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                );
              })()}

              {/* ۷.۳ گزارش ریز فاکتورها و اقلام مرجوعی */}
              {activeReportTab === 'invoices_returns' && (
                <div
                  className={`p-4 rounded border space-y-3 ${
                    isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-300'
                  }`}
                >
                  <h3 className="text-sm font-black border-b border-slate-300 dark:border-slate-800 pb-2">
                    گزارش جامع ریز فاکتورهای فروش، خرید و اسناد مرجوعی
                  </h3>
                  <table className="w-full text-right border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-slate-300 dark:border-slate-800 bg-slate-100 dark:bg-slate-950">
                        <th className="py-2 px-2.5 border-l border-slate-300 dark:border-slate-800">شماره سند</th>
                        <th className="py-2 px-2.5 border-l border-slate-300 dark:border-slate-800">نوع سند</th>
                        <th className="py-2 px-2.5 border-l border-slate-300 dark:border-slate-800">تاریخ</th>
                        <th className="py-2 px-2.5 border-l border-slate-300 dark:border-slate-800">طرف حساب</th>
                        <th className="py-2 px-2.5 border-l border-slate-300 dark:border-slate-800">مبلغ کل</th>
                        <th className="py-2 px-2.5 border-l border-slate-300 dark:border-slate-800">دریافتی نقد و پوز</th>
                        <th className="py-2 px-2.5 border-l border-slate-300 dark:border-slate-800">مانده نسیه</th>
                        <th className="py-2 px-2.5 print:hidden">چاپ مجدد</th>
                      </tr>
                    </thead>
                    <tbody>
                      {documents.map((d) => (
                        <tr key={d.id} className="border-b border-slate-200 dark:border-slate-800">
                          <td className="py-2 px-2.5 border-l border-slate-200 dark:border-slate-800 font-bold">
                            {d.docNumber}
                          </td>
                          <td className="py-2 px-2.5 border-l border-slate-200 dark:border-slate-800 font-bold">
                            {DOCUMENT_TABS_META.find((t) => t.id === d.docType)?.title}
                          </td>
                          <td className="py-2 px-2.5 border-l border-slate-200 dark:border-slate-800">
                            {toFaDigits(d.date)}
                          </td>
                          <td className="py-2 px-2.5 border-l border-slate-200 dark:border-slate-800 font-bold">
                            {d.counterpartyName}
                          </td>
                          <td className="py-2 px-2.5 border-l border-slate-200 dark:border-slate-800 font-black">
                            {formatFaMoney(d.grandTotal)}
                          </td>
                          <td className="py-2 px-2.5 border-l border-slate-200 dark:border-slate-800 text-emerald-600 font-bold">
                            {formatFaMoney(d.cashReceived + d.posReceived)}
                          </td>
                          <td className="py-2 px-2.5 border-l border-slate-200 dark:border-slate-800 text-amber-600 font-bold">
                            {formatFaMoney(d.creditNesiyehAmount)}
                          </td>
                          <td className="py-2 px-2.5 print:hidden">
                            <button
                              type="button"
                              onClick={() => {
                                setDocumentToPrint(d);
                                setIsPrintPreviewModalOpen(true);
                              }}
                              className="px-2 py-1 rounded bg-slate-200 dark:bg-slate-800 text-[11px] font-bold cursor-pointer"
                            >
                              پیش‌نمایش چاپ
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* ۷.۴ صورت سود و زیان خالص دوره‌ای */}
              {activeReportTab === 'profit_loss' && (() => {
                const salesDocs = documents.filter((d) => d.docType === 'sales');
                const returnDocs = documents.filter((d) => d.docType === 'sales_return');
                const grossSales = salesDocs.reduce((s, d) => s + d.grandTotal, 0);
                const salesReturns = returnDocs.reduce((s, d) => s + d.grandTotal, 0);
                const netSales = grossSales - salesReturns;
                const totalCOGS =
                  salesDocs.reduce((s, d) => s + d.totalCostOfGoods, 0) -
                  returnDocs.reduce((s, d) => s + d.totalCostOfGoods, 0);
                const grossProfit = netSales - totalCOGS;
                const totalOperatingExpenses = expenses.reduce((s, e) => s + e.amount, 0);
                const netProfit = grossProfit - totalOperatingExpenses;

                return (
                  <div
                    className={`p-4 rounded border space-y-3 ${
                      isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-300'
                    }`}
                  >
                    <h3 className="text-sm font-black border-b border-slate-300 dark:border-slate-800 pb-2">
                      صورت سود و زیان خالص دوره‌ای (بر اساس بهای تمام‌شده خرید و کسر هزینه‌های مغازه)
                    </h3>
                    <div className="max-w-2xl space-y-2 text-xs">
                      <div className="flex justify-between py-2 border-b border-slate-200 dark:border-slate-800">
                        <span className="font-bold">۱. فروش ناخالص دوره:</span>
                        <span className="font-black">
                          {formatFaMoney(grossSales)} {storeConfig.currencyLabel}
                        </span>
                      </div>
                      <div className="flex justify-between py-2 border-b border-slate-200 dark:border-slate-800 text-rose-600">
                        <span className="font-bold">۲. کسر می‌شود: برگشت از فروش و مرجوعی‌ها:</span>
                        <span className="font-black">
                          ({formatFaMoney(salesReturns)}) {storeConfig.currencyLabel}
                        </span>
                      </div>
                      <div className="flex justify-between py-2 border-b border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2">
                        <span className="font-black">فروش خالص دوره:</span>
                        <span className="font-black">
                          {formatFaMoney(netSales)} {storeConfig.currencyLabel}
                        </span>
                      </div>
                      <div className="flex justify-between py-2 border-b border-slate-200 dark:border-slate-800 text-slate-500">
                        <span className="font-bold">۳. کسر می‌شود: بهای تمام‌شده کالای فروش‌رفته (بر مبنای فی خرید):</span>
                        <span className="font-black">
                          ({formatFaMoney(totalCOGS)}) {storeConfig.currencyLabel}
                        </span>
                      </div>
                      <div className="flex justify-between py-2 border-b border-emerald-500 bg-emerald-50/60 dark:bg-emerald-950/40 px-2">
                        <span className="font-black text-emerald-800 dark:text-emerald-300">
                          سود ناخالص بازرگانی (قبل از کسر هزینه‌ها):
                        </span>
                        <span className="font-black text-emerald-700 dark:text-emerald-400">
                          {formatFaMoney(grossProfit)} {storeConfig.currencyLabel}
                        </span>
                      </div>
                      <div className="flex justify-between py-2 border-b border-slate-200 dark:border-slate-800 text-rose-600">
                        <span className="font-bold">
                          ۴. کسر می‌شود: جمع کل هزینه‌های عملیاتی مغازه (کرایه، وانت‌بار، حقوق شاگرد، نایلون):
                        </span>
                        <span className="font-black">
                          ({formatFaMoney(totalOperatingExpenses)}) {storeConfig.currencyLabel}
                        </span>
                      </div>
                      <div className="flex justify-between py-3 px-3 rounded border-2 border-emerald-600 bg-emerald-950/10 dark:bg-emerald-950/70 text-sm">
                        <span className="font-black">سود (یا زیان) خالص قطعی دوره:</span>
                        <span className="font-black text-emerald-700 dark:text-emerald-300">
                          {formatFaMoney(netProfit)} {storeConfig.currencyLabel}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* ۷.۵ گزارش وضعیت چک‌ها */}
              {activeReportTab === 'cheques_status' && (
                <div
                  className={`p-4 rounded border space-y-3 ${
                    isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-300'
                  }`}
                >
                  <h3 className="text-sm font-black border-b border-slate-300 dark:border-slate-800 pb-2">
                    گزارش جامع چک‌های دریافتی، پرداختی و خرج‌شده به بنکداران
                  </h3>
                  <table className="w-full text-right border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-slate-300 dark:border-slate-800 bg-slate-100 dark:bg-slate-950">
                        <th className="py-2 px-2.5 border-l border-slate-300 dark:border-slate-800">شناسه صیاد</th>
                        <th className="py-2 px-2.5 border-l border-slate-300 dark:border-slate-800">جهت چک</th>
                        <th className="py-2 px-2.5 border-l border-slate-300 dark:border-slate-800">طرف حساب</th>
                        <th className="py-2 px-2.5 border-l border-slate-300 dark:border-slate-800">سررسید</th>
                        <th className="py-2 px-2.5 border-l border-slate-300 dark:border-slate-800">مبلغ</th>
                        <th className="py-2 px-2.5">وضعیت و محل واگذاری</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cheques.map((c) => (
                        <tr key={c.id} className="border-b border-slate-200 dark:border-slate-800">
                          <td className="py-2 px-2.5 border-l border-slate-200 dark:border-slate-800 font-bold">
                            {toFaDigits(c.sayadiNumber)}
                          </td>
                          <td className="py-2 px-2.5 border-l border-slate-200 dark:border-slate-800">
                            {c.direction === 'incoming' ? 'دریافتی' : 'پرداختی'}
                          </td>
                          <td className="py-2 px-2.5 border-l border-slate-200 dark:border-slate-800 font-bold">
                            {c.drawerName}
                          </td>
                          <td className="py-2 px-2.5 border-l border-slate-200 dark:border-slate-800 font-bold">
                            {toFaDigits(c.dueDate)}
                          </td>
                          <td className="py-2 px-2.5 border-l border-slate-200 dark:border-slate-800 font-black">
                            {formatFaMoney(c.amount)} {storeConfig.currencyLabel}
                          </td>
                          <td className="py-2 px-2.5 font-bold">
                            {c.status} {c.endorsedToName ? `(${c.endorsedToName})` : ''}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ====================================================================
              ۸. تنظیمات کسب‌وکار، تابلوی مغازه، اتحادیه و واحد پول (System Config)
             ==================================================================== */}
          {activeScreen === 'system_settings' && (
            <div
              className={`p-4 rounded border max-w-3xl space-y-4 ${
                isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-300'
              }`}
            >
              <div className="border-b border-slate-300 dark:border-slate-800 pb-2">
                <h2 className="text-sm font-black">
                  تنظیمات مشخصات تابلو فروشگاه، پروانه کسب اتحادیه و واحد پول سامانه
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  تغییرات این بخش بلافاصله در سربرگ برنامه و تمامی قالب‌های چاپی فاکتور اعمال می‌گردد.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block font-bold mb-1">نام تابلو و سرنسخه فروشگاه:</label>
                  <input
                    type="text"
                    value={storeConfig.storeSignboardName}
                    onChange={(e) =>
                      setStoreConfig((p) => ({ ...p, storeSignboardName: e.target.value }))
                    }
                    className={`w-full rounded border px-2.5 py-1.5 font-bold ${
                      isDark
                        ? 'bg-slate-950 border-slate-700 text-slate-100'
                        : 'bg-slate-50 border-slate-300 text-slate-900'
                    }`}
                  />
                </div>

                <div>
                  <label className="block font-bold mb-1">عنوان صنف و اتحادیه:</label>
                  <input
                    type="text"
                    value={storeConfig.guildTitle}
                    onChange={(e) => setStoreConfig((p) => ({ ...p, guildTitle: e.target.value }))}
                    className={`w-full rounded border px-2.5 py-1.5 font-bold ${
                      isDark
                        ? 'bg-slate-950 border-slate-700 text-slate-100'
                        : 'bg-slate-50 border-slate-300 text-slate-900'
                    }`}
                  />
                </div>

                <div>
                  <label className="block font-bold mb-1">شماره پروانه کسب اتحادیه:</label>
                  <input
                    type="text"
                    value={storeConfig.unionLicenseNumber}
                    onChange={(e) =>
                      setStoreConfig((p) => ({
                        ...p,
                        unionLicenseNumber: toFaDigits(e.target.value),
                      }))
                    }
                    className={`w-full rounded border px-2.5 py-1.5 font-bold ${
                      isDark
                        ? 'bg-slate-950 border-slate-700 text-slate-100'
                        : 'bg-slate-50 border-slate-300 text-slate-900'
                    }`}
                  />
                </div>

                <div>
                  <label className="block font-bold mb-1">واحد پول رسمی محاسبات و چاپ:</label>
                  <select
                    value={storeConfig.currencyLabel}
                    onChange={(e) =>
                      setStoreConfig((p) => ({
                        ...p,
                        currencyLabel: e.target.value as 'تومان' | 'ریال',
                      }))
                    }
                    className={`w-full rounded border px-2.5 py-1.5 font-bold ${
                      isDark
                        ? 'bg-slate-950 border-slate-700 text-slate-100'
                        : 'bg-slate-50 border-slate-300 text-slate-900'
                    }`}
                  >
                    <option value="تومان">تومان</option>
                    <option value="ریال">ریال</option>
                  </select>
                </div>

                <div className="md:col-span-2">
                  <label className="block font-bold mb-1">شماره تلفن‌های تماس (چاپ در سرنسخه):</label>
                  <input
                    type="text"
                    value={storeConfig.phoneNumbers}
                    onChange={(e) =>
                      setStoreConfig((p) => ({ ...p, phoneNumbers: toFaDigits(e.target.value) }))
                    }
                    className={`w-full rounded border px-2.5 py-1.5 font-bold ${
                      isDark
                        ? 'bg-slate-950 border-slate-700 text-slate-100'
                        : 'bg-slate-50 border-slate-300 text-slate-900'
                    }`}
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block font-bold mb-1">نشانی دقیق حجره / فروشگاه در بازار:</label>
                  <input
                    type="text"
                    value={storeConfig.storeAddress}
                    onChange={(e) =>
                      setStoreConfig((p) => ({ ...p, storeAddress: e.target.value }))
                    }
                    className={`w-full rounded border px-2.5 py-1.5 font-bold ${
                      isDark
                        ? 'bg-slate-950 border-slate-700 text-slate-100'
                        : 'bg-slate-50 border-slate-300 text-slate-900'
                    }`}
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block font-bold mb-1">شرایط و توضیحات ثابت ذیل فاکتور چاپی:</label>
                  <textarea
                    rows={2}
                    value={storeConfig.invoiceFooterTerms}
                    onChange={(e) =>
                      setStoreConfig((p) => ({ ...p, invoiceFooterTerms: e.target.value }))
                    }
                    className={`w-full rounded border px-2.5 py-1.5 font-bold ${
                      isDark
                        ? 'bg-slate-950 border-slate-700 text-slate-100'
                        : 'bg-slate-50 border-slate-300 text-slate-900'
                    }`}
                  />
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
      {/* ========================================================================
          ۹. پنجره‌های مودال عملیاتی (انتخاب سریع کالا، سقف اعتبار، قالب چاپ، خرج چک)
         ======================================================================== */}

      {/* ۹.۱ پنجره انتخاب سریع کالا با درخت گروه‌های خرازی (Instant Item Selector Modal) */}
      {isItemModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 print:hidden">
          <div
            className={`w-full max-w-5xl rounded-lg border-2 shadow-2xl overflow-hidden flex flex-col max-h-[85vh] ${
              isDark
                ? 'bg-slate-900 border-slate-700 text-slate-100'
                : 'bg-white border-slate-400 text-slate-900'
            }`}
          >
            <div className="px-4 py-2.5 border-b border-slate-300 dark:border-slate-800 flex items-center justify-between bg-emerald-900 text-white">
              <div className="flex items-center gap-2">
                <FolderTree className="w-4 h-4 text-emerald-300" />
                <span className="text-xs font-black">
                  فهرست درختی کالاهای خرازی و یراق‌آلات (حرکت با کلیدهای جهت‌نما ↑↓ و انتخاب با کلید ورود)
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsItemModalOpen(false)}
                className="p-1 hover:bg-emerald-800 rounded cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 border-b border-slate-300 dark:border-slate-800 flex items-center gap-3">
              <input
                type="text"
                autoFocus
                value={itemModalSearchQuery}
                onChange={(e) => {
                  setItemModalSearchQuery(e.target.value);
                  setItemModalHighlightedIdx(0);
                }}
                placeholder="جستجوی فوری بر اساس نام کالا یا کد کالا (مثال: دکمه، زیپ، روبان، ۱۰۱۱)..."
                className={`flex-1 rounded border px-3 py-1.5 text-xs font-bold ${
                  isDark
                    ? 'bg-slate-950 border-slate-700 text-slate-100'
                    : 'bg-slate-50 border-slate-300 text-slate-900'
                }`}
              />
              <span className="text-xs font-bold text-slate-500">
                تعداد یافت‌شده: {toFaDigits(filteredModalProducts.length)} کالا
              </span>
            </div>

            <div className="flex-1 grid grid-cols-1 md:grid-cols-12 overflow-hidden">
              {/* ستون راست: درخت طبقه‌بندی گروه‌های کالایی */}
              <div className="md:col-span-3 border-l border-slate-300 dark:border-slate-800 p-2.5 overflow-y-auto space-y-1 bg-slate-50 dark:bg-slate-950/60">
                <div className="text-[11px] font-black text-slate-500 mb-1.5 px-1">
                  درخت گروه‌های کالایی:
                </div>
                {INITIAL_CATEGORY_TREE.map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => {
                      setItemModalCategoryFilter(cat.id);
                      setItemModalHighlightedIdx(0);
                    }}
                    className={`w-full text-right px-2.5 py-1.5 rounded text-xs font-bold transition cursor-pointer flex items-center justify-between ${
                      cat.parentId ? 'pr-6 text-[11px]' : ''
                    } ${
                      itemModalCategoryFilter === cat.id
                        ? 'bg-emerald-700 text-white'
                        : 'hover:bg-slate-200 dark:hover:bg-slate-800'
                    }`}
                  >
                    <span>{cat.title}</span>
                  </button>
                ))}
              </div>

              {/* ستون چپ: جدول کالاها با موجودی دو واحدی و قیمت‌ها */}
              <div className="md:col-span-9 overflow-y-auto">
                <table className="w-full text-right border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-300 dark:border-slate-800 bg-slate-100 dark:bg-slate-950 sticky top-0">
                      <th className="py-2 px-2 border-l border-slate-300 dark:border-slate-800">کد</th>
                      <th className="py-2 px-2.5 border-l border-slate-300 dark:border-slate-800">نام و مشخصات کالا</th>
                      <th className="py-2 px-2 border-l border-slate-300 dark:border-slate-800">ضریب بسته/جین</th>
                      <th className="py-2 px-2 border-l border-slate-300 dark:border-slate-800">موجودی مغازه</th>
                      <th className="py-2 px-2 border-l border-slate-300 dark:border-slate-800">انبار مرکزی</th>
                      {activeRole.canSeePurchasePrice && (
                        <th className="py-2 px-2 border-l border-slate-300 dark:border-slate-800">فی خرید جزء</th>
                      )}
                      <th className="py-2 px-2 border-l border-slate-300 dark:border-slate-800">فی عمده جزء</th>
                      <th className="py-2 px-2">انتخاب</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredModalProducts.map((prd, i) => {
                      const isHighlighted = i === itemModalHighlightedIdx;
                      return (
                        <tr
                          key={prd.id}
                          onClick={() => handleSelectProductFromModal(prd)}
                          className={`border-b border-slate-200 dark:border-slate-800 cursor-pointer ${
                            isHighlighted
                              ? 'bg-emerald-100 dark:bg-emerald-950/80'
                              : 'hover:bg-slate-100 dark:hover:bg-slate-800/50'
                          }`}
                        >
                          <td className="py-2 px-2 border-l border-slate-200 dark:border-slate-800 font-bold">
                            {toFaDigits(prd.code)}
                          </td>
                          <td className="py-2 px-2.5 border-l border-slate-200 dark:border-slate-800 font-black">
                            {prd.name}
                          </td>
                          <td className="py-2 px-2 border-l border-slate-200 dark:border-slate-800 font-bold text-slate-500">
                            هر {prd.subUnit} = {toFaDigits(prd.conversionRatio)} {prd.baseUnit}
                          </td>
                          <td className="py-2 px-2 border-l border-slate-200 dark:border-slate-800 font-bold text-emerald-700 dark:text-emerald-400">
                            {formatDualUnitStock(
                              prd.stockShop,
                              prd.baseUnit,
                              prd.subUnit,
                              prd.conversionRatio
                            )}
                          </td>
                          <td className="py-2 px-2 border-l border-slate-200 dark:border-slate-800 font-semibold">
                            {formatDualUnitStock(
                              prd.stockCentral,
                              prd.baseUnit,
                              prd.subUnit,
                              prd.conversionRatio
                            )}
                          </td>
                          {activeRole.canSeePurchasePrice && (
                            <td className="py-2 px-2 border-l border-slate-200 dark:border-slate-800 font-bold text-slate-500">
                              {formatFaMoney(prd.purchasePrice)}
                            </td>
                          )}
                          <td className="py-2 px-2 border-l border-slate-200 dark:border-slate-800 font-black">
                            {formatFaMoney(prd.wholesalePrice)}
                          </td>
                          <td className="py-2 px-2 text-center">
                            <span className="px-2 py-0.5 rounded bg-emerald-700 text-white text-[11px] font-bold">
                              انتخاب
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ۹.۲ پنجره هشدار سقف اعتبار هوشمند (Smart Credit Ceiling Guard Modal) */}
      {creditCeilingAlertModal.isOpen && (
        <div className="fixed inset-0 z-50 bg-black/65 flex items-center justify-center p-4 print:hidden">
          <div
            className={`w-full max-w-lg rounded-lg border-2 border-rose-600 shadow-2xl overflow-hidden ${
              isDark ? 'bg-slate-900 text-slate-100' : 'bg-white text-slate-900'
            }`}
          >
            <div className="bg-rose-700 text-white px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5" />
                <span className="text-sm font-black">
                  هشدار مسدودکننده: عبور از سقف اعتبار مجاز مشتری
                </span>
              </div>
              <button
                type="button"
                onClick={() =>
                  setCreditCeilingAlertModal((prev) => ({ ...prev, isOpen: false }))
                }
                className="p-1 hover:bg-rose-800 rounded cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-3 text-xs">
              <p className="font-bold leading-relaxed">
                ثبت این فاکتور برای «{selectedCounterparty.fullName}» باعث عبور از سقف اعتبار تعیین‌شده در پرونده شخص می‌گردد:
              </p>

              {creditCeilingAlertModal.bookExceededAmount > 0 && (
                <div className="p-2.5 rounded border border-rose-400 bg-rose-50 dark:bg-rose-950/60 text-rose-900 dark:text-rose-200 font-bold">
                  • میزان تجاوز از سقف بدهی نسیه دفتری:{' '}
                  <span className="font-black underline">
                    {formatFaMoney(creditCeilingAlertModal.bookExceededAmount)}{' '}
                    {storeConfig.currencyLabel}
                  </span>
                </div>
              )}

              {creditCeilingAlertModal.chequeExceededAmount > 0 && (
                <div className="p-2.5 rounded border border-amber-400 bg-amber-50 dark:bg-amber-950/60 text-amber-900 dark:text-amber-200 font-bold">
                  • میزان تجاوز از سقف چک‌های در جریان وصول:{' '}
                  <span className="font-black underline">
                    {formatFaMoney(creditCeilingAlertModal.chequeExceededAmount)}{' '}
                    {storeConfig.currencyLabel}
                  </span>
                </div>
              )}

              {activeRole.canApproveCreditCeiling ? (
                <div className="p-3 rounded border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 space-y-2">
                  <div className="font-black text-emerald-700 dark:text-emerald-400">
                    مجوز عبور موقت توسط مدیر سیستم:
                  </div>
                  <p className="text-[11px] text-slate-500">
                    شما با سمت «مدیر سیستم» وارد شده‌اید و می‌توانید با مسئولیت خود ثبت این فاکتور را بالاتر از سقف اعتبار تأیید نمایید.
                  </p>
                  <div className="flex items-center justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() =>
                        setCreditCeilingAlertModal((prev) => ({ ...prev, isOpen: false }))
                      }
                      className="px-3 py-1.5 rounded border border-slate-400 font-bold cursor-pointer"
                    >
                      انصراف و اصلاح مبلغ تسویه
                    </button>
                    <button
                      type="button"
                      onClick={() => attemptFinalizeInvoice(true)}
                      className="px-3.5 py-1.5 rounded bg-rose-700 hover:bg-rose-600 text-white font-black cursor-pointer"
                    >
                      تأیید مدیر سیستم و ثبت قطعی فاکتور
                    </button>
                  </div>
                </div>
              ) : (
                <div className="p-3 rounded border border-rose-400 bg-rose-950/20 text-rose-600 font-bold">
                  سطح دسترسی شما («{activeRole.title}») مجوز عبور از سقف اعتبار را ندارد. لطفاً مبلغ نقد یا کارتخوان را افزایش دهید یا از مدیر سیستم درخواست تأیید نمایید.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ۹.۳ پنجره تنظیمات قالب چاپ فاکتور (Customizable Print Engine Modal) */}
      {isPrintConfigModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 print:hidden">
          <div
            className={`w-full max-w-xl rounded-lg border-2 shadow-2xl overflow-hidden ${
              isDark
                ? 'bg-slate-900 border-slate-700 text-slate-100'
                : 'bg-white border-slate-400 text-slate-900'
            }`}
          >
            <div className="px-4 py-3 border-b border-slate-300 dark:border-slate-800 flex items-center justify-between bg-slate-800 text-white">
              <div className="flex items-center gap-2">
                <Printer className="w-4 h-4 text-amber-400" />
                <span className="text-xs font-black">
                  تنظیمات قالب چاپ فاکتور، اندازه کاغذ و چیدمان بخش‌ها
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsPrintConfigModalOpen(false)}
                className="p-1 hover:bg-slate-700 rounded cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-4 text-xs">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold mb-1">قطع کاغذ چاپگر:</label>
                  <select
                    value={printConfig.paperSize}
                    onChange={(e) =>
                      setPrintConfig((p) => ({
                        ...p,
                        paperSize: e.target.value as PrintPaperSize,
                      }))
                    }
                    className={`w-full rounded border px-2 py-1.5 font-bold ${
                      isDark
                        ? 'bg-slate-950 border-slate-700 text-slate-100'
                        : 'bg-slate-50 border-slate-300 text-slate-900'
                    }`}
                  >
                    <option value="A4">برگه کامل اداری (قطع آچهار)</option>
                    <option value="A5">نیم‌برگ فاکتوری بازار (قطع آ‌پنج)</option>
                    <option value="80mm">رول حرارتی صندوق (هشتاد میلی‌متری)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold mb-1">طرح ظاهری فاکتور:</label>
                  <select
                    value={printConfig.visualStyle}
                    onChange={(e) =>
                      setPrintConfig((p) => ({
                        ...p,
                        visualStyle: e.target.value as PrintVisualStyle,
                      }))
                    }
                    className={`w-full rounded border px-2 py-1.5 font-bold ${
                      isDark
                        ? 'bg-slate-950 border-slate-700 text-slate-100'
                        : 'bg-slate-50 border-slate-300 text-slate-900'
                    }`}
                  >
                    <option value="کلاسیک هلو">کلاسیک هلو (کادرهای تفکیکی)</option>
                    <option value="رسمی اتحادیه">رسمی اتحادیه (جدول کامل)</option>
                    <option value="فشرده بازاری">فشرده بازاری (حداکثر تعداد ردیف)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold mb-1">اندازه قلم چاپی:</label>
                  <select
                    value={printConfig.fontSizeScale}
                    onChange={(e) =>
                      setPrintConfig((p) => ({
                        ...p,
                        fontSizeScale: e.target.value as PrintFontSizeScale,
                      }))
                    }
                    className={`w-full rounded border px-2 py-1.5 font-bold ${
                      isDark
                        ? 'bg-slate-950 border-slate-700 text-slate-100'
                        : 'bg-slate-50 border-slate-300 text-slate-900'
                    }`}
                  >
                    <option value="ریز">ریز (مناسب فاکتورهای پرردیف)</option>
                    <option value="متوسط">متوسط (استاندارد بازار)</option>
                    <option value="بزرگ">بزرگ (خوانایی بالا)</option>
                  </select>
                </div>
              </div>

              <div>
                <div className="font-black mb-1.5">
                  نمایش یا عدم نمایش و ترتیب چیدمان بخش‌های فاکتور چاپی:
                </div>
                <div className="space-y-1.5">
                  {printConfig.sections.map((sec, idx) => (
                    <div
                      key={sec.id}
                      className="flex items-center justify-between px-3 py-1.5 rounded border border-slate-300 dark:border-slate-800 bg-slate-50 dark:bg-slate-950"
                    >
                      <label className="flex items-center gap-2 font-bold cursor-pointer">
                        <input
                          type="checkbox"
                          checked={sec.visible}
                          onChange={() => togglePrintSectionVisibility(sec.id)}
                        />
                        <span>
                          {toFaDigits(idx + 1)}. {sec.label}
                        </span>
                      </label>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => movePrintSectionOrder(idx, 'up')}
                          className="p-1 rounded border border-slate-300 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-800 cursor-pointer"
                          title="انتقال به بالا"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => movePrintSectionOrder(idx, 'down')}
                          className="p-1 rounded border border-slate-300 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-800 cursor-pointer"
                          title="انتقال به پایین"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end pt-2 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsPrintConfigModalOpen(false)}
                  className="px-4 py-1.5 rounded bg-emerald-700 text-white font-black cursor-pointer"
                >
                  ذخیره و بستن تنظیمات چاپ
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ۹.۴ پیش‌نمایش و چاپ فاکتور بر اساس تنظیمات قالب (Multi-Size Print Preview Modal) */}
      {isPrintPreviewModalOpen && documentToPrint && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4 overflow-y-auto print:bg-white print:p-0 print:static">
          <div className="w-full max-w-4xl bg-white text-slate-950 rounded-lg border-2 border-slate-400 shadow-2xl overflow-hidden print:border-0 print:shadow-none">
            <div className="px-4 py-2.5 bg-slate-900 text-white flex items-center justify-between print:hidden">
              <div className="flex items-center gap-3 text-xs font-bold">
                <span>
                  پیش‌نمایش چاپ ({printConfig.visualStyle} | کاغذ:{' '}
                  {printConfig.paperSize === '80mm'
                    ? 'حرارتی ۸۰ میلی‌متری'
                    : printConfig.paperSize === 'A5'
                    ? 'نیم‌برگ آ‌پنج'
                    : 'کامل آچهار'}{' '}
                  | قلم: {printConfig.fontSizeScale})
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-3 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black flex items-center gap-1.5 cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>ارسال به چاپگر</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsPrintPreviewModalOpen(false)}
                  className="px-2.5 py-1 rounded bg-slate-700 text-white text-xs font-bold cursor-pointer"
                >
                  بستن
                </button>
              </div>
            </div>

            {/* بدنه قابل چاپ فاکتور بر اساس ترتیب بخش‌های انتخابی */}
            <div
              className={`mx-auto bg-white text-slate-950 p-6 space-y-3 ${
                printConfig.paperSize === '80mm'
                  ? 'max-w-[330px]'
                  : printConfig.paperSize === 'A5'
                  ? 'max-w-2xl'
                  : 'max-w-4xl'
              } ${
                printConfig.fontSizeScale === 'ریز'
                  ? 'text-[11px]'
                  : printConfig.fontSizeScale === 'بزرگ'
                  ? 'text-sm'
                  : 'text-xs'
              }`}
            >
              {printConfig.sections
                .filter((s) => s.visible)
                .map((sec) => {
                  if (sec.id === 'storeLogoHeader') {
                    return (
                      <div
                        key={sec.id}
                        className="border-2 border-slate-900 p-3 rounded flex flex-wrap items-center justify-between gap-2"
                      >
                        <div>
                          <div className="font-black text-base">
                            {storeConfig.storeSignboardName}
                          </div>
                          <div className="font-bold text-slate-700 mt-0.5">
                            {storeConfig.guildTitle}
                          </div>
                          <div className="text-[11px] text-slate-600 mt-0.5">
                            نشانی: {storeConfig.storeAddress} | تلفن: {storeConfig.phoneNumbers}
                          </div>
                        </div>
                        <div className="text-left space-y-0.5 font-bold">
                          <div>
                            نوع سند:{' '}
                            {DOCUMENT_TABS_META.find((t) => t.id === documentToPrint.docType)
                              ?.title || 'فاکتور'}
                          </div>
                          <div>شماره سند: {documentToPrint.docNumber}</div>
                          <div>تاریخ: {toFaDigits(documentToPrint.date)}</div>
                        </div>
                      </div>
                    );
                  }
                  if (sec.id === 'unionLicenseNumber') {
                    return (
                      <div
                        key={sec.id}
                        className="px-3 py-1.5 border border-slate-800 rounded flex flex-wrap items-center justify-between font-bold bg-slate-50"
                      >
                        <span>طرف حساب: {documentToPrint.counterpartyName}</span>
                        <span>
                          شماره پروانه کسب اتحادیه: {toFaDigits(storeConfig.unionLicenseNumber)}
                        </span>
                      </div>
                    );
                  }
                  if (sec.id === 'previousCustomerBalance') {
                    return (
                      <div
                        key={sec.id}
                        className="px-3 py-1.5 border border-slate-800 rounded flex items-center justify-between font-bold"
                      >
                        <span>مانده حساب قبلی شخص (قبل از این فاکتور):</span>
                        <span>
                          {formatFaMoney(Math.abs(documentToPrint.previousCustomerBalance))}{' '}
                          {storeConfig.currencyLabel} (
                          {documentToPrint.previousCustomerBalance >= 0 ? 'بدهکار' : 'بستانکار'})
                        </span>
                      </div>
                    );
                  }
                  if (sec.id === 'settlementBreakdownBox') {
                    return (
                      <div key={sec.id} className="space-y-2">
                        {/* جدول اقلام چاپی */}
                        <table className="w-full text-right border-collapse border-2 border-slate-900">
                          <thead>
                            <tr className="bg-slate-200 border-b-2 border-slate-900">
                              <th className="py-1.5 px-2 border-l border-slate-900">ردیف</th>
                              <th className="py-1.5 px-2 border-l border-slate-900">شرح کالا</th>
                              <th className="py-1.5 px-2 border-l border-slate-900">تعداد و واحد</th>
                              <th className="py-1.5 px-2 border-l border-slate-900">فی واحد</th>
                              <th className="py-1.5 px-2 border-l border-slate-900">تخفیف</th>
                              <th className="py-1.5 px-2">مبلغ کل ({storeConfig.currencyLabel})</th>
                            </tr>
                          </thead>
                          <tbody>
                            {documentToPrint.items.map((item, idx) => (
                              <tr key={item.id} className="border-b border-slate-800">
                                <td className="py-1 px-2 border-l border-slate-800 text-center font-bold">
                                  {toFaDigits(idx + 1)}
                                </td>
                                <td className="py-1 px-2 border-l border-slate-800 font-bold">
                                  {item.productName}
                                </td>
                                <td className="py-1 px-2 border-l border-slate-800 font-bold">
                                  {toFaDigits(item.quantity)} {item.unitTitle} (معادل{' '}
                                  {toFaDigits(item.baseQuantityTotal)} واحد جزء)
                                </td>
                                <td className="py-1 px-2 border-l border-slate-800 font-bold">
                                  {formatFaMoney(item.unitPrice)}
                                </td>
                                <td className="py-1 px-2 border-l border-slate-800">
                                  {formatFaMoney(item.discountAmount)}
                                </td>
                                <td className="py-1 px-2 font-black">
                                  {formatFaMoney(item.totalRowAmount)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>

                        {/* خلاصه تسویه */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 border-2 border-slate-900 p-2.5 rounded font-bold">
                          <div>
                            جمع کل فاکتور: {formatFaMoney(documentToPrint.grandTotal)}{' '}
                            {storeConfig.currencyLabel}
                          </div>
                          <div>
                            دریافت نقد و پوز:{' '}
                            {formatFaMoney(
                              documentToPrint.cashReceived + documentToPrint.posReceived
                            )}{' '}
                            {storeConfig.currencyLabel}
                          </div>
                          <div>
                            باقیه پول مشتری: {formatFaMoney(documentToPrint.changeReturned)}{' '}
                            {storeConfig.currencyLabel}
                          </div>
                          <div className="font-black underline">
                            مانده نسیه این فاکتور:{' '}
                            {formatFaMoney(documentToPrint.creditNesiyehAmount)}{' '}
                            {storeConfig.currencyLabel}
                          </div>
                        </div>
                      </div>
                    );
                  }
                  if (sec.id === 'invoiceNotes') {
                    return (
                      <div key={sec.id} className="p-2 border border-slate-800 rounded space-y-1">
                        <div className="font-bold">
                          توضیحات سند: {documentToPrint.notes || 'فاقد توضیحات اختصاصی'}
                        </div>
                        <div className="text-[11px] text-slate-700">
                          {storeConfig.invoiceFooterTerms}
                        </div>
                      </div>
                    );
                  }
                  if (sec.id === 'signatureStampBox') {
                    return (
                      <div
                        key={sec.id}
                        className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-800 text-center font-bold"
                      >
                        <div className="h-16 border border-dashed border-slate-700 rounded flex items-center justify-center">
                          مهر و امضای فروشنده ({storeConfig.storeSignboardName})
                        </div>
                        <div className="h-16 border border-dashed border-slate-700 rounded flex items-center justify-center">
                          امضای تحویل‌گیرنده / خریدار ({documentToPrint.counterpartyName})
                        </div>
                      </div>
                    );
                  }
                  return null;
                })}
            </div>
          </div>
        </div>
      )}

      {/* ۹.۵ پنجره واگذاری و خرج چک به تأمین‌کننده (Cheque Endorsement Modal) */}
      {endorseModalChequeId && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 print:hidden">
          <div
            className={`w-full max-w-md rounded-lg border-2 shadow-2xl overflow-hidden ${
              isDark
                ? 'bg-slate-900 border-slate-700 text-slate-100'
                : 'bg-white border-slate-400 text-slate-900'
            }`}
          >
            <div className="px-4 py-3 bg-amber-700 text-white flex items-center justify-between">
              <span className="text-xs font-black">
                واگذاری و خرج چک مشتری به حساب بنکدار / تأمین‌کننده
              </span>
              <button
                type="button"
                onClick={() => setEndorseModalChequeId(null)}
                className="p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 space-y-3 text-xs">
              <div>
                <label className="block font-bold mb-1">
                  انتخاب بنکدار یا کارخانه جهت واگذاری چک (کسر خودکار از بدهی ما):
                </label>
                <select
                  value={endorseTargetSupplierId}
                  onChange={(e) => setEndorseTargetSupplierId(e.target.value)}
                  className={`w-full rounded border px-2.5 py-1.5 font-bold ${
                    isDark
                      ? 'bg-slate-950 border-slate-700 text-slate-100'
                      : 'bg-slate-50 border-slate-300 text-slate-900'
                  }`}
                >
                  {counterparties
                    .filter((c) => c.type === 'supplier' || c.type === 'both')
                    .map((sup) => (
                      <option key={sup.id} value={sup.id}>
                        {sup.fullName}
                      </option>
                    ))}
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEndorseModalChequeId(null)}
                  className="px-3 py-1.5 rounded border border-slate-400 font-bold cursor-pointer"
                >
                  انصراف
                </button>
                <button
                  type="button"
                  onClick={handleConfirmEndorseCheque}
                  className="px-3.5 py-1.5 rounded bg-amber-600 hover:bg-amber-500 text-white font-black cursor-pointer"
                >
                  ثبت قطعی خرج چک در دفتر معین
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ۹.۶ پنجره تعریف کالای جدید خرازی (New Product Modal) */}
      {isNewProductModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 print:hidden">
          <form
            onSubmit={handleCreateNewProduct}
            className={`w-full max-w-lg rounded-lg border-2 shadow-2xl overflow-hidden ${
              isDark
                ? 'bg-slate-900 border-slate-700 text-slate-100'
                : 'bg-white border-slate-400 text-slate-900'
            }`}
          >
            <div className="px-4 py-3 bg-emerald-800 text-white flex items-center justify-between">
              <span className="text-xs font-black">تعریف کالای دو واحدی جدید در انبار خرازی</span>
              <button
                type="button"
                onClick={() => setIsNewProductModalOpen(false)}
                className="p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 grid grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block font-bold mb-1">کد کالا:</label>
                <input
                  type="text"
                  value={newProductForm.code}
                  onChange={(e) =>
                    setNewProductForm((p) => ({ ...p, code: toFaDigits(e.target.value) }))
                  }
                  className="w-full rounded border border-slate-400 px-2 py-1 font-bold"
                />
              </div>
              <div>
                <label className="block font-bold mb-1">نام کالا:</label>
                <input
                  type="text"
                  value={newProductForm.name}
                  onChange={(e) => setNewProductForm((p) => ({ ...p, name: e.target.value }))}
                  className="w-full rounded border border-slate-400 px-2 py-1 font-bold"
                />
              </div>
              <div>
                <label className="block font-bold mb-1">واحد جزء (عدد / متر / حلقه):</label>
                <input
                  type="text"
                  value={newProductForm.baseUnit}
                  onChange={(e) => setNewProductForm((p) => ({ ...p, baseUnit: e.target.value }))}
                  className="w-full rounded border border-slate-400 px-2 py-1 font-bold"
                />
              </div>
              <div>
                <label className="block font-bold mb-1">واحد کل (جین / رول / طمار):</label>
                <input
                  type="text"
                  value={newProductForm.subUnit}
                  onChange={(e) => setNewProductForm((p) => ({ ...p, subUnit: e.target.value }))}
                  className="w-full rounded border border-slate-400 px-2 py-1 font-bold"
                />
              </div>
              <div>
                <label className="block font-bold mb-1">ضریب تبدیل واحد کل به جزء:</label>
                <input
                  type="number"
                  value={newProductForm.conversionRatio}
                  onChange={(e) =>
                    setNewProductForm((p) => ({
                      ...p,
                      conversionRatio: Number(e.target.value),
                    }))
                  }
                  className="w-full rounded border border-slate-400 px-2 py-1 font-black"
                />
              </div>
              <div>
                <label className="block font-bold mb-1">فی خرید واحد جزء:</label>
                <input
                  type="number"
                  value={newProductForm.purchasePrice}
                  onChange={(e) =>
                    setNewProductForm((p) => ({
                      ...p,
                      purchasePrice: Number(e.target.value),
                    }))
                  }
                  className="w-full rounded border border-slate-400 px-2 py-1 font-black"
                />
              </div>
              <div>
                <label className="block font-bold mb-1">فی فروش عمده (واحد جزء):</label>
                <input
                  type="number"
                  value={newProductForm.wholesalePrice}
                  onChange={(e) =>
                    setNewProductForm((p) => ({
                      ...p,
                      wholesalePrice: Number(e.target.value),
                    }))
                  }
                  className="w-full rounded border border-slate-400 px-2 py-1 font-black"
                />
              </div>
              <div>
                <label className="block font-bold mb-1">موجودی اولیه انبار مغازه (به واحد جزء):</label>
                <input
                  type="number"
                  value={newProductForm.stockShop}
                  onChange={(e) =>
                    setNewProductForm((p) => ({ ...p, stockShop: Number(e.target.value) }))
                  }
                  className="w-full rounded border border-slate-400 px-2 py-1 font-black"
                />
              </div>
              <div className="col-span-2 flex justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsNewProductModalOpen(false)}
                  className="px-3 py-1.5 rounded border border-slate-400 font-bold cursor-pointer"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded bg-emerald-700 text-white font-black cursor-pointer"
                >
                  ثبت کالا در کاردکس انبار
                </button>
              </div>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
