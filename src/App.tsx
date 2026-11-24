/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext.tsx';
import { SettingsProvider, useSettings } from './context/SettingsContext.tsx';
import { ThemeProvider } from './context/ThemeContext.tsx';
import { LoginPage } from './components/auth/LoginPage.tsx';
import { Header } from './components/layout/Header.tsx';
import { Sidebar, NavigationTab } from './components/layout/Sidebar.tsx';
import { WorkingTabsBar, WorkingTab } from './components/common/WorkingTabsBar.tsx';
import { ShoppingCart } from 'lucide-react';
import { Invoice } from './types/index.ts';
import { APP_VERSION } from './version.ts';

// Main Hubs & Direct Navigation Sub-Pages
import { Dashboard } from './components/dashboard/Dashboard.tsx';
import { SalesPurchasesHub } from './components/sales/SalesPurchasesHub.tsx';
import { InvoicesModule } from './components/invoices/InvoicesModule.tsx';
import { ReturnsModule } from './components/returns/ReturnsModule.tsx';

import { InventoryHub } from './components/inventory/InventoryHub.tsx';
import { ProductsModule } from './components/products/ProductsModule.tsx';
import { WarehouseModule } from './components/warehouse/WarehouseModule.tsx';
import { UnitsModule } from './components/units/UnitsModule.tsx';
import { BaseInfoModule } from './components/base/BaseInfoModule.tsx';

import { PersonsHub } from './components/persons/PersonsHub.tsx';

import { FinanceHub } from './components/finance/FinanceHub.tsx';
import { TreasuryModule } from './components/treasury/TreasuryModule.tsx';
import { ChequesModule } from './components/cheques/ChequesModule.tsx';
import { ExpensesModule } from './components/expenses/ExpensesModule.tsx';

import { AccountingHub } from './components/accounting/AccountingHub.tsx';
import { AccountingModule } from './components/accounting/AccountingModule.tsx';
import { FinancialReportsModule } from './components/financial/FinancialReportsModule.tsx';
import { FiscalYearModule } from './components/fiscal/FiscalYearModule.tsx';

import { ReportsHub } from './components/reports/ReportsHub.tsx';

import { SettingsHub } from './components/settings/SettingsHub.tsx';
import { SettingsModule } from './components/settings/SettingsModule.tsx';
import { PrintBackupModule } from './components/backup/PrintBackupModule.tsx';
import { SystemMaintenanceModule } from './components/settings/SystemMaintenanceModule.tsx';
import { UsersModule } from './components/users/UsersModule.tsx';
import { AuditLogsModule } from './components/audit/AuditLogsModule.tsx';
import { FoundationModule } from './components/foundation/FoundationModule.tsx';

import { DatabaseStatusModal } from './components/database/DatabaseStatusModal.tsx';
import { api } from './lib/api.ts';

function MainApp() {
  const { currentUser, isLoggedIn } = useAuth();
  const { settings } = useSettings();
  const [activeTab, setActiveTab] = useState<NavigationTab>('dashboard');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(false);
  const [isDbModalOpen, setIsDbModalOpen] = useState<boolean>(false);
  const [dashboardStats, setDashboardStats] = useState<any>(null);
  const [isStatsLoading, setIsStatsLoading] = useState<boolean>(true);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Multi-document Working Tabs Bar (نوار تب‌های کاری)
  const [workingTabs, setWorkingTabs] = useState<WorkingTab[]>([]);
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
  const [isInvoiceTabOpen, setIsInvoiceTabOpen] = useState<boolean>(false);

  useEffect(() => {
    const originalAlert = window.alert;
    window.alert = (msg?: any) => {
      setToastMessage(String(msg ?? ''));
    };
    return () => {
      window.alert = originalAlert;
    };
  }, []);

  useEffect(() => {
    if (!toastMessage) return;
    const timer = setTimeout(() => setToastMessage(null), 4500);
    return () => clearTimeout(timer);
  }, [toastMessage]);

  const loadDashboardStats = async () => {
    try {
      setIsStatsLoading(true);
      const data = await api.getDashboard();
      setDashboardStats(data);
    } catch (err) {
      console.error('Failed to load dashboard stats:', err);
    } finally {
      setIsStatsLoading(false);
    }
  };

  useEffect(() => {
    if (isLoggedIn) {
      loadDashboardStats();
    }
  }, [isLoggedIn]);

  // F2 Shortcut for Instant Invoice Creation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F2') {
        e.preventDefault();
        openInvoiceWorkTab();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const openInvoiceWorkTab = (docType?: string, invoiceToEdit?: Invoice) => {
    setIsInvoiceTabOpen(true);
    setEditingInvoice(invoiceToEdit || null);

    const title = invoiceToEdit
      ? `ویرایش ${invoiceToEdit.invoiceNumber}`
      : docType === 'purchase'
      ? 'صدور فاکتور خرید'
      : 'صدور فاکتور فروش';

    setWorkingTabs((prev) => {
      const existing = prev.find((t) => t.id === 'invoices');
      if (existing) {
        return prev.map((t) => (t.id === 'invoices' ? { ...t, title, metadata: { docType } } : t));
      }
      return [
        ...prev,
        {
          id: 'invoices',
          title,
          category: 'sales-purchases',
          icon: ShoppingCart,
          closable: true,
          metadata: { docType },
        },
      ];
    });
    setActiveTab('invoices');
  };

  const handleCloseWorkingTab = (tabId: string) => {
    setWorkingTabs((prev) => prev.filter((t) => t.id !== tabId));
    if (tabId === 'invoices') {
      setIsInvoiceTabOpen(false);
      setEditingInvoice(null);
    }
    if (activeTab === tabId) {
      setActiveTab('sales-purchases');
    }
  };

  const handleCloseAllWorkingTabs = () => {
    setWorkingTabs([]);
    setIsInvoiceTabOpen(false);
    setEditingInvoice(null);
    if (activeTab === 'invoices') {
      setActiveTab('sales-purchases');
    }
  };

  const handleQuickAction = (action: string) => {
    if (action === 'new-sale-invoice') {
      openInvoiceWorkTab('sale');
    } else if (action === 'new-product') {
      setActiveTab('products');
    } else if (action === 'new-treasury') {
      setActiveTab('treasury');
    }
  };

  const handleNavigate = (tab: NavigationTab, metadata?: any) => {
    if (tab === 'database') {
      setIsDbModalOpen(true);
      return;
    }

    if (tab === 'invoices') {
      openInvoiceWorkTab(metadata?.docType);
      return;
    }

    setActiveTab(tab);
  };

  // If user is not logged in, render LoginPage
  if (!isLoggedIn || !currentUser) {
    return <LoginPage />;
  }

  return (
    <div className="h-screen w-screen bg-slate-50 dark:bg-slate-950 flex flex-col text-slate-800 dark:text-slate-100 transition-colors overflow-hidden">
      {/* Top Header (Fixed Height, Shrink 0) */}
      <Header
        onOpenDbStatus={() => setIsDbModalOpen(true)}
        onNavigate={handleNavigate}
        lowStockCount={dashboardStats?.lowStockCount || 0}
        isSidebarCollapsed={isSidebarCollapsed}
        onToggleSidebar={() => setIsSidebarCollapsed((prev) => !prev)}
      />

      {/* Main Layout Body */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        {/* Streamlined Submenu Sidebar with Pinned Exit Button */}
        <Sidebar
          activeTab={activeTab}
          onSelectTab={handleNavigate}
          lowStockCount={dashboardStats?.lowStockCount || 0}
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={() => setIsSidebarCollapsed((prev) => !prev)}
        />

        {/* Main Workspace Area */}
        <div className="flex-1 flex flex-col overflow-hidden min-h-0">
          {/* Multi-Document Working Tabs Bar */}
          <WorkingTabsBar
            tabs={workingTabs}
            activeTabId={activeTab}
            onSelectTab={(tabId) => setActiveTab(tabId as NavigationTab)}
            onCloseTab={handleCloseWorkingTab}
            onCloseAllTabs={handleCloseAllWorkingTabs}
          />

          {/* Main Content Area (Independent Scroll Container) */}
          <main className="flex-1 overflow-y-auto p-3 sm:p-5 bg-slate-100/70 dark:bg-slate-900/70 min-h-0">
            <div className="max-w-7xl mx-auto">
              {/* Category 1: Dashboard */}
              {activeTab === 'dashboard' && (
                <Dashboard
                  stats={dashboardStats}
                  onNavigate={handleNavigate}
                  onQuickAction={handleQuickAction}
                  onRefreshStats={loadDashboardStats}
                  isLoading={isStatsLoading}
                />
              )}

              {/* Active Work Document: Invoice Issuance (Approved Design Reference) */}
              {isInvoiceTabOpen && (
                <div className={activeTab === 'invoices' ? 'block' : 'hidden'}>
                  <InvoicesModule
                    initialOpenCreate={true}
                    editingInvoice={editingInvoice}
                    onFinished={() => {
                      handleCloseWorkingTab('invoices');
                      setActiveTab('sales-purchases');
                    }}
                  />
                </div>
              )}

              {/* Category 2: Sales & Purchases Sub-Pages */}
              {activeTab === 'sales-purchases' && (
                <SalesPurchasesHub
                  onOpenNewInvoice={(docType) => openInvoiceWorkTab(docType)}
                  onEditInvoice={(inv) => openInvoiceWorkTab(inv.invoiceType, inv)}
                />
              )}
              {activeTab === 'returns' && <ReturnsModule />}

              {/* Category 3: Inventory Sub-Pages */}
              {activeTab === 'inventory' && <InventoryHub />}
              {activeTab === 'products' && <ProductsModule />}
              {activeTab === 'warehouse' && <WarehouseModule />}
              {activeTab === 'units' && <UnitsModule />}
              {activeTab === 'base-info' && <BaseInfoModule />}

              {/* Category 4: Persons Sub-Pages */}
              {activeTab === 'persons' && <PersonsHub />}

              {/* Category 5: Finance & Treasury Sub-Pages */}
              {activeTab === 'finance' && <FinanceHub />}
              {activeTab === 'treasury' && <TreasuryModule />}
              {activeTab === 'cheques' && <ChequesModule />}
              {activeTab === 'expenses' && <ExpensesModule />}

              {/* Category 6: Accounting Sub-Pages */}
              {activeTab === 'accounting' && <AccountingModule />}
              {activeTab === 'financial-reports' && <FinancialReportsModule />}
              {activeTab === 'fiscal-year' && <FiscalYearModule />}

              {/* Category 7: Comprehensive Reports */}
              {activeTab === 'reports' && <ReportsHub />}

              {/* Category 8: Settings & System Maintenance Sub-Pages */}
              {activeTab === 'settings' && <SettingsModule />}
              {activeTab === 'print-backup' && <PrintBackupModule />}
              {activeTab === 'system-maintenance' && <SystemMaintenanceModule />}
              {activeTab === 'users' && <UsersModule />}
              {activeTab === 'audit' && <AuditLogsModule />}
              {activeTab === 'foundation' && <FoundationModule />}
            </div>
          </main>
        </div>
      </div>

      {/* Desktop ERP Status Bar (Pinned Bottom, Dynamic Version) */}
      <footer className="shrink-0 bg-slate-200 dark:bg-slate-900 border-t border-slate-300 dark:border-slate-800 text-[11px] px-4 py-1.5 flex flex-wrap items-center justify-between gap-3 text-slate-600 dark:text-slate-400 select-none print:hidden">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="font-bold text-slate-700 dark:text-slate-200">سیستم حسابداری سپهر آماده به‌کار</span>
          </div>
          <span className="text-slate-300 dark:text-slate-700">|</span>
          <div className="hidden sm:flex items-center gap-1">
            <span className="font-semibold text-slate-500">رسته صنفی:</span>
            <span className="text-indigo-600 dark:text-indigo-400 font-bold">
              {settings.guildName || 'صنف بازرگانی و فروشگاهی'}
            </span>
          </div>
          <span className="text-slate-300 dark:text-slate-700 hidden sm:inline">|</span>
          <div className="hidden md:flex items-center gap-1">
            <span className="font-semibold text-slate-500">سال مالی فعال:</span>
            <span className="font-bold text-slate-700 dark:text-slate-300">
              {settings.activeFiscalYear || '۱۴۰۳'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 text-[10px] bg-slate-300/60 dark:bg-slate-800 px-2 py-0.5 rounded text-slate-700 dark:text-slate-300">
            <kbd className="font-mono bg-white dark:bg-slate-700 px-1 rounded shadow-2xs font-bold">F2</kbd>
            <span>صدور فاکتور جدید</span>
          </div>
          <div className="hidden lg:flex items-center gap-1 text-[10px] bg-slate-300/60 dark:bg-slate-800 px-2 py-0.5 rounded text-slate-700 dark:text-slate-300">
            <kbd className="font-mono bg-white dark:bg-slate-700 px-1 rounded shadow-2xs font-bold">Esc</kbd>
            <span>بستن پنجره</span>
          </div>
          <span className="text-[10px] text-slate-400 font-mono">نسخه v{APP_VERSION} حسابداری سپهر</span>
        </div>
      </footer>

      {/* Non-blocking Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-5 left-5 z-50 max-w-md bg-slate-900 text-white px-4 py-3 rounded-xl shadow-xl border border-slate-700 flex items-center justify-between gap-3 text-xs font-bold">
          <span>{toastMessage}</span>
          <button
            type="button"
            onClick={() => setToastMessage(null)}
            className="text-slate-400 hover:text-white px-1.5 py-0.5 rounded cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      <DatabaseStatusModal
        isOpen={isDbModalOpen}
        onClose={() => setIsDbModalOpen(false)}
      />
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <SettingsProvider>
          <MainApp />
        </SettingsProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
