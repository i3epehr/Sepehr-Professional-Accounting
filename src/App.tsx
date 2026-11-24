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

// The 8 Canonical Category Hubs
import { Dashboard } from './components/dashboard/Dashboard.tsx';
import { SalesPurchasesHub } from './components/sales/SalesPurchasesHub.tsx';
import { InventoryHub } from './components/inventory/InventoryHub.tsx';
import { PersonsHub } from './components/persons/PersonsHub.tsx';
import { FinanceHub } from './components/finance/FinanceHub.tsx';
import { AccountingHub } from './components/accounting/AccountingHub.tsx';
import { ReportsHub } from './components/reports/ReportsHub.tsx';
import { SettingsHub } from './components/settings/SettingsHub.tsx';

// Approved Design Reference: InvoicesModule
import { InvoicesModule } from './components/invoices/InvoicesModule.tsx';

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

  // F2 Shortcut for opening the Invoice Issuance work document
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
    if (isLoggedIn && currentUser) {
      loadDashboardStats();
    }
  }, [activeTab, isLoggedIn, currentUser]);

  const openInvoiceWorkTab = (docType?: string, invToEdit?: Invoice | null) => {
    setEditingInvoice(invToEdit || null);
    setIsInvoiceTabOpen(true);
    setWorkingTabs((prev) => {
      const title = invToEdit ? `ویرایش ${invToEdit.invoiceNumber}` : 'صدور فاکتور (F2)';
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
      setActiveTab('inventory');
    } else if (action === 'new-treasury') {
      setActiveTab('finance');
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

    // Map any legacy or sub-tabs directly to their canonical parent hub
    if (tab === 'returns') {
      setActiveTab('sales-purchases');
    } else if (tab === 'products' || tab === 'units' || tab === 'warehouse' || tab === 'base-info') {
      setActiveTab('inventory');
    } else if (tab === 'treasury' || tab === 'cheques' || tab === 'expenses') {
      setActiveTab('finance');
    } else if (tab === 'financial-reports' || tab === 'fiscal-year') {
      setActiveTab('accounting');
    } else if (tab === 'users' || tab === 'audit' || tab === 'print-backup' || tab === 'foundation') {
      setActiveTab('settings');
    } else {
      setActiveTab(tab);
    }
  };

  // If user is not logged in, render LoginPage
  if (!isLoggedIn || !currentUser) {
    return <LoginPage />;
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col text-slate-800 dark:text-slate-100 transition-colors">
      {/* Top Header */}
      <Header
        onOpenDbStatus={() => setIsDbModalOpen(true)}
        onNavigate={handleNavigate}
        lowStockCount={dashboardStats?.lowStockCount || 0}
        isSidebarCollapsed={isSidebarCollapsed}
        onToggleSidebar={() => setIsSidebarCollapsed((prev) => !prev)}
      />

      {/* Main Layout Body */}
      <div className="flex-1 flex overflow-hidden">
        {/* Streamlined 8-Category Sidebar */}
        <Sidebar
          activeTab={activeTab}
          onSelectTab={handleNavigate}
          lowStockCount={dashboardStats?.lowStockCount || 0}
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={() => setIsSidebarCollapsed((prev) => !prev)}
        />

        {/* Main Workspace */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Multi-Document Working Tabs Bar */}
          <WorkingTabsBar
            tabs={workingTabs}
            activeTabId={activeTab}
            onSelectTab={(tabId) => setActiveTab(tabId as NavigationTab)}
            onCloseTab={handleCloseWorkingTab}
            onCloseAllTabs={handleCloseAllWorkingTabs}
          />

          {/* Main Content Area */}
          <main className="flex-1 overflow-y-auto p-3 sm:p-5 bg-slate-100/70 dark:bg-slate-900/70">
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

              {/* Category 2: Sales & Purchases Hub */}
              {activeTab === 'sales-purchases' && (
                <SalesPurchasesHub
                  onOpenNewInvoice={(docType) => openInvoiceWorkTab(docType)}
                  onEditInvoice={(inv) => openInvoiceWorkTab(inv.invoiceType, inv)}
                />
              )}

              {/* Active Work Document: Invoice Issuance (Approved Design Reference) - Preserved when switching tabs! */}
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

              {/* Category 3: Inventory & Warehouse Hub */}
              {activeTab === 'inventory' && <InventoryHub />}

              {/* Category 4: Persons & Counterparties Hub */}
              {activeTab === 'persons' && <PersonsHub />}

              {/* Category 5: Finance & Treasury Hub */}
              {activeTab === 'finance' && <FinanceHub />}

              {/* Category 6: Accounting & Double-Entry Ledgers Hub */}
              {activeTab === 'accounting' && <AccountingHub />}

              {/* Category 7: Comprehensive Reports Hub */}
              {activeTab === 'reports' && <ReportsHub />}

              {/* Category 8: Settings, Security & Configuration Hub */}
              {activeTab === 'settings' && <SettingsHub />}
            </div>
          </main>
        </div>
      </div>

      {/* Desktop ERP Status Bar */}
      <footer className="bg-slate-200 dark:bg-slate-900 border-t border-slate-300 dark:border-slate-800 text-[11px] px-4 py-1.5 flex flex-wrap items-center justify-between gap-3 text-slate-600 dark:text-slate-400 select-none print:hidden">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="font-bold text-slate-700 dark:text-slate-200">سیستم حسابداری سپهر آماده به‌کار</span>
          </div>
          <span className="text-slate-300 dark:text-slate-700">|</span>
          <div className="hidden sm:flex items-center gap-1">
            <span className="font-semibold text-slate-500">رسته صنفی:</span>
            <span className="text-indigo-600 dark:text-indigo-400 font-bold">
              {settings.guildName || 'صنف خرازی و ملزومات خیاطی'}
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
          <span className="text-[10px] text-slate-400 font-mono">نسخه ۴.۵ حسابداری سپهر</span>
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
