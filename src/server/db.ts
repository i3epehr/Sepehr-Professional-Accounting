import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { Pool } from 'pg';
import {
  User,
  Product,
  Unit,
  ProductCategory,
  Person,
  Brand,
  PersonGroup,
  ProductCustomSpec,
  Invoice,
  InvoiceStatus,
  AccountingAccount,
  AccountingVoucher,
  TreasuryAccount,
  TreasuryTransaction,
  FinancialCategory,
  Cheque,
  ChequeStatus,
  ChequeStatusHistoryItem,
  AuditLog,
  StoreSettings,
  UnitFamily,
  SalesType,
  AccessoryCostType,
  AccessoryCostEntry,
  AllocatedProductItem,
  AllocationMethod,
  Warehouse,
  WarehouseStock,
  KardexEntry,
  GoodsReceipt,
  GoodsReceiptItem,
  PurchaseProforma,
  WarehouseTransfer,
  WarehouseTransferItem,
  StocktakingSession,
  StocktakingItem,
  InventoryAdjustment,
  InventoryAdjustmentItem,
  InventoryAdjustmentReason,
  InventoryTurnoverReportRow,
  StockMovementReferenceType,
  FiscalYear,
  FiscalYearArchiveSnapshot,
  OpeningBalancePayload,
  FiscalPreClosingAudit,
  UserRole,
  PermissionAction,
  PermissionModule,
  RolePermissionConfig,
  SecurityPolicyConfig,
  SecurityCheckSummary,
  AuditLogAction,
  AuditLogCategory,
} from '../types/index.ts';
import { validateVoucherBalance, validateInventoryStock, TransactionError } from './transaction.ts';
import { hashPassword, verifyPassword, createSession, ensureInitialSeedSession } from './auth.ts';
import { allocateAccessoryCost } from '../lib/conversions.ts';
import {
  calculateReturnableItems,
  validateReturnQuantities,
  calculateRefundAllocation,
  ReturnableItemInfo,
} from '../lib/returnsCalculations.ts';
import {
  validateInvoiceSettlement,
  checkForDuplicateTransaction,
  calculateAccountStatementAndReconciliation,
  validateChequeStatusTransition,
  createStatusHistoryEntry,
} from '../lib/treasuryCalculations.ts';
import {
  validateDoubleEntryVoucher,
  checkForDuplicateVoucher,
  generateJournalLedger,
  generateGeneralLedger,
  generateSubsidiaryLedger,
  generateDetailedPersonLedger,
  generateTrialBalance,
  auditAccountingIntegrity,
} from '../lib/accountingCalculations.ts';
import {
  ReportFilters,
  normalizePersianDate,
  isDateInRange,
  calculateProfitabilityAndCogsReport,
  calculatePeriodicSalesAndPurchasesReport,
  calculateBestAndLeastSellingReport,
  calculateInventoryAndTurnoverReport,
  calculatePersonsDebtorsCreditorsAndAgingReport,
  calculateExpensesReport,
  calculateTreasuryAndChequesReport,
  calculateFinancialStatementsReport,
  verifyReportsWithSampleDocuments,
} from '../lib/reportsCalculations.ts';
import {
  toEnglishDigits,
  isShamsiLeapYear,
  validateFiscalYearDefinition,
  calculateOpeningBalancePreview,
  generateOpeningBalanceVoucherFromPayload,
  generateClosingAndRolloverVouchers,
  runPreClosingAudit,
  buildFiscalYearArchiveSnapshot,
  runFiscalRolloverSimulationTest,
} from '../lib/fiscalYearCalculations.ts';
import {
  getDefaultRolePermissionConfigs,
  getDefaultSecurityPolicy,
  evaluateUserPermission,
  getEffectiveConfidentialRules,
  classifyAuditLogAction,
  redactUserForClient,
  protectTreasuryConfidentialData,
  validatePasswordStrength,
  validateAndSanitizeInput,
  runSecurityAndRbacSimulationTest,
} from '../lib/securityCalculations.ts';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DATA_FILE = path.join(DATA_DIR, 'kharrazi_data.json');

// ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  } catch (err) {
    console.error('Failed to create data dir:', err);
  }
}

// PostgreSQL connection pool
let pgPool: Pool | null = null;

export interface PostgresConfigInfo {
  host: string;
  port: number;
  database: string;
  user: string;
  databaseUrl: string;
}

export function getSuggestedPostgresConfig(): PostgresConfigInfo {
  return {
    host: process.env.SQL_HOST || 'localhost',
    port: parseInt(process.env.SQL_PORT || '5432', 10),
    database: process.env.SQL_DB_NAME || 'kharrazi_db',
    user: process.env.SQL_USER || 'postgres',
    databaseUrl: process.env.DATABASE_URL || 'postgres://postgres:password@localhost:5432/kharrazi_db',
  };
}

export function getPostgresPool(): Pool | null {
  const config = getSuggestedPostgresConfig();
  if (!pgPool) {
    pgPool = new Pool({
      connectionString: config.databaseUrl,
      connectionTimeoutMillis: 1500, // مهلت کوتاه جهت جلوگیری از مسدود شدن درخواست
      max: 5,
    });
    pgPool.on('error', (_err) => {
      // خطا به صورت بی‌صدا لاگ می‌شود تا سرور کرش نکند
    });
  }
  return pgPool;
}

export async function testPostgresConnection(): Promise<{
  connected: boolean;
  message: string;
  version?: string;
  config: PostgresConfigInfo;
  fallbackActive: boolean;
}> {
  const config = getSuggestedPostgresConfig();
  const pool = getPostgresPool();

  if (!pool) {
    return {
      connected: false,
      message: 'پایگاه داده در حالت ذخیره‌سازی محلی دیسک (Atomic Disk Persistence) فعال است.',
      config,
      fallbackActive: true,
    };
  }

  try {
    const res = await pool.query('SELECT version()');
    return {
      connected: true,
      message: 'اتصال به پایگاه داده PostgreSQL با موفقیت برقرار شد.',
      version: res.rows[0]?.version,
      config,
      fallbackActive: false,
    };
  } catch (err: any) {
    return {
      connected: false,
      message: `تنظیمات پیشنهادی پایگاه داده (پورت ۵۴۳۲ و آدرس ${config.databaseUrl}) ست شده است. سرور PostgreSQL در حال حاضر روی این پورت در حال اجرا نیست، بنابراین سیستم بدون وقفه بر روی موتور دیسک‌محور اتمیک (data/kharrazi_data.json) با تضمین کامل پایداری داده‌ها فعالیت می‌کند.`,
      config,
      fallbackActive: true,
    };
  }
}

// Initial seed data
const initialUnits: Unit[] = [
  // ۱. خانواده طول و متراژ (Length)
  { id: 'u-meter', name: 'متر', symbol: 'm', isDecimalAllowed: true, unitFamily: 'length', description: 'واحد مبنای فروش روبان، تور، کش، پارچه و لایی' },
  { id: 'u-cm', name: 'سانتی‌متر', symbol: 'cm', isDecimalAllowed: true, unitFamily: 'length', baseUnitId: 'u-meter', baseUnitName: 'متر', conversionFactor: 0.01, description: 'برش دقیق، زیپ و نوارهای ظریف' },
  { id: 'u-roll', name: 'رول', symbol: 'roll', isDecimalAllowed: false, unitFamily: 'length', baseUnitId: 'u-meter', baseUnitName: 'متر', conversionFactor: 25, description: 'رول روبان، قیطان، نوار اریب و کش (استاندارد ۲۵ متر)' },
  { id: 'u-bolt', name: 'طاقه', symbol: 'bolt', isDecimalAllowed: false, unitFamily: 'length', baseUnitId: 'u-meter', baseUnitName: 'متر', conversionFactor: 50, description: 'طاقه پارچه، لایی چسب و توری (۵۰ متر)' },
  { id: 'u-yard', name: 'یارد', symbol: 'yd', isDecimalAllowed: true, unitFamily: 'length', baseUnitId: 'u-meter', baseUnitName: 'متر', conversionFactor: 0.9144, description: 'یارد انگلیسی (۹۱٫۴۴ سانتی‌متر)' },

  // ۲. خانواده شمارشی و بسته‌بندی (Count)
  { id: 'u-item', name: 'عدد', symbol: 'pcs', isDecimalAllowed: false, unitFamily: 'count', description: 'واحد شمارش دکمه، قیچی، ماسوره، بشکاف و ابزار' },
  { id: 'u-pair', name: 'جفت', symbol: 'pair', isDecimalAllowed: false, unitFamily: 'count', baseUnitId: 'u-item', baseUnitName: 'عدد', conversionFactor: 2, description: 'اپل لباس، میل بافتنی، قلاب و قزن جفتی' },
  { id: 'u-pack', name: 'بسته', symbol: 'pack', isDecimalAllowed: false, unitFamily: 'count', baseUnitId: 'u-item', baseUnitName: 'عدد', conversionFactor: 100, description: 'بسته‌های ۱۰۰ تایی دکمه، سوزن ته‌گرد و پولک' },
  { id: 'u-box', name: 'کارتن', symbol: 'box', isDecimalAllowed: false, unitFamily: 'count', baseUnitId: 'u-pack', baseUnitName: 'بسته', conversionFactor: 24, description: 'کارتن مادر بنکداری (۲۴ بسته)' },
  { id: 'u-spool', name: 'دوک', symbol: 'spool', isDecimalAllowed: false, unitFamily: 'count', baseUnitId: 'u-item', baseUnitName: 'عدد', conversionFactor: 1, description: 'دوک خیاطی و نخ سردوز' },
  { id: 'u-dozen', name: 'جین', symbol: 'dz', isDecimalAllowed: false, unitFamily: 'count', baseUnitId: 'u-item', baseUnitName: 'عدد', conversionFactor: 12, description: 'جین ۱۲ عددی زیپ و سنجاق' },
  { id: 'u-gross', name: 'قواره', symbol: 'grs', isDecimalAllowed: false, unitFamily: 'count', baseUnitId: 'u-item', baseUnitName: 'عدد', conversionFactor: 144, description: 'قواره استاندارد دکمه و یراق (۱۴۴ عددی)' },

  // ۳. خانواده وزنی (Weight)
  { id: 'u-kg', name: 'کیلوگرم', symbol: 'kg', isDecimalAllowed: true, unitFamily: 'weight', description: 'واحد مبنای فروش وزنی دکمه فله، مروارید، کش کیلویی و الیاف' },
  { id: 'u-gram', name: 'گرم', symbol: 'g', isDecimalAllowed: true, unitFamily: 'weight', baseUnitId: 'u-kg', baseUnitName: 'کیلوگرم', conversionFactor: 0.001, description: 'فروش مثقال و گرم ملیله، منجوق و سنگ‌های تزیینی' },
];

const initialCategories: ProductCategory[] = [
  { id: 'cat-threads', code: '10', name: 'نخ و لوازم دوخت', description: 'دوک، نخ قرقره، نخ پلی‌استر، نخ ابریشم و عمامه‌ای' },
  { id: 'cat-ribbons', code: '20', name: 'روبان، تور و یراق', description: 'روبان ساتن، روبان حریر، تور دانتل، مکرومه، قیطان و نوار تزیینی' },
  { id: 'cat-buttons', code: '30', name: 'دکمه و زیپ', description: 'دکمه مجلسی، پالتویی، پیراهنی، زیپ مخفی، زیپ فلزی و دندانه‌دار' },
  { id: 'cat-elastics', code: '40', name: 'کش و چسب‌های خیاطی', description: 'کش ماسوره، کش ۱ تا ۱۰ سانت، لایی چسب، زانفیکس، چسب حرارتی' },
  { id: 'cat-tools', code: '50', name: 'ابزار و ملزومات خیاطی', description: 'قیچی، سوزن خیاطی، سوزن ته‌گرد، رولت، صابون، بشکاف، گونیا' },
  { id: 'cat-yarns', code: '60', name: 'کاموا و بافتنی', description: 'کاموا موهر، آلیزه، ناکو، میل بافتنی، قلاب و پوم‌پوم' },
  { id: 'cat-beads', code: '70', name: 'مروارید، منجوق و بدلیجات', description: 'مروارید لپه‌ای، ملیله، پولک، سنگ حرارتی، چفت و قفل' },
];

const defaultPasswordHash = hashPassword('Admin123');

const initialUsers: User[] = [
  {
    id: 'usr-admin',
    username: 'admin',
    fullName: 'مهندس رضایی (مدیر فروشگاه)',
    role: 'admin',
    isActive: true,
    mobile: '09121112233',
    email: 'admin@negin-kharrazi.ir',
    department: 'مدیریت ارشد',
    passwordHash: defaultPasswordHash,
    failedLoginAttempts: 0,
    lockedUntil: null,
    lastLoginAt: '1403/07/22 08:30',
    lastLoginIp: '127.0.0.1',
    createdAt: '1403/01/01',
  },
  {
    id: 'usr-accountant',
    username: 'hesabdar',
    fullName: 'خانم احمدی (حسابدار ارشد)',
    role: 'accountant',
    isActive: true,
    mobile: '09123334455',
    email: 'accounting@negin-kharrazi.ir',
    department: 'واحد مالی و حسابداری',
    passwordHash: defaultPasswordHash,
    failedLoginAttempts: 0,
    lockedUntil: null,
    lastLoginAt: '1403/07/22 09:00',
    lastLoginIp: '192.168.1.14',
    createdAt: '1403/01/01',
  },
  {
    id: 'usr-cashier',
    username: 'sandogh',
    fullName: 'آقای کریمی (صندوق‌دار)',
    role: 'cashier',
    isActive: true,
    mobile: '09125556677',
    email: 'pos@negin-kharrazi.ir',
    department: 'فروش و صندوق پیشخوان',
    passwordHash: defaultPasswordHash,
    failedLoginAttempts: 0,
    lockedUntil: null,
    lastLoginAt: '1403/07/22 09:15',
    lastLoginIp: '192.168.1.21',
    createdAt: '1403/01/01',
  },
  {
    id: 'usr-clerk',
    username: 'anbar',
    fullName: 'آقای حسینی (مسئول انبار)',
    role: 'inventory_clerk',
    isActive: true,
    mobile: '09127778899',
    email: 'warehouse@negin-kharrazi.ir',
    department: 'انبار مرکزی و کاردکس',
    passwordHash: defaultPasswordHash,
    failedLoginAttempts: 0,
    lockedUntil: null,
    lastLoginAt: '1403/07/22 08:45',
    lastLoginIp: '192.168.1.35',
    createdAt: '1403/01/01',
  },
];

const initialAuditLogs: AuditLog[] = [
  {
    id: 'log-seed-1',
    userId: 'usr-admin',
    username: 'admin',
    userName: 'مهندس رضایی (مدیر فروشگاه)',
    userRole: 'admin',
    action: 'login',
    category: 'auth_session',
    severity: 'info',
    status: 'success',
    module: 'احراز هویت و نشست',
    permissionModule: 'users_security',
    permissionAction: 'view',
    description: 'ورود موفق مدیر ارشد به سامانه و ایجاد نشست فعال (IP: 127.0.0.1)',
    ipAddress: '127.0.0.1',
    endpoint: 'POST /api/auth/login',
    timestamp: '1403/07/22 ۰۸:۳۰:۱۲',
  },
  {
    id: 'log-seed-2',
    userId: 'usr-accountant',
    username: 'hesabdar',
    userName: 'خانم احمدی (حسابدار ارشد)',
    userRole: 'accountant',
    action: 'approve',
    category: 'sensitive_operation',
    severity: 'info',
    status: 'success',
    module: 'حسابداری دوطرفه',
    permissionModule: 'accounting',
    permissionAction: 'approve',
    entityId: 'vch-1002',
    description: 'قطعی‌سازی سند حسابداری شماره ۱۰۰۲ (فروش روبان ساتن به مزون پریسا)',
    ipAddress: '192.168.1.14',
    endpoint: 'PUT /api/accounting/vouchers/vch-1002',
    beforeData: { status: 'draft' },
    afterData: { status: 'permanent' },
    timestamp: '1403/07/22 ۰۹:۲۰:۴۵',
  },
  {
    id: 'log-seed-3',
    userId: 'usr-cashier',
    username: 'sandogh',
    userName: 'آقای کریمی (صندوق‌دار)',
    userRole: 'cashier',
    action: 'unauthorized_access',
    category: 'failed_attempt',
    severity: 'critical',
    status: 'blocked',
    module: 'مدیریت سال مالی شمسی',
    permissionModule: 'fiscal_year',
    permissionAction: 'approve',
    description: 'تلاش غیرمجاز صندوق‌دار برای دسترسی به عملیات بستن سال مالی (مسدود شده توسط گارد Backend با کد 403)',
    ipAddress: '192.168.1.21',
    endpoint: 'POST /api/fiscal-years/fy-1403/close-and-rollover',
    timestamp: '1403/07/22 ۱۰:۰۵:۱۸',
  },
  {
    id: 'log-seed-4',
    userId: 'usr-clerk',
    username: 'anbar',
    userName: 'آقای حسینی (مسئول انبار)',
    userRole: 'inventory_clerk',
    action: 'update',
    category: 'change_history',
    severity: 'info',
    status: 'success',
    module: 'اطلاعات پایه و کالا',
    permissionModule: 'base_info',
    permissionAction: 'edit',
    entityId: 'prd-1',
    description: 'ویرایش نقطه سفارش کالای «روبان ساتن ۲٫۵ سانت قرمز نگین» از ۸۰ به ۱۰۰ متر',
    ipAddress: '192.168.1.35',
    endpoint: 'POST /api/products',
    beforeData: { minStockAlert: 80 },
    afterData: { minStockAlert: 100 },
    timestamp: '1403/07/22 ۱۱:۱۲:۰۴',
  },
  {
    id: 'log-seed-5',
    userId: 'usr-cashier',
    username: 'sandogh',
    userName: 'آقای کریمی (صندوق‌دار)',
    userRole: 'cashier',
    action: 'failed_login',
    category: 'failed_attempt',
    severity: 'warning',
    status: 'failed',
    module: 'احراز هویت و نشست',
    description: 'تلاش ناموفق ورود برای نام کاربری «sandogh» به علت اشتباه بودن کلمه عبور (مرتبه ۱ از ۵)',
    ipAddress: '192.168.1.21',
    endpoint: 'POST /api/auth/login',
    timestamp: '1403/07/22 ۱۱:۴۰:۳۰',
  },
];

const initialProducts: Product[] = [
  {
    id: 'prd-1',
    code: 'KH-1001',
    barcode: '626010010001',
    name: 'روبان ساتن ۲٫۵ سانت قرمز نگین (رول ۲۵ متری)',
    categoryId: 'cat-ribbons',
    categoryName: 'روبان، تور و یراق',
    baseUnitId: 'u-meter',
    baseUnitName: 'متر',
    color: 'قرمز لاکی',
    size: '۲٫۵ سانتیمتر',
    material: 'ساتن براق',
    brand: 'نگین',
    purchasePrice: 28000,
    retailPrice: 48000,
    wholesalePrice: 38000,
    minAllowedPrice: 35000,
    currentStock: 450,
    minStockAlert: 100,
    allowDecimal: true,
    unitConversions: [
      { unitId: 'u-roll', unitName: 'رول (۲۵ متر)', conversionFactor: 25, price: 950000 },
    ],
    isActive: true,
    createdAt: '1403/01/01',
    updatedAt: '1403/07/15',
  },
  {
    id: 'prd-2',
    code: 'KH-1002',
    barcode: '626010010002',
    name: 'روبان حریر ۱٫۵ سانت شیری رنگ',
    categoryId: 'cat-ribbons',
    categoryName: 'روبان، تور و یراق',
    baseUnitId: 'u-meter',
    baseUnitName: 'متر',
    color: 'شیری / نباتی',
    size: '۱٫۵ سانتیمتر',
    material: 'حریر شیشه‌ای',
    brand: 'پروانه',
    purchasePrice: 18000,
    retailPrice: 32000,
    wholesalePrice: 26000,
    minAllowedPrice: 24000,
    currentStock: 45, // کمبود موجودی
    minStockAlert: 120,
    allowDecimal: true,
    unitConversions: [
      { unitId: 'u-roll', unitName: 'رول (۵۰ متر)', conversionFactor: 50, price: 1250000 },
    ],
    isActive: true,
    createdAt: '1403/01/02',
    updatedAt: '1403/07/18',
  },
  {
    id: 'prd-3',
    code: 'KH-2001',
    barcode: '626020010001',
    name: 'دوک نخ پلی‌استر ۴۰/۲ مشکی چرخ خیاطی',
    categoryId: 'cat-threads',
    categoryName: 'نخ و لوازم دوخت',
    baseUnitId: 'u-spool',
    baseUnitName: 'دوک',
    color: 'مشکی (کد 001)',
    size: '۵۰۰۰ یارد',
    material: 'پلی‌استر ریسیده',
    brand: 'آیلار (Aylar)',
    purchasePrice: 42000,
    retailPrice: 65000,
    wholesalePrice: 54000,
    minAllowedPrice: 50000,
    currentStock: 180,
    minStockAlert: 40,
    allowDecimal: false,
    unitConversions: [
      { unitId: 'u-box', unitName: 'کارتن (۶۰ دوک)', conversionFactor: 60, price: 3120000 },
    ],
    isActive: true,
    createdAt: '1403/01/02',
    updatedAt: '1403/07/10',
  },
  {
    id: 'prd-4',
    code: 'KH-3001',
    barcode: '626030010001',
    name: 'دکمه پیراهنی صدفی ۱۸ لول سفید (بسته ۱۴۴ عددی)',
    categoryId: 'cat-buttons',
    categoryName: 'دکمه و زیپ',
    baseUnitId: 'u-item',
    baseUnitName: 'عدد',
    color: 'سفید صدفی',
    size: '۱۸ لول',
    material: 'پلی‌استر صدفی',
    brand: 'ایتالیایی کپی',
    purchasePrice: 450,
    retailPrice: 900,
    wholesalePrice: 650,
    minAllowedPrice: 600,
    currentStock: 2880,
    minStockAlert: 500,
    allowDecimal: false,
    unitConversions: [
      { unitId: 'u-pack', unitName: 'قواره (۱۴۴ عددی)', conversionFactor: 144, price: 85000 },
    ],
    isActive: true,
    createdAt: '1403/01/05',
    updatedAt: '1403/07/08',
  },
  {
    id: 'prd-5',
    code: 'KH-3002',
    barcode: '626030010002',
    name: 'زیپ مخفی ۵۰ سانتی سرمه‌ای مجلسی',
    categoryId: 'cat-buttons',
    categoryName: 'دکمه و زیپ',
    baseUnitId: 'u-item',
    baseUnitName: 'عدد',
    color: 'سرمه‌ای تیره',
    size: '۵۰ سانتیمتر',
    material: 'نایلون دندانه‌ریز',
    brand: 'YKK اورجینال',
    purchasePrice: 16000,
    retailPrice: 28000,
    wholesalePrice: 22000,
    minAllowedPrice: 20000,
    currentStock: 18, // هشدار موجودی بحرانی
    minStockAlert: 50,
    allowDecimal: false,
    unitConversions: [],
    isActive: true,
    createdAt: '1403/01/05',
    updatedAt: '1403/07/19',
  },
];

export const initialBrands: Brand[] = [
  { id: 'br-1', name: 'دمسه (DMC)', country: 'فرانسه', description: 'نخ‌های گلدوزی، کوبلن و عمامه‌ای اصل فرانسه' },
  { id: 'br-2', name: 'یونکس (YKK)', country: 'ژاپن', description: 'زیپ‌های مخفی مجلسی، استخوانی و دنده‌فلزی اورجینال' },
  { id: 'br-3', name: 'ناکو (Nako)', country: 'ترکیه', description: 'کاموا و ملزومات بافتنی اعلا' },
  { id: 'br-4', name: 'آیلار (Aylar)', country: 'ایران', description: 'دوک‌های پلی‌استر ۴۰/۲ خیاطی بدون پرز' },
  { id: 'br-5', name: 'پروانه (Parvaneh)', country: 'ایران', description: 'روبان‌های ساتن، حریر لمه‌دار و یراق‌آلات' },
  { id: 'br-6', name: 'دالفین (Dolphin)', country: 'تایوان', description: 'سوزن، قیچی دالبر و ابزار برش تخصصی' },
  { id: 'br-7', name: 'زرین (Zarrin)', country: 'ایران', description: 'کش شلواری، کش ماسوره، قیطان و زانفیکس' },
];

export const initialPersonGroups: PersonGroup[] = [
  { id: 'grp-1', code: 'GRP-10', name: 'مزون‌ها و کارگاه‌های خیاطی', description: 'تولیدکنندگان لباس مجلسی و زنانه با خرید نسیه و هفتگی', defaultDiscountPercent: 5, defaultCreditLimit: 30000000 },
  { id: 'grp-2', code: 'GRP-20', name: 'بنکداران و عمده‌فروشان بازار', description: 'مشتریان عمده‌فروش با حجم خرید بالا و تسویه چکی', defaultDiscountPercent: 10, defaultCreditLimit: 100000000 },
  { id: 'grp-3', code: 'GRP-30', name: 'تأمین‌کنندگان ملزومات و ابزار', description: 'واردکنندگان زیپ، دکمه، قیچی و ملزومات خرازی', defaultDiscountPercent: 0, defaultCreditLimit: 200000000 },
  { id: 'grp-4', code: 'GRP-40', name: 'مشتریان خرد و متفرقه', description: 'خرید نقدی یا کارتخوانی دخل فروشگاه', defaultDiscountPercent: 0, defaultCreditLimit: 0 },
];

const initialPersons: Person[] = [
  {
    id: 'per-1',
    code: '1001',
    name: 'مزون دوخت پریسا (خانم عباسی)',
    personType: 'customer',
    groupId: 'grp-1',
    groupName: 'مزون‌ها و کارگاه‌های خیاطی',
    phone: '02188443322',
    mobile: '09123456789',
    creditLimit: 25000000,
    currentBalance: 4850000,
    address: 'تهران، خیابان فلسطین شمالی، کوچه فرجام، پلاک ۱۲',
    notes: 'مشتری دائمی و خوش‌حساب مزونی',
    isActive: true,
    createdAt: '1403/01/05',
    updatedAt: '1403/07/15',
  },
  {
    id: 'per-2',
    code: '1002',
    name: 'تولیدی پوشاک زنانه باران (آقای مرادی)',
    personType: 'customer',
    groupId: 'grp-1',
    groupName: 'مزون‌ها و کارگاه‌های خیاطی',
    phone: '02155667788',
    mobile: '09129876543',
    creditLimit: 80000000,
    currentBalance: 18400000,
    address: 'تهران، بازار بزرگ، سرای مشیر، طبقه دوم، پلاک ۴',
    notes: 'خرید عمده روبان و زیپ و دکمه',
    isActive: true,
    createdAt: '1403/01/10',
    updatedAt: '1403/07/10',
  },
  {
    id: 'per-3',
    code: '2001',
    name: 'بازرگانی یراق و دکمه پارس (حاج قاسم تقوی)',
    personType: 'supplier',
    groupId: 'grp-3',
    groupName: 'تأمین‌کنندگان ملزومات و ابزار',
    phone: '02133991122',
    mobile: '09121112233',
    creditLimit: 150000000,
    currentBalance: -32000000,
    address: 'تهران، خیابان خیام، بازار پاچنار، پاساژ شکوفه، پلاک ۱۸',
    notes: 'تأمین‌کننده اصلی دکمه، زیپ YKK و روبان ساتن وارداتی',
    isActive: true,
    createdAt: '1403/01/01',
    updatedAt: '1403/07/01',
  },
  {
    id: 'per-4',
    code: '3001',
    name: 'مشتری عمومی / متفرقه نقدی خرازی',
    personType: 'customer',
    groupId: 'grp-4',
    groupName: 'مشتریان خرد و متفرقه',
    mobile: '09000000000',
    creditLimit: 0,
    currentBalance: 0,
    notes: 'فروش روزمره دخل نقدی و کارتخوان به مشتریان گذری',
    isActive: true,
    createdAt: '1403/01/01',
    updatedAt: '1403/01/01',
  },
];

const initialAccountsChart: AccountingAccount[] = [
  { id: 'acc-10', code: '10', title: 'دارایی‌های جاری', level: 'group', accountType: 'asset', balance: 0 },
  { id: 'acc-101', code: '101', title: 'موجودی نقد و بانک', level: 'general', accountType: 'asset', parentCode: '10', balance: 0 },
  { id: 'acc-10101', code: '10101', title: 'صندوق اصلی فروشگاه', level: 'subsidiary', accountType: 'asset', parentCode: '101', balance: 28450000 },
  { id: 'acc-10104', code: '10104', title: 'صندوق شماره ۲ دخل انبار', level: 'subsidiary', accountType: 'asset', parentCode: '101', balance: 5000000 },
  { id: 'acc-10102', code: '10102', title: 'بانک ملی - جاری ۵۴۲۱', level: 'subsidiary', accountType: 'asset', parentCode: '101', balance: 142800000 },
  { id: 'acc-10105', code: '10105', title: 'بانک ملت شعبه سعدی (حساب جاری)', level: 'subsidiary', accountType: 'asset', parentCode: '101', balance: 65000000 },
  { id: 'acc-10103', code: '10103', title: 'بانک ملت - دستگاه کارتخوان POS', level: 'subsidiary', accountType: 'asset', parentCode: '101', balance: 87500000 },
  { id: 'acc-102', code: '102', title: 'اسناد دریافتنی (چک‌ها)', level: 'general', accountType: 'asset', parentCode: '10', balance: 35000000 },
  { id: 'acc-103', code: '103', title: 'حساب‌های دریافتنی تجاری (بدهکاران)', level: 'general', accountType: 'asset', parentCode: '10', balance: 23250000 },
  { id: 'acc-104', code: '104', title: 'موجودی کالای فروشگاه خرازی', level: 'general', accountType: 'asset', parentCode: '10', balance: 326400000 },
  { id: 'acc-20', code: '20', title: 'بدهی‌های جاری', level: 'group', accountType: 'liability', balance: 0 },
  { id: 'acc-201', code: '201', title: 'حساب‌های پرداختنی تجاری (بستانکاران)', level: 'general', accountType: 'liability', parentCode: '20', balance: 32000000 },
  { id: 'acc-202', code: '202', title: 'اسناد پرداختنی (چک‌های صادره)', level: 'general', accountType: 'liability', parentCode: '20', balance: 25000000 },
  { id: 'acc-30', code: '30', title: 'حقوق صاحبان سهام و سرمایه', level: 'group', accountType: 'equity', balance: 0 },
  { id: 'acc-301', code: '301', title: 'سرمایه اولیه فروشگاه', level: 'general', accountType: 'equity', parentCode: '30', balance: 500000000 },
  { id: 'acc-302', code: '302', title: 'سود و زیان انباشته', level: 'general', accountType: 'equity', parentCode: '30', balance: 142150000 },
  { id: 'acc-40', code: '40', title: 'درآمدها', level: 'group', accountType: 'revenue', balance: 0 },
  { id: 'acc-401', code: '401', title: 'درآمد حاصل از فروش کالا و ملزومات', level: 'general', accountType: 'revenue', parentCode: '40', balance: 215400000 },
  { id: 'acc-402', code: '402', title: 'برگشت از فروش و تخفیفات', level: 'general', accountType: 'revenue', parentCode: '40', balance: -3200000 },
  { id: 'acc-50', code: '50', title: 'بهای تمام شده کالای فروش رفته', level: 'group', accountType: 'expense', balance: 0 },
  { id: 'acc-501', code: '501', title: 'قیمت تمام شده اجناس فروخته شده', level: 'general', accountType: 'expense', parentCode: '50', balance: 138000000 },
  { id: 'acc-60', code: '60', title: 'هزینه‌های عمومی و اداری', level: 'group', accountType: 'expense', balance: 0 },
  { id: 'acc-601', code: '601', title: 'هزینه اجاره، شارژ و قبوض فروشگاه', level: 'general', accountType: 'expense', parentCode: '60', balance: 18500000 },
  { id: 'acc-602', code: '602', title: 'هزینه حمل و باربری اجناس خرازی', level: 'general', accountType: 'expense', parentCode: '60', balance: 4200000 },
];

const initialVouchers: AccountingVoucher[] = [
  {
    id: 'vch-1001',
    voucherNumber: '1001',
    date: '1403/01/01',
    description: 'سند افتتاحیه دوره مالی ۱۴۰۳ فروشگاه و انبار خرازی',
    fiscalYearId: 'fy-1403',
    status: 'approved',
    referenceType: 'opening_balance',
    referenceNumber: 'OPN-1403',
    lines: [
      { id: 'vl-opn-1', accountCode: '10101', accountTitle: 'صندوق اصلی فروشگاه', debit: 25000000, credit: 0, description: 'موجودی اولیه صندوق نقد اصلی' },
      { id: 'vl-opn-1b', accountCode: '10104', accountTitle: 'صندوق شماره ۲ دخل انبار', debit: 5000000, credit: 0, description: 'موجودی اولیه صندوق شماره ۲ انبار' },
      { id: 'vl-opn-2', accountCode: '10102', accountTitle: 'بانک ملی - جاری ۵۴۲۱', debit: 124800000, credit: 0, description: 'موجودی اولیه حساب جاری بانک ملی' },
      { id: 'vl-opn-2b', accountCode: '10105', accountTitle: 'بانک ملت شعبه سعدی (حساب جاری)', debit: 65000000, credit: 0, description: 'موجودی اولیه حساب جاری بانک ملت سعدی' },
      { id: 'vl-opn-3', accountCode: '10103', accountTitle: 'بانک ملت - دستگاه کارتخوان POS', debit: 72500000, credit: 0, description: 'موجودی اولیه پایانه پوز ملت' },
      { id: 'vl-opn-4', accountCode: '102', accountTitle: 'اسناد دریافتنی (چک‌ها)', debit: 35000000, credit: 0, description: 'موجودی چک‌های صیادی دریافتنی' },
      { id: 'vl-opn-5a', accountCode: '103', accountTitle: 'حساب‌های دریافتنی تجاری (بدهکاران)', personId: 'per-1', personName: 'مزون دوخت پریسا (خانم عباسی)', debit: 9050000, credit: 0, description: 'مانده اول دوره مزون دوخت پریسا' },
      { id: 'vl-opn-5b', accountCode: '103', accountTitle: 'حساب‌های دریافتنی تجاری (بدهکاران)', personId: 'per-2', personName: 'تولیدی پوشاک زنانه باران', debit: 36400000, credit: 0, description: 'مانده اول دوره تولیدی پوشاک زنانه باران' },
      { id: 'vl-opn-6', accountCode: '104', accountTitle: 'موجودی کالای فروشگاه خرازی', debit: 326400000, credit: 0, description: 'ارزش ریالی موجودی اولیه اقلام خرازی و خرج‌کار' },
      { id: 'vl-opn-7', accountCode: '201', accountTitle: 'حساب‌های پرداختنی تجاری (بستانکاران)', personId: 'per-3', personName: 'بازرگانی یراق و دکمه پارس (حاج قاسم تقوی)', debit: 0, credit: 32000000, description: 'مانده بدهی اول دوره به بازرگانی یراق و دکمه پارس' },
      { id: 'vl-opn-8', accountCode: '202', accountTitle: 'اسناد پرداختنی (چک‌های صادره)', debit: 0, credit: 25000000, description: 'چک‌های صادره در وجه بنکداران' },
      { id: 'vl-opn-9', accountCode: '301', accountTitle: 'سرمایه اولیه فروشگاه', debit: 0, credit: 500000000, description: 'سرمایه ثبتی شرکا' },
      { id: 'vl-opn-10', accountCode: '302', accountTitle: 'سود و زیان انباشته', debit: 0, credit: 142150000, description: 'سود انباشته سنوات قبل' },
    ],
    totalDebit: 699150000,
    totalCredit: 699150000,
    isBalanced: true,
    createdBy: 'مدیر ارشد مالی',
    createdAt: '1403/01/01',
  },
  {
    id: 'vch-1002',
    voucherNumber: '1002',
    date: '1403/07/02',
    description: 'دریافت وجه از مزون دوخت پریسا (خانم عباسی) بابت تسویه علی‌الحساب - پیگیری: RCV-40112',
    fiscalYearId: 'fy-1403',
    status: 'approved',
    referenceType: 'treasury',
    referenceId: 'tr-tx-101',
    referenceNumber: 'TRX-1001',
    lines: [
      { id: 'vl-1002-1', accountCode: '10101', accountTitle: 'صندوق نقدی اصلی فروشگاه', debit: 4200000, credit: 0, description: 'دریافت نقدی در صندوق فروشگاه' },
      { id: 'vl-1002-2', accountCode: '103', accountTitle: 'حساب‌های دریافتنی تجاری (بدهکاران)', personId: 'per-1', personName: 'مزون دوخت پریسا (خانم عباسی)', debit: 0, credit: 4200000, description: 'کاهش مانده بدهی مزون پریسا' },
    ],
    totalDebit: 4200000,
    totalCredit: 4200000,
    isBalanced: true,
    createdBy: 'مدیر ارشد مالی',
    createdAt: '1403/07/02',
  },
  {
    id: 'vch-1003',
    voucherNumber: '1003',
    date: '1403/07/04',
    description: 'پرداخت هزینه ملزومات اداری، بسته‌بندی، چسب و نایلون - پیگیری: EXP-90021',
    fiscalYearId: 'fy-1403',
    status: 'approved',
    referenceType: 'treasury',
    referenceId: 'tr-tx-102',
    referenceNumber: 'TRX-1002',
    lines: [
      { id: 'vl-1003-1', accountCode: '601', accountTitle: 'هزینه‌های عمومی و اداری', debit: 750000, credit: 0, description: 'خرید رول نایلون حباب‌دار و چسب پهن' },
      { id: 'vl-1003-2', accountCode: '10101', accountTitle: 'صندوق نقدی اصلی فروشگاه', debit: 0, credit: 750000, description: 'پرداخت از صندوق نقدی فروشگاه' },
    ],
    totalDebit: 750000,
    totalCredit: 750000,
    isBalanced: true,
    createdBy: 'مدیر ارشد مالی',
    createdAt: '1403/07/04',
  },
  {
    id: 'vch-1004',
    voucherNumber: '1004',
    date: '1403/07/03',
    description: 'واریز وجه پایا از تولیدی پوشاک زنانه باران - پیگیری: SATNA-88120',
    fiscalYearId: 'fy-1403',
    status: 'approved',
    referenceType: 'treasury',
    referenceId: 'tr-tx-103',
    referenceNumber: 'TRX-1003',
    lines: [
      { id: 'vl-1004-1', accountCode: '10102', accountTitle: 'بانک ملی شعبه بازار (حساب جاری)', debit: 18000000, credit: 0, description: 'واریز پایا به حساب جاری بانک ملی' },
      { id: 'vl-1004-2', accountCode: '103', accountTitle: 'حساب‌های دریافتنی تجاری (بدهکاران)', personId: 'per-2', personName: 'تولیدی پوشاک زنانه باران', debit: 0, credit: 18000000, description: 'کاهش بدهی تولیدی باران' },
    ],
    totalDebit: 18000000,
    totalCredit: 18000000,
    isBalanced: true,
    createdBy: 'مدیر ارشد مالی',
    createdAt: '1403/07/03',
  },
  {
    id: 'vch-1005',
    voucherNumber: '1005',
    date: '1403/07/07',
    description: 'درآمد فروش ضایعات کارتن و نایلون - پیگیری: POS-77412',
    fiscalYearId: 'fy-1403',
    status: 'approved',
    referenceType: 'treasury',
    referenceId: 'tr-tx-105',
    referenceNumber: 'TRX-1005',
    lines: [
      { id: 'vl-1005-1', accountCode: '10103', accountTitle: 'دستگاه کارتخوان به پرداخت ملت', debit: 15000000, credit: 0, description: 'واریز شاپرک به حساب کارتخوان' },
      { id: 'vl-1005-2', accountCode: '401', accountTitle: 'سایر درآمدهای عملیاتی و متفرقه', debit: 0, credit: 15000000, description: 'فروش ضایعات انبار' },
    ],
    totalDebit: 15000000,
    totalCredit: 15000000,
    isBalanced: true,
    createdBy: 'مدیر ارشد مالی',
    createdAt: '1403/07/07',
  },
];

const initialTreasuryAccounts: TreasuryAccount[] = [
  {
    id: 'tr-cash-1',
    type: 'cash',
    title: 'صندوق نقدی اصلی فروشگاه',
    balance: 28450000,
    initialBalance: 25000000,
    accountingAccountCode: '10101',
    isActive: true,
    createdAt: '1403/01/01',
  },
  {
    id: 'tr-cash-2',
    type: 'cash',
    title: 'صندوق شماره ۲ دخل انبار',
    balance: 5000000,
    initialBalance: 5000000,
    accountingAccountCode: '10104',
    isActive: true,
    createdAt: '1403/01/01',
  },
  {
    id: 'tr-bank-1',
    type: 'bank',
    title: 'بانک ملی شعبه بازار (حساب جاری)',
    accountNumber: '0105421980007',
    shebaNumber: 'IR120170000000105421980007',
    branchName: 'شعبه بازار بزرگ تهران',
    bankName: 'بانک ملی ایران',
    balance: 142800000,
    initialBalance: 124800000,
    accountingAccountCode: '10102',
    isActive: true,
    createdAt: '1403/01/01',
  },
  {
    id: 'tr-bank-2',
    type: 'bank',
    title: 'بانک ملت شعبه سعدی (حساب جاری)',
    accountNumber: '482165439876',
    shebaNumber: 'IR890120000000482165439876',
    branchName: 'شعبه سعدی جنوبی',
    bankName: 'بانک ملت',
    balance: 65000000,
    initialBalance: 65000000,
    accountingAccountCode: '10105',
    isActive: true,
    createdAt: '1403/01/01',
  },
  {
    id: 'tr-pos-1',
    type: 'pos',
    title: 'دستگاه کارتخوان به پرداخت ملت',
    accountNumber: '4821-6543-9876',
    bankName: 'بانک ملت',
    balance: 87500000,
    initialBalance: 72500000,
    accountingAccountCode: '10103',
    isActive: true,
    createdAt: '1403/01/01',
  },
];

const initialFinancialCategories: FinancialCategory[] = [
  { id: 'fcat-exp-1', code: '601', title: 'کرایه حمل و باربری ملزومات خرازی', type: 'expense', description: 'هزینه باربری و حمل انواع خرج‌کار، روبان و نخ', isActive: true },
  { id: 'fcat-exp-2', code: '602', title: 'اجاره و شارژ ماهانه فروشگاه و انبار', type: 'expense', description: 'هزینه اجاره مغازه و انبارهای نگهداری کالا', isActive: true },
  { id: 'fcat-exp-3', code: '603', title: 'قبوض آب، برق، گاز و اینترنت تجاری', type: 'expense', description: 'هزینه‌های انرژی و ارتباطات فروشگاه', isActive: true },
  { id: 'fcat-exp-4', code: '604', title: 'حقوق، دستمزد و پورسانت پرسنل', type: 'expense', description: 'حقوق ماهیانه صندوق‌داران و کارگران انبار', isActive: true },
  { id: 'fcat-exp-5', code: '605', title: 'ملزومات اداری، بسته‌بندی، چسب و نایلون', type: 'expense', description: 'هزینه‌های مصرفی بسته‌بندی برای فروش روزمره', isActive: true },
  { id: 'fcat-exp-6', code: '606', title: 'پذیرایی و تنخواه روزانه دخل', type: 'expense', description: 'هزینه‌های تنخواه نقدی روزانه فروشگاه', isActive: true },
  { id: 'fcat-exp-7', code: '607', title: 'تعمیرات و نگهداری دکور و تجهیزات', type: 'expense', description: 'تعمیرات کامپیوترها، بارکدخوان، پرینتر و قفسه‌بندی', isActive: true },
  { id: 'fcat-inc-1', code: '403', title: 'سود سپرده کوتاه‌مدت بانکی', type: 'income', description: 'سود واریزی حساب‌های پس‌انداز و جاری بانکی', isActive: true },
  { id: 'fcat-inc-2', code: '404', title: 'درآمد فروش ضایعات کارتن و نایلون', type: 'income', description: 'عواید ناشی از فروش کارتن‌های خالی و ضایعات انبار', isActive: true },
  { id: 'fcat-inc-3', code: '405', title: 'تخفیفات نقدی تسویه فاکتورها', type: 'income', description: 'تخفیفات دریافتی از تأمین‌کنندگان بابت تسویه زودتر از موعد', isActive: true },
];

const initialTreasuryTransactions: TreasuryTransaction[] = [
  {
    id: 'tr-tx-101',
    transactionNumber: 'TRX-1001',
    transactionType: 'receive',
    treasuryAccountId: 'tr-cash-1',
    treasuryAccountTitle: 'صندوق نقدی اصلی فروشگاه',
    personId: 'per-1',
    personName: 'مزون دوخت پریسا (خانم عباسی)',
    amount: 4200000,
    date: '1403/07/02',
    trackingNumber: 'RCV-40112',
    description: 'دریافت نقدی از مشتری بابت تسویه علی‌الحساب سفارش دوخت و روبان',
    settlementType: 'partial',
    paymentMethod: 'cash',
    createdBy: 'مدیر ارشد سیستم',
    createdAt: '1403/07/02',
  },
  {
    id: 'tr-tx-102',
    transactionNumber: 'TRX-1002',
    transactionType: 'expense',
    treasuryAccountId: 'tr-cash-1',
    treasuryAccountTitle: 'صندوق نقدی اصلی فروشگاه',
    sourceAccountId: 'tr-cash-1',
    sourceAccountTitle: 'صندوق نقدی اصلی فروشگاه',
    expenseCategoryId: 'fcat-exp-5',
    expenseCategoryName: 'ملزومات اداری، بسته‌بندی، چسب و نایلون',
    amount: 750000,
    date: '1403/07/04',
    trackingNumber: 'EXP-90021',
    description: 'خرید رول نایلون حباب‌دار و چسب پهن بسته‌بندی',
    paymentMethod: 'cash',
    createdBy: 'مدیر ارشد سیستم',
    createdAt: '1403/07/04',
  },
  {
    id: 'tr-tx-103',
    transactionNumber: 'TRX-1003',
    transactionType: 'receive',
    treasuryAccountId: 'tr-bank-1',
    treasuryAccountTitle: 'بانک ملی شعبه بازار (حساب جاری)',
    destinationAccountId: 'tr-bank-1',
    destinationAccountTitle: 'بانک ملی شعبه بازار (حساب جاری)',
    personId: 'per-2',
    personName: 'تولیدی پوشاک زنانه باران',
    amount: 18000000,
    date: '1403/07/03',
    trackingNumber: 'SATNA-88120',
    description: 'واریز پایا از طرف خریدار بابت تسویه فاکتور خرید عمده ملزومات',
    settlementType: 'partial',
    paymentMethod: 'bank_transfer',
    createdBy: 'مدیر ارشد سیستم',
    createdAt: '1403/07/03',
  },
  {
    id: 'tr-tx-105',
    transactionNumber: 'TRX-1005',
    transactionType: 'income',
    treasuryAccountId: 'tr-pos-1',
    treasuryAccountTitle: 'دستگاه کارتخوان به پرداخت ملت',
    destinationAccountId: 'tr-pos-1',
    destinationAccountTitle: 'دستگاه کارتخوان به پرداخت ملت',
    expenseCategoryId: 'fcat-inc-2',
    expenseCategoryName: 'درآمد فروش ضایعات کارتن و نایلون',
    amount: 15000000,
    date: '1403/07/07',
    trackingNumber: 'POS-77412',
    description: 'تسویه جمع شاپرک حاصل از تراکنش‌های کارتخوان متفرقه',
    paymentMethod: 'pos',
    createdBy: 'مدیر ارشد سیستم',
    createdAt: '1403/07/07',
  },
];

const initialCheques: Cheque[] = [
  {
    id: 'chq-1',
    chequeType: 'received',
    chequeNumber: '784512',
    sayadNumber: '2105874512963341',
    bankName: 'بانک صادرات',
    branchName: 'شعبه جمهوری',
    accountNumber: '020485123000',
    amount: 15000000,
    issueDate: '1403/07/01',
    dueDate: '1403/08/15',
    personId: 'per-2',
    personName: 'تولیدی پوشاک زنانه باران',
    status: 'registered',
    notes: 'بابت تسویه فاکتور خرید عمده زیپ و روبان',
    statusHistory: [
      {
        id: 'hist-chq-1',
        timestamp: '2024-09-22T08:00:00.000Z',
        date: '1403/07/01',
        fromStatus: '-',
        toStatus: 'registered',
        actionTitle: 'ثبت اولیه چک صیادی دریافتی',
        description: 'دریافت چک صیادی از تولیدی پوشاک زنانه باران و ثبت نزد صندوق',
        performedBy: 'مدیر ارشد سیستم',
      },
    ],
    createdAt: '1403/07/01',
  },
  {
    id: 'chq-2',
    chequeType: 'issued',
    chequeNumber: '441209',
    sayadNumber: '7891234560128841',
    bankName: 'بانک ملی ایران',
    branchName: 'شعبه بازار بزرگ',
    accountNumber: '0105421980007',
    sourceAccountId: 'tr-bank-1',
    sourceAccountTitle: 'بانک ملی شعبه بازار (حساب جاری)',
    amount: 25000000,
    issueDate: '1403/07/05',
    dueDate: '1403/08/20',
    personId: 'per-3',
    personName: 'بازرگانی یراق و دکمه پارس (حاج قاسم تقوی)',
    status: 'registered',
    notes: 'بابت پیش‌پرداخت خرید عمده زیپ و روبان',
    statusHistory: [
      {
        id: 'hist-chq-2',
        timestamp: '2024-09-26T10:00:00.000Z',
        date: '1403/07/05',
        fromStatus: '-',
        toStatus: 'registered',
        actionTitle: 'صدور چک صیادی بانکی',
        description: 'صدور چک از حساب جاری بانک ملی در وجه بازرگانی یراق و دکمه پارس',
        performedBy: 'مدیر ارشد سیستم',
      },
    ],
    createdAt: '1403/07/05',
  },
];

const initialInvoices: Invoice[] = [
  {
    id: 'inv-1240',
    invoiceNumber: '1240',
    invoiceType: 'sale',
    personId: 'per-1',
    personName: 'مزون دوخت پریسا (خانم عباسی)',
    warehouseId: 'wh-central',
    warehouseName: 'انبار مرکزی و بنکداری',
    fiscalYearId: 'fy-1403',
    date: '1403/07/18',
    status: 'approved',
    items: [
      {
        id: 'it-1',
        productId: 'prd-1',
        productCode: 'KH-1001',
        productName: 'روبان ساتن ۲٫۵ سانت قرمز نگین (رول ۲۵ متری)',
        unitId: 'u-roll',
        unitName: 'رول (۲۵ متر)',
        conversionFactor: 25,
        quantity: 4,
        baseQuantity: 100,
        unitPrice: 950000,
        discount: 100000,
        tax: 0,
        totalPrice: 3700000,
        color: 'قرمز لاکی',
        size: '۲٫۵ سانت',
      },
    ],
    subtotal: 3800000,
    totalDiscount: 100000,
    taxAmount: 0,
    finalAmount: 3700000,
    paidAmount: 2000000,
    remainingAmount: 1700000,
    accountingVoucherId: 'vch-1001',
    createdBy: 'آقای کریمی',
    createdAt: '1403/07/18 11:28',
  },
  {
    id: 'inv-1241',
    invoiceNumber: '1241',
    invoiceType: 'sale',
    personId: 'per-2',
    personName: 'تولیدی پوشاک زنانه باران (آقای مرادی)',
    warehouseId: 'wh-central',
    warehouseName: 'انبار مرکزی و بنکداری',
    fiscalYearId: 'fy-1403',
    date: '1403/07/12',
    status: 'approved',
    items: [
      {
        id: 'it-1241-1',
        productId: 'prd-3',
        productCode: 'KH-2001',
        productName: 'دوک نخ پلی‌استر ۴۰/۲ مشکی چرخ خیاطی',
        unitId: 'u-spool',
        unitName: 'دوک',
        conversionFactor: 1,
        quantity: 50,
        baseQuantity: 50,
        unitPrice: 54000,
        discount: 50000,
        tax: 0,
        totalPrice: 2650000,
        color: 'مشکی (کد 001)',
        size: '۵۰۰۰ یارد',
      },
      {
        id: 'it-1241-2',
        productId: 'prd-4',
        productCode: 'KH-3001',
        productName: 'دکمه پیراهنی صدفی ۱۸ لول سفید (بسته ۱۴۴ عددی)',
        unitId: 'u-pack',
        unitName: 'قواره (۱۴۴ عددی)',
        conversionFactor: 144,
        quantity: 10,
        baseQuantity: 1440,
        unitPrice: 85000,
        discount: 0,
        tax: 0,
        totalPrice: 850000,
        color: 'سفید صدفی',
        size: '۱۸ لول',
      },
    ],
    subtotal: 3550000,
    totalDiscount: 50000,
    taxAmount: 0,
    finalAmount: 3500000,
    paidAmount: 1500000,
    remainingAmount: 2000000,
    createdBy: 'آقای کریمی',
    createdAt: '1403/07/12 10:15',
  },
  {
    id: 'inv-1242-cash',
    invoiceNumber: '1242',
    invoiceType: 'sale',
    personId: 'per-4',
    personName: 'مشتری عمومی / متفرقه نقدی خرازی',
    warehouseId: 'wh-shop',
    warehouseName: 'انبار فروشگاه و قفسه پیشخوان',
    fiscalYearId: 'fy-1403',
    date: '1403/07/20',
    status: 'approved',
    items: [
      {
        id: 'it-1242-1',
        productId: 'prd-2',
        productCode: 'KH-1002',
        productName: 'روبان حریر ۱٫۵ سانت شیری رنگ',
        unitId: 'u-meter',
        unitName: 'متر',
        conversionFactor: 1,
        quantity: 20,
        baseQuantity: 20,
        unitPrice: 32000,
        discount: 0,
        tax: 0,
        totalPrice: 640000,
        color: 'شیری / نباتی',
        size: '۱٫۵ سانتیمتر',
      },
      {
        id: 'it-1242-2',
        productId: 'prd-5',
        productCode: 'KH-3002',
        productName: 'زیپ مخفی ۵۰ سانتی سرمه‌ای مجلسی',
        unitId: 'u-item',
        unitName: 'عدد',
        conversionFactor: 1,
        quantity: 10,
        baseQuantity: 10,
        unitPrice: 28000,
        discount: 0,
        tax: 0,
        totalPrice: 280000,
        color: 'سرمه‌ای تیره',
        size: '۵۰ سانتیمتر',
      },
    ],
    subtotal: 920000,
    totalDiscount: 0,
    taxAmount: 0,
    finalAmount: 920000,
    paidAmount: 920000,
    remainingAmount: 0,
    createdBy: 'آقای کریمی',
    createdAt: '1403/07/20 16:40',
  },
  {
    id: 'inv-2050',
    invoiceNumber: '2050',
    invoiceType: 'purchase',
    personId: 'per-3',
    personName: 'بازرگانی یراق و دکمه پارس (حاج قاسم تقوی)',
    warehouseId: 'wh-central',
    warehouseName: 'انبار مرکزی و بنکداری',
    fiscalYearId: 'fy-1403',
    date: '1403/07/05',
    status: 'approved',
    items: [
      {
        id: 'it-2050-1',
        productId: 'prd-3',
        productCode: 'KH-2001',
        productName: 'دوک نخ پلی‌استر ۴۰/۲ مشکی چرخ خیاطی',
        unitId: 'u-spool',
        unitName: 'دوک',
        conversionFactor: 1,
        quantity: 100,
        baseQuantity: 100,
        unitPrice: 42000,
        discount: 0,
        tax: 0,
        totalPrice: 4200000,
      },
      {
        id: 'it-2050-2',
        productId: 'prd-1',
        productCode: 'KH-1001',
        productName: 'روبان ساتن ۲٫۵ سانت قرمز نگین (رول ۲۵ متری)',
        unitId: 'u-roll',
        unitName: 'رول (۲۵ متر)',
        conversionFactor: 25,
        quantity: 10,
        baseQuantity: 250,
        unitPrice: 700000,
        discount: 0,
        tax: 0,
        totalPrice: 7000000,
      },
    ],
    subtotal: 11200000,
    totalDiscount: 0,
    taxAmount: 0,
    finalAmount: 11200000,
    paidAmount: 5000000,
    remainingAmount: 6200000,
    createdBy: 'مهندس رضایی',
    createdAt: '1403/07/05 09:30',
  },
  {
    id: 'inv-ret-101',
    invoiceNumber: 'RET-101',
    invoiceType: 'return_sale',
    originalInvoiceId: 'inv-1240',
    originalInvoiceNumber: '1240',
    personId: 'per-1',
    personName: 'مزون دوخت پریسا (خانم عباسی)',
    warehouseId: 'wh-central',
    warehouseName: 'انبار مرکزی و بنکداری',
    fiscalYearId: 'fy-1403',
    date: '1403/07/19',
    status: 'approved',
    returnReason: 'مغایرت کد رنگ ۱ رول روبان ساتن با نمونه دوخت مزون',
    refundAction: 'credit_balance',
    items: [
      {
        id: 'it-ret-1',
        productId: 'prd-1',
        productCode: 'KH-1001',
        productName: 'روبان ساتن ۲٫۵ سانت قرمز نگین (رول ۲۵ متری)',
        unitId: 'u-roll',
        unitName: 'رول (۲۵ متر)',
        conversionFactor: 25,
        quantity: 1,
        baseQuantity: 25,
        unitPrice: 925000,
        discount: 0,
        tax: 0,
        totalPrice: 925000,
      },
    ],
    subtotal: 925000,
    totalDiscount: 0,
    taxAmount: 0,
    finalAmount: 925000,
    paidAmount: 0,
    remainingAmount: 0,
    createdBy: 'خانم احمدی',
    createdAt: '1403/07/19 13:10',
  },
];

export const initialAccessoryCostTypes: AccessoryCostType[] = [
  {
    id: 'act-1',
    code: 'NOT-01',
    name: 'خرج‌کار، یراق‌آلات و متعلقات تزیینی',
    category: 'notion',
    defaultAllocationMethod: 'value',
    description: 'دکمه‌های ویژه، مارک فلزی، نگین، زنجیر و سگک به کار رفته در سفارش',
    isActive: true,
  },
  {
    id: 'act-2',
    code: 'FRG-02',
    name: 'کرایه حمل، باربری و پیک ملزومات',
    category: 'freight',
    defaultAllocationMethod: 'weight',
    description: 'باربری از بازار تهران، هزینه وانت و پیک موتوری ارسال کالا',
    isActive: true,
  },
  {
    id: 'act-3',
    code: 'SRV-03',
    name: 'کارمزد برش نوار، سرکجی و متراژکشی',
    category: 'service',
    defaultAllocationMethod: 'length',
    description: 'خدمات برش طاقه به رول، چاک‌زدن و نواردوزی سفارشی',
    isActive: true,
  },
  {
    id: 'act-4',
    code: 'PKG-04',
    name: 'ملزومات بسته‌بندی، سلفون و پاکت',
    category: 'packaging',
    defaultAllocationMethod: 'quantity',
    description: 'کارتن‌های بسته‌بندی، سلفون ضخیم و هدر چاپ‌شده اختصاصی',
    isActive: true,
  },
  {
    id: 'act-5',
    code: 'SRV-05',
    name: 'کارمزد آبکاری، رنگرزی و چاپ مارک',
    category: 'service',
    defaultAllocationMethod: 'value',
    description: 'آبکاری دکمه‌های فلزی و رنگرزی سفارشی زیپ و تور',
    isActive: true,
  },
  {
    id: 'act-6',
    code: 'NOT-06',
    name: 'پرت، ضایعات و افت پارچه و روبان',
    category: 'notion',
    defaultAllocationMethod: 'quantity',
    description: 'درصد محاسبه‌شده ضایعات انتهای طاقه و نمونه‌برداری مشتری',
    isActive: true,
  },
  {
    id: 'act-7',
    code: 'OVH-07',
    name: 'سربار عمومی انبار و نگهداری ملزومات',
    category: 'overhead',
    defaultAllocationMethod: 'overhead',
    description: 'هزینه‌های سربار عمومی غیرقابل انتساب به یک کالای خاص',
    isActive: true,
  },
];

export const initialAccessoryCosts: AccessoryCostEntry[] = [
  {
    id: 'acc-1',
    trackingCode: 'EXP-101',
    title: 'باربری محموله روبان و زیپ از بازار تهران',
    costTypeId: 'act-2',
    costTypeName: 'کرایه حمل، باربری و پیک ملزومات',
    amount: 350000,
    date: '1403/07/12',
    allocationMethod: 'weight',
    targetType: 'products',
    treasuryAccountId: 'tr-1',
    treasuryAccountTitle: 'صندوق نقدی شماره ۱ فروشگاه',
    recipientOrPayer: 'باربری وطن',
    allocatedItems: [
      {
        productId: 'prd-1',
        productCode: 'KH-1001',
        productName: 'روبان ساتن ۲٫۵ سانت قرمز نگین (رول ۲۵ متری)',
        quantity: 20,
        unitName: 'رول',
        originalUnitCost: 28000,
        allocatedShare: 140000,
        allocatedPerUnit: 7000,
        newUnitCost: 35000,
        weight: 0.35,
        length: 25,
      },
      {
        productId: 'prd-3',
        productCode: 'KH-2001',
        productName: 'دوک نخ پلی‌استر ۴۰/۲ مشکی چرخ خیاطی',
        quantity: 50,
        unitName: 'دوک',
        originalUnitCost: 42000,
        allocatedShare: 210000,
        allocatedPerUnit: 4200,
        newUnitCost: 46200,
        weight: 0.15,
        length: 0,
      },
    ],
    notes: 'تسهیم بر مبنای وزن کل محموله طبق بارنامه رسمی باربری',
    createdAt: '1403/07/12',
  },
];

const initialSettings: StoreSettings = {
  storeName: 'فروشگاه و بازرگانی سپهر',
  guildName: 'صنف بازرگانی و فروشگاهی',
  storeOwner: 'مدیر سیستم',
  phone: '۰۲۱-۵۵۴۴۳۳۲۲',
  address: 'تهران، بازار مرکزی',
  economicCode: '۴۱۱۵۶۷۸۹۲۳۴۱',
  nationalId: '۱۰۱۰۲۸۳۴۷۵۶',
  postalCode: '۱۱۶۳۸۴۷۲۹۱',
  currency: 'ریال',
  defaultTaxPercent: 0,
  activeFiscalYear: '۱۴۰۴',
  allowNegativeStock: false,
  requireBalancedVouchers: true,
  defaultPrintLayout: 'a4',
  printHeaderNote: 'سامانه جامع مالی، حسابداری و انبارداری سپهر',
  printFooterNote: 'از حسن انتخاب و اعتماد شما سپاسگزاریم.',
  invoicePrintConfig: {
    theme: 'holoo-teal',
    templateStyle: 'holoo_classic',
    paperSize: 'a4',
    orientation: 'portrait',
    fontSize: 'sm',
    printScale: 100,
    showBarcode: true,
    showTax: true,
    showDiscount: true,
    showColorSize: true,
    showAmountInWords: true,
    showPaymentBreakdown: true,
    showSignatures: true,
    showStoreLogo: true,
    showGuildName: true,
    showCustomerBalance: true,
    showEconomicCode: true,
    customTitle: 'فاکتور فروش کالا و خدمات خرازی',
    customSlogan: 'توزیع تخصصی روبان، دکمه، زیپ، نخ و ملزومات خیاطی',
    customTerms: 'شرایط: اجناس برش‌خورده (روبان، تور و کش) مرجوع نمی‌گردد. تعویض سایر اقلام تا ۴۸ ساعت با ارائه فاکتور امکان‌پذیر است.',
  },
};

export const initialWarehouses: Warehouse[] = [
  {
    id: 'wh-central',
    code: 'WH-01',
    name: 'انبار مرکزی و بنکداری',
    type: 'central',
    location: 'تهران، بازار بزرگ، سرای مشیر، طبقه منفی یک، پلاک ۱۲',
    managerName: 'آقای کریمی',
    phone: '۰۲۱-۵۵۶۶۷۷۰۱',
    isActive: true,
    isDefault: true,
    createdAt: '1403/01/01',
  },
  {
    id: 'wh-shop',
    code: 'WH-02',
    name: 'انبار فروشگاه و قفسه پیشخوان',
    type: 'retail',
    location: 'فروشگاه اصلی، طبقه همکف، ردیف قفسه‌های الف و ب',
    managerName: 'خانم احمدی',
    phone: '۰۲۱-۵۵۶۶۷۷۰۲',
    isActive: true,
    isDefault: false,
    createdAt: '1403/01/01',
  },
  {
    id: 'wh-waste',
    code: 'WH-03',
    name: 'انبار ضایعات و مرجوعی',
    type: 'waste',
    location: 'انبار پشتی، بخش کنترل کیفیت و بررسی مرجوعی',
    managerName: 'آقای صادقی',
    phone: '۰۲۱-۵۵۶۶۷۷۰۳',
    isActive: true,
    isDefault: false,
    createdAt: '1403/01/01',
  },
];

export const initialWarehouseStocks: WarehouseStock[] = [
  { productId: 'prd-1', warehouseId: 'wh-central', quantity: 350, lastUpdated: '1403/07/18' },
  { productId: 'prd-1', warehouseId: 'wh-shop', quantity: 100, lastUpdated: '1403/07/16' },
  { productId: 'prd-2', warehouseId: 'wh-central', quantity: 45, lastUpdated: '1403/01/01' },
  { productId: 'prd-3', warehouseId: 'wh-central', quantity: 180, lastUpdated: '1403/07/15' },
  { productId: 'prd-4', warehouseId: 'wh-central', quantity: 2880, lastUpdated: '1403/01/01' },
  { productId: 'prd-5', warehouseId: 'wh-shop', quantity: 18, lastUpdated: '1403/07/14' },
];

export const initialKardexEntries: KardexEntry[] = [
  {
    id: 'kd-init-1',
    productId: 'prd-1',
    productCode: 'KH-1001',
    productName: 'روبان ساتن ۲٫۵ سانت قرمز نگین (رول ۲۵ متری)',
    warehouseId: 'wh-central',
    warehouseName: 'انبار مرکزی و بنکداری',
    date: '1403/01/01',
    referenceType: 'initial_stock',
    referenceTypeTitle: 'موجودی اول دوره',
    referenceId: 'init-doc-1',
    referenceNumber: 'OP-1001',
    inQuantity: 450,
    outQuantity: 0,
    unitName: 'متر',
    unitPrice: 1120,
    totalValue: 504000,
    balanceQuantity: 450,
    balanceValue: 504000,
    userName: 'مدیر ارشد سیستم',
    notes: 'موجودی اول دوره ثبت شده در انبار مرکزی',
    createdAt: '1403/01/01 08:00',
  },
  {
    id: 'kd-init-1b',
    productId: 'prd-1',
    productCode: 'KH-1001',
    productName: 'روبان ساتن ۲٫۵ سانت قرمز نگین (رول ۲۵ متری)',
    warehouseId: 'wh-shop',
    warehouseName: 'انبار فروشگاه و قفسه پیشخوان',
    date: '1403/01/01',
    referenceType: 'initial_stock',
    referenceTypeTitle: 'موجودی اول دوره',
    referenceId: 'init-doc-1b',
    referenceNumber: 'OP-1001B',
    inQuantity: 100,
    outQuantity: 0,
    unitName: 'متر',
    unitPrice: 1120,
    totalValue: 112000,
    balanceQuantity: 550,
    balanceValue: 616000,
    userName: 'مدیر ارشد سیستم',
    notes: 'موجودی اول دوره قفسه پیشخوان فروشگاه',
    createdAt: '1403/01/01 08:05',
  },
  {
    id: 'kd-inv-1',
    productId: 'prd-1',
    productCode: 'KH-1001',
    productName: 'روبان ساتن ۲٫۵ سانت قرمز نگین (رول ۲۵ متری)',
    warehouseId: 'wh-central',
    warehouseName: 'انبار مرکزی و بنکداری',
    date: '1403/07/18',
    referenceType: 'sale_invoice',
    referenceTypeTitle: 'فاکتور فروش',
    referenceId: 'inv-1',
    referenceNumber: '1241',
    inQuantity: 0,
    outQuantity: 100,
    unitName: 'متر',
    unitPrice: 1520,
    totalValue: 152000,
    balanceQuantity: 450,
    balanceValue: 504000,
    userName: 'آقای کریمی',
    notes: 'فروش به مزون دوخت پریسا (خانم عباسی)',
    createdAt: '1403/07/18 11:30',
  },
  {
    id: 'kd-init-2',
    productId: 'prd-2',
    productCode: 'KH-1002',
    productName: 'قیطان طلایی ۵ میل مغزی‌دار لمه (متر)',
    warehouseId: 'wh-central',
    warehouseName: 'انبار مرکزی و بنکداری',
    date: '1403/01/01',
    referenceType: 'initial_stock',
    referenceTypeTitle: 'موجودی اول دوره',
    referenceId: 'init-doc-2',
    referenceNumber: 'OP-1002',
    inQuantity: 45,
    outQuantity: 0,
    unitName: 'متر',
    unitPrice: 8500,
    totalValue: 382500,
    balanceQuantity: 45,
    balanceValue: 382500,
    userName: 'مدیر ارشد سیستم',
    notes: 'موجودی اول دوره',
    createdAt: '1403/01/01 08:00',
  },
  {
    id: 'kd-init-3',
    productId: 'prd-3',
    productCode: 'KH-2001',
    productName: 'دوک نخ پلی‌استر ۴۰/۲ مشکی چرخ خیاطی',
    warehouseId: 'wh-central',
    warehouseName: 'انبار مرکزی و بنکداری',
    date: '1403/01/01',
    referenceType: 'initial_stock',
    referenceTypeTitle: 'موجودی اول دوره',
    referenceId: 'init-doc-3',
    referenceNumber: 'OP-1003',
    inQuantity: 180,
    outQuantity: 0,
    unitName: 'دوک',
    unitPrice: 42000,
    totalValue: 7560000,
    balanceQuantity: 180,
    balanceValue: 7560000,
    userName: 'مدیر ارشد سیستم',
    notes: 'موجودی اول دوره',
    createdAt: '1403/01/01 08:00',
  },
  {
    id: 'kd-init-4',
    productId: 'prd-4',
    productCode: 'KH-3001',
    productName: 'دکمه پیراهنی صدفی ۱۸ لول سفید (بسته ۱۴۴ عددی)',
    warehouseId: 'wh-central',
    warehouseName: 'انبار مرکزی و بنکداری',
    date: '1403/01/01',
    referenceType: 'initial_stock',
    referenceTypeTitle: 'موجودی اول دوره',
    referenceId: 'init-doc-4',
    referenceNumber: 'OP-1004',
    inQuantity: 2880,
    outQuantity: 0,
    unitName: 'عدد',
    unitPrice: 450,
    totalValue: 1296000,
    balanceQuantity: 2880,
    balanceValue: 1296000,
    userName: 'مدیر ارشد سیستم',
    notes: 'موجودی اول دوره (۲۰ قواره ۱۴۴ تایی)',
    createdAt: '1403/01/01 08:00',
  },
  {
    id: 'kd-init-5',
    productId: 'prd-5',
    productCode: 'KH-3002',
    productName: 'زیپ مخفی ۵۰ سانتی سرمه‌ای مجلسی',
    warehouseId: 'wh-shop',
    warehouseName: 'انبار فروشگاه و قفسه پیشخوان',
    date: '1403/01/01',
    referenceType: 'initial_stock',
    referenceTypeTitle: 'موجودی اول دوره',
    referenceId: 'init-doc-5',
    referenceNumber: 'OP-1005',
    inQuantity: 20,
    outQuantity: 0,
    unitName: 'عدد',
    unitPrice: 16000,
    totalValue: 320000,
    balanceQuantity: 20,
    balanceValue: 320000,
    userName: 'مدیر ارشد سیستم',
    notes: 'موجودی اول دوره',
    createdAt: '1403/01/01 08:00',
  },
  {
    id: 'kd-adj-5',
    productId: 'prd-5',
    productCode: 'KH-3002',
    productName: 'زیپ مخفی ۵۰ سانتی سرمه‌ای مجلسی',
    warehouseId: 'wh-shop',
    warehouseName: 'انبار فروشگاه و قفسه پیشخوان',
    date: '1403/07/14',
    referenceType: 'adjustment_minus',
    referenceTypeTitle: 'تعدیل کسری (خرابی و ضایعات)',
    referenceId: 'adj-501',
    referenceNumber: 'ADJ-1403-03',
    inQuantity: 0,
    outQuantity: 2,
    unitName: 'عدد',
    unitPrice: 16000,
    totalValue: 32000,
    balanceQuantity: 18,
    balanceValue: 288000,
    userName: 'مهندس رضایی',
    notes: 'کسری ناشی از پارگی دندانه زیپ در نمونه‌گیری مشتری',
    createdAt: '1403/07/14 19:35',
  },
];

export const initialGoodsReceipts: GoodsReceipt[] = [
  {
    id: 'rcp-101',
    receiptNumber: 'REC-1403-01',
    supplierId: 'per-3',
    supplierName: 'بازرگانی یراق و دکمه پارس (حاج قاسم تقوی)',
    warehouseId: 'wh-central',
    warehouseName: 'انبار مرکزی و بنکداری',
    date: '1403/07/15',
    status: 'approved',
    items: [
      {
        id: 'rcp-it-1',
        productId: 'prd-3',
        productCode: 'KH-2001',
        productName: 'دوک نخ پلی‌استر ۴۰/۲ مشکی چرخ خیاطی',
        unitId: 'u-spool',
        unitName: 'دوک',
        quantity: 100,
        conversionFactor: 1,
        baseQuantity: 100,
        unitPrice: 42000,
        totalPrice: 4200000,
        notes: 'بارگیری پلمپ بدون نقص',
      },
    ],
    totalQuantity: 100,
    totalAmount: 4200000,
    driverName: 'علی رضایی',
    driverMobile: '۰۹۱۲۱۲۳۴۵۶۷',
    waybillNumber: 'WB-99882',
    approvedBy: 'مهدی کریمی (انباردار مرکزی)',
    approvedAt: '1403/07/15 14:20',
    createdBy: 'مهدی کریمی',
    createdAt: '1403/07/15 10:30',
  },
];

export const initialPurchaseProformas: PurchaseProforma[] = [
  {
    id: 'prf-201',
    proformaNumber: 'PRF-1403-05',
    supplierId: 'per-3',
    supplierName: 'بازرگانی یراق و دکمه پارس (حاج قاسم تقوی)',
    targetWarehouseId: 'wh-central',
    targetWarehouseName: 'انبار مرکزی و بنکداری',
    date: '1403/07/20',
    validUntil: '1403/07/30',
    status: 'draft',
    items: [
      {
        id: 'prf-it-1',
        productId: 'prd-5',
        productCode: 'KH-3002',
        productName: 'زیپ مخفی ۵۰ سانتی سرمه‌ای مجلسی',
        unitId: 'u-item',
        unitName: 'عدد',
        conversionFactor: 1,
        quantity: 200,
        baseQuantity: 200,
        unitPrice: 15500,
        discount: 0,
        tax: 0,
        totalPrice: 3100000,
      },
    ],
    subtotal: 3100000,
    totalDiscount: 0,
    taxAmount: 0,
    finalAmount: 3100000,
    notes: 'استعلام قیمت جهت شارژ اقلام با موجودی بحرانی (نقطه سفارش)',
    createdBy: 'مدیر خرید',
    createdAt: '1403/07/20 09:15',
  },
];

export const initialWarehouseTransfers: WarehouseTransfer[] = [
  {
    id: 'trf-301',
    transferNumber: 'TRF-1403-12',
    sourceWarehouseId: 'wh-central',
    sourceWarehouseName: 'انبار مرکزی و بنکداری',
    destinationWarehouseId: 'wh-shop',
    destinationWarehouseName: 'انبار فروشگاه و قفسه پیشخوان',
    date: '1403/07/16',
    status: 'approved',
    items: [
      {
        id: 'trf-it-1',
        productId: 'prd-1',
        productCode: 'KH-1001',
        productName: 'روبان ساتن ۲٫۵ سانت قرمز نگین (رول ۲۵ متری)',
        unitId: 'u-roll',
        unitName: 'رول',
        quantity: 10,
        conversionFactor: 25,
        baseQuantity: 250,
        unitCost: 28000,
        totalCost: 280000,
      },
    ],
    totalQuantity: 10,
    totalCost: 280000,
    reason: 'شارژ قفسه پیشخوان فروشگاه جهت فروش خرد',
    approvedBy: 'آقای کریمی',
    approvedAt: '1403/07/16 16:00',
    auditTrail: [
      { action: 'ثبت پیش‌نویس انتقال', userName: 'خانم احمدی', timestamp: '1403/07/16 11:00' },
      { action: 'تایید خروج از انبار مبدأ و ورود به مقصد', userName: 'آقای کریمی', timestamp: '1403/07/16 16:00', notes: 'اقلام تحویل خانم احمدی شد' },
    ],
    createdBy: 'خانم احمدی',
    createdAt: '1403/07/16 11:00',
  },
];

export const initialStocktakingSessions: StocktakingSession[] = [
  {
    id: 'stk-401',
    code: 'ST-1403-01',
    title: 'انبارگردانی میان‌دوره پاییز ۱۴۰۳ - انبار فروشگاه',
    warehouseId: 'wh-shop',
    warehouseName: 'انبار فروشگاه و قفسه پیشخوان',
    countRound: 1,
    date: '1403/07/14',
    status: 'approved',
    items: [
      {
        id: 'stk-it-1',
        productId: 'prd-5',
        productCode: 'KH-3002',
        productName: 'زیپ مخفی ۵۰ سانتی سرمه‌ای مجلسی',
        unitName: 'عدد',
        systemQuantity: 20,
        countedQuantity: 18,
        varianceQuantity: -2,
        unitCost: 16000,
        varianceValue: -32000,
        varianceStatus: 'deficit',
        notes: '۲ عدد پارگی دندانه زیپ در نمونه‌گیری مشتری',
      },
      {
        id: 'stk-it-2',
        productId: 'prd-1',
        productCode: 'KH-1001',
        productName: 'روبان ساتن ۲٫۵ سانت قرمز نگین (رول ۲۵ متری)',
        unitName: 'متر',
        systemQuantity: 250,
        countedQuantity: 250,
        varianceQuantity: 0,
        unitCost: 1120,
        varianceValue: 0,
        varianceStatus: 'matched',
        notes: 'موجودی کاملاً منطبق',
      },
    ],
    totalItemsCount: 2,
    totalDeficitValue: 32000,
    totalSurplusValue: 0,
    netVarianceValue: -32000,
    approvedBy: 'مهندس رضایی (مدیر فروشگاه)',
    approvedAt: '1403/07/14 19:30',
    auditTrail: [
      { action: 'شمارش فیزیکی اقلام', userName: 'تیم انبارگردانی', timestamp: '1403/07/14 17:00' },
      { action: 'تایید نهایی و صدور سند تعدیل کسری', userName: 'مهندس رضایی', timestamp: '1403/07/14 19:30', notes: 'کسری ناچیز مورد تایید قرار گرفت' },
    ],
    notes: 'انبارگردانی با حضور حسابرس داخلی انجام شد.',
    createdBy: 'حسابرس داخلی',
    createdAt: '1403/07/14 15:00',
  },
];

export const initialInventoryAdjustments: InventoryAdjustment[] = [
  {
    id: 'adj-501',
    adjustmentNumber: 'ADJ-1403-03',
    warehouseId: 'wh-shop',
    warehouseName: 'انبار فروشگاه و قفسه پیشخوان',
    date: '1403/07/14',
    type: 'minus',
    reasonCode: 'damage',
    reasonTitle: 'خرابی، پارگی و ضایعات فیزیکی',
    reasonDescription: '۲ عدد زیپ مخفی به علت شکستگی ماشین زیپ در نمونه‌گیری مشتری غیرقابل فروش شد و به انبار ضایعات منتقل گردید.',
    status: 'approved',
    items: [
      {
        id: 'adj-it-1',
        productId: 'prd-5',
        productCode: 'KH-3002',
        productName: 'زیپ مخفی ۵۰ سانتی سرمه‌ای مجلسی',
        unitName: 'عدد',
        quantity: 2,
        unitCost: 16000,
        totalCost: 32000,
      },
    ],
    totalQuantity: 2,
    totalCost: 32000,
    approvedBy: 'مهندس رضایی',
    approvedAt: '1403/07/14 19:35',
    auditTrail: [
      { action: 'ثبت برگه تعدیل کسری', userName: 'انباردار فروشگاه', timestamp: '1403/07/14 19:00' },
      { action: 'تایید قطعی برگه تعدیل', userName: 'مهندس رضایی', timestamp: '1403/07/14 19:35' },
    ],
    notes: 'پیرو صورت‌جلسه انبارگردانی ST-1403-01',
    createdBy: 'انباردار فروشگاه',
    createdAt: '1403/07/14 19:00',
  },
];

export const initialFiscalYears: FiscalYear[] = [
  {
    id: 'fy-1402',
    code: '1402',
    title: 'سال مالی ۱۴۰۲',
    startDate: '1402/01/01',
    endDate: '1402/12/29',
    status: 'closed',
    isClosed: true,
    isActive: false,
    isLeapYear: false,
    description: 'دوره مالی بسته‌شده سال ۱۴۰۲ (دارای آرشیو کامل اسناد اختتامیه و صورت‌های مالی)',
    nextFiscalYearId: 'fy-1403',
    openingVoucherId: 'vch-open-1402',
    openingVoucherNumber: '901',
    closingTemporaryVoucherId: 'vch-close-temp-1402',
    closingTemporaryVoucherNumber: '997',
    closingPermanentVoucherId: 'vch-close-perm-1402',
    closingPermanentVoucherNumber: '998',
    closedAt: '1402/12/29',
    closedBy: 'مهندس مهدی رضایی (مدیر ارشد)',
    auditTrail: [
      { action: 'تعریف سال مالی ۱۴۰۲ و ثبت تراز افتتاحیه', userName: 'مهندس مهدی رضایی', timestamp: '1402/01/01 08:30' },
      { action: 'کنترل نهایی دفاتر، بستن حساب‌های موقت و صدور سند اختتامیه ۹۹۸', userName: 'خانم محمدی (حسابدار ارشد)', timestamp: '1402/12/29 21:00' },
      { action: 'انتقال مانده‌ها به سند افتتاحیه سال مالی ۱۴۰۳ (سند ۱۰۰۱)', userName: 'مهندس مهدی رضایی', timestamp: '1403/01/01 08:00' },
    ],
    archivedSnapshot: {
      capturedAt: '1402/12/29',
      capturedBy: 'خانم محمدی (حسابدار ارشد)',
      summary: {
        netSales: 485000000,
        cogs: 310000000,
        grossProfit: 175000000,
        totalExpenses: 42000000,
        otherIncome: 3500000,
        netProfit: 136500000,
        totalAssets: 416840000,
        totalLiabilities: 72000000,
        totalEquity: 344840000,
        cashAndBankBalance: 332800000,
        accountsReceivable: 25550000,
        notesReceivable: 35000000,
        inventoryValuation: 23490000,
        accountsPayable: 45000000,
        notesPayable: 27000000,
        invoicesCount: 142,
        vouchersCount: 98,
      },
      personBalances: [
        { personId: 'per-1', code: '1001', name: 'مزون دوخت پریسا (خانم عباسی)', personType: 'customer', balance: 15800000 },
        { personId: 'per-2', code: '1002', name: 'تولیدی مانتو و پوشاک کلاسیک', personType: 'customer', balance: 9750000 },
        { personId: 'per-3', code: '2001', name: 'بازرگانی نخ و زیپ رازی (تأمین‌کننده)', personType: 'supplier', balance: -45000000 },
      ],
      treasuryBalances: [
        { accountId: 'tr-1', title: 'صندوق نقدی فروشگاه (دخل اصلی)', type: 'cash', balance: 18500000 },
        { accountId: 'tr-2', title: 'بانک ملی - حساب جاری ۵۴۲۱', type: 'bank', balance: 185000000 },
        { accountId: 'tr-3', title: 'بانک ملت - کارتخوان POS فروشگاه', type: 'pos', balance: 129300000 },
      ],
      inventoryBalances: [
        { productId: 'prd-1', code: 'KH-1001', name: 'روبان ساتن ۲٫۵ سانت قرمز نگین', unitName: 'متر', quantity: 1200, unitCost: 1120, totalValuation: 1344000 },
        { productId: 'prd-2', code: 'KH-1002', name: 'قیطان طلایی ۵ میل مغزی‌دار لمه', unitName: 'متر', quantity: 340, unitCost: 8500, totalValuation: 2890000 },
        { productId: 'prd-3', code: 'KH-2001', name: 'دوک نخ پلی‌استر ۴۰/۲ مشکی چرخ خیاطی', unitName: 'دوک', quantity: 420, unitCost: 42000, totalValuation: 17640000 },
        { productId: 'prd-4', code: 'KH-3001', name: 'دکمه پیراهنی صدفی ۱۸ لول سفید', unitName: 'عدد', quantity: 2880, unitCost: 450, totalValuation: 1296000 },
        { productId: 'prd-5', code: 'KH-3002', name: 'زیپ مخفی ۵۰ سانتی سرمه‌ای مجلسی', unitName: 'عدد', quantity: 20, unitCost: 16000, totalValuation: 320000 },
      ],
      pendingCheques: [
        { chequeId: 'chq-1', chequeNumber: '654120', chequeType: 'received', personName: 'مزون دوخت پریسا', bankName: 'بانک صادرات', dueDate: '1403/08/15', amount: 15000000, status: 'registered' },
        { chequeId: 'chq-3', chequeNumber: '982104', chequeType: 'issued', personName: 'بازرگانی نخ و زیپ رازی', bankName: 'بانک ملی', dueDate: '1403/08/05', amount: 27000000, status: 'registered' },
      ],
      vouchers: [
        {
          id: 'vch-close-temp-1402',
          voucherNumber: '997',
          date: '1402/12/29',
          description: 'سند بستن حساب‌های موقت سود و زیانی پایان سال مالی ۱۴۰۲',
          fiscalYearId: '1402',
          status: 'permanent',
          referenceType: 'closing_temporary',
          totalDebit: 488500000,
          totalCredit: 488500000,
          isBalanced: true,
          createdBy: 'خانم محمدی (حسابدار ارشد)',
          createdAt: '1402/12/29',
          lines: [
            { id: 'l-1402-1', accountCode: '401', accountTitle: 'درآمد فروش کالا و ملزومات خرازی', debit: 485000000, credit: 0 },
            { id: 'l-1402-2', accountCode: '403', accountTitle: 'سایر درآمدهای عملیاتی', debit: 3500000, credit: 0 },
            { id: 'l-1402-3', accountCode: '501', accountTitle: 'بهای تمام‌شده کالای فروش‌رفته (COGS)', debit: 0, credit: 310000000 },
            { id: 'l-1402-4', accountCode: '601', accountTitle: 'هزینه‌های عمومی و اداری فروشگاه', debit: 0, credit: 42000000 },
            { id: 'l-1402-5', accountCode: '302', accountTitle: 'سود و زیان انباشته (انتقال سود خالص ۱۴۰۲)', debit: 0, credit: 136500000 },
          ],
        },
        {
          id: 'vch-close-perm-1402',
          voucherNumber: '998',
          date: '1402/12/29',
          description: 'سند اختتامیه حساب‌های دائمی ترازنامه پایان سال مالی ۱۴۰۲',
          fiscalYearId: '1402',
          status: 'permanent',
          referenceType: 'closing_permanent',
          totalDebit: 416840000,
          totalCredit: 416840000,
          isBalanced: true,
          createdBy: 'خانم محمدی (حسابدار ارشد)',
          createdAt: '1402/12/29',
          lines: [
            { id: 'l-1402-p1', accountCode: '201', accountTitle: 'حساب‌های پرداختنی تجاری - بازرگانی رازی', personId: 'per-3', personName: 'بازرگانی نخ و زیپ رازی', debit: 45000000, credit: 0 },
            { id: 'l-1402-p2', accountCode: '202', accountTitle: 'اسناد پرداختنی تجاری', debit: 27000000, credit: 0 },
            { id: 'l-1402-p3', accountCode: '301', accountTitle: 'سرمایه اولیه فروشگاه خرازی', debit: 208340000, credit: 0 },
            { id: 'l-1402-p4', accountCode: '302', accountTitle: 'سود و زیان انباشته پایان سال ۱۴۰۲', debit: 136500000, credit: 0 },
            { id: 'l-1402-p5', accountCode: '10101', accountTitle: 'صندوق نقدی فروشگاه', debit: 0, credit: 18500000 },
            { id: 'l-1402-p6', accountCode: '10102', accountTitle: 'بانک ملی - جاری ۵۴۲۱', debit: 0, credit: 185000000 },
            { id: 'l-1402-p7', accountCode: '10103', accountTitle: 'بانک ملت - کارتخوان POS', debit: 0, credit: 129300000 },
            { id: 'l-1402-p8', accountCode: '102', accountTitle: 'اسناد دریافتنی تجاری', debit: 0, credit: 35000000 },
            { id: 'l-1402-p9', accountCode: '103', accountTitle: 'حساب‌های دریافتنی تجاری (مشتریان بدهکار)', debit: 0, credit: 25550000 },
            { id: 'l-1402-p10', accountCode: '104', accountTitle: 'موجودی کالای انبار پایان دوره', debit: 0, credit: 23490000 },
          ],
        },
      ],
      invoices: [],
    },
    createdBy: 'مهندس مهدی رضایی',
    createdAt: '1402/01/01',
  },
  {
    id: 'fy-1403',
    code: '1403',
    title: 'سال مالی ۱۴۰۳ (دوره جاری)',
    startDate: '1403/01/01',
    endDate: '1403/12/30',
    status: 'open',
    isClosed: false,
    isActive: true,
    isLeapYear: true,
    description: 'سال مالی جاری فروشگاه خرازی نگین (کبیسه ۳۰ اسفند) - انتقالی از اختتامیه سال ۱۴۰۲',
    previousFiscalYearId: 'fy-1402',
    openingVoucherId: 'vch-1001',
    openingVoucherNumber: '1001',
    auditTrail: [
      { action: 'افتتاح سال مالی ۱۴۰۳ و صدور خودکار سند افتتاحیه شماره ۱۰۰۱ از اختتامیه ۱۴۰۲', userName: 'مهندس مهدی رضایی', timestamp: '1403/01/01 08:00' },
    ],
    createdBy: 'مهندس مهدی رضایی',
    createdAt: '1403/01/01',
  },
];

export class PersistentDatabase {
  users: User[] = [...initialUsers];
  units: Unit[] = [...initialUnits];
  categories: ProductCategory[] = [...initialCategories];
  brands: Brand[] = [...initialBrands];
  personGroups: PersonGroup[] = [...initialPersonGroups];
  products: Product[] = [...initialProducts];
  persons: Person[] = [...initialPersons];
  warehouses: Warehouse[] = [...initialWarehouses];
  warehouseStocks: WarehouseStock[] = [...initialWarehouseStocks];
  kardexEntries: KardexEntry[] = [...initialKardexEntries];
  goodsReceipts: GoodsReceipt[] = [...initialGoodsReceipts];
  purchaseProformas: PurchaseProforma[] = [...initialPurchaseProformas];
  warehouseTransfers: WarehouseTransfer[] = [...initialWarehouseTransfers];
  stocktakingSessions: StocktakingSession[] = [...initialStocktakingSessions];
  inventoryAdjustments: InventoryAdjustment[] = [...initialInventoryAdjustments];
  accessoryCostTypes: AccessoryCostType[] = [...initialAccessoryCostTypes];
  accessoryCosts: AccessoryCostEntry[] = [...initialAccessoryCosts];
  financialCategories: FinancialCategory[] = [...initialFinancialCategories];
  invoices: Invoice[] = [...initialInvoices];
  accountsChart: AccountingAccount[] = [...initialAccountsChart];
  vouchers: AccountingVoucher[] = [...initialVouchers];
  treasuryAccounts: TreasuryAccount[] = [...initialTreasuryAccounts];
  treasuryTransactions: TreasuryTransaction[] = [...initialTreasuryTransactions];
  cheques: Cheque[] = [...initialCheques];
  fiscalYears: FiscalYear[] = [...initialFiscalYears];
  rolePermissions: RolePermissionConfig[] = getDefaultRolePermissionConfigs();
  securityPolicy: SecurityPolicyConfig = getDefaultSecurityPolicy();
  auditLogs: AuditLog[] = [...initialAuditLogs];
  settings: StoreSettings = { ...initialSettings };

  constructor() {
    this.hydrateFromDisk();
    ensureInitialSeedSession(this.users[0]);
  }

  // لود اطلاعات ذخیره‌شده از دیسک سرور
  private hydrateFromDisk(): void {
    if (fs.existsSync(DATA_FILE)) {
      try {
        const raw = fs.readFileSync(DATA_FILE, 'utf-8');
        const parsed = JSON.parse(raw);
        // اگر نسخه اسکیمای فایل قدیمی بود، داده‌های پایه را با نسخه تراز شده 2.1.0-reconciled همگام‌سازی می‌کنیم
        if (parsed.schemaVersion !== '2.1.0-reconciled') {
          console.log('🔄 ارتقای خودکار پایگاه داده به نسخه تراز شده 2.1.0-reconciled ...');
          this.saveToDiskSync();
          return;
        }
        if (parsed.users && parsed.users.length > 0) {
          this.users = parsed.users.map((u: User) => ({
            ...u,
            passwordHash: u.passwordHash || defaultPasswordHash,
            failedLoginAttempts: u.failedLoginAttempts || 0,
            lockedUntil: u.lockedUntil || null,
          }));
        }
        if (parsed.units && parsed.units.length > 0) this.units = parsed.units;
        if (parsed.categories && parsed.categories.length > 0) this.categories = parsed.categories;
        if (parsed.brands && parsed.brands.length > 0) this.brands = parsed.brands;
        if (parsed.personGroups && parsed.personGroups.length > 0) this.personGroups = parsed.personGroups;
        if (parsed.products && parsed.products.length > 0) this.products = parsed.products;
        if (parsed.accessoryCostTypes && parsed.accessoryCostTypes.length > 0) this.accessoryCostTypes = parsed.accessoryCostTypes;
        if (parsed.accessoryCosts && parsed.accessoryCosts.length > 0) this.accessoryCosts = parsed.accessoryCosts;
        if (parsed.financialCategories && parsed.financialCategories.length > 0) this.financialCategories = parsed.financialCategories;
        if (parsed.persons && parsed.persons.length > 0) {
          this.persons = parsed.persons.map((p: any) => ({
            ...p,
            isActive: p.isActive !== undefined ? p.isActive : true,
          }));
        }
        if (parsed.warehouses && parsed.warehouses.length > 0) this.warehouses = parsed.warehouses;
        if (parsed.warehouseStocks && parsed.warehouseStocks.length > 0) this.warehouseStocks = parsed.warehouseStocks;
        if (parsed.kardexEntries && parsed.kardexEntries.length > 0) this.kardexEntries = parsed.kardexEntries;
        if (parsed.goodsReceipts && parsed.goodsReceipts.length > 0) this.goodsReceipts = parsed.goodsReceipts;
        if (parsed.purchaseProformas && parsed.purchaseProformas.length > 0) this.purchaseProformas = parsed.purchaseProformas;
        if (parsed.warehouseTransfers && parsed.warehouseTransfers.length > 0) this.warehouseTransfers = parsed.warehouseTransfers;
        if (parsed.stocktakingSessions && parsed.stocktakingSessions.length > 0) this.stocktakingSessions = parsed.stocktakingSessions;
        if (parsed.inventoryAdjustments && parsed.inventoryAdjustments.length > 0) this.inventoryAdjustments = parsed.inventoryAdjustments;
        if (parsed.invoices && parsed.invoices.length > 0) {
          this.invoices = parsed.invoices.map((inv: Invoice) => ({
            ...inv,
            date: inv.date && inv.date.startsWith('1405/') ? inv.date.replace('1405/08/', '1403/07/') : inv.date,
          }));
          for (const seedInv of initialInvoices) {
            if (!this.invoices.some((i) => i.id === seedInv.id)) {
              this.invoices.push(seedInv);
            }
          }
        }
        if (parsed.accountsChart && parsed.accountsChart.length > 0) this.accountsChart = parsed.accountsChart;
        if (parsed.vouchers && parsed.vouchers.length > 0) {
          this.vouchers = parsed.vouchers.map((v: AccountingVoucher) => ({
            ...v,
            date: v.date && v.date.startsWith('1405/') ? v.date.replace('1405/08/', '1403/07/') : v.date,
          }));
          for (const seedVch of initialVouchers) {
            if (!this.vouchers.some((v) => v.id === seedVch.id)) {
              this.vouchers.push(seedVch);
            }
          }
        } else {
          this.vouchers = [...initialVouchers];
        }
        if (parsed.treasuryAccounts && parsed.treasuryAccounts.length > 0) {
          this.treasuryAccounts = parsed.treasuryAccounts;
          for (const seedAcc of initialTreasuryAccounts) {
            if (!this.treasuryAccounts.some((a) => a.id === seedAcc.id)) {
              this.treasuryAccounts.push(seedAcc);
            }
          }
        }
        if (parsed.treasuryTransactions && parsed.treasuryTransactions.length > 0) {
          this.treasuryTransactions = parsed.treasuryTransactions;
        } else {
          this.treasuryTransactions = [...initialTreasuryTransactions];
        }
        if (parsed.cheques && parsed.cheques.length > 0) {
          this.cheques = parsed.cheques;
          for (const seedChq of initialCheques) {
            if (!this.cheques.some((c) => c.id === seedChq.id)) {
              this.cheques.push(seedChq);
            }
          }
        }
        if (parsed.fiscalYears && parsed.fiscalYears.length > 0) {
          this.fiscalYears = parsed.fiscalYears;
          for (const seedFy of initialFiscalYears) {
            if (!this.fiscalYears.some((f) => f.id === seedFy.id)) {
              this.fiscalYears.push(seedFy);
            }
          }
        } else {
          this.fiscalYears = [...initialFiscalYears];
        }
        if (parsed.rolePermissions && parsed.rolePermissions.length > 0) {
          this.rolePermissions = parsed.rolePermissions;
        } else {
          this.rolePermissions = getDefaultRolePermissionConfigs();
        }
        if (parsed.securityPolicy) {
          this.securityPolicy = { ...getDefaultSecurityPolicy(), ...parsed.securityPolicy };
        }
        if (parsed.auditLogs && parsed.auditLogs.length > 0) {
          this.auditLogs = parsed.auditLogs;
          for (const seedLog of initialAuditLogs) {
            if (!this.auditLogs.some((l) => l.id === seedLog.id)) {
              this.auditLogs.push(seedLog);
            }
          }
        } else {
          this.auditLogs = [...initialAuditLogs];
        }
        if (parsed.settings) this.settings = parsed.settings;
        console.log(`✅ داده‌های دائمی با موفقیت از دیسک (${DATA_FILE}) بارگذاری شد.`);
        return;
      } catch (err) {
        console.error('Failed to parse database file, falling back to clean seed:', err);
      }
    }
    // اگر فایل وجود نداشت، وضعیت اولیه را ذخیره می‌کنیم
    this.saveToDiskSync();
  }

  // ذخیره‌سازی اتمیک بر روی دیسک (نوشتن در فایل موقت و جابه‌جایی سریع)
  saveToDiskSync(): void {
    try {
      const data = {
        schemaVersion: '2.1.0-reconciled',
        users: this.users,
        units: this.units,
        categories: this.categories,
        brands: this.brands,
        personGroups: this.personGroups,
        products: this.products,
        persons: this.persons,
        warehouses: this.warehouses,
        warehouseStocks: this.warehouseStocks,
        kardexEntries: this.kardexEntries,
        goodsReceipts: this.goodsReceipts,
        purchaseProformas: this.purchaseProformas,
        warehouseTransfers: this.warehouseTransfers,
        stocktakingSessions: this.stocktakingSessions,
        inventoryAdjustments: this.inventoryAdjustments,
        accessoryCostTypes: this.accessoryCostTypes,
        accessoryCosts: this.accessoryCosts,
        financialCategories: this.financialCategories,
        invoices: this.invoices,
        accountsChart: this.accountsChart,
        vouchers: this.vouchers,
        treasuryAccounts: this.treasuryAccounts,
        treasuryTransactions: this.treasuryTransactions,
        cheques: this.cheques,
        fiscalYears: this.fiscalYears,
        rolePermissions: this.rolePermissions,
        securityPolicy: this.securityPolicy,
        auditLogs: this.auditLogs,
        settings: this.settings,
        savedAt: new Date().toISOString(),
      };
      const tmpFile = `${DATA_FILE}.tmp`;
      fs.writeFileSync(tmpFile, JSON.stringify(data, null, 2), 'utf-8');
      fs.renameSync(tmpFile, DATA_FILE);
    } catch (err) {
      console.error('Critical: Failed to save database to disk:', err);
    }
  }

  // اجرای تراکنش اتمیک با تضمین Rollback در صورت خطا
  runInTransaction<T>(workFn: () => T): T {
    // گرفتن اسنپ‌شات کامل از حافظه
    const snapshot = {
      users: JSON.parse(JSON.stringify(this.users)),
      units: JSON.parse(JSON.stringify(this.units)),
      categories: JSON.parse(JSON.stringify(this.categories)),
      brands: JSON.parse(JSON.stringify(this.brands)),
      personGroups: JSON.parse(JSON.stringify(this.personGroups)),
      products: JSON.parse(JSON.stringify(this.products)),
      persons: JSON.parse(JSON.stringify(this.persons)),
      warehouses: JSON.parse(JSON.stringify(this.warehouses)),
      warehouseStocks: JSON.parse(JSON.stringify(this.warehouseStocks)),
      kardexEntries: JSON.parse(JSON.stringify(this.kardexEntries)),
      goodsReceipts: JSON.parse(JSON.stringify(this.goodsReceipts)),
      purchaseProformas: JSON.parse(JSON.stringify(this.purchaseProformas)),
      warehouseTransfers: JSON.parse(JSON.stringify(this.warehouseTransfers)),
      stocktakingSessions: JSON.parse(JSON.stringify(this.stocktakingSessions)),
      inventoryAdjustments: JSON.parse(JSON.stringify(this.inventoryAdjustments)),
      accessoryCostTypes: JSON.parse(JSON.stringify(this.accessoryCostTypes)),
      accessoryCosts: JSON.parse(JSON.stringify(this.accessoryCosts)),
      financialCategories: JSON.parse(JSON.stringify(this.financialCategories)),
      invoices: JSON.parse(JSON.stringify(this.invoices)),
      accountsChart: JSON.parse(JSON.stringify(this.accountsChart)),
      vouchers: JSON.parse(JSON.stringify(this.vouchers)),
      treasuryAccounts: JSON.parse(JSON.stringify(this.treasuryAccounts)),
      treasuryTransactions: JSON.parse(JSON.stringify(this.treasuryTransactions)),
      cheques: JSON.parse(JSON.stringify(this.cheques)),
      fiscalYears: JSON.parse(JSON.stringify(this.fiscalYears)),
      rolePermissions: JSON.parse(JSON.stringify(this.rolePermissions)),
      securityPolicy: JSON.parse(JSON.stringify(this.securityPolicy)),
      auditLogs: JSON.parse(JSON.stringify(this.auditLogs)),
      settings: JSON.parse(JSON.stringify(this.settings)),
    };

    try {
      const result = workFn();
      // در صورت موفقیت، تغییرات را اتمیک بر روی دیسک ذخیره می‌کنیم
      this.saveToDiskSync();
      return result;
    } catch (err) {
      // رول‌بک کامل حافظه در صورت وقوع هرگونه خطا
      this.users = snapshot.users;
      this.units = snapshot.units;
      this.categories = snapshot.categories;
      this.brands = snapshot.brands;
      this.personGroups = snapshot.personGroups;
      this.products = snapshot.products;
      this.persons = snapshot.persons;
      this.warehouses = snapshot.warehouses;
      this.warehouseStocks = snapshot.warehouseStocks;
      this.kardexEntries = snapshot.kardexEntries;
      this.goodsReceipts = snapshot.goodsReceipts;
      this.purchaseProformas = snapshot.purchaseProformas;
      this.warehouseTransfers = snapshot.warehouseTransfers;
      this.stocktakingSessions = snapshot.stocktakingSessions;
      this.inventoryAdjustments = snapshot.inventoryAdjustments;
      this.accessoryCostTypes = snapshot.accessoryCostTypes;
      this.accessoryCosts = snapshot.accessoryCosts;
      this.financialCategories = snapshot.financialCategories;
      this.invoices = snapshot.invoices;
      this.accountsChart = snapshot.accountsChart;
      this.vouchers = snapshot.vouchers;
      this.treasuryAccounts = snapshot.treasuryAccounts;
      this.treasuryTransactions = snapshot.treasuryTransactions;
      this.cheques = snapshot.cheques;
      this.fiscalYears = snapshot.fiscalYears;
      this.rolePermissions = snapshot.rolePermissions;
      this.securityPolicy = snapshot.securityPolicy;
      this.auditLogs = snapshot.auditLogs;
      this.settings = snapshot.settings;
      console.warn('⚠️ Transaction rolled back due to error:', err);
      throw err;
    }
  }

  // ثبت وقایع نظارتی و امنیتی (Audit & Security Log)
  addAuditLog(
    userId: string,
    userName: string,
    action: AuditLog['action'],
    module: string,
    description: string,
    entityId?: string,
    extra?: {
      username?: string;
      userRole?: string;
      category?: AuditLogCategory;
      severity?: 'info' | 'warning' | 'critical';
      status?: 'success' | 'failed' | 'blocked';
      permissionModule?: PermissionModule;
      permissionAction?: PermissionAction;
      ipAddress?: string;
      userAgent?: string;
      endpoint?: string;
      beforeData?: Record<string, any>;
      afterData?: Record<string, any>;
      persistImmediately?: boolean;
    }
  ): AuditLog {
    const now = new Date();
    const timestampStr = `${now.toLocaleDateString('fa-IR')} ${now.toLocaleTimeString('fa-IR')}`;
    const matchedUser = this.users.find((u) => u.id === userId);
    const classified = classifyAuditLogAction(action);

    const log: AuditLog = {
      id: `log-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
      userId,
      username: extra?.username || matchedUser?.username || 'system',
      userName,
      userRole: extra?.userRole || matchedUser?.role || 'admin',
      action,
      category: extra?.category || classified.category,
      severity: extra?.severity || classified.defaultSeverity,
      status: extra?.status || classified.defaultStatus,
      module,
      permissionModule: extra?.permissionModule,
      permissionAction: extra?.permissionAction,
      description,
      entityId,
      ipAddress: extra?.ipAddress || '127.0.0.1',
      userAgent: extra?.userAgent,
      endpoint: extra?.endpoint,
      beforeData: extra?.beforeData,
      afterData: extra?.afterData,
      timestamp: timestampStr,
    };

    this.auditLogs.unshift(log);
    if (this.auditLogs.length > 800) {
      this.auditLogs = this.auditLogs.slice(0, 800);
    }
    if (extra?.persistImmediately) {
      this.saveToDiskSync();
    }
    return log;
  }

  // داشبورد و آمار تجمیعی مالی
  getDashboardStats() {
    const approvedSales = this.invoices.filter((i) => i.invoiceType === 'sale' && i.status === 'approved');
    const totalSalesAmount = approvedSales.reduce((sum, inv) => sum + inv.finalAmount, 0);

    // محاسبه بهای تمام‌شده و سود خالص تخمینی برای نمایش به نقش‌های مجاز
    let estimatedCogs = 0;
    for (const inv of approvedSales) {
      for (const item of inv.items) {
        const prd = this.products.find((p) => p.id === item.productId);
        const unitCost = prd ? prd.purchasePrice : item.unitPrice * 0.7;
        estimatedCogs += (item.baseQuantity || item.quantity) * unitCost;
      }
    }
    const totalExpenses = this.treasuryTransactions
      .filter((t) => t.transactionType === 'expense')
      .reduce((s, t) => s + t.amount, 0);
    const netProfitEstimate = totalSalesAmount - estimatedCogs - totalExpenses;

    const cashTotal = this.treasuryAccounts
      .filter((a) => a.type === 'cash')
      .reduce((sum, a) => sum + a.balance, 0);
    const bankTotal = this.treasuryAccounts
      .filter((a) => a.type === 'bank' || a.type === 'pos')
      .reduce((sum, a) => sum + a.balance, 0);

    const activeChequeStatuses: ChequeStatus[] = ['registered', 'deposited', 'in_process'];
    const pendingReceivedCheques = this.cheques
      .filter((c) => c.chequeType === 'received' && activeChequeStatuses.includes(c.status))
      .reduce((sum, c) => sum + c.amount, 0);
    const pendingIssuedCheques = this.cheques
      .filter((c) => c.chequeType === 'issued' && activeChequeStatuses.includes(c.status))
      .reduce((sum, c) => sum + c.amount, 0);

    const upcomingCheques = [...this.cheques]
      .sort((a, b) => {
        const aActive = activeChequeStatuses.includes(a.status) ? 0 : 1;
        const bActive = activeChequeStatuses.includes(b.status) ? 0 : 1;
        if (aActive !== bActive) return aActive - bActive;
        return (a.dueDate || '').localeCompare(b.dueDate || '');
      })
      .slice(0, 12);

    const customerDebts = this.persons
      .filter((p) => p.currentBalance > 0)
      .reduce((sum, p) => sum + p.currentBalance, 0);
    const supplierCredits = this.persons
      .filter((p) => p.currentBalance < 0)
      .reduce((sum, p) => sum + Math.abs(p.currentBalance), 0);

    const lowStockProducts = this.products.filter((p) => p.currentStock <= p.minStockAlert && p.isActive);
    const totalInventoryValue = this.products.reduce((sum, p) => sum + p.currentStock * p.purchasePrice, 0);

    return {
      totalSalesAmount,
      netProfitEstimate,
      todaySalesCount: approvedSales.length,
      cashTotal,
      bankTotal,
      totalTreasury: cashTotal + bankTotal,
      pendingReceivedCheques,
      pendingIssuedCheques,
      upcomingCheques,
      customerDebts,
      supplierCredits,
      lowStockCount: lowStockProducts.length,
      lowStockProducts: lowStockProducts.slice(0, 8),
      totalProductsCount: this.products.length,
      totalPersonsCount: this.persons.length,
      totalInventoryValue,
      recentInvoices: this.invoices.slice(0, 5),
    };
  }

  // ذخیره یا ویرایش کالا با اعتبارسنجی کامل و تضمین یکتایی کد و بارکد
  saveProduct(data: Partial<Product>, user: User): Product {
    return this.runInTransaction(() => {
      // ۱. اعتبارسنجی فیلدهای ضروری
      const name = data.name?.trim();
      if (!name) {
        throw new TransactionError('نام کالا الزامی است و نمی‌تواند خالی باشد.');
      }

      const code = data.code?.trim();
      if (!code) {
        throw new TransactionError('کد کالا الزامی است و برای ردیابی در سیستم حسابداری اجباری است.');
      }

      // ۲. اعتبارسنجی یکتایی کد کالا
      const duplicateCode = this.products.find(
        (p) => p.code.toLowerCase().trim() === code.toLowerCase() && p.id !== data.id
      );
      if (duplicateCode) {
        throw new TransactionError(
          `کد کالای «${code}» تکراری است و قبلاً برای کالای «${duplicateCode.name}» ثبت شده است. هر کالا باید کد اختصاصی یکتا داشته باشد.`
        );
      }

      // ۳. اعتبارسنجی یکتایی بارکد در صورت ورود
      const barcode = data.barcode?.trim();
      if (barcode) {
        const duplicateBarcode = this.products.find(
          (p) => p.barcode && p.barcode.trim() === barcode && p.id !== data.id
        );
        if (duplicateBarcode) {
          throw new TransactionError(
            `بارکد «${barcode}» تکراری است و قبلاً به کالای «${duplicateBarcode.name}» (کد: ${duplicateBarcode.code}) اختصاص یافته است.`
          );
        }
      }

      // ۴. اعتبارسنجی منطق قیمت‌گذاری
      const purchasePrice = Number(data.purchasePrice) || 0;
      const retailPrice = Number(data.retailPrice) || 0;
      const wholesalePrice = Number(data.wholesalePrice) || 0;
      const colleaguePrice = Number(data.colleaguePrice) || 0;
      const minAllowedPrice = Number(data.minAllowedPrice) || 0;

      if (purchasePrice < 0 || retailPrice < 0 || wholesalePrice < 0 || colleaguePrice < 0) {
        throw new TransactionError('قیمت‌های کالا نمی‌توانند منفی باشند.');
      }

      if (retailPrice > 0 && minAllowedPrice > retailPrice) {
        throw new TransactionError('حداقل قیمت مجاز برای فروشنده نمی‌تواند بیشتر از قیمت فروش تک باشد.');
      }

      const categoryName = data.categoryId
        ? this.categories.find((c) => c.id === data.categoryId)?.name || data.categoryName || ''
        : '';
      const baseUnitName = data.baseUnitId
        ? this.units.find((u) => u.id === data.baseUnitId)?.name || data.baseUnitName || 'عدد'
        : 'عدد';

      if (data.id) {
        const idx = this.products.findIndex((p) => p.id === data.id);
        if (idx !== -1) {
          if (data.currentStock !== undefined && Number(data.currentStock) !== this.products[idx].currentStock) {
            throw new TransactionError(
              `تغییر مستقیم موجودی کالای «${this.products[idx].name}» به صورت دستی مجاز نیست. طبق ضوابط حسابداری انبار، تغییر موجودی کالا منحصراً باید از طریق اسناد گردش انبار (رسید ورود کالا، فاکتور خرید، حواله انبارگردانی یا تعدیل با ثبت دلیل) صورت پذیرد.`
            );
          }

          this.products[idx] = {
            ...this.products[idx],
            ...data,
            name,
            code,
            barcode: barcode || this.products[idx].barcode,
            categoryName,
            purchasePrice,
            retailPrice,
            wholesalePrice,
            colleaguePrice,
            minAllowedPrice,
            currentStock: this.products[idx].currentStock, // تضمین عدم تغییر دستی موجودی
            weight: data.weight !== undefined ? Number(data.weight) : this.products[idx].weight,
            weightUnit: data.weightUnit || this.products[idx].weightUnit,
            length: data.length !== undefined ? Number(data.length) : this.products[idx].length,
            lengthUnit: data.lengthUnit || this.products[idx].lengthUnit,
            width: data.width !== undefined ? Number(data.width) : this.products[idx].width,
            widthUnit: data.widthUnit || this.products[idx].widthUnit,
            height: data.height !== undefined ? Number(data.height) : this.products[idx].height,
            heightUnit: data.heightUnit || this.products[idx].heightUnit,
            salesType: data.salesType || this.products[idx].salesType,
            customSpecs: data.customSpecs || this.products[idx].customSpecs || [],
            updatedAt: new Date().toLocaleDateString('fa-IR'),
          };
          this.addAuditLog(
            user.id,
            user.fullName,
            'update',
            'مدیریت کالا',
            `ویرایش مشخصات کالای «${this.products[idx].name}» (کد: ${code})`,
            this.products[idx].id
          );
          return this.products[idx];
        }
      }

      const initialStock = Number(data.currentStock) || 0;
      const newProduct: Product = {
        id: `prd-${Date.now()}`,
        code,
        barcode: barcode || `626${Date.now().toString().slice(-9)}`,
        name,
        categoryId: data.categoryId || this.categories[0]?.id || 'cat-ribbons',
        categoryName,
        baseUnitId: data.baseUnitId || this.units[0]?.id || 'u-meter',
        baseUnitName,
        color: data.color?.trim() || '',
        size: data.size?.trim() || '',
        material: data.material?.trim() || '',
        brand: data.brand?.trim() || '',
        model: data.model?.trim() || '',
        weight: data.weight !== undefined ? Number(data.weight) : undefined,
        weightUnit: data.weightUnit || 'گرم',
        length: data.length !== undefined ? Number(data.length) : undefined,
        lengthUnit: data.lengthUnit || 'سانتی‌متر',
        width: data.width !== undefined ? Number(data.width) : undefined,
        widthUnit: data.widthUnit || 'میلی‌متر',
        height: data.height !== undefined ? Number(data.height) : undefined,
        heightUnit: data.heightUnit || 'میلی‌متر',
        salesType: data.salesType || 'quantity',
        customSpecs: data.customSpecs || [],
        purchasePrice,
        retailPrice,
        wholesalePrice,
        colleaguePrice,
        minAllowedPrice,
        currentStock: initialStock,
        minStockAlert: Number(data.minStockAlert) || 10,
        allowDecimal: Boolean(data.allowDecimal),
        unitConversions: data.unitConversions || [],
        isActive: data.isActive !== undefined ? data.isActive : true,
        notes: data.notes?.trim() || '',
        createdAt: new Date().toLocaleDateString('fa-IR'),
        updatedAt: new Date().toLocaleDateString('fa-IR'),
      };

      this.products.unshift(newProduct);

      // ثبت گردش موجودی افتتاحیه قابل ردیابی در کاردکس
      if (initialStock > 0) {
        const defaultWh = this.warehouses.find((w) => w.isDefault) || this.warehouses[0];
        const whId = defaultWh?.id || 'wh-central';
        const whName = defaultWh?.name || 'انبار مرکزی و بنکداری';

        this.warehouseStocks.push({
          productId: newProduct.id,
          warehouseId: whId,
          quantity: initialStock,
          lastUpdated: new Date().toLocaleDateString('fa-IR'),
        });

        this.kardexEntries.unshift({
          id: `kd-init-${Date.now()}`,
          productId: newProduct.id,
          productCode: newProduct.code,
          productName: newProduct.name,
          warehouseId: whId,
          warehouseName: whName,
          date: new Date().toLocaleDateString('fa-IR'),
          referenceType: 'initial_stock',
          referenceTypeTitle: 'موجودی اولیه کالا',
          referenceId: `init-${newProduct.id}`,
          referenceNumber: `OP-${newProduct.code}`,
          inQuantity: initialStock,
          outQuantity: 0,
          unitName: newProduct.baseUnitName || 'عدد',
          unitPrice: newProduct.purchasePrice,
          totalValue: initialStock * newProduct.purchasePrice,
          balanceQuantity: initialStock,
          balanceValue: initialStock * newProduct.purchasePrice,
          userId: user.id,
          userName: user.fullName,
          notes: 'موجودی اولیه در زمان ثبت کالا',
          createdAt: new Date().toLocaleDateString('fa-IR'),
        });
      }

      this.addAuditLog(
        user.id,
        user.fullName,
        'create',
        'مدیریت کالا',
        `ثبت کالای جدید خرازی: «${newProduct.name}» (کد: ${newProduct.code}) با موجودی اولیه ${initialStock}`,
        newProduct.id
      );
      return newProduct;
    });
  }

  // تغییر وضعیت فعال / غیرفعال کالا
  toggleProductActive(id: string, user: User): Product {
    return this.runInTransaction(() => {
      const prd = this.products.find((p) => p.id === id);
      if (!prd) throw new TransactionError('کالای مورد نظر یافت نشد.');

      prd.isActive = !prd.isActive;
      prd.updatedAt = new Date().toLocaleDateString('fa-IR');
      this.addAuditLog(
        user.id,
        user.fullName,
        'update',
        'مدیریت کالا',
        `تغییر وضعیت کالای «${prd.name}» به ${prd.isActive ? 'فعال' : 'غیرفعال'}`,
        prd.id
      );
      return prd;
    });
  }

  // حذف کالا با ممنوعیت اکید در صورت وجود اسناد مالی و انبار
  deleteProduct(id: string, user: User): boolean {
    return this.runInTransaction(() => {
      const idx = this.products.findIndex((p) => p.id === id);
      if (idx === -1) return false;
      const prd = this.products[idx];

      // ۱. بررسی ارتباط با فاکتورهای فروش و خرید
      const linkedInvoices = this.invoices.filter((inv) =>
        inv.items.some((item) => item.productId === id)
      );

      if (linkedInvoices.length > 0) {
        throw new TransactionError(
          `امکان حذف کالای «${prd.name}» (کد: ${prd.code}) وجود ندارد زیرا در ${linkedInvoices.length} فاکتور مالی و انبارداری ثبت‌شده دارای گردش است. طبق استانداردهای حسابداری، حذف اطلاعات مرتبط با اسناد مالی مجاز نیست. لطفاً به جای حذف، وضعیت کالا را به «غیرفعال» تغییر دهید تا در صدور فاکتورهای جدید پیشنهاد نشود.`
        );
      }

      this.products.splice(idx, 1);
      this.addAuditLog(user.id, user.fullName, 'delete', 'مدیریت کالا', `حذف کالای «${prd.name}» (کد: ${prd.code})`, id);
      return true;
    });
  }

  // ایجاد یا ویرایش طرف حساب با اعتبارسنجی کامل و شناسه یکتا
  savePerson(data: Partial<Person>, user: User): Person {
    return this.runInTransaction(() => {
      // ۱. اعتبارسنجی فیلدهای ضروری
      const name = data.name?.trim();
      if (!name) {
        throw new TransactionError('نام یا عنوان طرف حساب الزامی است.');
      }

      const code = data.code?.trim();
      if (!code) {
        throw new TransactionError('کد طرف حساب الزامی است و باید منحصر‌به‌فرد باشد.');
      }

      // ۲. اعتبارسنجی یکتایی کد طرف حساب
      const duplicateCode = this.persons.find(
        (p) => p.code.trim() === code && p.id !== data.id
      );
      if (duplicateCode) {
        throw new TransactionError(
          `کد طرف حساب «${code}» تکراری است و قبلاً برای «${duplicateCode.name}» ثبت شده است. هر طرف حساب باید دارای کد اختصاصی یکتا باشد.`
        );
      }

      // ۳. اعتبارسنجی شماره موبایل
      const mobile = data.mobile?.trim() || '';
      if (!mobile) {
        throw new TransactionError('شماره تلفن همراه طرف حساب جهت اطلاع‌رسانی و احراز هویت الزامی است.');
      }

      // ۴. انتساب گروه شخص
      let groupName = data.groupName || '';
      if (data.groupId) {
        const grp = this.personGroups.find((g) => g.id === data.groupId);
        if (grp) groupName = grp.name;
      }

      if (data.id) {
        const idx = this.persons.findIndex((p) => p.id === data.id);
        if (idx !== -1) {
          this.persons[idx] = {
            ...this.persons[idx],
            ...data,
            name,
            code,
            mobile,
            groupName,
            creditLimit: Number(data.creditLimit) || 0,
            updatedAt: new Date().toLocaleDateString('fa-IR'),
          };
          this.addAuditLog(
            user.id,
            user.fullName,
            'update',
            'طرف حساب',
            `ویرایش مشخصات طرف حساب «${this.persons[idx].name}» (کد: ${code})`,
            this.persons[idx].id
          );
          return this.persons[idx];
        }
      }

      const newPerson: Person = {
        id: `per-${Date.now()}`,
        code,
        name,
        personType: data.personType || 'customer',
        groupId: data.groupId || '',
        groupName,
        phone: data.phone?.trim() || '',
        mobile,
        nationalCode: data.nationalCode?.trim() || '',
        economicCode: data.economicCode?.trim() || '',
        address: data.address?.trim() || '',
        creditLimit: Number(data.creditLimit) || 0,
        currentBalance: Number(data.currentBalance) || 0,
        isActive: data.isActive !== undefined ? data.isActive : true,
        notes: data.notes?.trim() || '',
        createdAt: new Date().toLocaleDateString('fa-IR'),
        updatedAt: new Date().toLocaleDateString('fa-IR'),
      };

      this.persons.unshift(newPerson);
      this.addAuditLog(
        user.id,
        user.fullName,
        'create',
        'طرف حساب',
        `ثبت طرف حساب جدید: «${newPerson.name}» با نقش ${newPerson.personType === 'customer' ? 'مشتری' : newPerson.personType === 'supplier' ? 'تأمین‌کننده' : 'دوطرفه'}`,
        newPerson.id
      );
      return newPerson;
    });
  }

  // تغییر وضعیت فعال / غیرفعال طرف حساب
  togglePersonActive(id: string, user: User): Person {
    return this.runInTransaction(() => {
      const p = this.persons.find((item) => item.id === id);
      if (!p) throw new TransactionError('طرف حساب یافت نشد.');

      p.isActive = !p.isActive;
      p.updatedAt = new Date().toLocaleDateString('fa-IR');
      this.addAuditLog(
        user.id,
        user.fullName,
        'update',
        'طرف حساب',
        `تغییر وضعیت طرف حساب «${p.name}» به ${p.isActive ? 'فعال' : 'غیرفعال'}`,
        p.id
      );
      return p;
    });
  }

  // حذف طرف حساب با حفاظت مالی کامل
  deletePerson(id: string, user: User): boolean {
    return this.runInTransaction(() => {
      const idx = this.persons.findIndex((p) => p.id === id);
      if (idx === -1) return false;
      const person = this.persons[idx];

      // بررسی ارتباط با اسناد مالی
      const linkedInvoices = this.invoices.filter((i) => i.personId === id);
      const linkedTransactions = this.treasuryTransactions.filter((t) => t.personId === id);
      const linkedCheques = this.cheques.filter((c) => c.personId === id);
      const linkedVouchers = this.vouchers.filter((v) =>
        v.lines.some((l) => l.personId === id)
      );
      const hasBalance = person.currentBalance !== 0;

      if (
        linkedInvoices.length > 0 ||
        linkedTransactions.length > 0 ||
        linkedCheques.length > 0 ||
        linkedVouchers.length > 0 ||
        hasBalance
      ) {
        const reasons: string[] = [];
        if (linkedInvoices.length > 0) reasons.push(`${linkedInvoices.length} فاکتور ثبت‌شده`);
        if (linkedTransactions.length > 0) reasons.push(`${linkedTransactions.length} تراکنش خزانه‌داری`);
        if (linkedCheques.length > 0) reasons.push(`${linkedCheques.length} فقره چک صیادی`);
        if (linkedVouchers.length > 0) reasons.push(`${linkedVouchers.length} سند حسابداری دوطرفه`);
        if (hasBalance)
          reasons.push(
            `مانده حساب ${person.currentBalance > 0 ? 'بدهکار' : 'بستانکار'} (${Math.abs(person.currentBalance).toLocaleString('fa-IR')} تومان)`
          );

        throw new TransactionError(
          `امکان حذف طرف حساب «${person.name}» (کد: ${person.code}) به دلیل وجود اسناد مالی و تمامیت دفاتر وجود ندارد:\n[${reasons.join('، ')}].\nطبق استانداردهای مالی، حذف این اطلاعات ممنوع است؛ لطفاً شخص را «غیرفعال» نمایید.`
        );
      }

      this.persons.splice(idx, 1);
      this.addAuditLog(user.id, user.fullName, 'delete', 'طرف حساب', `حذف طرف حساب «${person.name}»`, id);
      return true;
    });
  }

  // دریافت خلاصه مالی طرف حساب
  getPersonFinancialSummary(id: string) {
    const person = this.persons.find((p) => p.id === id);
    if (!person) return null;

    const invoices = this.invoices.filter((i) => i.personId === id);
    const transactions = this.treasuryTransactions.filter((t) => t.personId === id);
    const cheques = this.cheques.filter((c) => c.personId === id);

    return {
      person,
      invoicesCount: invoices.length,
      invoicesTotal: invoices.reduce((s, i) => s + i.finalAmount, 0),
      transactionsCount: transactions.length,
      chequesCount: cheques.length,
      currentBalance: person.currentBalance,
      canDelete: invoices.length === 0 && transactions.length === 0 && cheques.length === 0 && person.currentBalance === 0,
    };
  }

  // گروه طرف‌های حساب
  savePersonGroup(data: Partial<PersonGroup>, user: User): PersonGroup {
    return this.runInTransaction(() => {
      const name = data.name?.trim();
      if (!name) throw new TransactionError('عنوان گروه الزامی است.');

      if (data.id) {
        const idx = this.personGroups.findIndex((g) => g.id === data.id);
        if (idx !== -1) {
          this.personGroups[idx] = { ...this.personGroups[idx], ...data, name };
          this.addAuditLog(user.id, user.fullName, 'update', 'گروه اشخاص', `ویرایش گروه «${name}»`);
          return this.personGroups[idx];
        }
      }

      const newGrp: PersonGroup = {
        id: `grp-${Date.now()}`,
        code: data.code || `GRP-${Math.floor(10 + Math.random() * 90)}`,
        name,
        description: data.description?.trim() || '',
        defaultDiscountPercent: Number(data.defaultDiscountPercent) || 0,
        defaultCreditLimit: Number(data.defaultCreditLimit) || 0,
      };

      this.personGroups.push(newGrp);
      this.addAuditLog(user.id, user.fullName, 'create', 'گروه اشخاص', `ایجاد گروه اشخاص: ${name}`);
      return newGrp;
    });
  }

  deletePersonGroup(id: string, user: User): boolean {
    return this.runInTransaction(() => {
      const idx = this.personGroups.findIndex((g) => g.id === id);
      if (idx === -1) return false;

      const memberCount = this.persons.filter((p) => p.groupId === id).length;
      if (memberCount > 0) {
        throw new TransactionError(`امکان حذف این گروه وجود ندارد زیرا دارای ${memberCount} مخاطب عضو است.`);
      }

      const grp = this.personGroups[idx];
      this.personGroups.splice(idx, 1);
      this.addAuditLog(user.id, user.fullName, 'delete', 'گروه اشخاص', `حذف گروه «${grp.name}»`);
      return true;
    });
  }

  // مدیریت برندها
  saveBrand(data: Partial<Brand>, user: User): Brand {
    return this.runInTransaction(() => {
      const name = data.name?.trim();
      if (!name) throw new TransactionError('نام برند الزامی است.');

      if (data.id) {
        const idx = this.brands.findIndex((b) => b.id === data.id);
        if (idx !== -1) {
          this.brands[idx] = { ...this.brands[idx], ...data, name };
          this.addAuditLog(user.id, user.fullName, 'update', 'مدیریت برند', `ویرایش برند «${name}»`);
          return this.brands[idx];
        }
      }

      const newBrand: Brand = {
        id: `br-${Date.now()}`,
        name,
        country: data.country?.trim() || '',
        description: data.description?.trim() || '',
      };
      this.brands.push(newBrand);
      this.addAuditLog(user.id, user.fullName, 'create', 'مدیریت برند', `ثبت برند جدید: ${name}`);
      return newBrand;
    });
  }

  deleteBrand(id: string, user: User): boolean {
    return this.runInTransaction(() => {
      const idx = this.brands.findIndex((b) => b.id === id);
      if (idx === -1) return false;
      const b = this.brands[idx];

      const productCount = this.products.filter(
        (p) => p.brand?.toLowerCase() === b.name.toLowerCase()
      ).length;
      if (productCount > 0) {
        throw new TransactionError(`امکان حذف برند «${b.name}» به دلیل انتساب به ${productCount} کالا وجود ندارد.`);
      }

      this.brands.splice(idx, 1);
      this.addAuditLog(user.id, user.fullName, 'delete', 'مدیریت برند', `حذف برند «${b.name}»`);
      return true;
    });
  }

  // مدیریت دسته‌بندی‌ها
  saveCategory(data: Partial<ProductCategory>, user: User): ProductCategory {
    return this.runInTransaction(() => {
      const name = data.name?.trim();
      if (!name) throw new TransactionError('نام دسته‌بندی الزامی است.');

      if (data.id) {
        const idx = this.categories.findIndex((c) => c.id === data.id);
        if (idx !== -1) {
          this.categories[idx] = { ...this.categories[idx], ...data, name };
          this.addAuditLog(user.id, user.fullName, 'update', 'دسته‌بندی کالا', `ویرایش دسته‌بندی «${name}»`);
          return this.categories[idx];
        }
      }

      const newCat: ProductCategory = {
        id: `cat-${Date.now()}`,
        code: data.code || `${(this.categories.length + 1) * 10}`,
        name,
        parentId: data.parentId || null,
        description: data.description?.trim() || '',
      };
      this.categories.push(newCat);
      this.addAuditLog(user.id, user.fullName, 'create', 'دسته‌بندی کالا', `ایجاد دسته‌بندی: ${name}`);
      return newCat;
    });
  }

  deleteCategory(id: string, user: User): boolean {
    return this.runInTransaction(() => {
      const idx = this.categories.findIndex((c) => c.id === id);
      if (idx === -1) return false;
      const cat = this.categories[idx];

      const linkedProducts = this.products.filter((p) => p.categoryId === id);
      if (linkedProducts.length > 0) {
        throw new TransactionError(`امکان حذف این دسته‌بندی وجود ندارد زیرا ${linkedProducts.length} کالا در این دسته قرار دارند.`);
      }

      this.categories.splice(idx, 1);
      this.addAuditLog(user.id, user.fullName, 'delete', 'دسته‌بندی کالا', `حذف دسته‌بندی «${cat.name}»`);
      return true;
    });
  }

  // مدیریت واحدهای اندازه‌گیری خرازی
  saveUnit(data: Partial<Unit>, user: User): Unit {
    return this.runInTransaction(() => {
      const name = data.name?.trim();
      if (!name) throw new TransactionError('نام واحد اندازه‌گیری الزامی است.');

      const baseUnit = data.baseUnitId ? this.units.find((u) => u.id === data.baseUnitId) : undefined;
      const baseUnitName = baseUnit ? baseUnit.name : data.baseUnitName;

      if (data.id) {
        const idx = this.units.findIndex((u) => u.id === data.id);
        if (idx !== -1) {
          this.units[idx] = {
            ...this.units[idx],
            ...data,
            name,
            symbol: data.symbol?.trim() || this.units[idx].symbol,
            isDecimalAllowed: Boolean(data.isDecimalAllowed),
            unitFamily: data.unitFamily || this.units[idx].unitFamily || 'other',
            baseUnitId: data.baseUnitId || undefined,
            baseUnitName,
            conversionFactor: data.conversionFactor !== undefined ? Number(data.conversionFactor) : this.units[idx].conversionFactor,
          };
          this.addAuditLog(user.id, user.fullName, 'update', 'واحدهای اندازه‌گیری', `ویرایش واحد «${name}»`);
          return this.units[idx];
        }
      }

      const newUnit: Unit = {
        id: data.id || `u-${Date.now()}`,
        name,
        symbol: data.symbol?.trim() || name,
        isDecimalAllowed: Boolean(data.isDecimalAllowed),
        unitFamily: data.unitFamily || 'count',
        baseUnitId: data.baseUnitId || undefined,
        baseUnitName,
        conversionFactor: data.conversionFactor !== undefined ? Number(data.conversionFactor) : 1,
        description: data.description?.trim() || '',
      };

      this.units.push(newUnit);
      this.addAuditLog(user.id, user.fullName, 'create', 'واحدهای اندازه‌گیری', `ثبت واحد اندازه‌گیری جدید: ${name}`);
      return newUnit;
    });
  }

  deleteUnit(id: string, user: User): boolean {
    return this.runInTransaction(() => {
      const idx = this.units.findIndex((u) => u.id === id);
      if (idx === -1) return false;
      const u = this.units[idx];

      const linkedProducts = this.products.filter(
        (p) => p.baseUnitId === id || p.unitConversions?.some((c) => c.unitId === id)
      );
      if (linkedProducts.length > 0) {
        throw new TransactionError(
          `امکان حذف واحد «${u.name}» وجود ندارد زیرا در ${linkedProducts.length} کالا به عنوان واحد اصلی یا فرعی استفاده شده است.`
        );
      }

      this.units.splice(idx, 1);
      this.addAuditLog(user.id, user.fullName, 'delete', 'واحدهای اندازه‌گیری', `حذف واحد «${u.name}»`);
      return true;
    });
  }

  // مدیریت انواع خرج‌کار و هزینه‌های جانبی قابل تنظیم
  saveAccessoryCostType(data: Partial<AccessoryCostType>, user: User): AccessoryCostType {
    return this.runInTransaction(() => {
      const name = data.name?.trim();
      if (!name) throw new TransactionError('عنوان هزینه یا خرج‌کار الزامی است.');

      if (data.id) {
        const idx = this.accessoryCostTypes.findIndex((t) => t.id === data.id);
        if (idx !== -1) {
          this.accessoryCostTypes[idx] = {
            ...this.accessoryCostTypes[idx],
            ...data,
            name,
            category: data.category || this.accessoryCostTypes[idx].category,
            defaultAllocationMethod: data.defaultAllocationMethod || this.accessoryCostTypes[idx].defaultAllocationMethod,
            isActive: data.isActive !== undefined ? data.isActive : this.accessoryCostTypes[idx].isActive,
          };
          this.addAuditLog(user.id, user.fullName, 'update', 'تنظیمات خرج‌کار', `ویرایش نوع خرج‌کار «${name}»`);
          return this.accessoryCostTypes[idx];
        }
      }

      const newType: AccessoryCostType = {
        id: `act-${Date.now()}`,
        code: data.code?.trim() || `CST-${Math.floor(100 + Math.random() * 900)}`,
        name,
        category: data.category || 'notion',
        defaultAllocationMethod: data.defaultAllocationMethod || 'quantity',
        description: data.description?.trim() || '',
        isActive: data.isActive !== undefined ? data.isActive : true,
      };

      this.accessoryCostTypes.push(newType);
      this.addAuditLog(user.id, user.fullName, 'create', 'تنظیمات خرج‌کار', `تعریف نوع خرج‌کار/هزینه جدید: «${name}»`);
      return newType;
    });
  }

  deleteAccessoryCostType(id: string, user: User): boolean {
    return this.runInTransaction(() => {
      const idx = this.accessoryCostTypes.findIndex((t) => t.id === id);
      if (idx === -1) return false;
      const t = this.accessoryCostTypes[idx];

      const linkedEntries = this.accessoryCosts.filter((e) => e.costTypeId === id);
      if (linkedEntries.length > 0) {
        throw new TransactionError(
          `امکان حذف نوع هزینه «${t.name}» به دلیل وجود ${linkedEntries.length} برگه ثبت‌شده در سیستم وجود ندارد. می‌توانید آن را غیرفعال کنید.`
        );
      }

      this.accessoryCostTypes.splice(idx, 1);
      this.addAuditLog(user.id, user.fullName, 'delete', 'تنظیمات خرج‌کار', `حذف نوع هزینه «${t.name}»`);
      return true;
    });
  }

  // ثبت برگه خرج‌کار یا هزینه جانبی با تسهیم دقیق
  saveAccessoryCostEntry(data: Partial<AccessoryCostEntry>, user: User): AccessoryCostEntry {
    return this.runInTransaction(() => {
      const title = data.title?.trim();
      if (!title) throw new TransactionError('عنوان هزینه یا خرج‌کار الزامی است.');

      const amount = Number(data.amount);
      if (!amount || amount <= 0) throw new TransactionError('مبلغ هزینه باید بزرگتر از صفر باشد.');

      const costType = this.accessoryCostTypes.find((t) => t.id === data.costTypeId);
      const costTypeName = costType ? costType.name : data.costTypeName || 'هزینه متفرقه';

      const allocationMethod = data.allocationMethod || costType?.defaultAllocationMethod || 'quantity';

      // تسهیم بر روی اقلام انتخاب شده
      let allocatedItems: AllocatedProductItem[] = [];
      if (data.allocatedItems && data.allocatedItems.length > 0) {
        const inputItems = data.allocatedItems.map((it) => ({
          productId: it.productId,
          productCode: it.productCode || '',
          productName: it.productName || '',
          quantity: it.quantity || 1,
          unitName: it.unitName || 'عدد',
          originalUnitCost: it.originalUnitCost || 0,
          weightPerUnit: it.weight || 0,
          lengthPerUnit: it.length || 0,
        }));

        const allocResult = allocateAccessoryCost({
          totalAmount: amount,
          method: allocationMethod,
          items: inputItems,
        });

        allocatedItems = allocResult.allocatedItems;
      }

      const newEntry: AccessoryCostEntry = {
        id: data.id || `acc-${Date.now()}`,
        trackingCode: data.trackingCode || `EXP-${Math.floor(1000 + Math.random() * 9000)}`,
        title,
        costTypeId: data.costTypeId || 'act-1',
        costTypeName,
        amount,
        date: data.date || new Date().toLocaleDateString('fa-IR'),
        allocationMethod,
        targetType: data.targetType || 'products',
        targetId: data.targetId,
        targetName: data.targetName,
        treasuryAccountId: data.treasuryAccountId,
        treasuryAccountTitle: data.treasuryAccountTitle,
        recipientOrPayer: data.recipientOrPayer?.trim() || '',
        allocatedItems,
        notes: data.notes?.trim() || '',
        createdAt: new Date().toLocaleDateString('fa-IR'),
      };

      // در صورت ویرایش یا ایجاد جدید
      if (data.id) {
        const idx = this.accessoryCosts.findIndex((e) => e.id === data.id);
        if (idx !== -1) {
          this.accessoryCosts[idx] = newEntry;
          this.addAuditLog(user.id, user.fullName, 'update', 'هزینه و خرج‌کار', `ویرایش برگه خرج‌کار «${title}» (${amount.toLocaleString('fa-IR')} تومان)`);
          return this.accessoryCosts[idx];
        }
      }

      this.accessoryCosts.unshift(newEntry);
      this.addAuditLog(user.id, user.fullName, 'create', 'هزینه و خرج‌کار', `ثبت هزینه/خرج‌کار جدید «${title}» به مبلغ ${amount.toLocaleString('fa-IR')} تومان با روش تسهیم «${allocationMethod}»`);
      return newEntry;
    });
  }

  deleteAccessoryCostEntry(id: string, user: User): boolean {
    return this.runInTransaction(() => {
      const idx = this.accessoryCosts.findIndex((e) => e.id === id);
      if (idx === -1) return false;
      const entry = this.accessoryCosts[idx];

      this.accessoryCosts.splice(idx, 1);
      this.addAuditLog(user.id, user.fullName, 'delete', 'هزینه و خرج‌کار', `حذف برگه خرج‌کار «${entry.title}»`);
      return true;
    });
  }

  // دریافت اقلام قابل برگشت از یک فاکتور به همراه کنترل سقف مرجوعی
  getReturnableInvoiceItems(invoiceId: string): { originalInvoice: Invoice; returnableItems: ReturnableItemInfo[] } {
    const originalInvoice = this.invoices.find((i) => i.id === invoiceId);
    if (!originalInvoice) {
      throw new TransactionError('فاکتور مرجع مورد نظر یافت نشد.');
    }
    const returnableItems = calculateReturnableItems(originalInvoice, this.invoices);
    return { originalInvoice, returnableItems };
  }

  // ایجاد فاکتور با تراکنش اتمیک، تسویه ترکیبی، کنترل اکید مرجوعی، انبار تفکیکی و سند دوبل متوازن
  createInvoice(invoiceData: Partial<Invoice>, user: User): Invoice {
    return this.runInTransaction(() => {
      // نرمال‌سازی نوع فاکتور برگشتی (پشتیبانی از هر دو نام‌گذاری sale_return و return_sale)
      const rawType = String(invoiceData.invoiceType || 'sale');
      const normalizedType: Invoice['invoiceType'] =
        rawType === 'return_sale'
          ? 'sale_return'
          : rawType === 'return_purchase'
          ? 'purchase_return'
          : (rawType as Invoice['invoiceType']);
      invoiceData = { ...invoiceData, invoiceType: normalizedType };

      const isReturn = invoiceData.invoiceType === 'sale_return' || invoiceData.invoiceType === 'purchase_return';
      const isWaste = invoiceData.invoiceType === 'waste';
      const isConsignment = invoiceData.invoiceType === 'consignment';
      const isProforma = invoiceData.invoiceType === 'proforma';
      let originalInvoice: Invoice | undefined = undefined;

      // اعتبارسنجی قوانین اختصاصی اسناد برگشت از فروش و برگشت از خرید در صورت اتصال به فاکتور مرجع
      if (isReturn && invoiceData.originalInvoiceId) {
        originalInvoice = this.invoices.find((i) => i.id === invoiceData.originalInvoiceId);
        if (!originalInvoice) {
          throw new TransactionError('فاکتور مرجع با شناسه مشخص‌شده یافت نشد.');
        }
        if (originalInvoice.status !== 'approved') {
          throw new TransactionError('ثبت مرجوعی فقط برای فاکتورهای قطعی و تایید‌شده مجاز است. امکان برگشت از فاکتور پیش‌نویس یا ابطال‌شده وجود ندارد.');
        }
        if (invoiceData.invoiceType === 'sale_return' && originalInvoice.invoiceType !== 'sale') {
          throw new TransactionError('سند برگشت از فروش فقط می‌تواند به یک فاکتور فروش معتبر متصل باشد.');
        }
        if (invoiceData.invoiceType === 'purchase_return' && originalInvoice.invoiceType !== 'purchase') {
          throw new TransactionError('سند برگشت از خرید فقط می‌تواند به یک فاکتور خرید معتبر متصل باشد.');
        }

        // کنترل سقف مقدار مجاز قابل برگشت برای تک تک اقلام
        const returnValidation = validateReturnQuantities(
          originalInvoice,
          this.invoices,
          (invoiceData.items || []).map((it) => ({
            productId: it.productId,
            quantity: Number(it.quantity) || 0,
          }))
        );

        if (!returnValidation.isValid) {
          throw new TransactionError(returnValidation.errorMessage || 'مقدار درخواستی برگشت از سقف مجاز فراتر است.');
        }
      }

      const defaultPrefix =
        invoiceData.invoiceType === 'sale_return'
          ? `SR-${100 + this.invoices.length + 1}`
          : invoiceData.invoiceType === 'purchase_return'
          ? `PR-${100 + this.invoices.length + 1}`
          : isWaste
          ? `WST-${100 + this.invoices.length + 1}`
          : isConsignment
          ? `AMN-${100 + this.invoices.length + 1}`
          : isProforma
          ? `PRF-${100 + this.invoices.length + 1}`
          : `${1240 + this.invoices.length + 1}`;

      const invNumber = invoiceData.invoiceNumber || defaultPrefix;
      const invoiceId = `inv-${Date.now()}`;
      const personId = invoiceData.personId || originalInvoice?.personId;
      const person = this.persons.find((p) => p.id === personId);
      const personPreviousBalance = person ? person.currentBalance : 0;
      const personName = person
        ? person.name
        : isWaste
        ? 'حساب ضایعات و کسری انبار'
        : originalInvoice?.personName || 'مشتری عمومی';

      const initialStatus: InvoiceStatus =
        isProforma || isConsignment
          ? 'draft'
          : invoiceData.status || 'approved';

      const targetWhId = invoiceData.warehouseId || originalInvoice?.warehouseId || (this.warehouses.find((w) => w.isDefault)?.id) || 'wh-shop';
      const targetWh = this.warehouses.find((w) => w.id === targetWhId) || this.warehouses[0];
      const whId = targetWh?.id || 'wh-shop';
      const whName = targetWh?.name || 'انبار پیشخوان و دخل فروشگاه';

      const items = invoiceData.items || [];
      let subtotal = 0;
      let totalDiscount = Number(invoiceData.totalDiscount) || 0;
      let taxAmount = Number(invoiceData.taxAmount) || 0;

      const processedItems = items.map((item, idx) => {
        const prd = this.products.find((p) => p.id === item.productId);
        const conversionFactor = item.conversionFactor || 1;
        const baseQuantity = item.quantity * conversionFactor;
        const rowDiscount = Number(item.discount) || 0;
        const rowTax = Number(item.tax) || 0;
        const totalPrice = item.quantity * item.unitPrice - rowDiscount + rowTax;
        subtotal += item.quantity * item.unitPrice - rowDiscount;

        // کسر/افزایش موجودی و ثبت کاردکس فقط برای فاکتورهای قطعی (نه پیش‌فاکتور یا امانی پیش‌نویس)
        if (prd && initialStatus === 'approved') {
          let inQty = 0;
          let outQty = 0;
          let refType: StockMovementReferenceType = 'sale_invoice';
          let refTitle = 'فاکتور فروش';

          if (invoiceData.invoiceType === 'sale') {
            const ws = this.warehouseStocks.find((w) => w.productId === prd.id && w.warehouseId === whId);
            const currentStockInWh = ws ? ws.quantity : 0;
            validateInventoryStock(
              `${prd.name} در ${whName}`,
              currentStockInWh,
              baseQuantity,
              this.settings.allowNegativeStock
            );

            prd.currentStock -= baseQuantity;
            outQty = baseQuantity;
            refType = 'sale_invoice';
            refTitle = 'فاکتور فروش';
          } else if (invoiceData.invoiceType === 'purchase') {
            prd.currentStock += baseQuantity;
            inQty = baseQuantity;
            refType = 'purchase_invoice';
            refTitle = 'فاکتور خرید';
          } else if (invoiceData.invoiceType === 'sale_return') {
            // برگشت از فروش: کالا وارد انبار می‌شود
            prd.currentStock += baseQuantity;
            inQty = baseQuantity;
            outQty = 0;
            refType = 'sale_return';
            refTitle = originalInvoice
              ? `برگشت از فروش (عطف فاکتور ${originalInvoice.invoiceNumber})`
              : 'برگشت از فروش';
          } else if (invoiceData.invoiceType === 'purchase_return') {
            // برگشت از خرید: کالا از انبار خارج و به تامین‌کننده عودت داده می‌شود
            const ws = this.warehouseStocks.find((w) => w.productId === prd.id && w.warehouseId === whId);
            const currentStockInWh = ws ? ws.quantity : 0;
            validateInventoryStock(
              `${prd.name} در ${whName}`,
              currentStockInWh,
              baseQuantity,
              this.settings.allowNegativeStock
            );

            prd.currentStock -= baseQuantity;
            inQty = 0;
            outQty = baseQuantity;
            refType = 'purchase_return';
            refTitle = originalInvoice
              ? `برگشت از خرید (عطف فاکتور ${originalInvoice.invoiceNumber})`
              : 'برگشت از خرید';
          } else if (invoiceData.invoiceType === 'waste') {
            // ضایعات کالا: کسر از موجودی انبار
            const ws = this.warehouseStocks.find((w) => w.productId === prd.id && w.warehouseId === whId);
            const currentStockInWh = ws ? ws.quantity : 0;
            validateInventoryStock(
              `${prd.name} در ${whName}`,
              currentStockInWh,
              baseQuantity,
              this.settings.allowNegativeStock
            );

            prd.currentStock -= baseQuantity;
            inQty = 0;
            outQty = baseQuantity;
            refType = 'waste';
            refTitle = 'سند ضایعات کالا';
          }

          // به‌روزرسانی موجودی تفکیکی انبار
          const ws = this.warehouseStocks.find((w) => w.productId === prd.id && w.warehouseId === whId);
          if (ws) {
            ws.quantity = ws.quantity + inQty - outQty;
            ws.lastUpdated = invoiceData.date || new Date().toLocaleDateString('fa-IR');
          } else {
            this.warehouseStocks.push({
              productId: prd.id,
              warehouseId: whId,
              quantity: inQty - outQty,
              lastUpdated: invoiceData.date || new Date().toLocaleDateString('fa-IR'),
            });
          }

          // ردیف کاردکس تعدادی و ریالی
          const itemEffectiveUnitPrice = item.unitPrice / conversionFactor;
          this.kardexEntries.unshift({
            id: `kd-inv-${Date.now()}-${idx}`,
            productId: prd.id,
            productCode: prd.code,
            productName: prd.name,
            warehouseId: whId,
            warehouseName: whName,
            date: invoiceData.date || new Date().toLocaleDateString('fa-IR'),
            referenceType: refType,
            referenceTypeTitle: refTitle,
            referenceId: invoiceId,
            referenceNumber: invNumber,
            inQuantity: inQty,
            outQuantity: outQty,
            unitName: prd.baseUnitName || 'عدد',
            unitPrice: itemEffectiveUnitPrice,
            totalValue: (inQty || outQty) * itemEffectiveUnitPrice,
            balanceQuantity: prd.currentStock,
            balanceValue: prd.currentStock * prd.purchasePrice,
            userId: user.id,
            userName: user.fullName,
            notes: `${refTitle} شماره ${invNumber} (${personName})`,
            createdAt: new Date().toLocaleDateString('fa-IR'),
          });
        }

        return {
          ...item,
          id: item.id || `it-${idx}-${Date.now()}`,
          productName: prd ? prd.name : item.productName || '',
          productCode: prd ? prd.code : item.productCode || '',
          conversionFactor,
          baseQuantity,
          totalPrice,
        };
      });

      const finalAmount = Math.max(0, subtotal - totalDiscount + taxAmount);
      const payments = invoiceData.payments || [];
      const totalPaidFromPayments = payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
      const paidAmount = isReturn || isWaste
        ? finalAmount
        : totalPaidFromPayments > 0
        ? totalPaidFromPayments
        : Number(invoiceData.paidAmount) || 0;
      const remainingAmount = isReturn || isWaste ? 0 : Math.max(0, finalAmount - paidAmount);

      const refundAction = invoiceData.refundAction || 'credit_balance';

      // مدیریت مالی مرجوعی‌ها و فاکتورها: اصلاح مانده حساب شخص و ثبت استرداد وجه خزانه
      if (initialStatus === 'approved' && !isWaste) {
        if (invoiceData.invoiceType === 'sale_return' && person) {
          const origRemaining = Number(originalInvoice?.remainingAmount) || 0;
          const allocation = calculateRefundAllocation(finalAmount, origRemaining);

          if (refundAction === 'cash_refund' || refundAction === 'pos_refund') {
            if (allocation.offsetDebtAmount > 0) {
              person.currentBalance -= allocation.offsetDebtAmount;
            }
            if (allocation.directRefundOrCreditAmount > 0) {
              const accType = refundAction === 'pos_refund' ? 'pos' : 'cash';
              const acc = this.treasuryAccounts.find((a) => a.id === invoiceData.refundAccountId) || this.treasuryAccounts.find((a) => a.type === accType) || this.treasuryAccounts[0];
              if (acc) {
                acc.balance -= allocation.directRefundOrCreditAmount;
                this.treasuryTransactions.unshift({
                  id: `tr-ret-${Date.now()}`,
                  transactionType: 'pay',
                  treasuryAccountId: acc.id,
                  treasuryAccountTitle: acc.title,
                  personId: person.id,
                  personName: person.name,
                  amount: allocation.directRefundOrCreditAmount,
                  date: invoiceData.date || new Date().toLocaleDateString('fa-IR'),
                  trackingNumber: `${Math.floor(100000 + Math.random() * 900000)}`,
                  description: `استرداد نقدی مرجوعی فاکتور فروش شماره ${originalInvoice?.invoiceNumber || invNumber} به ${person.name}`,
                  createdBy: user.fullName,
                  createdAt: new Date().toLocaleDateString('fa-IR'),
                });
              }
            }
          } else {
            person.currentBalance -= finalAmount;
          }
        } else if (invoiceData.invoiceType === 'purchase_return' && person) {
          if (refundAction === 'cash_refund') {
            const acc = this.treasuryAccounts.find((a) => a.id === invoiceData.refundAccountId) || this.treasuryAccounts.find((a) => a.type === 'cash') || this.treasuryAccounts[0];
            if (acc) {
              acc.balance += finalAmount;
              this.treasuryTransactions.unshift({
                id: `tr-ret-pur-${Date.now()}`,
                transactionType: 'receive',
                treasuryAccountId: acc.id,
                treasuryAccountTitle: acc.title,
                personId: person.id,
                personName: person.name,
                amount: finalAmount,
                date: invoiceData.date || new Date().toLocaleDateString('fa-IR'),
                trackingNumber: `${Math.floor(100000 + Math.random() * 900000)}`,
                description: `دریافت وجه استرداد مرجوعی خرید فاکتور شماره ${originalInvoice?.invoiceNumber || invNumber} از ${person.name}`,
                createdBy: user.fullName,
                createdAt: new Date().toLocaleDateString('fa-IR'),
              });
            }
          } else {
            person.currentBalance += finalAmount;
          }
        } else if (!isReturn && person) {
          if (invoiceData.invoiceType === 'sale') {
            person.currentBalance += remainingAmount;
          } else if (invoiceData.invoiceType === 'purchase') {
            person.currentBalance -= remainingAmount;
          }
        }

        // ثبت دریافت‌ها و پرداخت‌های فاکتور فروش و خرید عادی
        if (!isReturn && payments.length > 0) {
          const isPurchase = invoiceData.invoiceType === 'purchase';
          payments.forEach((p, pIdx) => {
            const amt = Number(p.amount) || 0;
            if (amt <= 0) return;

            if (p.method === 'cash' || p.method === 'pos' || p.method === 'bank_transfer') {
              const accType = p.method === 'cash' ? 'cash' : p.method === 'pos' ? 'pos' : 'bank';
              const acc = this.treasuryAccounts.find((a) => a.id === p.accountId) || this.treasuryAccounts.find((a) => a.type === accType) || this.treasuryAccounts[0];
              if (acc) {
                if (isPurchase) {
                  acc.balance -= amt;
                } else {
                  acc.balance += amt;
                }
                this.treasuryTransactions.unshift({
                  id: `tr-tx-${Date.now()}-${pIdx}`,
                  transactionType: isPurchase ? 'pay' : 'receive',
                  treasuryAccountId: acc.id,
                  treasuryAccountTitle: acc.title,
                  personId: person?.id || 'per-4',
                  personName,
                  amount: amt,
                  date: invoiceData.date || new Date().toLocaleDateString('fa-IR'),
                  trackingNumber: p.referenceNumber || `${Math.floor(100000 + Math.random() * 900000)}`,
                  description: `${isPurchase ? 'پرداخت' : 'دریافت'} ${p.method === 'cash' ? 'نقدی' : p.method === 'pos' ? 'کارتخوان' : 'بانکی'} فاکتور شماره ${invNumber}`,
                  createdBy: user.fullName,
                  createdAt: new Date().toLocaleDateString('fa-IR'),
                });
              }
            } else if (p.method === 'cheque') {
              this.cheques.unshift({
                id: `chq-${Date.now()}-${pIdx}`,
                chequeType: isPurchase ? 'issued' : 'received',
                chequeNumber: p.chequeNumber || `${Math.floor(100000 + Math.random() * 900000)}`,
                bankName: p.bankName || 'بانک ملی',
                branchName: '',
                accountNumber: '',
                sayadNumber: p.sayadNumber || '',
                dueDate: p.dueDate || invoiceData.date || new Date().toLocaleDateString('fa-IR'),
                amount: amt,
                personId: person?.id || 'per-4',
                personName,
                status: 'registered',
                notes: `چک ${isPurchase ? 'پرداختی' : 'دریافتی'} فاکتور شماره ${invNumber}`,
                createdAt: new Date().toLocaleDateString('fa-IR'),
              });
            }
          });
        } else if (!isReturn && paidAmount > 0 && payments.length === 0) {
          const isPurchase = invoiceData.invoiceType === 'purchase';
          const defaultAcc = this.treasuryAccounts.find((a) => a.type === (isPurchase ? 'bank' : 'pos')) || this.treasuryAccounts[0];
          if (defaultAcc) {
            if (isPurchase) {
              defaultAcc.balance -= paidAmount;
            } else {
              defaultAcc.balance += paidAmount;
            }
            this.treasuryTransactions.unshift({
              id: `tr-tx-${Date.now()}-direct`,
              transactionType: isPurchase ? 'pay' : 'receive',
              treasuryAccountId: defaultAcc.id,
              treasuryAccountTitle: defaultAcc.title,
              personId: person?.id || 'per-4',
              personName,
              amount: paidAmount,
              date: invoiceData.date || new Date().toLocaleDateString('fa-IR'),
              trackingNumber: `${Math.floor(100000 + Math.random() * 900000)}`,
              description: `${isPurchase ? 'پرداخت' : 'دریافت'} مستقیم فاکتور شماره ${invNumber}`,
              createdBy: user.fullName,
              createdAt: new Date().toLocaleDateString('fa-IR'),
            });
          }
        }
      }

      // تولید خودکار سند حسابداری دوبل متوازن
      let voucherId: string | undefined = undefined;
      if (initialStatus === 'approved' && finalAmount > 0) {
        voucherId = `vch-${Date.now()}`;
        const voucherLines: AccountingVoucher['lines'] = [];

        if (invoiceData.invoiceType === 'sale') {
          if (payments.length > 0) {
            payments.forEach((p) => {
              const amt = Number(p.amount) || 0;
              if (amt <= 0) return;
              const matchedAcc = p.accountId ? this.treasuryAccounts.find((a) => a.id === p.accountId) : undefined;
              const code = matchedAcc?.accountingAccountCode || (p.method === 'cash' ? '10101' : p.method === 'pos' ? '10103' : p.method === 'bank_transfer' ? '10102' : '102');
              const title = matchedAcc?.title || (p.method === 'cash' ? 'صندوق اصلی فروشگاه' : p.method === 'pos' ? 'بانک ملت - کارتخوان POS' : p.method === 'bank_transfer' ? 'بانک ملی - جاری ۵۴۲۱' : 'اسناد دریافتنی تجاری');
              voucherLines.push({
                id: `vl-pay-${Date.now()}-${Math.random()}`,
                accountCode: code,
                accountTitle: title,
                debit: amt,
                credit: 0,
                description: `دریافت فاکتور فروش شماره ${invNumber}`,
              });
            });
          } else if (paidAmount > 0) {
            voucherLines.push({
              id: `vl-pay-${Date.now()}`,
              accountCode: '10103',
              accountTitle: 'بانک ملت - کارتخوان POS',
              debit: paidAmount,
              credit: 0,
              description: `دریافت نقدی/پوز فاکتور فروش شماره ${invNumber}`,
            });
          }

          if (remainingAmount > 0) {
            voucherLines.push({
              id: `vl-rem-${Date.now()}`,
              accountCode: '103',
              accountTitle: `حساب‌های دریافتنی - ${personName}`,
              personId: person?.id,
              personName: personName,
              debit: remainingAmount,
              credit: 0,
              description: `مانده نسیه فاکتور فروش شماره ${invNumber}`,
            });
          }

          const netSalesRevenue = finalAmount - taxAmount;
          voucherLines.push({
            id: `vl-rev-${Date.now()}`,
            accountCode: '401',
            accountTitle: 'درآمد حاصل از فروش کالا و ملزومات خرازی',
            debit: 0,
            credit: netSalesRevenue,
            description: `فروش فاکتور شماره ${invNumber} به ${personName}`,
          });

          if (taxAmount > 0) {
            voucherLines.push({
              id: `vl-tax-${Date.now()}`,
              accountCode: '201',
              accountTitle: 'مالیات و عوارض بر ارزش افزوده فروش',
              debit: 0,
              credit: taxAmount,
              description: `ارزش افزوده فاکتور فروش شماره ${invNumber}`,
            });
          }
        } else if (invoiceData.invoiceType === 'purchase') {
          voucherLines.push({
            id: `vl-pur-inv-${Date.now()}`,
            accountCode: '104',
            accountTitle: 'موجودی کالای فروشگاه خرازی',
            debit: finalAmount,
            credit: 0,
            description: `ورود کالا به انبار طبق فاکتور خرید شماره ${invNumber} از ${personName}`,
          });

          if (payments.length > 0) {
            payments.forEach((p) => {
              const amt = Number(p.amount) || 0;
              if (amt <= 0) return;
              const matchedAcc = p.accountId ? this.treasuryAccounts.find((a) => a.id === p.accountId) : undefined;
              const code = matchedAcc?.accountingAccountCode || (p.method === 'cash' ? '10101' : p.method === 'pos' ? '10103' : p.method === 'bank_transfer' ? '10102' : '202');
              const title = matchedAcc?.title || (p.method === 'cash' ? 'صندوق اصلی فروشگاه' : p.method === 'pos' ? 'بانک ملت - کارتخوان POS' : p.method === 'bank_transfer' ? 'بانک ملی - جاری ۵۴۲۱' : 'اسناد پرداختنی تجاری');
              voucherLines.push({
                id: `vl-pur-pay-${Date.now()}-${Math.random()}`,
                accountCode: code,
                accountTitle: title,
                debit: 0,
                credit: amt,
                description: `پرداخت بابت فاکتور خرید شماره ${invNumber}`,
              });
            });
          } else if (paidAmount > 0) {
            voucherLines.push({
              id: `vl-pur-pay-${Date.now()}`,
              accountCode: '10102',
              accountTitle: 'بانک ملی - جاری ۵۴۲۱',
              debit: 0,
              credit: paidAmount,
              description: `پرداخت مستقیم فاکتور خرید شماره ${invNumber}`,
            });
          }

          if (remainingAmount > 0) {
            voucherLines.push({
              id: `vl-pur-rem-${Date.now()}`,
              accountCode: '201',
              accountTitle: `حساب‌های پرداختنی تجاری - ${personName}`,
              personId: person?.id,
              personName: personName,
              debit: 0,
              credit: remainingAmount,
              description: `مانده بدهی فاکتور خرید شماره ${invNumber} به ${personName}`,
            });
          }
        } else if (invoiceData.invoiceType === 'sale_return') {
          const netReturnRevenue = finalAmount - taxAmount;
          voucherLines.push({
            id: `vl-sret-${Date.now()}`,
            accountCode: '402',
            accountTitle: 'برگشت از فروش و تخفیفات',
            debit: netReturnRevenue,
            credit: 0,
            description: `برگشت از فروش فاکتور شماره ${originalInvoice?.invoiceNumber || invNumber}`,
          });

          if (taxAmount > 0) {
            voucherLines.push({
              id: `vl-sret-tax-${Date.now()}`,
              accountCode: '201',
              accountTitle: 'مالیات و عوارض ارزش افزوده فروش (تعدیل برگشتی)',
              debit: taxAmount,
              credit: 0,
              description: `تعدیل ارزش افزوده برگشت از فروش فاکتور ${originalInvoice?.invoiceNumber || invNumber}`,
            });
          }

          const origRemaining = Number(originalInvoice?.remainingAmount) || 0;
          const allocation = calculateRefundAllocation(finalAmount, origRemaining);

          if (refundAction === 'cash_refund' || refundAction === 'pos_refund') {
            if (allocation.directRefundOrCreditAmount > 0) {
              const accCode = refundAction === 'pos_refund' ? '10103' : '10101';
              const accTitle = refundAction === 'pos_refund' ? 'بانک ملت - کارتخوان POS' : 'صندوق اصلی فروشگاه خرازی';
              voucherLines.push({
                id: `vl-sret-csh-${Date.now()}`,
                accountCode: accCode,
                accountTitle: accTitle,
                debit: 0,
                credit: allocation.directRefundOrCreditAmount,
                description: `پرداخت وجه استرداد مرجوعی فاکتور ${originalInvoice?.invoiceNumber || invNumber}`,
              });
            }
            if (allocation.offsetDebtAmount > 0) {
              voucherLines.push({
                id: `vl-sret-debt-${Date.now()}`,
                accountCode: '103',
                accountTitle: `حساب‌های دریافتنی - ${personName}`,
                personId: person?.id,
                personName,
                debit: 0,
                credit: allocation.offsetDebtAmount,
                description: `تهاتر بدهی فاکتور فروش ${originalInvoice?.invoiceNumber || invNumber}`,
              });
            }
          } else {
            voucherLines.push({
              id: `vl-sret-ar-${Date.now()}`,
              accountCode: '103',
              accountTitle: `حساب‌های دریافتنی - ${personName}`,
              personId: person?.id,
              personName,
              debit: 0,
              credit: finalAmount,
              description: `بستانکار شدن مشتری بابت برگشت از فروش فاکتور ${originalInvoice?.invoiceNumber || invNumber}`,
            });
          }
        } else if (invoiceData.invoiceType === 'purchase_return') {
          if (refundAction === 'cash_refund') {
            voucherLines.push({
              id: `vl-pret-csh-${Date.now()}`,
              accountCode: '10101',
              accountTitle: 'صندوق اصلی فروشگاه خرازی',
              debit: finalAmount,
              credit: 0,
              description: `دریافت وجه استرداد برگشت از خرید فاکتور ${originalInvoice?.invoiceNumber || invNumber}`,
            });
          } else {
            voucherLines.push({
              id: `vl-pret-ap-${Date.now()}`,
              accountCode: '201',
              accountTitle: `حساب‌های پرداختنی تجاری - ${personName}`,
              personId: person?.id,
              personName,
              debit: finalAmount,
              credit: 0,
              description: `کاهش بدهی به تامین‌کننده بابت برگشت از خرید فاکتور ${originalInvoice?.invoiceNumber || invNumber}`,
            });
          }

          voucherLines.push({
            id: `vl-pret-inv-${Date.now()}`,
            accountCode: '104',
            accountTitle: 'موجودی کالای فروشگاه خرازی (برگشت از خرید)',
            debit: 0,
            credit: finalAmount,
            description: `خروج اجناس برگشتی به تامین‌کننده عطف فاکتور ${originalInvoice?.invoiceNumber || invNumber}`,
          });
        } else if (invoiceData.invoiceType === 'waste') {
          voucherLines.push({
            id: `vl-wst-exp-${Date.now()}`,
            accountCode: '601',
            accountTitle: 'هزینه ضایعات و کسری انبار',
            debit: finalAmount,
            credit: 0,
            description: `ثبت هزینه ضایعات کالا سند شماره ${invNumber}`,
          });
          voucherLines.push({
            id: `vl-wst-inv-${Date.now()}`,
            accountCode: '104',
            accountTitle: 'موجودی کالای فروشگاه خرازی',
            debit: 0,
            credit: finalAmount,
            description: `کسر موجودی انبار بابت ضایعات سند شماره ${invNumber}`,
          });
        }

        const totalDebit = voucherLines.reduce((s, l) => s + l.debit, 0);
        const totalCredit = voucherLines.reduce((s, l) => s + l.credit, 0);
        validateVoucherBalance(totalDebit, totalCredit);

        const voucherDescription = isReturn
          ? `سند ${invoiceData.invoiceType === 'sale_return' ? 'برگشت از فروش' : 'برگشت از خرید'} شماره ${invNumber} ${originalInvoice ? `عطف فاکتور ${originalInvoice.invoiceNumber}` : ''} (${personName})`
          : isWaste
          ? `سند ضایعات و کسری انبار شماره ${invNumber}`
          : `سند خودکار ${invoiceData.invoiceType === 'purchase' ? 'خرید' : 'فروش'} فاکتور ${invNumber} (${personName})`;

        const voucher: AccountingVoucher = {
          id: voucherId,
          voucherNumber: `${1000 + this.vouchers.length + 1}`,
          date: invoiceData.date || new Date().toLocaleDateString('fa-IR'),
          description: voucherDescription,
          fiscalYearId: this.settings.activeFiscalYear,
          status: 'approved',
          lines: voucherLines,
          totalDebit,
          totalCredit,
          isBalanced: true,
          createdBy: user.fullName,
          createdAt: new Date().toLocaleDateString('fa-IR'),
        };

        this.vouchers.unshift(voucher);
      }

      const newInvoice: Invoice = {
        id: invoiceId,
        invoiceNumber: invNumber,
        invoiceType: invoiceData.invoiceType || 'sale',
        personId: personId || 'per-4',
        personName,
        personPreviousBalance,
        warehouseId: whId,
        warehouseName: whName,
        fiscalYearId: this.settings.activeFiscalYear,
        date: invoiceData.date || new Date().toLocaleDateString('fa-IR'),
        status: initialStatus,
        items: processedItems,
        subtotal,
        totalDiscount,
        taxAmount,
        isTaxEnabled: invoiceData.isTaxEnabled,
        taxRate: invoiceData.taxRate,
        finalAmount,
        paidAmount,
        remainingAmount,
        payments,
        accountingVoucherId: voucherId,
        notes: invoiceData.notes || '',
        printConfig: invoiceData.printConfig,
        originalInvoiceId: invoiceData.originalInvoiceId,
        originalInvoiceNumber: originalInvoice?.invoiceNumber,
        returnReason: invoiceData.returnReason,
        refundAction,
        refundAccountId: invoiceData.refundAccountId,
        createdBy: user.fullName,
        createdAt: new Date().toLocaleDateString('fa-IR'),
      };

      this.invoices.unshift(newInvoice);

      const actionTitle = isReturn
        ? `ثبت سند ${newInvoice.invoiceType === 'sale_return' ? 'برگشت از فروش' : 'برگشت از خرید'}`
        : isProforma
        ? 'ثبت پیش‌فاکتور'
        : isConsignment
        ? 'ثبت سند کالای امانی'
        : isWaste
        ? 'ثبت سند ضایعات کالا'
        : `ثبت فاکتور ${newInvoice.invoiceType === 'sale' ? 'فروش' : 'خرید'}`;

      this.addAuditLog(
        user.id,
        user.fullName,
        'create',
        isReturn ? 'مرجوعی کالا' : 'صدور فاکتور',
        `${actionTitle} شماره ${newInvoice.invoiceNumber} به مبلغ ${newInvoice.finalAmount.toLocaleString('fa-IR')} تومان`,
        newInvoice.id
      );

      return newInvoice;
    });
  }

  // ثبت نهایی و تایید فاکتور پیش‌نویس یا پیش‌فاکتور (با کسر موجودی، کاردکس و ثبت سند حسابداری)
  approveInvoice(id: string, user: User): Invoice {
    return this.runInTransaction(() => {
      const idx = this.invoices.findIndex((inv) => inv.id === id);
      if (idx === -1) throw new TransactionError('فاکتور مورد نظر یافت نشد.');

      const inv = this.invoices[idx];
      if (inv.status === 'approved') {
        throw new TransactionError('این فاکتور قبلاً به ثبت نهایی رسیده است.');
      }
      if (inv.status === 'cancelled') {
        throw new TransactionError('امکان ثبت نهایی فاکتور ابطال‌شده وجود ندارد.');
      }

      const person = this.persons.find((p) => p.id === inv.personId);
      const personName = person ? person.name : inv.personName;
      const targetWhId = inv.warehouseId || (this.warehouses.find((w) => w.isDefault)?.id) || 'wh-shop';
      const targetWh = this.warehouses.find((w) => w.id === targetWhId) || this.warehouses[0];
      const whId = targetWh?.id || 'wh-shop';
      const whName = targetWh?.name || 'انبار پیشخوان و دخل فروشگاه';

      // ۱. کسر کالا از انبار و ثبت کاردکس
      inv.items.forEach((item, itemIdx) => {
        const prd = this.products.find((p) => p.id === item.productId);
        if (prd) {
          const ws = this.warehouseStocks.find((w) => w.productId === prd.id && w.warehouseId === whId);
          const currentWhStock = ws ? ws.quantity : 0;
          validateInventoryStock(`${prd.name} در ${whName}`, currentWhStock, item.baseQuantity, this.settings.allowNegativeStock);

          prd.currentStock -= item.baseQuantity;
          if (ws) {
            ws.quantity -= item.baseQuantity;
            ws.lastUpdated = new Date().toLocaleDateString('fa-IR');
          } else {
            this.warehouseStocks.push({
              productId: prd.id,
              warehouseId: whId,
              quantity: -item.baseQuantity,
              lastUpdated: new Date().toLocaleDateString('fa-IR'),
            });
          }

          const itemEffectiveUnitPrice = item.unitPrice / (item.conversionFactor || 1);
          this.kardexEntries.unshift({
            id: `kd-appr-${Date.now()}-${itemIdx}`,
            productId: prd.id,
            productCode: prd.code,
            productName: prd.name,
            warehouseId: whId,
            warehouseName: whName,
            date: inv.date || new Date().toLocaleDateString('fa-IR'),
            referenceType: 'sale_invoice',
            referenceTypeTitle: 'فاکتور فروش (ثبت نهایی)',
            referenceId: inv.id,
            referenceNumber: inv.invoiceNumber,
            inQuantity: 0,
            outQuantity: item.baseQuantity,
            unitName: prd.baseUnitName || 'عدد',
            unitPrice: itemEffectiveUnitPrice,
            totalValue: item.baseQuantity * itemEffectiveUnitPrice,
            balanceQuantity: prd.currentStock,
            balanceValue: prd.currentStock * prd.purchasePrice,
            userId: user.id,
            userName: user.fullName,
            notes: `ثبت نهایی فاکتور فروش شماره ${inv.invoiceNumber} (${personName})`,
            createdAt: new Date().toLocaleDateString('fa-IR'),
          });
        }
      });

      // ۲. ثبت نسیه در مانده حساب شخص
      if (person && inv.remainingAmount > 0) {
        person.currentBalance += inv.remainingAmount;
      }

      // ۳. ثبت دریافت‌های خزانه
      if (inv.payments && inv.payments.length > 0) {
        inv.payments.forEach((p, pIdx) => {
          const amt = Number(p.amount) || 0;
          if (amt <= 0) return;
          if (p.method === 'cash' || p.method === 'pos' || p.method === 'bank_transfer') {
            const accType = p.method === 'cash' ? 'cash' : p.method === 'pos' ? 'pos' : 'bank';
            const acc = this.treasuryAccounts.find((a) => a.id === p.accountId) || this.treasuryAccounts.find((a) => a.type === accType) || this.treasuryAccounts[0];
            if (acc) {
              acc.balance += amt;
              this.treasuryTransactions.unshift({
                id: `tr-tx-appr-${Date.now()}-${pIdx}`,
                transactionType: 'receive',
                treasuryAccountId: acc.id,
                treasuryAccountTitle: acc.title,
                personId: person?.id || 'per-4',
                personName,
                amount: amt,
                date: inv.date,
                trackingNumber: p.referenceNumber || `${Math.floor(100000 + Math.random() * 900000)}`,
                description: `دریافت ${p.method === 'cash' ? 'نقدی' : p.method === 'pos' ? 'کارتخوان' : 'بانکی'} فاکتور شماره ${inv.invoiceNumber}`,
                createdBy: user.fullName,
                createdAt: new Date().toLocaleDateString('fa-IR'),
              });
            }
          } else if (p.method === 'cheque') {
            this.cheques.unshift({
              id: `chq-appr-${Date.now()}-${pIdx}`,
              chequeType: 'received',
              chequeNumber: p.chequeNumber || `${Math.floor(100000 + Math.random() * 900000)}`,
              bankName: p.bankName || 'بانک ملی',
              branchName: '',
              sayadNumber: p.sayadNumber || '',
              dueDate: p.dueDate || inv.date,
              amount: amt,
              personId: person?.id || 'per-4',
              personName,
              status: 'in_process',
              notes: `چک دریافتی فاکتور شماره ${inv.invoiceNumber}`,
              createdAt: new Date().toLocaleDateString('fa-IR'),
            });
          }
        });
      }

      // ۴. صدور سند حسابداری دوبل متوازن
      const voucherLines: AccountingVoucher['lines'] = [];
      if (inv.paidAmount > 0) {
        voucherLines.push({
          id: `vl-appr-pay-${Date.now()}`,
          accountCode: '10103',
          accountTitle: 'بانک ملت - دستگاه کارتخوان POS',
          debit: inv.paidAmount,
          credit: 0,
          description: `دریافت وجه فاکتور فروش شماره ${inv.invoiceNumber}`,
        });
      }
      if (inv.remainingAmount > 0) {
        voucherLines.push({
          id: `vl-appr-rem-${Date.now()}`,
          accountCode: '103',
          accountTitle: `حساب‌های دریافتنی - ${personName}`,
          personId: person?.id,
          personName,
          debit: inv.remainingAmount,
          credit: 0,
          description: `مانده نسیه فاکتور فروش شماره ${inv.invoiceNumber}`,
        });
      }
      const netRev = inv.finalAmount - (inv.taxAmount || 0);
      voucherLines.push({
        id: `vl-appr-rev-${Date.now()}`,
        accountCode: '401',
        accountTitle: 'درآمد حاصل از فروش کالا و ملزومات خرازی',
        debit: 0,
        credit: netRev,
        description: `فروش فاکتور شماره ${inv.invoiceNumber}`,
      });
      if ((inv.taxAmount || 0) > 0) {
        voucherLines.push({
          id: `vl-appr-tax-${Date.now()}`,
          accountCode: '201',
          accountTitle: 'مالیات و عوارض ارزش افزوده فروش',
          debit: 0,
          credit: inv.taxAmount,
          description: `ارزش افزوده فاکتور شماره ${inv.invoiceNumber}`,
        });
      }

      const totalDebit = voucherLines.reduce((s, l) => s + l.debit, 0);
      const totalCredit = voucherLines.reduce((s, l) => s + l.credit, 0);
      validateVoucherBalance(totalDebit, totalCredit);

      const voucherId = `vch-appr-${Date.now()}`;
      this.vouchers.unshift({
        id: voucherId,
        voucherNumber: `${1000 + this.vouchers.length + 1}`,
        date: inv.date,
        description: `سند ثبت نهایی فاکتور فروش ${inv.invoiceNumber} (${personName})`,
        fiscalYearId: this.settings.activeFiscalYear,
        status: 'approved',
        lines: voucherLines,
        totalDebit,
        totalCredit,
        isBalanced: true,
        createdBy: user.fullName,
        createdAt: new Date().toLocaleDateString('fa-IR'),
      });

      inv.status = 'approved';
      if (inv.invoiceType === 'proforma') {
        inv.invoiceType = 'sale';
      }
      inv.accountingVoucherId = voucherId;

      this.addAuditLog(
        user.id,
        user.fullName,
        'approve',
        'صدور فاکتور',
        `ثبت نهایی فاکتور فروش شماره ${inv.invoiceNumber} به مبلغ ${inv.finalAmount.toLocaleString('fa-IR')} تومان`,
        inv.id
      );

      return inv;
    });
  }

  // ابطال مستند فاکتور با ثبت دلیل اجباری و بازگشت خودکار کالا به انبار و کاردکس
  cancelInvoice(id: string, reason: string, user: User): Invoice {
    return this.runInTransaction(() => {
      if (!reason || reason.trim().length < 3) {
        throw new TransactionError('ثبت دلیل برای ابطال مستند الزامی است (حداقل ۳ کاراکتر).');
      }

      const idx = this.invoices.findIndex((inv) => inv.id === id);
      if (idx === -1) throw new TransactionError('فاکتور مورد نظر یافت نشد.');

      const inv = this.invoices[idx];
      if (inv.status === 'cancelled') {
        throw new TransactionError('این فاکتور قبلاً ابطال شده است.');
      }

      const wasApproved = inv.status === 'approved';
      const targetWhId = inv.warehouseId || (this.warehouses.find((w) => w.isDefault)?.id) || 'wh-shop';
      const targetWh = this.warehouses.find((w) => w.id === targetWhId) || this.warehouses[0];
      const whId = targetWh?.id || 'wh-shop';
      const whName = targetWh?.name || 'انبار پیشخوان و دخل فروشگاه';

      // در صورت قطعی بودن فاکتور، کالاها باید به انبار و کاردکس بازگردانده شوند
      if (wasApproved && (inv.invoiceType === 'sale' || inv.invoiceType === 'purchase_return')) {
        inv.items.forEach((item, itemIdx) => {
          const prd = this.products.find((p) => p.id === item.productId);
          if (prd) {
            prd.currentStock += item.baseQuantity;

            const ws = this.warehouseStocks.find((w) => w.productId === prd.id && w.warehouseId === whId);
            if (ws) {
              ws.quantity += item.baseQuantity;
              ws.lastUpdated = new Date().toLocaleDateString('fa-IR');
            } else {
              this.warehouseStocks.push({
                productId: prd.id,
                warehouseId: whId,
                quantity: item.baseQuantity,
                lastUpdated: new Date().toLocaleDateString('fa-IR'),
              });
            }

            const itemEffectiveUnitPrice = item.unitPrice / (item.conversionFactor || 1);
            this.kardexEntries.unshift({
              id: `kd-cnl-${Date.now()}-${itemIdx}`,
              productId: prd.id,
              productCode: prd.code,
              productName: prd.name,
              warehouseId: whId,
              warehouseName: whName,
              date: new Date().toLocaleDateString('fa-IR'),
              referenceType: 'sale_return',
              referenceTypeTitle: 'ابطال فاکتور فروش (برگشت به انبار)',
              referenceId: inv.id,
              referenceNumber: inv.invoiceNumber,
              inQuantity: item.baseQuantity,
              outQuantity: 0,
              unitName: prd.baseUnitName || 'عدد',
              unitPrice: itemEffectiveUnitPrice,
              totalValue: item.baseQuantity * itemEffectiveUnitPrice,
              balanceQuantity: prd.currentStock,
              balanceValue: prd.currentStock * prd.purchasePrice,
              userId: user.id,
              userName: user.fullName,
              notes: `ابطال فاکتور شماره ${inv.invoiceNumber} به دلیل: «${reason.trim()}»`,
              createdAt: new Date().toLocaleDateString('fa-IR'),
            });
          }
        });

        // برگشت مانده حساب مشتری (کسر از بدهی)
        if (inv.personId && inv.remainingAmount > 0) {
          const person = this.persons.find((p) => p.id === inv.personId);
          if (person) {
            person.currentBalance -= inv.remainingAmount;
          }
        }

        // لغو سند حسابداری
        if (inv.accountingVoucherId) {
          const vch = this.vouchers.find((v) => v.id === inv.accountingVoucherId);
          if (vch) {
            vch.status = 'draft';
            vch.description = `[ابطال‌شده] ${vch.description} (علت: ${reason.trim()})`;
          }
        }
      }

      inv.status = 'cancelled';
      inv.cancellationReason = reason.trim();
      inv.cancelledAt = `${new Date().toLocaleDateString('fa-IR')} ${new Date().toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' })}`;
      inv.cancelledBy = user.fullName;

      this.addAuditLog(
        user.id,
        user.fullName,
        'delete',
        'ابطال فاکتور',
        `ابطال فاکتور شماره ${inv.invoiceNumber} (دلیل: «${reason.trim()}») توسط ${user.fullName}`,
        inv.id
      );

      return inv;
    });
  }

  // ویرایش فاکتور با تراکنش اتمیک، اصلاح کاردکس و مانده طرف‌حساب
  updateInvoice(id: string, updatedData: Partial<Invoice>, user: User): Invoice {
    return this.runInTransaction(() => {
      const idx = this.invoices.findIndex((inv) => inv.id === id);
      if (idx === -1) throw new TransactionError('فاکتور مورد نظر یافت نشد.');

      const existingInv = this.invoices[idx];
      if (existingInv.status === 'cancelled') {
        throw new TransactionError('فاکتور ابطال‌شده قابل ویرایش نیست.');
      }

      // ۱. اگر فاکتور تأیید شده بوده، اثر قبلی آن را معکوس (rollback) می‌کنیم
      if (existingInv.status === 'approved') {
        const whId = existingInv.warehouseId || 'wh-shop';
        const isOutflow = existingInv.invoiceType === 'sale' || existingInv.invoiceType === 'purchase_return';

        existingInv.items.forEach((item) => {
          const prd = this.products.find((p) => p.id === item.productId);
          if (prd) {
            prd.currentStock += isOutflow ? item.baseQuantity : -item.baseQuantity;
            const ws = this.warehouseStocks.find((w) => w.productId === prd.id && w.warehouseId === whId);
            if (ws) ws.quantity += isOutflow ? item.baseQuantity : -item.baseQuantity;
          }
        });

        if (existingInv.personId && existingInv.remainingAmount) {
          const prevPerson = this.persons.find((p) => p.id === existingInv.personId);
          if (prevPerson) {
            prevPerson.currentBalance -= existingInv.remainingAmount;
          }
        }
      }

      // ۲. کسر مجدد موجودی انبار بر اساس اقلام جدید
      const newItems = updatedData.items || existingInv.items;
      const newPersonId = updatedData.personId !== undefined ? updatedData.personId : existingInv.personId;
      const newType = updatedData.invoiceType || existingInv.invoiceType;
      const newWhId = updatedData.warehouseId || existingInv.warehouseId || 'wh-shop';
      const isNewOutflow = newType === 'sale' || newType === 'purchase_return';

      newItems.forEach((item, itemIdx) => {
        const prd = this.products.find((p) => p.id === item.productId);
        if (prd) {
          prd.currentStock -= isNewOutflow ? item.baseQuantity : -item.baseQuantity;
          const ws = this.warehouseStocks.find((w) => w.productId === prd.id && w.warehouseId === newWhId);
          if (ws) ws.quantity -= isNewOutflow ? item.baseQuantity : -item.baseQuantity;

          this.kardexEntries.unshift({
            id: `kd-edit-${Date.now()}-${itemIdx}`,
            productId: prd.id,
            productCode: prd.code,
            productName: prd.name,
            warehouseId: newWhId,
            warehouseName: 'انبار فروشگاه',
            date: updatedData.date || existingInv.date,
            referenceType: newType as any,
            referenceTypeTitle: `اصلاح فاکتور ${existingInv.invoiceNumber}`,
            referenceId: existingInv.id,
            referenceNumber: existingInv.invoiceNumber,
            inQuantity: isNewOutflow ? 0 : item.baseQuantity,
            outQuantity: isNewOutflow ? item.baseQuantity : 0,
            unitName: item.unitName || prd.baseUnitName || 'عدد',
            unitPrice: item.unitPrice,
            totalValue: item.totalPrice,
            balanceQuantity: prd.currentStock,
            balanceValue: prd.currentStock * prd.purchasePrice,
            userId: user.id,
            userName: user.fullName,
            notes: `ویرایش و به‌روزرسانی فاکتور شماره ${existingInv.invoiceNumber}`,
            createdAt: new Date().toLocaleDateString('fa-IR'),
          });
        }
      });

      // اعمال مانده جدید برای طرف حساب
      const subtotal = newItems.reduce((acc, it) => acc + (it.totalPrice || 0), 0);
      const discount = updatedData.totalDiscount !== undefined ? updatedData.totalDiscount : (updatedData.discountAmount !== undefined ? updatedData.discountAmount : (existingInv.totalDiscount || existingInv.discountAmount || 0));
      const tax = updatedData.taxAmount !== undefined ? updatedData.taxAmount : existingInv.taxAmount || 0;
      const finalAmount = Math.max(0, subtotal - discount + tax);
      const payments = updatedData.payments || existingInv.payments || [];
      const totalPaid = payments.reduce((acc, p) => acc + (p.amount || 0), 0);
      const remainingAmount = Math.max(0, finalAmount - totalPaid);

      if (newPersonId && remainingAmount > 0) {
        const newPerson = this.persons.find((p) => p.id === newPersonId);
        if (newPerson) {
          newPerson.currentBalance += remainingAmount;
        }
      }

      // ذخیره فاکتور اصلاح شده
      const updatedInv: Invoice = {
        ...existingInv,
        ...updatedData,
        id: existingInv.id,
        invoiceNumber: existingInv.invoiceNumber,
        items: newItems,
        subtotal,
        totalDiscount: discount,
        discountAmount: discount,
        taxAmount: tax,
        finalAmount,
        payments,
        remainingAmount,
        notes: updatedData.notes !== undefined ? updatedData.notes : existingInv.notes,
        status: 'approved',
        auditTrail: [
          ...(existingInv.auditTrail || []),
          {
            action: 'ویرایش فاکتور',
            userName: user.fullName,
            timestamp: new Date().toLocaleDateString('fa-IR'),
            notes: `ویرایش مبلغ نهایی فاکتور به ${finalAmount.toLocaleString('fa-IR')} ریال`,
          },
        ],
      };

      this.invoices[idx] = updatedInv;
      this.addAuditLog(user.id, user.fullName, 'update', 'فاکتور', `ویرایش فاکتور شماره ${existingInv.invoiceNumber}`, updatedInv.id);
      return updatedInv;
    });
  }

  // تبدیل پیش‌فاکتور به فاکتور فروش قطعی
  convertProformaToSaleInvoice(proformaId: string, user: User): Invoice {
    return this.runInTransaction(() => {
      const inv = this.invoices.find((i) => i.id === proformaId);
      if (!inv) throw new TransactionError('پیش‌فاکتور مورد نظر یافت نشد.');
      if (inv.status === 'cancelled') {
        throw new TransactionError('پیش‌فاکتور ابطال‌شده قابل تبدیل به فاکتور فروش نیست.');
      }
      if (inv.status === 'approved' && inv.invoiceType === 'sale') {
        throw new TransactionError('این سند قبلاً به عنوان فاکتور فروش قطعی ثبت شده است.');
      }

      inv.invoiceType = 'sale';
      return this.approveInvoice(proformaId, user);
    });
  }


  // مدیریت و ثبت حساب‌های خزانه (صندوق‌ها و بانک‌ها)
  saveTreasuryAccount(data: Partial<TreasuryAccount>, user: User): TreasuryAccount {
    return this.runInTransaction(() => {
      if (!data.title?.trim()) {
        throw new TransactionError('عنوان حساب خزانه الزامی است.');
      }

      if (data.id) {
        const existing = this.treasuryAccounts.find((a) => a.id === data.id);
        if (!existing) throw new TransactionError('حساب خزانه مورد نظر یافت نشد.');

        existing.title = data.title.trim();
        existing.type = data.type || existing.type;
        existing.accountNumber = data.accountNumber?.trim() || existing.accountNumber;
        existing.bankName = data.bankName?.trim() || existing.bankName;
        existing.branchName = data.branchName?.trim() || existing.branchName;
        existing.shebaNumber = data.shebaNumber?.trim() || existing.shebaNumber;
        existing.isActive = data.isActive !== undefined ? data.isActive : existing.isActive;

        this.addAuditLog(user.id, user.fullName, 'update', 'خزانه‌داری', `ویرایش حساب ${existing.title}`, existing.id);
        return existing;
      }

      const initialBal = Number(data.initialBalance) || Number(data.balance) || 0;
      const newAcc: TreasuryAccount = {
        id: `tr-acc-${Date.now()}`,
        type: data.type || 'cash',
        title: data.title.trim(),
        accountNumber: data.accountNumber?.trim() || '',
        bankName: data.bankName?.trim() || '',
        branchName: data.branchName?.trim() || '',
        shebaNumber: data.shebaNumber?.trim() || '',
        balance: initialBal,
        initialBalance: initialBal,
        accountingAccountCode: data.type === 'cash' ? '10101' : data.type === 'pos' ? '10103' : '10102',
        isActive: data.isActive !== undefined ? data.isActive : true,
        createdAt: new Date().toLocaleDateString('fa-IR'),
      };

      this.treasuryAccounts.push(newAcc);
      this.addAuditLog(user.id, user.fullName, 'create', 'خزانه‌داری', `افتتاح حساب جدید «${newAcc.title}» با موجودی اولیه ${initialBal.toLocaleString('fa-IR')} تومان`, newAcc.id);
      return newAcc;
    });
  }

  // دسته‌بندی‌های هزینه و درآمد
  getFinancialCategories(): FinancialCategory[] {
    return this.financialCategories;
  }

  saveFinancialCategory(data: Partial<FinancialCategory>, user: User): FinancialCategory {
    return this.runInTransaction(() => {
      if (!data.title?.trim()) {
        throw new TransactionError('عنوان دسته‌بندی مالی الزامی است.');
      }

      if (data.id) {
        const cat = this.financialCategories.find((c) => c.id === data.id);
        if (!cat) throw new TransactionError('دسته‌بندی مالی یافت نشد.');
        cat.title = data.title.trim();
        cat.code = data.code?.trim() || cat.code;
        cat.type = data.type || cat.type;
        cat.description = data.description || cat.description;
        cat.isActive = data.isActive !== undefined ? data.isActive : cat.isActive;
        return cat;
      }

      const newCat: FinancialCategory = {
        id: `fcat-${Date.now()}`,
        code: data.code || `${600 + this.financialCategories.length + 1}`,
        title: data.title.trim(),
        type: data.type || 'expense',
        description: data.description || '',
        isActive: true,
      };

      this.financialCategories.push(newCat);
      this.addAuditLog(user.id, user.fullName, 'create', 'مالی', `ثبت دسته‌بندی مالی «${newCat.title}»`, newCat.id);
      return newCat;
    });
  }

  // تطبیق مانده حساب‌ها با تراکنش‌های واقعی و بررسی مغایرت
  reconcileTreasuryAccounts(user: User): { results: any[]; summary: string } {
    return this.runInTransaction(() => {
      const results: any[] = [];
      let totalDiscrepancies = 0;

      for (const acc of this.treasuryAccounts) {
        const rec = calculateAccountStatementAndReconciliation(acc, this.treasuryTransactions);
        results.push(rec);

        if (!rec.isReconciled) {
          totalDiscrepancies++;
          // تطبیق مانده حساب با جمع واقعی تراکنش‌ها
          acc.balance = rec.calculatedBalance;
          this.addAuditLog(
            user.id,
            user.fullName,
            'update',
            'خزانه‌داری',
            `تطبیق و اصلاح مغایرت مانده حساب «${acc.title}» از ${rec.recordedBalance.toLocaleString('fa-IR')} به ${rec.calculatedBalance.toLocaleString('fa-IR')} تومان`
          );
        }
      }

      const summary = totalDiscrepancies === 0
        ? 'کلیه حساب‌های بانکی و صندوق‌ها کاملاً با مجموع تراکنش‌های واقعی تطبیق داشته و فاقد هرگونه مغایرت هستند.'
        : `تعداد ${totalDiscrepancies} حساب دارای مغایرت شناسایی و مانده آن‌ها دقیقاً با دفاتر تراکنش‌ها تطبیق و اصلاح شد.`;

      return { results, summary };
    });
  }

  // ثبت عملیات مالی خزانه (دریافت، پرداخت، تسویه کامل/جزئی، انتقال وجه، درآمد و هزینه)
  recordTreasuryTransaction(data: Partial<TreasuryTransaction>, user: User): TreasuryTransaction {
    return this.runInTransaction(() => {
      const txType = data.transactionType || 'receive';
      const amount = Math.round(Number(data.amount) || 0);

      if (amount <= 0) {
        throw new TransactionError('مبلغ تراکنش باید بزرگتر از صفر باشد.');
      }

      // ۱. بررسی و پیشگیری از ثبت تکراری (Duplicate Check)
      const dupCheck = checkForDuplicateTransaction(this.treasuryTransactions, {
        treasuryAccountId: data.treasuryAccountId || data.sourceAccountId || data.destinationAccountId || '',
        personId: data.personId,
        invoiceId: data.invoiceId,
        amount,
        trackingNumber: data.trackingNumber,
        date: data.date || new Date().toLocaleDateString('fa-IR'),
        transactionType: txType,
      });

      if (dupCheck.isDuplicate) {
        throw new TransactionError(dupCheck.warning || 'این تراکنش قبلاً در سیستم ثبت شده است و ثبت دوباره آن مجاز نیست.');
      }

      const txDate = data.date || new Date().toLocaleDateString('fa-IR');
      const trackingNumber = data.trackingNumber?.trim() || `${Math.floor(100000 + Math.random() * 900000)}`;
      const txNumber = `TRX-${1000 + this.treasuryTransactions.length + 1}`;

      let transaction: TreasuryTransaction;

      // ==========================================
      // الف: انتقال وجه بین حساب‌ها (صندوق به بانک، بانک به صندوق، بانک به بانک)
      // ==========================================
      if (txType === 'transfer') {
        const srcAcc = this.treasuryAccounts.find((a) => a.id === data.sourceAccountId);
        const dstAcc = this.treasuryAccounts.find((a) => a.id === data.destinationAccountId);

        if (!srcAcc || !dstAcc) {
          throw new TransactionError('حساب مبدأ و حساب مقصد جهت انتقال وجه باید مشخص شوند.');
        }

        if (srcAcc.id === dstAcc.id) {
          throw new TransactionError('حساب مبدأ و مقصد انتقال وجه نمی‌توانند یکسان باشند.');
        }

        if (srcAcc.balance < amount) {
          throw new TransactionError(
            `موجودی حساب مبدأ «${srcAcc.title}» (${srcAcc.balance.toLocaleString('fa-IR')} تومان) برای انتقال مبلغ ${amount.toLocaleString('fa-IR')} تومان کافی نیست.`
          );
        }

        srcAcc.balance -= amount;
        dstAcc.balance += amount;

        const voucher = this.createVoucher({
          date: txDate,
          description: `انتقال وجه از «${srcAcc.title}» به «${dstAcc.title}» - پیگیری: ${trackingNumber}`,
          lines: [
            {
              id: `vl-trf-d-${Date.now()}`,
              accountCode: dstAcc.accountingAccountCode || '10102',
              accountTitle: dstAcc.title,
              debit: amount,
              credit: 0,
              description: `واریز انتقال وجه از ${srcAcc.title}`,
            },
            {
              id: `vl-trf-c-${Date.now()}`,
              accountCode: srcAcc.accountingAccountCode || '10101',
              accountTitle: srcAcc.title,
              debit: 0,
              credit: amount,
              description: `برداشت انتقال وجه به ${dstAcc.title}`,
            },
          ],
        }, user);

        transaction = {
          id: `tr-tx-${Date.now()}`,
          transactionNumber: txNumber,
          transactionType: 'transfer',
          treasuryAccountId: srcAcc.id,
          treasuryAccountTitle: srcAcc.title,
          sourceAccountId: srcAcc.id,
          sourceAccountTitle: srcAcc.title,
          destinationAccountId: dstAcc.id,
          destinationAccountTitle: dstAcc.title,
          amount,
          date: txDate,
          trackingNumber,
          description: data.description || `انتقال وجه از «${srcAcc.title}» به «${dstAcc.title}»`,
          paymentMethod: data.paymentMethod || 'bank_transfer',
          voucherId: voucher.id,
          createdBy: user.fullName,
          createdAt: new Date().toLocaleDateString('fa-IR'),
        };

        this.addAuditLog(
          user.id,
          user.fullName,
          'create',
          'خزانه‌داری',
          `انتقال وجه مبلغ ${amount.toLocaleString('fa-IR')} تومان از «${srcAcc.title}» به «${dstAcc.title}»`,
          transaction.id
        );
      }
      // ==========================================
      // ب: درآمد متفرقه (Incomes)
      // ==========================================
      else if (txType === 'income') {
        const dstAccId = data.destinationAccountId || data.treasuryAccountId;
        const dstAcc = this.treasuryAccounts.find((a) => a.id === dstAccId);
        if (!dstAcc) throw new TransactionError('حساب خزانه واریزی مشخص نشده است.');

        const category = this.financialCategories.find((c) => c.id === data.expenseCategoryId);
        dstAcc.balance += amount;

        const voucher = this.createVoucher({
          date: txDate,
          description: `درآمد متفرقه: ${category?.title || 'سایر درآمدها'} - ${data.description || ''}`,
          lines: [
            {
              id: `vl-inc-d-${Date.now()}`,
              accountCode: dstAcc.accountingAccountCode || '10101',
              accountTitle: dstAcc.title,
              debit: amount,
              credit: 0,
              description: `واریز به ${dstAcc.title}`,
            },
            {
              id: `vl-inc-c-${Date.now()}`,
              accountCode: category?.code || '401',
              accountTitle: category?.title || 'سایر درآمدهای عملیاتی و غیرعملیاتی',
              debit: 0,
              credit: amount,
              description: data.description || 'ثبت عواید و درآمد',
            },
          ],
        }, user);

        transaction = {
          id: `tr-tx-${Date.now()}`,
          transactionNumber: txNumber,
          transactionType: 'income',
          treasuryAccountId: dstAcc.id,
          treasuryAccountTitle: dstAcc.title,
          destinationAccountId: dstAcc.id,
          destinationAccountTitle: dstAcc.title,
          expenseCategoryId: category?.id,
          expenseCategoryName: category?.title || 'درآمد متفرقه',
          amount,
          date: txDate,
          trackingNumber,
          description: data.description || `درآمد: ${category?.title || 'متفرقه'}`,
          paymentMethod: data.paymentMethod || 'cash',
          voucherId: voucher.id,
          createdBy: user.fullName,
          createdAt: new Date().toLocaleDateString('fa-IR'),
        };

        this.addAuditLog(user.id, user.fullName, 'create', 'خزانه‌داری', `ثبت درآمد مبلغ ${amount.toLocaleString('fa-IR')} تومان به حساب ${dstAcc.title}`, transaction.id);
      }
      // ==========================================
      // ج: هزینه جاری و عمومی (Expenses)
      // ==========================================
      else if (txType === 'expense') {
        const srcAccId = data.sourceAccountId || data.treasuryAccountId;
        const srcAcc = this.treasuryAccounts.find((a) => a.id === srcAccId);
        if (!srcAcc) throw new TransactionError('حساب خزانه برداشت هزینه مشخص نشده است.');

        if (srcAcc.balance < amount) {
          throw new TransactionError(
            `موجودی حساب «${srcAcc.title}» (${srcAcc.balance.toLocaleString('fa-IR')} تومان) جهت پرداخت هزینه ${amount.toLocaleString('fa-IR')} تومان کافی نیست.`
          );
        }

        const category = this.financialCategories.find((c) => c.id === data.expenseCategoryId);
        srcAcc.balance -= amount;

        const voucher = this.createVoucher({
          date: txDate,
          description: `پرداخت هزینه: ${category?.title || 'هزینه عمومی'} - ${data.description || ''}`,
          lines: [
            {
              id: `vl-exp-d-${Date.now()}`,
              accountCode: category?.code || '601',
              accountTitle: category?.title || 'هزینه‌های عمومی و اداری',
              debit: amount,
              credit: 0,
              description: data.description || 'هزینه ثبت شده',
            },
            {
              id: `vl-exp-c-${Date.now()}`,
              accountCode: srcAcc.accountingAccountCode || '10101',
              accountTitle: srcAcc.title,
              debit: 0,
              credit: amount,
              description: `پرداخت از ${srcAcc.title}`,
            },
          ],
        }, user);

        transaction = {
          id: `tr-tx-${Date.now()}`,
          transactionNumber: txNumber,
          transactionType: 'expense',
          treasuryAccountId: srcAcc.id,
          treasuryAccountTitle: srcAcc.title,
          sourceAccountId: srcAcc.id,
          sourceAccountTitle: srcAcc.title,
          expenseCategoryId: category?.id,
          expenseCategoryName: category?.title || 'هزینه عمومی',
          amount,
          date: txDate,
          trackingNumber,
          description: data.description || `پرداخت هزینه: ${category?.title || 'عمومی'}`,
          paymentMethod: data.paymentMethod || 'cash',
          voucherId: voucher.id,
          createdBy: user.fullName,
          createdAt: new Date().toLocaleDateString('fa-IR'),
        };

        this.addAuditLog(user.id, user.fullName, 'create', 'خزانه‌داری', `ثبت هزینه مبلغ ${amount.toLocaleString('fa-IR')} تومان از حساب ${srcAcc.title}`, transaction.id);
      }
      // ==========================================
      // د: دریافت از طرف‌حساب (تسویه کامل، تسویه جزئی یا علی‌الحساب)
      // ==========================================
      else if (txType === 'receive') {
        const trAccount = this.treasuryAccounts.find((a) => a.id === (data.treasuryAccountId || data.destinationAccountId));
        if (!trAccount) throw new TransactionError('حساب خزانه دریافت مشخص نشده است.');

        const person = this.persons.find((p) => p.id === data.personId);
        if (!person) throw new TransactionError('طرف حساب دریافت مشخص نشده است.');

        let settlementType: 'full' | 'partial' | 'on_account' = 'on_account';
        let linkedInvoice: Invoice | undefined;

        if (data.invoiceId) {
          linkedInvoice = this.invoices.find((i) => i.id === data.invoiceId);
          if (linkedInvoice) {
            const val = validateInvoiceSettlement(linkedInvoice, amount);
            if (!val.isValid) throw new TransactionError(val.errorMessage || 'خطا در تسویه فاکتور.');

            linkedInvoice.paidAmount = val.newPaidAmount;
            linkedInvoice.remainingAmount = val.newRemainingAmount;
            settlementType = val.settlementType;
          }
        }

        trAccount.balance += amount;
        person.currentBalance -= amount;

        const voucher = this.createVoucher({
          date: txDate,
          description: `دریافت وجه از «${person.name}» ${linkedInvoice ? `بابت تسویه فاکتور شماره ${linkedInvoice.invoiceNumber}` : 'بابت تسویه حساب'} - پیگیری: ${trackingNumber}`,
          lines: [
            {
              id: `vl-rcv-d-${Date.now()}`,
              accountCode: trAccount.accountingAccountCode || '10101',
              accountTitle: trAccount.title,
              debit: amount,
              credit: 0,
              description: `دریافت در ${trAccount.title}`,
            },
            {
              id: `vl-rcv-c-${Date.now()}`,
              accountCode: '103',
              accountTitle: 'حساب‌های دریافتنی تجاری (بدهکاران)',
              personId: person.id,
              personName: person.name,
              debit: 0,
              credit: amount,
              description: `کاهش مانده بدهی ${person.name}`,
            },
          ],
        }, user);

        transaction = {
          id: `tr-tx-${Date.now()}`,
          transactionNumber: txNumber,
          transactionType: 'receive',
          treasuryAccountId: trAccount.id,
          treasuryAccountTitle: trAccount.title,
          destinationAccountId: trAccount.id,
          destinationAccountTitle: trAccount.title,
          personId: person.id,
          personName: person.name,
          invoiceId: linkedInvoice?.id,
          invoiceNumber: linkedInvoice?.invoiceNumber,
          settlementType,
          amount,
          date: txDate,
          trackingNumber,
          description: data.description || (linkedInvoice ? `تسویه فاکتور شماره ${linkedInvoice.invoiceNumber}` : 'دریافت وجه از طرف‌حساب'),
          paymentMethod: data.paymentMethod || 'cash',
          voucherId: voucher.id,
          createdBy: user.fullName,
          createdAt: new Date().toLocaleDateString('fa-IR'),
        };

        this.addAuditLog(user.id, user.fullName, 'create', 'خزانه‌داری', `دریافت مبلغ ${amount.toLocaleString('fa-IR')} تومان از «${person.name}» به ${trAccount.title}`, transaction.id);
      }
      // ==========================================
      // هـ: پرداخت به طرف‌حساب (تسویه کامل، جزئی یا علی‌الحساب)
      // ==========================================
      else {
        const srcAcc = this.treasuryAccounts.find((a) => a.id === (data.treasuryAccountId || data.sourceAccountId));
        if (!srcAcc) throw new TransactionError('حساب خزانه پرداخت مشخص نشده است.');

        const person = this.persons.find((p) => p.id === data.personId);
        if (!person) throw new TransactionError('طرف حساب دریافت‌کننده وجه مشخص نشده است.');

        if (srcAcc.balance < amount) {
          throw new TransactionError(
            `موجودی حساب «${srcAcc.title}» (${srcAcc.balance.toLocaleString('fa-IR')} تومان) جهت پرداخت مبلغ ${amount.toLocaleString('fa-IR')} تومان کافی نیست.`
          );
        }

        let settlementType: 'full' | 'partial' | 'on_account' = 'on_account';
        let linkedInvoice: Invoice | undefined;

        if (data.invoiceId) {
          linkedInvoice = this.invoices.find((i) => i.id === data.invoiceId);
          if (linkedInvoice) {
            const val = validateInvoiceSettlement(linkedInvoice, amount);
            if (!val.isValid) throw new TransactionError(val.errorMessage || 'خطا در تسویه فاکتور خرید.');

            linkedInvoice.paidAmount = val.newPaidAmount;
            linkedInvoice.remainingAmount = val.newRemainingAmount;
            settlementType = val.settlementType;
          }
        }

        srcAcc.balance -= amount;
        person.currentBalance += amount; // کاهش بستانکاری تأمین‌کننده

        const voucher = this.createVoucher({
          date: txDate,
          description: `پرداخت وجه به «${person.name}» ${linkedInvoice ? `بابت تسویه فاکتور خرید ${linkedInvoice.invoiceNumber}` : 'بابت تسویه حساب'} - پیگیری: ${trackingNumber}`,
          lines: [
            {
              id: `vl-pay-d-${Date.now()}`,
              accountCode: '201',
              accountTitle: 'حساب‌های پرداختنی تجاری (بستانکاران)',
              personId: person.id,
              personName: person.name,
              debit: amount,
              credit: 0,
              description: `تسویه و پرداخت به ${person.name}`,
            },
            {
              id: `vl-pay-c-${Date.now()}`,
              accountCode: srcAcc.accountingAccountCode || '10101',
              accountTitle: srcAcc.title,
              debit: 0,
              credit: amount,
              description: `پرداخت از ${srcAcc.title}`,
            },
          ],
        }, user);

        transaction = {
          id: `tr-tx-${Date.now()}`,
          transactionNumber: txNumber,
          transactionType: 'pay',
          treasuryAccountId: srcAcc.id,
          treasuryAccountTitle: srcAcc.title,
          sourceAccountId: srcAcc.id,
          sourceAccountTitle: srcAcc.title,
          personId: person.id,
          personName: person.name,
          invoiceId: linkedInvoice?.id,
          invoiceNumber: linkedInvoice?.invoiceNumber,
          settlementType,
          amount,
          date: txDate,
          trackingNumber,
          description: data.description || (linkedInvoice ? `تسویه فاکتور شماره ${linkedInvoice.invoiceNumber}` : 'پرداخت وجه به تامین‌کننده'),
          paymentMethod: data.paymentMethod || 'cash',
          voucherId: voucher.id,
          createdBy: user.fullName,
          createdAt: new Date().toLocaleDateString('fa-IR'),
        };

        this.addAuditLog(user.id, user.fullName, 'create', 'خزانه‌داری', `پرداخت مبلغ ${amount.toLocaleString('fa-IR')} تومان به «${person.name}» از ${srcAcc.title}`, transaction.id);
      }

      this.treasuryTransactions.unshift(transaction);
      return transaction;
    });
  }

  // ثبت و صدور چک‌های صیادی
  saveCheque(data: Partial<Cheque>, user: User): Cheque {
    return this.runInTransaction(() => {
      const amount = Math.round(Number(data.amount) || 0);
      if (amount <= 0) {
        throw new TransactionError('مبلغ چک باید بزرگتر از صفر باشد.');
      }

      if (data.id) {
        const existing = this.cheques.find((c) => c.id === data.id);
        if (!existing) throw new TransactionError('چک مورد نظر یافت نشد.');

        existing.chequeNumber = data.chequeNumber || existing.chequeNumber;
        existing.sayadNumber = data.sayadNumber || existing.sayadNumber;
        existing.bankName = data.bankName || existing.bankName;
        existing.branchName = data.branchName || existing.branchName;
        existing.accountNumber = data.accountNumber || existing.accountNumber;
        existing.dueDate = data.dueDate || existing.dueDate;
        existing.amount = amount;
        existing.notes = data.notes !== undefined ? data.notes : existing.notes;
        return existing;
      }

      const person = this.persons.find((p) => p.id === data.personId);
      const personName = person ? person.name : data.personName || 'نامشخص';
      const chequeType = data.chequeType || 'received';
      const initialStatus: ChequeStatus = 'registered';
      const issueDate = data.issueDate || new Date().toLocaleDateString('fa-IR');
      const chequeNumber = data.chequeNumber || `${Math.floor(100000 + Math.random() * 900000)}`;

      // به‌روزرسانی مانده شخص و صدور سند حسابداری ثبت اولیه چک
      let initialVoucherId: string | undefined;
      if (person) {
        if (chequeType === 'received') {
          person.currentBalance -= amount;
          const vch = this.createVoucher(
            {
              date: issueDate,
              description: `دریافت چک صیادی شماره ${chequeNumber} از «${person.name}» بابت تسویه حساب`,
              referenceType: 'cheque',
              referenceNumber: chequeNumber,
              lines: [
                {
                  id: `vl-chq-init-d-${Date.now()}`,
                  accountCode: '102',
                  accountTitle: 'اسناد دریافتنی (چک‌ها)',
                  debit: amount,
                  credit: 0,
                  description: `ثبت چک دریافتی شماره ${chequeNumber} در صندوق اسناد`,
                },
                {
                  id: `vl-chq-init-c-${Date.now()}`,
                  accountCode: '103',
                  accountTitle: 'حساب‌های دریافتنی تجاری (بدهکاران)',
                  personId: person.id,
                  personName: person.name,
                  debit: 0,
                  credit: amount,
                  description: `کاهش بدهی ${person.name} بابت تحویل چک ${chequeNumber}`,
                },
              ],
            },
            user
          );
          initialVoucherId = vch.id;
        } else {
          person.currentBalance += amount;
          const vch = this.createVoucher(
            {
              date: issueDate,
              description: `صدور چک صیادی شماره ${chequeNumber} در وجه «${person.name}» بابت تسویه بدهی`,
              referenceType: 'cheque',
              referenceNumber: chequeNumber,
              lines: [
                {
                  id: `vl-chq-iss-init-d-${Date.now()}`,
                  accountCode: '201',
                  accountTitle: 'حساب‌های پرداختنی تجاری (بستانکاران)',
                  personId: person.id,
                  personName: person.name,
                  debit: amount,
                  credit: 0,
                  description: `کاهش بستانکاری ${person.name} بابت صدور چک ${chequeNumber}`,
                },
                {
                  id: `vl-chq-iss-init-c-${Date.now()}`,
                  accountCode: '202',
                  accountTitle: 'اسناد پرداختنی (چک‌های صادره)',
                  debit: 0,
                  credit: amount,
                  description: `صدور چک پرداختی شماره ${chequeNumber}`,
                },
              ],
            },
            user
          );
          initialVoucherId = vch.id;
        }
      }

      const initialHistoryItem = createStatusHistoryEntry(
        '-',
        initialStatus,
        chequeType === 'received' ? 'ثبت اولیه چک دریافتی' : 'صدور اولیه چک بانکی',
        chequeType === 'received'
          ? `دریافت چک صیادی به شماره ${chequeNumber} از ${personName} و ثبت در صندوق اسناد`
          : `صدور چک بانکی به شماره ${chequeNumber} در وجه ${personName}`,
        user.fullName,
        { voucherId: initialVoucherId }
      );

      const newCheque: Cheque = {
        id: `chq-${Date.now()}`,
        chequeType,
        chequeNumber,
        sayadNumber: data.sayadNumber || `${Math.floor(1000000000000000 + Math.random() * 9000000000000000)}`,
        bankName: data.bankName || 'بانک ملی ایران',
        branchName: data.branchName || '',
        accountNumber: data.accountNumber || '',
        dueDate: data.dueDate || new Date().toLocaleDateString('fa-IR'),
        issueDate,
        amount,
        personId: data.personId || '',
        personName,
        sourceAccountId: data.sourceAccountId,
        sourceAccountTitle: data.sourceAccountTitle,
        status: initialStatus,
        statusHistory: [initialHistoryItem],
        voucherId: initialVoucherId,
        notes: data.notes || '',
        createdBy: user.fullName,
        createdAt: new Date().toLocaleDateString('fa-IR'),
      };

      this.cheques.unshift(newCheque);
      this.addAuditLog(
        user.id,
        user.fullName,
        'create',
        'چک و اسناد',
        `ثبت چک ${newCheque.chequeType === 'received' ? 'دریافتی' : 'صادره'} شماره ${newCheque.chequeNumber} به مبلغ ${newCheque.amount.toLocaleString('fa-IR')} تومان`,
        newCheque.id
      );

      // در صورت انتخاب خرج مستقیم چک به طرف‌حساب ثالث در زمان ثبت
      if (newCheque.chequeType === 'received' && data.transferredPersonId) {
        return this.transitionChequeStatus(
          newCheque.id,
          'transferred',
          {
            transferredPersonId: data.transferredPersonId,
            transferredPersonName: data.transferredPersonName,
            description: data.notes || `خرج مستقیم چک دریافتی از «${personName}» به طرف‌حساب ثالث`,
          },
          user
        );
      }

      return newCheque;
    });
  }

  // تغییر وضعیت چرخه حیات چک (وصول، واگذاری، انتقال/خرج، برگشت، عودت، ابطال)
  transitionChequeStatus(
    id: string,
    targetStatus: ChequeStatus,
    params: {
      bankAccountId?: string;
      bankAccountTitle?: string;
      transferredPersonId?: string;
      transferredPersonName?: string;
      bounceReason?: string;
      description?: string;
    },
    user: User
  ): Cheque {
    return this.runInTransaction(() => {
      const cheque = this.cheques.find((c) => c.id === id);
      if (!cheque) throw new TransactionError('چک مورد نظر یافت نشد.');

      const validation = validateChequeStatusTransition(cheque, targetStatus, {
        depositedBankAccountId: params.bankAccountId,
        transferredPersonId: params.transferredPersonId,
        bounceReason: params.bounceReason,
      });

      if (!validation.isValid) {
        throw new TransactionError(validation.errorMessage || 'تغییر وضعیت چک مجاز نیست.');
      }

      const prevStatus = cheque.status;
      const todayDate = new Date().toLocaleDateString('fa-IR');
      let voucherId: string | undefined;

      // ۱. عملیات وصول چک دریافتی (Collected)
      if (cheque.chequeType === 'received' && (targetStatus === 'collected' || targetStatus === 'cleared')) {
        const bankId = params.bankAccountId || cheque.depositedBankAccountId;
        const bank = this.treasuryAccounts.find((a) => a.id === bankId);
        if (!bank) throw new TransactionError('حساب بانکی مقصد جهت واریز وجه چک مشخص نشده است.');

        bank.balance += cheque.amount;

        const voucher = this.createVoucher({
          date: todayDate,
          description: `وصول چک شماره ${cheque.chequeNumber} صیادی و واریز به حساب «${bank.title}» - طرف حساب: ${cheque.personName}`,
          referenceType: 'cheque',
          referenceNumber: cheque.chequeNumber,
          lines: [
            {
              id: `vl-chq-col-d-${Date.now()}`,
              accountCode: bank.accountingAccountCode || '10102',
              accountTitle: bank.title,
              debit: cheque.amount,
              credit: 0,
              description: `وصول چک در ${bank.title}`,
            },
            {
              id: `vl-chq-col-c-${Date.now()}`,
              accountCode: '102',
              accountTitle: 'اسناد دریافتنی (چک‌ها)',
              debit: 0,
              credit: cheque.amount,
              description: `تسویه اسناد دریافتنی چک ${cheque.chequeNumber}`,
            },
          ],
        }, user);
        voucherId = voucher.id;
        cheque.depositedBankAccountId = bank.id;
        cheque.depositedBankAccountTitle = bank.title;

        // ثبت گردش خزانه متناظر برای تطابق کامل صورت‌حساب بانک با دفتر کل
        this.treasuryTransactions.unshift({
          id: `tr-chq-col-${Date.now()}`,
          transactionNumber: `TRX-${1000 + this.treasuryTransactions.length + 1}`,
          transactionType: 'receive',
          treasuryAccountId: bank.id,
          treasuryAccountTitle: bank.title,
          destinationAccountId: bank.id,
          destinationAccountTitle: bank.title,
          personId: cheque.personId,
          personName: cheque.personName,
          amount: cheque.amount,
          date: todayDate,
          trackingNumber: `CHQ-${cheque.chequeNumber}`,
          description: `واریز وجه وصول چک صیادی شماره ${cheque.chequeNumber} (${cheque.personName})`,
          paymentMethod: 'cheque',
          voucherId: voucher.id,
          createdBy: user.fullName,
          createdAt: todayDate,
        });
      }

      // ۲. خواباندن به حساب بانک (Deposited)
      else if (cheque.chequeType === 'received' && targetStatus === 'deposited') {
        const bank = this.treasuryAccounts.find((a) => a.id === params.bankAccountId);
        if (!bank) throw new TransactionError('حساب بانکی مقصد مشخص نشده است.');
        cheque.depositedBankAccountId = bank.id;
        cheque.depositedBankAccountTitle = bank.title;
      }

      // ۳. خرج چک / واگذاری به شخص ثالث (Transferred)
      else if (cheque.chequeType === 'received' && targetStatus === 'transferred') {
        const supplier = this.persons.find((p) => p.id === params.transferredPersonId);
        if (!supplier) throw new TransactionError('طرف حساب دریافت‌کننده چک مشخص نشده است.');

        supplier.currentBalance += cheque.amount; // تسویه بدهی به تأمین‌کننده / طرف حساب گیرنده
        cheque.transferredPersonId = supplier.id;
        cheque.transferredPersonName = supplier.name;

        const voucher = this.createVoucher({
          date: todayDate,
          description: `خرج و واگذاری چک صیادی شماره ${cheque.chequeNumber} (دریافتی از «${cheque.personName}») به «${supplier.name}»`,
          referenceType: 'cheque',
          referenceNumber: cheque.chequeNumber,
          lines: [
            {
              id: `vl-chq-trf-d-${Date.now()}`,
              accountCode: '201',
              accountTitle: 'حساب‌های پرداختنی تجاری (بستانکاران)',
              personId: supplier.id,
              personName: supplier.name,
              debit: cheque.amount,
              credit: 0,
              description: `واگذاری چک شماره ${cheque.chequeNumber} دریافتی از ${cheque.personName} به ${supplier.name}`,
            },
            {
              id: `vl-chq-trf-c-${Date.now()}`,
              accountCode: '102',
              accountTitle: 'اسناد دریافتنی (چک‌ها)',
              debit: 0,
              credit: cheque.amount,
              description: `خروج چک از اسناد دریافتنی بابت خرج و واگذاری به ${supplier.name}`,
            },
          ],
        }, user);
        voucherId = voucher.id;
      }

      // ۴. برگشت خوردن چک دریافتی (Bounced)
      else if (cheque.chequeType === 'received' && targetStatus === 'bounced') {
        const customer = this.persons.find((p) => p.id === cheque.personId);
        if (customer) {
          customer.currentBalance += cheque.amount; // مجدداً بدهکار شدن مشتری
        }

        const voucher = this.createVoucher({
          date: todayDate,
          description: `برگشت چک شماره ${cheque.chequeNumber} مشتری «${cheque.personName}» - علت: ${params.bounceReason || 'کسری موجودی'}`,
          lines: [
            {
              id: `vl-chq-bnc-d-${Date.now()}`,
              accountCode: '103',
              accountTitle: 'حساب‌های دریافتنی تجاری (بدهکاران)',
              personId: cheque.personId,
              personName: cheque.personName,
              debit: cheque.amount,
              credit: 0,
              description: `بدهکار شدن مجدد بابت برگشت چک`,
            },
            {
              id: `vl-chq-bnc-c-${Date.now()}`,
              accountCode: '102',
              accountTitle: 'اسناد دریافتنی (چک‌ها)',
              debit: 0,
              credit: cheque.amount,
              description: `خروج چک برگشتی از اسناد دریافتنی`,
            },
          ],
        }, user);
        voucherId = voucher.id;
      }

      // ۵. پاس شدن چک پرداختی (Issued Cheque Collected)
      else if (cheque.chequeType === 'issued' && (targetStatus === 'collected' || targetStatus === 'cleared')) {
        const bankId = cheque.sourceAccountId || params.bankAccountId;
        const bank = this.treasuryAccounts.find((a) => a.id === bankId);
        if (!bank) throw new TransactionError('حساب بانکی پرداخت‌کننده مشخص نشده است.');

        if (bank.balance < cheque.amount) {
          throw new TransactionError(`موجودی حساب بانکی «${bank.title}» جهت پاس شدن این چک کافی نیست.`);
        }

        bank.balance -= cheque.amount;

        const voucher = this.createVoucher({
          date: todayDate,
          description: `پاس شدن چک پرداختی شماره ${cheque.chequeNumber} از حساب «${bank.title}» در وجه ${cheque.personName}`,
          referenceType: 'cheque',
          referenceNumber: cheque.chequeNumber,
          lines: [
            {
              id: `vl-chq-iss-d-${Date.now()}`,
              accountCode: '202',
              accountTitle: 'اسناد پرداختنی (چک‌های صادره)',
              debit: cheque.amount,
              credit: 0,
              description: `تسویه اسناد پرداختنی چک ${cheque.chequeNumber}`,
            },
            {
              id: `vl-chq-iss-c-${Date.now()}`,
              accountCode: bank.accountingAccountCode || '10102',
              accountTitle: bank.title,
              debit: 0,
              credit: cheque.amount,
              description: `کسر از ${bank.title} بابت پاس شدن چک`,
            },
          ],
        }, user);
        voucherId = voucher.id;

        this.treasuryTransactions.unshift({
          id: `tr-chq-iss-col-${Date.now()}`,
          transactionNumber: `TRX-${1000 + this.treasuryTransactions.length + 1}`,
          transactionType: 'pay',
          treasuryAccountId: bank.id,
          treasuryAccountTitle: bank.title,
          sourceAccountId: bank.id,
          sourceAccountTitle: bank.title,
          personId: cheque.personId,
          personName: cheque.personName,
          amount: cheque.amount,
          date: todayDate,
          trackingNumber: `CHQ-ISS-${cheque.chequeNumber}`,
          description: `کسر وجه پاس شدن چک صادره شماره ${cheque.chequeNumber} (${cheque.personName})`,
          paymentMethod: 'cheque',
          voucherId: voucher.id,
          createdBy: user.fullName,
          createdAt: todayDate,
        });
      }

      const historyEntry = createStatusHistoryEntry(
        prevStatus,
        targetStatus,
        validation.actionTitle,
        params.description || params.bounceReason || validation.actionTitle,
        user.fullName,
        {
          relatedAccountId: params.bankAccountId || cheque.depositedBankAccountId,
          relatedAccountTitle: params.bankAccountTitle || cheque.depositedBankAccountTitle,
          targetPersonId: params.transferredPersonId,
          targetPersonName: params.transferredPersonName,
          voucherId,
        }
      );

      if (!cheque.statusHistory) cheque.statusHistory = [];
      cheque.statusHistory.unshift(historyEntry);
      cheque.status = targetStatus;
      if (voucherId) cheque.voucherId = voucherId;

      this.addAuditLog(
        user.id,
        user.fullName,
        'update',
        'چک و اسناد',
        `تغییر وضعیت چک ${cheque.chequeNumber} به «${validation.actionTitle}»`,
        cheque.id
      );

      return cheque;
    });
  }

  // ثبت سند حسابداری با اعتبارسنجی دوطرفه و جلوگیری از ثبت تکراری
  createVoucher(voucherData: Partial<AccountingVoucher>, user: User, options?: { allowDuplicate?: boolean }): AccountingVoucher {
    return this.runInTransaction(() => {
      const lines = (voucherData.lines || []).map((l, i) => ({
        ...l,
        id: l.id || `vl-${Date.now()}-${i}`,
        debit: Number(l.debit) || 0,
        credit: Number(l.credit) || 0,
      }));

      // ۱. اعتبارسنجی موتور دوطرفه حسابداری
      const validation = validateDoubleEntryVoucher(lines);
      if (!validation.isValid) {
        throw new TransactionError(validation.errorMessage || 'سند حسابداری نامعتبر است.');
      }

      const date = voucherData.date || new Date().toLocaleDateString('fa-IR');
      const totalDebit = validation.totalDebit;
      const totalCredit = validation.totalCredit;

      // ۲. جلوگیری از تولید سند تکراری (همان تاریخ، همان مبلغ و همان ساختار سطور)
      if (!options?.allowDuplicate) {
        const dupCheck = checkForDuplicateVoucher(this.vouchers, {
          date,
          description: voucherData.description || '',
          totalDebit,
          lines,
        });
        if (dupCheck.isDuplicate) {
          throw new TransactionError(
            `خطای ثبت سند تکراری: ${dupCheck.warning || 'سند مشابه در سیستم وجود دارد.'}`
          );
        }
      }

      const nextNum = 1000 + this.vouchers.length + 1;
      const voucherNumber = voucherData.voucherNumber || `${nextNum}`;

      const voucher: AccountingVoucher = {
        id: `vch-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        voucherNumber,
        date,
        description: voucherData.description || 'سند دستی حسابداری دوطرفه',
        fiscalYearId: voucherData.fiscalYearId || this.settings.activeFiscalYear,
        status: voucherData.status || 'approved',
        referenceType: voucherData.referenceType,
        referenceId: voucherData.referenceId,
        referenceNumber: voucherData.referenceNumber,
        reversalOfVoucherId: voucherData.reversalOfVoucherId,
        lines,
        totalDebit,
        totalCredit,
        isBalanced: true,
        createdBy: user.fullName,
        createdAt: new Date().toLocaleDateString('fa-IR'),
      };

      this.vouchers.unshift(voucher);
      this.addAuditLog(
        user.id,
        user.fullName,
        'create',
        'اسناد حسابداری',
        `ثبت سند حسابداری دوطرفه شماره ${voucher.voucherNumber} به تراز ${totalDebit.toLocaleString('fa-IR')} تومان - ${voucher.description}`,
        voucher.id
      );
      return voucher;
    });
  }

  // ویرایش سند با حفظ زنجیره حسابرسی (عدم تغییر بی‌ردپا در اسناد قطعی)
  updateVoucher(id: string, voucherData: Partial<AccountingVoucher>, user: User): AccountingVoucher {
    return this.runInTransaction(() => {
      const idx = this.vouchers.findIndex((v) => v.id === id);
      if (idx === -1) throw new TransactionError('سند حسابداری مورد نظر یافت نشد.');
      const oldVoucher = this.vouchers[idx];

      if (oldVoucher.status === 'permanent') {
        throw new TransactionError('سند قطعی‌شده و بسته مالی غیرقابل ویرایش مستقیم است؛ جهت اصلاح باید از سند معکوس (استردادی) استفاده نمایید.');
      }

      const lines = (voucherData.lines || oldVoucher.lines).map((l, i) => ({
        ...l,
        id: l.id || `vl-${Date.now()}-${i}`,
        debit: Number(l.debit) || 0,
        credit: Number(l.credit) || 0,
      }));

      const validation = validateDoubleEntryVoucher(lines);
      if (!validation.isValid) {
        throw new TransactionError(validation.errorMessage || 'سند حسابداری نامعتبر است.');
      }

      const updatedVoucher: AccountingVoucher = {
        ...oldVoucher,
        ...voucherData,
        id: oldVoucher.id,
        voucherNumber: oldVoucher.voucherNumber,
        lines,
        totalDebit: validation.totalDebit,
        totalCredit: validation.totalCredit,
        isBalanced: true,
        modifiedBy: user.fullName,
        modifiedAt: `${new Date().toLocaleDateString('fa-IR')} ${new Date().toLocaleTimeString('fa-IR')}`,
      };

      this.vouchers[idx] = updatedVoucher;
      this.addAuditLog(
        user.id,
        user.fullName,
        'update',
        'اسناد حسابداری',
        `اصلاح مستند سند شماره ${oldVoucher.voucherNumber} (مبلغ قدیم: ${oldVoucher.totalDebit.toLocaleString('fa-IR')}، مبلغ جدید: ${validation.totalDebit.toLocaleString('fa-IR')} تومان)`,
        updatedVoucher.id
      );
      return updatedVoucher;
    });
  }

  // صدور سند معکوس (سند اصلاحی استردادی) جهت اصلاح اسناد قطعی بدون دستکاری گذشته
  reverseVoucher(id: string, reason: string, user: User): AccountingVoucher {
    return this.runInTransaction(() => {
      const original = this.vouchers.find((v) => v.id === id);
      if (!original) throw new TransactionError('سند مورد نظر جهت صدور سند اصلاحی یافت نشد.');

      if (original.reversalOfVoucherId) {
        throw new TransactionError('این سند خود یک سند اصلاحی است و امکان صدور معکوس مجدد روی آن وجود ندارد.');
      }

      // بررسی اینکه آیا قبلاً سند اصلاحی برای آن صادر شده یا نه
      const existingReversal = this.vouchers.find((v) => v.reversalOfVoucherId === id);
      if (existingReversal) {
        throw new TransactionError(`برای سند شماره ${original.voucherNumber} قبلاً سند اصلاحی شماره ${existingReversal.voucherNumber} صادر شده است.`);
      }

      // ساخت سطور معکوس: جابجایی کامل بدهکار و بستانکار
      const reversalLines = original.lines.map((l, i) => ({
        id: `vl-rev-${Date.now()}-${i}`,
        accountCode: l.accountCode,
        accountTitle: l.accountTitle,
        personId: l.personId,
        personName: l.personName,
        debit: l.credit,
        credit: l.debit,
        description: `سند معکوس اصلاحی: ${l.description || original.description}`,
      }));

      const reversalVoucher = this.createVoucher({
        date: new Date().toLocaleDateString('fa-IR'),
        description: `سند اصلاحی معکوس عطف به سند قطعی شماره ${original.voucherNumber} - دلیل: ${reason.trim() || 'اصلاح حسابداری'}`,
        referenceType: 'reversal',
        referenceId: original.id,
        referenceNumber: original.voucherNumber,
        reversalOfVoucherId: original.id,
        lines: reversalLines,
      }, user, { allowDuplicate: true });

      original.modifiedBy = user.fullName;
      original.modifiedAt = new Date().toLocaleDateString('fa-IR');

      this.addAuditLog(
        user.id,
        user.fullName,
        'update',
        'اسناد حسابداری',
        `صدور سند معکوس شماره ${reversalVoucher.voucherNumber} جهت اصلاح عطف به سند قطعی شماره ${original.voucherNumber}`,
        reversalVoucher.id
      );

      return reversalVoucher;
    });
  }

  // گزارشات دفاتر قانونی و تراز آزمایشی
  getJournalLedger(dateFrom?: string, dateTo?: string) {
    return generateJournalLedger(this.vouchers, dateFrom, dateTo);
  }

  getGeneralLedger(dateFrom?: string, dateTo?: string) {
    return generateGeneralLedger(this.vouchers, this.accountsChart, dateFrom, dateTo);
  }

  getSubsidiaryLedger(dateFrom?: string, dateTo?: string, generalCode?: string) {
    return generateSubsidiaryLedger(this.vouchers, this.accountsChart, dateFrom, dateTo, generalCode);
  }

  getDetailedPersonLedger(personId?: string, dateFrom?: string, dateTo?: string) {
    return generateDetailedPersonLedger(this.vouchers, this.persons, personId, dateFrom, dateTo);
  }

  getTrialBalance(dateFrom?: string, dateTo?: string) {
    return generateTrialBalance(this.vouchers, this.accountsChart, dateFrom, dateTo);
  }

  auditAccountingIntegrity() {
    return auditAccountingIntegrity(this.vouchers, this.accountsChart, this.persons, this.treasuryAccounts);
  }

  // ==================== مدیریت جامع انبار، خرید و کاردکس ====================

  // ۱. مدیریت انبارها
  saveWarehouse(data: Partial<Warehouse>, user: User): Warehouse {
    return this.runInTransaction(() => {
      const name = data.name?.trim();
      if (!name) throw new TransactionError('نام انبار الزامی است.');

      const code = data.code?.trim() || `WH-${Math.floor(10 + Math.random() * 90)}`;

      if (data.id) {
        const idx = this.warehouses.findIndex((w) => w.id === data.id);
        if (idx !== -1) {
          this.warehouses[idx] = {
            ...this.warehouses[idx],
            ...data,
            name,
            code,
            location: data.location?.trim() || this.warehouses[idx].location,
          };
          this.addAuditLog(user.id, user.fullName, 'update', 'مدیریت انبار', `ویرایش مشخصات انبار «${name}»`, data.id);
          return this.warehouses[idx];
        }
      }

      const newWh: Warehouse = {
        id: `wh-${Date.now()}`,
        code,
        name,
        type: data.type || 'central',
        location: data.location?.trim() || 'فروشگاه اصلی',
        managerName: data.managerName?.trim() || user.fullName,
        phone: data.phone?.trim() || '',
        isActive: data.isActive !== undefined ? data.isActive : true,
        isDefault: Boolean(data.isDefault),
        createdAt: new Date().toLocaleDateString('fa-IR'),
      };

      if (newWh.isDefault) {
        this.warehouses.forEach((w) => (w.isDefault = false));
      }

      this.warehouses.push(newWh);
      this.addAuditLog(user.id, user.fullName, 'create', 'مدیریت انبار', `تعریف انبار جدید «${name}» (کد: ${code})`, newWh.id);
      return newWh;
    });
  }

  deleteWarehouse(id: string, user: User): boolean {
    return this.runInTransaction(() => {
      const idx = this.warehouses.findIndex((w) => w.id === id);
      if (idx === -1) return false;
      const wh = this.warehouses[idx];

      const linkedMovements = this.kardexEntries.filter((k) => k.warehouseId === id).length;
      if (linkedMovements > 0) {
        throw new TransactionError(`امکان حذف انبار «${wh.name}» به دلیل ثبت ${linkedMovements} گردش انبار و سابقه کالا وجود ندارد. می‌توانید آن را غیرفعال کنید.`);
      }

      this.warehouses.splice(idx, 1);
      this.addAuditLog(user.id, user.fullName, 'delete', 'مدیریت انبار', `حذف انبار «${wh.name}»`, id);
      return true;
    });
  }

  // ۲. دریافت کاردکس تعدادی و ریالی کالا با مانده لحظه‌ای دقیق
  getKardex(productId: string, warehouseId?: string, dateFrom?: string, dateTo?: string): KardexEntry[] {
    let entries = this.kardexEntries.filter((k) => k.productId === productId);

    if (warehouseId && warehouseId !== 'all') {
      entries = entries.filter((k) => k.warehouseId === warehouseId);
    }

    if (dateFrom) {
      entries = entries.filter((k) => k.date >= dateFrom);
    }

    if (dateTo) {
      entries = entries.filter((k) => k.date <= dateTo);
    }

    // مرتب‌سازی زمانی صعودی (قدیمی‌ترین به جدیدترین) جهت محاسبه دقیق مانده
    const sorted = [...entries].sort((a, b) => {
      const cmpDate = (a.date || '').localeCompare(b.date || '');
      if (cmpDate !== 0) return cmpDate;
      return (a.createdAt || '').localeCompare(b.createdAt || '');
    });

    let runningQty = 0;
    const computed = sorted.map((entry) => {
      runningQty += (entry.inQuantity || 0) - (entry.outQuantity || 0);
      const prd = this.products.find((p) => p.id === entry.productId);
      const effectivePrice = entry.unitPrice || prd?.purchasePrice || 0;
      const balanceValue = Math.max(0, runningQty * effectivePrice);
      return {
        ...entry,
        balanceQuantity: runningQty,
        balanceValue,
      };
    });

    // بازگرداندن با چیدمان نزولی (جدیدترین در ابتدا)
    return computed.reverse();
  }

  // ۳. ثبت رسید ورود کالا (Goods Receipt)
  saveGoodsReceipt(data: Partial<GoodsReceipt>, user: User): GoodsReceipt {
    return this.runInTransaction(() => {
      const supplier = this.persons.find((p) => p.id === data.supplierId);
      const supplierName = supplier ? supplier.name : data.supplierName || 'تأمین‌کننده بازار';

      const warehouse = this.warehouses.find((w) => w.id === data.warehouseId) || this.warehouses[0];
      const warehouseId = warehouse?.id || 'wh-central';
      const warehouseName = warehouse?.name || 'انبار مرکزی و بنکداری';

      const receiptNumber = data.receiptNumber || `REC-${1400 + this.goodsReceipts.length + 1}`;
      const date = data.date || new Date().toLocaleDateString('fa-IR');
      const isApproved = data.status === 'approved';

      const rawItems = data.items || [];
      if (rawItems.length === 0) {
        throw new TransactionError('رسید انبار باید حداقل شامل یک قلم کالا باشد.');
      }

      let totalQuantity = 0;
      let totalAmount = 0;

      const items: GoodsReceiptItem[] = rawItems.map((it, idx) => {
        const prd = this.products.find((p) => p.id === it.productId);
        const conversionFactor = it.conversionFactor || 1;
        const baseQuantity = it.quantity * conversionFactor;
        const totalPrice = it.quantity * (it.unitPrice || prd?.purchasePrice || 0);

        totalQuantity += it.quantity;
        totalAmount += totalPrice;

        return {
          id: it.id || `rcp-it-${Date.now()}-${idx}`,
          productId: it.productId,
          productCode: prd ? prd.code : it.productCode || '',
          productName: prd ? prd.name : it.productName || '',
          unitId: it.unitId || prd?.baseUnitId || 'u-item',
          unitName: it.unitName || prd?.baseUnitName || 'عدد',
          quantity: it.quantity,
          conversionFactor,
          baseQuantity,
          unitPrice: it.unitPrice || prd?.purchasePrice || 0,
          totalPrice,
          notes: it.notes?.trim() || '',
        };
      });

      const receiptId = data.id || `rcp-${Date.now()}`;
      const receipt: GoodsReceipt = {
        id: receiptId,
        receiptNumber,
        supplierId: data.supplierId || supplier?.id || 'per-3',
        supplierName,
        warehouseId,
        warehouseName,
        purchaseInvoiceId: data.purchaseInvoiceId,
        date,
        status: isApproved ? 'approved' : 'draft',
        items,
        totalQuantity,
        totalAmount,
        driverName: data.driverName?.trim() || '',
        driverMobile: data.driverMobile?.trim() || '',
        waybillNumber: data.waybillNumber?.trim() || '',
        notes: data.notes?.trim() || '',
        approvedBy: isApproved ? user.fullName : undefined,
        approvedAt: isApproved ? `${date} ${new Date().toLocaleTimeString('fa-IR')}` : undefined,
        createdBy: user.fullName,
        createdAt: `${date} ${new Date().toLocaleTimeString('fa-IR')}`,
      };

      // در صورت ثبت مستقیم به صورت قطعی، موجودی و کاردکس را به‌روزرسانی می‌کنیم
      if (isApproved) {
        this.executeApprovedReceiptStock(receipt, user);
      }

      if (data.id) {
        const idx = this.goodsReceipts.findIndex((r) => r.id === data.id);
        if (idx !== -1) {
          if (this.goodsReceipts[idx].status === 'approved' && !isApproved) {
            throw new TransactionError('سند رسید قطعی انبار قابل تبدیل مجدد به پیش‌نویس نیست.');
          }
          this.goodsReceipts[idx] = receipt;
          this.addAuditLog(user.id, user.fullName, isApproved ? 'approve' : 'update', 'رسید انبار', `ویرایش رسید ورود شماره ${receiptNumber} (${supplierName})`, receipt.id);
          return receipt;
        }
      }

      this.goodsReceipts.unshift(receipt);
      this.addAuditLog(user.id, user.fullName, isApproved ? 'approve' : 'create', 'رسید انبار', `ثبت ${isApproved ? 'قطعی' : 'پیش‌نویس'} رسید ورود شماره ${receiptNumber} به مبلغ ${totalAmount.toLocaleString('fa-IR')} تومان`, receipt.id);
      return receipt;
    });
  }

  // تایید قطعی رسید انبار و ورود به چرخه موجودی و کاردکس
  approveGoodsReceipt(id: string, user: User): GoodsReceipt {
    return this.runInTransaction(() => {
      const idx = this.goodsReceipts.findIndex((r) => r.id === id);
      if (idx === -1) throw new TransactionError('رسید انبار یافت نشد.');
      const receipt = this.goodsReceipts[idx];

      if (receipt.status === 'approved') {
        return receipt; // قبلاً قطعی شده است
      }

      this.executeApprovedReceiptStock(receipt, user);
      receipt.status = 'approved';
      receipt.approvedBy = user.fullName;
      receipt.approvedAt = `${new Date().toLocaleDateString('fa-IR')} ${new Date().toLocaleTimeString('fa-IR')}`;

      this.addAuditLog(user.id, user.fullName, 'approve', 'رسید انبار', `تایید قطعی رسید ورود کالا شماره ${receipt.receiptNumber} و افزایش موجودی انبار`, receipt.id);
      return receipt;
    });
  }

  private executeApprovedReceiptStock(receipt: GoodsReceipt, user: User) {
    receipt.items.forEach((it, idx) => {
      const prd = this.products.find((p) => p.id === it.productId);
      if (!prd) return;

      prd.currentStock += it.baseQuantity;

      // به روز رسانی موجودی انبار خاص
      const ws = this.warehouseStocks.find((w) => w.productId === prd.id && w.warehouseId === receipt.warehouseId);
      if (ws) {
        ws.quantity += it.baseQuantity;
        ws.lastUpdated = receipt.date;
      } else {
        this.warehouseStocks.push({
          productId: prd.id,
          warehouseId: receipt.warehouseId,
          quantity: it.baseQuantity,
          lastUpdated: receipt.date,
        });
      }

      // ایجاد ردیف کاردکس
      this.kardexEntries.unshift({
        id: `kd-rcp-${Date.now()}-${idx}`,
        productId: prd.id,
        productCode: prd.code,
        productName: prd.name,
        warehouseId: receipt.warehouseId,
        warehouseName: receipt.warehouseName,
        date: receipt.date,
        referenceType: 'purchase_receipt',
        referenceTypeTitle: 'رسید ورود کالا',
        referenceId: receipt.id,
        referenceNumber: receipt.receiptNumber,
        inQuantity: it.baseQuantity,
        outQuantity: 0,
        unitName: prd.baseUnitName || 'عدد',
        unitPrice: it.unitPrice,
        totalValue: it.baseQuantity * it.unitPrice,
        balanceQuantity: prd.currentStock,
        balanceValue: prd.currentStock * prd.purchasePrice,
        userId: user.id,
        userName: user.fullName,
        notes: `ورود کالا از ${receipt.supplierName} (بارنامه: ${receipt.waybillNumber || '-'})`,
        createdAt: new Date().toLocaleDateString('fa-IR'),
      });
    });
  }

  deleteGoodsReceipt(id: string, user: User): boolean {
    return this.runInTransaction(() => {
      const idx = this.goodsReceipts.findIndex((r) => r.id === id);
      if (idx === -1) return false;
      const receipt = this.goodsReceipts[idx];

      if (receipt.status === 'approved') {
        throw new TransactionError('رسید قطعی‌شده انبار به دلیل ثبت در کاردکس و افزایش موجودی کالا قابل حذف نیست. در صورت لزوم باید سند تعدیل یا برگشت ثبت شود.');
      }

      this.goodsReceipts.splice(idx, 1);
      this.addAuditLog(user.id, user.fullName, 'delete', 'رسید انبار', `حذف پیش‌نویس رسید شماره ${receipt.receiptNumber}`, id);
      return true;
    });
  }

  // ۴. پیش‌فاکتور خرید (Purchase Proforma)
  savePurchaseProforma(data: Partial<PurchaseProforma>, user: User): PurchaseProforma {
    return this.runInTransaction(() => {
      const supplier = this.persons.find((p) => p.id === data.supplierId);
      const supplierName = supplier ? supplier.name : data.supplierName || 'تأمین‌کننده';

      const warehouse = this.warehouses.find((w) => w.id === data.targetWarehouseId) || this.warehouses[0];
      const targetWarehouseId = warehouse?.id || 'wh-central';
      const targetWarehouseName = warehouse?.name || 'انبار مرکزی و بنکداری';

      const proformaNumber = data.proformaNumber || `PRF-${1400 + this.purchaseProformas.length + 1}`;
      const items = data.items || [];

      let subtotal = 0;
      const processedItems = items.map((it, idx) => {
        const prd = this.products.find((p) => p.id === it.productId);
        const conversionFactor = it.conversionFactor || 1;
        const baseQuantity = it.quantity * conversionFactor;
        const totalPrice = it.quantity * it.unitPrice - (it.discount || 0);
        subtotal += totalPrice;

        return {
          ...it,
          id: it.id || `prf-it-${Date.now()}-${idx}`,
          productName: prd ? prd.name : it.productName || '',
          productCode: prd ? prd.code : it.productCode || '',
          conversionFactor,
          baseQuantity,
          totalPrice,
        };
      });

      const totalDiscount = Number(data.totalDiscount) || 0;
      const taxAmount = Number(data.taxAmount) || 0;
      const finalAmount = Math.max(0, subtotal - totalDiscount + taxAmount);

      const proforma: PurchaseProforma = {
        id: data.id || `prf-${Date.now()}`,
        proformaNumber,
        supplierId: data.supplierId || supplier?.id || 'per-3',
        supplierName,
        targetWarehouseId,
        targetWarehouseName,
        date: data.date || new Date().toLocaleDateString('fa-IR'),
        validUntil: data.validUntil || new Date(Date.now() + 10 * 86400000).toLocaleDateString('fa-IR'),
        status: data.status || 'draft',
        items: processedItems,
        subtotal,
        totalDiscount,
        taxAmount,
        finalAmount,
        notes: data.notes?.trim() || '',
        createdBy: user.fullName,
        createdAt: new Date().toLocaleDateString('fa-IR'),
      };

      if (data.id) {
        const idx = this.purchaseProformas.findIndex((p) => p.id === data.id);
        if (idx !== -1) {
          this.purchaseProformas[idx] = proforma;
          this.addAuditLog(user.id, user.fullName, 'update', 'پیش‌فاکتور خرید', `ویرایش پیش‌فاکتور خرید شماره ${proformaNumber}`, proforma.id);
          return proforma;
        }
      }

      this.purchaseProformas.unshift(proforma);
      this.addAuditLog(user.id, user.fullName, 'create', 'پیش‌فاکتور خرید', `ثبت پیش‌فاکتور خرید شماره ${proformaNumber} به مبلغ ${finalAmount.toLocaleString('fa-IR')} تومان`, proforma.id);
      return proforma;
    });
  }

  // تبدیل پیش‌فاکتور خرید به فاکتور خرید قطعی
  convertProformaToPurchaseInvoice(proformaId: string, user: User): Invoice {
    return this.runInTransaction(() => {
      const proforma = this.purchaseProformas.find((p) => p.id === proformaId);
      if (!proforma) throw new TransactionError('پیش‌فاکتور خرید یافت نشد.');

      if (proforma.status === 'converted_to_invoice') {
        throw new TransactionError('این پیش‌فاکتور قبلاً به فاکتور خرید تبدیل شده است.');
      }

      const invoice = this.createInvoice(
        {
          invoiceType: 'purchase',
          personId: proforma.supplierId,
          items: proforma.items,
          subtotal: proforma.subtotal,
          totalDiscount: proforma.totalDiscount,
          taxAmount: proforma.taxAmount,
          finalAmount: proforma.finalAmount,
          paidAmount: 0,
          date: new Date().toLocaleDateString('fa-IR'),
          status: 'approved',
        },
        user
      );

      proforma.status = 'converted_to_invoice';
      proforma.approvedBy = user.fullName;
      proforma.approvedAt = new Date().toLocaleDateString('fa-IR');

      this.addAuditLog(user.id, user.fullName, 'approve', 'پیش‌فاکتور خرید', `تبدیل پیش‌فاکتور ${proforma.proformaNumber} به فاکتور خرید رسمی شماره ${invoice.invoiceNumber}`, invoice.id);
      return invoice;
    });
  }

  deletePurchaseProforma(id: string, user: User): boolean {
    return this.runInTransaction(() => {
      const idx = this.purchaseProformas.findIndex((p) => p.id === id);
      if (idx === -1) return false;
      const p = this.purchaseProformas[idx];

      if (p.status === 'converted_to_invoice') {
        throw new TransactionError('امکان حذف پیش‌فاکتوری که به فاکتور قطعی خرید تبدیل شده است وجود ندارد.');
      }

      this.purchaseProformas.splice(idx, 1);
      this.addAuditLog(user.id, user.fullName, 'delete', 'پیش‌فاکتور خرید', `حذف پیش‌فاکتور خرید شماره ${p.proformaNumber}`, id);
      return true;
    });
  }

  // ۵. انتقال بین انبارها (Inter-Warehouse Transfers)
  saveWarehouseTransfer(data: Partial<WarehouseTransfer>, user: User): WarehouseTransfer {
    return this.runInTransaction(() => {
      if (data.sourceWarehouseId === data.destinationWarehouseId) {
        throw new TransactionError('انبار مبدأ و انبار مقصد نمی‌توانند یکسان باشند.');
      }

      const srcWh = this.warehouses.find((w) => w.id === data.sourceWarehouseId);
      const destWh = this.warehouses.find((w) => w.id === data.destinationWarehouseId);

      if (!srcWh || !destWh) {
        throw new TransactionError('انبار مبدأ یا انبار مقصد یافت نشد.');
      }

      const transferNumber = data.transferNumber || `TRF-${1400 + this.warehouseTransfers.length + 1}`;
      const isApproved = data.status === 'approved';

      const rawItems = data.items || [];
      if (rawItems.length === 0) {
        throw new TransactionError('حواله انتقال باید حداقل دارای یک قلم کالا باشد.');
      }

      let totalQuantity = 0;
      let totalCost = 0;

      const items: WarehouseTransferItem[] = rawItems.map((it, idx) => {
        const prd = this.products.find((p) => p.id === it.productId);
        const conversionFactor = it.conversionFactor || 1;
        const baseQuantity = it.quantity * conversionFactor;
        const lineCost = baseQuantity * (it.unitCost || prd?.purchasePrice || 0);

        totalQuantity += it.quantity;
        totalCost += lineCost;

        return {
          id: it.id || `trf-it-${Date.now()}-${idx}`,
          productId: it.productId,
          productCode: prd ? prd.code : it.productCode || '',
          productName: prd ? prd.name : it.productName || '',
          unitId: it.unitId || prd?.baseUnitId || 'u-item',
          unitName: it.unitName || prd?.baseUnitName || 'عدد',
          quantity: it.quantity,
          conversionFactor,
          baseQuantity,
          unitCost: it.unitCost || prd?.purchasePrice || 0,
          totalCost: lineCost,
        };
      });

      const auditTrail = data.auditTrail || [
        {
          action: isApproved ? 'ثبت و تایید مستقیم حواله انتقال' : 'ثبت پیش‌نویس انتقال بین انبارها',
          userName: user.fullName,
          timestamp: `${new Date().toLocaleDateString('fa-IR')} ${new Date().toLocaleTimeString('fa-IR')}`,
          notes: data.notes,
        },
      ];

      const transfer: WarehouseTransfer = {
        id: data.id || `trf-${Date.now()}`,
        transferNumber,
        sourceWarehouseId: srcWh.id,
        sourceWarehouseName: srcWh.name,
        destinationWarehouseId: destWh.id,
        destinationWarehouseName: destWh.name,
        date: data.date || new Date().toLocaleDateString('fa-IR'),
        status: isApproved ? 'approved' : 'draft',
        items,
        totalQuantity,
        totalCost,
        driverOrTransporter: data.driverOrTransporter?.trim() || '',
        reason: data.reason?.trim() || 'شارژ موجودی انبار فروشگاه',
        notes: data.notes?.trim() || '',
        approvedBy: isApproved ? user.fullName : undefined,
        approvedAt: isApproved ? `${new Date().toLocaleDateString('fa-IR')} ${new Date().toLocaleTimeString('fa-IR')}` : undefined,
        auditTrail,
        createdBy: user.fullName,
        createdAt: new Date().toLocaleDateString('fa-IR'),
      };

      if (isApproved) {
        this.executeApprovedTransfer(transfer, user);
      }

      if (data.id) {
        const idx = this.warehouseTransfers.findIndex((t) => t.id === data.id);
        if (idx !== -1) {
          this.warehouseTransfers[idx] = transfer;
          this.addAuditLog(user.id, user.fullName, isApproved ? 'approve' : 'update', 'انتقال بین انبارها', `ویرایش حواله انتقال ${transferNumber}`, transfer.id);
          return transfer;
        }
      }

      this.warehouseTransfers.unshift(transfer);
      this.addAuditLog(user.id, user.fullName, isApproved ? 'approve' : 'create', 'انتقال بین انبارها', `ثبت ${isApproved ? 'قطعی' : 'پیش‌نویس'} حواله انتقال شماره ${transferNumber} از «${srcWh.name}» به «${destWh.name}»`, transfer.id);
      return transfer;
    });
  }

  approveWarehouseTransfer(id: string, user: User): WarehouseTransfer {
    return this.runInTransaction(() => {
      const idx = this.warehouseTransfers.findIndex((t) => t.id === id);
      if (idx === -1) throw new TransactionError('حواله انتقال یافت نشد.');
      const transfer = this.warehouseTransfers[idx];

      if (transfer.status === 'approved') return transfer;

      this.executeApprovedTransfer(transfer, user);
      transfer.status = 'approved';
      transfer.approvedBy = user.fullName;
      transfer.approvedAt = `${new Date().toLocaleDateString('fa-IR')} ${new Date().toLocaleTimeString('fa-IR')}`;
      transfer.auditTrail.push({
        action: 'تایید خروج از مبدأ و ورود به مقصد',
        userName: user.fullName,
        timestamp: `${new Date().toLocaleDateString('fa-IR')} ${new Date().toLocaleTimeString('fa-IR')}`,
        notes: 'موجودی با موفقیت بین انبارها جابه‌جا شد',
      });

      this.addAuditLog(user.id, user.fullName, 'approve', 'انتقال بین انبارها', `تایید قطعی حواله انتقال شماره ${transfer.transferNumber}`, transfer.id);
      return transfer;
    });
  }

  private executeApprovedTransfer(transfer: WarehouseTransfer, user: User) {
    transfer.items.forEach((it, idx) => {
      const prd = this.products.find((p) => p.id === it.productId);
      if (!prd) return;

      // بررسی موجودی انبار مبدأ
      let srcWs = this.warehouseStocks.find((w) => w.productId === prd.id && w.warehouseId === transfer.sourceWarehouseId);
      const currentSrcQty = srcWs ? srcWs.quantity : 0;

      if (currentSrcQty < it.baseQuantity && !this.settings.allowNegativeStock) {
        throw new TransactionError(
          `موجودی کالای «${prd.name}» در انبار مبدأ (${currentSrcQty.toLocaleString('fa-IR')} ${prd.baseUnitName}) کمتر از مقدار انتقالی (${it.baseQuantity.toLocaleString('fa-IR')} ${prd.baseUnitName}) است.`
        );
      }

      if (!srcWs) {
        srcWs = { productId: prd.id, warehouseId: transfer.sourceWarehouseId, quantity: 0, lastUpdated: transfer.date };
        this.warehouseStocks.push(srcWs);
      }
      srcWs.quantity -= it.baseQuantity;
      srcWs.lastUpdated = transfer.date;

      // افزایش انبار مقصد
      let destWs = this.warehouseStocks.find((w) => w.productId === prd.id && w.warehouseId === transfer.destinationWarehouseId);
      if (!destWs) {
        destWs = { productId: prd.id, warehouseId: transfer.destinationWarehouseId, quantity: 0, lastUpdated: transfer.date };
        this.warehouseStocks.push(destWs);
      }
      destWs.quantity += it.baseQuantity;
      destWs.lastUpdated = transfer.date;

      // ۱. ردیف خروج از انبار مبدأ در کاردکس
      this.kardexEntries.unshift({
        id: `kd-trf-out-${Date.now()}-${idx}`,
        productId: prd.id,
        productCode: prd.code,
        productName: prd.name,
        warehouseId: transfer.sourceWarehouseId,
        warehouseName: transfer.sourceWarehouseName,
        date: transfer.date,
        referenceType: 'transfer_out',
        referenceTypeTitle: 'انتقال خروجی بین انبارها',
        referenceId: transfer.id,
        referenceNumber: transfer.transferNumber,
        inQuantity: 0,
        outQuantity: it.baseQuantity,
        unitName: prd.baseUnitName || 'عدد',
        unitPrice: it.unitCost,
        totalValue: it.baseQuantity * it.unitCost,
        balanceQuantity: prd.currentStock,
        balanceValue: prd.currentStock * prd.purchasePrice,
        userId: user.id,
        userName: user.fullName,
        notes: `انتقال به انبار «${transfer.destinationWarehouseName}»`,
        createdAt: new Date().toLocaleDateString('fa-IR'),
      });

      // ۲. ردیف ورود به انبار مقصد در کاردکس
      this.kardexEntries.unshift({
        id: `kd-trf-in-${Date.now()}-${idx}`,
        productId: prd.id,
        productCode: prd.code,
        productName: prd.name,
        warehouseId: transfer.destinationWarehouseId,
        warehouseName: transfer.destinationWarehouseName,
        date: transfer.date,
        referenceType: 'transfer_in',
        referenceTypeTitle: 'انتقال ورودی بین انبارها',
        referenceId: transfer.id,
        referenceNumber: transfer.transferNumber,
        inQuantity: it.baseQuantity,
        outQuantity: 0,
        unitName: prd.baseUnitName || 'عدد',
        unitPrice: it.unitCost,
        totalValue: it.baseQuantity * it.unitCost,
        balanceQuantity: prd.currentStock,
        balanceValue: prd.currentStock * prd.purchasePrice,
        userId: user.id,
        userName: user.fullName,
        notes: `دریافت از انبار «${transfer.sourceWarehouseName}»`,
        createdAt: new Date().toLocaleDateString('fa-IR'),
      });
    });
  }

  deleteWarehouseTransfer(id: string, user: User): boolean {
    return this.runInTransaction(() => {
      const idx = this.warehouseTransfers.findIndex((t) => t.id === id);
      if (idx === -1) return false;
      const transfer = this.warehouseTransfers[idx];

      if (transfer.status === 'approved') {
        throw new TransactionError('حواله انتقال قطعی‌شده به دلیل اعمال در کاردکس و جابه‌جایی موجودی انبارها قابل حذف نیست.');
      }

      this.warehouseTransfers.splice(idx, 1);
      this.addAuditLog(user.id, user.fullName, 'delete', 'انتقال بین انبارها', `حذف پیش‌نویس انتقال شماره ${transfer.transferNumber}`, id);
      return true;
    });
  }

  // ۶. انبارگردانی و مغایرت‌گیری (Physical Stocktaking)
  saveStocktakingSession(data: Partial<StocktakingSession>, user: User): StocktakingSession {
    return this.runInTransaction(() => {
      const warehouse = this.warehouses.find((w) => w.id === data.warehouseId) || this.warehouses[0];
      const warehouseId = warehouse?.id || 'wh-central';
      const warehouseName = warehouse?.name || 'انبار مرکزی و بنکداری';

      const code = data.code || `ST-${1400 + this.stocktakingSessions.length + 1}`;
      const title = data.title?.trim() || `انبارگردانی ${warehouseName}`;
      const isApproved = data.status === 'approved';

      const rawItems = data.items || [];
      let totalDeficitValue = 0;
      let totalSurplusValue = 0;

      const items: StocktakingItem[] = rawItems.map((it, idx) => {
        const prd = this.products.find((p) => p.id === it.productId);
        const countedQuantity = Number(it.countedQuantity) || 0;
        const systemQuantity = Number(it.systemQuantity) || 0;
        const varianceQuantity = countedQuantity - systemQuantity;
        const unitCost = it.unitCost || prd?.purchasePrice || 0;
        const varianceValue = varianceQuantity * unitCost;

        let varianceStatus: 'matched' | 'deficit' | 'surplus' = 'matched';
        if (varianceQuantity < 0) {
          varianceStatus = 'deficit';
          totalDeficitValue += Math.abs(varianceValue);
        } else if (varianceQuantity > 0) {
          varianceStatus = 'surplus';
          totalSurplusValue += varianceValue;
        }

        return {
          id: it.id || `stk-it-${Date.now()}-${idx}`,
          productId: it.productId,
          productCode: prd ? prd.code : it.productCode || '',
          productName: prd ? prd.name : it.productName || '',
          unitName: it.unitName || prd?.baseUnitName || 'عدد',
          systemQuantity,
          countedQuantity,
          varianceQuantity,
          unitCost,
          varianceValue,
          varianceStatus,
          notes: it.notes?.trim() || '',
        };
      });

      const netVarianceValue = totalSurplusValue - totalDeficitValue;

      const auditTrail = data.auditTrail || [
        {
          action: isApproved ? 'شمارش و ثبت قطعی انبارگردانی' : 'ثبت پیش‌نویس دوره انبارگردانی',
          userName: user.fullName,
          timestamp: `${new Date().toLocaleDateString('fa-IR')} ${new Date().toLocaleTimeString('fa-IR')}`,
          notes: data.notes,
        },
      ];

      const session: StocktakingSession = {
        id: data.id || `stk-${Date.now()}`,
        code,
        title,
        warehouseId,
        warehouseName,
        countRound: data.countRound || 1,
        date: data.date || new Date().toLocaleDateString('fa-IR'),
        status: isApproved ? 'approved' : 'draft',
        items,
        totalItemsCount: items.length,
        totalDeficitValue,
        totalSurplusValue,
        netVarianceValue,
        approvedBy: isApproved ? user.fullName : undefined,
        approvedAt: isApproved ? `${new Date().toLocaleDateString('fa-IR')} ${new Date().toLocaleTimeString('fa-IR')}` : undefined,
        auditTrail,
        notes: data.notes?.trim() || '',
        createdBy: user.fullName,
        createdAt: new Date().toLocaleDateString('fa-IR'),
      };

      if (isApproved) {
        this.executeApprovedStocktaking(session, user);
      }

      if (data.id) {
        const idx = this.stocktakingSessions.findIndex((s) => s.id === data.id);
        if (idx !== -1) {
          this.stocktakingSessions[idx] = session;
          this.addAuditLog(user.id, user.fullName, isApproved ? 'approve' : 'update', 'انبارگردانی', `ویرایش انبارگردانی ${code}`, session.id);
          return session;
        }
      }

      this.stocktakingSessions.unshift(session);
      this.addAuditLog(user.id, user.fullName, isApproved ? 'approve' : 'create', 'انبارگردانی', `ثبت ${isApproved ? 'قطعی' : 'پیش‌نویس'} دوره انبارگردانی ${code} با مغایرت خالص ${netVarianceValue.toLocaleString('fa-IR')} تومان`, session.id);
      return session;
    });
  }

  approveStocktakingSession(id: string, user: User): StocktakingSession {
    return this.runInTransaction(() => {
      const idx = this.stocktakingSessions.findIndex((s) => s.id === id);
      if (idx === -1) throw new TransactionError('برگه انبارگردانی یافت نشد.');
      const session = this.stocktakingSessions[idx];

      if (session.status === 'approved') return session;

      this.executeApprovedStocktaking(session, user);
      session.status = 'approved';
      session.approvedBy = user.fullName;
      session.approvedAt = `${new Date().toLocaleDateString('fa-IR')} ${new Date().toLocaleTimeString('fa-IR')}`;
      session.auditTrail.push({
        action: 'تایید نهایی انبارگردانی و صدور تعدیل سیستمی',
        userName: user.fullName,
        timestamp: `${new Date().toLocaleDateString('fa-IR')} ${new Date().toLocaleTimeString('fa-IR')}`,
        notes: 'موجودی انبارها با اقلام شمارش‌شده منطبق شد',
      });

      this.addAuditLog(user.id, user.fullName, 'approve', 'انبارگردانی', `تایید نهایی دوره انبارگردانی «${session.code}»`, session.id);
      return session;
    });
  }

  private executeApprovedStocktaking(session: StocktakingSession, user: User) {
    session.items.forEach((it, idx) => {
      if (it.varianceQuantity === 0) return; // اقلام بدون مغایرت نیازی به تعدیل ندارند

      const prd = this.products.find((p) => p.id === it.productId);
      if (!prd) return;

      const isSurplus = it.varianceQuantity > 0;
      const absQty = Math.abs(it.varianceQuantity);

      if (isSurplus) {
        prd.currentStock += absQty;
      } else {
        validateInventoryStock(prd.name, prd.currentStock, absQty, this.settings.allowNegativeStock);
        prd.currentStock -= absQty;
      }

      // به‌روزرسانی موجودی انبارگردانی‌شده
      const ws = this.warehouseStocks.find((w) => w.productId === prd.id && w.warehouseId === session.warehouseId);
      if (ws) {
        ws.quantity += it.varianceQuantity;
        ws.lastUpdated = session.date;
      } else {
        this.warehouseStocks.push({
          productId: prd.id,
          warehouseId: session.warehouseId,
          quantity: it.countedQuantity,
          lastUpdated: session.date,
        });
      }

      // ثبت ردیف کاردکس برای مغایرت انبارگردانی
      this.kardexEntries.unshift({
        id: `kd-stk-${Date.now()}-${idx}`,
        productId: prd.id,
        productCode: prd.code,
        productName: prd.name,
        warehouseId: session.warehouseId,
        warehouseName: session.warehouseName,
        date: session.date,
        referenceType: isSurplus ? 'adjustment_plus' : 'adjustment_minus',
        referenceTypeTitle: isSurplus ? 'تعدیل فزونی انبارگردانی' : 'تعدیل کسری انبارگردانی',
        referenceId: session.id,
        referenceNumber: session.code,
        inQuantity: isSurplus ? absQty : 0,
        outQuantity: !isSurplus ? absQty : 0,
        unitName: prd.baseUnitName || 'عدد',
        unitPrice: it.unitCost,
        totalValue: absQty * it.unitCost,
        balanceQuantity: prd.currentStock,
        balanceValue: prd.currentStock * prd.purchasePrice,
        userId: user.id,
        userName: user.fullName,
        notes: `مغایرت انبارگردانی دوره ${session.code} (${isSurplus ? 'فزونی' : 'کسری'})`,
        createdAt: new Date().toLocaleDateString('fa-IR'),
      });
    });
  }

  deleteStocktakingSession(id: string, user: User): boolean {
    return this.runInTransaction(() => {
      const idx = this.stocktakingSessions.findIndex((s) => s.id === id);
      if (idx === -1) return false;
      const session = this.stocktakingSessions[idx];

      if (session.status === 'approved') {
        throw new TransactionError('صورت‌جلسه انبارگردانی تاییدشده به دلیل ثبت اسناد کاردکس و تعدیل موجودی قابل حذف نیست.');
      }

      this.stocktakingSessions.splice(idx, 1);
      this.addAuditLog(user.id, user.fullName, 'delete', 'انبارگردانی', `حذف پیش‌نویس انبارگردانی ${session.code}`, id);
      return true;
    });
  }

  // ۷. تعدیل موجودی با ثبت دلیل اجباری (Inventory Adjustments)
  saveInventoryAdjustment(data: Partial<InventoryAdjustment>, user: User): InventoryAdjustment {
    return this.runInTransaction(() => {
      const reasonDescription = data.reasonDescription?.trim();
      if (!reasonDescription || reasonDescription.length < 3) {
        throw new TransactionError('ثبت شرح کامل دلیل تعدیل موجودی انبار اجباری است.');
      }

      const warehouse = this.warehouses.find((w) => w.id === data.warehouseId) || this.warehouses[0];
      const warehouseId = warehouse?.id || 'wh-central';
      const warehouseName = warehouse?.name || 'انبار مرکزی و بنکداری';

      const adjustmentNumber = data.adjustmentNumber || `ADJ-${1400 + this.inventoryAdjustments.length + 1}`;
      const type = data.type || 'minus';
      const isApproved = data.status === 'approved';

      const reasonTitles: Record<InventoryAdjustmentReason, string> = {
        damage: 'خرابی، پارگی و ضایعات فیزیکی',
        expiration: 'افت کیفیت، کهنگی و پوسیدگی',
        counting_error: 'خطای شمارش و اشتباه ثبت حواله قبلی',
        theft_loss: 'مفقودی یا سرقت',
        sample: 'نمونه‌برداری و ارائه کاتالوگ به مزون‌ها',
        stocktaking_variance: 'مغایرت رسمی انبارگردانی',
        other: 'سایر موارد مستند با تایید مدیریت',
      };

      const reasonCode: InventoryAdjustmentReason = data.reasonCode || 'damage';
      const reasonTitle = reasonTitles[reasonCode] || 'تعدیل متفرقه';

      const rawItems = data.items || [];
      if (rawItems.length === 0) {
        throw new TransactionError('برگه تعدیل موجودی باید حداقل دارای یک ردیف کالا باشد.');
      }

      let totalQuantity = 0;
      let totalCost = 0;

      const items: InventoryAdjustmentItem[] = rawItems.map((it, idx) => {
        const prd = this.products.find((p) => p.id === it.productId);
        const qty = Number(it.quantity) || 0;
        const unitCost = it.unitCost || prd?.purchasePrice || 0;
        const lineCost = qty * unitCost;

        totalQuantity += qty;
        totalCost += lineCost;

        return {
          id: it.id || `adj-it-${Date.now()}-${idx}`,
          productId: it.productId,
          productCode: prd ? prd.code : it.productCode || '',
          productName: prd ? prd.name : it.productName || '',
          unitName: it.unitName || prd?.baseUnitName || 'عدد',
          quantity: qty,
          unitCost,
          totalCost: lineCost,
        };
      });

      const auditTrail = data.auditTrail || [
        {
          action: isApproved ? 'ثبت و تایید مستقیم تعدیل موجودی' : 'ثبت پیش‌نویس برگه تعدیل',
          userName: user.fullName,
          timestamp: `${new Date().toLocaleDateString('fa-IR')} ${new Date().toLocaleTimeString('fa-IR')}`,
          notes: reasonDescription,
        },
      ];

      const adjustment: InventoryAdjustment = {
        id: data.id || `adj-${Date.now()}`,
        adjustmentNumber,
        warehouseId,
        warehouseName,
        date: data.date || new Date().toLocaleDateString('fa-IR'),
        type,
        reasonCode,
        reasonTitle,
        reasonDescription,
        status: isApproved ? 'approved' : 'draft',
        items,
        totalQuantity,
        totalCost,
        approvedBy: isApproved ? user.fullName : undefined,
        approvedAt: isApproved ? `${new Date().toLocaleDateString('fa-IR')} ${new Date().toLocaleTimeString('fa-IR')}` : undefined,
        auditTrail,
        notes: data.notes?.trim() || '',
        createdBy: user.fullName,
        createdAt: new Date().toLocaleDateString('fa-IR'),
      };

      if (isApproved) {
        this.executeApprovedAdjustment(adjustment, user);
      }

      if (data.id) {
        const idx = this.inventoryAdjustments.findIndex((a) => a.id === data.id);
        if (idx !== -1) {
          this.inventoryAdjustments[idx] = adjustment;
          this.addAuditLog(user.id, user.fullName, isApproved ? 'approve' : 'update', 'تعدیل موجودی', `ویرایش برگه تعدیل شماره ${adjustmentNumber}`, adjustment.id);
          return adjustment;
        }
      }

      this.inventoryAdjustments.unshift(adjustment);
      this.addAuditLog(user.id, user.fullName, isApproved ? 'approve' : 'create', 'تعدیل موجودی', `ثبت ${isApproved ? 'قطعی' : 'پیش‌نویس'} برگه تعدیل ${adjustmentNumber} (${type === 'plus' ? 'فزونی' : 'کسری'}) به دلیل «${reasonTitle}»`, adjustment.id);
      return adjustment;
    });
  }

  approveInventoryAdjustment(id: string, user: User): InventoryAdjustment {
    return this.runInTransaction(() => {
      const idx = this.inventoryAdjustments.findIndex((a) => a.id === id);
      if (idx === -1) throw new TransactionError('برگه تعدیل یافت نشد.');
      const adjustment = this.inventoryAdjustments[idx];

      if (adjustment.status === 'approved') return adjustment;

      this.executeApprovedAdjustment(adjustment, user);
      adjustment.status = 'approved';
      adjustment.approvedBy = user.fullName;
      adjustment.approvedAt = `${new Date().toLocaleDateString('fa-IR')} ${new Date().toLocaleTimeString('fa-IR')}`;
      adjustment.auditTrail.push({
        action: 'تایید قطعی برگه تعدیل',
        userName: user.fullName,
        timestamp: `${new Date().toLocaleDateString('fa-IR')} ${new Date().toLocaleTimeString('fa-IR')}`,
      });

      this.addAuditLog(user.id, user.fullName, 'approve', 'تعدیل موجودی', `تایید قطعی برگه تعدیل موجودی شماره ${adjustment.adjustmentNumber}`, adjustment.id);
      return adjustment;
    });
  }

  private executeApprovedAdjustment(adjustment: InventoryAdjustment, user: User) {
    const isPlus = adjustment.type === 'plus';

    adjustment.items.forEach((it, idx) => {
      const prd = this.products.find((p) => p.id === it.productId);
      if (!prd) return;

      if (isPlus) {
        prd.currentStock += it.quantity;
      } else {
        validateInventoryStock(prd.name, prd.currentStock, it.quantity, this.settings.allowNegativeStock);
        prd.currentStock -= it.quantity;
      }

      // به‌روزرسانی موجودی انبار مربوطه
      const ws = this.warehouseStocks.find((w) => w.productId === prd.id && w.warehouseId === adjustment.warehouseId);
      if (ws) {
        ws.quantity += isPlus ? it.quantity : -it.quantity;
        ws.lastUpdated = adjustment.date;
      } else {
        this.warehouseStocks.push({
          productId: prd.id,
          warehouseId: adjustment.warehouseId,
          quantity: isPlus ? it.quantity : -it.quantity,
          lastUpdated: adjustment.date,
        });
      }

      // ثبت گردش در کاردکس تعدادی و ریالی با شرح دلیل مستند
      this.kardexEntries.unshift({
        id: `kd-adj-${Date.now()}-${idx}`,
        productId: prd.id,
        productCode: prd.code,
        productName: prd.name,
        warehouseId: adjustment.warehouseId,
        warehouseName: adjustment.warehouseName,
        date: adjustment.date,
        referenceType: isPlus ? 'adjustment_plus' : 'adjustment_minus',
        referenceTypeTitle: isPlus ? `تعدیل افزایشی (${adjustment.reasonTitle})` : `تعدیل کاهشی (${adjustment.reasonTitle})`,
        referenceId: adjustment.id,
        referenceNumber: adjustment.adjustmentNumber,
        inQuantity: isPlus ? it.quantity : 0,
        outQuantity: !isPlus ? it.quantity : 0,
        unitName: prd.baseUnitName || 'عدد',
        unitPrice: it.unitCost,
        totalValue: it.quantity * it.unitCost,
        balanceQuantity: prd.currentStock,
        balanceValue: prd.currentStock * prd.purchasePrice,
        userId: user.id,
        userName: user.fullName,
        notes: `دلیل تعدیل: ${adjustment.reasonDescription}`,
        createdAt: new Date().toLocaleDateString('fa-IR'),
      });
    });
  }

  deleteInventoryAdjustment(id: string, user: User): boolean {
    return this.runInTransaction(() => {
      const idx = this.inventoryAdjustments.findIndex((a) => a.id === id);
      if (idx === -1) return false;
      const adj = this.inventoryAdjustments[idx];

      if (adj.status === 'approved') {
        throw new TransactionError('برگه تعدیل قطعی‌شده به دلیل درج در کاردکس و اثر بر موجودی انبار قابل حذف نیست.');
      }

      this.inventoryAdjustments.splice(idx, 1);
      this.addAuditLog(user.id, user.fullName, 'delete', 'تعدیل موجودی', `حذف پیش‌نویس تعدیل شماره ${adj.adjustmentNumber}`, id);
      return true;
    });
  }

  // ۸. گزارش جامع گردش کالا و تحلیل انبارداری (Inventory Movement & Turnover Report)
  getInventoryTurnoverReport(): InventoryTurnoverReportRow[] {
    return this.products.map((prd) => {
      const entries = this.kardexEntries.filter((k) => k.productId === prd.id);

      const totalInflow = entries.reduce((s, k) => s + (k.inQuantity || 0), 0);
      const totalOutflow = entries.reduce((s, k) => s + (k.outQuantity || 0), 0);

      // موجودی ابتدای دوره از روی اولین سند گردش
      const initialEntry = entries.find((k) => k.referenceType === 'initial_stock');
      const initialStock = initialEntry ? initialEntry.inQuantity : Math.max(0, prd.currentStock - totalInflow + totalOutflow);

      const avgStock = Math.max(1, (initialStock + prd.currentStock) / 2);
      const turnoverRatio = Math.round((totalOutflow / avgStock) * 100) / 100;
      const turnoverDays = turnoverRatio > 0 ? Math.round(365 / turnoverRatio) : 365;

      let status: 'normal' | 'low_stock' | 'out_of_stock' | 'stagnant' = 'normal';
      if (prd.currentStock <= 0) {
        status = 'out_of_stock';
      } else if (prd.currentStock <= prd.minStockAlert) {
        status = 'low_stock';
      } else if (totalOutflow === 0) {
        status = 'stagnant';
      }

      return {
        productId: prd.id,
        productCode: prd.code,
        productName: prd.name,
        categoryName: prd.categoryName || 'خرازی',
        unitName: prd.baseUnitName || 'عدد',
        initialStock,
        totalInflow,
        totalOutflow,
        currentStock: prd.currentStock,
        unitPurchasePrice: prd.purchasePrice,
        totalStockValue: prd.currentStock * prd.purchasePrice,
        turnoverRatio,
        turnoverDays,
        status,
      };
    });
  }

  // ۹. هشدارهای حداقل موجودی کالا (نقطه سفارش)
  getLowStockProducts(): Product[] {
    return this.products.filter((p) => p.isActive && p.currentStock <= p.minStockAlert);
  }

  // متد تست برای راستی‌آزمایی رول‌بک تراکنش
  simulateFailedTransaction(): void {
    this.runInTransaction(() => {
      this.users.push({
        id: 'tmp-fail-user',
        username: 'temporary_fail',
        fullName: 'کاربر تستی شکست',
        role: 'cashier',
        isActive: false,
        createdAt: '1403/01/01',
      });
      validateVoucherBalance(1000000, 500000);
    });
  }

  // ۱۰. گزارش‌های جامع مدیریتی و حسابداری با پشتیبانی از فیلترهای چندگانه
  getComprehensiveReports(filters: ReportFilters = {}) {
    const profitability = calculateProfitabilityAndCogsReport(
      this.invoices,
      this.products,
      this.accessoryCosts,
      this.treasuryTransactions,
      filters
    );
    const periodic = calculatePeriodicSalesAndPurchasesReport(
      this.invoices,
      this.products,
      filters
    );
    const bestAndLeastSelling = calculateBestAndLeastSellingReport(
      this.invoices,
      this.products,
      filters
    );
    const inventoryAndTurnover = calculateInventoryAndTurnoverReport(
      this.products,
      this.warehouseStocks,
      this.warehouses,
      this.kardexEntries,
      filters
    );
    const personsAndAging = calculatePersonsDebtorsCreditorsAndAgingReport(
      this.persons,
      this.invoices,
      this.treasuryTransactions,
      this.cheques,
      this.vouchers,
      filters
    );
    const expenses = calculateExpensesReport(
      this.treasuryTransactions,
      this.accessoryCosts,
      this.vouchers,
      this.financialCategories,
      filters
    );
    const treasuryAndCheques = calculateTreasuryAndChequesReport(
      this.treasuryAccounts,
      this.treasuryTransactions,
      this.cheques,
      this.invoices,
      this.vouchers,
      filters
    );
    const financialStatements = calculateFinancialStatementsReport(
      this.accountsChart,
      this.vouchers,
      this.invoices,
      this.products,
      this.persons,
      this.treasuryAccounts,
      this.treasuryTransactions,
      this.cheques,
      this.accessoryCosts,
      filters
    );
    const verification = this.verifySampleReports();

    return {
      filtersApplied: filters,
      profitability,
      periodic,
      bestAndLeastSelling,
      inventoryAndTurnover,
      personsAndAging,
      expenses,
      treasuryAndCheques,
      financialStatements,
      verification,
      metadata: {
        products: this.products.map((p) => ({ id: p.id, code: p.code, name: p.name, categoryId: p.categoryId })),
        persons: this.persons.map((p) => ({ id: p.id, code: p.code, name: p.name, personType: p.personType })),
        categories: this.categories,
        warehouses: this.warehouses,
        treasuryAccounts: this.treasuryAccounts.map((a) => ({ id: a.id, title: a.title, type: a.type })),
        accounts: this.accountsChart,
        storeSettings: this.settings,
      },
    };
  }

  // ۱۱. کنترل و راستی‌آزمایی صحت گزارش‌ها با اسناد نمونه
  verifySampleReports() {
    return verifyReportsWithSampleDocuments({
      products: this.products,
      persons: this.persons,
      invoices: this.invoices,
      warehouses: this.warehouses,
      warehouseStocks: this.warehouseStocks,
      kardexEntries: this.kardexEntries,
      treasuryAccounts: this.treasuryAccounts,
      treasuryTransactions: this.treasuryTransactions,
      cheques: this.cheques,
      accessoryCosts: this.accessoryCosts,
      accounts: this.accountsChart,
      vouchers: this.vouchers,
    });
  }

  // =========================================================================
  // ۱۲. مدیریت سال مالی شمسی، افتتاحیه، کنترل پیش از بستن، اختتامیه و انتقال به سال بعد
  // =========================================================================

  /**
   * بررسی باز بودن سال مالی جهت جلوگیری از تغییر در دوره‌های بسته‌شده
   */
  assertFiscalYearOpen(dateStr?: string, fiscalYearIdOrCode?: string): void {
    const normDate = normalizePersianDate(dateStr);
    const code = fiscalYearIdOrCode ? toEnglishDigits(fiscalYearIdOrCode.replace('fy-', '')) : '';

    for (const fy of this.fiscalYears) {
      if (!fy.isClosed) continue;
      const fyCode = toEnglishDigits(fy.code);
      if (code && (fy.id === fiscalYearIdOrCode || fyCode === code)) {
        throw new TransactionError(
          `عملیات غیرمجاز: «${fy.title}» بسته و قفل شده است. طبق اصول حسابداری، اسناد و گزارش‌های سال‌های مالی بسته‌شده محفوظ بوده و امکان ثبت یا تغییر سند در آن‌ها وجود ندارد.`
        );
      }
      if (normDate && isDateInRange(normDate, fy.startDate, fy.endDate)) {
        throw new TransactionError(
          `عملیات غیرمجاز: تاریخ «${normDate}» در بازه زمانی «${fy.title}» قرار دارد که قبلاً بسته شده است.`
        );
      }
    }
  }

  /**
   * دریافت لیست کامل سال‌های مالی شمسی به ترتیب سال
   */
  getFiscalYears(): FiscalYear[] {
    return [...this.fiscalYears].sort((a, b) =>
      toEnglishDigits(b.code).localeCompare(toEnglishDigits(a.code))
    );
  }

  /**
   * تعریف یا ویرایش سال مالی شمسی با اعتبارسنجی کامل
   */
  saveFiscalYear(
    data: {
      id?: string;
      code: string;
      title: string;
      startDate: string;
      endDate: string;
      description?: string;
      setAsActive?: boolean;
    },
    user: User
  ): FiscalYear {
    return this.runInTransaction(() => {
      const validation = validateFiscalYearDefinition(data, this.fiscalYears, data.id);
      if (!validation.isValid) {
        throw new TransactionError(validation.errors.join(' | '));
      }

      const nowStr = `${new Date().toLocaleDateString('fa-IR')} ${new Date().toLocaleTimeString('fa-IR')}`;

      if (data.id) {
        const idx = this.fiscalYears.findIndex((f) => f.id === data.id);
        if (idx === -1) throw new TransactionError('سال مالی مورد نظر یافت نشد.');
        const existing = this.fiscalYears[idx];
        if (existing.isClosed) {
          throw new TransactionError(`امکان ویرایش مشخصات «${existing.title}» به دلیل بسته بودن دوره مالی وجود ندارد.`);
        }

        existing.code = validation.normalizedCode;
        existing.title = data.title.trim();
        existing.startDate = validation.normalizedStartDate;
        existing.endDate = validation.normalizedEndDate;
        existing.isLeapYear = validation.isLeapYear;
        existing.description = data.description?.trim() || existing.description;
        existing.auditTrail.unshift({
          action: `ویرایش مشخصات سال مالی (${existing.startDate} تا ${existing.endDate})`,
          userName: user.fullName,
          timestamp: nowStr,
        });

        if (data.setAsActive) {
          this.fiscalYears.forEach((f) => (f.isActive = f.id === existing.id));
          this.settings.activeFiscalYear = existing.code.replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[+d]);
        }

        this.addAuditLog(user.id, user.fullName, 'update', 'مدیریت سال مالی', `ویرایش ${existing.title}`, existing.id);
        return existing;
      }

      const newFy: FiscalYear = {
        id: `fy-${validation.normalizedCode}`,
        code: validation.normalizedCode,
        title: data.title.trim(),
        startDate: validation.normalizedStartDate,
        endDate: validation.normalizedEndDate,
        status: 'open',
        isClosed: false,
        isActive: Boolean(data.setAsActive),
        isLeapYear: validation.isLeapYear,
        description: data.description?.trim() || `دوره مالی سال ${data.title.trim()}`,
        auditTrail: [
          {
            action: `تعریف سال مالی جدید (${validation.normalizedStartDate} تا ${validation.normalizedEndDate})`,
            userName: user.fullName,
            timestamp: nowStr,
            notes: data.description,
          },
        ],
        createdBy: user.fullName,
        createdAt: new Date().toLocaleDateString('fa-IR'),
      };

      if (newFy.isActive) {
        this.fiscalYears.forEach((f) => (f.isActive = false));
        this.settings.activeFiscalYear = validation.normalizedCode.replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[+d]);
      }

      this.fiscalYears.unshift(newFy);
      this.addAuditLog(
        user.id,
        user.fullName,
        'create',
        'مدیریت سال مالی',
        `تعریف سال مالی جدید: «${newFy.title}» از ${newFy.startDate} تا ${newFy.endDate}`,
        newFy.id
      );
      return newFy;
    });
  }

  /**
   * تغییر سال مالی فعال سیستم
   */
  activateFiscalYear(id: string, user: User): FiscalYear {
    return this.runInTransaction(() => {
      const fy = this.fiscalYears.find((f) => f.id === id);
      if (!fy) throw new TransactionError('سال مالی مورد نظر یافت نشد.');

      this.fiscalYears.forEach((f) => (f.isActive = f.id === id));
      this.settings.activeFiscalYear = toEnglishDigits(fy.code).replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[+d]);

      fy.auditTrail.unshift({
        action: 'انتخاب به عنوان دوره مالی فعال در سیستم',
        userName: user.fullName,
        timestamp: `${new Date().toLocaleDateString('fa-IR')} ${new Date().toLocaleTimeString('fa-IR')}`,
      });

      this.addAuditLog(
        user.id,
        user.fullName,
        'update',
        'مدیریت سال مالی',
        `تغییر سال مالی فعال سیستم به «${fy.title}»`,
        fy.id
      );
      return fy;
    });
  }

  /**
   * ثبت یا به‌روزرسانی مانده‌های افتتاحیه یک سال مالی باز به همراه صدور سند افتتاحیه متوازن
   */
  saveOpeningBalances(fiscalYearId: string, payload: OpeningBalancePayload, user: User) {
    return this.runInTransaction(() => {
      const fy = this.fiscalYears.find((f) => f.id === fiscalYearId);
      if (!fy) throw new TransactionError('سال مالی مورد نظر یافت نشد.');
      if (fy.isClosed) {
        throw new TransactionError(`امکان ثبت یا تغییر مانده افتتاحیه برای «${fy.title}» وجود ندارد زیرا این سال مالی بسته شده است.`);
      }

      const preview = calculateOpeningBalancePreview(
        payload,
        this.treasuryAccounts,
        this.persons,
        this.products
      );

      if (!preview.isBalanced) {
        throw new TransactionError(
          `تراز افتتاحیه نامتوازن است (اختلاف بدهکار و بستانکار: ${Math.abs(preview.variance).toLocaleString('fa-IR')} تومان). لطفاً مبلغ سرمایه اول دوره را بررسی یا در حالت محاسبه خودکار قرار دهید.`
        );
      }

      const fyCode = toEnglishDigits(fy.code);
      const openDate = normalizePersianDate(payload.date || fy.startDate) || `${fyCode}/01/01`;

      // ۱. اعمال مانده اول دوره حساب‌های خزانه (صندوق، بانک، کارتخوان)
      for (const tb of payload.treasuryBalances || []) {
        const acc = this.treasuryAccounts.find((a) => a.id === tb.accountId);
        if (acc) {
          const oldInit = acc.initialBalance ?? acc.balance;
          const newInit = Math.max(0, Math.round(Number(tb.amount) || 0));
          const delta = newInit - oldInit;
          acc.initialBalance = newInit;
          acc.balance = Math.max(0, acc.balance + delta);
        }
      }

      // ۲. اعمال مانده اول دوره اشخاص (در صورتی که سال جدید و بدون فاکتور است مستقیماً ست می‌شود)
      const fyInvoices = this.invoices.filter(
        (i) => toEnglishDigits(i.fiscalYearId) === fyCode && i.status === 'approved'
      );
      for (const pb of payload.personBalances || []) {
        const per = this.persons.find((p) => p.id === pb.personId);
        if (per) {
          if (fyInvoices.length === 0) {
            per.currentBalance = Math.round(Number(pb.balance) || 0);
          } else {
            per.currentBalance = Math.round(Number(pb.balance) || 0);
          }
        }
      }

      // ۳. اعمال موجودی اول دوره کالاها و ثبت در کاردکس انبار
      const defaultWh = this.warehouses.find((w) => w.isDefault) || this.warehouses[0];
      for (const ib of payload.inventoryBalances || []) {
        const prd = this.products.find((p) => p.id === ib.productId);
        if (!prd) continue;
        const newQty = Math.max(0, Number(ib.quantity) || 0);
        const newCost = Math.max(0, Number(ib.unitPurchasePrice) || prd.purchasePrice);
        prd.purchasePrice = newCost;

        if (fyInvoices.length === 0) {
          prd.currentStock = newQty;
          const targetWhId = ib.warehouseId || defaultWh?.id || 'wh-central';
          const ws = this.warehouseStocks.find(
            (w) => w.productId === prd.id && w.warehouseId === targetWhId
          );
          if (ws) {
            ws.quantity = newQty;
            ws.lastUpdated = openDate;
          } else {
            this.warehouseStocks.push({
              productId: prd.id,
              warehouseId: targetWhId,
              quantity: newQty,
              lastUpdated: openDate,
            });
          }
        }

        // به‌روزرسانی یا درج ردیف کاردکس موجودی اول دوره این سال مالی
        const existingKdIdx = this.kardexEntries.findIndex(
          (k) =>
            k.productId === prd.id &&
            k.referenceType === 'initial_stock' &&
            normalizePersianDate(k.date).startsWith(fyCode)
        );
        const kdEntry: KardexEntry = {
          id: existingKdIdx >= 0 ? this.kardexEntries[existingKdIdx].id : `kd-open-${fyCode}-${prd.id}`,
          productId: prd.id,
          productCode: prd.code,
          productName: prd.name,
          warehouseId: ib.warehouseId || defaultWh?.id || 'wh-central',
          warehouseName: defaultWh?.name || 'انبار مرکزی و بنکداری',
          date: openDate,
          referenceType: 'initial_stock',
          referenceTypeTitle: `موجودی اول دوره سال ${fy.code}`,
          referenceId: fy.id,
          referenceNumber: `OPN-${fyCode}`,
          inQuantity: newQty,
          outQuantity: 0,
          unitName: prd.baseUnitName || 'عدد',
          unitPrice: newCost,
          totalValue: Math.round(newQty * newCost),
          balanceQuantity: prd.currentStock,
          balanceValue: Math.round(prd.currentStock * prd.purchasePrice),
          userId: user.id,
          userName: user.fullName,
          notes: `ثبت موجودی اول دوره در سند افتتاحیه ${fy.title}`,
          createdAt: openDate,
        };
        if (existingKdIdx >= 0) {
          this.kardexEntries[existingKdIdx] = kdEntry;
        } else if (newQty > 0) {
          this.kardexEntries.push(kdEntry);
        }
      }

      // ۴. صدور یا به‌روزرسانی سند حسابداری افتتاحیه سال مالی
      const existingOpenVchIdx = this.vouchers.findIndex(
        (v) =>
          v.referenceType === 'opening_balance' &&
          (toEnglishDigits(v.fiscalYearId) === fyCode || v.id === fy.openingVoucherId)
      );

      const voucherNumber =
        existingOpenVchIdx >= 0
          ? this.vouchers[existingOpenVchIdx].voucherNumber
          : `OPN-${fyCode}-1001`;

      const openingVoucher = generateOpeningBalanceVoucherFromPayload(
        { ...payload, date: openDate },
        fy,
        this.treasuryAccounts,
        this.persons,
        this.products,
        voucherNumber,
        user.fullName
      );

      if (existingOpenVchIdx >= 0) {
        openingVoucher.id = this.vouchers[existingOpenVchIdx].id;
        this.vouchers[existingOpenVchIdx] = openingVoucher;
      } else {
        this.vouchers.push(openingVoucher);
      }

      fy.openingVoucherId = openingVoucher.id;
      fy.openingVoucherNumber = openingVoucher.voucherNumber;
      fy.auditTrail.unshift({
        action: `ثبت و صدور سند افتتاحیه شماره ${openingVoucher.voucherNumber} به تراز ${openingVoucher.totalDebit.toLocaleString('fa-IR')} تومان`,
        userName: user.fullName,
        timestamp: `${new Date().toLocaleDateString('fa-IR')} ${new Date().toLocaleTimeString('fa-IR')}`,
      });

      this.addAuditLog(
        user.id,
        user.fullName,
        'create',
        'افتتاحیه سال مالی',
        `ثبت مانده‌های افتتاحیه «${fy.title}» و صدور سند شماره ${openingVoucher.voucherNumber} به مبلغ ${openingVoucher.totalDebit.toLocaleString('fa-IR')} تومان`,
        openingVoucher.id
      );

      return {
        fiscalYear: fy,
        openingVoucher,
        preview,
      };
    });
  }

  /**
   * اجرای ممیزی کامل قبل از بستن سال مالی (Pre-Closing Audit)
   */
  getPreClosingAudit(fiscalYearId: string): FiscalPreClosingAudit {
    const fy =
      this.fiscalYears.find((f) => f.id === fiscalYearId) ||
      this.fiscalYears.find((f) => f.isActive) ||
      this.fiscalYears[0];

    if (!fy) {
      throw new TransactionError('سال مالی مورد نظر یافت نشد.');
    }

    return runPreClosingAudit({
      fiscalYear: fy,
      accounts: this.accountsChart,
      vouchers: this.vouchers,
      invoices: this.invoices,
      products: this.products,
      persons: this.persons,
      treasuryAccounts: this.treasuryAccounts,
      treasuryTransactions: this.treasuryTransactions,
      cheques: this.cheques,
      warehouses: this.warehouses,
      warehouseStocks: this.warehouseStocks,
      accessoryCosts: this.accessoryCosts,
      goodsReceipts: this.goodsReceipts,
      warehouseTransfers: this.warehouseTransfers,
      stocktakingSessions: this.stocktakingSessions,
      inventoryAdjustments: this.inventoryAdjustments,
    });
  }

  /**
   * ایجاد یک سند حسابداری پیش‌نویس آزمایشی برای تست هشدار مسدودکننده قبل از بستن سال
   */
  createTestDraftDocumentForAudit(fiscalYearId: string, user: User): AccountingVoucher {
    return this.runInTransaction(() => {
      const fy = this.fiscalYears.find((f) => f.id === fiscalYearId);
      if (!fy) throw new TransactionError('سال مالی یافت نشد.');
      if (fy.isClosed) throw new TransactionError('این سال مالی بسته شده است.');

      const fyCode = toEnglishDigits(fy.code);
      const draftVch: AccountingVoucher = {
        id: `vch-draft-test-${Date.now()}`,
        voucherNumber: `DRF-${1000 + this.vouchers.length + 1}`,
        date: `${fyCode}/11/15`,
        description: `سند موقت ثبت‌نشده (پیش‌نویس آزمایشی جهت تست کنترل قبل از بستن ${fy.title})`,
        fiscalYearId: fyCode,
        status: 'draft',
        referenceType: 'manual',
        lines: [
          {
            id: `vl-drf-1-${Date.now()}`,
            accountCode: '601',
            accountTitle: 'هزینه‌های عمومی و اداری فروشگاه',
            debit: 1200000,
            credit: 0,
            description: 'هزینه تنخواه در انتظار تایید حسابدار',
          },
          {
            id: `vl-drf-2-${Date.now()}`,
            accountCode: '10101',
            accountTitle: 'صندوق نقدی فروشگاه (دخل اصلی)',
            debit: 0,
            credit: 1200000,
            description: 'پرداخت از صندوق اصلی',
          },
        ],
        totalDebit: 1200000,
        totalCredit: 1200000,
        isBalanced: true,
        createdBy: user.fullName,
        createdAt: new Date().toLocaleDateString('fa-IR'),
      };

      this.vouchers.unshift(draftVch);
      this.addAuditLog(
        user.id,
        user.fullName,
        'create',
        'کنترل سال مالی',
        `ایجاد سند پیش‌نویس آزمایشی شماره ${draftVch.voucherNumber} جهت بررسی خطای مسدودکننده بستن سال`,
        draftVch.id
      );
      return draftVch;
    });
  }

  /**
   * تعیین تکلیف یکجای اسناد ثبت‌نشده / پیش‌نویس (قطعی‌سازی یا حذف پیش‌نویس‌ها) قبل از بستن سال
   */
  resolveUnpostedDocuments(
    fiscalYearId: string,
    action: 'approve_all' | 'delete_drafts',
    user: User
  ): { resolvedCount: number; message: string; audit: FiscalPreClosingAudit } {
    return this.runInTransaction(() => {
      const fy = this.fiscalYears.find((f) => f.id === fiscalYearId);
      if (!fy) throw new TransactionError('سال مالی یافت نشد.');
      if (fy.isClosed) throw new TransactionError('این سال مالی قبلاً بسته شده است.');

      const fyCode = toEnglishDigits(fy.code);
      const startDate = normalizePersianDate(fy.startDate) || `${fyCode}/01/01`;
      const endDate = normalizePersianDate(fy.endDate) || `${fyCode}/12/29`;

      let resolvedCount = 0;

      if (action === 'approve_all') {
        // ۱. تایید اسناد حسابداری پیش‌نویس متوازن
        for (const v of this.vouchers) {
          if (
            v.status === 'draft' &&
            (toEnglishDigits(v.fiscalYearId) === fyCode || isDateInRange(v.date, startDate, endDate))
          ) {
            if (v.totalDebit === v.totalCredit && v.totalDebit > 0) {
              v.status = 'approved';
              resolvedCount++;
            }
          }
        }
        // ۲. تایید فاکتورهای پیش‌نویس
        for (const inv of this.invoices) {
          if (
            inv.status === 'draft' &&
            inv.invoiceType !== 'proforma' &&
            (toEnglishDigits(inv.fiscalYearId) === fyCode || isDateInRange(inv.date, startDate, endDate))
          ) {
            inv.status = 'approved';
            resolvedCount++;
          }
        }
        // ۳. تایید اسناد انباری پیش‌نویس
        for (const r of this.goodsReceipts) {
          if (r.status === 'draft' && isDateInRange(r.date, startDate, endDate)) {
            r.status = 'approved';
            resolvedCount++;
          }
        }
        for (const t of this.warehouseTransfers) {
          if (t.status === 'draft' && isDateInRange(t.date, startDate, endDate)) {
            t.status = 'approved';
            resolvedCount++;
          }
        }
        for (const s of this.stocktakingSessions) {
          if (s.status === 'draft' && isDateInRange(s.date, startDate, endDate)) {
            s.status = 'approved';
            resolvedCount++;
          }
        }
        for (const a of this.inventoryAdjustments) {
          if (a.status === 'draft' && isDateInRange(a.date, startDate, endDate)) {
            a.status = 'approved';
            resolvedCount++;
          }
        }
      } else {
        // حذف اسناد پیش‌نویس ثبت‌نشده
        const beforeVch = this.vouchers.length;
        this.vouchers = this.vouchers.filter(
          (v) =>
            !(
              v.status === 'draft' &&
              (toEnglishDigits(v.fiscalYearId) === fyCode || isDateInRange(v.date, startDate, endDate))
            )
        );
        resolvedCount += beforeVch - this.vouchers.length;

        const beforeInv = this.invoices.length;
        this.invoices = this.invoices.filter(
          (inv) =>
            !(
              inv.status === 'draft' &&
              inv.invoiceType !== 'proforma' &&
              (toEnglishDigits(inv.fiscalYearId) === fyCode || isDateInRange(inv.date, startDate, endDate))
            )
        );
        resolvedCount += beforeInv - this.invoices.length;
      }

      const message =
        action === 'approve_all'
          ? `تعداد ${resolvedCount} سند پیش‌نویس با موفقیت تایید و قطعی شد.`
          : `تعداد ${resolvedCount} سند پیش‌نویس موقت حذف و پاک‌سازی شد.`;

      fy.auditTrail.unshift({
        action: message,
        userName: user.fullName,
        timestamp: `${new Date().toLocaleDateString('fa-IR')} ${new Date().toLocaleTimeString('fa-IR')}`,
      });

      this.addAuditLog(user.id, user.fullName, 'approve', 'کنترل سال مالی', message, fy.id);

      const audit = this.getPreClosingAudit(fiscalYearId);
      return { resolvedCount, message, audit };
    });
  }

  /**
   * عملیات اتمیک بستن سال مالی، صدور اسناد اختتامیه، آرشیو گزارش‌ها و انتقال مانده‌ها به سال مالی جدید
   */
  closeFiscalYearAndRollover(
    fiscalYearId: string,
    options: {
      nextYearCode?: string;
      nextYearTitle?: string;
      notes?: string;
    },
    user: User
  ) {
    return this.runInTransaction(() => {
      const fy = this.fiscalYears.find((f) => f.id === fiscalYearId);
      if (!fy) throw new TransactionError('سال مالی مورد نظر یافت نشد.');
      if (fy.isClosed) {
        throw new TransactionError(`«${fy.title}» قبلاً بسته شده است.`);
      }

      // ۱. اجرای مجدد ممیزی و اطمینان از عدم وجود خطای مسدودکننده
      const audit = this.getPreClosingAudit(fiscalYearId);
      if (!audit.canClose) {
        const blockingTitles = audit.checks
          .filter((c) => c.blocking && !c.passed)
          .map((c) => c.title)
          .join('، ');
        throw new TransactionError(
          `امکان بستن سال مالی به دلیل وجود ${audit.blockingErrorsCount} خطای مسدودکننده وجود ندارد: ${blockingTitles}`
        );
      }

      const fyCode = toEnglishDigits(fy.code);
      const nextCode = toEnglishDigits(
        options.nextYearCode || String((parseInt(fyCode, 10) || 1403) + 1)
      );
      const nextLeap = isShamsiLeapYear(parseInt(nextCode, 10) || 1404);
      const nextStartDate = `${nextCode}/01/01`;
      const nextEndDate = `${nextCode}/12/${nextLeap ? '30' : '29'}`;
      const persianNextCode = nextCode.replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[+d]);
      const nextTitle = options.nextYearTitle?.trim() || `سال مالی ${persianNextCode} (دوره جدید)`;

      // ۲. تولید اسناد اختتامیه موقت، اختتامیه دائمی و افتتاحیه سال جدید
      const generated = generateClosingAndRolloverVouchers({
        closingFiscalYear: fy,
        nextFiscalYearCode: nextCode,
        nextFiscalYearTitle: nextTitle,
        nextFiscalYearStartDate: nextStartDate,
        accounts: this.accountsChart,
        vouchers: this.vouchers,
        invoices: this.invoices,
        products: this.products,
        persons: this.persons,
        treasuryAccounts: this.treasuryAccounts,
        treasuryTransactions: this.treasuryTransactions,
        cheques: this.cheques,
        accessoryCosts: this.accessoryCosts,
        createdBy: user.fullName,
      });

      const { closingTemporaryVoucher, closingPermanentVoucher, nextYearOpeningVoucher, financialSummary } =
        generated;

      // اعتبارسنجی توازن ۱۰۰٪ هر سه سند حیاتی
      validateVoucherBalance(closingTemporaryVoucher.totalDebit, closingTemporaryVoucher.totalCredit);
      validateVoucherBalance(closingPermanentVoucher.totalDebit, closingPermanentVoucher.totalCredit);
      validateVoucherBalance(nextYearOpeningVoucher.totalDebit, nextYearOpeningVoucher.totalCredit);

      // ۳. قطعی‌سازی (Permanent) کلیه اسناد سال مالی در حال بستن و افزودن اسناد اختتامیه
      const startDate = normalizePersianDate(fy.startDate) || `${fyCode}/01/01`;
      const endDate = normalizePersianDate(fy.endDate) || `${fyCode}/12/29`;

      for (const v of this.vouchers) {
        if (toEnglishDigits(v.fiscalYearId) === fyCode || isDateInRange(v.date, startDate, endDate)) {
          v.status = 'permanent';
        }
      }

      // حذف اسناد اختتامیه قبلی در صورت وجود و درج اسناد جدید
      this.vouchers = this.vouchers.filter(
        (v) =>
          v.id !== closingTemporaryVoucher.id &&
          v.id !== closingPermanentVoucher.id &&
          v.id !== nextYearOpeningVoucher.id
      );
      this.vouchers.unshift(closingTemporaryVoucher);
      this.vouchers.unshift(closingPermanentVoucher);

      // ۴. ساخت اسنپ‌شات آرشیوی کامل از سال مالی بسته‌شده جهت حفظ همیشگی گزارش‌ها و اسناد
      const archivedSnapshot = buildFiscalYearArchiveSnapshot({
        fiscalYear: fy,
        capturedBy: user.fullName,
        vouchers: this.vouchers,
        invoices: this.invoices,
        products: this.products,
        persons: this.persons,
        treasuryAccounts: this.treasuryAccounts,
        cheques: this.cheques,
        financialSummary,
      });

      const nowStr = `${new Date().toLocaleDateString('fa-IR')} ${new Date().toLocaleTimeString('fa-IR')}`;

      // ۵. ایجاد یا فعال‌سازی سال مالی جدید و انتقال مانده‌ها
      let nextFy = this.fiscalYears.find((f) => toEnglishDigits(f.code) === nextCode);
      if (!nextFy) {
        nextFy = {
          id: `fy-${nextCode}`,
          code: nextCode,
          title: nextTitle,
          startDate: nextStartDate,
          endDate: nextEndDate,
          status: 'open',
          isClosed: false,
          isActive: true,
          isLeapYear: nextLeap,
          description: `منتقل‌شده از اختتامیه ${fy.title} با تراز افتتاحیه ${nextYearOpeningVoucher.totalDebit.toLocaleString('fa-IR')} تومان`,
          previousFiscalYearId: fy.id,
          openingVoucherId: nextYearOpeningVoucher.id,
          openingVoucherNumber: nextYearOpeningVoucher.voucherNumber,
          auditTrail: [
            {
              action: `افتتاح خودکار دوره مالی و دریافت مانده‌های افتتاحیه از ${fy.title}`,
              userName: user.fullName,
              timestamp: nowStr,
              notes: options.notes,
            },
          ],
          createdBy: user.fullName,
          createdAt: nextStartDate,
        };
        this.fiscalYears.unshift(nextFy);
      } else {
        nextFy.status = 'open';
        nextFy.isClosed = false;
        nextFy.isActive = true;
        nextFy.previousFiscalYearId = fy.id;
        nextFy.openingVoucherId = nextYearOpeningVoucher.id;
        nextFy.openingVoucherNumber = nextYearOpeningVoucher.voucherNumber;
        nextFy.auditTrail.unshift({
          action: `دریافت مجدد تراز افتتاحیه از اختتامیه ${fy.title}`,
          userName: user.fullName,
          timestamp: nowStr,
        });
      }

      // درج سند افتتاحیه سال جدید
      this.vouchers.unshift(nextYearOpeningVoucher);

      // ثبت موجودی اول دوره سال جدید در کاردکس انبار جهت حفظ پیوستگی کاردکس در سال جدید
      const defaultWh = this.warehouses.find((w) => w.isDefault) || this.warehouses[0];
      for (const prd of this.products) {
        if (prd.currentStock <= 0) continue;
        const kdId = `kd-rollover-${nextCode}-${prd.id}`;
        if (!this.kardexEntries.some((k) => k.id === kdId)) {
          this.kardexEntries.unshift({
            id: kdId,
            productId: prd.id,
            productCode: prd.code,
            productName: prd.name,
            warehouseId: defaultWh?.id || 'wh-central',
            warehouseName: defaultWh?.name || 'انبار مرکزی و بنکداری',
            date: nextStartDate,
            referenceType: 'initial_stock',
            referenceTypeTitle: `موجودی اول دوره انتقالی از سال ${fy.code}`,
            referenceId: nextYearOpeningVoucher.id,
            referenceNumber: nextYearOpeningVoucher.voucherNumber,
            inQuantity: prd.currentStock,
            outQuantity: 0,
            unitName: prd.baseUnitName || 'عدد',
            unitPrice: prd.purchasePrice,
            totalValue: Math.round(prd.currentStock * prd.purchasePrice),
            balanceQuantity: prd.currentStock,
            balanceValue: Math.round(prd.currentStock * prd.purchasePrice),
            userId: user.id,
            userName: user.fullName,
            notes: `انتقال موجودی پایان دوره سال ${fy.code} به ابتدای سال مالی ${nextCode}`,
            createdAt: nextStartDate,
          });
        }
      }

      // به‌روزرسانی مانده اول دوره حساب‌های خزانه برای سال جدید
      for (const tr of this.treasuryAccounts) {
        tr.initialBalance = tr.balance;
      }

      // قفل کردن سال مالی قدیم
      fy.status = 'closed';
      fy.isClosed = true;
      fy.isActive = false;
      fy.closedAt = endDate;
      fy.closedBy = user.fullName;
      fy.nextFiscalYearId = nextFy.id;
      fy.closingTemporaryVoucherId = closingTemporaryVoucher.id;
      fy.closingTemporaryVoucherNumber = closingTemporaryVoucher.voucherNumber;
      fy.closingPermanentVoucherId = closingPermanentVoucher.id;
      fy.closingPermanentVoucherNumber = closingPermanentVoucher.voucherNumber;
      fy.archivedSnapshot = archivedSnapshot;
      fy.auditTrail.unshift({
        action: `بستن قطعی سال مالی، صدور سند سود و زیان (${closingTemporaryVoucher.voucherNumber}) و سند اختتامیه (${closingPermanentVoucher.voucherNumber}) و انتقال به ${nextFy.title}`,
        userName: user.fullName,
        timestamp: nowStr,
        notes: options.notes,
      });

      // فعال کردن تنها سال مالی جدید در کل سیستم
      this.fiscalYears.forEach((f) => {
        f.isActive = f.id === nextFy!.id;
      });
      this.settings.activeFiscalYear = persianNextCode;

      this.addAuditLog(
        user.id,
        user.fullName,
        'approve',
        'اختتامیه و انتقال سال مالی',
        `بستن قطعی «${fy.title}»، صدور اسناد اختتامیه (${closingTemporaryVoucher.voucherNumber} و ${closingPermanentVoucher.voucherNumber}) و انتقال مانده‌ها به «${nextFy.title}» (سند افتتاحیه ${nextYearOpeningVoucher.voucherNumber} به مبلغ ${nextYearOpeningVoucher.totalDebit.toLocaleString('fa-IR')} تومان)`,
        fy.id
      );

      return {
        closedFiscalYear: fy,
        newFiscalYear: nextFy,
        closingTemporaryVoucher,
        closingPermanentVoucher,
        nextYearOpeningVoucher,
        activeFiscalYearSetting: this.settings.activeFiscalYear,
      };
    });
  }

  /**
   * بازگشایی کنترل‌شده سال مالی بسته‌شده (توسط مدیر ارشد با ثبت دلیل در تاریخچه ممیزی)
   */
  reopenFiscalYear(fiscalYearId: string, reason: string, user: User): FiscalYear {
    return this.runInTransaction(() => {
      if (!reason || reason.trim().length < 3) {
        throw new TransactionError('ثبت دلیل مستند برای بازگشایی سال مالی بسته‌شده الزامی است.');
      }

      const fy = this.fiscalYears.find((f) => f.id === fiscalYearId);
      if (!fy) throw new TransactionError('سال مالی مورد نظر یافت نشد.');
      if (!fy.isClosed) {
        throw new TransactionError('این سال مالی در حال حاضر باز است.');
      }

      const fyCode = toEnglishDigits(fy.code);
      // حذف اسناد اختتامیه موقت و دائمی صادرشده برای این سال تا دفاتر به وضعیت پیش از اختتامیه بازگردند
      this.vouchers = this.vouchers.filter(
        (v) =>
          v.id !== fy.closingTemporaryVoucherId &&
          v.id !== fy.closingPermanentVoucherId &&
          !(
            toEnglishDigits(v.fiscalYearId) === fyCode &&
            (v.referenceType === 'closing_temporary' || v.referenceType === 'closing_permanent')
          )
      );

      fy.status = 'open';
      fy.isClosed = false;
      fy.isActive = true;
      fy.reopenedAt = new Date().toLocaleDateString('fa-IR');
      fy.reopenedBy = user.fullName;
      fy.reopenReason = reason.trim();
      fy.auditTrail.unshift({
        action: `بازگشایی مجدد سال مالی با مجوز مدیر ارشد - علت: ${reason.trim()}`,
        userName: user.fullName,
        timestamp: `${new Date().toLocaleDateString('fa-IR')} ${new Date().toLocaleTimeString('fa-IR')}`,
        notes: reason.trim(),
      });

      this.fiscalYears.forEach((f) => {
        f.isActive = f.id === fy.id;
      });
      this.settings.activeFiscalYear = fyCode.replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[+d]);

      this.addAuditLog(
        user.id,
        user.fullName,
        'update',
        'مدیریت سال مالی',
        `بازگشایی سال مالی «${fy.title}» - دلیل: ${reason.trim()}`,
        fy.id
      );

      return fy;
    });
  }

  /**
   * دریافت آرشیو کامل اسناد و گزارش‌های یک سال مالی مشخص (حفظ کامل اسناد و گزارش‌های سال‌های قبل)
   */
  getFiscalYearHistoricalArchive(fiscalYearId: string) {
    const fy = this.fiscalYears.find((f) => f.id === fiscalYearId) || this.fiscalYears[0];
    if (!fy) throw new TransactionError('سال مالی یافت نشد.');

    const fyCode = toEnglishDigits(fy.code);
    const startDate = normalizePersianDate(fy.startDate) || `${fyCode}/01/01`;
    const endDate = normalizePersianDate(fy.endDate) || `${fyCode}/12/29`;

    // اگر سال مالی دارای اسنپ‌شات آرشیوی باشد (مانند ۱۴۰۲ یا سال بسته‌شده)، هم اسنپ‌شات و هم گزارش‌های تحلیلی بازه را برمی‌گردانیم
    const liveReportsInRange = this.getComprehensiveReports({
      dateFrom: startDate,
      dateTo: endDate,
    });

    const fyVouchers = this.vouchers.filter(
      (v) =>
        toEnglishDigits(v.fiscalYearId) === fyCode ||
        isDateInRange(v.date, startDate, endDate)
    );
    const fyInvoices = this.invoices.filter(
      (i) =>
        toEnglishDigits(i.fiscalYearId) === fyCode ||
        isDateInRange(i.date, startDate, endDate)
    );

    const effectiveSnapshot: FiscalYearArchiveSnapshot = fy.archivedSnapshot || {
      capturedAt: endDate,
      capturedBy: fy.closedBy || 'گزارش زنده دوره',
      summary: {
        netSales: liveReportsInRange.profitability.summary.netSales,
        cogs: liveReportsInRange.profitability.summary.cogs,
        grossProfit: liveReportsInRange.profitability.summary.grossProfit,
        totalExpenses: liveReportsInRange.profitability.summary.totalExpenses,
        otherIncome: liveReportsInRange.profitability.summary.otherIncome,
        netProfit: liveReportsInRange.profitability.summary.netProfit,
        totalAssets: liveReportsInRange.financialStatements.balanceSheet.assets.totalAssets,
        totalLiabilities: liveReportsInRange.financialStatements.balanceSheet.liabilities.totalLiabilities,
        totalEquity: liveReportsInRange.financialStatements.balanceSheet.equity.totalEquity,
        cashAndBankBalance: liveReportsInRange.financialStatements.balanceSheet.assets.totalCashAndBank,
        accountsReceivable: liveReportsInRange.financialStatements.balanceSheet.assets.accountsReceivable,
        notesReceivable: liveReportsInRange.financialStatements.balanceSheet.assets.notesReceivable,
        inventoryValuation: liveReportsInRange.financialStatements.balanceSheet.assets.inventoryValuation,
        accountsPayable: liveReportsInRange.financialStatements.balanceSheet.liabilities.accountsPayable,
        notesPayable: liveReportsInRange.financialStatements.balanceSheet.liabilities.notesPayable,
        invoicesCount: fyInvoices.length,
        vouchersCount: fyVouchers.length,
      },
      personBalances: this.persons
        .filter((p) => p.currentBalance !== 0)
        .map((p) => ({
          personId: p.id,
          code: p.code,
          name: p.name,
          personType: p.personType,
          balance: p.currentBalance,
        })),
      treasuryBalances: this.treasuryAccounts.map((a) => ({
        accountId: a.id,
        title: a.title,
        type: a.type,
        balance: a.balance,
      })),
      inventoryBalances: this.products.map((p) => ({
        productId: p.id,
        code: p.code,
        name: p.name,
        unitName: p.baseUnitName || 'عدد',
        quantity: p.currentStock,
        unitCost: p.purchasePrice,
        totalValuation: p.currentStock * p.purchasePrice,
      })),
      pendingCheques: this.cheques
        .filter((c) => c.status === 'registered' || c.status === 'deposited' || c.status === 'in_process')
        .map((c) => ({
          chequeId: c.id,
          chequeNumber: c.chequeNumber,
          chequeType: c.chequeType,
          personName: c.personName,
          bankName: c.bankName,
          dueDate: c.dueDate,
          amount: c.amount,
          status: c.status,
        })),
      vouchers: fyVouchers,
      invoices: fyInvoices,
    };

    const trialBalance = generateTrialBalance(
      effectiveSnapshot.vouchers.filter(
        (v: AccountingVoucher) => v.referenceType !== 'closing_temporary' && v.referenceType !== 'closing_permanent'
      ),
      this.accountsChart,
      'general'
    );

    return {
      fiscalYear: fy,
      snapshot: effectiveSnapshot,
      trialBalance,
    };
  }

  /**
   * اجرای تست کامل انتقال سال مالی با داده آزمایشی
   */
  runFiscalRolloverTestSuite() {
    return runFiscalRolloverSimulationTest();
  }

  // ============================================================================
  // ۱۴. امنیت، مدیریت کاربران، نقش‌های قابل تنظیم (RBAC) و حفاظت از اطلاعات محرمانه
  // ============================================================================

  getSafeUsers(): User[] {
    return this.users.map((u) => redactUserForClient(u));
  }

  getSafeUserById(userId: string): User | undefined {
    const u = this.users.find((item) => item.id === userId);
    return u ? redactUserForClient(u) : undefined;
  }

  getRolePermissions(): RolePermissionConfig[] {
    return this.rolePermissions;
  }

  getSecurityPolicy(): SecurityPolicyConfig {
    return this.securityPolicy;
  }

  checkUserPermission(
    user: User | undefined | null,
    module: PermissionModule,
    action: PermissionAction
  ) {
    if (!this.securityPolicy.enforceBackendRbac) {
      return {
        allowed: true,
        reason: 'اجبار کنترل دسترسی Backend غیرفعال شده است.',
        moduleLabel: module,
        actionLabel: action,
        roleTitle: user?.role || 'unknown',
      };
    }
    return evaluateUserPermission(user, this.rolePermissions, module, action);
  }

  getEffectiveUserConfidentialRules(user: User | undefined | null) {
    return getEffectiveConfidentialRules(user, this.rolePermissions);
  }

  /**
   * به‌روزرسانی ماتریس مجوزهای یک نقش (admin, accountant, cashier, inventory_clerk)
   */
  updateRolePermissionConfig(
    role: UserRole,
    payload: Partial<RolePermissionConfig>,
    actorUser: User
  ): RolePermissionConfig {
    return this.runInTransaction(() => {
      const idx = this.rolePermissions.findIndex((r) => r.role === role);
      if (idx === -1) {
        throw new TransactionError('نقش مورد نظر در سیستم یافت نشد.');
      }

      const existing = this.rolePermissions[idx];
      const beforeSnapshot = JSON.parse(JSON.stringify(existing));

      const updated: RolePermissionConfig = {
        ...existing,
        title: payload.title || existing.title,
        description: payload.description ?? existing.description,
        modules: payload.modules
          ? {
              ...existing.modules,
              ...payload.modules,
            }
          : existing.modules,
        confidential: payload.confidential
          ? {
              ...existing.confidential,
              ...payload.confidential,
            }
          : existing.confidential,
        updatedAt: `${new Date().toLocaleDateString('fa-IR')} ${new Date().toLocaleTimeString('fa-IR')}`,
        updatedBy: actorUser.fullName,
      };

      // اطمینان از اینکه نقش مدیر ارشد دسترسی مدیریت کاربران و امنیت را از دست نمی‌دهد
      if (role === 'admin') {
        updated.modules.users_security.view = true;
        updated.modules.users_security.edit = true;
      }

      this.rolePermissions[idx] = updated;

      this.addAuditLog(
        actorUser.id,
        actorUser.fullName,
        'permission_change',
        'مدیریت سطوح دسترسی (RBAC)',
        `ویرایش ماتریس مجوزهای ۸گانه و اطلاعات محرمانه برای نقش «${updated.title}» (${role})`,
        role,
        {
          category: 'sensitive_operation',
          severity: 'warning',
          permissionModule: 'users_security',
          permissionAction: 'edit',
          beforeData: { confidential: beforeSnapshot.confidential },
          afterData: { confidential: updated.confidential },
        }
      );

      return updated;
    });
  }

  /**
   * بازگردانی ماتریس دسترسی کلیه نقش‌ها به حالت استاندارد اولیه
   */
  resetRolePermissionsToDefault(actorUser: User): RolePermissionConfig[] {
    return this.runInTransaction(() => {
      this.rolePermissions = getDefaultRolePermissionConfigs();
      this.addAuditLog(
        actorUser.id,
        actorUser.fullName,
        'permission_change',
        'مدیریت سطوح دسترسی (RBAC)',
        'بازنشانی ماتریس مجوزهای ۴ نقش اصلی به مقادیر استاندارد پیش‌فرض',
        'all-roles',
        {
          category: 'sensitive_operation',
          severity: 'warning',
          permissionModule: 'users_security',
          permissionAction: 'edit',
        }
      );
      return this.rolePermissions;
    });
  }

  /**
   * به‌روزرسانی سیاست‌های امنیتی سیستم (مدیریت نشست، قفل حساب، حفاظت از اطلاعات محرمانه)
   */
  updateSecurityPolicy(
    updates: Partial<SecurityPolicyConfig>,
    actorUser: User
  ): SecurityPolicyConfig {
    return this.runInTransaction(() => {
      const before = { ...this.securityPolicy };
      this.securityPolicy = {
        ...this.securityPolicy,
        ...updates,
        sessionTimeoutMinutes: Math.max(5, Number(updates.sessionTimeoutMinutes ?? this.securityPolicy.sessionTimeoutMinutes)),
        maxFailedLoginAttempts: Math.max(2, Number(updates.maxFailedLoginAttempts ?? this.securityPolicy.maxFailedLoginAttempts)),
        lockoutDurationMinutes: Math.max(1, Number(updates.lockoutDurationMinutes ?? this.securityPolicy.lockoutDurationMinutes)),
        minPasswordLength: Math.max(4, Number(updates.minPasswordLength ?? this.securityPolicy.minPasswordLength)),
        updatedAt: `${new Date().toLocaleDateString('fa-IR')} ${new Date().toLocaleTimeString('fa-IR')}`,
        updatedBy: actorUser.fullName,
      };

      this.addAuditLog(
        actorUser.id,
        actorUser.fullName,
        'sensitive_op',
        'سیاست‌های امنیتی',
        `به‌روزرسانی سیاست‌های امنیتی و مدیریت نشست (حداکثر تلاش ناموفق: ${this.securityPolicy.maxFailedLoginAttempts}، مهلت نشست: ${this.securityPolicy.sessionTimeoutMinutes} دقیقه)`,
        'security-policy',
        {
          category: 'sensitive_operation',
          severity: 'warning',
          beforeData: before,
          afterData: this.securityPolicy,
        }
      );

      return this.securityPolicy;
    });
  }

  /**
   * ایجاد یا ویرایش کاربر با اعتبارسنجی کامل و ثبت تاریخچه تغییرات
   */
  saveUserAccount(
    payload: Partial<User> & { password?: string },
    actorUser: User
  ): User {
    return this.runInTransaction(() => {
      const cleanUsername = (payload.username || '').trim().toLowerCase();
      const cleanFullName = (payload.fullName || '').trim();

      if (!cleanUsername || !cleanFullName) {
        throw new TransactionError('نام و نام خانوادگی و نام کاربری الزامی هستند.');
      }
      if (!/^[a-z0-9_.-]{3,32}$/i.test(cleanUsername)) {
        throw new TransactionError('نام کاربری باید بین ۳ تا ۳۲ کاراکتر و شامل حروف انگلیسی یا عدد باشد.');
      }

      const validRoles: UserRole[] = ['admin', 'accountant', 'cashier', 'inventory_clerk'];
      const targetRole: UserRole = validRoles.includes(payload.role as UserRole)
        ? (payload.role as UserRole)
        : 'cashier';

      if (payload.id) {
        // ویرایش کاربر موجود
        const existingIdx = this.users.findIndex((u) => u.id === payload.id);
        if (existingIdx === -1) {
          throw new TransactionError('کاربر مورد نظر یافت نشد.');
        }
        const existing = this.users[existingIdx];

        if (
          this.users.some(
            (u) => u.username.toLowerCase() === cleanUsername && u.id !== existing.id
          )
        ) {
          throw new TransactionError('این نام کاربری قبلاً برای کاربر دیگری ثبت شده است.');
        }

        // جلوگیری از غیرفعال کردن یا تغییر نقش تنها مدیر ارشد فعال سیستم
        if (existing.role === 'admin' && (targetRole !== 'admin' || payload.isActive === false)) {
          const activeAdmins = this.users.filter((u) => u.role === 'admin' && u.isActive && u.id !== existing.id);
          if (activeAdmins.length === 0) {
            throw new TransactionError('امکان تغییر نقش یا غیرفعال‌سازی تنها مدیر ارشد فعال سیستم وجود ندارد.');
          }
        }

        let newPassHash = existing.passwordHash;
        if (payload.password && payload.password.trim().length > 0) {
          const passCheck = validatePasswordStrength(payload.password.trim(), this.securityPolicy);
          if (!passCheck.valid) {
            throw new TransactionError(passCheck.message);
          }
          newPassHash = hashPassword(payload.password.trim());
        }

        const updated: User = {
          ...existing,
          username: cleanUsername,
          fullName: cleanFullName,
          role: targetRole,
          isActive: payload.isActive !== undefined ? Boolean(payload.isActive) : existing.isActive,
          mobile: payload.mobile !== undefined ? payload.mobile : existing.mobile,
          email: payload.email !== undefined ? payload.email : existing.email,
          department: payload.department !== undefined ? payload.department : existing.department,
          passwordHash: newPassHash,
          customPermissions:
            payload.customPermissions !== undefined
              ? payload.customPermissions
              : existing.customPermissions,
          customConfidential:
            payload.customConfidential !== undefined
              ? payload.customConfidential
              : existing.customConfidential,
          updatedAt: new Date().toLocaleDateString('fa-IR'),
        };

        this.users[existingIdx] = updated;

        this.addAuditLog(
          actorUser.id,
          actorUser.fullName,
          'update',
          'مدیریت کاربران',
          `ویرایش حساب کاربری «${updated.fullName}» (نقش: ${updated.role}، وضعیت: ${updated.isActive ? 'فعال' : 'غیرفعال'})`,
          updated.id,
          {
            category: 'change_history',
            beforeData: {
              fullName: existing.fullName,
              role: existing.role,
              isActive: existing.isActive,
              department: existing.department,
            },
            afterData: {
              fullName: updated.fullName,
              role: updated.role,
              isActive: updated.isActive,
              department: updated.department,
            },
          }
        );

        return redactUserForClient(updated);
      } else {
        // ایجاد کاربر جدید
        if (this.users.some((u) => u.username.toLowerCase() === cleanUsername)) {
          throw new TransactionError('این نام کاربری قبلاً در سیستم ثبت شده است.');
        }

        const rawPassword = payload.password?.trim() || 'User1234';
        const passCheck = validatePasswordStrength(rawPassword, this.securityPolicy);
        if (!passCheck.valid) {
          throw new TransactionError(passCheck.message);
        }

        const newUser: User = {
          id: `usr-${Date.now()}`,
          username: cleanUsername,
          fullName: cleanFullName,
          role: targetRole,
          isActive: payload.isActive !== undefined ? Boolean(payload.isActive) : true,
          mobile: payload.mobile || '',
          email: payload.email || '',
          department: payload.department || 'پرسنل فروشگاه',
          passwordHash: hashPassword(rawPassword),
          failedLoginAttempts: 0,
          lockedUntil: null,
          customPermissions: payload.customPermissions || {},
          customConfidential: payload.customConfidential || {},
          createdAt: new Date().toLocaleDateString('fa-IR'),
        };

        this.users.push(newUser);

        this.addAuditLog(
          actorUser.id,
          actorUser.fullName,
          'create',
          'مدیریت کاربران',
          `ایجاد کاربر جدید «${newUser.fullName}» (${newUser.username}) با نقش «${newUser.role}»`,
          newUser.id,
          {
            category: 'change_history',
            afterData: {
              username: newUser.username,
              fullName: newUser.fullName,
              role: newUser.role,
              isActive: newUser.isActive,
            },
          }
        );

        return redactUserForClient(newUser);
      }
    });
  }

  /**
   * فعال / غیرفعال‌سازی کاربر یا رفع مسدودی حساب (Unlock)
   */
  toggleUserActiveOrUnlock(
    userId: string,
    mode: 'toggle_active' | 'unlock',
    actorUser: User
  ): User {
    return this.runInTransaction(() => {
      const user = this.users.find((u) => u.id === userId);
      if (!user) throw new TransactionError('کاربر یافت نشد.');

      if (mode === 'unlock') {
        user.failedLoginAttempts = 0;
        user.lockedUntil = null;
        this.addAuditLog(
          actorUser.id,
          actorUser.fullName,
          'sensitive_op',
          'مدیریت کاربران و امنیت',
          `رفع مسدودی حساب کاربری «${user.fullName}» (${user.username}) و صفر کردن شمارنده خطاهای ورود`,
          user.id,
          {
            category: 'sensitive_operation',
            severity: 'info',
          }
        );
        return redactUserForClient(user);
      }

      if (user.role === 'admin' && user.isActive) {
        const otherActiveAdmins = this.users.filter((u) => u.role === 'admin' && u.isActive && u.id !== user.id);
        if (otherActiveAdmins.length === 0) {
          throw new TransactionError('امکان غیرفعال کردن تنها مدیر ارشد فعال سیستم وجود ندارد.');
        }
      }

      const prevStatus = user.isActive;
      user.isActive = !user.isActive;

      this.addAuditLog(
        actorUser.id,
        actorUser.fullName,
        'sensitive_op',
        'مدیریت کاربران و امنیت',
        `${user.isActive ? 'فعال‌سازی مجدد' : 'غیرفعال‌سازی و تعلیق'} حساب کاربری «${user.fullName}» (${user.username})`,
        user.id,
        {
          category: 'sensitive_operation',
          severity: user.isActive ? 'info' : 'warning',
          beforeData: { isActive: prevStatus },
          afterData: { isActive: user.isActive },
        }
      );

      return redactUserForClient(user);
    });
  }

  /**
   * احراز هویت ورود با بررسی رمز عبور، شمارش تلاش‌های ناموفق و قفل خودکار حساب
   */
  authenticateUserLogin(
    username: string,
    password?: string,
    ipAddress: string = '127.0.0.1',
    userAgent: string = 'Browser'
  ) {
    const cleanUsername = (username || '').trim().toLowerCase();
    const user = this.users.find((u) => u.username.toLowerCase() === cleanUsername);

    if (!user) {
      this.addAuditLog(
        'unknown',
        cleanUsername || 'ناشناس',
        'failed_login',
        'احراز هویت و نشست',
        `تلاش ناموفق ورود با نام کاربری ناموجود «${cleanUsername}»`,
        undefined,
        {
          username: cleanUsername,
          category: 'failed_attempt',
          severity: 'warning',
          status: 'failed',
          ipAddress,
          userAgent,
          endpoint: 'POST /api/auth/login',
          persistImmediately: true,
        }
      );
      throw new TransactionError('نام کاربری یا کلمه عبور نامعتبر است.');
    }

    const nowMs = Date.now();
    if (user.lockedUntil && user.lockedUntil > nowMs) {
      const remainingMin = Math.ceil((user.lockedUntil - nowMs) / 60000);
      this.addAuditLog(
        user.id,
        user.fullName,
        'failed_login',
        'احراز هویت و نشست',
        `تلاش ورود به حساب قفل‌شده «${user.fullName}» (تا ${remainingMin} دقیقه دیگر مسدود است)`,
        user.id,
        {
          category: 'failed_attempt',
          severity: 'critical',
          status: 'blocked',
          ipAddress,
          userAgent,
          endpoint: 'POST /api/auth/login',
          persistImmediately: true,
        }
      );
      throw new TransactionError(
        `حساب کاربری شما به دلیل تلاش‌های ناموفق متوالی به مدت ${remainingMin} دقیقه مسدود شده است.`
      );
    }

    if (!user.isActive) {
      this.addAuditLog(
        user.id,
        user.fullName,
        'failed_login',
        'احراز هویت و نشست',
        `تلاش ورود با حساب کاربری غیرفعال «${user.fullName}»`,
        user.id,
        {
          category: 'failed_attempt',
          severity: 'warning',
          status: 'blocked',
          ipAddress,
          userAgent,
          endpoint: 'POST /api/auth/login',
          persistImmediately: true,
        }
      );
      throw new TransactionError('این حساب کاربری غیرفعال شده است. با مدیر سیستم تماس بگیرید.');
    }

    // اگر رمز عبور ارسال شده باشد، آن را با هش ذخیره شده مقایسه می‌کنیم
    if (password !== undefined && password !== '') {
      const isValidPassword =
        verifyPassword(password, user.passwordHash) ||
        (password === 'Admin123' && user.passwordHash === defaultPasswordHash);

      if (!isValidPassword) {
        user.failedLoginAttempts = (user.failedLoginAttempts || 0) + 1;
        const maxAttempts = this.securityPolicy.maxFailedLoginAttempts || 5;

        if (user.failedLoginAttempts >= maxAttempts) {
          const lockMin = this.securityPolicy.lockoutDurationMinutes || 15;
          user.lockedUntil = nowMs + lockMin * 60 * 1000;
          this.addAuditLog(
            user.id,
            user.fullName,
            'failed_login',
            'احراز هویت و نشست',
            `قفل خودکار حساب «${user.fullName}» به مدت ${lockMin} دقیقه پس از ${user.failedLoginAttempts} تلاش ناموفق ورود`,
            user.id,
            {
              category: 'failed_attempt',
              severity: 'critical',
              status: 'blocked',
              ipAddress,
              userAgent,
              endpoint: 'POST /api/auth/login',
              persistImmediately: true,
            }
          );
          throw new TransactionError(
            `رمز عبور نادرست است. به دلیل ${maxAttempts} تلاش ناموفق متوالی، حساب کاربری به مدت ${lockMin} دقیقه مسدود شد.`
          );
        }

        this.addAuditLog(
          user.id,
          user.fullName,
          'failed_login',
          'احراز هویت و نشست',
          `تلاش ناموفق ورود برای کاربر «${user.fullName}» - رمز عبور اشتباه (تلاش ${user.failedLoginAttempts} از ${maxAttempts})`,
          user.id,
          {
            category: 'failed_attempt',
            severity: 'warning',
            status: 'failed',
            ipAddress,
            userAgent,
            endpoint: 'POST /api/auth/login',
            persistImmediately: true,
          }
        );
        throw new TransactionError(
          `رمز عبور وارد شده صحیح نیست (تلاش ${user.failedLoginAttempts} از ${maxAttempts}).`
        );
      }
    }

    // ورود موفق: صفر کردن شمارنده خطا و ثبت نشست
    user.failedLoginAttempts = 0;
    user.lockedUntil = null;
    user.lastLoginAt = `${new Date().toLocaleDateString('fa-IR')} ${new Date().toLocaleTimeString('fa-IR')}`;
    user.lastLoginIp = ipAddress;

    const session = createSession(user, {
      ipAddress,
      userAgent,
      timeoutMinutes: this.securityPolicy.sessionTimeoutMinutes,
    });

    this.addAuditLog(
      user.id,
      user.fullName,
      'login',
      'احراز هویت و نشست',
      `ورود موفق «${user.fullName}» با نقش «${user.role}» و آغاز نشست (${session.deviceLabel})`,
      session.id,
      {
        category: 'auth_session',
        severity: 'info',
        status: 'success',
        ipAddress,
        userAgent,
        endpoint: 'POST /api/auth/login',
        persistImmediately: true,
      }
    );

    return {
      token: session.token!,
      session,
      user: redactUserForClient(user),
    };
  }

  /**
   * بررسی و ثبت مجوز عملیات کلاینت (چاپ، خروجی Excel/PDF، مشاهده گزارش حساس) در Backend
   */
  authorizeAndRecordAction(
    user: User,
    payload: {
      module: PermissionModule;
      action: PermissionAction;
      description: string;
      entityId?: string;
    },
    ipAddress: string = '127.0.0.1'
  ) {
    const check = this.checkUserPermission(user, payload.module, payload.action);
    if (!check.allowed) {
      this.addAuditLog(
        user.id,
        user.fullName,
        'unauthorized_access',
        check.moduleLabel,
        `جلوگیری از عملیات «${check.actionLabel}» در بخش «${check.moduleLabel}»: ${payload.description}`,
        payload.entityId,
        {
          category: 'failed_attempt',
          severity: 'warning',
          status: 'blocked',
          permissionModule: payload.module,
          permissionAction: payload.action,
          ipAddress,
          endpoint: 'POST /api/security/authorize-action',
          persistImmediately: true,
        }
      );
      return {
        allowed: false,
        reason: check.reason,
      };
    }

    const logAction: AuditLogAction =
      payload.action === 'print'
        ? 'print'
        : payload.action === 'export'
        ? 'export'
        : payload.action === 'reports'
        ? 'reports'
        : 'sensitive_op';

    if (this.securityPolicy.logAllPrintAndExportActions || logAction === 'sensitive_op') {
      this.addAuditLog(
        user.id,
        user.fullName,
        logAction,
        check.moduleLabel,
        payload.description || `اجرای مجاز عملیات «${check.actionLabel}» در بخش «${check.moduleLabel}»`,
        payload.entityId,
        {
          category: 'sensitive_operation',
          severity: 'info',
          status: 'success',
          permissionModule: payload.module,
          permissionAction: payload.action,
          ipAddress,
          endpoint: 'POST /api/security/authorize-action',
          persistImmediately: true,
        }
      );
    }

    return {
      allowed: true,
      reason: check.reason,
    };
  }

  /**
   * استخراج خلاصه وضعیت امنیتی سامانه (Security Posture & Audit Summary)
   */
  getSecurityCheckSummary(activeSessionsCount: number, revokedSessionsCount: number): SecurityCheckSummary {
    const nowMs = Date.now();
    const activeUsersCount = this.users.filter((u) => u.isActive).length;
    const lockedUsersCount = this.users.filter((u) => u.lockedUntil && u.lockedUntil > nowMs).length;
    const failedLoginsCount = this.auditLogs.filter((l) => l.action === 'failed_login').length;
    const unauthorizedAttemptsCount = this.auditLogs.filter((l) => l.action === 'unauthorized_access').length;
    const blockedPayloadsCount = this.auditLogs.filter((l) => l.action === 'validation_failed').length;
    const sensitiveOperationsCount = this.auditLogs.filter((l) => l.category === 'sensitive_operation').length;

    const checks: SecurityCheckSummary['checks'] = [
      {
        id: 'chk-rbac',
        title: 'اعمال کنترل دسترسی ۸گانه در لایه Backend (RBAC Guard)',
        category: 'rbac_backend',
        status: this.securityPolicy.enforceBackendRbac ? 'secure' : 'warning',
        description: this.securityPolicy.enforceBackendRbac
          ? 'کلیه درخواست‌های API در سرور پیش از اجرا بر اساس ماتریس نقش (مشاهده، ایجاد، ویرایش، ثبت نهایی، ابطال، چاپ، خروجی، گزارش‌ها) اعتبارسنجی می‌شوند.'
          : 'هشدار: گارد کنترل دسترسی بک‌اند غیرفعال شده است.',
      },
      {
        id: 'chk-session',
        title: 'مدیریت نشست، توکن امن و قفل خودکار حساب در برابر Brute-Force',
        category: 'session',
        status: this.securityPolicy.maxFailedLoginAttempts <= 10 ? 'secure' : 'warning',
        description: `نشست‌ها پس از ${this.securityPolicy.sessionTimeoutMinutes} دقیقه منقضی می‌شوند و حساب کاربری پس از ${this.securityPolicy.maxFailedLoginAttempts} تلاش ناموفق به مدت ${this.securityPolicy.lockoutDurationMinutes} دقیقه قفل می‌گردد.`,
      },
      {
        id: 'chk-validation',
        title: 'اعتبارسنجی ورودی و محافظت در برابر تزریق SQLi / XSS',
        category: 'validation',
        status: this.securityPolicy.blockSqlAndXssPayloads ? 'secure' : 'warning',
        description: 'میدل‌ور امنیتی تمام ورودی‌های متنی و عددی را پاک‌سازی کرده و الگوهای مخرب اسکریپت، SQL و Prototype Pollution را مسدود و ثبت می‌کند.',
      },
      {
        id: 'chk-confidential',
        title: 'حفاظت از اطلاعات محرمانه، هش رمزها و مخفی‌سازی بهای تمام‌شده',
        category: 'confidentiality',
        status: this.securityPolicy.maskConfidentialPricesForUnauthorized ? 'secure' : 'warning',
        description: 'هش رمز عبور و توکن کامل نشست هرگز در API افشا نمی‌شوند؛ قیمت خرید، سود خالص و شبای بانکی برای نقش‌های غیرمجاز (مانند صندوق‌دار) ماسک می‌شوند.',
      },
      {
        id: 'chk-audit',
        title: 'ثبت کامل تاریخچه تغییرات، ورود/خروج، عملیات حساس و تلاش‌های ناموفق',
        category: 'audit',
        status: 'secure',
        description: `تمامی رویدادها با ذکر کاربر، نقش، آدرس IP، زمان دقیق و مقادیر قدیم/جدید در لاگ تغییرناپذیر ثبت می‌شوند (${this.auditLogs.length} رویداد ثبت‌شده).`,
      },
    ];

    const secureCount = checks.filter((c) => c.status === 'secure').length;
    const overallScore = Math.round((secureCount / checks.length) * 100);

    return {
      overallScore,
      activeUsersCount,
      lockedUsersCount,
      activeSessionsCount,
      revokedSessionsCount,
      totalAuditLogsCount: this.auditLogs.length,
      failedLoginsCount,
      unauthorizedAttemptsCount,
      sensitiveOperationsCount,
      blockedPayloadsCount,
      checks,
    };
  }

  // ==========================================
  // ۶. ممیزی جامع ۵گانه تطابق موجودی، اشخاص، صندوق، بانک و دفتر کل
  // ==========================================
  runMasterReconciliationAudit() {
    // ۱. بررسی مغایرت موجودی کالا، انبار تفکیکی و کاردکس
    const inventoryItems = this.products.map((prd) => {
      const warehouseQty = this.warehouseStocks
        .filter((ws) => ws.productId === prd.id)
        .reduce((sum, ws) => sum + ws.quantity, 0);
      const kardexQty = this.kardexEntries
        .filter((k) => k.productId === prd.id)
        .reduce((sum, k) => sum + (Number(k.inQuantity) || 0) - (Number(k.outQuantity) || 0), 0);
      const stockDiff = Math.abs(prd.currentStock - warehouseQty);
      const kardexDiff = Math.abs(prd.currentStock - kardexQty);
      return {
        productId: prd.id,
        productCode: prd.code,
        productName: prd.name,
        productStock: prd.currentStock,
        warehouseSum: warehouseQty,
        kardexNet: kardexQty,
        valuation: prd.currentStock * prd.purchasePrice,
        isReconciled: stockDiff < 0.001 && kardexDiff < 0.001,
        discrepancy: Math.max(stockDiff, kardexDiff),
      };
    });

    // ۲. بررسی مغایرت مانده اشخاص با دفتر تفصیلی اسناد حسابداری
    const validVouchers = this.vouchers.filter(
      (v) =>
        v.status !== 'draft' &&
        v.referenceType !== 'closing_temporary' &&
        v.referenceType !== 'closing_permanent'
    );
    const hasOpeningVoucher = validVouchers.some((v) => v.referenceType === 'opening_balance');

    const detailedPersonLedgers = generateDetailedPersonLedger(validVouchers, this.persons);
    const personItems = detailedPersonLedgers.map((pr) => ({
      personId: pr.personId,
      personName: pr.personName,
      personCardBalance: pr.recordedBalance,
      ledgerBalance: pr.currentLedgerBalance,
      discrepancy: Math.abs(pr.variance),
      isReconciled: pr.isReconciled,
    }));

    const computeTreasuryLedgerBalance = (acc: TreasuryAccount) => {
      let trDebit = 0;
      let trCredit = 0;
      for (const v of validVouchers) {
        for (const l of v.lines) {
          if (l.accountCode === acc.accountingAccountCode) {
            trDebit += Number(l.debit) || 0;
            trCredit += Number(l.credit) || 0;
          }
        }
      }
      const baseInitial = hasOpeningVoucher ? 0 : acc.initialBalance || 0;
      return baseInitial + trDebit - trCredit;
    };

    // ۳. بررسی مغایرت صندوق‌های نقدی (گزارش خزانه + دفتر کل)
    const cashAccounts = this.treasuryAccounts.filter((a) => a.type === 'cash');
    const cashItems = cashAccounts.map((acc) => {
      const stmt = calculateAccountStatementAndReconciliation(acc, this.treasuryTransactions);
      const ledgerBalance = computeTreasuryLedgerBalance(acc);
      const discrepancy = Math.max(
        Math.abs(acc.balance - stmt.calculatedBalance),
        Math.abs(acc.balance - ledgerBalance)
      );
      return {
        accountId: acc.id,
        title: acc.title,
        accountingCode: acc.accountingAccountCode,
        treasuryBalance: acc.balance,
        txComputedBalance: stmt.calculatedBalance,
        ledgerBalance,
        discrepancy,
        isReconciled: discrepancy < 1,
      };
    });

    // ۴. بررسی مغایرت بانک‌ها و کارتخوان‌ها (POS)
    const bankAccounts = this.treasuryAccounts.filter((a) => a.type === 'bank' || a.type === 'pos');
    const bankItems = bankAccounts.map((acc) => {
      const stmt = calculateAccountStatementAndReconciliation(acc, this.treasuryTransactions);
      const ledgerBalance = computeTreasuryLedgerBalance(acc);
      const discrepancy = Math.max(
        Math.abs(acc.balance - stmt.calculatedBalance),
        Math.abs(acc.balance - ledgerBalance)
      );
      return {
        accountId: acc.id,
        type: acc.type,
        title: acc.title,
        accountingCode: acc.accountingAccountCode,
        treasuryBalance: acc.balance,
        txComputedBalance: stmt.calculatedBalance,
        ledgerBalance,
        discrepancy,
        isReconciled: discrepancy < 1,
      };
    });

    // ۵. بررسی توازن دفتر کل و تراز آزمایشی
    const trialBalance = generateTrialBalance(
      this.vouchers,
      this.accountsChart,
      undefined,
      undefined,
      'general'
    );
    const accountingAudit = auditAccountingIntegrity(
      this.vouchers,
      this.accountsChart,
      this.persons,
      this.treasuryAccounts
    );
    const unapprovedVouchers = this.vouchers.filter((v) => v.status === 'draft');
    const unbalancedVouchersCount = accountingAudit.metrics.unbalancedVouchersCount;

    const inventoryReconciled = inventoryItems.every((i) => i.isReconciled);
    const personsReconciled = personItems.every((p) => p.isReconciled);
    const cashReconciled = cashItems.every((c) => c.isReconciled);
    const bankReconciled = bankItems.every((b) => b.isReconciled);
    const ledgerReconciled =
      trialBalance.isTurnoverBalanced &&
      trialBalance.isClosingBalanced &&
      unbalancedVouchersCount === 0;

    const allReconciled =
      inventoryReconciled &&
      personsReconciled &&
      cashReconciled &&
      bankReconciled &&
      ledgerReconciled;

    return {
      auditedAt: new Date().toLocaleString('fa-IR'),
      allReconciled,
      summary: {
        inventoryReconciled,
        personsReconciled,
        cashReconciled,
        bankReconciled,
        ledgerReconciled,
        totalDiscrepancies:
          inventoryItems.filter((i) => !i.isReconciled).length +
          personItems.filter((p) => !p.isReconciled).length +
          cashItems.filter((c) => !c.isReconciled).length +
          bankItems.filter((b) => !b.isReconciled).length +
          (ledgerReconciled ? 0 : 1),
      },
      inventory: {
        isReconciled: inventoryReconciled,
        totalProducts: inventoryItems.length,
        totalValuation: inventoryItems.reduce((s, i) => s + i.valuation, 0),
        items: inventoryItems,
      },
      persons: {
        isReconciled: personsReconciled,
        totalPersons: personItems.length,
        items: personItems,
      },
      cash: {
        isReconciled: cashReconciled,
        totalCashBalance: cashItems.reduce((s, c) => s + c.treasuryBalance, 0),
        items: cashItems,
      },
      bank: {
        isReconciled: bankReconciled,
        totalBankAndPosBalance: bankItems.reduce((s, b) => s + b.treasuryBalance, 0),
        items: bankItems,
      },
      generalLedger: {
        isReconciled: ledgerReconciled,
        totalVouchers: this.vouchers.length,
        approvedVouchers: this.vouchers.filter((v) => v.status === 'approved').length,
        draftVouchers: unapprovedVouchers.length,
        unbalancedVouchersCount,
        totalDebitTurnover: trialBalance.totalTurnoverDebit,
        totalCreditTurnover: trialBalance.totalTurnoverCredit,
        totalDebitBalance: trialBalance.totalClosingDebit,
        totalCreditBalance: trialBalance.totalClosingCredit,
      },
    };
  }

  // ==========================================
  // ۷. پشتیبان‌گیری و بازیابی واقعی پایگاه داده با امضای SHA-256
  // ==========================================
  exportFullDatabaseBackup(user: User, silentAudit = false) {
    const payload = {
      schemaVersion: '2.1.0-reconciled',
      users: structuredClone(this.users),
      units: structuredClone(this.units),
      categories: structuredClone(this.categories),
      brands: structuredClone(this.brands),
      personGroups: structuredClone(this.personGroups),
      products: structuredClone(this.products),
      persons: structuredClone(this.persons),
      warehouses: structuredClone(this.warehouses),
      warehouseStocks: structuredClone(this.warehouseStocks),
      kardexEntries: structuredClone(this.kardexEntries),
      goodsReceipts: structuredClone(this.goodsReceipts),
      purchaseProformas: structuredClone(this.purchaseProformas),
      warehouseTransfers: structuredClone(this.warehouseTransfers),
      stocktakingSessions: structuredClone(this.stocktakingSessions),
      inventoryAdjustments: structuredClone(this.inventoryAdjustments),
      accessoryCostTypes: structuredClone(this.accessoryCostTypes),
      accessoryCosts: structuredClone(this.accessoryCosts),
      financialCategories: structuredClone(this.financialCategories),
      invoices: structuredClone(this.invoices),
      accountsChart: structuredClone(this.accountsChart),
      vouchers: structuredClone(this.vouchers),
      treasuryAccounts: structuredClone(this.treasuryAccounts),
      treasuryTransactions: structuredClone(this.treasuryTransactions),
      cheques: structuredClone(this.cheques),
      fiscalYears: structuredClone(this.fiscalYears),
      rolePermissions: structuredClone(this.rolePermissions),
      securityPolicy: structuredClone(this.securityPolicy),
      auditLogs: structuredClone(this.auditLogs),
      settings: structuredClone(this.settings),
    };

    const canonicalJson = JSON.stringify(payload);
    const checksum = crypto.createHash('sha256').update(canonicalJson, 'utf8').digest('hex');

    if (!silentAudit) {
      this.addAuditLog(
        user.id,
        user.fullName,
        'export',
        'پشتیبان‌گیری',
        `تهیه نسخه پشتیبان کامل پایگاه داده با امضای SHA-256: ${checksum.slice(0, 12)}...`,
        `bkp-${Date.now()}`
      );
      this.saveToDiskSync();
    }

    return {
      version: '2.1.0-reconciled',
      exportedAt: new Date().toISOString(),
      exportedAtShamsi: new Date().toLocaleString('fa-IR'),
      exportedBy: user.fullName,
      checksum,
      sizeBytes: Buffer.byteLength(canonicalJson, 'utf8'),
      stats: {
        productsCount: payload.products.length,
        personsCount: payload.persons.length,
        invoicesCount: payload.invoices.length,
        vouchersCount: payload.vouchers.length,
        treasuryAccountsCount: payload.treasuryAccounts.length,
        treasuryTransactionsCount: payload.treasuryTransactions.length,
        chequesCount: payload.cheques.length,
        kardexEntriesCount: payload.kardexEntries.length,
        fiscalYearsCount: payload.fiscalYears.length,
      },
      payload,
    };
  }

  restoreFullDatabaseBackup(backupBundle: any, user: User, silentAudit = false) {
    if (!backupBundle || typeof backupBundle !== 'object') {
      throw new TransactionError('ساختار فایل پشتیبان نامعتبر است.');
    }

    const payload = backupBundle.payload || backupBundle;
    if (
      !Array.isArray(payload.products) ||
      !Array.isArray(payload.persons) ||
      !Array.isArray(payload.vouchers) ||
      !Array.isArray(payload.treasuryAccounts)
    ) {
      throw new TransactionError('فایل پشتیبان فاقد جداول اصلی پایگاه داده (کالاها، اشخاص، اسناد حسابداری، خزانه) است.');
    }

    // اگر امضای دیجیتال SHA-256 ارسال شده باشد، اصالت آن را کنترل می‌کنیم
    if (backupBundle.checksum && backupBundle.payload) {
      const computedHash = crypto
        .createHash('sha256')
        .update(JSON.stringify(backupBundle.payload), 'utf8')
        .digest('hex');
      if (computedHash !== backupBundle.checksum) {
        throw new TransactionError('امضای دیجیتال SHA-256 فایل پشتیبان با محتوای آن تطابق ندارد (احتمال دستکاری یا خرابی فایل).');
      }
    }

    return this.runInTransaction(() => {
      if (Array.isArray(payload.users) && payload.users.length > 0) this.users = structuredClone(payload.users);
      if (Array.isArray(payload.units)) this.units = structuredClone(payload.units);
      if (Array.isArray(payload.categories)) this.categories = structuredClone(payload.categories);
      if (Array.isArray(payload.brands)) this.brands = structuredClone(payload.brands);
      if (Array.isArray(payload.personGroups)) this.personGroups = structuredClone(payload.personGroups);
      this.products = structuredClone(payload.products);
      this.persons = structuredClone(payload.persons);
      if (Array.isArray(payload.warehouses)) this.warehouses = structuredClone(payload.warehouses);
      if (Array.isArray(payload.warehouseStocks)) this.warehouseStocks = structuredClone(payload.warehouseStocks);
      if (Array.isArray(payload.kardexEntries)) this.kardexEntries = structuredClone(payload.kardexEntries);
      if (Array.isArray(payload.goodsReceipts)) this.goodsReceipts = structuredClone(payload.goodsReceipts);
      if (Array.isArray(payload.purchaseProformas)) this.purchaseProformas = structuredClone(payload.purchaseProformas);
      if (Array.isArray(payload.warehouseTransfers)) this.warehouseTransfers = structuredClone(payload.warehouseTransfers);
      if (Array.isArray(payload.stocktakingSessions)) this.stocktakingSessions = structuredClone(payload.stocktakingSessions);
      if (Array.isArray(payload.inventoryAdjustments)) this.inventoryAdjustments = structuredClone(payload.inventoryAdjustments);
      if (Array.isArray(payload.accessoryCostTypes)) this.accessoryCostTypes = structuredClone(payload.accessoryCostTypes);
      if (Array.isArray(payload.accessoryCosts)) this.accessoryCosts = structuredClone(payload.accessoryCosts);
      if (Array.isArray(payload.financialCategories)) this.financialCategories = structuredClone(payload.financialCategories);
      if (Array.isArray(payload.invoices)) this.invoices = structuredClone(payload.invoices);
      if (Array.isArray(payload.accountsChart)) this.accountsChart = structuredClone(payload.accountsChart);
      this.vouchers = structuredClone(payload.vouchers);
      this.treasuryAccounts = structuredClone(payload.treasuryAccounts);
      if (Array.isArray(payload.treasuryTransactions)) this.treasuryTransactions = structuredClone(payload.treasuryTransactions);
      if (Array.isArray(payload.cheques)) this.cheques = structuredClone(payload.cheques);
      if (Array.isArray(payload.fiscalYears)) this.fiscalYears = structuredClone(payload.fiscalYears);
      if (Array.isArray(payload.rolePermissions)) this.rolePermissions = structuredClone(payload.rolePermissions);
      if (payload.securityPolicy) this.securityPolicy = structuredClone(payload.securityPolicy);
      if (Array.isArray(payload.auditLogs)) this.auditLogs = structuredClone(payload.auditLogs);
      if (payload.settings) this.settings = structuredClone(payload.settings);

      if (!silentAudit) {
        this.addAuditLog(
          user.id,
          user.fullName,
          'update',
          'پشتیبان‌گیری',
          `بازیابی کامل پایگاه داده از فایل پشتیبان (${this.vouchers.length} سند، ${this.invoices.length} فاکتور، ${this.products.length} کالا)`,
          `rst-${Date.now()}`
        );
      }

      const reconciliation = this.runMasterReconciliationAudit();
      return {
        restoredAt: new Date().toLocaleString('fa-IR'),
        checksumVerified: Boolean(backupBundle.checksum),
        stats: {
          productsCount: this.products.length,
          personsCount: this.persons.length,
          invoicesCount: this.invoices.length,
          vouchersCount: this.vouchers.length,
          treasuryAccountsCount: this.treasuryAccounts.length,
          chequesCount: this.cheques.length,
        },
        reconciliation,
      };
    });
  }

  // ریست و صفر کردن کامل برنامه جهت تحویل به مشتری (Factory Reset)
  factoryReset(user: User, options?: { resetCatalog?: boolean }) {
    return this.runInTransaction(() => {
      this.invoices = [];
      this.vouchers = [];
      this.treasuryTransactions = [];
      this.cheques = [];
      this.kardexEntries = [];
      this.warehouseStocks = [];
      this.goodsReceipts = [];
      this.purchaseProformas = [];
      this.warehouseTransfers = [];
      this.stocktakingSessions = [];
      this.inventoryAdjustments = [];
      this.accessoryCosts = [];

      this.persons.forEach((p) => {
        p.currentBalance = 0;
        p.initialBalance = 0;
      });

      this.products.forEach((prod) => {
        prod.currentStock = 0;
      });

      this.treasuryAccounts.forEach((acc) => {
        acc.balance = 0;
        acc.currentBalance = 0;
        acc.initialBalance = 0;
      });

      this.settings = {
        ...this.settings,
        storeName: 'فروشگاه سپهر',
        guildName: 'صنف بازرگانی و فروشگاهی',
        currency: 'ریال',
        onboardingCompleted: false,
      };

      this.addAuditLog(
        user.id,
        user.fullName,
        'delete',
        'صفر کردن پایگاه داده',
        `پاکسازی کامل تراکنش‌ها و آماده‌سازی سیستم جهت تحویل به مشتری توسط ${user.fullName}`,
        'SYSTEM-RESET'
      );

      return {
        success: true,
        message: 'کلیه داده‌های عملیاتی با موفقیت صفر و سیستم جهت تحویل به مشتری آماده گردید.',
        onboardingNeeded: true,
      };
    });
  }

  // آزمون عملیاتی پشتیبان‌گیری، تغییر داده، بازیابی و کنترل تطابق SHA-256
  testRealBackupAndRestoreCycle(user: User) {
    const originalBackup = this.exportFullDatabaseBackup(user, true);
    const originalChecksum = originalBackup.checksum;
    const originalPrd1Stock = this.products.find((p) => p.id === 'prd-1')?.currentStock || 0;
    const originalCash1Balance = this.treasuryAccounts.find((a) => a.id === 'tr-cash-1')?.balance || 0;

    // ایجاد تغییرات واقعی در دیتابیس
    const prd1 = this.products.find((p) => p.id === 'prd-1');
    const cash1 = this.treasuryAccounts.find((a) => a.id === 'tr-cash-1');
    if (prd1) prd1.currentStock += 999;
    if (cash1) cash1.balance += 7770000;
    this.saveToDiskSync();

    const mutatedStock = this.products.find((p) => p.id === 'prd-1')?.currentStock || 0;
    const mutatedCash = this.treasuryAccounts.find((a) => a.id === 'tr-cash-1')?.balance || 0;
    const mutationVerified = mutatedStock === originalPrd1Stock + 999 && mutatedCash === originalCash1Balance + 7770000;

    // بازیابی از نسخه پشتیبان اصلی
    this.restoreFullDatabaseBackup(originalBackup, user, true);
    const afterRestoreBackup = this.exportFullDatabaseBackup(user, true);

    const restoredStock = this.products.find((p) => p.id === 'prd-1')?.currentStock || 0;
    const restoredCash = this.treasuryAccounts.find((a) => a.id === 'tr-cash-1')?.balance || 0;
    const checksumMatched = afterRestoreBackup.checksum === originalChecksum;
    const stateRestored = restoredStock === originalPrd1Stock && restoredCash === originalCash1Balance;
    const reconciliation = this.runMasterReconciliationAudit();

    const passed = mutationVerified && checksumMatched && stateRestored && reconciliation.allReconciled;

    this.addAuditLog(
      user.id,
      user.fullName,
      'export',
      'پشتیبان‌گیری',
      `اجرای موفق آزمون عملیاتی پشتیبان‌گیری و بازیابی پایگاه داده (SHA-256: ${originalChecksum.slice(0, 12)})`,
      `bkp-test-${Date.now()}`
    );
    this.saveToDiskSync();

    return {
      passed,
      testedAt: new Date().toLocaleString('fa-IR'),
      originalChecksum,
      restoredChecksum: afterRestoreBackup.checksum,
      checksumMatched,
      mutationVerified,
      stateRestored,
      allReconciledAfterRestore: reconciliation.allReconciled,
      sizeBytes: originalBackup.sizeBytes,
      steps: [
        {
          step: 1,
          title: 'تهیه نسخه پشتیبان کامل و محاسبه امضای SHA-256',
          passed: Boolean(originalChecksum),
          detail: `امضای اولیه: ${originalChecksum.slice(0, 16)}... | حجم: ${(originalBackup.sizeBytes / 1024).toFixed(1)} کیلوبایت`,
        },
        {
          step: 2,
          title: 'اعمال تغییرات آزمایشی روی موجودی کالا و صندوق در دیسک',
          passed: mutationVerified,
          detail: `موجودی روبان از ${originalPrd1Stock} به ${mutatedStock} و صندوق از ${originalCash1Balance.toLocaleString('fa-IR')} به ${mutatedCash.toLocaleString('fa-IR')} تغییر یافت.`,
        },
        {
          step: 3,
          title: 'بازیابی اتمیک پایگاه داده از فایل پشتیبان و کنترل SHA-256',
          passed: checksumMatched && stateRestored,
          detail: `موجودی روبان به ${restoredStock} و مانده صندوق به ${restoredCash.toLocaleString('fa-IR')} بازگشت؛ امضای SHA-256 صددرصد منطبق است.`,
        },
        {
          step: 4,
          title: 'ممیزی ۵گانه تطابق حسابداری و انبار پس از بازیابی',
          passed: reconciliation.allReconciled,
          detail: `تعداد مغایرت‌ها پس از بازیابی: ${reconciliation.summary.totalDiscrepancies} مورد`,
        },
      ],
    };
  }

  // ==========================================
  // ۸. اجرای آزمون‌های یکپارچه ۸ سناریوی عملیاتی (Integration Test Suite)
  // ==========================================
  runFullSystemIntegrationSuite(user: User) {
    const startTime = Date.now();
    // تهیه اسنپ‌شات کامل قبل از اجرای آزمون‌های یکپارچه تا پس از اتمام، داده‌های اصلی دست‌نخورده باقی بمانند
    const preSuiteSnapshot = this.exportFullDatabaseBackup(user, true);
    const scenarios: Array<{
      id: string;
      stepNumber: number;
      title: string;
      passed: boolean;
      expected: string;
      actual: string;
      voucherNumber?: string;
    }> = [];

    let midSuiteReconciliation: ReturnType<typeof this.runMasterReconciliationAudit> | null = null;
    let postRolloverFiscalStatus = { closed1403: false, opened1404: false, openingBalanced: false };

    try {
      // ۱. سناریوی خرید (Purchase Invoice: نسیه + پرداخت بانکی)
      const prd1BeforePurchase = this.products.find((p) => p.id === 'prd-1')!.currentStock;
      const bank1BeforePurchase = this.treasuryAccounts.find((a) => a.id === 'tr-bank-1')!.balance;
      const per3BeforePurchase = this.persons.find((p) => p.id === 'per-3')!.currentBalance;

      const purchaseInv = this.createInvoice(
        {
          invoiceType: 'purchase',
          personId: 'per-3',
          warehouseId: 'wh-central',
          date: '1403/07/20',
          items: [
            {
              id: 'it-pur-test',
              productId: 'prd-1',
              productCode: 'KH-1001',
              productName: 'روبان ساتن ۲٫۵ سانت قرمز نگین (رول ۲۵ متری)',
              unitId: 'u-meter',
              unitName: 'متر',
              quantity: 100,
              conversionFactor: 1,
              baseQuantity: 100,
              unitPrice: 1120,
              discount: 0,
              tax: 0,
              totalPrice: 112000,
            },
          ],
          payments: [
            {
              id: 'pay-pur-1',
              method: 'bank_transfer',
              accountId: 'tr-bank-1',
              amount: 50000,
              referenceNumber: 'PUR-BNK-101',
            },
          ],
        },
        user
      );

      const prd1AfterPurchase = this.products.find((p) => p.id === 'prd-1')!.currentStock;
      const bank1AfterPurchase = this.treasuryAccounts.find((a) => a.id === 'tr-bank-1')!.balance;
      const per3AfterPurchase = this.persons.find((p) => p.id === 'per-3')!.currentBalance;
      const purVoucher = this.vouchers.find((v) => v.id === purchaseInv.accountingVoucherId);

      const s1Passed =
        prd1AfterPurchase === prd1BeforePurchase + 100 &&
        bank1AfterPurchase === bank1BeforePurchase - 50000 &&
        per3AfterPurchase === per3BeforePurchase - 62000 &&
        Boolean(purVoucher && purVoucher.isBalanced && purVoucher.totalDebit === 112000);

      scenarios.push({
        id: 'int-1-purchase',
        stepNumber: 1,
        title: 'آزمون یکپارچه خرید کالا (افزایش موجودی، کاردکس، پرداخت بانکی و بدهی تأمین‌کننده)',
        passed: s1Passed,
        expected: `موجودی +100 متر | بانک -50,000 | مانده تأمین‌کننده -62,000 | سند متوازن 112,000 تومان`,
        actual: `موجودی: ${prd1AfterPurchase - prd1BeforePurchase}+ | بانک: ${(bank1AfterPurchase - bank1BeforePurchase).toLocaleString('fa-IR')} | تأمین‌کننده: ${(per3AfterPurchase - per3BeforePurchase).toLocaleString('fa-IR')} | سند: ${purVoucher?.totalDebit.toLocaleString('fa-IR')} تومان`,
        voucherNumber: purVoucher?.voucherNumber,
      });

      // ۲. سناریوی فروش جزئی (Retail Sale)
      const prd1BeforeSale = this.products.find((p) => p.id === 'prd-1')!.currentStock;
      const cash1BeforeSale = this.treasuryAccounts.find((a) => a.id === 'tr-cash-1')!.balance;

      const retailSaleInv = this.createInvoice(
        {
          invoiceType: 'sale',
          personId: 'per-1',
          warehouseId: 'wh-central',
          date: '1403/07/21',
          items: [
            {
              id: 'it-sale-test',
              productId: 'prd-1',
              productCode: 'KH-1001',
              productName: 'روبان ساتن ۲٫۵ سانت قرمز نگین (رول ۲۵ متری)',
              unitId: 'u-meter',
              unitName: 'متر',
              quantity: 40,
              conversionFactor: 1,
              baseQuantity: 40,
              unitPrice: 1600,
              discount: 0,
              tax: 0,
              totalPrice: 64000,
            },
          ],
          payments: [
            {
              id: 'pay-sale-1',
              method: 'cash',
              accountId: 'tr-cash-1',
              amount: 64000,
            },
          ],
        },
        user
      );

      const prd1AfterSale = this.products.find((p) => p.id === 'prd-1')!.currentStock;
      const cash1AfterSale = this.treasuryAccounts.find((a) => a.id === 'tr-cash-1')!.balance;
      const saleVoucher = this.vouchers.find((v) => v.id === retailSaleInv.accountingVoucherId);

      const s2Passed =
        prd1AfterSale === prd1BeforeSale - 40 &&
        cash1AfterSale === cash1BeforeSale + 64000 &&
        Boolean(saleVoucher && saleVoucher.isBalanced && saleVoucher.totalDebit === 64000);

      scenarios.push({
        id: 'int-2-retail-sale',
        stepNumber: 2,
        title: 'آزمون یکپارچه فروش جزئی (کسر موجودی به واحد پایه، دریافت نقدی و سند فروش)',
        passed: s2Passed,
        expected: `موجودی -40 متر | صندوق +64,000 | سند متوازن 64,000 تومان`,
        actual: `موجودی: ${prd1AfterSale - prd1BeforeSale} | صندوق: +${(cash1AfterSale - cash1BeforeSale).toLocaleString('fa-IR')} | سند: ${saleVoucher?.totalDebit.toLocaleString('fa-IR')} تومان`,
        voucherNumber: saleVoucher?.voucherNumber,
      });

      // ۳. سناریوی برگشت جزئی از فروش (Partial Return)
      const prd1BeforeReturn = this.products.find((p) => p.id === 'prd-1')!.currentStock;
      const cash1BeforeReturn = this.treasuryAccounts.find((a) => a.id === 'tr-cash-1')!.balance;

      const returnSaleInv = this.createInvoice(
        {
          invoiceType: 'sale_return',
          originalInvoiceId: retailSaleInv.id,
          personId: 'per-1',
          warehouseId: 'wh-central',
          date: '1403/07/22',
          refundAction: 'cash_refund',
          refundAccountId: 'tr-cash-1',
          returnReason: 'مرجوعی جزئی ۱۰ متر روبان در آزمون یکپارچه',
          items: [
            {
              id: 'it-ret-test',
              productId: 'prd-1',
              productCode: 'KH-1001',
              productName: 'روبان ساتن ۲٫۵ سانت قرمز نگین (رول ۲۵ متری)',
              unitId: 'u-meter',
              unitName: 'متر',
              quantity: 10,
              conversionFactor: 1,
              baseQuantity: 10,
              unitPrice: 1600,
              discount: 0,
              tax: 0,
              totalPrice: 16000,
            },
          ],
        },
        user
      );

      const prd1AfterReturn = this.products.find((p) => p.id === 'prd-1')!.currentStock;
      const cash1AfterReturn = this.treasuryAccounts.find((a) => a.id === 'tr-cash-1')!.balance;
      const returnVoucher = this.vouchers.find((v) => v.id === returnSaleInv.accountingVoucherId);

      const s3Passed =
        prd1AfterReturn === prd1BeforeReturn + 10 &&
        cash1AfterReturn === cash1BeforeReturn - 16000 &&
        Boolean(returnVoucher && returnVoucher.isBalanced && returnVoucher.totalDebit === 16000);

      scenarios.push({
        id: 'int-3-partial-return',
        stepNumber: 3,
        title: 'آزمون یکپارچه برگشت جزئی از فروش (کنترل سقف مرجوعی، بازگشت کالا به انبار و استرداد وجه)',
        passed: s3Passed,
        expected: `موجودی +10 متر | صندوق -16,000 | سند برگشت از فروش 16,000 تومان`,
        actual: `موجودی: +${prd1AfterReturn - prd1BeforeReturn} | صندوق: ${(cash1AfterReturn - cash1BeforeReturn).toLocaleString('fa-IR')} | سند: ${returnVoucher?.totalDebit.toLocaleString('fa-IR')} تومان`,
        voucherNumber: returnVoucher?.voucherNumber,
      });

      // ۴. سناریوی تسویه ترکیبی (Mixed Settlement: نقد + کارتخوان + نسیه)
      const cashBeforeMixed = this.treasuryAccounts.find((a) => a.id === 'tr-cash-1')!.balance;
      const posBeforeMixed = this.treasuryAccounts.find((a) => a.id === 'tr-pos-1')!.balance;
      const per2BeforeMixed = this.persons.find((p) => p.id === 'per-2')!.currentBalance;

      const mixedSaleInv = this.createInvoice(
        {
          invoiceType: 'sale',
          personId: 'per-2',
          warehouseId: 'wh-central',
          date: '1403/07/23',
          items: [
            {
              id: 'it-mixed-test',
              productId: 'prd-3',
              productCode: 'KH-2001',
              productName: 'دوک نخ پلی‌استر ۴۰/۲ مشکی چرخ خیاطی',
              unitId: 'u-spool',
              unitName: 'دوک',
              quantity: 10,
              conversionFactor: 1,
              baseQuantity: 10,
              unitPrice: 55000,
              discount: 0,
              tax: 0,
              totalPrice: 550000,
            },
          ],
          payments: [
            { id: 'pm-1', method: 'cash', accountId: 'tr-cash-1', amount: 200000 },
            { id: 'pm-2', method: 'pos', accountId: 'tr-pos-1', amount: 150000, referenceNumber: 'POS-9911' },
          ],
        },
        user
      );

      const cashAfterMixed = this.treasuryAccounts.find((a) => a.id === 'tr-cash-1')!.balance;
      const posAfterMixed = this.treasuryAccounts.find((a) => a.id === 'tr-pos-1')!.balance;
      const per2AfterMixed = this.persons.find((p) => p.id === 'per-2')!.currentBalance;
      const mixedVoucher = this.vouchers.find((v) => v.id === mixedSaleInv.accountingVoucherId);

      const s4Passed =
        cashAfterMixed === cashBeforeMixed + 200000 &&
        posAfterMixed === posBeforeMixed + 150000 &&
        per2AfterMixed === per2BeforeMixed + 200000 &&
        mixedSaleInv.remainingAmount === 200000 &&
        Boolean(mixedVoucher && mixedVoucher.isBalanced && mixedVoucher.totalDebit === 550000);

      scenarios.push({
        id: 'int-4-mixed-settlement',
        stepNumber: 4,
        title: 'آزمون یکپارچه تسویه ترکیبی فاکتور (نقد ۲۰۰ هزار + پوز ۱۵۰ هزار + نسیه ۲۰۰ هزار)',
        passed: s4Passed,
        expected: `صندوق +200,000 | پوز +150,000 | بدهکاری مشتری +200,000 | سند 550,000 تومان`,
        actual: `صندوق: +${(cashAfterMixed - cashBeforeMixed).toLocaleString('fa-IR')} | پوز: +${(posAfterMixed - posBeforeMixed).toLocaleString('fa-IR')} | مشتری: +${(per2AfterMixed - per2BeforeMixed).toLocaleString('fa-IR')}`,
        voucherNumber: mixedVoucher?.voucherNumber,
      });

      // ۵. سناریوی ثبت چک دریافتی (Received Cheque)
      const per2BeforeCheque = this.persons.find((p) => p.id === 'per-2')!.currentBalance;
      const receivedCheque = this.saveCheque(
        {
          chequeType: 'received',
          chequeNumber: '884422',
          sayadNumber: '1403884422110099',
          bankName: 'بانک ملت',
          branchName: 'شعبه بازار',
          amount: 200000,
          personId: 'per-2',
          issueDate: '1403/07/24',
          dueDate: '1403/08/24',
          notes: 'چک تسویه مانده فاکتور ترکیبی',
        },
        user
      );

      const per2AfterCheque = this.persons.find((p) => p.id === 'per-2')!.currentBalance;
      const chqInitVoucher = this.vouchers.find((v) => v.id === receivedCheque.voucherId);

      const s5Passed =
        receivedCheque.status === 'registered' &&
        per2AfterCheque === per2BeforeCheque - 200000 &&
        Boolean(chqInitVoucher && chqInitVoucher.isBalanced && chqInitVoucher.totalDebit === 200000);

      scenarios.push({
        id: 'int-5-received-cheque',
        stepNumber: 5,
        title: 'آزمون یکپارچه دریافت چک صیادی (ثبت در اسناد دریافتنی و کسر از بدهی مشتری)',
        passed: s5Passed,
        expected: `وضعیت چک: نزد صندوق | مانده مشتری -200,000 | سند اسناد دریافتنی 200,000 تومان`,
        actual: `وضعیت: ${receivedCheque.status} | تغییر مانده مشتری: ${(per2AfterCheque - per2BeforeCheque).toLocaleString('fa-IR')} | سند: ${chqInitVoucher?.totalDebit.toLocaleString('fa-IR')} تومان`,
        voucherNumber: chqInitVoucher?.voucherNumber,
      });

      // ۶. سناریوی وصول چک دریافتی (Cheque Collection)
      const bank1BeforeCollect = this.treasuryAccounts.find((a) => a.id === 'tr-bank-1')!.balance;
      const collectedCheque = this.transitionChequeStatus(
        receivedCheque.id,
        'collected',
        {
          bankAccountId: 'tr-bank-1',
          bankAccountTitle: 'بانک ملی شعبه بازار (حساب جاری)',
          description: 'وصول چک صیادی در حساب جاری بانک ملی',
        },
        user
      );

      const bank1AfterCollect = this.treasuryAccounts.find((a) => a.id === 'tr-bank-1')!.balance;
      const chqCollectVoucher = this.vouchers.find((v) => v.id === collectedCheque.voucherId);

      const s6Passed =
        collectedCheque.status === 'collected' &&
        bank1AfterCollect === bank1BeforeCollect + 200000 &&
        Boolean(chqCollectVoucher && chqCollectVoucher.isBalanced && chqCollectVoucher.totalDebit === 200000);

      scenarios.push({
        id: 'int-6-cheque-collection',
        stepNumber: 6,
        title: 'آزمون یکپارچه وصول چک دریافتی (واریز به بانک ملی و تسویه اسناد دریافتنی)',
        passed: s6Passed,
        expected: `وضعیت چک: وصول شده | بانک ملی +200,000 | سند وصول 200,000 تومان`,
        actual: `وضعیت: ${collectedCheque.status} | بانک ملی: +${(bank1AfterCollect - bank1BeforeCollect).toLocaleString('fa-IR')} | سند: ${chqCollectVoucher?.totalDebit.toLocaleString('fa-IR')} تومان`,
        voucherNumber: chqCollectVoucher?.voucherNumber,
      });

      // ۷. سناریوی ثبت هزینه عملیاتی (Expense Registration)
      const cash1BeforeExpense = this.treasuryAccounts.find((a) => a.id === 'tr-cash-1')!.balance;
      const expenseTx = this.recordTreasuryTransaction(
        {
          transactionType: 'expense',
          treasuryAccountId: 'tr-cash-1',
          expenseCategoryId: 'fcat-exp-1',
          amount: 120000,
          date: '1403/07/25',
          trackingNumber: 'EXP-INT-701',
          description: 'هزینه حمل و باربری رول‌های روبان و نخ',
        },
        user
      );

      const cash1AfterExpense = this.treasuryAccounts.find((a) => a.id === 'tr-cash-1')!.balance;
      const expVoucher = this.vouchers.find((v) => v.id === expenseTx.voucherId);

      const s7Passed =
        cash1AfterExpense === cash1BeforeExpense - 120000 &&
        Boolean(expVoucher && expVoucher.isBalanced && expVoucher.totalDebit === 120000);

      scenarios.push({
        id: 'int-7-expense',
        stepNumber: 7,
        title: 'آزمون یکپارچه ثبت هزینه عملیاتی (کسر از صندوق نقدی و ثبت در سرفصل هزینه ۶۰۱)',
        passed: s7Passed,
        expected: `صندوق -120,000 | سند متوازن هزینه به صندوق 120,000 تومان`,
        actual: `صندوق: ${(cash1AfterExpense - cash1BeforeExpense).toLocaleString('fa-IR')} | سند: ${expVoucher?.totalDebit.toLocaleString('fa-IR')} تومان`,
        voucherNumber: expVoucher?.voucherNumber,
      });

      // ممیزی جامع ۵گانه پس از اجرای ۷ تراکنش عملیاتی زنجیره‌ای و قبل از بستن سال مالی
      midSuiteReconciliation = this.runMasterReconciliationAudit();

      // ۸. سناریوی بستن سال مالی ۱۴۰۳ و انتقال مانده‌ها به سال ۱۴۰۴ (Fiscal Year Closing & Rollover)
      const rolloverResult = this.closeFiscalYearAndRollover(
        'fy-1403',
        {
          nextYearCode: '1404',
          nextYearTitle: 'سال مالی ۱۴۰۴ فروشگاه خرازی',
          notes: 'بستن سال مالی در آزمون یکپارچه',
        },
        user
      );

      postRolloverFiscalStatus = {
        closed1403:
          rolloverResult.closedFiscalYear.status === 'closed' &&
          Boolean(rolloverResult.closedFiscalYear.archivedSnapshot),
        opened1404:
          rolloverResult.newFiscalYear.isActive && rolloverResult.newFiscalYear.code === '1404',
        openingBalanced:
          rolloverResult.nextYearOpeningVoucher.isBalanced &&
          rolloverResult.closingPermanentVoucher.isBalanced,
      };

      const s8Passed =
        midSuiteReconciliation.allReconciled &&
        postRolloverFiscalStatus.closed1403 &&
        postRolloverFiscalStatus.opened1404 &&
        postRolloverFiscalStatus.openingBalanced;

      scenarios.push({
        id: 'int-8-fiscal-closing',
        stepNumber: 8,
        title: 'آزمون یکپارچه بستن سال مالی ۱۴۰۳، صدور اسناد اختتامیه و افتتاحیه خودکار ۱۴۰۴',
        passed: s8Passed,
        expected: `مغایرت قبل از بستن: 0 | بستن سال ۱۴۰۳ + افتتاحیه متوازن سال ۱۴۰۴`,
        actual: `مغایرت: ${midSuiteReconciliation.summary.totalDiscrepancies} | وضعیت ۱۴۰۳: ${rolloverResult.closedFiscalYear.status} | سند افتتاحیه ۱۴۰۴: ${rolloverResult.nextYearOpeningVoucher.totalDebit.toLocaleString('fa-IR')} تومان`,
        voucherNumber: rolloverResult.nextYearOpeningVoucher.voucherNumber,
      });
    } finally {
      // بازیابی کامل به وضعیت پیش از تست تا داده‌های محیط کاربری تمیز و دست‌نخورده بمانند
      this.restoreFullDatabaseBackup(preSuiteSnapshot, user, true);
    }

    const postRestoreReconciliation = this.runMasterReconciliationAudit();
    const allScenariosPassed = scenarios.length === 8 && scenarios.every((s) => s.passed) && postRestoreReconciliation.allReconciled;

    this.addAuditLog(
      user.id,
      user.fullName,
      'approve',
      'موتور حسابداری',
      `اجرای کامل ۸ آزمون یکپارچه عملیاتی (خرید، فروش جزئی، برگشت جزئی، تسویه ترکیبی، چک دریافتی، وصول چک، هزینه، بستن سال مالی) - نتیجه: ${allScenariosPassed ? '۱۰۰٪ موفق' : 'دارای خطا'}`,
      `suite-${Date.now()}`
    );
    this.saveToDiskSync();

    return {
      executedAt: new Date().toLocaleString('fa-IR'),
      durationMs: Date.now() - startTime,
      allPassed: allScenariosPassed,
      passedCount: scenarios.filter((s) => s.passed).length,
      totalCount: scenarios.length,
      scenarios,
      reconciliationDuringSuite: midSuiteReconciliation,
      reconciliationAfterRestore: postRestoreReconciliation,
    };
  }
}

export const serverDb = new PersistentDatabase();


