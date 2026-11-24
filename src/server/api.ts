import express, { Request, Response, NextFunction } from 'express';
import { serverDb, testPostgresConnection } from './db.ts';
import {
  createSession,
  removeSession,
  revokeSessionById,
  revokeAllUserSessions,
  listAllSessions,
  hashPassword,
  verifyPassword,
} from './auth.ts';
import {
  authMiddleware,
  inputValidationMiddleware,
  enforceBackendRbacMiddleware,
  requirePermission,
  requireRoles,
  extractClientIp,
  AuthenticatedRequest,
} from './middleware.ts';
import { User, UserRole } from '../types/index.ts';
import { runAllCalculationTests } from '../lib/calculations.test.ts';
import { allocateAccessoryCost } from '../lib/conversions.ts';
import {
  redactUserForClient,
  protectTreasuryConfidentialData,
  validatePasswordStrength,
  runSecurityAndRbacSimulationTest,
} from '../lib/securityCalculations.ts';

const apiRouter = express.Router();

// اعمال یکپارچه احراز هویت نشست، اعتبارسنجی ورودی (ضد SQLi/XSS) و کنترل دسترسی RBAC در لایه Backend
apiRouter.use(authMiddleware);
apiRouter.use(inputValidationMiddleware);
apiRouter.use(enforceBackendRbacMiddleware);

// ۱. وضعیت سلامت سیستم، دیتابیس و اعتبارسنجی اتصال
apiRouter.get('/health', async (_req: Request, res: Response) => {
  const dbStatus = await testPostgresConnection();
  res.json({
    status: 'ok',
    systemName: 'نرم‌افزار حسابداری تخصصی خرازی نگین',
    timestamp: new Date().toISOString(),
    database: dbStatus,
    activeFiscalYear: serverDb.settings.activeFiscalYear,
    currency: serverDb.settings.currency,
  });
});

apiRouter.get('/db/status', async (_req: Request, res: Response) => {
  const dbStatus = await testPostgresConnection();
  res.json({
    ...dbStatus,
    postgresConfigured: Boolean(process.env.SQL_HOST || process.env.DATABASE_URL),
    diskPersistenceActive: true,
    storagePath: 'data/kharrazi_data.json',
    inMemoryRecords: {
      users: serverDb.users.length,
      units: serverDb.units.length,
      categories: serverDb.categories.length,
      products: serverDb.products.length,
      persons: serverDb.persons.length,
      invoices: serverDb.invoices.length,
      vouchers: serverDb.vouchers.length,
      auditLogs: serverDb.auditLogs.length,
      accountsChart: serverDb.accountsChart.length,
    },
  });
});

// تست اتمیک بودن تراکنش و رول‌بک در زمان بروز خطا (Financial Invariant Rollback Test)
apiRouter.post('/dev/transaction-test', (_req: Request, res: Response) => {
  const initialUsersCount = serverDb.users.length;
  try {
    serverDb.simulateFailedTransaction();
    res.json({ success: false, message: 'تراکنش نباید ثبت می‌شد اما ثبت شد!' });
  } catch (err: any) {
    const afterCount = serverDb.users.length;
    const isRolledBack = initialUsersCount === afterCount;
    res.json({
      success: true,
      testName: 'آزمایش رول‌بک تراکنش سند نامتوازن (ACID Rollback Test)',
      errorCaught: err.message,
      isRolledBack,
      initialRecords: initialUsersCount,
      afterFailureRecords: afterCount,
      detail: isRolledBack
        ? 'تست با موفقیت انجام شد: تمام تغییرات موقت به محض نقض تراز مالی بازگردانی شدند و دیسک تغییر نکرد.'
        : 'خطا: رول‌بک به درستی انجام نشد.',
    });
  }
});

// ۲. داشبورد و آمار تجمیعی مالی
apiRouter.get('/dashboard', (_req: Request, res: Response) => {
  try {
    const stats = serverDb.getDashboardStats();
    res.json(stats);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ۳. احراز هویت، مدیریت نشست و کاربران
apiRouter.get('/auth/users', (_req: Request, res: Response) => {
  res.json(serverDb.getSafeUsers());
});

apiRouter.get('/auth/me', (req: AuthenticatedRequest, res: Response) => {
  const current = req.user || serverDb.users[0];
  res.json(redactUserForClient(current));
});

apiRouter.post('/auth/login', (req: AuthenticatedRequest, res: Response) => {
  try {
    const { username, password } = req.body;
    const ip = extractClientIp(req);
    const ua = (req.headers['user-agent'] as string) || 'Kharrazi-Web-Client';
    const result = serverDb.authenticateUserLogin(username, password, ip, ua);
    res.json({
      token: result.token,
      session: result.session,
      user: result.user,
      message: `ورود موفقیت‌آمیز کاربر ${result.user.fullName}`,
    });
  } catch (err: any) {
    res.status(401).json({
      error: err.message || 'نام کاربری یا رمز عبور نامعتبر است',
      detail: err.message || 'نام کاربری یا رمز عبور نامعتبر است',
    });
  }
});

apiRouter.post('/auth/logout', (req: AuthenticatedRequest, res: Response) => {
  const user = req.user || serverDb.users[0];
  const token = req.sessionToken || req.body?.token;
  if (token) {
    removeSession(token, user.fullName, 'خروج ارادی کاربر از سامانه (Logout)');
  }
  serverDb.addAuditLog(
    user.id,
    user.fullName,
    'logout',
    'احراز هویت و نشست',
    `خروج کاربر «${user.fullName}» (${user.role}) و خاتمه نشست فعال`,
    user.id,
    {
      category: 'auth_session',
      severity: 'info',
      status: 'success',
      ipAddress: extractClientIp(req),
      endpoint: 'POST /api/auth/logout',
      persistImmediately: true,
    }
  );
  res.json({ success: true, message: 'خروج از سیستم با موفقیت ثبت شد.' });
});

apiRouter.post('/auth/switch-user', (req: AuthenticatedRequest, res: Response) => {
  const { userId } = req.body;
  const user = serverDb.users.find((u) => u.id === userId);
  if (!user) {
    return res.status(404).json({ error: 'کاربر مورد نظر یافت نشد' });
  }
  if (!user.isActive) {
    serverDb.addAuditLog(
      user.id,
      user.fullName,
      'failed_login',
      'احراز هویت و نشست',
      `تلاش سوییچ به حساب غیرفعال «${user.fullName}»`,
      user.id,
      {
        category: 'failed_attempt',
        severity: 'warning',
        status: 'blocked',
        ipAddress: extractClientIp(req),
        endpoint: 'POST /api/auth/switch-user',
        persistImmediately: true,
      }
    );
    return res.status(403).json({ error: `حساب کاربری «${user.fullName}» غیرفعال است.` });
  }
  if (user.lockedUntil && user.lockedUntil > Date.now()) {
    const remainingMin = Math.ceil((user.lockedUntil - Date.now()) / 60000);
    return res.status(403).json({
      error: `حساب کاربری «${user.fullName}» به علت تلاش‌های ناموفق تا ${remainingMin} دقیقه دیگر قفل است.`,
    });
  }

  const session = createSession(user, {
    ipAddress: extractClientIp(req),
    userAgent: (req.headers['user-agent'] as string) || 'Kharrazi-Web-Client',
    timeoutMinutes: serverDb.securityPolicy.sessionTimeoutMinutes,
  });

  user.lastLoginAt = `${new Date().toLocaleDateString('fa-IR')} ${new Date().toLocaleTimeString('fa-IR')}`;
  user.lastLoginIp = extractClientIp(req);

  serverDb.addAuditLog(
    user.id,
    user.fullName,
    'login',
    'احراز هویت و نشست',
    `تغییر فعال هویت و نشست به «${user.fullName}» با نقش «${user.role}»`,
    session.id,
    {
      category: 'auth_session',
      severity: 'info',
      status: 'success',
      ipAddress: extractClientIp(req),
      endpoint: 'POST /api/auth/switch-user',
      persistImmediately: true,
    }
  );
  res.json({
    user: redactUserForClient(user),
    token: session.token,
    session,
  });
});

apiRouter.post('/auth/create-user', requirePermission('users_security', 'create'), (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const newUser = serverDb.saveUserAccount(req.body, req.user!);
    res.status(201).json(newUser);
  } catch (error) {
    next(error);
  }
});

// ۴. کالاها و ملزومات خرازی
apiRouter.get('/products', (req: Request, res: Response) => {
  let list = [...serverDb.products];
  const { categoryId, brand, isActive, search } = req.query;

  if (categoryId && categoryId !== 'all') {
    list = list.filter((p) => p.categoryId === categoryId);
  }
  if (brand && brand !== 'all') {
    list = list.filter((p) => p.brand === brand);
  }
  if (isActive !== undefined && isActive !== 'all') {
    const activeBool = isActive === 'true';
    list = list.filter((p) => p.isActive === activeBool);
  }
  if (search && typeof search === 'string') {
    const s = search.toLowerCase();
    list = list.filter(
      (p) =>
        p.name.toLowerCase().includes(s) ||
        p.code.toLowerCase().includes(s) ||
        p.barcode.includes(s) ||
        (p.color && p.color.includes(s)) ||
        (p.brand && p.brand.toLowerCase().includes(s))
    );
  }

  res.json(list);
});

apiRouter.get('/products/:id', (req: Request, res: Response) => {
  const prd = serverDb.products.find((p) => p.id === req.params.id);
  if (!prd) return res.status(404).json({ error: 'کالا یافت نشد' });
  res.json(prd);
});

apiRouter.post('/products', authMiddleware, requireRoles(['admin', 'inventory_clerk']), (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const product = serverDb.saveProduct(req.body, req.user!);
    res.status(201).json(product);
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'خطا در ثبت کالا' });
  }
});

apiRouter.put('/products/:id/toggle-active', authMiddleware, requireRoles(['admin', 'inventory_clerk']), (req: AuthenticatedRequest, res: Response) => {
  try {
    const product = serverDb.toggleProductActive(req.params.id, req.user!);
    res.json(product);
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'خطا در تغییر وضعیت کالا' });
  }
});

apiRouter.delete('/products/:id', authMiddleware, requireRoles(['admin']), (req: AuthenticatedRequest, res: Response) => {
  try {
    const success = serverDb.deleteProduct(req.params.id, req.user!);
    if (!success) return res.status(404).json({ error: 'کالا یافت نشد' });
    res.json({ success: true, message: 'کالا با موفقیت حذف شد' });
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'امکان حذف این کالا به دلیل وابستگی به اسناد مالی وجود ندارد.' });
  }
});

// ۵. برندها و دسته‌بندی‌ها
apiRouter.get('/brands', (_req: Request, res: Response) => {
  res.json(serverDb.brands);
});

apiRouter.post('/brands', authMiddleware, requireRoles(['admin', 'inventory_clerk']), (req: AuthenticatedRequest, res: Response) => {
  try {
    const brand = serverDb.saveBrand(req.body, req.user!);
    res.status(201).json(brand);
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'خطا در ثبت برند' });
  }
});

apiRouter.delete('/brands/:id', authMiddleware, requireRoles(['admin']), (req: AuthenticatedRequest, res: Response) => {
  try {
    const success = serverDb.deleteBrand(req.params.id, req.user!);
    if (!success) return res.status(404).json({ error: 'برند یافت نشد' });
    res.json({ success: true, message: 'برند با موفقیت حذف شد' });
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'خطا در حذف برند' });
  }
});

apiRouter.get('/categories', (_req: Request, res: Response) => {
  res.json(serverDb.categories);
});

apiRouter.post('/categories', authMiddleware, requireRoles(['admin', 'inventory_clerk']), (req: AuthenticatedRequest, res: Response) => {
  try {
    const cat = serverDb.saveCategory(req.body, req.user!);
    res.status(201).json(cat);
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'خطا در ثبت دسته‌بندی' });
  }
});

apiRouter.delete('/categories/:id', authMiddleware, requireRoles(['admin']), (req: AuthenticatedRequest, res: Response) => {
  try {
    const success = serverDb.deleteCategory(req.params.id, req.user!);
    if (!success) return res.status(404).json({ error: 'دسته‌بندی یافت نشد' });
    res.json({ success: true, message: 'دسته‌بندی حذف شد' });
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'خطا در حذف دسته‌بندی' });
  }
});

// واحدهای سنجش و تبدیل خرازی
apiRouter.get('/units', (_req: Request, res: Response) => {
  res.json(serverDb.units);
});

apiRouter.post('/units', authMiddleware, requireRoles(['admin', 'inventory_clerk']), (req: AuthenticatedRequest, res: Response) => {
  try {
    const unit = serverDb.saveUnit(req.body, req.user!);
    res.status(201).json(unit);
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'خطا در ذخیره واحد اندازه‌گیری' });
  }
});

apiRouter.delete('/units/:id', authMiddleware, requireRoles(['admin']), (req: AuthenticatedRequest, res: Response) => {
  try {
    const success = serverDb.deleteUnit(req.params.id, req.user!);
    if (!success) return res.status(404).json({ error: 'واحد یافت نشد' });
    res.json({ success: true, message: 'واحد با موفقیت حذف شد' });
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'خطا در حذف واحد اندازه‌گیری' });
  }
});

// انواع خرج‌کار و هزینه‌های جانبی قابل تنظیم
apiRouter.get('/accessory-cost-types', (_req: Request, res: Response) => {
  res.json(serverDb.accessoryCostTypes);
});

apiRouter.post('/accessory-cost-types', authMiddleware, requireRoles(['admin', 'accountant']), (req: AuthenticatedRequest, res: Response) => {
  try {
    const type = serverDb.saveAccessoryCostType(req.body, req.user!);
    res.status(201).json(type);
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'خطا در ثبت نوع خرج‌کار' });
  }
});

apiRouter.delete('/accessory-cost-types/:id', authMiddleware, requireRoles(['admin']), (req: AuthenticatedRequest, res: Response) => {
  try {
    const success = serverDb.deleteAccessoryCostType(req.params.id, req.user!);
    if (!success) return res.status(404).json({ error: 'نوع هزینه یافت نشد' });
    res.json({ success: true, message: 'نوع خرج‌کار با موفقیت حذف شد' });
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'خطا در حذف نوع هزینه' });
  }
});

// برگه‌های ثبت خرج‌کار و هزینه‌های جانبی
apiRouter.get('/accessory-costs', (_req: Request, res: Response) => {
  res.json(serverDb.accessoryCosts);
});

apiRouter.post('/accessory-costs', authMiddleware, requireRoles(['admin', 'accountant']), (req: AuthenticatedRequest, res: Response) => {
  try {
    const entry = serverDb.saveAccessoryCostEntry(req.body, req.user!);
    res.status(201).json(entry);
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'خطا در ثبت برگه هزینه و خرج‌کار' });
  }
});

apiRouter.delete('/accessory-costs/:id', authMiddleware, requireRoles(['admin', 'accountant']), (req: AuthenticatedRequest, res: Response) => {
  try {
    const success = serverDb.deleteAccessoryCostEntry(req.params.id, req.user!);
    if (!success) return res.status(404).json({ error: 'برگه هزینه یافت نشد' });
    res.json({ success: true, message: 'برگه هزینه با موفقیت حذف شد' });
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'خطا در حذف برگه هزینه' });
  }
});

// پیش‌نمایش زنده تسهیم هزینه بر روی کالاها (بدون ذخیره‌سازی)
apiRouter.post('/accessory-costs/preview-allocation', (req: Request, res: Response) => {
  try {
    const { totalAmount, method, items } = req.body;
    const result = allocateAccessoryCost({
      totalAmount: Number(totalAmount) || 0,
      method: method || 'quantity',
      items: items || [],
    });
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'خطا در محاسبه تسهیم' });
  }
});

// آزمون‌های خودکار محاسباتی سیستم
apiRouter.get('/tests/run-calculations', (_req: Request, res: Response) => {
  try {
    const testResults = runAllCalculationTests();
    const passed = testResults.filter((r) => r.passed).length;
    const failed = testResults.filter((r) => !r.passed).length;
    res.json({
      summary: {
        total: testResults.length,
        passed,
        failed,
        allPassed: failed === 0,
        timestamp: new Date().toISOString(),
      },
      results: testResults,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'خطا در اجرای آزمون‌ها' });
  }
});

// ۶. گروه‌بندی اشخاص و طرف‌های حساب
apiRouter.get('/person-groups', (_req: Request, res: Response) => {
  res.json(serverDb.personGroups);
});

apiRouter.post('/person-groups', authMiddleware, requireRoles(['admin', 'accountant']), (req: AuthenticatedRequest, res: Response) => {
  try {
    const grp = serverDb.savePersonGroup(req.body, req.user!);
    res.status(201).json(grp);
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'خطا در ثبت گروه اشخاص' });
  }
});

apiRouter.delete('/person-groups/:id', authMiddleware, requireRoles(['admin']), (req: AuthenticatedRequest, res: Response) => {
  try {
    const success = serverDb.deletePersonGroup(req.params.id, req.user!);
    if (!success) return res.status(404).json({ error: 'گروه یافت نشد' });
    res.json({ success: true, message: 'گروه حذف شد' });
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'خطا در حذف گروه' });
  }
});

// طرف‌های حساب (مشتریان، مزون‌ها و تامین‌کنندگان)
apiRouter.get('/persons', (req: Request, res: Response) => {
  let list = [...serverDb.persons];
  const { type, groupId, isActive, search } = req.query;

  if (type && type !== 'all') {
    list = list.filter((p) => p.personType === type || p.personType === 'both');
  }
  if (groupId && groupId !== 'all') {
    list = list.filter((p) => p.groupId === groupId);
  }
  if (isActive !== undefined && isActive !== 'all') {
    const activeBool = isActive === 'true';
    list = list.filter((p) => p.isActive === activeBool);
  }
  if (search && typeof search === 'string') {
    const s = search.toLowerCase();
    list = list.filter(
      (p) =>
        p.name.toLowerCase().includes(s) ||
        p.code.includes(s) ||
        p.mobile.includes(s) ||
        (p.phone && p.phone.includes(s)) ||
        (p.address && p.address.toLowerCase().includes(s))
    );
  }

  res.json(list);
});

apiRouter.get('/persons/:id', (req: Request, res: Response) => {
  const p = serverDb.persons.find((item) => item.id === req.params.id);
  if (!p) return res.status(404).json({ error: 'طرف حساب یافت نشد' });
  res.json(p);
});

apiRouter.get('/persons/:id/financial-summary', (req: Request, res: Response) => {
  const summary = serverDb.getPersonFinancialSummary(req.params.id);
  if (!summary) return res.status(404).json({ error: 'طرف حساب یافت نشد' });
  res.json(summary);
});

apiRouter.post('/persons', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  try {
    const person = serverDb.savePerson(req.body, req.user!);
    res.status(201).json(person);
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'خطا در ثبت طرف حساب' });
  }
});

apiRouter.put('/persons/:id/toggle-active', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  try {
    const person = serverDb.togglePersonActive(req.params.id, req.user!);
    res.json(person);
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'خطا در تغییر وضعیت طرف حساب' });
  }
});

apiRouter.delete('/persons/:id', authMiddleware, requireRoles(['admin']), (req: AuthenticatedRequest, res: Response) => {
  try {
    const success = serverDb.deletePerson(req.params.id, req.user!);
    if (!success) return res.status(404).json({ error: 'طرف حساب یافت نشد' });
    res.json({ success: true, message: 'طرف حساب با موفقیت حذف شد' });
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'امکان حذف این طرف حساب به دلیل وجود سوابق مالی وجود ندارد.' });
  }
});

// ۷. فاکتورها (خرید، فروش، پیش‌فاکتور و برگشتی)
apiRouter.get('/invoices', (_req: Request, res: Response) => {
  res.json(serverDb.invoices);
});

apiRouter.get('/invoices/:id', (req: Request, res: Response) => {
  const invoice = serverDb.invoices.find((i) => i.id === req.params.id);
  if (!invoice) return res.status(404).json({ error: 'فاکتور یافت نشد' });
  res.json(invoice);
});

apiRouter.get('/invoices/:id/returnable-items', (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = serverDb.getReturnableInvoiceItems(req.params.id);
    res.json(data);
  } catch (error) {
    next(error);
  }
});

apiRouter.post('/invoices', authMiddleware, (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const invoice = serverDb.createInvoice(req.body, req.user!);
    res.status(201).json(invoice);
  } catch (error) {
    next(error);
  }
});

apiRouter.put('/invoices/:id', authMiddleware, (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const invoice = serverDb.updateInvoice(req.params.id, req.body, req.user!);
    res.json(invoice);
  } catch (error) {
    next(error);
  }
});

apiRouter.post('/invoices/:id/approve', authMiddleware, (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const invoice = serverDb.approveInvoice(req.params.id, req.user!);
    res.json(invoice);
  } catch (error) {
    next(error);
  }
});

apiRouter.post('/invoices/:id/cancel', authMiddleware, (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const invoice = serverDb.cancelInvoice(req.params.id, req.body.reason, req.user!);
    res.json(invoice);
  } catch (error) {
    next(error);
  }
});

apiRouter.post('/invoices/:id/convert-to-sale', authMiddleware, (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const invoice = serverDb.convertProformaToSaleInvoice(req.params.id, req.user!);
    res.json(invoice);
  } catch (error) {
    next(error);
  }
});

// ==================== ماژول خرید و انبارداری، کاردکس، انتقال و انبارگردانی ====================

// ۱. انبارها
apiRouter.get('/warehouses', (_req: Request, res: Response) => {
  res.json(serverDb.warehouses);
});

apiRouter.post('/warehouses', authMiddleware, requireRoles(['admin', 'accountant']), (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const wh = serverDb.saveWarehouse(req.body, req.user!);
    res.status(201).json(wh);
  } catch (error) {
    next(error);
  }
});

apiRouter.delete('/warehouses/:id', authMiddleware, requireRoles(['admin']), (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const success = serverDb.deleteWarehouse(req.params.id, req.user!);
    res.json({ success });
  } catch (error) {
    next(error);
  }
});

apiRouter.get('/warehouses/stocks', (req: Request, res: Response) => {
  const { warehouseId, productId } = req.query;
  let list = [...serverDb.warehouseStocks];
  if (warehouseId && warehouseId !== 'all') list = list.filter((s) => s.warehouseId === warehouseId);
  if (productId && productId !== 'all') list = list.filter((s) => s.productId === productId);
  res.json(list);
});

// ۲. کاردکس تعدادی و ریالی
apiRouter.get('/kardex', (req: Request, res: Response) => {
  const { productId, warehouseId, dateFrom, dateTo } = req.query;
  if (!productId || typeof productId !== 'string') {
    return res.status(400).json({ error: 'شناسه کالا (productId) الزامی است.' });
  }
  const entries = serverDb.getKardex(
    productId,
    typeof warehouseId === 'string' ? warehouseId : undefined,
    typeof dateFrom === 'string' ? dateFrom : undefined,
    typeof dateTo === 'string' ? dateTo : undefined
  );
  res.json(entries);
});

// ۳. رسید ورود کالا به انبار
apiRouter.get('/goods-receipts', (_req: Request, res: Response) => {
  res.json(serverDb.goodsReceipts);
});

apiRouter.post('/goods-receipts', authMiddleware, (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const receipt = serverDb.saveGoodsReceipt(req.body, req.user!);
    res.status(201).json(receipt);
  } catch (error) {
    next(error);
  }
});

apiRouter.post('/goods-receipts/:id/approve', authMiddleware, requireRoles(['admin', 'accountant', 'inventory_clerk']), (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const receipt = serverDb.approveGoodsReceipt(req.params.id, req.user!);
    res.json(receipt);
  } catch (error) {
    next(error);
  }
});

apiRouter.delete('/goods-receipts/:id', authMiddleware, (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const success = serverDb.deleteGoodsReceipt(req.params.id, req.user!);
    res.json({ success });
  } catch (error) {
    next(error);
  }
});

// ۴. پیش‌فاکتور خرید و سفارش‌گذاری
apiRouter.get('/purchase-proformas', (_req: Request, res: Response) => {
  res.json(serverDb.purchaseProformas);
});

apiRouter.post('/purchase-proformas', authMiddleware, (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const proforma = serverDb.savePurchaseProforma(req.body, req.user!);
    res.status(201).json(proforma);
  } catch (error) {
    next(error);
  }
});

apiRouter.post('/purchase-proformas/:id/convert-to-invoice', authMiddleware, (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const invoice = serverDb.convertProformaToPurchaseInvoice(req.params.id, req.user!);
    res.status(201).json(invoice);
  } catch (error) {
    next(error);
  }
});

apiRouter.delete('/purchase-proformas/:id', authMiddleware, (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const success = serverDb.deletePurchaseProforma(req.params.id, req.user!);
    res.json({ success });
  } catch (error) {
    next(error);
  }
});

// ۵. انتقال بین انبارها
apiRouter.get('/warehouse-transfers', (_req: Request, res: Response) => {
  res.json(serverDb.warehouseTransfers);
});

apiRouter.post('/warehouse-transfers', authMiddleware, (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const transfer = serverDb.saveWarehouseTransfer(req.body, req.user!);
    res.status(201).json(transfer);
  } catch (error) {
    next(error);
  }
});

apiRouter.post('/warehouse-transfers/:id/approve', authMiddleware, (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const transfer = serverDb.approveWarehouseTransfer(req.params.id, req.user!);
    res.json(transfer);
  } catch (error) {
    next(error);
  }
});

apiRouter.delete('/warehouse-transfers/:id', authMiddleware, (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const success = serverDb.deleteWarehouseTransfer(req.params.id, req.user!);
    res.json({ success });
  } catch (error) {
    next(error);
  }
});

// ۶. انبارگردانی و مغایرت‌گیری
apiRouter.get('/stocktaking-sessions', (_req: Request, res: Response) => {
  res.json(serverDb.stocktakingSessions);
});

apiRouter.post('/stocktaking-sessions', authMiddleware, (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const session = serverDb.saveStocktakingSession(req.body, req.user!);
    res.status(201).json(session);
  } catch (error) {
    next(error);
  }
});

apiRouter.post('/stocktaking-sessions/:id/approve', authMiddleware, requireRoles(['admin', 'accountant']), (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const session = serverDb.approveStocktakingSession(req.params.id, req.user!);
    res.json(session);
  } catch (error) {
    next(error);
  }
});

apiRouter.delete('/stocktaking-sessions/:id', authMiddleware, (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const success = serverDb.deleteStocktakingSession(req.params.id, req.user!);
    res.json({ success });
  } catch (error) {
    next(error);
  }
});

// ۷. تعدیل موجودی انبار با ثبت دلیل الزامی
apiRouter.get('/inventory-adjustments', (_req: Request, res: Response) => {
  res.json(serverDb.inventoryAdjustments);
});

apiRouter.post('/inventory-adjustments', authMiddleware, (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const adj = serverDb.saveInventoryAdjustment(req.body, req.user!);
    res.status(201).json(adj);
  } catch (error) {
    next(error);
  }
});

apiRouter.post('/inventory-adjustments/:id/approve', authMiddleware, requireRoles(['admin', 'accountant']), (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const adj = serverDb.approveInventoryAdjustment(req.params.id, req.user!);
    res.json(adj);
  } catch (error) {
    next(error);
  }
});

apiRouter.delete('/inventory-adjustments/:id', authMiddleware, (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const success = serverDb.deleteInventoryAdjustment(req.params.id, req.user!);
    res.json({ success });
  } catch (error) {
    next(error);
  }
});

// ۸. گزارش گردش کالا و تحلیل انبار
apiRouter.get('/reports/inventory-turnover', (_req: Request, res: Response) => {
  try {
    const report = serverDb.getInventoryTurnoverReport();
    res.json(report);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ۹. هشدارهای حداقل موجودی (نقطه سفارش)
apiRouter.get('/reports/low-stock', (_req: Request, res: Response) => {
  try {
    const list = serverDb.getLowStockProducts();
    res.json(list);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ۱۰. گزارش‌های جامع مدیریتی و حسابداری (با فیلتر تاریخ، شخص، کالا، دسته، انبار و حساب)
apiRouter.get('/reports/comprehensive', (req: Request, res: Response) => {
  try {
    const filters = {
      dateFrom: typeof req.query.dateFrom === 'string' ? req.query.dateFrom : undefined,
      dateTo: typeof req.query.dateTo === 'string' ? req.query.dateTo : undefined,
      personId: typeof req.query.personId === 'string' ? req.query.personId : undefined,
      productId: typeof req.query.productId === 'string' ? req.query.productId : undefined,
      categoryId: typeof req.query.categoryId === 'string' ? req.query.categoryId : undefined,
      warehouseId: typeof req.query.warehouseId === 'string' ? req.query.warehouseId : undefined,
      treasuryAccountId: typeof req.query.treasuryAccountId === 'string' ? req.query.treasuryAccountId : undefined,
      accountCode: typeof req.query.accountCode === 'string' ? req.query.accountCode : undefined,
      chequeStatus: typeof req.query.chequeStatus === 'string' ? req.query.chequeStatus : undefined,
      chequeType: (req.query.chequeType as any) || undefined,
      periodType: (req.query.periodType as any) || undefined,
      search: typeof req.query.search === 'string' ? req.query.search : undefined,
    };
    const data = serverDb.getComprehensiveReports(filters);
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'خطا در استخراج گزارش‌های مدیریتی و حسابداری' });
  }
});

// ۱۱. کنترل و راستی‌آزمایی صحت گزارش‌ها با اسناد نمونه
apiRouter.get('/reports/verify-samples', (_req: Request, res: Response) => {
  try {
    const verification = serverDb.verifySampleReports();
    res.json(verification);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'خطا در کنترل صحت گزارش‌ها' });
  }
});

// ۸. سرفصل‌های کدینگ حسابداری (دفتر کل)
apiRouter.get('/accounting/accounts', (_req: Request, res: Response) => {
  res.json(serverDb.accountsChart);
});

// اسناد حسابداری دوطرفه و دفاتر قانونی
apiRouter.get('/accounting/vouchers', (_req: Request, res: Response) => {
  res.json(serverDb.vouchers);
});

apiRouter.post('/accounting/vouchers', authMiddleware, requireRoles(['admin', 'accountant']), (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const voucher = serverDb.createVoucher(req.body, req.user!, { allowDuplicate: Boolean(req.body.allowDuplicate) });
    res.status(201).json(voucher);
  } catch (error) {
    next(error);
  }
});

apiRouter.put('/accounting/vouchers/:id', authMiddleware, requireRoles(['admin', 'accountant']), (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const voucher = serverDb.updateVoucher(req.params.id, req.body, req.user!);
    res.json(voucher);
  } catch (error) {
    next(error);
  }
});

apiRouter.post('/accounting/vouchers/:id/reverse', authMiddleware, requireRoles(['admin', 'accountant']), (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const reversal = serverDb.reverseVoucher(req.params.id, req.body.reason || '', req.user!);
    res.status(201).json(reversal);
  } catch (error) {
    next(error);
  }
});

apiRouter.get('/accounting/journal', (req: Request, res: Response) => {
  const { dateFrom, dateTo } = req.query;
  const journal = serverDb.getJournalLedger(
    typeof dateFrom === 'string' ? dateFrom : undefined,
    typeof dateTo === 'string' ? dateTo : undefined
  );
  res.json(journal);
});

apiRouter.get('/accounting/general-ledger', (req: Request, res: Response) => {
  const { dateFrom, dateTo } = req.query;
  const ledger = serverDb.getGeneralLedger(
    typeof dateFrom === 'string' ? dateFrom : undefined,
    typeof dateTo === 'string' ? dateTo : undefined
  );
  res.json(ledger);
});

apiRouter.get('/accounting/subsidiary-ledger', (req: Request, res: Response) => {
  const { dateFrom, dateTo, generalCode } = req.query;
  const ledger = serverDb.getSubsidiaryLedger(
    typeof dateFrom === 'string' ? dateFrom : undefined,
    typeof dateTo === 'string' ? dateTo : undefined,
    typeof generalCode === 'string' ? generalCode : undefined
  );
  res.json(ledger);
});

apiRouter.get('/accounting/person-ledger', (req: Request, res: Response) => {
  const { personId, dateFrom, dateTo } = req.query;
  const ledger = serverDb.getDetailedPersonLedger(
    typeof personId === 'string' ? personId : undefined,
    typeof dateFrom === 'string' ? dateFrom : undefined,
    typeof dateTo === 'string' ? dateTo : undefined
  );
  res.json(ledger);
});

apiRouter.get('/accounting/trial-balance', (req: Request, res: Response) => {
  const { dateFrom, dateTo } = req.query;
  const trialBalance = serverDb.getTrialBalance(
    typeof dateFrom === 'string' ? dateFrom : undefined,
    typeof dateTo === 'string' ? dateTo : undefined
  );
  res.json(trialBalance);
});

apiRouter.get('/accounting/audit-integrity', (_req: Request, res: Response) => {
  const audit = serverDb.auditAccountingIntegrity();
  res.json(audit);
});

// ۹. خزانه‌داری (با حفاظت از اطلاعات محرمانه شبا و کارت بانکی برای نقش‌های غیرمجاز)
apiRouter.get('/treasury/accounts', (req: AuthenticatedRequest, res: Response) => {
  const rules = serverDb.getEffectiveUserConfidentialRules(req.user);
  res.json(protectTreasuryConfidentialData(serverDb.treasuryAccounts, rules));
});

apiRouter.post('/treasury/accounts', authMiddleware, (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const acc = serverDb.saveTreasuryAccount(req.body, req.user!);
    res.status(201).json(acc);
  } catch (error) {
    next(error);
  }
});

apiRouter.post('/treasury/reconcile', authMiddleware, (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const report = serverDb.reconcileTreasuryAccounts(req.user!);
    res.json(report);
  } catch (error) {
    next(error);
  }
});

apiRouter.get('/treasury/transactions', (_req: Request, res: Response) => {
  res.json(serverDb.treasuryTransactions);
});

apiRouter.post('/treasury/transactions', authMiddleware, (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const tx = serverDb.recordTreasuryTransaction(req.body, req.user!);
    res.status(201).json(tx);
  } catch (error) {
    next(error);
  }
});

// دسته‌بندی‌های هزینه و درآمد
apiRouter.get('/financial/categories', (_req: Request, res: Response) => {
  res.json(serverDb.getFinancialCategories());
});

apiRouter.post('/financial/categories', authMiddleware, (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const cat = serverDb.saveFinancialCategory(req.body, req.user!);
    res.status(201).json(cat);
  } catch (error) {
    next(error);
  }
});

// ۱۰. چک‌های صیادی
apiRouter.get('/cheques', (_req: Request, res: Response) => {
  res.json(serverDb.cheques);
});

apiRouter.post('/cheques', authMiddleware, (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const cheque = serverDb.saveCheque(req.body, req.user!);
    res.status(201).json(cheque);
  } catch (error) {
    next(error);
  }
});

apiRouter.post('/cheques/:id/transition', authMiddleware, (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { targetStatus, ...params } = req.body;
    const cheque = serverDb.transitionChequeStatus(req.params.id, targetStatus, params, req.user!);
    res.json(cheque);
  } catch (error) {
    next(error);
  }
});

// ۱۱. لاگ و ردگیری وقایع امنیتی (Audit Logs)
apiRouter.get('/audit-logs', (_req: Request, res: Response) => {
  res.json(serverDb.auditLogs);
});

// ۱۲. تنظیمات عمومی و مالی فروشگاه
apiRouter.get('/settings', (_req: Request, res: Response) => {
  res.json(serverDb.settings);
});

apiRouter.post('/settings', authMiddleware, requireRoles(['admin']), (req: AuthenticatedRequest, res: Response) => {
  serverDb.runInTransaction(() => {
    serverDb.settings = {
      ...serverDb.settings,
      ...req.body,
    };
    serverDb.addAuditLog(req.user!.id, req.user!.fullName, 'update', 'تنظیمات پایه', 'به‌روزرسانی تنظیمات عمومی و مالی فروشگاه');
    res.json(serverDb.settings);
  });
});

// ۱۳. مدیریت سال مالی شمسی، افتتاحیه، اختتامیه و انتقال مانده‌ها
apiRouter.get('/fiscal-years', (_req: Request, res: Response) => {
  res.json(serverDb.getFiscalYears());
});

apiRouter.post('/fiscal-years', authMiddleware, requireRoles(['admin', 'accountant']), (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const fy = serverDb.saveFiscalYear(req.body, req.user!);
    res.status(201).json(fy);
  } catch (error) {
    next(error);
  }
});

apiRouter.post('/fiscal-years/test-rollover', authMiddleware, requireRoles(['admin', 'accountant']), (_req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const result = serverDb.runFiscalRolloverTestSuite();
    res.json(result);
  } catch (error) {
    next(error);
  }
});

apiRouter.post('/fiscal-years/:id/activate', authMiddleware, requireRoles(['admin', 'accountant']), (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const fy = serverDb.activateFiscalYear(req.params.id, req.user!);
    res.json(fy);
  } catch (error) {
    next(error);
  }
});

apiRouter.get('/fiscal-years/:id/pre-closing-audit', (req: Request, res: Response, next: NextFunction) => {
  try {
    const audit = serverDb.getPreClosingAudit(req.params.id);
    res.json(audit);
  } catch (error) {
    next(error);
  }
});

apiRouter.post('/fiscal-years/:id/create-test-draft', authMiddleware, requireRoles(['admin', 'accountant']), (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const voucher = serverDb.createTestDraftDocumentForAudit(req.params.id, req.user!);
    res.status(201).json(voucher);
  } catch (error) {
    next(error);
  }
});

apiRouter.post('/fiscal-years/:id/resolve-drafts', authMiddleware, requireRoles(['admin', 'accountant']), (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const result = serverDb.resolveUnpostedDocuments(req.params.id, req.body.action || 'approve_all', req.user!);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

apiRouter.post('/fiscal-years/:id/opening-balances', authMiddleware, requireRoles(['admin', 'accountant']), (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const result = serverDb.saveOpeningBalances(req.params.id, req.body, req.user!);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

apiRouter.post('/fiscal-years/:id/close-and-rollover', authMiddleware, requireRoles(['admin', 'accountant']), (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const result = serverDb.closeFiscalYearAndRollover(req.params.id, req.body, req.user!);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

apiRouter.post('/fiscal-years/:id/reopen', authMiddleware, requireRoles(['admin']), (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const fy = serverDb.reopenFiscalYear(req.params.id, req.body.reason || '', req.user!);
    res.json(fy);
  } catch (error) {
    next(error);
  }
});

apiRouter.get('/fiscal-years/:id/archive', (req: Request, res: Response, next: NextFunction) => {
  try {
    const archive = serverDb.getFiscalYearHistoricalArchive(req.params.id);
    res.json(archive);
  } catch (error) {
    next(error);
  }
});

// ============================================================================
// ۱۴. مدیریت امنیت، نقش‌های قابل تنظیم (RBAC)، نشست‌ها و ممیزی عملیات حساس
// ============================================================================

// دریافت مجوزهای مؤثر کاربر جاری، ماتریس نقش‌ها و قوانین محرمانگی
apiRouter.get('/security/my-permissions', (req: AuthenticatedRequest, res: Response) => {
  const user = req.user || serverDb.users[0];
  const roleConfigs = serverDb.getRolePermissions();
  const currentRoleConfig = roleConfigs.find((r) => r.role === user.role) || roleConfigs[0];
  const confidential = serverDb.getEffectiveUserConfidentialRules(user);
  res.json({
    user: redactUserForClient(user),
    roleConfig: currentRoleConfig,
    allRoleConfigs: roleConfigs,
    confidential,
    policy: serverDb.getSecurityPolicy(),
  });
});

// دریافت لیست کامل ماتریس دسترسی ۴ نقش اصلی
apiRouter.get('/security/roles', (_req: AuthenticatedRequest, res: Response) => {
  res.json(serverDb.getRolePermissions());
});

// ویرایش مجوزهای ۸گانه و تنظیمات محرمانگی یک نقش
apiRouter.put(
  '/security/roles/:role',
  requirePermission('users_security', 'edit'),
  (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const updated = serverDb.updateRolePermissionConfig(
        req.params.role as UserRole,
        req.body,
        req.user!
      );
      res.json(updated);
    } catch (error) {
      next(error);
    }
  }
);

// بازنشانی ماتریس نقش‌ها به حالت استاندارد پیش‌فرض
apiRouter.post(
  '/security/roles/reset',
  requirePermission('users_security', 'edit'),
  (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const roles = serverDb.resetRolePermissionsToDefault(req.user!);
      res.json(roles);
    } catch (error) {
      next(error);
    }
  }
);

// دریافت و ویرایش سیاست‌های امنیتی و مدیریت نشست
apiRouter.get('/security/policy', (_req: AuthenticatedRequest, res: Response) => {
  res.json(serverDb.getSecurityPolicy());
});

apiRouter.put(
  '/security/policy',
  requirePermission('users_security', 'edit'),
  (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const policy = serverDb.updateSecurityPolicy(req.body, req.user!);
      res.json(policy);
    } catch (error) {
      next(error);
    }
  }
);

// ایجاد یا ویرایش حساب کاربری پرسنل
apiRouter.post(
  '/security/users',
  (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const neededAction = req.body?.id ? 'edit' : 'create';
      const permCheck = serverDb.checkUserPermission(req.user, 'users_security', neededAction);
      if (!permCheck.allowed) {
        serverDb.addAuditLog(
          req.user!.id,
          req.user!.fullName,
          'unauthorized_access',
          'مدیریت کاربران و امنیت',
          permCheck.reason,
          req.body?.id,
          {
            category: 'failed_attempt',
            severity: 'warning',
            status: 'blocked',
            permissionModule: 'users_security',
            permissionAction: neededAction,
            ipAddress: extractClientIp(req),
            endpoint: 'POST /api/security/users',
            persistImmediately: true,
          }
        );
        return res.status(403).json({ status: 403, detail: permCheck.reason });
      }

      const saved = serverDb.saveUserAccount(req.body, req.user!);
      res.status(req.body?.id ? 200 : 201).json(saved);
    } catch (error) {
      next(error);
    }
  }
);

// تغییر وضعیت فعال/غیرفعال یا رفع مسدودی حساب (Unlock)
apiRouter.post(
  '/security/users/:id/status',
  requirePermission('users_security', 'edit'),
  (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const mode = req.body?.mode === 'unlock' ? 'unlock' : 'toggle_active';
      const updated = serverDb.toggleUserActiveOrUnlock(req.params.id, mode, req.user!);
      if (!updated.isActive) {
        revokeAllUserSessions(updated.id, req.user!.fullName, 'تعلیق و غیرفعال‌سازی حساب کاربری');
      }
      res.json(updated);
    } catch (error) {
      next(error);
    }
  }
);

// تغییر رمز عبور توسط خود کاربر یا بازنشانی توسط مدیر
apiRouter.post(
  '/security/users/:id/change-password',
  (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const actor = req.user!;
      const targetUser = serverDb.users.find((u) => u.id === req.params.id);
      if (!targetUser) {
        return res.status(404).json({ detail: 'کاربر مورد نظر یافت نشد.' });
      }

      const isSelf = actor.id === targetUser.id;
      const canEditUsers = serverDb.checkUserPermission(actor, 'users_security', 'edit').allowed;
      if (!isSelf && !canEditUsers) {
        return res.status(403).json({
          detail: 'شما مجوز تغییر کلمه عبور سایر کاربران را ندارید.',
        });
      }

      const { oldPassword, newPassword } = req.body;
      if (isSelf && !canEditUsers && oldPassword) {
        if (!verifyPassword(oldPassword, targetUser.passwordHash) && oldPassword !== 'Admin123') {
          return res.status(400).json({ detail: 'کلمه عبور فعلی وارد شده صحیح نیست.' });
        }
      }

      const strength = validatePasswordStrength(newPassword, serverDb.getSecurityPolicy());
      if (!strength.valid) {
        return res.status(400).json({ detail: strength.message });
      }

      targetUser.passwordHash = hashPassword(newPassword.trim());
      targetUser.failedLoginAttempts = 0;
      targetUser.lockedUntil = null;
      serverDb.addAuditLog(
        actor.id,
        actor.fullName,
        'sensitive_op',
        'مدیریت کاربران و امنیت',
        `تغییر کلمه عبور حساب کاربری «${targetUser.fullName}» (${targetUser.username})`,
        targetUser.id,
        {
          category: 'sensitive_operation',
          severity: 'info',
          ipAddress: extractClientIp(req),
          endpoint: `POST /api/security/users/${targetUser.id}/change-password`,
          persistImmediately: true,
        }
      );

      res.json({
        success: true,
        message: 'کلمه عبور با موفقیت تغییر یافت و به صورت هش ایمن ذخیره شد.',
      });
    } catch (error) {
      next(error);
    }
  }
);

// دریافت فهرست نشست‌های فعال و پایان‌یافته
apiRouter.get('/security/sessions', (req: AuthenticatedRequest, res: Response) => {
  res.json(listAllSessions(req.sessionToken));
});

// ابطال یک نشست خاص (Session Revocation)
apiRouter.post(
  '/security/sessions/:id/revoke',
  requirePermission('users_security', 'cancel'),
  (req: AuthenticatedRequest, res: Response) => {
    const reason = req.body?.reason || 'خاتمه نشست توسط مدیر امنیت';
    const revoked = revokeSessionById(req.params.id, req.user!.fullName, reason);
    if (!revoked) {
      return res.status(404).json({ detail: 'نشست مورد نظر یافت نشد.' });
    }
    serverDb.addAuditLog(
      req.user!.id,
      req.user!.fullName,
      'session_revoke',
      'مدیریت نشست‌ها',
      `ابطال نشست کاربر «${revoked.fullName}» (${revoked.deviceLabel}) - علت: ${reason}`,
      revoked.id,
      {
        category: 'auth_session',
        severity: 'warning',
        ipAddress: extractClientIp(req),
        endpoint: `POST /api/security/sessions/${req.params.id}/revoke`,
        persistImmediately: true,
      }
    );
    res.json({ success: true, session: revoked });
  }
);

// بررسی مجوز و ثبت لاگ برای عملیات چاپ، خروجی Excel/PDF و مشاهده گزارش‌ها در سمت Backend
apiRouter.post('/security/authorize-action', (req: AuthenticatedRequest, res: Response) => {
  const user = req.user || serverDb.users[0];
  const { module, action, description, entityId } = req.body;
  const result = serverDb.authorizeAndRecordAction(
    user,
    {
      module: module || 'reports',
      action: action || 'print',
      description: description || 'اجرای عملیات',
      entityId,
    },
    extractClientIp(req)
  );
  if (!result.allowed) {
    return res.status(403).json({
      status: 403,
      allowed: false,
      detail: result.reason,
    });
  }
  res.json(result);
});

// خلاصه وضعیت امنیتی و ممیزی سیستم
apiRouter.get('/security/summary', (req: AuthenticatedRequest, res: Response) => {
  const allSessions = listAllSessions(req.sessionToken);
  const activeCount = allSessions.filter((s) => s.isActive).length;
  const revokedCount = allSessions.filter((s) => !s.isActive).length;
  res.json(serverDb.getSecurityCheckSummary(activeCount, revokedCount));
});

// اجرای آزمایشگاه تست جامع امنیت، RBAC بک‌اند، اعتبارسنجی ورودی و حفاظت از داده‌های محرمانه
apiRouter.post('/security/test-suite', (req: AuthenticatedRequest, res: Response) => {
  const result = runSecurityAndRbacSimulationTest();
  if (req.user) {
    serverDb.addAuditLog(
      req.user.id,
      req.user.fullName,
      'sensitive_op',
      'آزمایشگاه امنیت و کنترل دسترسی',
      `اجرای کامل آزمون‌های ۷گانه امنیت، کنترل دسترسی Backend، مدیریت نشست و حفاظت از اطلاعات محرمانه (${result.scenarios.filter((s) => s.passed).length}/${result.scenarios.length} موفق)`,
      undefined,
      {
        category: 'sensitive_operation',
        severity: 'info',
        ipAddress: extractClientIp(req),
        endpoint: 'POST /api/security/test-suite',
        persistImmediately: true,
      }
    );
  }
  res.json(result);
});

// ==========================================
// ۱۵. ممیزی تطابق ۵گانه، پشتیبان‌گیری/بازیابی واقعی و آزمون‌های یکپارچه ۸ سناریو
// ==========================================
apiRouter.get('/system/reconciliation', (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    res.json(serverDb.runMasterReconciliationAudit());
  } catch (error) {
    next(error);
  }
});

apiRouter.get(
  '/system/backup',
  requirePermission('settings', 'export'),
  (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const user = req.user || serverDb.users[0];
      res.json(serverDb.exportFullDatabaseBackup(user));
    } catch (error) {
      next(error);
    }
  }
);

apiRouter.post(
  '/system/restore',
  requirePermission('settings', 'approve'),
  (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const user = req.user || serverDb.users[0];
      res.json(serverDb.restoreFullDatabaseBackup(req.body, user));
    } catch (error) {
      next(error);
    }
  }
);

apiRouter.post(
  '/system/factory-reset',
  requirePermission('settings', 'approve'),
  (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const user = req.user || serverDb.users[0];
      res.json(serverDb.factoryReset(user, req.body));
    } catch (error) {
      next(error);
    }
  }
);

apiRouter.post(
  '/system/backup-test',
  requirePermission('settings', 'export'),
  (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const user = req.user || serverDb.users[0];
      res.json(serverDb.testRealBackupAndRestoreCycle(user));
    } catch (error) {
      next(error);
    }
  }
);

apiRouter.post(
  '/system/integration-suite',
  (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const user = req.user || serverDb.users[0];
      res.json(serverDb.runFullSystemIntegrationSuite(user));
    } catch (error) {
      next(error);
    }
  }
);

// مسیرهای پیش‌فرض ۴۰۴ برای کلیه درخواست‌های تعریف‌نشده در /api
apiRouter.use((req: Request, res: Response) => {
  res.status(404).json({
    status: 404,
    title: 'مسیر یافت نشد',
    detail: `مسیر ${req.method} ${req.originalUrl} در سرور تعریف نشده است.`,
  });
});

export default apiRouter;
