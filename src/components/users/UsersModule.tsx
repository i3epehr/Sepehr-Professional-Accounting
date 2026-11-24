import React, { useState, useEffect, useMemo } from 'react';
import {
  UserCog,
  Plus,
  Shield,
  ShieldCheck,
  ShieldAlert,
  Key,
  CheckCircle2,
  X,
  UserCheck,
  Lock,
  Unlock,
  LogOut,
  LogIn,
  Activity,
  History,
  AlertTriangle,
  Eye,
  EyeOff,
  RefreshCw,
  Save,
  RotateCcw,
  Monitor,
  FileSpreadsheet,
  Printer,
  Play,
  Terminal,
  Search,
  Edit3,
  Ban,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.tsx';
import { api } from '../../lib/api.ts';
import {
  User,
  UserRole,
  PermissionAction,
  PermissionModule,
  RolePermissionConfig,
  UserSession,
  AuditLog,
  AuditLogCategory,
  SecurityCheckSummary,
  SecurityPolicyConfig,
} from '../../types/index.ts';
import {
  PERMISSION_ACTIONS_META,
  PERMISSION_MODULES_META,
  getRoleLabel,
} from '../../lib/securityCalculations.ts';
import { toPersianDigits } from '../../lib/formatters.ts';
import {
  exportReportToExcelXLS,
  downloadPrintablePdfDocument,
} from '../../lib/reportExports.ts';

type SecurityTab =
  | 'users'
  | 'rbac_matrix'
  | 'sessions_policy'
  | 'audit_trail'
  | 'security_lab';

export const UsersModule: React.FC = () => {
  const {
    users,
    currentUser,
    roleConfigs,
    confidential,
    securityPolicy,
    switchUser,
    loginWithCredentials,
    logoutSession,
    refreshAuthAndPermissions,
    hasPermission,
  } = useAuth();

  const [activeTab, setActiveTab] = useState<SecurityTab>('users');
  const [banner, setBanner] = useState<{
    type: 'success' | 'error' | 'warning';
    message: string;
  } | null>(null);

  // ۱. وضعیت مدیریت کاربران
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [role, setRole] = useState<UserRole>('cashier');
  const [department, setDepartment] = useState('');
  const [mobile, setMobile] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isUserActive, setIsUserActive] = useState(true);
  const [isSubmittingUser, setIsSubmittingUser] = useState(false);

  // فرم تست ورود با رمز عبور (جهت بررسی احراز هویت و قفل خودکار حساب)
  const [loginUsername, setLoginUsername] = useState('sandogh');
  const [loginPassword, setLoginPassword] = useState('Admin123');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // مودال تغییر رمز عبور
  const [passwordModalUser, setPasswordModalUser] = useState<User | null>(null);
  const [newPassValue, setNewPassValue] = useState('');
  const [isSavingPass, setIsSavingPass] = useState(false);

  // ۲. وضعیت ماتریس دسترسی نقش‌ها (RBAC)
  const [selectedRoleForMatrix, setSelectedRoleForMatrix] = useState<UserRole>('cashier');
  const [editableRoleConfigs, setEditableRoleConfigs] = useState<RolePermissionConfig[]>(roleConfigs);
  const [isSavingMatrix, setIsSavingMatrix] = useState(false);

  // ۳. وضعیت نشست‌ها و سیاست‌های امنیتی
  const [sessions, setSessions] = useState<UserSession[]>([]);
  const [editablePolicy, setEditablePolicy] = useState<SecurityPolicyConfig>(securityPolicy);
  const [isSavingPolicy, setIsSavingPolicy] = useState(false);

  // ۴. وضعیت تاریخچه تغییرات و لاگ‌های امنیتی
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [logCategoryFilter, setLogCategoryFilter] = useState<'all' | AuditLogCategory>('all');
  const [logActionFilter, setLogActionFilter] = useState<string>('all');
  const [logSearch, setLogSearch] = useState('');

  // ۵. وضعیت آزمایشگاه تست امنیت و بررسی Backend
  const [securitySummary, setSecuritySummary] = useState<SecurityCheckSummary | null>(null);
  const [testSuiteResult, setTestSuiteResult] = useState<{
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
  } | null>(null);
  const [isRunningSuite, setIsRunningSuite] = useState(false);
  const [probeResponse, setProbeResponse] = useState<{
    title: string;
    status: 'allowed' | 'blocked';
    detail: string;
    timestamp: string;
  } | null>(null);

  useEffect(() => {
    setEditableRoleConfigs(JSON.parse(JSON.stringify(roleConfigs)));
  }, [roleConfigs]);

  useEffect(() => {
    setEditablePolicy({ ...securityPolicy });
  }, [securityPolicy]);

  const loadSecurityData = async () => {
    try {
      const [sessList, logsList, summaryData] = await Promise.all([
        api.getSessions().catch(() => []),
        api.getAuditLogs().catch(() => []),
        api.getSecuritySummary().catch(() => null),
      ]);
      setSessions(sessList);
      setAuditLogs(logsList);
      if (summaryData) setSecuritySummary(summaryData);
    } catch (err) {
      console.error('Failed to load security data:', err);
    }
  };

  useEffect(() => {
    loadSecurityData();
  }, [activeTab, currentUser]);

  const showMessage = (type: 'success' | 'error' | 'warning', message: string) => {
    setBanner({ type, message });
    setTimeout(() => {
      setBanner((prev) => (prev?.message === message ? null : prev));
    }, 6000);
  };

  // باز کردن مودال ایجاد یا ویرایش کاربر
  const openCreateUserModal = () => {
    setEditingUser(null);
    setFullName('');
    setUsername('');
    setRole('cashier');
    setDepartment('فروش و صندوق');
    setMobile('');
    setEmail('');
    setPassword('User1234');
    setIsUserActive(true);
    setIsUserModalOpen(true);
  };

  const openEditUserModal = (u: User) => {
    setEditingUser(u);
    setFullName(u.fullName);
    setUsername(u.username);
    setRole(u.role);
    setDepartment(u.department || '');
    setMobile(u.mobile || '');
    setEmail(u.email || '');
    setPassword('');
    setIsUserActive(u.isActive);
    setIsUserModalOpen(true);
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !fullName.trim()) {
      showMessage('error', 'نام و نام خانوادگی و نام کاربری الزامی هستند.');
      return;
    }

    try {
      setIsSubmittingUser(true);
      const saved = await api.saveUserAccount({
        id: editingUser?.id,
        username: username.trim(),
        fullName: fullName.trim(),
        role,
        department: department.trim(),
        mobile: mobile.trim(),
        email: email.trim(),
        isActive: isUserActive,
        password: password.trim() || undefined,
      });
      await refreshAuthAndPermissions();
      await loadSecurityData();
      setIsUserModalOpen(false);
      showMessage(
        'success',
        editingUser
          ? `اطلاعات کاربر «${saved.fullName}» با موفقیت ویرایش شد.`
          : `کاربر جدید «${saved.fullName}» با موفقیت ایجاد شد.`
      );
    } catch (err: any) {
      showMessage('error', err.message || 'خطا در ذخیره اطلاعات کاربر');
    } finally {
      setIsSubmittingUser(false);
    }
  };

  const handleToggleUserStatus = async (u: User, mode: 'toggle_active' | 'unlock') => {
    try {
      const updated = await api.toggleUserStatusOrUnlock(u.id, mode);
      await refreshAuthAndPermissions();
      await loadSecurityData();
      showMessage(
        'success',
        mode === 'unlock'
          ? `مسدودی حساب کاربری «${updated.fullName}» رفع شد.`
          : `وضعیت حساب «${updated.fullName}» به «${updated.isActive ? 'فعال' : 'غیرفعال'}» تغییر یافت.`
      );
    } catch (err: any) {
      showMessage('error', err.message || 'خطا در تغییر وضعیت حساب کاربری');
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordModalUser) return;
    try {
      setIsSavingPass(true);
      const res = await api.changeUserPassword(passwordModalUser.id, {
        newPassword: newPassValue,
      });
      setPasswordModalUser(null);
      setNewPassValue('');
      await loadSecurityData();
      showMessage('success', res.message);
    } catch (err: any) {
      showMessage('error', err.message || 'خطا در تغییر رمز عبور');
    } finally {
      setIsSavingPass(false);
    }
  };

  const handleCredentialLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsLoggingIn(true);
      await loginWithCredentials(loginUsername, loginPassword);
      await loadSecurityData();
      showMessage('success', `ورود موفق با نام کاربری «${loginUsername}» و ایجاد نشست امن.`);
    } catch (err: any) {
      await refreshAuthAndPermissions();
      await loadSecurityData();
      showMessage('error', err.message || 'خطا در ورود به سیستم');
    } finally {
      setIsLoggingIn(false);
    }
  };

  // تغییر تیک مجوز در ماتریس نقش
  const currentEditingRoleConfig = useMemo(() => {
    return (
      editableRoleConfigs.find((r) => r.role === selectedRoleForMatrix) ||
      editableRoleConfigs[0]
    );
  }, [editableRoleConfigs, selectedRoleForMatrix]);

  const handleTogglePermissionCell = (
    module: PermissionModule,
    action: PermissionAction
  ) => {
    setEditableRoleConfigs((prev) =>
      prev.map((cfg) => {
        if (cfg.role !== selectedRoleForMatrix) return cfg;
        const currentVal = Boolean(cfg.modules[module]?.[action]);
        return {
          ...cfg,
          modules: {
            ...cfg.modules,
            [module]: {
              ...cfg.modules[module],
              [action]: !currentVal,
            },
          },
        };
      })
    );
  };

  const handleToggleAllModuleActions = (module: PermissionModule, value: boolean) => {
    setEditableRoleConfigs((prev) =>
      prev.map((cfg) => {
        if (cfg.role !== selectedRoleForMatrix) return cfg;
        return {
          ...cfg,
          modules: {
            ...cfg.modules,
            [module]: {
              view: value,
              create: value,
              edit: value,
              approve: value,
              cancel: value,
              print: value,
              export: value,
              reports: value,
            },
          },
        };
      })
    );
  };

  const handleChangeConfidentialRule = (
    key: keyof RolePermissionConfig['confidential'],
    value: boolean | number
  ) => {
    setEditableRoleConfigs((prev) =>
      prev.map((cfg) => {
        if (cfg.role !== selectedRoleForMatrix) return cfg;
        return {
          ...cfg,
          confidential: {
            ...cfg.confidential,
            [key]: value,
          },
        };
      })
    );
  };

  const handleSaveRoleMatrix = async () => {
    if (!currentEditingRoleConfig) return;
    try {
      setIsSavingMatrix(true);
      await api.updateRolePermission(selectedRoleForMatrix, currentEditingRoleConfig);
      await refreshAuthAndPermissions();
      await loadSecurityData();
      showMessage(
        'success',
        `ماتریس مجوزهای ۸گانه و تنظیمات محرمانگی نقش «${currentEditingRoleConfig.title}» در Backend ذخیره و فعال شد.`
      );
    } catch (err: any) {
      showMessage('error', err.message || 'خطا در ذخیره ماتریس دسترسی نقش');
    } finally {
      setIsSavingMatrix(false);
    }
  };

  const handleResetRoleMatrix = async () => {
    try {
      setIsSavingMatrix(true);
      const resetConfigs = await api.resetRolePermissions();
      setEditableRoleConfigs(resetConfigs);
      await refreshAuthAndPermissions();
      await loadSecurityData();
      showMessage('success', 'ماتریس مجوزهای هر ۴ نقش به حالت استاندارد اولیه بازنشانی شد.');
    } catch (err: any) {
      showMessage('error', err.message || 'خطا در بازنشانی ماتریس نقش‌ها');
    } finally {
      setIsSavingMatrix(false);
    }
  };

  const handleSavePolicy = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSavingPolicy(true);
      await api.updateSecurityPolicy(editablePolicy);
      await refreshAuthAndPermissions();
      await loadSecurityData();
      showMessage('success', 'سیاست‌های امنیتی، مدیریت نشست و اعتبارسنجی ورودی در سرور ذخیره شد.');
    } catch (err: any) {
      showMessage('error', err.message || 'خطا در ذخیره سیاست‌های امنیتی');
    } finally {
      setIsSavingPolicy(false);
    }
  };

  const handleRevokeSession = async (sessionId: string) => {
    try {
      await api.revokeSession(sessionId, 'خاتمه نشست از پنل مدیریت امنیت');
      await loadSecurityData();
      showMessage('success', 'نشست مورد نظر با موفقیت در سرور ابطال شد.');
    } catch (err: any) {
      showMessage('error', err.message || 'خطا در ابطال نشست');
    }
  };

  // اجرای تست‌های خودکار امنیت و RBAC
  const handleRunSecurityTestSuite = async () => {
    try {
      setIsRunningSuite(true);
      const res = await api.runSecurityTestSuite();
      setTestSuiteResult(res);
      await loadSecurityData();
      showMessage(
        res.success ? 'success' : 'warning',
        `آزمون‌های ۷گانه امنیت و کنترل دسترسی Backend اجرا شد (${toPersianDigits(
          res.scenarios.filter((s) => s.passed).length
        )} از ${toPersianDigits(res.scenarios.length)} موفق).`
      );
    } catch (err: any) {
      showMessage('error', err.message || 'خطا در اجرای تست امنیت');
    } finally {
      setIsRunningSuite(false);
    }
  };

  // شبیه‌ساز زنده درخواست به Backend برای اثبات کنترل دسترسی سمت سرور
  const handleRunLiveBackendProbe = async (
    probeType:
      | 'print_action'
      | 'export_action'
      | 'close_fiscal'
      | 'edit_roles'
      | 'xss_sqli_attack'
  ) => {
    const nowTime = new Date().toLocaleTimeString('fa-IR');
    try {
      if (probeType === 'print_action') {
        const res = await api.authorizeAction({
          module: 'sales',
          action: 'print',
          description: `تست مجوز چاپ فاکتور فروش با نقش «${getRoleLabel(currentUser?.role || '')}»`,
        });
        setProbeResponse({
          title: 'تست مجوز چاپ فاکتور (POST /api/security/authorize-action)',
          status: 'allowed',
          detail: res.reason,
          timestamp: nowTime,
        });
      } else if (probeType === 'export_action') {
        const res = await api.authorizeAction({
          module: 'sales',
          action: 'export',
          description: `تست مجوز خروجی Excel فروش با نقش «${getRoleLabel(currentUser?.role || '')}»`,
        });
        setProbeResponse({
          title: 'تست مجوز خروجی اکسل فروش (POST /api/security/authorize-action)',
          status: 'allowed',
          detail: res.reason,
          timestamp: nowTime,
        });
      } else if (probeType === 'close_fiscal') {
        const res = await api.authorizeAction({
          module: 'fiscal_year',
          action: 'approve',
          description: `تست مجوز بستن سال مالی با نقش «${getRoleLabel(currentUser?.role || '')}»`,
        });
        setProbeResponse({
          title: 'تست مجوز ثبت نهایی و بستن سال مالی (Backend Guard)',
          status: 'allowed',
          detail: res.reason,
          timestamp: nowTime,
        });
      } else if (probeType === 'edit_roles') {
        await api.updateSecurityPolicy(securityPolicy);
        setProbeResponse({
          title: 'تست ویرایش سیاست‌های امنیتی (PUT /api/security/policy)',
          status: 'allowed',
          detail: `درخواست با موفقیت توسط سرور پذیرفته شد (نقش: ${getRoleLabel(currentUser?.role || '')}).`,
          timestamp: nowTime,
        });
      } else if (probeType === 'xss_sqli_attack') {
        await api.saveBrand({
          name: "برند تستی <script>alert('xss')</script> '; DROP TABLE users; --",
        });
        setProbeResponse({
          title: 'ارسال پیلود مخرب XSS + SQL Injection به سرور',
          status: 'allowed',
          detail: 'پیلود عبور کرد!',
          timestamp: nowTime,
        });
      }
      await loadSecurityData();
    } catch (err: any) {
      await loadSecurityData();
      setProbeResponse({
        title:
          probeType === 'xss_sqli_attack'
            ? 'مسدودسازی حمله تزریق SQLi / XSS توسط فایروال Backend (کد 400)'
            : 'مسدودسازی دسترسی غیرمجاز توسط گارد Backend (کد 403 Forbidden)',
        status: 'blocked',
        detail: err.message || 'دسترسی توسط سرور مسدود شد.',
        timestamp: nowTime,
      });
    }
  };

  // فیلتر لاگ‌های امنیتی
  const filteredAuditLogs = useMemo(() => {
    return auditLogs.filter((log) => {
      if (logCategoryFilter !== 'all' && log.category !== logCategoryFilter) {
        return false;
      }
      if (logActionFilter !== 'all' && log.action !== logActionFilter) {
        return false;
      }
      if (logSearch.trim()) {
        const q = logSearch.trim().toLowerCase();
        const match =
          log.description.toLowerCase().includes(q) ||
          log.userName.toLowerCase().includes(q) ||
          (log.username && log.username.toLowerCase().includes(q)) ||
          log.module.toLowerCase().includes(q) ||
          (log.endpoint && log.endpoint.toLowerCase().includes(q)) ||
          (log.ipAddress && log.ipAddress.includes(q));
        if (!match) return false;
      }
      return true;
    });
  }, [auditLogs, logCategoryFilter, logActionFilter, logSearch]);

  const handleExportAuditLogsExcel = () => {
    if (!hasPermission('users_security', 'export') && !hasPermission('reports', 'export')) {
      showMessage('error', 'نقش کاربری شما مجوز دریافت خروجی (Export) را ندارد.');
      return;
    }
    exportReportToExcelXLS({
      filename: 'Security-Audit-Logs-1403',
      reportTitle: 'گزارش جامع تاریخچه تغییرات، ورود و خروج و رویدادهای امنیتی',
      permissionModule: 'users_security',
      columns: [
        { key: 'timestamp', header: 'زمان ثبت' },
        { key: 'userName', header: 'کاربر' },
        { key: 'userRole', header: 'نقش' },
        { key: 'action', header: 'نوع عملیات' },
        { key: 'module', header: 'بخش / ماژول' },
        { key: 'status', header: 'وضعیت' },
        { key: 'ipAddress', header: 'IP' },
        { key: 'description', header: 'شرح کامل رویداد' },
      ],
      rows: filteredAuditLogs.map((l) => ({
        timestamp: l.timestamp,
        userName: l.userName,
        userRole: getRoleLabel(l.userRole || ''),
        action: l.action,
        module: l.module,
        status: l.status === 'blocked' ? 'مسدود (403/400)' : l.status === 'failed' ? 'ناموفق' : 'موفق',
        ipAddress: l.ipAddress || '127.0.0.1',
        description: l.description,
      })),
    });
  };

  const handlePrintAuditLogs = () => {
    if (!hasPermission('users_security', 'print') && !hasPermission('reports', 'print')) {
      showMessage('error', 'نقش کاربری شما مجوز چاپ (Print) را ندارد.');
      return;
    }
    downloadPrintablePdfDocument({
      filename: 'Security-Audit-Report',
      reportTitle: 'گزارش رسمی ممیزی امنیت، تاریخچه تغییرات و نشست‌های کاربری',
      permissionModule: 'users_security',
      columns: [
        { key: 'timestamp', header: 'زمان و تاریخ' },
        { key: 'userName', header: 'کاربر مسئول' },
        { key: 'action', header: 'نوع رویداد' },
        { key: 'module', header: 'ماژول' },
        { key: 'status', header: 'وضعیت' },
        { key: 'description', header: 'شرح عملیات و جزئیات' },
      ],
      rows: filteredAuditLogs.slice(0, 100).map((l) => ({
        timestamp: l.timestamp,
        userName: `${l.userName} (${getRoleLabel(l.userRole || '')})`,
        action: l.action,
        module: l.module,
        status: l.status === 'blocked' ? 'مسدود شده' : l.status === 'failed' ? 'ناموفق' : 'موفق',
        description: l.description,
      })),
    });
  };

  const getRoleBadgeStyle = (r: UserRole | string) => {
    switch (r) {
      case 'admin':
        return 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border-rose-200 dark:border-rose-800';
      case 'accountant':
        return 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800';
      case 'cashier':
        return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800';
      case 'inventory_clerk':
        return 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200 dark:border-amber-800';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  const getAuditActionBadge = (action: AuditLog['action']) => {
    switch (action) {
      case 'create':
        return <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full">ایجاد</span>;
      case 'update':
        return <span className="bg-blue-100 text-blue-800 text-[10px] font-bold px-2 py-0.5 rounded-full">ویرایش</span>;
      case 'delete':
      case 'cancel':
        return <span className="bg-rose-100 text-rose-800 text-[10px] font-bold px-2 py-0.5 rounded-full">ابطال / حذف</span>;
      case 'approve':
        return <span className="bg-indigo-100 text-indigo-800 text-[10px] font-bold px-2 py-0.5 rounded-full">ثبت نهایی</span>;
      case 'print':
        return <span className="bg-cyan-100 text-cyan-800 text-[10px] font-bold px-2 py-0.5 rounded-full">چاپ سند</span>;
      case 'export':
        return <span className="bg-teal-100 text-teal-800 text-[10px] font-bold px-2 py-0.5 rounded-full">خروجی فایل</span>;
      case 'login':
        return <span className="bg-amber-100 text-amber-800 text-[10px] font-bold px-2 py-0.5 rounded-full">ورود به سیستم</span>;
      case 'logout':
      case 'session_revoke':
        return <span className="bg-slate-200 text-slate-800 text-[10px] font-bold px-2 py-0.5 rounded-full">خروج / خاتمه نشست</span>;
      case 'failed_login':
        return <span className="bg-orange-100 text-orange-800 text-[10px] font-bold px-2 py-0.5 rounded-full border border-orange-300">ورود ناموفق</span>;
      case 'unauthorized_access':
        return <span className="bg-rose-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">دسترسی غیرمجاز (403)</span>;
      case 'validation_failed':
        return <span className="bg-purple-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">ورودی مخرب مسدود (400)</span>;
      case 'permission_change':
      case 'sensitive_op':
        return <span className="bg-violet-100 text-violet-800 text-[10px] font-bold px-2 py-0.5 rounded-full">عملیات حساس امنیتی</span>;
      default:
        return <span className="bg-slate-100 text-slate-700 text-[10px] font-bold px-2 py-0.5 rounded-full">{action}</span>;
    }
  };

  return (
    <div className="space-y-5">
      {/* هدر اصلی ماژول امنیت و مدیریت کاربران */}
      <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-sm">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <h2 className="text-base sm:text-lg font-black text-slate-800 dark:text-slate-100">
                امنیت، مدیریت کاربران، نقش‌های قابل تنظیم (RBAC) و ممیزی نشست‌ها
              </h2>
              <span className="text-xs bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 px-2.5 py-0.5 rounded-full font-bold border border-emerald-200 dark:border-emerald-800">
                کنترل ۱۰۰٪ در لایه Backend
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed">
              تنظیم تفکیکی مجوزهای ۸گانه (مشاهده، ایجاد، ویرایش، ثبت نهایی، ابطال، چاپ، خروجی، گزارش‌ها) برای نقش‌های مدیر، حسابدار، صندوق‌دار و انباردار به همراه مدیریت نشست و حفاظت از اطلاعات محرمانه
            </p>
          </div>

          {/* وضعیت کاربر و نشست فعال جاری */}
          {currentUser && (
            <div className="flex items-center gap-3 bg-slate-50 dark:bg-slate-800/70 px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs">
              <div>
                <div className="text-[11px] text-slate-400">نشست فعال جاری شما:</div>
                <div className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5 mt-0.5">
                  <span>{currentUser.fullName}</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full border font-bold ${getRoleBadgeStyle(currentUser.role)}`}>
                    {getRoleLabel(currentUser.role)}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={async () => {
                  await logoutSession();
                  await loadSecurityData();
                  showMessage('warning', 'نشست جاری خاتمه یافت و رویداد خروج (Logout) در لاگ امنیتی ثبت شد.');
                }}
                className="p-2 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 rounded-lg border border-rose-200 dark:border-rose-800 transition cursor-pointer flex items-center gap-1 font-bold"
                title="ثبت خروج از نشست"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>خروج</span>
              </button>
            </div>
          )}
        </div>

        {/* تب‌های ۵گانه ماژول */}
        <div className="flex items-center gap-1.5 mt-5 pt-4 border-t border-slate-100 dark:border-slate-800 overflow-x-auto text-xs font-bold">
          {[
            { id: 'users', label: '۱. کاربران و احراز هویت', icon: UserCog },
            { id: 'rbac_matrix', label: '۲. ماتریس دسترسی نقش‌ها (۸ مجوز)', icon: Shield },
            { id: 'sessions_policy', label: '۳. مدیریت نشست‌ها و سیاست امنیتی', icon: Monitor },
            { id: 'audit_trail', label: '۴. تاریخچه تغییرات، عملیات حساس و خطاها', icon: History },
            { id: 'security_lab', label: '۵. آزمایشگاه تست امنیت و گارد Backend', icon: Terminal },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as SecurityTab)}
                className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl transition whitespace-nowrap cursor-pointer ${
                  isActive
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-700'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* بنر پیام وضعیت */}
      {banner && (
        <div
          className={`p-3.5 rounded-xl border text-xs font-bold flex items-center justify-between ${
            banner.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-200 border-emerald-200 dark:border-emerald-800'
              : banner.type === 'warning'
              ? 'bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-200 border-amber-200 dark:border-amber-800'
              : 'bg-rose-50 dark:bg-rose-950/50 text-rose-800 dark:text-rose-200 border-rose-200 dark:border-rose-800'
          }`}
        >
          <div className="flex items-center gap-2">
            {banner.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
            ) : (
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
            )}
            <span>{banner.message}</span>
          </div>
          <button onClick={() => setBanner(null)} className="p-1 hover:opacity-75 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ===================================================================== */}
      {/* تب ۱: مدیریت کاربران، وضعیت حساب‌ها و تست ورود با رمز عبور */}
      {/* ===================================================================== */}
      {activeTab === 'users' && (
        <div className="space-y-5">
          {/* کارت‌های خلاصه دسترسی کاربر جاری به اطلاعات محرمانه */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
            <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div>
                <div className="text-slate-400 text-[11px]">مشاهده قیمت خرید و بهای تمام‌شده</div>
                <div className="font-black text-sm mt-1 text-slate-800 dark:text-slate-100">
                  {confidential.canViewPurchasePrice ? 'مجاز (قابل رویت)' : 'محرمانه (ماسک‌شده)'}
                </div>
              </div>
              {confidential.canViewPurchasePrice ? (
                <Eye className="w-5 h-5 text-emerald-500" />
              ) : (
                <EyeOff className="w-5 h-5 text-rose-500" />
              )}
            </div>

            <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div>
                <div className="text-slate-400 text-[11px]">مشاهده سود ناخالص و خالص فاکتورها</div>
                <div className="font-black text-sm mt-1 text-slate-800 dark:text-slate-100">
                  {confidential.canViewProfitMargins ? 'مجاز (قابل رویت)' : 'محرمانه (عدم نمایش)'}
                </div>
              </div>
              {confidential.canViewProfitMargins ? (
                <Eye className="w-5 h-5 text-emerald-500" />
              ) : (
                <EyeOff className="w-5 h-5 text-rose-500" />
              )}
            </div>

            <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div>
                <div className="text-slate-400 text-[11px]">شماره شبا و کارت حساب‌های بانکی</div>
                <div className="font-black text-sm mt-1 text-slate-800 dark:text-slate-100">
                  {confidential.canViewBankSecrets ? 'نمایش کامل' : 'ماسک‌شده (••••)'}
                </div>
              </div>
              <Lock className="w-5 h-5 text-indigo-500" />
            </div>

            <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div>
                <div className="text-slate-400 text-[11px]">سقف مجاز تخفیف برای نقش جاری</div>
                <div className="font-black text-sm mt-1 text-indigo-600 dark:text-indigo-400">
                  حداکثر {toPersianDigits(confidential.maxAllowedDiscountPercent)}٪ تخفیف
                </div>
              </div>
              <Shield className="w-5 h-5 text-indigo-500" />
            </div>
          </div>

          {/* جدول کاربران سیستم */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <div>
                <h3 className="font-bold text-sm text-slate-800 dark:text-slate-100">
                  فهرست کاربران و پرسنل سامانه ({toPersianDigits(users.length)} کاربر)
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  هش رمزهای عبور در سرور محافظت شده و هرگز در پاسخ‌های وب‌سرویس افشا نمی‌شوند (رمز پیش‌فرض دمو: <code className="font-mono font-bold">Admin123</code>)
                </p>
              </div>
              <button
                type="button"
                onClick={openCreateUserModal}
                className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>تعریف کاربر جدید</span>
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-bold">
                  <tr>
                    <th className="py-3 px-4">نام و مشخصات کاربر</th>
                    <th className="py-3 px-4">نام کاربری</th>
                    <th className="py-3 px-4">نقش سیستمی</th>
                    <th className="py-3 px-4">واحد سازمانی / تماس</th>
                    <th className="py-3 px-4">آخرین ورود / IP</th>
                    <th className="py-3 px-4 text-center">وضعیت امنیتی</th>
                    <th className="py-3 px-4 text-center">عملیات و سوییچ نقش</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-200">
                  {users.map((u) => {
                    const isCurrent = u.id === currentUser?.id;
                    const isLocked = Boolean(u.lockedUntil && u.lockedUntil > Date.now());
                    return (
                      <tr key={u.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/50 transition">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold text-xs shrink-0">
                              {u.fullName[0]}
                            </div>
                            <div>
                              <div className="font-bold flex items-center gap-1.5">
                                <span>{u.fullName}</span>
                                {isCurrent && (
                                  <span className="text-[10px] bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300 px-2 py-0.2 rounded-full font-bold">
                                    نشست فعال
                                  </span>
                                )}
                              </div>
                              <div className="text-[10px] text-slate-400 font-mono">{u.id}</div>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4 font-mono font-bold">{u.username}</td>
                        <td className="py-3 px-4">
                          <span className={`text-[11px] px-2.5 py-0.5 rounded-full font-bold border ${getRoleBadgeStyle(u.role)}`}>
                            {getRoleLabel(u.role)}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-medium">{u.department || 'فروشگاه'}</div>
                          {u.mobile && (
                            <div className="text-[10px] text-slate-400 font-mono">
                              {toPersianDigits(u.mobile)}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <div className="text-[11px]">{toPersianDigits(u.lastLoginAt || u.createdAt)}</div>
                          <div className="text-[10px] text-slate-400 font-mono">
                            IP: {u.lastLoginIp || '127.0.0.1'}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-center">
                          {isLocked ? (
                            <span className="inline-flex items-center gap-1 text-[10px] bg-rose-100 text-rose-800 px-2.5 py-0.5 rounded-full font-bold border border-rose-300">
                              <Lock className="w-3 h-3" />
                              قفل موقت ({toPersianDigits(u.failedLoginAttempts || 0)} خطا)
                            </span>
                          ) : u.isActive ? (
                            <span className="inline-flex items-center gap-1 text-[10px] bg-emerald-50 text-emerald-700 px-2.5 py-0.5 rounded-full font-bold border border-emerald-200">
                              <CheckCircle2 className="w-3 h-3" />
                              فعال
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] bg-slate-200 text-slate-700 px-2.5 py-0.5 rounded-full font-bold">
                              <Ban className="w-3 h-3" />
                              غیرفعال
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center justify-center gap-1.5 flex-wrap">
                            {!isCurrent && u.isActive && !isLocked && (
                              <button
                                type="button"
                                onClick={async () => {
                                  try {
                                    await switchUser(u.id);
                                    showMessage('success', `نشست فعال به «${u.fullName}» (${getRoleLabel(u.role)}) تغییر یافت.`);
                                  } catch (err: any) {
                                    showMessage('error', err.message);
                                  }
                                }}
                                className="px-2.5 py-1 bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 text-indigo-700 dark:text-indigo-300 rounded-lg text-[11px] font-bold transition cursor-pointer"
                              >
                                سوییچ به این نقش
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() => openEditUserModal(u)}
                              className="p-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 rounded-lg transition cursor-pointer"
                              title="ویرایش مشخصات و نقش کاربر"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setPasswordModalUser(u);
                                setNewPassValue('');
                              }}
                              className="p-1.5 bg-amber-50 dark:bg-amber-950/50 hover:bg-amber-100 text-amber-700 dark:text-amber-300 rounded-lg transition cursor-pointer"
                              title="تغییر / بازنشانی رمز عبور"
                            >
                              <Key className="w-3.5 h-3.5" />
                            </button>

                            {isLocked ? (
                              <button
                                type="button"
                                onClick={() => handleToggleUserStatus(u, 'unlock')}
                                className="px-2 py-1 bg-emerald-600 text-white rounded-lg text-[10px] font-bold cursor-pointer flex items-center gap-1"
                              >
                                <Unlock className="w-3 h-3" />
                                <span>رفع مسدودی</span>
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleToggleUserStatus(u, 'toggle_active')}
                                className={`px-2 py-1 rounded-lg text-[10px] font-bold cursor-pointer ${
                                  u.isActive
                                    ? 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200'
                                    : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200'
                                }`}
                              >
                                {u.isActive ? 'تعلیق' : 'فعال‌سازی'}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* پنل تست احراز هویت با رمز عبور و بررسی قفل خودکار حساب در برابر تلاش‌های ناموفق */}
          <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <h3 className="font-bold text-sm text-slate-800 dark:text-slate-100 flex items-center gap-2">
                  <LogIn className="w-4 h-4 text-indigo-600" />
                  <span>پنل احراز هویت رسمی (ورود با نام کاربری و کلمه عبور + تست قفل خودکار حساب)</span>
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  رمز صحیح پیش‌فرض تمام کاربران <code className="font-mono font-bold text-indigo-600">Admin123</code> است. در صورت وارد کردن رمز اشتباه به تعداد {toPersianDigits(securityPolicy.maxFailedLoginAttempts)} مرتبه، حساب به صورت خودکار قفل شده و در لاگ تلاش‌های ناموفق ثبت می‌گردد.
                </p>
              </div>

              <form onSubmit={handleCredentialLogin} className="flex flex-wrap items-center gap-2 w-full md:w-auto text-xs">
                <select
                  value={loginUsername}
                  onChange={(e) => setLoginUsername(e.target.value)}
                  className="px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold"
                >
                  {users.map((u) => (
                    <option key={u.id} value={u.username}>
                      {u.username} ({u.fullName})
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="کلمه عبور (مثلاً Admin123)"
                  className="px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-mono w-44"
                />
                <button
                  type="submit"
                  disabled={isLoggingIn}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold transition cursor-pointer"
                >
                  {isLoggingIn ? 'در حال بررسی...' : 'ورود و ایجاد نشست'}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* تب ۲: ماتریس دسترسی قابل تنظیم برای ۴ نقش و ۸ مجوز عملیاتی */}
      {/* ===================================================================== */}
      {activeTab === 'rbac_matrix' && currentEditingRoleConfig && (
        <div className="space-y-5">
          {/* نوار انتخاب نقش جهت ویرایش مجوزها */}
          <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <div>
                <h3 className="font-bold text-sm text-slate-800 dark:text-slate-100">
                  تنظیم ماتریس دسترسی نقش‌ها (اعمال مستقیم در لایه Backend و رابط کاربری)
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  هر یک از ۴ نقش زیر را انتخاب کرده و مجوزهای مشاهده، ایجاد، ویرایش، ثبت نهایی، ابطال، چاپ، خروجی و گزارش‌ها را به تفکیک هر بخش تنظیم نمایید.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleResetRoleMatrix}
                  disabled={isSavingMatrix}
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>بازنشانی پیش‌فرض</span>
                </button>
                <button
                  type="button"
                  onClick={handleSaveRoleMatrix}
                  disabled={isSavingMatrix}
                  className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition shadow-sm cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{isSavingMatrix ? 'در حال ذخیره...' : `ذخیره مجوزهای «${currentEditingRoleConfig.title}»`}</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {editableRoleConfigs.map((rc) => {
                const isSelected = rc.role === selectedRoleForMatrix;
                return (
                  <button
                    key={rc.role}
                    type="button"
                    onClick={() => setSelectedRoleForMatrix(rc.role)}
                    className={`p-3.5 rounded-xl border text-right transition cursor-pointer ${
                      isSelected
                        ? 'bg-indigo-50/90 dark:bg-indigo-950/60 border-indigo-500 ring-2 ring-indigo-500/20'
                        : 'bg-slate-50/70 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 hover:border-indigo-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-black text-xs text-slate-800 dark:text-slate-100">
                        {rc.title}
                      </span>
                      <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                        {rc.role}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1.5 line-clamp-2 leading-relaxed">
                      {rc.description}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* جدول ماتریس ۱۱ ماژول در ۸ مجوز عملیاتی */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
            <div className="p-4 bg-slate-50/80 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-indigo-600" />
                <span className="font-bold text-xs text-slate-800 dark:text-slate-100">
                  جدول مجوزهای ۸گانه برای نقش: {currentEditingRoleConfig.title} ({currentEditingRoleConfig.role})
                </span>
              </div>
              <span className="text-[11px] text-slate-500">
                آخرین ویرایش توسط: {currentEditingRoleConfig.updatedBy} ({toPersianDigits(currentEditingRoleConfig.updatedAt)})
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-100/80 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-bold">
                  <tr>
                    <th className="py-3 px-4 min-w-[210px]">بخش / ماژول سامانه</th>
                    {PERMISSION_ACTIONS_META.map((act) => (
                      <th key={act.action} className="py-3 px-2.5 text-center whitespace-nowrap" title={act.description}>
                        <div>{act.shortLabel}</div>
                        <div className="text-[9px] font-mono text-slate-400 font-normal">{act.action}</div>
                      </th>
                    ))}
                    <th className="py-3 px-3 text-center">انتخاب سریع</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {PERMISSION_MODULES_META.map((mod) => {
                    const modPerms = currentEditingRoleConfig.modules[mod.module];
                    return (
                      <tr key={mod.module} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition">
                        <td className="py-3 px-4">
                          <div className="font-bold text-slate-800 dark:text-slate-100">{mod.label}</div>
                          <div className="text-[10px] text-slate-400 mt-0.5">{mod.description}</div>
                        </td>
                        {PERMISSION_ACTIONS_META.map((act) => {
                          const checked = Boolean(modPerms?.[act.action]);
                          return (
                            <td key={act.action} className="py-3 px-2.5 text-center">
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => handleTogglePermissionCell(mod.module, act.action)}
                                className="w-4 h-4 accent-indigo-600 rounded cursor-pointer"
                              />
                            </td>
                          );
                        })}
                        <td className="py-3 px-3 text-center whitespace-nowrap">
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleToggleAllModuleActions(mod.module, true)}
                              className="px-2 py-0.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded text-[10px] font-bold cursor-pointer"
                            >
                              همه
                            </button>
                            <button
                              type="button"
                              onClick={() => handleToggleAllModuleActions(mod.module, false)}
                              className="px-2 py-0.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded text-[10px] font-bold cursor-pointer"
                            >
                              هیچ‌کدام
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* تنظیمات حفاظت از اطلاعات محرمانه برای نقش انتخاب‌شده */}
          <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
            <h4 className="font-bold text-xs sm:text-sm text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <Lock className="w-4 h-4 text-indigo-600" />
              <span>حفاظت از اطلاعات محرمانه و سقف اختیارات مالی برای نقش «{currentEditingRoleConfig.title}»</span>
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
              <label className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={currentEditingRoleConfig.confidential.canViewPurchasePrice}
                  onChange={(e) => handleChangeConfidentialRule('canViewPurchasePrice', e.target.checked)}
                  className="mt-0.5 w-4 h-4 accent-indigo-600"
                />
                <div>
                  <div className="font-bold text-slate-800 dark:text-slate-100">مشاهده قیمت خرید و بهای تمام‌شده</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    در صورت غیرفعال بودن، قیمت خرید عمده از دید این نقش مخفی می‌ماند.
                  </div>
                </div>
              </label>

              <label className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={currentEditingRoleConfig.confidential.canViewProfitMargins}
                  onChange={(e) => handleChangeConfidentialRule('canViewProfitMargins', e.target.checked)}
                  className="mt-0.5 w-4 h-4 accent-indigo-600"
                />
                <div>
                  <div className="font-bold text-slate-800 dark:text-slate-100">مشاهده حاشیه سود هر کالا و فاکتور</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    دسترسی به سود ناخالص و سود خالص فروشگاه در گزارش‌ها.
                  </div>
                </div>
              </label>

              <label className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={currentEditingRoleConfig.confidential.canViewBankSecrets}
                  onChange={(e) => handleChangeConfidentialRule('canViewBankSecrets', e.target.checked)}
                  className="mt-0.5 w-4 h-4 accent-indigo-600"
                />
                <div>
                  <div className="font-bold text-slate-800 dark:text-slate-100">مشاهده کامل شبا و شماره کارت بانکی</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    در صورت عدم مجوز، ارقام میانی شبا و کارت در خروجی سرور ماسک (••••) می‌شوند.
                  </div>
                </div>
              </label>

              <label className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={currentEditingRoleConfig.confidential.canViewSecurityLogs}
                  onChange={(e) => handleChangeConfidentialRule('canViewSecurityLogs', e.target.checked)}
                  className="mt-0.5 w-4 h-4 accent-indigo-600"
                />
                <div>
                  <div className="font-bold text-slate-800 dark:text-slate-100">مشاهده لاگ‌های حساس امنیتی</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    دسترسی به جزئیات تلاش‌های ناموفق و تغییرات سطح دسترسی.
                  </div>
                </div>
              </label>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex items-center justify-between">
                <div>
                  <div className="font-bold text-slate-800 dark:text-slate-100">سقف مجاز تخفیف فروش (%)</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">حداکثر درصد تخفیف مجاز در فاکتور</div>
                </div>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={currentEditingRoleConfig.confidential.maxAllowedDiscountPercent}
                  onChange={(e) =>
                    handleChangeConfidentialRule(
                      'maxAllowedDiscountPercent',
                      Math.min(100, Math.max(0, Number(e.target.value) || 0))
                    )
                  }
                  className="w-20 px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-center font-bold"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* تب ۳: مدیریت نشست‌های فعال (Session Management) و سیاست‌های امنیتی */}
      {/* ===================================================================== */}
      {activeTab === 'sessions_policy' && (
        <div className="space-y-5">
          {/* جدول نشست‌های فعال و باطل‌شده */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm text-slate-800 dark:text-slate-100">
                  نشست‌های کاربری (Active & Revoked Sessions)
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  کلید کامل توکن نشست برای حفظ محرمانگی ماسک شده است. مدیر امنیت می‌تواند هر نشست مشکوک را درجا باطل کند.
                </p>
              </div>
              <button
                type="button"
                onClick={loadSecurityData}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 rounded-xl text-xs font-bold cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>بروزرسانی نشست‌ها</span>
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 text-slate-500 font-bold">
                  <tr>
                    <th className="py-3 px-4">کاربر و نقش</th>
                    <th className="py-3 px-4">توکن نشست (ماسک‌شده)</th>
                    <th className="py-3 px-4">دستگاه / IP</th>
                    <th className="py-3 px-4">زمان ایجاد و آخرین فعالیت</th>
                    <th className="py-3 px-4">انقضا</th>
                    <th className="py-3 px-4 text-center">وضعیت نشست</th>
                    <th className="py-3 px-4 text-center">عملیات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {sessions.map((s) => (
                    <tr key={s.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-800 dark:text-slate-100">{s.fullName}</div>
                        <span className={`inline-block mt-0.5 text-[10px] px-2 py-0.2 rounded-full border font-bold ${getRoleBadgeStyle(s.role)}`}>
                          {getRoleLabel(s.role)}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono text-[11px] text-slate-500">
                        {s.maskedToken}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-medium">{s.deviceLabel}</div>
                        <div className="text-[10px] font-mono text-slate-400">IP: {s.ipAddress}</div>
                      </td>
                      <td className="py-3 px-4">
                        <div>ایجاد: {toPersianDigits(s.createdAt)}</div>
                        <div className="text-[10px] text-slate-400">آخرین فعالیت: {toPersianDigits(s.lastActivityAt)}</div>
                      </td>
                      <td className="py-3 px-4 font-mono text-[11px]">
                        {toPersianDigits(s.expiresAt)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        {s.isActive ? (
                          <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2.5 py-0.5 rounded-full">
                            فعال {s.isCurrent ? '(نشست شما)' : ''}
                          </span>
                        ) : (
                          <div>
                            <span className="bg-rose-100 text-rose-800 text-[10px] font-bold px-2.5 py-0.5 rounded-full">
                              باطل‌شده
                            </span>
                            {s.revokedReason && (
                              <div className="text-[10px] text-slate-400 mt-0.5">{s.revokedReason}</div>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center">
                        {s.isActive && (
                          <button
                            type="button"
                            onClick={() => handleRevokeSession(s.id)}
                            className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-[11px] font-bold cursor-pointer"
                          >
                            ابطال نشست
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* فرم تنظیم سیاست‌های امنیتی، نشست و اعتبارسنجی ورودی */}
          <form
            onSubmit={handleSavePolicy}
            className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-4"
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm text-slate-800 dark:text-slate-100">
                  سیاست‌های امنیتی، مدیریت نشست، اعتبارسنجی ورودی و حفاظت از داده‌ها
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  پارامترهای امنیتی زیر مستقیماً در لایه Middleware سرور اعمال می‌شوند.
                </p>
              </div>
              <button
                type="submit"
                disabled={isSavingPolicy}
                className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold cursor-pointer"
              >
                <Save className="w-4 h-4" />
                <span>{isSavingPolicy ? 'در حال ذخیره...' : 'ذخیره سیاست‌های امنیتی'}</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  مهلت انقضای نشست (دقیقه)
                </label>
                <input
                  type="number"
                  min={5}
                  value={editablePolicy.sessionTimeoutMinutes}
                  onChange={(e) =>
                    setEditablePolicy({
                      ...editablePolicy,
                      sessionTimeoutMinutes: Number(e.target.value) || 60,
                    })
                  }
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  حداکثر تلاش ناموفق ورود (قفل حساب)
                </label>
                <input
                  type="number"
                  min={2}
                  max={20}
                  value={editablePolicy.maxFailedLoginAttempts}
                  onChange={(e) =>
                    setEditablePolicy({
                      ...editablePolicy,
                      maxFailedLoginAttempts: Number(e.target.value) || 5,
                    })
                  }
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  مدت قفل خودکار حساب (دقیقه)
                </label>
                <input
                  type="number"
                  min={1}
                  value={editablePolicy.lockoutDurationMinutes}
                  onChange={(e) =>
                    setEditablePolicy({
                      ...editablePolicy,
                      lockoutDurationMinutes: Number(e.target.value) || 15,
                    })
                  }
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  حداقل طول مجاز رمز عبور
                </label>
                <input
                  type="number"
                  min={4}
                  max={32}
                  value={editablePolicy.minPasswordLength}
                  onChange={(e) =>
                    setEditablePolicy({
                      ...editablePolicy,
                      minPasswordLength: Number(e.target.value) || 6,
                    })
                  }
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs pt-2">
              <label className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={editablePolicy.enforceBackendRbac}
                  onChange={(e) =>
                    setEditablePolicy({ ...editablePolicy, enforceBackendRbac: e.target.checked })
                  }
                  className="w-4 h-4 accent-indigo-600"
                />
                <span className="font-bold">اعمال اجباری کنترل دسترسی (RBAC) در تمام وب‌سرویس‌های Backend</span>
              </label>

              <label className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={editablePolicy.blockSqlAndXssPayloads}
                  onChange={(e) =>
                    setEditablePolicy({
                      ...editablePolicy,
                      blockSqlAndXssPayloads: e.target.checked,
                    })
                  }
                  className="w-4 h-4 accent-indigo-600"
                />
                <span className="font-bold">اعتبارسنجی ورودی و مسدودسازی خودکار پیلودهای تزریق SQLi و XSS</span>
              </label>

              <label className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={editablePolicy.maskConfidentialPricesForUnauthorized}
                  onChange={(e) =>
                    setEditablePolicy({
                      ...editablePolicy,
                      maskConfidentialPricesForUnauthorized: e.target.checked,
                    })
                  }
                  className="w-4 h-4 accent-indigo-600"
                />
                <span className="font-bold">حفاظت از اطلاعات محرمانه (مخفی‌سازی قیمت خرید، سود و شبا برای نقش‌های غیرمجاز)</span>
              </label>

              <label className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={editablePolicy.logAllPrintAndExportActions}
                  onChange={(e) =>
                    setEditablePolicy({
                      ...editablePolicy,
                      logAllPrintAndExportActions: e.target.checked,
                    })
                  }
                  className="w-4 h-4 accent-indigo-600"
                />
                <span className="font-bold">ثبت اجباری تمام عملیات چاپ (Print) و دریافت خروجی (Export) در لاگ امنیتی</span>
              </label>
            </div>
          </form>
        </div>
      )}

      {/* ===================================================================== */}
      {/* تب ۴: تاریخچه تغییرات، ورود و خروج، عملیات حساس و تلاش‌های ناموفق */}
      {/* ===================================================================== */}
      {activeTab === 'audit_trail' && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-3">
              <div className="flex items-center gap-1.5 flex-wrap text-xs font-bold">
                {[
                  { id: 'all', label: `همه رویدادها (${toPersianDigits(auditLogs.length)})` },
                  {
                    id: 'change_history',
                    label: `تاریخچه تغییرات (${toPersianDigits(
                      auditLogs.filter((l) => l.category === 'change_history').length
                    )})`,
                  },
                  {
                    id: 'auth_session',
                    label: `ورود و خروج (${toPersianDigits(
                      auditLogs.filter((l) => l.category === 'auth_session').length
                    )})`,
                  },
                  {
                    id: 'sensitive_operation',
                    label: `عملیات حساس / چاپ / خروجی (${toPersianDigits(
                      auditLogs.filter((l) => l.category === 'sensitive_operation').length
                    )})`,
                  },
                  {
                    id: 'failed_attempt',
                    label: `تلاش‌های ناموفق و مسدودشده (${toPersianDigits(
                      auditLogs.filter((l) => l.category === 'failed_attempt').length
                    )})`,
                  },
                ].map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setLogCategoryFilter(cat.id as any)}
                    className={`px-3 py-1.5 rounded-xl transition cursor-pointer ${
                      logCategoryFilter === cat.id
                        ? 'bg-indigo-600 text-white'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2 w-full lg:w-auto">
                <div className="relative flex-1 lg:w-64">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-2.5" />
                  <input
                    type="text"
                    value={logSearch}
                    onChange={(e) => setLogSearch(e.target.value)}
                    placeholder="جستجو در کاربر، ماژول، IP یا شرح..."
                    className="w-full pr-8 pl-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleExportAuditLogsExcel}
                  className="flex items-center gap-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold cursor-pointer"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  <span>Excel</span>
                </button>
                <button
                  type="button"
                  onClick={handlePrintAuditLogs}
                  className="flex items-center gap-1 px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>چاپ / PDF</span>
                </button>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 text-slate-500 font-bold">
                  <tr>
                    <th className="py-3 px-4">زمان ثبت</th>
                    <th className="py-3 px-4">کاربر و نقش</th>
                    <th className="py-3 px-4">نوع رویداد</th>
                    <th className="py-3 px-4">بخش / مسیر API</th>
                    <th className="py-3 px-4">شرح کامل و تغییرات (قدیم / جدید)</th>
                    <th className="py-3 px-4 text-center">وضعیت</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredAuditLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                      <td className="py-3 px-4 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                        <div>{toPersianDigits(log.timestamp)}</div>
                        <div className="text-[10px] text-slate-400">IP: {log.ipAddress || '127.0.0.1'}</div>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="font-bold text-slate-800 dark:text-slate-100">{log.userName}</div>
                        {log.userRole && (
                          <div className="text-[10px] text-slate-400">{getRoleLabel(log.userRole)}</div>
                        )}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">{getAuditActionBadge(log.action)}</td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="font-bold text-slate-700 dark:text-slate-300">{log.module}</div>
                        {log.endpoint && (
                          <div className="text-[10px] font-mono text-slate-400">{log.endpoint}</div>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <div className="text-slate-700 dark:text-slate-200 leading-relaxed">{log.description}</div>
                        {(log.beforeData || log.afterData) && (
                          <div className="mt-1.5 flex flex-wrap gap-2 text-[10px] font-mono">
                            {log.beforeData && (
                              <span className="bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 px-2 py-0.5 rounded border border-rose-200 dark:border-rose-800">
                                قبل: {JSON.stringify(log.beforeData)}
                              </span>
                            )}
                            {log.afterData && (
                              <span className="bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800">
                                بعد: {JSON.stringify(log.afterData)}
                              </span>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        {log.status === 'blocked' ? (
                          <span className="bg-rose-100 text-rose-800 text-[10px] font-bold px-2 py-0.5 rounded-full">
                            مسدود شده
                          </span>
                        ) : log.status === 'failed' ? (
                          <span className="bg-amber-100 text-amber-800 text-[10px] font-bold px-2 py-0.5 rounded-full">
                            ناموفق
                          </span>
                        ) : (
                          <span className="bg-emerald-50 text-emerald-700 text-[10px] font-bold px-2 py-0.5 rounded-full">
                            ثبت موفق
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* تب ۵: آزمایشگاه تست امنیت، اعتبارسنجی ورودی و کنترل دسترسی Backend */}
      {/* ===================================================================== */}
      {activeTab === 'security_lab' && (
        <div className="space-y-5">
          {/* وضعیت ۵ ستون اصلی امنیت */}
          {securitySummary && (
            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <div>
                  <h3 className="font-bold text-sm text-slate-800 dark:text-slate-100">
                    شاخص سلامت امنیتی و وضعیت ممیزی Backend (امتیاز: {toPersianDigits(securitySummary.overallScore)}٪)
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    بررسی خودکار مدیریت نشست، اعتبارسنجی ورودی، حفاظت از اطلاعات محرمانه و جلوگیری از دسترسی غیرمجاز
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleRunSecurityTestSuite}
                  disabled={isRunningSuite}
                  className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition shadow-sm cursor-pointer"
                >
                  <Play className="w-4 h-4" />
                  <span>{isRunningSuite ? 'در حال اجرای تست‌ها...' : 'اجرای خودکار آزمون‌های ۷گانه امنیت و RBAC'}</span>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3 text-xs">
                {securitySummary.checks.map((chk) => (
                  <div
                    key={chk.id}
                    className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-800 dark:text-slate-100">{chk.title}</span>
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                      {chk.description}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* شبیه‌ساز زنده فراخوانی Backend با نقش فعلی */}
          <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
            <div>
              <h3 className="font-bold text-sm text-slate-800 dark:text-slate-100">
                شبیه‌ساز زنده درخواست به سرور (اثبات اعمال دسترسی‌ها در Backend)
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                شما هم‌اکنون با نقش «<b className="text-indigo-600">{getRoleLabel(currentUser?.role || '')}</b>» وارد شده‌اید. با کلیک روی هر دکمه، یک درخواست واقعی به سرور ارسال شده و پاسخ گارد امنیتی Backend نمایش داده می‌شود:
              </p>
            </div>

            <div className="flex flex-wrap gap-2.5 text-xs">
              <button
                type="button"
                onClick={() => handleRunLiveBackendProbe('print_action')}
                className="px-3.5 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-indigo-50 text-slate-800 dark:text-slate-200 rounded-xl font-bold border border-slate-200 dark:border-slate-700 cursor-pointer"
              >
                ۱. تست مجوز «چاپ فاکتور فروش» در سرور
              </button>
              <button
                type="button"
                onClick={() => handleRunLiveBackendProbe('export_action')}
                className="px-3.5 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-indigo-50 text-slate-800 dark:text-slate-200 rounded-xl font-bold border border-slate-200 dark:border-slate-700 cursor-pointer"
              >
                ۲. تست مجوز «خروجی Excel فروش» در سرور
              </button>
              <button
                type="button"
                onClick={() => handleRunLiveBackendProbe('close_fiscal')}
                className="px-3.5 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-indigo-50 text-slate-800 dark:text-slate-200 rounded-xl font-bold border border-slate-200 dark:border-slate-700 cursor-pointer"
              >
                ۳. تست مجوز «ثبت نهایی / بستن سال مالی» در سرور
              </button>
              <button
                type="button"
                onClick={() => handleRunLiveBackendProbe('edit_roles')}
                className="px-3.5 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-indigo-50 text-slate-800 dark:text-slate-200 rounded-xl font-bold border border-slate-200 dark:border-slate-700 cursor-pointer"
              >
                ۴. تست مجوز «ویرایش تنظیمات امنیتی» در سرور
              </button>
              <button
                type="button"
                onClick={() => handleRunLiveBackendProbe('xss_sqli_attack')}
                className="px-3.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-xl font-bold border border-rose-200 cursor-pointer"
              >
                ۵. تست ارسال پیلود مخرب SQLi / XSS به سرور
              </button>
            </div>

            {probeResponse && (
              <div
                className={`p-4 rounded-xl border text-xs ${
                  probeResponse.status === 'allowed'
                    ? 'bg-emerald-50/90 dark:bg-emerald-950/40 border-emerald-300 text-emerald-900 dark:text-emerald-200'
                    : 'bg-rose-50/90 dark:bg-rose-950/40 border-rose-300 text-rose-900 dark:text-rose-200'
                }`}
              >
                <div className="flex items-center justify-between font-bold">
                  <span>{probeResponse.title}</span>
                  <span className="font-mono text-[11px]">{toPersianDigits(probeResponse.timestamp)}</span>
                </div>
                <p className="mt-1.5 leading-relaxed">{probeResponse.detail}</p>
              </div>
            )}
          </div>

          {/* نتایج آزمون‌های خودکار ۷گانه */}
          {testSuiteResult && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
              <div className="p-4 bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between text-xs font-bold">
                <span>نتایج آزمون‌های ۷گانه امنیت، RBAC، مدیریت نشست و حفاظت از داده‌های محرمانه</span>
                <span className="text-emerald-600">
                  زمان اجرا: {toPersianDigits(testSuiteResult.executedAt)}
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-100 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 text-slate-600 font-bold">
                    <tr>
                      <th className="py-3 px-4">سناریوی آزمون</th>
                      <th className="py-3 px-4">حوزه امنیتی</th>
                      <th className="py-3 px-4">خروجی مورد انتظار</th>
                      <th className="py-3 px-4">خروجی واقعی</th>
                      <th className="py-3 px-4 text-center">نتیجه</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {testSuiteResult.scenarios.map((sc) => (
                      <tr key={sc.id}>
                        <td className="py-3 px-4">
                          <div className="font-bold text-slate-800 dark:text-slate-100">{sc.title}</div>
                          <div className="text-[11px] text-slate-500 mt-0.5">{sc.details}</div>
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap font-bold text-indigo-600">
                          {sc.category}
                        </td>
                        <td className="py-3 px-4 font-mono text-[11px] text-slate-500">{sc.expected}</td>
                        <td className="py-3 px-4 font-mono text-[11px] text-slate-700 dark:text-slate-300">{sc.actual}</td>
                        <td className="py-3 px-4 text-center">
                          {sc.passed ? (
                            <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2.5 py-0.5 rounded-full">
                              موفق (PASS)
                            </span>
                          ) : (
                            <span className="bg-rose-100 text-rose-800 text-[10px] font-bold px-2.5 py-0.5 rounded-full">
                              ناموفق
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
        </div>
      )}

      {/* مودال ایجاد / ویرایش کاربر */}
      {isUserModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50">
              <h3 className="font-bold text-sm text-slate-800 dark:text-slate-100">
                {editingUser ? `ویرایش کاربر: ${editingUser.fullName}` : 'تعریف کاربر جدید فروشگاه'}
              </h3>
              <button
                onClick={() => setIsUserModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveUser} className="p-5 space-y-3.5 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    نام و نام خانوادگی *
                  </label>
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="مثلاً: سارا نوری"
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    نام کاربری انگلیسی *
                  </label>
                  <input
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="مثلاً: sara_nouri"
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    نقش سیستمی (RBAC) *
                  </label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value as UserRole)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold"
                  >
                    <option value="admin">مدیر ارشد سیستم (admin)</option>
                    <option value="accountant">حسابدار ارشد (accountant)</option>
                    <option value="cashier">صندوق‌دار فروشگاه (cashier)</option>
                    <option value="inventory_clerk">انباردار و مسئول کالا (inventory_clerk)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    واحد سازمانی
                  </label>
                  <input
                    type="text"
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    placeholder="مثلاً: صندوق پیشخوان"
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    شماره همراه
                  </label>
                  <input
                    type="text"
                    value={mobile}
                    onChange={(e) => setMobile(e.target.value)}
                    placeholder="0912..."
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-mono"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {editingUser ? 'کلمه عبور جدید (اختیاری)' : 'کلمه عبور اولیه *'}
                  </label>
                  <input
                    type="text"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="حداقل ۶ کاراکتر شامل حرف و عدد"
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-mono"
                  />
                </div>
              </div>

              <label className="flex items-center gap-2 pt-1 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isUserActive}
                  onChange={(e) => setIsUserActive(e.target.checked)}
                  className="w-4 h-4 accent-indigo-600"
                />
                <span className="font-bold">حساب کاربری فعال و مجاز به ورود باشد</span>
              </label>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsUserModalOpen(false)}
                  className="px-4 py-2 bg-slate-200 dark:bg-slate-700 rounded-xl font-bold cursor-pointer"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingUser}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold cursor-pointer"
                >
                  {isSubmittingUser ? 'در حال ذخیره...' : 'ذخیره اطلاعات کاربر'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* مودال تغییر رمز عبور */}
      {passwordModalUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <h3 className="font-bold text-xs text-slate-800 dark:text-slate-100">
                تغییر کلمه عبور «{passwordModalUser.fullName}»
              </h3>
              <button
                onClick={() => setPasswordModalUser(null)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleResetPassword} className="p-4 space-y-3 text-xs">
              <div>
                <label className="block font-bold mb-1">کلمه عبور جدید (شامل حروف و اعداد)</label>
                <input
                  type="text"
                  required
                  value={newPassValue}
                  onChange={(e) => setNewPassValue(e.target.value)}
                  placeholder="مثلاً: Pass1403"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-mono"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setPasswordModalUser(null)}
                  className="px-3 py-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg font-bold cursor-pointer"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  disabled={isSavingPass}
                  className="px-4 py-1.5 bg-indigo-600 text-white rounded-lg font-bold cursor-pointer"
                >
                  {isSavingPass ? 'در حال ثبت...' : 'ثبت رمز عبور جدید'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
