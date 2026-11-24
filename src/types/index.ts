/**
 * انواع داده‌های تخصصی سیستم حسابداری خرازی
 * Types for Haberdashery ERP & Accounting System
 */

export type UserRole = 'admin' | 'accountant' | 'cashier' | 'inventory_clerk';

// ۸ مجوز عملیاتی تفکیک‌شده در سطح سیستم
export type PermissionAction =
  | 'view'     // مشاهده
  | 'create'   // ایجاد
  | 'edit'     // ویرایش
  | 'approve'  // ثبت نهایی / قطعی‌سازی
  | 'cancel'   // ابطال / برگشت
  | 'print'    // چاپ
  | 'export'   // خروجی (Excel / PDF / JSON)
  | 'reports'; // گزارش‌ها

// ماژول‌ها و بخش‌های اصلی سامانه جهت کنترل دسترسی
export type PermissionModule =
  | 'dashboard'      // داشبورد مدیریتی
  | 'base_info'      // اطلاعات پایه (کالا، واحد، اشخاص، انبارها)
  | 'sales'          // فروش و فاکتورهای فروش
  | 'purchases'      // خرید، رسید انبار و خرج‌کار
  | 'inventory'      // انبارداری، کاردکس، انتقال و انبارگردانی
  | 'treasury'       // خزانه‌داری، صندوق، بانک، چک و هزینه‌ها
  | 'accounting'     // حسابداری دوطرفه و اسناد مالی
  | 'reports'        // گزارش‌های مدیریتی و صورت‌های مالی
  | 'fiscal_year'    // مدیریت سال مالی، افتتاحیه و اختتامیه
  | 'users_security' // مدیریت کاربران، نقش‌ها و امنیت
  | 'settings';      // تنظیمات فروشگاه و پشتیبان‌گیری

export type ModuleActionPermissions = Record<PermissionAction, boolean>;

export interface ConfidentialAccessRules {
  canViewPurchasePrice: boolean;      // مشاهده قیمت خرید و بهای تمام‌شده کالاها
  canViewProfitMargins: boolean;      // مشاهده سود ناخالص/خالص و حاشیه سود هر کالا/فاکتور
  canViewBankSecrets: boolean;        // مشاهده کامل شماره شبا، کارت و حساب‌های بانکی
  canViewSecurityLogs: boolean;       // مشاهده لاگ‌های امنیتی، تلاش‌های ناموفق و تغییر سطوح دسترسی
  maxAllowedDiscountPercent: number;  // سقف مجاز تخفیف روی فاکتور فروش (۰ تا ۱۰۰ درصد)
}

export interface RolePermissionConfig {
  role: UserRole;
  title: string;
  description: string;
  badgeColor: string;
  isSystemAdmin?: boolean;
  modules: Record<PermissionModule, ModuleActionPermissions>;
  confidential: ConfidentialAccessRules;
  updatedAt: string;
  updatedBy: string;
}

export interface User {
  id: string;
  username: string;
  fullName: string;
  role: UserRole;
  isActive: boolean;
  avatar?: string;
  mobile?: string;
  email?: string;
  department?: string;
  passwordHash?: string; // فقط در سرور نگهداری می‌شود و در خروجی API حذف/ماسک می‌گردد
  hasPassword?: boolean;
  mustChangePassword?: boolean;
  failedLoginAttempts?: number;
  lockedUntil?: number | null;
  lastLoginAt?: string;
  lastLoginIp?: string;
  customPermissions?: Partial<Record<PermissionModule, Partial<ModuleActionPermissions>>>;
  customConfidential?: Partial<ConfidentialAccessRules>;
  createdAt: string;
  updatedAt?: string;
}

export type UnitType = 'عدد' | 'جفت' | 'بسته' | 'کارتن' | 'رول' | 'طاقه' | 'متر' | 'سانتی‌متر' | 'کیلوگرم' | 'گرم' | 'یارد';

export type UnitFamily = 'count' | 'length' | 'weight' | 'other';

export interface Unit {
  id: string;
  name: UnitType | string;
  symbol: string;
  isDecimalAllowed: boolean; // e.g. true for متر، سانتی‌متر، کیلوگرم
  unitFamily: UnitFamily; // دسته‌بندی فیزیکی: شمارشی، طولی، وزنی
  baseUnitId?: string; // واحد اصلی متناظر
  baseUnitName?: string;
  conversionFactor?: number; // ضریب نسبت به واحد اصلی
  description?: string;
}

export interface ProductCategory {
  id: string;
  code: string;
  name: string;
  parentId?: string | null;
  description?: string;
}

export interface Brand {
  id: string;
  name: string;
  country?: string;
  description?: string;
}

export interface PersonGroup {
  id: string;
  code: string;
  name: string;
  description?: string;
  defaultDiscountPercent?: number;
  defaultCreditLimit?: number;
}

export interface ProductCustomSpec {
  key: string;
  value: string;
}

export interface ProductUnitConversion {
  unitId: string;
  unitName: string;
  conversionFactor: number; // مثلا ۱ رول = ۲۵ متر (ضریب: ۲۵)
  price?: number;
}

export type SalesType = 'quantity' | 'weight' | 'length' | 'custom';

export interface Product {
  id: string;
  code: string;
  barcode: string;
  name: string;
  categoryId: string;
  categoryName?: string;
  baseUnitId: string;
  baseUnitName?: string;
  // ویژگی‌های اختصاصی و ظاهری خرازی
  color?: string;
  size?: string;
  material?: string; // جنس: نخ، ساتن، مخمل، پلاستیک، برنجی، استیل
  brand?: string; // یونکس، ناکو، دمسه، چرخ، دالفین
  model?: string;
  customSpecs?: ProductCustomSpec[]; // مشخصات دلخواه
  // ابعاد و وزن فیزیکی کالا
  weight?: number; // وزن کالا
  weightUnit?: 'گرم' | 'کیلوگرم';
  length?: number; // طول کالا
  lengthUnit?: 'سانتی‌متر' | 'متر';
  width?: number; // عرض / پهنای نوار یا کالا
  widthUnit?: 'میلی‌متر' | 'سانتی‌متر';
  height?: number; // ارتفاع / ضخامت کالا
  heightUnit?: 'میلی‌متر' | 'سانتی‌متر';
  salesType?: SalesType; // فروش بر اساس: تعداد، وزن، طول، یا واحد انتخابی
  // قیمت‌گذاری
  purchasePrice: number; // قیمت خرید پایه
  retailPrice: number; // قیمت فروش جزئی
  wholesalePrice: number; // قیمت عمده
  colleaguePrice?: number; // قیمت همکار (تولیدی و مزون)
  minAllowedPrice: number; // حداقل قیمت مجاز برای فروشنده
  // موجودی و انبار
  currentStock: number; // موجودی به واحد پایه (مثلا بر حسب متر یا عدد)
  minStockAlert: number; // نقطه سفارش / هشدار کمبود موجودی
  allowDecimal: boolean;
  unitConversions: ProductUnitConversion[];
  isActive: boolean;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export type PersonType = 'customer' | 'supplier' | 'both';

export interface Person {
  id: string;
  code: string;
  name: string;
  personType: PersonType;
  groupId?: string;
  groupName?: string;
  phone?: string;
  mobile: string;
  nationalCode?: string;
  economicCode?: string;
  address?: string;
  creditLimit: number; // سقف اعتبار
  currentBalance: number; // مانده حساب (مثبت = بدهکار به ما، منفی = بستانکار از ما)
  initialBalance?: number;
  isActive: boolean; // فعال یا غیرفعال
  notes?: string;
  createdAt: string;
  updatedAt?: string;
}

export type InvoiceType =
  | 'sale'
  | 'purchase'
  | 'proforma'
  | 'consignment'
  | 'return_sale'
  | 'return_purchase'
  | 'sale_return'
  | 'purchase_return'
  | 'waste';
export type InvoiceStatus = 'draft' | 'approved' | 'cancelled';

export interface InvoiceItem {
  id: string;
  productId: string;
  productCode: string;
  productName: string;
  unitId: string;
  unitName: string;
  conversionFactor: number;
  quantity: number; // مقدار به واحد انتخاب شده (می‌تواند اعشاری باشد)
  baseQuantity: number; // مقدار تبدیل شده به واحد پایه (برای انبارداری)
  unitPrice: number;
  discount: number;
  tax: number;
  totalPrice: number;
  color?: string;
  size?: string;
  originalInvoiceItemId?: string;
  returnReason?: string;
  alreadyReturnedQuantity?: number;
}

export type PaymentMethod = 'cash' | 'pos' | 'bank_transfer' | 'cheque' | 'credit';

export interface InvoicePayment {
  id: string;
  method: PaymentMethod;
  amount: number;
  accountId?: string;
  accountTitle?: string;
  referenceNumber?: string; // شماره پیگیری پوز یا فیش
  chequeNumber?: string;
  bankName?: string;
  dueDate?: string;
  sayadNumber?: string;
  notes?: string;
}

export type HolooPrintTheme = 'holoo-teal' | 'holoo-blue' | 'classic-indigo' | 'emerald' | 'monochrome';
export type InvoiceTemplateStyle = 'official' | 'holoo_classic' | 'compact_bazaar';

export interface InvoicePrintConfig {
  theme: HolooPrintTheme;
  templateStyle?: InvoiceTemplateStyle;
  paperSize: 'a4' | 'a5' | 'thermal_80';
  orientation: 'portrait' | 'landscape';
  fontSize?: 'xs' | 'sm' | 'base' | 'lg';
  printScale?: number; // 70 to 125%
  showBarcode: boolean;
  showTax: boolean;
  showDiscount: boolean;
  showColorSize: boolean;
  showAmountInWords: boolean;
  showPaymentBreakdown: boolean;
  showSignatures: boolean;
  showStoreLogo: boolean;
  showGuildName?: boolean;
  showCustomerBalance?: boolean;
  showEconomicCode?: boolean;
  customTitle?: string;
  customSlogan?: string;
  customFooterNote?: string;
  customTerms?: string;
  // چیدمان و تراز متن اجزای فاکتور (راست‌چین، وسط‌چین، چپ‌چین)
  headerAlignment?: 'right' | 'center' | 'left';
  customerInfoAlignment?: 'right' | 'center' | 'left';
  tableHeaderAlignment?: 'right' | 'center' | 'left';
  tableBodyAlignment?: 'right' | 'center' | 'left';
  notesAlignment?: 'right' | 'center' | 'left';
  termsAlignment?: 'right' | 'center' | 'left';
  signaturesAlignment?: 'right' | 'center' | 'left' | 'between';
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  invoiceType: InvoiceType;
  personId: string;
  personName: string;
  personPreviousBalance?: number;
  warehouseId?: string;
  warehouseName?: string;
  fiscalYearId: string;
  date: string; // تاریخ شمسی
  status: InvoiceStatus;
  items: InvoiceItem[];
  subtotal: number;
  totalDiscount: number;
  discountAmount?: number;
  shippingCost?: number;
  taxAmount: number;
  isTaxEnabled?: boolean;
  taxRate?: number;
  finalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  payments?: InvoicePayment[];
  accountingVoucherId?: string;
  auditTrail?: any[];
  cancellationReason?: string;
  cancelledAt?: string;
  cancelledBy?: string;
  notes?: string;
  printConfig?: Partial<InvoicePrintConfig>;
  originalInvoiceId?: string;
  originalInvoiceNumber?: string;
  returnReason?: string;
  refundAction?: 'credit_balance' | 'cash_refund' | 'pos_refund' | 'bank_refund';
  refundAccountId?: string;
  createdBy: string;
  createdAt: string;
}

export interface AccountingAccount {
  id: string;
  code: string;
  title: string;
  level: 'group' | 'general' | 'subsidiary' | 'detail'; // گروه، کل، معین، تفصیلی
  accountType?: 'asset' | 'liability' | 'equity' | 'revenue' | 'expense';
  type?: 'asset' | 'liability' | 'equity' | 'revenue' | 'expense';
  nature?: 'debit' | 'credit';
  parentCode?: string;
  balance: number;
  isActive?: boolean;
}

export interface VoucherLine {
  id: string;
  accountCode: string;
  accountTitle: string;
  personId?: string;
  personName?: string;
  debit: number; // بدهکار
  credit: number; // بستانکار
  description?: string;
}

export interface AccountingVoucher {
  id: string;
  voucherNumber: string;
  date: string;
  description: string;
  fiscalYearId: string;
  status: 'draft' | 'approved' | 'permanent';
  referenceType?: 'manual' | 'sale_invoice' | 'purchase_invoice' | 'sale_return' | 'purchase_return' | 'treasury' | 'cheque' | 'opening_balance' | 'reversal' | 'closing_temporary' | 'closing_permanent';
  referenceId?: string;
  referenceNumber?: string;
  reversalOfVoucherId?: string;
  lines: VoucherLine[];
  totalDebit: number;
  totalCredit: number;
  isBalanced: boolean;
  createdBy: string;
  createdAt: string;
  modifiedBy?: string;
  modifiedAt?: string;
}

export interface TreasuryAccount {
  id: string;
  code?: string;
  type: 'cash' | 'bank' | 'pos';
  title: string;
  accountNumber?: string;
  bankName?: string;
  branchName?: string;
  shebaNumber?: string;
  iban?: string;
  cardNumber?: string;
  cardPlaceholder?: string;
  balance: number;
  currentBalance?: number;
  initialBalance?: number;
  accountingAccountCode?: string;
  isActive: boolean;
  createdAt?: string;
}

export type TreasuryTransactionType = 'receive' | 'pay' | 'transfer' | 'income' | 'expense';

export interface TreasuryTransaction {
  id: string;
  transactionNumber?: string;
  transactionType: TreasuryTransactionType; // دریافت، پرداخت، انتقال وجه، درآمد متفرقه، هزینه
  treasuryAccountId: string; // حساب اصلی مرتبط
  treasuryAccountTitle: string;
  sourceAccountId?: string; // برای پرداخت یا انتقال وجه
  sourceAccountTitle?: string;
  destinationAccountId?: string; // برای دریافت یا انتقال وجه
  destinationAccountTitle?: string;
  personId?: string;
  personName?: string;
  invoiceId?: string; // پیوند به فاکتور خاص در تسویه کامل یا جزئی
  invoiceNumber?: string;
  settlementType?: 'full' | 'partial' | 'on_account'; // تسویه کامل، تسویه جزئی، یا علی‌الحساب
  expenseCategoryId?: string; // سرفصل یا دسته‌بندی هزینه/درآمد
  expenseCategoryName?: string;
  amount: number;
  date: string;
  trackingNumber?: string;
  paymentMethod?: 'cash' | 'pos' | 'bank_transfer' | 'cheque';
  description: string;
  voucherId?: string;
  isReconciled?: boolean;
  createdBy: string;
  createdAt: string;
}

export interface FinancialCategory {
  id: string;
  code: string;
  title: string;
  type: 'expense' | 'income';
  description?: string;
  isActive: boolean;
}

export type ChequeStatus =
  | 'registered'    // ثبت اولیه / نزد صندوق
  | 'deposited'     // واگذاری به بانک (در جریان وصول)
  | 'collected'     // وصول شده (پاس شده)
  | 'transferred'   // خرج شده / واگذاری به شخص ثالث
  | 'bounced'       // برگشت خورده
  | 'refunded'      // عودت داده شده به طرف‌حساب
  | 'cancelled'     // باطل شده
  // Legacy aliases for backward compatibility
  | 'in_process'
  | 'cleared'
  | 'returned';

export interface ChequeStatusHistoryItem {
  id: string;
  timestamp: string;
  date: string;
  fromStatus: string;
  toStatus: string;
  actionTitle: string;
  description: string;
  performedBy: string;
  relatedAccountId?: string;
  relatedAccountTitle?: string;
  targetPersonId?: string;
  targetPersonName?: string;
  voucherId?: string;
}

export interface Cheque {
  id: string;
  chequeType: 'received' | 'issued'; // دریافتی یا پرداختی
  chequeNumber: string;
  sayadNumber?: string; // شناسه صیادی ۱۶ رقمی
  sayadId?: string;
  bankName: string;
  branchName?: string;
  accountNumber?: string;
  amount: number;
  issueDate?: string; // تاریخ صدور
  dueDate: string;   // تاریخ سررسید
  personId: string;
  personName: string;
  sourceAccountId?: string; // برای چک پرداختی، حساب بانکی صادرکننده
  sourceAccountTitle?: string;
  depositedBankAccountId?: string; // حسابی که چک دریافتی به آن واگذار یا وصول شده
  depositedBankAccountTitle?: string;
  transferredPersonId?: string; // طرف‌حسابی که چک به او واگذار یا خرج شده
  transferredPersonName?: string;
  status: ChequeStatus;
  statusHistory?: ChequeStatusHistoryItem[];
  invoiceId?: string;
  invoiceNumber?: string;
  notes?: string;
  voucherId?: string;
  createdBy?: string;
  createdAt: string;
}

export type StockMovementReferenceType =
  | 'purchase_invoice'
  | 'purchase_receipt'
  | 'purchase_proforma'
  | 'sale_invoice'
  | 'consignment'
  | 'waste'
  | 'transfer_in'
  | 'transfer_out'
  | 'adjustment_plus'
  | 'adjustment_minus'
  | 'stocktaking'
  | 'sale_return'
  | 'purchase_return'
  | 'initial_stock';

export interface Warehouse {
  id: string;
  code: string;
  name: string;
  type: 'central' | 'retail' | 'waste' | 'quarantine';
  location: string;
  managerName?: string;
  phone?: string;
  isActive: boolean;
  isDefault?: boolean;
  createdAt: string;
}

export interface WarehouseStock {
  productId: string;
  warehouseId: string;
  quantity: number;
  lastUpdated: string;
}

export interface KardexEntry {
  id: string;
  productId: string;
  productCode: string;
  productName: string;
  warehouseId: string;
  warehouseName: string;
  date: string;
  referenceType: StockMovementReferenceType;
  referenceTypeTitle: string;
  referenceId: string;
  referenceNumber: string;
  inQuantity: number;
  outQuantity: number;
  unitName: string;
  unitPrice: number;
  totalValue: number;
  balanceQuantity: number;
  balanceValue: number;
  userId?: string;
  userName?: string;
  notes?: string;
  createdAt: string;
}

export interface GoodsReceiptItem {
  id: string;
  productId: string;
  productCode: string;
  productName: string;
  unitId: string;
  unitName: string;
  quantity: number;
  conversionFactor: number;
  baseQuantity: number;
  unitPrice: number;
  totalPrice: number;
  notes?: string;
}

export interface GoodsReceipt {
  id: string;
  receiptNumber: string;
  supplierId: string;
  supplierName: string;
  warehouseId: string;
  warehouseName: string;
  purchaseInvoiceId?: string;
  date: string;
  status: 'draft' | 'approved';
  items: GoodsReceiptItem[];
  totalQuantity: number;
  totalAmount: number;
  driverName?: string;
  driverMobile?: string;
  waybillNumber?: string;
  notes?: string;
  approvedBy?: string;
  approvedAt?: string;
  createdBy: string;
  createdAt: string;
}

export interface PurchaseProforma {
  id: string;
  proformaNumber: string;
  supplierId: string;
  supplierName: string;
  targetWarehouseId: string;
  targetWarehouseName: string;
  date: string;
  validUntil: string;
  status: 'draft' | 'approved' | 'converted_to_invoice' | 'cancelled';
  items: InvoiceItem[];
  subtotal: number;
  totalDiscount: number;
  taxAmount: number;
  finalAmount: number;
  notes?: string;
  approvedBy?: string;
  approvedAt?: string;
  createdBy: string;
  createdAt: string;
}

export interface WarehouseTransferItem {
  id: string;
  productId: string;
  productCode: string;
  productName: string;
  unitId: string;
  unitName: string;
  quantity: number;
  conversionFactor: number;
  baseQuantity: number;
  unitCost: number;
  totalCost: number;
}

export interface OperationAuditEntry {
  action: string;
  userName: string;
  timestamp: string;
  notes?: string;
}

export interface WarehouseTransfer {
  id: string;
  transferNumber: string;
  sourceWarehouseId: string;
  sourceWarehouseName: string;
  destinationWarehouseId: string;
  destinationWarehouseName: string;
  date: string;
  status: 'draft' | 'approved' | 'cancelled';
  items: WarehouseTransferItem[];
  totalQuantity: number;
  totalCost: number;
  driverOrTransporter?: string;
  reason?: string;
  notes?: string;
  approvedBy?: string;
  approvedAt?: string;
  auditTrail: OperationAuditEntry[];
  createdBy: string;
  createdAt: string;
}

export interface StocktakingItem {
  id: string;
  productId: string;
  productCode: string;
  productName: string;
  unitName: string;
  systemQuantity: number;
  countedQuantity: number;
  varianceQuantity: number; // countedQuantity - systemQuantity
  unitCost: number;
  varianceValue: number; // varianceQuantity * unitCost
  varianceStatus: 'matched' | 'deficit' | 'surplus';
  notes?: string;
}

export interface StocktakingSession {
  id: string;
  code: string;
  title: string;
  warehouseId: string;
  warehouseName: string;
  countRound: 1 | 2 | 3;
  date: string;
  status: 'draft' | 'approved' | 'cancelled';
  items: StocktakingItem[];
  totalItemsCount: number;
  totalDeficitValue: number;
  totalSurplusValue: number;
  netVarianceValue: number;
  approvedBy?: string;
  approvedAt?: string;
  auditTrail: OperationAuditEntry[];
  notes?: string;
  createdBy: string;
  createdAt: string;
}

export type InventoryAdjustmentReason =
  | 'damage'
  | 'expiration'
  | 'counting_error'
  | 'theft_loss'
  | 'sample'
  | 'stocktaking_variance'
  | 'other';

export interface InventoryAdjustmentItem {
  id: string;
  productId: string;
  productCode: string;
  productName: string;
  unitName: string;
  quantity: number;
  unitCost: number;
  totalCost: number;
}

export interface InventoryAdjustment {
  id: string;
  adjustmentNumber: string;
  warehouseId: string;
  warehouseName: string;
  date: string;
  type: 'plus' | 'minus'; // فزونی یا کسری
  reasonCode: InventoryAdjustmentReason;
  reasonTitle: string;
  reasonDescription: string;
  status: 'draft' | 'approved';
  items: InventoryAdjustmentItem[];
  totalQuantity: number;
  totalCost: number;
  approvedBy?: string;
  approvedAt?: string;
  auditTrail: OperationAuditEntry[];
  notes?: string;
  createdBy: string;
  createdAt: string;
}

export interface InventoryTurnoverReportRow {
  productId: string;
  productCode: string;
  productName: string;
  categoryName: string;
  unitName: string;
  initialStock: number;
  totalInflow: number;
  totalOutflow: number;
  currentStock: number;
  unitPurchasePrice: number;
  totalStockValue: number;
  turnoverRatio: number;
  turnoverDays: number;
  status: 'normal' | 'low_stock' | 'out_of_stock' | 'stagnant';
}

export type AuditLogAction =
  | 'create'
  | 'update'
  | 'delete'
  | 'approve'
  | 'cancel'
  | 'print'
  | 'export'
  | 'reports'
  | 'login'
  | 'logout'
  | 'failed_login'
  | 'unauthorized_access'
  | 'sensitive_op'
  | 'session_revoke'
  | 'permission_change'
  | 'validation_failed';

export type AuditLogCategory =
  | 'change_history'      // تاریخچه تغییرات داده‌ها (ایجاد، ویرایش، حذف)
  | 'auth_session'        // ورود، خروج و مدیریت نشست‌ها
  | 'sensitive_operation' // عملیات حساس (قطعی‌سازی، ابطال، بستن سال مالی، تغییر دسترسی، چاپ/خروجی)
  | 'failed_attempt';     // تلاش‌های ناموفق ورود، دسترسی غیرمجاز ۴۰۳ و خطاهای اعتبارسنجی امنیتی

export interface AuditLog {
  id: string;
  userId: string;
  username?: string;
  userName: string;
  userRole?: UserRole | string;
  action: AuditLogAction;
  category?: AuditLogCategory;
  severity?: 'info' | 'warning' | 'critical';
  status?: 'success' | 'failed' | 'blocked';
  module: string;
  permissionModule?: PermissionModule;
  permissionAction?: PermissionAction;
  entityId?: string;
  description: string;
  ipAddress?: string;
  userAgent?: string;
  endpoint?: string;
  beforeData?: Record<string, any>;
  afterData?: Record<string, any>;
  timestamp: string;
}

export interface StoreSettings {
  storeName: string;
  guildName?: string; // نام صنف و رسته شغلی (مثلاً خرازی، ملزومات خیاطی و پوشاک)
  storeOwner: string;
  phone: string;
  address: string;
  currency: 'تومان' | 'ریال';
  defaultTaxPercent: number;
  activeFiscalYear: string;
  allowNegativeStock: boolean;
  requireBalancedVouchers: boolean;
  defaultPrintLayout?: 'thermal_80' | 'a4' | 'a5';
  printHeaderNote: string;
  printFooterNote: string;
  economicCode?: string;
  nationalId?: string;
  postalCode?: string;
  invoicePrintConfig?: Partial<InvoicePrintConfig>;
  onboardingCompleted?: boolean;
}

// انواع روش‌های تخصیص هزینه و خرج‌کار
export type AllocationMethod = 'quantity' | 'value' | 'weight' | 'length' | 'manual' | 'overhead';

// مدل نوع هزینه و خرج‌کار قابل تنظیم توسط کاربر
export interface AccessoryCostType {
  id: string;
  code: string;
  name: string; // نام هزینه مثلا «کرایه حمل و باربری»، «خرج کار دکمه و زیپ»، «کارمزد برش نوار»
  category: 'notion' | 'freight' | 'service' | 'packaging' | 'overhead' | 'other';
  defaultAllocationMethod: AllocationMethod; // نحوه تخصیص پیش‌فرض
  description?: string;
  isActive: boolean;
}

// ردیف تخصیص یافته به کالا در یک برگه خرج‌کار
export interface AllocatedProductItem {
  productId: string;
  productCode: string;
  productName: string;
  quantity: number;
  unitName: string;
  originalUnitCost: number; // بهای تمام‌شده قبلی واحد
  allocatedShare: number; // سهم کل تخصیص‌یافته از هزینه
  allocatedPerUnit: number; // سهم تخصیص‌یافته به ازای هر واحد کالا
  newUnitCost: number; // بهای تمام‌شده جدید هر واحد (original + allocatedPerUnit)
  weight?: number; // وزن جهت محاسبات تخصیص وزنی
  length?: number; // متراژ جهت محاسبات تخصیص طولی
}

// برگه ثبت هزینه جانبی یا خرج کار
export interface AccessoryCostEntry {
  id: string;
  trackingCode: string;
  title: string;
  costTypeId: string;
  costTypeName: string;
  amount: number; // مبلغ کل هزینه
  date: string;
  allocationMethod: AllocationMethod; // روش تخصیص انتخابی
  targetType: 'invoice' | 'products' | 'overhead'; // هدف تخصیص: فاکتور خرید، کالاهای انتخابی، یا هزینه سربار دوره
  targetId?: string; // شناسه فاکتور یا مرجع
  targetName?: string;
  treasuryAccountId?: string;
  treasuryAccountTitle?: string;
  recipientOrPayer?: string;
  allocatedItems: AllocatedProductItem[];
  notes?: string;
  createdAt: string;
}

// ============================================================================
// مدل‌های مدیریت سال مالی شمسی، افتتاحیه، اختتامیه و آرشیو دوره‌های مالی
// ============================================================================

export type FiscalYearStatus = 'open' | 'closed';

export interface FiscalYearArchiveSnapshot {
  capturedAt: string;
  capturedBy: string;
  summary: {
    netSales: number;
    cogs: number;
    grossProfit: number;
    totalExpenses: number;
    otherIncome: number;
    netProfit: number;
    totalAssets: number;
    totalLiabilities: number;
    totalEquity: number;
    cashAndBankBalance: number;
    accountsReceivable: number;
    notesReceivable: number;
    inventoryValuation: number;
    accountsPayable: number;
    notesPayable: number;
    invoicesCount: number;
    vouchersCount: number;
  };
  personBalances: {
    personId: string;
    code: string;
    name: string;
    personType: PersonType;
    balance: number; // مثبت = بدهکار، منفی = بستانکار
  }[];
  treasuryBalances: {
    accountId: string;
    title: string;
    type: 'cash' | 'bank' | 'pos';
    balance: number;
  }[];
  inventoryBalances: {
    productId: string;
    code: string;
    name: string;
    unitName: string;
    quantity: number;
    unitCost: number;
    totalValuation: number;
  }[];
  pendingCheques: {
    chequeId: string;
    chequeNumber: string;
    chequeType: 'received' | 'issued';
    personName: string;
    bankName: string;
    dueDate: string;
    amount: number;
    status: ChequeStatus;
  }[];
  vouchers: AccountingVoucher[];
  invoices: Invoice[];
}

export interface FiscalYear {
  id: string;
  code: string; // e.g., '1402', '1403', '1404'
  title: string; // e.g., 'سال مالی ۱۴۰۳'
  startDate: string; // e.g., '1403/01/01'
  endDate: string; // e.g., '1403/12/29'
  status: FiscalYearStatus;
  isClosed: boolean;
  isActive: boolean;
  isLeapYear?: boolean;
  description?: string;
  previousFiscalYearId?: string;
  nextFiscalYearId?: string;
  openingVoucherId?: string;
  openingVoucherNumber?: string;
  closingTemporaryVoucherId?: string;
  closingTemporaryVoucherNumber?: string;
  closingPermanentVoucherId?: string;
  closingPermanentVoucherNumber?: string;
  closedAt?: string;
  closedBy?: string;
  reopenedAt?: string;
  reopenedBy?: string;
  reopenReason?: string;
  archivedSnapshot?: FiscalYearArchiveSnapshot;
  auditTrail: OperationAuditEntry[];
  createdBy: string;
  createdAt: string;
}

export interface OpeningBalancePayload {
  fiscalYearId: string;
  date?: string;
  description?: string;
  treasuryBalances: {
    accountId: string;
    amount: number;
  }[];
  personBalances: {
    personId: string;
    balance: number; // مثبت: بدهکار به ما (103) | منفی: بستانکار از ما (201)
  }[];
  inventoryBalances: {
    productId: string;
    warehouseId?: string;
    quantity: number;
    unitPurchasePrice: number;
  }[];
  initialCapital?: number; // اگر وارد نشود، به صورت خودکار از مابه‌التفات دارایی‌ها و بدهی‌ها محاسبه و تراز می‌شود
}

export interface FiscalPreCheckItem {
  id: string;
  category: 'unposted_docs' | 'voucher_equilibrium' | 'persons' | 'treasury_cheques' | 'inventory';
  categoryLabel: string;
  title: string;
  severity: 'ok' | 'warning' | 'blocking_error';
  passed: boolean;
  blocking: boolean;
  expectedValue: string;
  actualValue: string;
  description: string;
  affectedItems?: {
    id: string;
    code: string;
    title: string;
    amountOrQty: string;
    statusLabel: string;
  }[];
}

export interface FiscalPreClosingAudit {
  fiscalYearId: string;
  fiscalYearCode: string;
  fiscalYearTitle: string;
  canClose: boolean;
  blockingErrorsCount: number;
  warningsCount: number;
  passedChecksCount: number;
  totalChecksCount: number;
  summary: {
    draftVouchersCount: number;
    draftInvoicesCount: number;
    draftWarehouseDocsCount: number;
    unbalancedVouchersCount: number;
    debtorsCount: number;
    totalReceivables: number;
    creditorsCount: number;
    totalPayables: number;
    cashBalance: number;
    bankBalance: number;
    posBalance: number;
    totalTreasuryBalance: number;
    pendingReceivedChequesCount: number;
    pendingReceivedChequesAmount: number;
    pendingIssuedChequesCount: number;
    pendingIssuedChequesAmount: number;
    totalProductsCount: number;
    negativeStockProductsCount: number;
    totalEndingInventoryValue: number;
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
  checks: FiscalPreCheckItem[];
  previewVouchers: {
    closingTemporaryVoucher: AccountingVoucher;
    closingPermanentVoucher: AccountingVoucher;
    nextYearOpeningVoucher: AccountingVoucher;
  };
}

// ============================================================================
// مدل‌های مدیریت نشست (Session Management)، سیاست‌های امنیتی و ممیزی دسترسی
// ============================================================================

export interface UserSession {
  id: string;
  token?: string;       // فقط هنگام ایجاد نشست به کلاینت داده می‌شود
  maskedToken: string;  // نمایش امن توکن در لیست نشست‌ها
  userId: string;
  username: string;
  fullName: string;
  role: UserRole;
  ipAddress: string;
  userAgent: string;
  deviceLabel: string;
  createdAt: string;
  createdAtMs: number;
  lastActivityAt: string;
  lastActivityMs: number;
  expiresAt: string;
  expiresAtMs: number;
  isActive: boolean;
  isCurrent?: boolean;
  revokedAt?: string;
  revokedBy?: string;
  revokedReason?: string;
}

export interface SecurityPolicyConfig {
  sessionTimeoutMinutes: number;
  maxFailedLoginAttempts: number;
  lockoutDurationMinutes: number;
  minPasswordLength: number;
  requireMixedCaseAndNumbers: boolean;
  enforceBackendRbac: boolean;
  maskConfidentialPricesForUnauthorized: boolean;
  logAllPrintAndExportActions: boolean;
  blockSqlAndXssPayloads: boolean;
  allowConcurrentSessions: boolean;
  updatedAt: string;
  updatedBy: string;
}

export interface SecurityCheckSummary {
  overallScore: number;
  activeUsersCount: number;
  lockedUsersCount: number;
  activeSessionsCount: number;
  revokedSessionsCount: number;
  totalAuditLogsCount: number;
  failedLoginsCount: number;
  unauthorizedAttemptsCount: number;
  sensitiveOperationsCount: number;
  blockedPayloadsCount: number;
  checks: {
    id: string;
    title: string;
    category: 'session' | 'validation' | 'confidentiality' | 'rbac_backend' | 'audit';
    status: 'secure' | 'warning';
    description: string;
  }[];
}

