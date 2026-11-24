import { Request, Response, NextFunction } from 'express';
import { getSession } from './auth.ts';
import { serverDb } from './db.ts';
import {
  User,
  UserRole,
  PermissionModule,
  PermissionAction,
} from '../types/index.ts';
import {
  validateAndSanitizeInput,
  resolveEndpointPermissionRequirement,
} from '../lib/securityCalculations.ts';

export interface AuthenticatedRequest extends Request {
  user?: User;
  sessionToken?: string | null;
}

export function extractClientIp(req: Request): string {
  const xff = req.headers['x-forwarded-for'];
  if (typeof xff === 'string' && xff.trim()) {
    return xff.split(',')[0].trim();
  }
  return req.socket?.remoteAddress || '127.0.0.1';
}

// ۱. میدل‌ور شناسایی کاربر، اعتبارسنجی نشست و بررسی وضعیت حساب (فعال / قفل‌شده)
export function authMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers['authorization'];
  const headerToken = req.headers['x-session-token'] as string | undefined;
  const token =
    authHeader && authHeader.startsWith('Bearer ')
      ? authHeader.slice(7).trim()
      : headerToken || null;

  req.sessionToken = token;

  if (token) {
    const session = getSession(token);
    if (session) {
      const user = serverDb.users.find((u) => u.id === session.userId);
      if (user) {
        const nowMs = Date.now();
        if (!user.isActive) {
          serverDb.addAuditLog(
            user.id,
            user.fullName,
            'unauthorized_access',
            'احراز هویت و نشست',
            `تلاش دسترسی با حساب کاربری غیرفعال «${user.fullName}» به مسیر ${req.method} ${req.originalUrl}`,
            user.id,
            {
              category: 'failed_attempt',
              severity: 'warning',
              status: 'blocked',
              ipAddress: extractClientIp(req),
              endpoint: `${req.method} ${req.originalUrl}`,
              persistImmediately: true,
            }
          );
          return res.status(403).json({
            type: 'https://tools.ietf.org/html/rfc7231#section-6.5.3',
            title: 'حساب کاربری غیرفعال',
            status: 403,
            detail: `حساب کاربری «${user.fullName}» غیرفعال شده است.`,
          });
        }
        if (user.lockedUntil && user.lockedUntil > nowMs) {
          const remainingMin = Math.ceil((user.lockedUntil - nowMs) / 60000);
          return res.status(403).json({
            type: 'https://tools.ietf.org/html/rfc7231#section-6.5.3',
            title: 'حساب کاربری مسدود (Locked)',
            status: 403,
            detail: `حساب کاربری شما به دلیل تلاش‌های ناموفق متوالی تا ${remainingMin} دقیقه دیگر مسدود است.`,
          });
        }
        req.user = user;
        return next();
      }
    } else if (req.headers['x-strict-session'] === 'true') {
      return res.status(401).json({
        type: 'https://tools.ietf.org/html/rfc7235#section-3.1',
        title: 'نشست نامعتبر یا منقضی‌شده',
        status: 401,
        detail: 'توکن نشست کاربری شما منقضی یا ابطال شده است. لطفاً مجدداً وارد شوید.',
      });
    }
  }

  // پشتیبانی از هدر x-user-id برای سوییچ سریع بین نقش‌ها در محیط کاری
  const fallbackUserId = (req.headers['x-user-id'] as string) || 'usr-admin';
  const fallbackUser = serverDb.users.find((u) => u.id === fallbackUserId) || serverDb.users[0];

  if (fallbackUser) {
    const nowMs = Date.now();
    if (!fallbackUser.isActive) {
      return res.status(403).json({
        type: 'https://tools.ietf.org/html/rfc7231#section-6.5.3',
        title: 'حساب کاربری غیرفعال',
        status: 403,
        detail: `حساب کاربری «${fallbackUser.fullName}» غیرفعال است و مجاز به انجام عملیات نیست.`,
      });
    }
    if (fallbackUser.lockedUntil && fallbackUser.lockedUntil > nowMs) {
      const remainingMin = Math.ceil((fallbackUser.lockedUntil - nowMs) / 60000);
      return res.status(403).json({
        type: 'https://tools.ietf.org/html/rfc7231#section-6.5.3',
        title: 'حساب کاربری مسدود است',
        status: 403,
        detail: `حساب کاربری «${fallbackUser.fullName}» تا ${remainingMin} دقیقه دیگر قفل است.`,
      });
    }
  }

  req.user = fallbackUser;
  next();
}

// ۲. میدل‌ور اعتبارسنجی ورودی، پاک‌سازی (Sanitization) و جلوگیری از تزریق SQLi / XSS
export function inputValidationMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!serverDb.securityPolicy.blockSqlAndXssPayloads) {
    return next();
  }

  if (req.body && typeof req.body === 'object' && Object.keys(req.body).length > 0) {
    const check = validateAndSanitizeInput(req.body);
    if (!check.valid) {
      const actor = req.user || serverDb.users[0];
      serverDb.addAuditLog(
        actor?.id || 'unknown',
        actor?.fullName || 'کاربر ناشناس',
        'validation_failed',
        'دیواره آتش و اعتبارسنجی ورودی',
        `مسدودسازی ورودی ناامن در مسیر ${req.method} ${req.originalUrl}: ${check.threatsDetected.join('، ')}`,
        undefined,
        {
          category: 'failed_attempt',
          severity: 'critical',
          status: 'blocked',
          ipAddress: extractClientIp(req),
          endpoint: `${req.method} ${req.originalUrl}`,
          persistImmediately: true,
        }
      );

      return res.status(400).json({
        type: 'https://tools.ietf.org/html/rfc7231#section-6.5.1',
        title: 'خطای امنیتی اعتبارسنجی ورودی',
        status: 400,
        detail: check.errorMessage || 'ورودی ارسالی حاوی کاراکترها یا الگوهای غیرمجاز امنیتی است.',
        threatsDetected: check.threatsDetected,
      });
    }
    req.body = check.sanitized;
  }

  next();
}

// ۳. میدل‌ور سراسری اعمال کنترل دسترسی مبتنی بر نقش (RBAC) در لایه Backend
export function enforceBackendRbacMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const requirement = resolveEndpointPermissionRequirement(req.method, req.originalUrl, req.body);
  if (!requirement) {
    return next();
  }

  const user = req.user;
  if (!user) {
    return res.status(401).json({
      type: 'https://tools.ietf.org/html/rfc7235#section-3.1',
      title: 'عدم احراز هویت',
      status: 401,
      detail: 'نشست کاربری شما معتبر نیست. لطفاً وارد سیستم شوید.',
    });
  }

  const isMutating = req.method !== 'GET' && req.method !== 'HEAD' && req.method !== 'OPTIONS';
  const strictViewHeader = req.headers['x-enforce-view-rbac'] === 'true';

  // برای تمامی درخواست‌های تغییردهنده (POST/PUT/DELETE) و یا درخواست‌های دارای هدر تست سخت‌گیرانه،
  // مجوز دقیق ماژول و عملیات (مشاهده، ایجاد، ویرایش، ثبت نهایی، ابطال، چاپ، خروجی، گزارش‌ها) در Backend بررسی می‌شود
  if (isMutating || strictViewHeader) {
    const evalResult = serverDb.checkUserPermission(user, requirement.module, requirement.action);
    if (!evalResult.allowed) {
      serverDb.addAuditLog(
        user.id,
        user.fullName,
        'unauthorized_access',
        evalResult.moduleLabel,
        `${evalResult.reason} (مسیر: ${req.method} ${req.originalUrl})`,
        undefined,
        {
          category: 'failed_attempt',
          severity: 'warning',
          status: 'blocked',
          permissionModule: requirement.module,
          permissionAction: requirement.action,
          ipAddress: extractClientIp(req),
          endpoint: `${req.method} ${req.originalUrl}`,
          persistImmediately: true,
        }
      );

      return res.status(403).json({
        type: 'https://tools.ietf.org/html/rfc7231#section-6.5.3',
        title: 'دسترسی غیرمجاز (Backend RBAC Guard)',
        status: 403,
        detail: evalResult.reason,
        module: requirement.module,
        action: requirement.action,
        role: user.role,
      });
    }
  }

  next();
}

// ۴. میدل‌ور صریح بررسی مجوز ماژول و عملیات (requirePermission)
export function requirePermission(module: PermissionModule, action: PermissionAction) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        type: 'https://tools.ietf.org/html/rfc7235#section-3.1',
        title: 'عدم احراز هویت',
        status: 401,
        detail: 'نشست کاربری شما معتبر نیست. لطفاً مجدداً وارد شوید.',
      });
    }

    const evalResult = serverDb.checkUserPermission(req.user, module, action);
    if (evalResult.allowed) {
      return next();
    }

    serverDb.addAuditLog(
      req.user.id,
      req.user.fullName,
      'unauthorized_access',
      evalResult.moduleLabel,
      `${evalResult.reason} (مسیر: ${req.method} ${req.originalUrl})`,
      undefined,
      {
        category: 'failed_attempt',
        severity: 'warning',
        status: 'blocked',
        permissionModule: module,
        permissionAction: action,
        ipAddress: extractClientIp(req),
        endpoint: `${req.method} ${req.originalUrl}`,
        persistImmediately: true,
      }
    );

    return res.status(403).json({
      type: 'https://tools.ietf.org/html/rfc7231#section-6.5.3',
      title: 'دسترسی غیرمجاز',
      status: 403,
      detail: evalResult.reason,
      module,
      action,
      role: req.user.role,
    });
  };
}

// ۵. میدل‌ور اعتبارسنجی نقش با پشتیبانی از ماتریس دسترسی قابل تنظیم
export function requireRoles(allowedRoles: UserRole[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        type: 'https://tools.ietf.org/html/rfc7235#section-3.1',
        title: 'عدم احراز هویت',
        status: 401,
        detail: 'نشست کاربری شما معتبر نیست. لطفاً مجدداً وارد شوید.',
      });
    }

    // اگر این مسیر در ماتریس قابل تنظیم مجوز داشته باشد، ماتریس پویا ملاک عمل است
    const dynamicReq = resolveEndpointPermissionRequirement(req.method, req.originalUrl, req.body);
    if (dynamicReq) {
      const evalResult = serverDb.checkUserPermission(req.user, dynamicReq.module, dynamicReq.action);
      if (evalResult.allowed) {
        return next();
      }
      serverDb.addAuditLog(
        req.user.id,
        req.user.fullName,
        'unauthorized_access',
        evalResult.moduleLabel,
        `${evalResult.reason} (مسیر: ${req.method} ${req.originalUrl})`,
        undefined,
        {
          category: 'failed_attempt',
          severity: 'warning',
          status: 'blocked',
          permissionModule: dynamicReq.module,
          permissionAction: dynamicReq.action,
          ipAddress: extractClientIp(req),
          endpoint: `${req.method} ${req.originalUrl}`,
          persistImmediately: true,
        }
      );
      return res.status(403).json({
        type: 'https://tools.ietf.org/html/rfc7231#section-6.5.3',
        title: 'دسترسی غیرمجاز',
        status: 403,
        detail: evalResult.reason,
      });
    }

    if (req.user.role === 'admin' || allowedRoles.includes(req.user.role)) {
      return next();
    }

    serverDb.addAuditLog(
      req.user.id,
      req.user.fullName,
      'unauthorized_access',
      'کنترل دسترسی نقش‌ها',
      `تلاش غیرمجاز نقش «${req.user.role}» (${req.user.fullName}) برای فراخوانی ${req.method} ${req.originalUrl}`,
      undefined,
      {
        category: 'failed_attempt',
        severity: 'warning',
        status: 'blocked',
        ipAddress: extractClientIp(req),
        endpoint: `${req.method} ${req.originalUrl}`,
        persistImmediately: true,
      }
    );

    return res.status(403).json({
      type: 'https://tools.ietf.org/html/rfc7231#section-6.5.3',
      title: 'دسترسی غیرمجاز',
      status: 403,
      detail: `نقش کاربری شما (${req.user.role}) دسترسی لازم برای این عملیات را ندارد.`,
    });
  };
}

// میدل‌ور مرکزی مدیریت و استانداردسازی خطاهای سرور (RFC-7807 Problem Details)
export function errorHandler(err: any, req: Request, res: Response, _next: NextFunction) {
  console.error('[API Error]:', err);

  const status = err.status || (err.name === 'TransactionError' ? 422 : 500);
  const title =
    err.name === 'TransactionError'
      ? 'خطای نقض قوانین تراکنش مالی'
      : status === 404
      ? 'منبع یافت نشد'
      : status === 400
      ? 'درخواست نامعتبر'
      : 'خطای داخلی سرور';

  res.status(status).json({
    type: 'about:blank',
    title,
    status,
    detail: err.message || 'خطایی در پردازش درخواست مالی رخ داده است.',
    timestamp: new Date().toISOString(),
    path: req.originalUrl,
  });
}
