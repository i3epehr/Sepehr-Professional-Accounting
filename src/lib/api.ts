import {
  User,
  Product,
  Unit,
  ProductCategory,
  Person,
  Brand,
  PersonGroup,
  Invoice,
  AccountingAccount,
  AccountingVoucher,
  TreasuryAccount,
  TreasuryTransaction,
  FinancialCategory,
  Cheque,
  ChequeStatus,
  AuditLog,
  StoreSettings,
  AccessoryCostType,
  AccessoryCostEntry,
  AllocationMethod,
  Warehouse,
  WarehouseStock,
  KardexEntry,
  GoodsReceipt,
  PurchaseProforma,
  WarehouseTransfer,
  StocktakingSession,
  InventoryAdjustment,
  InventoryTurnoverReportRow,
  FiscalYear,
  OpeningBalancePayload,
  FiscalPreClosingAudit,
  FiscalYearArchiveSnapshot,
  UserRole,
  PermissionModule,
  PermissionAction,
  RolePermissionConfig,
  ConfidentialAccessRules,
  SecurityPolicyConfig,
  UserSession,
  SecurityCheckSummary,
} from '../types/index.ts';
import { ReturnableItemInfo } from './returnsCalculations.ts';
import { TestResult } from './calculations.test.ts';
import {
  JournalLedgerEntry,
  LedgerAccountSummary,
  DetailedPersonLedgerSummary,
  TrialBalanceReport,
  AccountingAuditResult,
} from './accountingCalculations.ts';

class ApiClient {
  private currentUserId: string =
    typeof window !== 'undefined' ? localStorage.getItem('kharrazi_active_user_id') || 'usr-admin' : 'usr-admin';
  private sessionToken: string | null =
    typeof window !== 'undefined' ? localStorage.getItem('kharrazi_session_token') : null;

  setUserId(id: string) {
    this.currentUserId = id;
    if (typeof window !== 'undefined') {
      localStorage.setItem('kharrazi_active_user_id', id);
    }
  }

  getUserId(): string {
    return this.currentUserId;
  }

  setSessionToken(token: string | null) {
    this.sessionToken = token;
    if (typeof window !== 'undefined') {
      if (token) {
        localStorage.setItem('kharrazi_session_token', token);
      } else {
        localStorage.removeItem('kharrazi_session_token');
      }
    }
  }

  getSessionToken(): string | null {
    return this.sessionToken;
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const headers = new Headers(options.headers || {});
    headers.set('Content-Type', 'application/json');
    headers.set('x-user-id', this.currentUserId);
    if (this.sessionToken) {
      headers.set('Authorization', `Bearer ${this.sessionToken}`);
    }

    const res = await fetch(`/api${path}`, {
      ...options,
      headers,
    });

    const text = await res.text();

    if (!res.ok) {
      let errorMsg = `خطای سرور (${res.status})`;
      try {
        const data = JSON.parse(text);
        if (data && (data.detail || data.error || data.title)) {
          errorMsg = data.detail || data.error || data.title;
        }
      } catch {
        if (text.includes('<!doctype') || text.includes('<html')) {
          errorMsg = `مسیر وب‌سرویس /api${path} یافت نشد (خطای ۴۰۴).`;
        }
      }
      throw new Error(errorMsg);
    }

    if (text.trim().startsWith('<') || text.includes('<!doctype') || text.includes('<html')) {
      throw new Error(`سرویس API در دسترس نیست یا مسیر /api${path} هنوز توسط سرور پاسخ داده نشده است.`);
    }

    try {
      return JSON.parse(text) as T;
    } catch {
      throw new Error(`پاسخ سرور در قالب معتبر JSON نیست: ${text.slice(0, 100)}`);
    }
  }

  // ۱. سلامت سیستم و پایگاه داده
  async getDbStatus() {
    return this.request<{
      connected: boolean;
      message: string;
      version?: string;
      postgresConfigured: boolean;
      diskPersistenceActive?: boolean;
      storagePath?: string;
      inMemoryRecords: Record<string, number>;
    }>('/db/status');
  }

  async testTransactionRollback() {
    return this.request<{
      success: boolean;
      testName: string;
      errorCaught: string;
      isRolledBack: boolean;
      initialRecords: number;
      afterFailureRecords: number;
      detail: string;
    }>('/dev/transaction-test', {
      method: 'POST',
    });
  }

  async createUser(userData: { username: string; fullName: string; role: string; password?: string }) {
    return this.request<User>('/auth/create-user', {
      method: 'POST',
      body: JSON.stringify(userData),
    });
  }

  // ۲. کاربران و نقش‌ها
  async getUsers(): Promise<User[]> {
    return this.request<User[]>('/auth/users');
  }

  async getCurrentUser(): Promise<User> {
    return this.request<User>('/auth/me');
  }

  async switchUser(userId: string): Promise<User> {
    const data = await this.request<{ user: User; token: string; session?: UserSession }>('/auth/switch-user', {
      method: 'POST',
      body: JSON.stringify({ userId }),
    });
    this.setUserId(data.user.id);
    if (data.token) {
      this.setSessionToken(data.token);
    }
    return data.user;
  }

  async login(username: string, password?: string): Promise<{ token: string; user: User; session: UserSession; message: string }> {
    const data = await this.request<{ token: string; user: User; session: UserSession; message: string }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
    this.setUserId(data.user.id);
    this.setSessionToken(data.token);
    return data;
  }

  async logout(): Promise<{ success: boolean; message: string }> {
    const res = await this.request<{ success: boolean; message: string }>('/auth/logout', {
      method: 'POST',
      body: JSON.stringify({ token: this.sessionToken }),
    });
    this.setSessionToken(null);
    return res;
  }

  // ۳. داشبورد
  async getDashboard() {
    return this.request<{
      totalSalesAmount: number;
      netProfitEstimate?: number;
      todaySalesCount: number;
      cashTotal: number;
      bankTotal: number;
      totalTreasury: number;
      pendingReceivedCheques: number;
      pendingIssuedCheques: number;
      upcomingCheques?: Cheque[];
      customerDebts: number;
      supplierCredits: number;
      lowStockCount: number;
      lowStockProducts: Product[];
      totalProductsCount: number;
      totalPersonsCount: number;
      totalInventoryValue: number;
      recentInvoices: Invoice[];
    }>('/dashboard');
  }

  // ۴. کالاها
  async getProducts(params?: { categoryId?: string; brand?: string; isActive?: string; search?: string }): Promise<Product[]> {
    const query = new URLSearchParams();
    if (params?.categoryId) query.set('categoryId', params.categoryId);
    if (params?.brand) query.set('brand', params.brand);
    if (params?.isActive !== undefined) query.set('isActive', params.isActive);
    if (params?.search) query.set('search', params.search);
    const qs = query.toString();
    return this.request<Product[]>(`/products${qs ? `?${qs}` : ''}`);
  }

  async saveProduct(product: Partial<Product>): Promise<Product> {
    return this.request<Product>('/products', {
      method: 'POST',
      body: JSON.stringify(product),
    });
  }

  async toggleProductActive(id: string): Promise<Product> {
    return this.request<Product>(`/products/${id}/toggle-active`, {
      method: 'PUT',
    });
  }

  async deleteProduct(id: string): Promise<{ success: boolean; message: string }> {
    return this.request<{ success: boolean; message: string }>(`/products/${id}`, {
      method: 'DELETE',
    });
  }

  // ۵. برندها، دسته‌ها و واحدها
  async getBrands(): Promise<Brand[]> {
    return this.request<Brand[]>('/brands');
  }

  async saveBrand(brand: Partial<Brand>): Promise<Brand> {
    return this.request<Brand>('/brands', {
      method: 'POST',
      body: JSON.stringify(brand),
    });
  }

  async deleteBrand(id: string): Promise<{ success: boolean; message: string }> {
    return this.request<{ success: boolean; message: string }>(`/brands/${id}`, {
      method: 'DELETE',
    });
  }

  async getCategories(): Promise<ProductCategory[]> {
    return this.request<ProductCategory[]>('/categories');
  }

  async saveCategory(category: Partial<ProductCategory>): Promise<ProductCategory> {
    return this.request<ProductCategory>('/categories', {
      method: 'POST',
      body: JSON.stringify(category),
    });
  }

  async deleteCategory(id: string): Promise<{ success: boolean; message: string }> {
    return this.request<{ success: boolean; message: string }>(`/categories/${id}`, {
      method: 'DELETE',
    });
  }

  async getUnits(): Promise<Unit[]> {
    return this.request<Unit[]>('/units');
  }

  async saveUnit(unit: Partial<Unit>): Promise<Unit> {
    return this.request<Unit>('/units', {
      method: 'POST',
      body: JSON.stringify(unit),
    });
  }

  async deleteUnit(id: string): Promise<{ success: boolean; message: string }> {
    return this.request<{ success: boolean; message: string }>(`/units/${id}`, {
      method: 'DELETE',
    });
  }

  // انواع خرج‌کار و هزینه‌های جانبی قابل تنظیم
  async getAccessoryCostTypes(): Promise<AccessoryCostType[]> {
    return this.request<AccessoryCostType[]>('/accessory-cost-types');
  }

  async saveAccessoryCostType(type: Partial<AccessoryCostType>): Promise<AccessoryCostType> {
    return this.request<AccessoryCostType>('/accessory-cost-types', {
      method: 'POST',
      body: JSON.stringify(type),
    });
  }

  async deleteAccessoryCostType(id: string): Promise<{ success: boolean; message: string }> {
    return this.request<{ success: boolean; message: string }>(`/accessory-cost-types/${id}`, {
      method: 'DELETE',
    });
  }

  // برگه‌های ثبت خرج‌کار و هزینه‌های جانبی
  async getAccessoryCosts(): Promise<AccessoryCostEntry[]> {
    return this.request<AccessoryCostEntry[]>('/accessory-costs');
  }

  async saveAccessoryCost(entry: Partial<AccessoryCostEntry>): Promise<AccessoryCostEntry> {
    return this.request<AccessoryCostEntry>('/accessory-costs', {
      method: 'POST',
      body: JSON.stringify(entry),
    });
  }

  async deleteAccessoryCost(id: string): Promise<{ success: boolean; message: string }> {
    return this.request<{ success: boolean; message: string }>(`/accessory-costs/${id}`, {
      method: 'DELETE',
    });
  }

  async previewCostAllocation(params: {
    totalAmount: number;
    method: AllocationMethod;
    items: any[];
  }): Promise<any> {
    return this.request<any>('/accessory-costs/preview-allocation', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  }

  // اجرای آزمون‌های محاسباتی
  async runCalculationTests(): Promise<{ summary: any; results: TestResult[] }> {
    return this.request<{ summary: any; results: TestResult[] }>('/tests/run-calculations');
  }

  // ۶. گروه‌بندی و طرف‌های حساب
  async getPersonGroups(): Promise<PersonGroup[]> {
    return this.request<PersonGroup[]>('/person-groups');
  }

  async savePersonGroup(group: Partial<PersonGroup>): Promise<PersonGroup> {
    return this.request<PersonGroup>('/person-groups', {
      method: 'POST',
      body: JSON.stringify(group),
    });
  }

  async deletePersonGroup(id: string): Promise<{ success: boolean; message: string }> {
    return this.request<{ success: boolean; message: string }>(`/person-groups/${id}`, {
      method: 'DELETE',
    });
  }

  async getPersons(params?: { type?: string; groupId?: string; isActive?: string; search?: string }): Promise<Person[]> {
    const query = new URLSearchParams();
    if (params?.type) query.set('type', params.type);
    if (params?.groupId) query.set('groupId', params.groupId);
    if (params?.isActive !== undefined) query.set('isActive', params.isActive);
    if (params?.search) query.set('search', params.search);
    const qs = query.toString();
    return this.request<Person[]>(`/persons${qs ? `?${qs}` : ''}`);
  }

  async savePerson(person: Partial<Person>): Promise<Person> {
    return this.request<Person>('/persons', {
      method: 'POST',
      body: JSON.stringify(person),
    });
  }

  async togglePersonActive(id: string): Promise<Person> {
    return this.request<Person>(`/persons/${id}/toggle-active`, {
      method: 'PUT',
    });
  }

  async deletePerson(id: string): Promise<{ success: boolean; message: string }> {
    return this.request<{ success: boolean; message: string }>(`/persons/${id}`, {
      method: 'DELETE',
    });
  }

  async getPersonFinancialSummary(id: string) {
    return this.request<{
      person: Person;
      invoicesCount: number;
      invoicesTotal: number;
      transactionsCount: number;
      chequesCount: number;
      currentBalance: number;
      canDelete: boolean;
    }>(`/persons/${id}/financial-summary`);
  }

  // ۷. فاکتورها
  async getInvoices(): Promise<Invoice[]> {
    return this.request<Invoice[]>('/invoices');
  }

  async createInvoice(invoice: Partial<Invoice>): Promise<Invoice> {
    return this.request<Invoice>('/invoices', {
      method: 'POST',
      body: JSON.stringify(invoice),
    });
  }

  async updateInvoice(id: string, invoice: Partial<Invoice>): Promise<Invoice> {
    return this.request<Invoice>(`/invoices/${id}`, {
      method: 'PUT',
      body: JSON.stringify(invoice),
    });
  }

  async approveInvoice(id: string): Promise<Invoice> {
    return this.request<Invoice>(`/invoices/${id}/approve`, {
      method: 'POST',
    });
  }

  async cancelInvoice(id: string, reason: string): Promise<Invoice> {
    return this.request<Invoice>(`/invoices/${id}/cancel`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  }

  async convertProformaToSaleInvoice(id: string): Promise<Invoice> {
    return this.request<Invoice>(`/invoices/${id}/convert-to-sale`, {
      method: 'POST',
    });
  }

  async getReturnableInvoiceItems(id: string): Promise<{ originalInvoice: Invoice; returnableItems: ReturnableItemInfo[] }> {
    return this.request<{ originalInvoice: Invoice; returnableItems: ReturnableItemInfo[] }>(`/invoices/${id}/returnable-items`);
  }

  // ==================== متدهای خرید و انبار، کاردکس، انتقال و انبارگردانی ====================

  async getWarehouses(): Promise<Warehouse[]> {
    return this.request<Warehouse[]>('/warehouses');
  }

  async saveWarehouse(warehouse: Partial<Warehouse>): Promise<Warehouse> {
    return this.request<Warehouse>('/warehouses', {
      method: 'POST',
      body: JSON.stringify(warehouse),
    });
  }

  async deleteWarehouse(id: string): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>(`/warehouses/${id}`, {
      method: 'DELETE',
    });
  }

  async getWarehouseStocks(params?: { warehouseId?: string; productId?: string }): Promise<WarehouseStock[]> {
    const query = new URLSearchParams();
    if (params?.warehouseId) query.set('warehouseId', params.warehouseId);
    if (params?.productId) query.set('productId', params.productId);
    const qs = query.toString();
    return this.request<WarehouseStock[]>(`/warehouses/stocks${qs ? `?${qs}` : ''}`);
  }

  async getKardex(params: { productId: string; warehouseId?: string; dateFrom?: string; dateTo?: string }): Promise<KardexEntry[]> {
    const query = new URLSearchParams();
    query.set('productId', params.productId);
    if (params.warehouseId) query.set('warehouseId', params.warehouseId);
    if (params.dateFrom) query.set('dateFrom', params.dateFrom);
    if (params.dateTo) query.set('dateTo', params.dateTo);
    return this.request<KardexEntry[]>(`/kardex?${query.toString()}`);
  }

  async getGoodsReceipts(): Promise<GoodsReceipt[]> {
    return this.request<GoodsReceipt[]>('/goods-receipts');
  }

  async saveGoodsReceipt(receipt: Partial<GoodsReceipt>): Promise<GoodsReceipt> {
    return this.request<GoodsReceipt>('/goods-receipts', {
      method: 'POST',
      body: JSON.stringify(receipt),
    });
  }

  async approveGoodsReceipt(id: string): Promise<GoodsReceipt> {
    return this.request<GoodsReceipt>(`/goods-receipts/${id}/approve`, {
      method: 'POST',
    });
  }

  async deleteGoodsReceipt(id: string): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>(`/goods-receipts/${id}`, {
      method: 'DELETE',
    });
  }

  async getPurchaseProformas(): Promise<PurchaseProforma[]> {
    return this.request<PurchaseProforma[]>('/purchase-proformas');
  }

  async savePurchaseProforma(proforma: Partial<PurchaseProforma>): Promise<PurchaseProforma> {
    return this.request<PurchaseProforma>('/purchase-proformas', {
      method: 'POST',
      body: JSON.stringify(proforma),
    });
  }

  async convertProformaToInvoice(id: string): Promise<Invoice> {
    return this.request<Invoice>(`/purchase-proformas/${id}/convert-to-invoice`, {
      method: 'POST',
    });
  }

  async deletePurchaseProforma(id: string): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>(`/purchase-proformas/${id}`, {
      method: 'DELETE',
    });
  }

  async getWarehouseTransfers(): Promise<WarehouseTransfer[]> {
    return this.request<WarehouseTransfer[]>('/warehouse-transfers');
  }

  async saveWarehouseTransfer(transfer: Partial<WarehouseTransfer>): Promise<WarehouseTransfer> {
    return this.request<WarehouseTransfer>('/warehouse-transfers', {
      method: 'POST',
      body: JSON.stringify(transfer),
    });
  }

  async approveWarehouseTransfer(id: string): Promise<WarehouseTransfer> {
    return this.request<WarehouseTransfer>(`/warehouse-transfers/${id}/approve`, {
      method: 'POST',
    });
  }

  async deleteWarehouseTransfer(id: string): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>(`/warehouse-transfers/${id}`, {
      method: 'DELETE',
    });
  }

  async getStocktakingSessions(): Promise<StocktakingSession[]> {
    return this.request<StocktakingSession[]>('/stocktaking-sessions');
  }

  async saveStocktakingSession(session: Partial<StocktakingSession>): Promise<StocktakingSession> {
    return this.request<StocktakingSession>('/stocktaking-sessions', {
      method: 'POST',
      body: JSON.stringify(session),
    });
  }

  async approveStocktakingSession(id: string): Promise<StocktakingSession> {
    return this.request<StocktakingSession>(`/stocktaking-sessions/${id}/approve`, {
      method: 'POST',
    });
  }

  async deleteStocktakingSession(id: string): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>(`/stocktaking-sessions/${id}`, {
      method: 'DELETE',
    });
  }

  async getInventoryAdjustments(): Promise<InventoryAdjustment[]> {
    return this.request<InventoryAdjustment[]>('/inventory-adjustments');
  }

  async saveInventoryAdjustment(adjustment: Partial<InventoryAdjustment>): Promise<InventoryAdjustment> {
    return this.request<InventoryAdjustment>('/inventory-adjustments', {
      method: 'POST',
      body: JSON.stringify(adjustment),
    });
  }

  async approveInventoryAdjustment(id: string): Promise<InventoryAdjustment> {
    return this.request<InventoryAdjustment>(`/inventory-adjustments/${id}/approve`, {
      method: 'POST',
    });
  }

  async deleteInventoryAdjustment(id: string): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>(`/inventory-adjustments/${id}`, {
      method: 'DELETE',
    });
  }

  async getInventoryTurnoverReport(): Promise<InventoryTurnoverReportRow[]> {
    return this.request<InventoryTurnoverReportRow[]>('/reports/inventory-turnover');
  }

  async getLowStockProducts(): Promise<Product[]> {
    return this.request<Product[]>('/reports/low-stock');
  }

  async getComprehensiveReports(params?: {
    dateFrom?: string;
    dateTo?: string;
    personId?: string;
    productId?: string;
    categoryId?: string;
    warehouseId?: string;
    treasuryAccountId?: string;
    accountCode?: string;
    chequeStatus?: string;
    chequeType?: string;
    periodType?: string;
    search?: string;
  }): Promise<any> {
    const query = new URLSearchParams();
    if (params?.dateFrom) query.set('dateFrom', params.dateFrom);
    if (params?.dateTo) query.set('dateTo', params.dateTo);
    if (params?.personId && params.personId !== 'all') query.set('personId', params.personId);
    if (params?.productId && params.productId !== 'all') query.set('productId', params.productId);
    if (params?.categoryId && params.categoryId !== 'all') query.set('categoryId', params.categoryId);
    if (params?.warehouseId && params.warehouseId !== 'all') query.set('warehouseId', params.warehouseId);
    if (params?.treasuryAccountId && params.treasuryAccountId !== 'all') query.set('treasuryAccountId', params.treasuryAccountId);
    if (params?.accountCode && params.accountCode !== 'all') query.set('accountCode', params.accountCode);
    if (params?.chequeStatus && params.chequeStatus !== 'all') query.set('chequeStatus', params.chequeStatus);
    if (params?.chequeType && params.chequeType !== 'all') query.set('chequeType', params.chequeType);
    if (params?.periodType) query.set('periodType', params.periodType);
    if (params?.search) query.set('search', params.search);
    const qs = query.toString() ? `?${query.toString()}` : '';
    return this.request<any>(`/reports/comprehensive${qs}`);
  }

  async verifySampleReports(): Promise<any> {
    return this.request<any>('/reports/verify-samples');
  }

  // ۸. موتور حسابداری دوطرفه و دفاتر قانونی
  async getAccounts(): Promise<AccountingAccount[]> {
    return this.request<AccountingAccount[]>('/accounting/accounts');
  }

  async getVouchers(): Promise<AccountingVoucher[]> {
    return this.request<AccountingVoucher[]>('/accounting/vouchers');
  }

  async createVoucher(voucher: Partial<AccountingVoucher>, allowDuplicate?: boolean): Promise<AccountingVoucher> {
    return this.request<AccountingVoucher>('/accounting/vouchers', {
      method: 'POST',
      body: JSON.stringify({ ...voucher, allowDuplicate }),
    });
  }

  async updateVoucher(id: string, voucher: Partial<AccountingVoucher>): Promise<AccountingVoucher> {
    return this.request<AccountingVoucher>(`/accounting/vouchers/${id}`, {
      method: 'PUT',
      body: JSON.stringify(voucher),
    });
  }

  async reverseVoucher(id: string, reason: string): Promise<AccountingVoucher> {
    return this.request<AccountingVoucher>(`/accounting/vouchers/${id}/reverse`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  }

  async getJournalLedger(params?: { dateFrom?: string; dateTo?: string }): Promise<{
    entries: JournalLedgerEntry[];
    totalDebit: number;
    totalCredit: number;
    isBalanced: boolean;
  }> {
    const query = new URLSearchParams();
    if (params?.dateFrom) query.set('dateFrom', params.dateFrom);
    if (params?.dateTo) query.set('dateTo', params.dateTo);
    const qs = query.toString() ? `?${query.toString()}` : '';
    return this.request<{ entries: JournalLedgerEntry[]; totalDebit: number; totalCredit: number; isBalanced: boolean }>(`/accounting/journal${qs}`);
  }

  async getGeneralLedger(params?: { dateFrom?: string; dateTo?: string }): Promise<LedgerAccountSummary[]> {
    const query = new URLSearchParams();
    if (params?.dateFrom) query.set('dateFrom', params.dateFrom);
    if (params?.dateTo) query.set('dateTo', params.dateTo);
    const qs = query.toString() ? `?${query.toString()}` : '';
    return this.request<LedgerAccountSummary[]>(`/accounting/general-ledger${qs}`);
  }

  async getSubsidiaryLedger(params?: { dateFrom?: string; dateTo?: string; generalCode?: string }): Promise<LedgerAccountSummary[]> {
    const query = new URLSearchParams();
    if (params?.dateFrom) query.set('dateFrom', params.dateFrom);
    if (params?.dateTo) query.set('dateTo', params.dateTo);
    if (params?.generalCode) query.set('generalCode', params.generalCode);
    const qs = query.toString() ? `?${query.toString()}` : '';
    return this.request<LedgerAccountSummary[]>(`/accounting/subsidiary-ledger${qs}`);
  }

  async getDetailedPersonLedger(params?: { personId?: string; dateFrom?: string; dateTo?: string }): Promise<DetailedPersonLedgerSummary[]> {
    const query = new URLSearchParams();
    if (params?.personId) query.set('personId', params.personId);
    if (params?.dateFrom) query.set('dateFrom', params.dateFrom);
    if (params?.dateTo) query.set('dateTo', params.dateTo);
    const qs = query.toString() ? `?${query.toString()}` : '';
    return this.request<DetailedPersonLedgerSummary[]>(`/accounting/person-ledger${qs}`);
  }

  async getTrialBalance(params?: { dateFrom?: string; dateTo?: string }): Promise<TrialBalanceReport> {
    const query = new URLSearchParams();
    if (params?.dateFrom) query.set('dateFrom', params.dateFrom);
    if (params?.dateTo) query.set('dateTo', params.dateTo);
    const qs = query.toString() ? `?${query.toString()}` : '';
    return this.request<TrialBalanceReport>(`/accounting/trial-balance${qs}`);
  }

  async getAccountingAuditIntegrity(): Promise<AccountingAuditResult> {
    return this.request<AccountingAuditResult>('/accounting/audit-integrity');
  }

  // ۹. خزانه‌داری
  async getTreasuryAccounts(): Promise<TreasuryAccount[]> {
    return this.request<TreasuryAccount[]>('/treasury/accounts');
  }

  async saveTreasuryAccount(acc: Partial<TreasuryAccount>): Promise<TreasuryAccount> {
    return this.request<TreasuryAccount>('/treasury/accounts', {
      method: 'POST',
      body: JSON.stringify(acc),
    });
  }

  async reconcileTreasuryAccounts(): Promise<{ results: any[]; summary: string }> {
    return this.request<{ results: any[]; summary: string }>('/treasury/reconcile', {
      method: 'POST',
    });
  }

  async getTreasuryTransactions(): Promise<TreasuryTransaction[]> {
    return this.request<TreasuryTransaction[]>('/treasury/transactions');
  }

  async recordTreasuryTransaction(tx: Partial<TreasuryTransaction>): Promise<TreasuryTransaction> {
    return this.request<TreasuryTransaction>('/treasury/transactions', {
      method: 'POST',
      body: JSON.stringify(tx),
    });
  }

  async getFinancialCategories(): Promise<FinancialCategory[]> {
    return this.request<FinancialCategory[]>('/financial/categories');
  }

  async saveFinancialCategory(cat: Partial<FinancialCategory>): Promise<FinancialCategory> {
    return this.request<FinancialCategory>('/financial/categories', {
      method: 'POST',
      body: JSON.stringify(cat),
    });
  }

  // ۱۰. چک‌ها
  async getCheques(): Promise<Cheque[]> {
    return this.request<Cheque[]>('/cheques');
  }

  async saveCheque(cheque: Partial<Cheque>): Promise<Cheque> {
    return this.request<Cheque>('/cheques', {
      method: 'POST',
      body: JSON.stringify(cheque),
    });
  }

  async transitionChequeStatus(id: string, targetStatus: ChequeStatus, params?: any): Promise<Cheque> {
    return this.request<Cheque>(`/cheques/${id}/transition`, {
      method: 'POST',
      body: JSON.stringify({ targetStatus, ...params }),
    });
  }

  // ۱۱. لاگ‌های امنیتی
  async getAuditLogs(): Promise<AuditLog[]> {
    return this.request<AuditLog[]>('/audit-logs');
  }

  // ۱۲. تنظیمات
  async getSettings(): Promise<StoreSettings> {
    return this.request<StoreSettings>('/settings');
  }

  async updateSettings(settings: Partial<StoreSettings>): Promise<StoreSettings> {
    return this.request<StoreSettings>('/settings', {
      method: 'POST',
      body: JSON.stringify(settings),
    });
  }

  // ۱۳. مدیریت سال مالی شمسی، افتتاحیه، اختتامیه و انتقال مانده‌ها
  async getFiscalYears(): Promise<FiscalYear[]> {
    return this.request<FiscalYear[]>('/fiscal-years');
  }

  async saveFiscalYear(fy: Partial<FiscalYear>): Promise<FiscalYear> {
    return this.request<FiscalYear>('/fiscal-years', {
      method: 'POST',
      body: JSON.stringify(fy),
    });
  }

  async activateFiscalYear(id: string): Promise<FiscalYear> {
    return this.request<FiscalYear>(`/fiscal-years/${id}/activate`, {
      method: 'POST',
    });
  }

  async getPreClosingAudit(id: string): Promise<FiscalPreClosingAudit> {
    return this.request<FiscalPreClosingAudit>(`/fiscal-years/${id}/pre-closing-audit`);
  }

  async createTestDraftForFiscalAudit(id: string): Promise<AccountingVoucher> {
    return this.request<AccountingVoucher>(`/fiscal-years/${id}/create-test-draft`, {
      method: 'POST',
    });
  }

  async resolveFiscalYearDrafts(
    id: string,
    action: 'approve_all' | 'delete_drafts'
  ): Promise<{ resolvedCount: number; message: string; audit: FiscalPreClosingAudit }> {
    return this.request<{ resolvedCount: number; message: string; audit: FiscalPreClosingAudit }>(
      `/fiscal-years/${id}/resolve-drafts`,
      {
        method: 'POST',
        body: JSON.stringify({ action }),
      }
    );
  }

  async saveOpeningBalances(
    id: string,
    payload: OpeningBalancePayload
  ): Promise<{ fiscalYear: FiscalYear; openingVoucher: AccountingVoucher; preview: any }> {
    return this.request<{ fiscalYear: FiscalYear; openingVoucher: AccountingVoucher; preview: any }>(
      `/fiscal-years/${id}/opening-balances`,
      {
        method: 'POST',
        body: JSON.stringify(payload),
      }
    );
  }

  async closeFiscalYearAndRollover(
    id: string,
    payload: {
      nextYearCode?: string;
      nextYearTitle?: string;
      notes?: string;
    }
  ): Promise<{
    closedFiscalYear: FiscalYear;
    newFiscalYear: FiscalYear;
    closingTemporaryVoucher: AccountingVoucher;
    closingPermanentVoucher: AccountingVoucher;
    nextYearOpeningVoucher: AccountingVoucher;
    activeFiscalYearSetting: string;
  }> {
    return this.request<{
      closedFiscalYear: FiscalYear;
      newFiscalYear: FiscalYear;
      closingTemporaryVoucher: AccountingVoucher;
      closingPermanentVoucher: AccountingVoucher;
      nextYearOpeningVoucher: AccountingVoucher;
      activeFiscalYearSetting: string;
    }>(`/fiscal-years/${id}/close-and-rollover`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async reopenFiscalYear(id: string, reason: string): Promise<FiscalYear> {
    return this.request<FiscalYear>(`/fiscal-years/${id}/reopen`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  }

  async getFiscalYearArchive(id: string): Promise<{
    fiscalYear: FiscalYear;
    snapshot: FiscalYearArchiveSnapshot;
    trialBalance: TrialBalanceReport;
  }> {
    return this.request<{
      fiscalYear: FiscalYear;
      snapshot: FiscalYearArchiveSnapshot;
      trialBalance: TrialBalanceReport;
    }>(`/fiscal-years/${id}/archive`);
  }

  async runFiscalRolloverTestSuite(): Promise<{
    allPassed: boolean;
    totalSteps: number;
    passedSteps: number;
    executedAt: string;
    steps: {
      stepNumber: number;
      title: string;
      passed: boolean;
      expected: string;
      actual: string;
      details: string;
    }[];
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
  }> {
    return this.request('/fiscal-years/test-rollover', {
      method: 'POST',
    });
  }

  // ۱۴. امنیت، نقش‌های قابل تنظیم (RBAC)، مدیریت نشست و ممیزی عملیات
  async getMyPermissions(): Promise<{
    user: User;
    roleConfig: RolePermissionConfig;
    allRoleConfigs: RolePermissionConfig[];
    confidential: ConfidentialAccessRules;
    policy: SecurityPolicyConfig;
  }> {
    return this.request('/security/my-permissions');
  }

  async getRolePermissions(): Promise<RolePermissionConfig[]> {
    return this.request<RolePermissionConfig[]>('/security/roles');
  }

  async updateRolePermission(
    role: UserRole,
    payload: Partial<RolePermissionConfig>
  ): Promise<RolePermissionConfig> {
    return this.request<RolePermissionConfig>(`/security/roles/${role}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  }

  async resetRolePermissions(): Promise<RolePermissionConfig[]> {
    return this.request<RolePermissionConfig[]>('/security/roles/reset', {
      method: 'POST',
    });
  }

  async getSecurityPolicy(): Promise<SecurityPolicyConfig> {
    return this.request<SecurityPolicyConfig>('/security/policy');
  }

  async updateSecurityPolicy(
    updates: Partial<SecurityPolicyConfig>
  ): Promise<SecurityPolicyConfig> {
    return this.request<SecurityPolicyConfig>('/security/policy', {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }

  async saveUserAccount(payload: Partial<User> & { password?: string }): Promise<User> {
    return this.request<User>('/security/users', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async toggleUserStatusOrUnlock(
    userId: string,
    mode: 'toggle_active' | 'unlock'
  ): Promise<User> {
    return this.request<User>(`/security/users/${userId}/status`, {
      method: 'POST',
      body: JSON.stringify({ mode }),
    });
  }

  async changeUserPassword(
    userId: string,
    payload: { oldPassword?: string; newPassword: string }
  ): Promise<{ success: boolean; message: string }> {
    return this.request<{ success: boolean; message: string }>(
      `/security/users/${userId}/change-password`,
      {
        method: 'POST',
        body: JSON.stringify(payload),
      }
    );
  }

  async getSessions(): Promise<UserSession[]> {
    return this.request<UserSession[]>('/security/sessions');
  }

  async revokeSession(
    sessionId: string,
    reason?: string
  ): Promise<{ success: boolean; session: UserSession }> {
    return this.request<{ success: boolean; session: UserSession }>(
      `/security/sessions/${sessionId}/revoke`,
      {
        method: 'POST',
        body: JSON.stringify({ reason }),
      }
    );
  }

  async authorizeAction(payload: {
    module: PermissionModule;
    action: PermissionAction;
    description: string;
    entityId?: string;
  }): Promise<{ allowed: boolean; reason: string }> {
    return this.request<{ allowed: boolean; reason: string }>('/security/authorize-action', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async getSecuritySummary(): Promise<SecurityCheckSummary> {
    return this.request<SecurityCheckSummary>('/security/summary');
  }

  async runSecurityTestSuite(): Promise<{
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
  }> {
    return this.request('/security/test-suite', {
      method: 'POST',
    });
  }

  // ۱۵. ممیزی ۵گانه، پشتیبان‌گیری/بازیابی واقعی و آزمون‌های یکپارچه ۸ سناریو
  async getSystemReconciliation(): Promise<any> {
    return this.request('/system/reconciliation');
  }

  async exportDatabaseBackup(): Promise<any> {
    return this.request('/system/backup');
  }

  async restoreDatabaseBackup(backupBundle: any): Promise<any> {
    return this.request('/system/restore', {
      method: 'POST',
      body: JSON.stringify(backupBundle),
    });
  }

  async factoryReset(options?: { resetCatalog?: boolean }): Promise<any> {
    return this.request('/system/factory-reset', {
      method: 'POST',
      body: JSON.stringify(options || {}),
    });
  }

  async testBackupAndRestoreCycle(): Promise<any> {
    return this.request('/system/backup-test', {
      method: 'POST',
    });
  }

  async runFullIntegrationSuite(): Promise<any> {
    return this.request('/system/integration-suite', {
      method: 'POST',
    });
  }

  async checkUpdates(): Promise<{
    success: boolean;
    hasUpdates: boolean;
    behindCount: number;
    commits: string[];
    branch?: string;
    message?: string;
  }> {
    return this.request('/system/check-updates', {
      method: 'POST',
    });
  }

  async triggerUpdate(): Promise<{
    success: boolean;
    backupCreated?: boolean;
    message: string;
  }> {
    return this.request('/system/trigger-update', {
      method: 'POST',
    });
  }
}

export const api = new ApiClient();

