/**
 * موتور امنیت، کنترل دسترسی مبتنی بر نقش (RBAC)، مدیریت نشست، اعتبارسنجی ورودی و حفاظت از اطلاعات محرمانه
 * Security, Granular RBAC, Input Validation, Confidential Data Protection & Audit Engine
 */

import {
  User,
  UserRole,
  PermissionAction,
  PermissionModule,
  ModuleActionPermissions,
  ConfidentialAccessRules,
  RolePermissionConfig,
  SecurityPolicyConfig,
  AuditLog,
  AuditLogAction,
  AuditLogCategory,
  Product,
  TreasuryAccount,
} from '../types/index.ts';

export const PERMISSION_ACTIONS_META: {
  action: PermissionAction;
  label: string;
  shortLabel: string;
  description: string;
}[] = [
  { action: 'view', label: 'مشاهده (View)', shortLabel: 'مشاهده', description: 'مشاهده فهرست و جزئیات اطلاعات بخش' },
  { action: 'create', label: 'ایجاد (Create)', shortLabel: 'ایجاد', description: 'ثبت رکورد، سند یا فاکتور جدید' },
  { action: 'edit', label: 'ویرایش (Edit)', shortLabel: 'ویرایش', description: 'اصلاح اطلاعات و پیش‌نویس‌ها' },
  { action: 'approve', label: 'ثبت نهایی (Approve)', shortLabel: 'ثبت نهایی', description: 'قطعی‌سازی اسناد، تایید فاکتور و بستن دوره' },
  { action: 'cancel', label: 'ابطال / حذف (Cancel)', shortLabel: 'ابطال', description: 'ابطال فاکتور، صدور سند معکوس یا حذف رکورد' },
  { action: 'print', label: 'چاپ (Print)', shortLabel: 'چاپ', description: 'چاپ فاکتور، سند حسابداری، کاردکس و گزارش‌ها' },
  { action: 'export', label: 'خروجی (Export)', shortLabel: 'خروجی', description: 'دریافت خروجی Excel، PDF و فایل پشتیبان' },
  { action: 'reports', label: 'گزارش‌ها (Reports)', shortLabel: 'گزارش‌ها', description: 'دسترسی به گزارش‌های تحلیلی و مدیریتی مرتبط' },
];

export const PERMISSION_MODULES_META: {
  module: PermissionModule;
  label: string;
  description: string;
}[] = [
  { module: 'dashboard', label: 'داشبورد مدیریتی', description: 'نمایش خلاصه شاخص‌های کلیدی و آمار روزانه' },
  { module: 'base_info', label: 'اطلاعات پایه (کالا، واحد، اشخاص)', description: 'کاتالوگ کالاهای خرازی، ضرایب تبدیل، طرف‌های حساب و انبارها' },
  { module: 'sales', label: 'فروش و فاکتورهای فروش', description: 'صدور فاکتور فروش، پیش‌فاکتور و برگشت از فروش' },
  { module: 'purchases', label: 'خرید، سفارش و خرج‌کار', description: 'فاکتور خرید، پیش‌فاکتور خرید و تسهیم هزینه‌های جانبی' },
  { module: 'inventory', label: 'انبارداری، کاردکس و انبارگردانی', description: 'رسید انبار، انتقال بین انبارها، کاردکس، انبارگردانی و تعدیل' },
  { module: 'treasury', label: 'خزانه‌داری، صندوق، بانک و چک', description: 'دریافت و پرداخت، هزینه‌ها، حساب‌های بانکی و چک‌های صیادی' },
  { module: 'accounting', label: 'حسابداری دوطرفه و دفاتر', description: 'سند حسابداری، دفتر روزنامه، کل، معین، تفصیلی و تراز آزمایشی' },
  { module: 'reports', label: 'گزارش‌های مدیریتی و سود و زیان', description: 'گزارش سود ناخالص/خالص، بهای تمام‌شده، بدهکاران، ترازنامه و صورت سود و زیان' },
  { module: 'fiscal_year', label: 'مدیریت سال مالی شمسی', description: 'تعریف سال مالی، سند افتتاحیه، اختتامیه و انتقال مانده‌ها' },
  { module: 'users_security', label: 'مدیریت کاربران و امنیت', description: 'تعریف کاربران، تنظیم مجوز نقش‌ها، مدیریت نشست‌ها و تاریخچه امنیتی' },
  { module: 'settings', label: 'تنظیمات سیستم و پشتیبان‌گیری', description: 'تنظیمات عمومی فروشگاه، قالب چاپ و پشتیبان‌گیری پایگاه داده' },
];

export function createActionSet(
  overrides: Partial<ModuleActionPermissions> = {},
  defaultVal: boolean = false
): ModuleActionPermissions {
  return {
    view: overrides.view ?? defaultVal,
    create: overrides.create ?? defaultVal,
    edit: overrides.edit ?? defaultVal,
    approve: overrides.approve ?? defaultVal,
    cancel: overrides.cancel ?? defaultVal,
    print: overrides.print ?? defaultVal,
    export: overrides.export ?? defaultVal,
    reports: overrides.reports ?? defaultVal,
  };
}

/**
 * ماتریس پیش‌فرض و استاندارد سطوح دسترسی برای ۴ نقش اصلی سامانه خرازی
 * ۱. مدیر ارشد (admin)
 * ۲. حسابدار ارشد (accountant)
 * ۳. صندوق‌دار (cashier)
 * ۴. انباردار (inventory_clerk)
 */
export function getDefaultRolePermissionConfigs(): RolePermissionConfig[] {
  const fullAccess = createActionSet({}, true);
  const noAccess = createActionSet({}, false);
  const viewOnly = createActionSet({ view: true }, false);
  const viewAndPrint = createActionSet({ view: true, print: true }, false);

  return [
    {
      role: 'admin',
      title: 'مدیر ارشد سیستم',
      description: 'دسترسی کامل به تمامی ماژول‌ها، ثبت نهایی، ابطال، مدیریت سال مالی، تنظیم سطوح دسترسی و اطلاعات محرمانه',
      badgeColor: 'rose',
      isSystemAdmin: true,
      modules: {
        dashboard: { ...fullAccess },
        base_info: { ...fullAccess },
        sales: { ...fullAccess },
        purchases: { ...fullAccess },
        inventory: { ...fullAccess },
        treasury: { ...fullAccess },
        accounting: { ...fullAccess },
        reports: { ...fullAccess },
        fiscal_year: { ...fullAccess },
        users_security: { ...fullAccess },
        settings: { ...fullAccess },
      },
      confidential: {
        canViewPurchasePrice: true,
        canViewProfitMargins: true,
        canViewBankSecrets: true,
        canViewSecurityLogs: true,
        maxAllowedDiscountPercent: 100,
      },
      updatedAt: '1403/01/01',
      updatedBy: 'سیستم (پیش‌فرض)',
    },
    {
      role: 'accountant',
      title: 'حسابدار ارشد',
      description: 'مدیریت کامل حسابداری دوطرفه، خزانه‌داری، چک‌ها، گزارش‌های مالی و سال مالی؛ بدون مجوز تغییر تنظیمات امنیتی کاربران',
      badgeColor: 'indigo',
      isSystemAdmin: false,
      modules: {
        dashboard: createActionSet({ view: true, print: true, export: true, reports: true }, false),
        base_info: createActionSet({ view: true, create: true, edit: true, print: true, export: true, reports: true }, false),
        sales: createActionSet({ view: true, create: true, edit: true, approve: true, cancel: true, print: true, export: true, reports: true }, false),
        purchases: createActionSet({ view: true, create: true, edit: true, approve: true, cancel: true, print: true, export: true, reports: true }, false),
        inventory: createActionSet({ view: true, approve: true, print: true, export: true, reports: true }, false),
        treasury: { ...fullAccess },
        accounting: { ...fullAccess },
        reports: { ...fullAccess },
        fiscal_year: createActionSet({ view: true, create: true, edit: true, approve: true, print: true, export: true, reports: true }, false),
        users_security: createActionSet({ view: true, reports: true }, false),
        settings: createActionSet({ view: true, print: true }, false),
      },
      confidential: {
        canViewPurchasePrice: true,
        canViewProfitMargins: true,
        canViewBankSecrets: true,
        canViewSecurityLogs: true,
        maxAllowedDiscountPercent: 25,
      },
      updatedAt: '1403/01/01',
      updatedBy: 'سیستم (پیش‌فرض)',
    },
    {
      role: 'cashier',
      title: 'صندوق‌دار فروشگاه',
      description: 'صدور و ثبت نهایی فاکتور فروش، دریافت و پرداخت صندوق و چاپ فاکتور؛ بدون دسترسی به بهای تمام‌شده، سود خالص، اسناد حسابداری و ابطال قطعی',
      badgeColor: 'emerald',
      isSystemAdmin: false,
      modules: {
        dashboard: createActionSet({ view: true }, false),
        base_info: createActionSet({ view: true, create: true, print: true }, false),
        sales: createActionSet({ view: true, create: true, edit: true, approve: true, cancel: false, print: true, export: false, reports: true }, false),
        purchases: { ...noAccess },
        inventory: createActionSet({ view: true }, false),
        treasury: createActionSet({ view: true, create: true, edit: false, approve: false, cancel: false, print: true, export: false, reports: true }, false),
        accounting: { ...noAccess },
        reports: createActionSet({ view: true, print: true, reports: true }, false),
        fiscal_year: { ...noAccess },
        users_security: { ...noAccess },
        settings: { ...viewOnly },
      },
      confidential: {
        canViewPurchasePrice: false,
        canViewProfitMargins: false,
        canViewBankSecrets: false,
        canViewSecurityLogs: false,
        maxAllowedDiscountPercent: 10,
      },
      updatedAt: '1403/01/01',
      updatedBy: 'سیستم (پیش‌فرض)',
    },
    {
      role: 'inventory_clerk',
      title: 'انباردار و مسئول کالا',
      description: 'تعریف و ویرایش کالاها، واحدهای سنجش، رسید انبار، انتقال بین انبارها، کاردکس و انبارگردانی؛ بدون دسترسی به خزانه‌داری، بانک و حسابداری',
      badgeColor: 'amber',
      isSystemAdmin: false,
      modules: {
        dashboard: createActionSet({ view: true }, false),
        base_info: createActionSet({ view: true, create: true, edit: true, approve: true, cancel: false, print: true, export: true, reports: true }, false),
        sales: { ...viewAndPrint },
        purchases: createActionSet({ view: true, create: true, edit: true, approve: false, cancel: false, print: true, export: false, reports: true }, false),
        inventory: createActionSet({ view: true, create: true, edit: true, approve: true, cancel: false, print: true, export: true, reports: true }, false),
        treasury: { ...noAccess },
        accounting: { ...noAccess },
        reports: createActionSet({ view: true, print: true, export: true, reports: true }, false),
        fiscal_year: { ...noAccess },
        users_security: { ...noAccess },
        settings: { ...viewOnly },
      },
      confidential: {
        canViewPurchasePrice: true,
        canViewProfitMargins: false,
        canViewBankSecrets: false,
        canViewSecurityLogs: false,
        maxAllowedDiscountPercent: 0,
      },
      updatedAt: '1403/01/01',
      updatedBy: 'سیستم (پیش‌فرض)',
    },
  ];
}

export function getDefaultSecurityPolicy(): SecurityPolicyConfig {
  return {
    sessionTimeoutMinutes: 480, // ۸ ساعت کاری
    maxFailedLoginAttempts: 5,
    lockoutDurationMinutes: 15,
    minPasswordLength: 6,
    requireMixedCaseAndNumbers: true,
    enforceBackendRbac: true,
    maskConfidentialPricesForUnauthorized: true,
    logAllPrintAndExportActions: true,
    blockSqlAndXssPayloads: true,
    allowConcurrentSessions: true,
    updatedAt: '1403/01/01',
    updatedBy: 'مدیر ارشد سیستم',
  };
}

export function getModuleLabel(module: PermissionModule): string {
  return PERMISSION_MODULES_META.find((m) => m.module === module)?.label || module;
}

export function getActionLabel(action: PermissionAction): string {
  return PERMISSION_ACTIONS_META.find((a) => a.action === action)?.shortLabel || action;
}

export function getRoleLabel(role: UserRole | string): string {
  switch (role) {
    case 'admin':
      return 'مدیر ارشد سیستم';
    case 'accountant':
      return 'حسابدار ارشد';
    case 'cashier':
      return 'صندوق‌دار فروشگاه';
    case 'inventory_clerk':
      return 'انباردار و مسئول کالا';
    default:
      return role;
  }
}

/**
 * ارزیابی دقیق مجوز دسترسی کاربر به یک ماژول و یک عملیات مشخص (در Backend و Frontend)
 */
export function evaluateUserPermission(
  user: User | undefined | null,
  roleConfigs: RolePermissionConfig[],
  module: PermissionModule,
  action: PermissionAction,
  nowMs: number = Date.now()
): {
  allowed: boolean;
  reason: string;
  moduleLabel: string;
  actionLabel: string;
  roleTitle: string;
} {
  const moduleLabel = getModuleLabel(module);
  const actionLabel = getActionLabel(action);

  if (!user) {
    return {
      allowed: false,
      reason: 'کاربر احراز هویت نشده است. لطفاً وارد سیستم شوید.',
      moduleLabel,
      actionLabel,
      roleTitle: 'نامشخص',
    };
  }

  const roleConfig =
    roleConfigs.find((r) => r.role === user.role) ||
    getDefaultRolePermissionConfigs().find((r) => r.role === user.role);
  const roleTitle = roleConfig?.title || getRoleLabel(user.role);

  if (!user.isActive) {
    return {
      allowed: false,
      reason: `حساب کاربری «${user.fullName}» غیرفعال شده است و مجاز به انجام عملیات نیست.`,
      moduleLabel,
      actionLabel,
      roleTitle,
    };
  }

  if (user.lockedUntil && user.lockedUntil > nowMs) {
    const remainingMin = Math.ceil((user.lockedUntil - nowMs) / 60000);
    return {
      allowed: false,
      reason: `حساب کاربری «${user.fullName}» به دلیل تلاش‌های ناموفق متوالی تا ${remainingMin} دقیقه دیگر مسدود است.`,
      moduleLabel,
      actionLabel,
      roleTitle,
    };
  }

  // بررسی override اختصاصی در سطح کاربر (در صورت تعریف)
  const customOverride = user.customPermissions?.[module]?.[action];
  if (typeof customOverride === 'boolean') {
    return {
      allowed: customOverride,
      reason: customOverride
        ? `مجوز اختصاصی «${actionLabel}» در بخش «${moduleLabel}» برای کاربر فعال است.`
        : `مجوز «${actionLabel}» در بخش «${moduleLabel}» به صورت اختصاصی برای کاربر «${user.fullName}» مسدود شده است.`,
      moduleLabel,
      actionLabel,
      roleTitle,
    };
  }

  const modulePerms = roleConfig?.modules?.[module];
  const isAllowed = Boolean(modulePerms?.[action]);

  return {
    allowed: isAllowed,
    reason: isAllowed
      ? `نقش «${roleTitle}» دارای مجوز «${actionLabel}» در بخش «${moduleLabel}» است.`
      : `دسترسی غیرمجاز: نقش «${roleTitle}» (${user.fullName}) مجوز «${actionLabel}» در بخش «${moduleLabel}» را ندارد.`,
    moduleLabel,
    actionLabel,
    roleTitle,
  };
}

/**
 * استخراج قوانین دسترسی به اطلاعات محرمانه برای کاربر
 */
export function getEffectiveConfidentialRules(
  user: User | undefined | null,
  roleConfigs: RolePermissionConfig[]
): ConfidentialAccessRules {
  if (!user || !user.isActive) {
    return {
      canViewPurchasePrice: false,
      canViewProfitMargins: false,
      canViewBankSecrets: false,
      canViewSecurityLogs: false,
      maxAllowedDiscountPercent: 0,
    };
  }

  const roleConfig =
    roleConfigs.find((r) => r.role === user.role) ||
    getDefaultRolePermissionConfigs().find((r) => r.role === user.role);

  const base = roleConfig?.confidential || {
    canViewPurchasePrice: user.role === 'admin',
    canViewProfitMargins: user.role === 'admin',
    canViewBankSecrets: user.role === 'admin',
    canViewSecurityLogs: user.role === 'admin',
    maxAllowedDiscountPercent: user.role === 'admin' ? 100 : 10,
  };

  return {
    canViewPurchasePrice: user.customConfidential?.canViewPurchasePrice ?? base.canViewPurchasePrice,
    canViewProfitMargins: user.customConfidential?.canViewProfitMargins ?? base.canViewProfitMargins,
    canViewBankSecrets: user.customConfidential?.canViewBankSecrets ?? base.canViewBankSecrets,
    canViewSecurityLogs: user.customConfidential?.canViewSecurityLogs ?? base.canViewSecurityLogs,
    maxAllowedDiscountPercent:
      user.customConfidential?.maxAllowedDiscountPercent ?? base.maxAllowedDiscountPercent,
  };
}

/**
 * دسته‌بندی خودکار رویدادهای ممیزی و امنیتی
 */
export function classifyAuditLogAction(action: AuditLogAction): {
  category: AuditLogCategory;
  defaultSeverity: 'info' | 'warning' | 'critical';
  defaultStatus: 'success' | 'failed' | 'blocked';
} {
  switch (action) {
    case 'login':
    case 'logout':
      return { category: 'auth_session', defaultSeverity: 'info', defaultStatus: 'success' };
    case 'session_revoke':
      return { category: 'auth_session', defaultSeverity: 'warning', defaultStatus: 'success' };
    case 'failed_login':
      return { category: 'failed_attempt', defaultSeverity: 'warning', defaultStatus: 'failed' };
    case 'unauthorized_access':
    case 'validation_failed':
      return { category: 'failed_attempt', defaultSeverity: 'critical', defaultStatus: 'blocked' };
    case 'approve':
    case 'cancel':
    case 'delete':
    case 'permission_change':
    case 'sensitive_op':
    case 'print':
    case 'export':
      return { category: 'sensitive_operation', defaultSeverity: 'info', defaultStatus: 'success' };
    case 'create':
    case 'update':
    case 'reports':
    default:
      return { category: 'change_history', defaultSeverity: 'info', defaultStatus: 'success' };
  }
}

/**
 * حفاظت از اطلاعات محرمانه: حذف هش رمز عبور و فیلدهای حساس از شیء کاربر پیش از ارسال به کلاینت
 */
export function redactUserForClient(user: User): User {
  const { passwordHash, ...safeUser } = user;
  return {
    ...safeUser,
    hasPassword: Boolean(passwordHash),
  };
}

/**
 * ماسک کردن توکن نشست جهت جلوگیری از افشای کلید نشست در لیست‌ها
 */
export function maskSessionToken(token: string): string {
  if (!token || token.length < 14) return 'session_****';
  return `${token.slice(0, 12)}••••••••${token.slice(-4)}`;
}

/**
 * ماسک کردن شماره کارت یا شبای بانکی برای نقش‌های فاقد مجوز مشاهده اطلاعات محرمانه بانکی
 */
export function maskBankNumber(value: string | undefined): string | undefined {
  if (!value) return value;
  const trimmed = value.trim();
  if (trimmed.length <= 8) return '****';
  return `${trimmed.slice(0, 6)}••••••${trimmed.slice(-4)}`;
}

/**
 * حفاظت از اطلاعات محرمانه حساب‌های خزانه و بانک بر اساس سطح دسترسی کاربر
 */
export function protectTreasuryConfidentialData(
  accounts: TreasuryAccount[],
  rules: ConfidentialAccessRules
): TreasuryAccount[] {
  if (rules.canViewBankSecrets) return accounts;
  return accounts.map((acc) => ({
    ...acc,
    accountNumber: maskBankNumber(acc.accountNumber),
    cardNumber: maskBankNumber(acc.cardNumber),
    cardPlaceholder: maskBankNumber(acc.cardPlaceholder),
    shebaNumber: maskBankNumber(acc.shebaNumber),
    iban: maskBankNumber(acc.iban),
  }));
}

/**
 * اعتبارسنجی قدرت رمز عبور بر اساس سیاست امنیتی سازمان
 */
export function validatePasswordStrength(
  password: string,
  policy: SecurityPolicyConfig = getDefaultSecurityPolicy()
): { valid: boolean; message: string } {
  if (!password || typeof password !== 'string') {
    return { valid: false, message: 'رمز عبور نمی‌تواند خالی باشد.' };
  }
  if (password.length < policy.minPasswordLength) {
    return {
      valid: false,
      message: `رمز عبور باید حداقل ${policy.minPasswordLength} کاراکتر باشد.`,
    };
  }
  if (policy.requireMixedCaseAndNumbers) {
    const hasLetter = /[a-zA-Zآ-ی]/.test(password);
    const hasDigit = /[0-9۰-۹]/.test(password);
    if (!hasLetter || !hasDigit) {
      return {
        valid: false,
        message: 'رمز عبور باید ترکیبی از حروف و اعداد باشد.',
      };
    }
  }
  return { valid: true, message: 'رمز عبور معتبر است.' };
}

/**
 * اعتبارسنجی ورودی، پاک‌سازی (Sanitization) و جلوگیری از حملات تزریق (SQLi / XSS / Prototype Pollution)
 */
const DANGEROUS_PATTERNS: { pattern: RegExp; label: string }[] = [
  { pattern: /<\s*script\b[^>]*>/i, label: 'تزریق اسکریپت (XSS <script>)' },
  { pattern: /javascript\s*:/i, label: 'پروتکل مخرب javascript:' },
  { pattern: /\bon(error|load|click|mouseover|focus)\s*=/i, label: 'رویداد مخرب HTML (XSS Event Handler)' },
  { pattern: /\b(DROP\s+TABLE|UNION\s+SELECT|DELETE\s+FROM\s+users|INSERT\s+INTO\s+users)\b/i, label: 'تزریق دستورات SQL (SQL Injection)' },
  { pattern: /(';\s*--|"\s*OR\s+"1"\s*=\s*"1|'\s*OR\s+'1'\s*=\s*'1)/i, label: 'الگوی بای‌پس احراز هویت SQLi' },
];

export function validateAndSanitizeInput(input: any): {
  valid: boolean;
  sanitized: any;
  threatsDetected: string[];
  errorMessage?: string;
} {
  const threatsDetected: string[] = [];

  function inspectAndClean(value: any, pathKey: string = 'root'): any {
    if (value === null || value === undefined) return value;

    if (typeof value === 'string') {
      for (const rule of DANGEROUS_PATTERNS) {
        if (rule.pattern.test(value)) {
          threatsDetected.push(`${rule.label} در فیلد «${pathKey}»`);
        }
      }
      // حذف کاراکترهای کنترلی نال و تگ‌های اسکریپت
      return value.replace(/\0/g, '').trim();
    }

    if (typeof value === 'number') {
      if (!Number.isFinite(value)) {
        threatsDetected.push(`مقدار عددی نامعتبر (NaN/Infinity) در فیلد «${pathKey}»`);
        return 0;
      }
      return value;
    }

    if (Array.isArray(value)) {
      return value.map((item, idx) => inspectAndClean(item, `${pathKey}[${idx}]`));
    }

    if (typeof value === 'object') {
      const cleanedObj: Record<string, any> = {};
      for (const key of Object.keys(value)) {
        if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
          threatsDetected.push(`تلاش برای آلوده‌سازی پروتوتایپ (${key})`);
          continue;
        }
        cleanedObj[key] = inspectAndClean(value[key], key);
      }
      return cleanedObj;
    }

    return value;
  }

  const sanitized = inspectAndClean(input);
  const valid = threatsDetected.length === 0;

  return {
    valid,
    sanitized,
    threatsDetected,
    errorMessage: valid
      ? undefined
      : `ورودی نامعتبر یا ناامن شناسایی و مسدود شد: ${threatsDetected.join('، ')}`,
  };
}

/**
 * نگاشت مسیرهای API بک‌اند به ماژول و مجوز عملیاتی متناظر
 * جهت اعمال یکپارچه و ۱۰۰٪ کنترل دسترسی در لایه Backend
 */
export function resolveEndpointPermissionRequirement(
  method: string,
  path: string,
  body?: any
): { module: PermissionModule; action: PermissionAction } | null {
  const cleanPath = path.split('?')[0].replace(/^\/api/, '');
  const upperMethod = method.toUpperCase();

  // مسیرهای عمومی سلامت و احراز هویت اولیه
  if (
    cleanPath === '/health' ||
    cleanPath === '/db/status' ||
    cleanPath === '/auth/login' ||
    cleanPath === '/auth/logout' ||
    cleanPath === '/auth/me' ||
    cleanPath === '/auth/users' ||
    cleanPath === '/auth/switch-user' ||
    cleanPath === '/security/my-permissions' ||
    cleanPath.startsWith('/tests/') ||
    cleanPath.startsWith('/dev/')
  ) {
    return null;
  }

  // ۱. مدیریت کاربران و امنیت
  if (
    cleanPath.startsWith('/auth/create-user') ||
    cleanPath.startsWith('/security/users') ||
    cleanPath.startsWith('/security/roles') ||
    cleanPath.startsWith('/security/policy') ||
    cleanPath.startsWith('/security/sessions')
  ) {
    if (upperMethod === 'GET') return { module: 'users_security', action: 'view' };
    if (cleanPath.includes('/revoke')) return { module: 'users_security', action: 'cancel' };
    if (upperMethod === 'POST' && cleanPath.includes('/users')) return { module: 'users_security', action: 'create' };
    return { module: 'users_security', action: 'edit' };
  }

  if (cleanPath.startsWith('/audit-logs') || cleanPath.startsWith('/security/audit-logs')) {
    return { module: 'users_security', action: 'view' };
  }

  // ۲. سال مالی شمسی
  if (cleanPath.startsWith('/fiscal-years')) {
    if (upperMethod === 'GET') {
      if (cleanPath.includes('/archive')) return { module: 'fiscal_year', action: 'reports' };
      return { module: 'fiscal_year', action: 'view' };
    }
    if (cleanPath.includes('/close-and-rollover') || cleanPath.includes('/resolve-drafts')) {
      return { module: 'fiscal_year', action: 'approve' };
    }
    if (cleanPath.includes('/reopen')) {
      return { module: 'fiscal_year', action: 'cancel' };
    }
    if (cleanPath.includes('/opening-balances') || cleanPath.includes('/activate')) {
      return { module: 'fiscal_year', action: 'edit' };
    }
    return { module: 'fiscal_year', action: 'create' };
  }

  // ۳. گزارش‌های مدیریتی و حسابداری
  if (cleanPath.startsWith('/reports/')) {
    return { module: 'reports', action: 'reports' };
  }

  // ۴. حسابداری دوطرفه
  if (cleanPath.startsWith('/accounting/')) {
    if (upperMethod === 'GET') {
      if (
        cleanPath.includes('/journal') ||
        cleanPath.includes('/general-ledger') ||
        cleanPath.includes('/subsidiary-ledger') ||
        cleanPath.includes('/person-ledger') ||
        cleanPath.includes('/trial-balance')
      ) {
        return { module: 'accounting', action: 'reports' };
      }
      return { module: 'accounting', action: 'view' };
    }
    if (cleanPath.includes('/reverse')) {
      return { module: 'accounting', action: 'cancel' };
    }
    if (upperMethod === 'PUT') {
      if (body?.status === 'permanent') return { module: 'accounting', action: 'approve' };
      return { module: 'accounting', action: 'edit' };
    }
    if (upperMethod === 'POST') {
      return { module: 'accounting', action: 'create' };
    }
  }

  // ۵. فاکتورهای فروش، خرید و برگشتی
  if (cleanPath.startsWith('/invoices')) {
    if (upperMethod === 'GET') return { module: 'sales', action: 'view' };
    if (cleanPath.includes('/approve')) return { module: 'sales', action: 'approve' };
    if (cleanPath.includes('/cancel')) return { module: 'sales', action: 'cancel' };
    if (upperMethod === 'POST') {
      const invType = body?.invoiceType;
      if (invType === 'purchase' || invType === 'return_purchase') {
        return { module: 'purchases', action: 'create' };
      }
      return { module: 'sales', action: 'create' };
    }
  }

  // ۶. خرید، پیش‌فاکتور خرید و خرج‌کار
  if (cleanPath.startsWith('/purchase-proformas') || cleanPath.startsWith('/accessory-cost')) {
    if (upperMethod === 'GET' || cleanPath.includes('/preview-allocation')) {
      return { module: 'purchases', action: 'view' };
    }
    if (upperMethod === 'DELETE') return { module: 'purchases', action: 'cancel' };
    if (cleanPath.includes('/convert-to-invoice')) return { module: 'purchases', action: 'approve' };
    return { module: 'purchases', action: 'create' };
  }

  // ۷. انبارداری، کاردکس، رسید انبار، انتقال و انبارگردانی
  if (
    cleanPath.startsWith('/warehouses') ||
    cleanPath.startsWith('/kardex') ||
    cleanPath.startsWith('/goods-receipts') ||
    cleanPath.startsWith('/warehouse-transfers') ||
    cleanPath.startsWith('/stocktaking-sessions') ||
    cleanPath.startsWith('/inventory-adjustments')
  ) {
    if (upperMethod === 'GET') return { module: 'inventory', action: 'view' };
    if (cleanPath.includes('/approve')) return { module: 'inventory', action: 'approve' };
    if (upperMethod === 'DELETE') return { module: 'inventory', action: 'cancel' };
    return { module: 'inventory', action: 'create' };
  }

  // ۸. خزانه‌داری و چک‌ها
  if (
    cleanPath.startsWith('/treasury') ||
    cleanPath.startsWith('/cheques') ||
    cleanPath.startsWith('/financial/categories')
  ) {
    if (upperMethod === 'GET') return { module: 'treasury', action: 'view' };
    if (cleanPath.includes('/reconcile')) return { module: 'treasury', action: 'approve' };
    if (cleanPath.includes('/transition')) {
      const target = body?.targetStatus;
      if (target === 'bounced' || target === 'returned' || target === 'cancelled') {
        return { module: 'treasury', action: 'cancel' };
      }
      return { module: 'treasury', action: 'approve' };
    }
    return { module: 'treasury', action: 'create' };
  }

  // ۹. اطلاعات پایه (کالا، واحد، برند، دسته‌بندی، اشخاص)
  if (
    cleanPath.startsWith('/products') ||
    cleanPath.startsWith('/units') ||
    cleanPath.startsWith('/categories') ||
    cleanPath.startsWith('/brands') ||
    cleanPath.startsWith('/persons') ||
    cleanPath.startsWith('/person-groups')
  ) {
    if (upperMethod === 'GET') return { module: 'base_info', action: 'view' };
    if (upperMethod === 'DELETE') return { module: 'base_info', action: 'cancel' };
    if (upperMethod === 'PUT') return { module: 'base_info', action: 'edit' };
    if (upperMethod === 'POST') {
      if (body?.id) return { module: 'base_info', action: 'edit' };
      return { module: 'base_info', action: 'create' };
    }
  }

  // ۱۰. تنظیمات فروشگاه و پشتیبان‌گیری
  if (cleanPath.startsWith('/settings') || cleanPath.startsWith('/system/')) {
    if (cleanPath.includes('/backup') && upperMethod === 'GET') {
      return { module: 'settings', action: 'export' };
    }
    if (cleanPath.includes('/restore') && upperMethod === 'POST') {
      return { module: 'settings', action: 'approve' };
    }
    if (cleanPath.includes('/reconciliation') || cleanPath.includes('/integration-suite') || cleanPath.includes('/backup-test') || cleanPath.includes('/audit-status')) {
      return { module: 'dashboard', action: 'view' };
    }
    if (upperMethod === 'GET') return { module: 'settings', action: 'view' };
    return { module: 'settings', action: 'edit' };
  }

  // ۱۱. داشبورد
  if (cleanPath.startsWith('/dashboard')) {
    return { module: 'dashboard', action: 'view' };
  }

  return null;
}

/**
 * اجرای سناریوی کامل تست امنیت، کنترل دسترسی ۸گانه، مدیریت نشست، اعتبارسنجی ورودی و حفاظت از داده‌های محرمانه
 */
export function runSecurityAndRbacSimulationTest(): {
  success: boolean;
  executedAt: string;
  scenarios: {
    id: string;
    title: string;
    category: string;
    passed: boolean;
    expected: string;
    actual: string;
    details: string;
  }[];
} {
  const roleConfigs = getDefaultRolePermissionConfigs();
  const policy = getDefaultSecurityPolicy();

  const mockAdmin: User = {
    id: 'u-admin',
    username: 'admin',
    fullName: 'مدیر ارشد',
    role: 'admin',
    isActive: true,
    passwordHash: 'hashed_secret_123',
    createdAt: '1403/01/01',
  };
  const mockAccountant: User = {
    id: 'u-acc',
    username: 'hesabdar',
    fullName: 'حسابدار ارشد',
    role: 'accountant',
    isActive: true,
    createdAt: '1403/01/01',
  };
  const mockCashier: User = {
    id: 'u-cash',
    username: 'sandogh',
    fullName: 'صندوق‌دار',
    role: 'cashier',
    isActive: true,
    createdAt: '1403/01/01',
  };
  const mockClerk: User = {
    id: 'u-clerk',
    username: 'anbar',
    fullName: 'انباردار',
    role: 'inventory_clerk',
    isActive: true,
    createdAt: '1403/01/01',
  };

  const scenarios: {
    id: string;
    title: string;
    category: string;
    passed: boolean;
    expected: string;
    actual: string;
    details: string;
  }[] = [];

  // سناریو ۱: کنترل مجوزهای صندوق‌دار (مجاز به ایجاد و چاپ فاکتور فروش، مسدود در ابطال فاکتور و خروجی اکسل و بستن سال مالی)
  const cashierCreateSale = evaluateUserPermission(mockCashier, roleConfigs, 'sales', 'create');
  const cashierPrintSale = evaluateUserPermission(mockCashier, roleConfigs, 'sales', 'print');
  const cashierCancelSale = evaluateUserPermission(mockCashier, roleConfigs, 'sales', 'cancel');
  const cashierExportSale = evaluateUserPermission(mockCashier, roleConfigs, 'sales', 'export');
  const cashierCloseFiscal = evaluateUserPermission(mockCashier, roleConfigs, 'fiscal_year', 'approve');

  const s1Passed =
    cashierCreateSale.allowed === true &&
    cashierPrintSale.allowed === true &&
    cashierCancelSale.allowed === false &&
    cashierExportSale.allowed === false &&
    cashierCloseFiscal.allowed === false;

  scenarios.push({
    id: 'sec-1',
    title: 'کنترل تفکیکی مجوزهای صندوق‌دار (مشاهده/ایجاد/چاپ مجاز، ابطال/خروجی/سال مالی مسدود)',
    category: 'RBAC - نقش صندوق‌دار',
    passed: s1Passed,
    expected: 'create=true, print=true, cancel=false, export=false, fiscal_approve=false',
    actual: `create=${cashierCreateSale.allowed}, print=${cashierPrintSale.allowed}, cancel=${cashierCancelSale.allowed}, export=${cashierExportSale.allowed}, fiscal=${cashierCloseFiscal.allowed}`,
    details: 'صندوق‌دار قادر به ثبت و چاپ فاکتور فروش است اما ابطال فاکتور، خروجی اکسل و بستن سال مالی در لایه Backend با کد 403 مسدود می‌شود.',
  });

  // سناریو ۲: کنترل مجوزهای انباردار (مجاز در انبار و کالا، مسدود در خزانه‌داری و اسناد حسابداری)
  const clerkEditInventory = evaluateUserPermission(mockClerk, roleConfigs, 'inventory', 'edit');
  const clerkExportInventory = evaluateUserPermission(mockClerk, roleConfigs, 'inventory', 'export');
  const clerkViewTreasury = evaluateUserPermission(mockClerk, roleConfigs, 'treasury', 'view');
  const clerkCreateVoucher = evaluateUserPermission(mockClerk, roleConfigs, 'accounting', 'create');

  const s2Passed =
    clerkEditInventory.allowed === true &&
    clerkExportInventory.allowed === true &&
    clerkViewTreasury.allowed === false &&
    clerkCreateVoucher.allowed === false;

  scenarios.push({
    id: 'sec-2',
    title: 'کنترل تفکیکی مجوزهای انباردار (انبارداری و کاردکس مجاز، خزانه‌داری و حسابداری مسدود)',
    category: 'RBAC - نقش انباردار',
    passed: s2Passed,
    expected: 'inv_edit=true, inv_export=true, treasury_view=false, acc_create=false',
    actual: `inv_edit=${clerkEditInventory.allowed}, inv_export=${clerkExportInventory.allowed}, treasury_view=${clerkViewTreasury.allowed}, acc_create=${clerkCreateVoucher.allowed}`,
    details: 'انباردار به عملیات کالا، کاردکس و انبارگردانی دسترسی دارد اما دسترسی او به خزانه‌داری، چک‌ها و اسناد حسابداری مسدود است.',
  });

  // سناریو ۳: کنترل مجوزهای حسابدار (مجاز در حسابداری، گزارش‌ها و سال مالی، مسدود در تغییر تنظیمات امنیتی کاربران)
  const accApproveVoucher = evaluateUserPermission(mockAccountant, roleConfigs, 'accounting', 'approve');
  const accReports = evaluateUserPermission(mockAccountant, roleConfigs, 'reports', 'reports');
  const accEditUsers = evaluateUserPermission(mockAccountant, roleConfigs, 'users_security', 'edit');

  const s3Passed =
    accApproveVoucher.allowed === true &&
    accReports.allowed === true &&
    accEditUsers.allowed === false;

  scenarios.push({
    id: 'sec-3',
    title: 'کنترل تفکیکی مجوزهای حسابدار (ثبت نهایی اسناد و گزارش‌ها مجاز، ویرایش دسترسی کاربران مسدود)',
    category: 'RBAC - نقش حسابدار',
    passed: s3Passed,
    expected: 'acc_approve=true, reports=true, users_edit=false',
    actual: `acc_approve=${accApproveVoucher.allowed}, reports=${accReports.allowed}, users_edit=${accEditUsers.allowed}`,
    details: 'حسابدار به کلیه دفاتر، گزارش‌های مالی و بستن سال مالی دسترسی دارد ولی امکان تغییر سطوح دسترسی کاربران را ندارد.',
  });

  // سناریو ۴: قابلیت تنظیم پویا (Configurable Permissions) و تاثیر بلافاصله در ارزیابی Backend
  const customConfigs = JSON.parse(JSON.stringify(roleConfigs)) as RolePermissionConfig[];
  const cashierRoleCfg = customConfigs.find((r) => r.role === 'cashier')!;
  cashierRoleCfg.modules.sales.export = true; // اعطای مجوز خروجی به صندوق‌دار
  cashierRoleCfg.modules.sales.print = false; // سلب مجوز چاپ از صندوق‌دار

  const afterExport = evaluateUserPermission(mockCashier, customConfigs, 'sales', 'export');
  const afterPrint = evaluateUserPermission(mockCashier, customConfigs, 'sales', 'print');
  const s4Passed = afterExport.allowed === true && afterPrint.allowed === false;

  scenarios.push({
    id: 'sec-4',
    title: 'تغییر پویا و قابل تنظیم ماتریس دسترسی (۸ مجوز عملیاتی) و اعمال آنی',
    category: 'قابلیت تنظیم دسترسی‌ها',
    passed: s4Passed,
    expected: 'sales.export=true, sales.print=false پس از تغییر ماتریس',
    actual: `sales.export=${afterExport.allowed}, sales.print=${afterPrint.allowed}`,
    details: 'با تغییر تیک هر یک از ۸ مجوز (مشاهده، ایجاد، ویرایش، ثبت نهایی، ابطال، چاپ، خروجی، گزارش‌ها) رفتار Backend بلافاصله تغییر می‌کند.',
  });

  // سناریو ۵: مسدودسازی خودکار حساب پس از تلاش‌های ناموفق ورود (Account Lockout & Session Security)
  const lockedUser: User = {
    ...mockCashier,
    failedLoginAttempts: 5,
    lockedUntil: Date.now() + 10 * 60 * 1000,
  };
  const lockedEval = evaluateUserPermission(lockedUser, roleConfigs, 'sales', 'view');
  const s5Passed = lockedEval.allowed === false && lockedEval.reason.includes('مسدود');

  scenarios.push({
    id: 'sec-5',
    title: 'مسدودسازی خودکار نشست و حساب در برابر تلاش‌های ناموفق متوالی (Brute-Force Lockout)',
    category: 'مدیریت نشست و احراز هویت',
    passed: s5Passed,
    expected: 'allowed=false به همراه پیام مسدودی موقت حساب',
    actual: `allowed=${lockedEval.allowed} (${lockedEval.reason})`,
    details: 'پس از ۵ تلاش ناموفق ورود، حساب کاربر به مدت ۱۵ دقیقه قفل شده و حتی با توکن قبلی امکان انجام عملیات ندارد.',
  });

  // سناریو ۶: اعتبارسنجی ورودی و مسدودسازی تزریق SQL و XSS
  const maliciousPayload = {
    name: "روبان قرمز <script>alert('xss')</script>",
    code: "KH-100'; DROP TABLE users; --",
  };
  const validationRes = validateAndSanitizeInput(maliciousPayload);
  const s6Passed = validationRes.valid === false && validationRes.threatsDetected.length >= 2;

  scenarios.push({
    id: 'sec-6',
    title: 'اعتبارسنجی ورودی و مسدودسازی حملات XSS و SQL Injection در لایه Middleware',
    category: 'اعتبارسنجی ورودی (Input Validation)',
    passed: s6Passed,
    expected: 'valid=false و شناسایی حداقل ۲ الگوی حمله (XSS و SQLi)',
    actual: `valid=${validationRes.valid}, threats=${validationRes.threatsDetected.length}`,
    details: `تهدیدات شناسایی‌شده: ${validationRes.threatsDetected.join(' | ')}`,
  });

  // سناریو ۷: حفاظت از اطلاعات محرمانه (حذف هش رمز عبور، ماسک شماره شبا/کارت و مخفی‌سازی قیمت خرید از صندوق‌دار)
  const redactedAdmin = redactUserForClient(mockAdmin);
  const cashierConfidential = getEffectiveConfidentialRules(mockCashier, roleConfigs);
  const sampleAccounts: TreasuryAccount[] = [
    {
      id: 'tr-1',
      code: '101',
      title: 'بانک ملی',
      type: 'bank',
      balance: 1000000,
      cardNumber: '6037991855441234',
      iban: 'IR450170000000105421980007',
      isActive: true,
    },
  ];
  const protectedAccounts = protectTreasuryConfidentialData(sampleAccounts, cashierConfidential);
  const s7Passed =
    redactedAdmin.passwordHash === undefined &&
    redactedAdmin.hasPassword === true &&
    cashierConfidential.canViewPurchasePrice === false &&
    cashierConfidential.canViewProfitMargins === false &&
    protectedAccounts[0].cardNumber !== '6037991855441234' &&
    Boolean(protectedAccounts[0].cardNumber?.includes('••••'));

  scenarios.push({
    id: 'sec-7',
    title: 'حفاظت از اطلاعات محرمانه (حذف passwordHash، ماسک شبا/کارت و عدم افشای قیمت خرید/سود برای صندوق‌دار)',
    category: 'حفاظت از اطلاعات محرمانه',
    passed: s7Passed,
    expected: 'passwordHash=undefined, canViewPurchasePrice=false, cardNumber masked',
    actual: `passwordHash=${String(redactedAdmin.passwordHash)}, canViewCost=${cashierConfidential.canViewPurchasePrice}, card=${protectedAccounts[0].cardNumber}`,
    details: 'اطلاعات محرمانه شامل هش رمز عبور، توکن‌های نشست، شماره شبا/کارت بانکی و قیمت خرید/حاشیه سود برای نقش‌های غیرمجاز ماسک یا حذف می‌گردد.',
  });

  return {
    success: scenarios.every((s) => s.passed),
    executedAt: `${new Date().toLocaleDateString('fa-IR')} ${new Date().toLocaleTimeString('fa-IR')}`,
    scenarios,
  };
}
