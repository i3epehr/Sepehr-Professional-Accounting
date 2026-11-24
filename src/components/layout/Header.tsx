import React, { useState } from 'react';
import {
  Store,
  Calendar,
  UserCheck,
  ChevronDown,
  Bell,
  Sun,
  Moon,
  Shield,
  PanelRightClose,
  PanelRightOpen,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.tsx';
import { useSettings } from '../../context/SettingsContext.tsx';
import { useTheme } from '../../context/ThemeContext.tsx';
import { toPersianDigits, getCurrentJalaliDatePersian } from '../../lib/formatters.ts';
import { NavigationTab } from './Sidebar.tsx';
import { NotificationsPopover } from '../common/NotificationsPopover.tsx';
import { UserProfileModal } from '../common/UserProfileModal.tsx';
import { UserRole } from '../../types/index.ts';

interface HeaderProps {
  onOpenDbStatus?: () => void;
  onNavigate?: (tab: NavigationTab, metadata?: any) => void;
  lowStockCount?: number;
  isSidebarCollapsed?: boolean;
  onToggleSidebar?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  onNavigate,
  lowStockCount = 0,
  isSidebarCollapsed = false,
  onToggleSidebar,
}) => {
  const { currentUser, users, switchUser, switchRole } = useAuth();
  const { settings } = useSettings();
  const { theme, toggleTheme } = useTheme();

  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'admin':
        return (
          <span className="bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 text-[10px] px-2 py-0.5 rounded-md font-bold">
            مدیر سیستم
          </span>
        );
      case 'accountant':
        return (
          <span className="bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300 text-[10px] px-2 py-0.5 rounded-md font-bold">
            حسابدار
          </span>
        );
      case 'cashier':
        return (
          <span className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 text-[10px] px-2 py-0.5 rounded-md font-bold">
            صندوق‌دار / شاگرد
          </span>
        );
      case 'inventory_clerk':
        return (
          <span className="bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 text-[10px] px-2 py-0.5 rounded-md font-bold">
            انباردار
          </span>
        );
      default:
        return null;
    }
  };

  const handleNavigateProxy = (tab: NavigationTab, metadata?: any) => {
    if (onNavigate) {
      onNavigate(tab, metadata);
    }
  };

  return (
    <>
      <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-30 transition-colors">
        <div className="px-3 sm:px-5">
          <div className="flex justify-between h-14 items-center gap-3">
            {/* Right: Sidebar Toggle + Store Name */}
            <div className="flex items-center gap-2.5 shrink-0">
              <div className="w-9 h-9 rounded-lg bg-indigo-600 flex items-center justify-center text-white shrink-0">
                <Store className="w-4 h-4" />
              </div>

              <div>
                <h1 className="font-black text-slate-800 dark:text-slate-100 text-sm sm:text-base leading-tight">
                  {settings.storeName}
                </h1>
              </div>
            </div>

            {/* Left Toolbar (No Top Search Bar as requested) */}
            <div className="flex items-center gap-2">
              {/* سال مالی و تاریخ روز */}
              <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold">
                <Calendar className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                <span>سال مالی {toPersianDigits(settings.activeFiscalYear)}</span>
                <span className="text-slate-300 dark:text-slate-600">|</span>
                <span>{getCurrentJalaliDatePersian()}</span>
              </div>

              {/* دکمه تغییر تم روشن / تاریک */}
              <button
                type="button"
                onClick={toggleTheme}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition cursor-pointer text-xs font-bold"
                title={theme === 'dark' ? 'تغییر به حالت روشن' : 'تغییر به حالت تاریک'}
              >
                {theme === 'dark' ? (
                  <>
                    <Sun className="w-4 h-4 text-amber-400" />
                    <span className="hidden sm:inline">حالت روز</span>
                  </>
                ) : (
                  <>
                    <Moon className="w-4 h-4 text-indigo-600" />
                    <span className="hidden sm:inline">حالت شب</span>
                  </>
                )}
              </button>

              {/* اعلان‌ها */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
                  className={`p-2 rounded-lg border transition relative cursor-pointer ${
                    isNotificationsOpen
                      ? 'bg-indigo-50 dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800'
                      : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
                  }`}
                  title="اعلان‌ها"
                >
                  <Bell className="w-4 h-4" />
                  {lowStockCount > 0 && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 bg-amber-500 text-white rounded-full text-[10px] flex items-center justify-center font-bold">
                      {lowStockCount > 9 ? '+۹' : toPersianDigits(lowStockCount)}
                    </span>
                  )}
                </button>

                <NotificationsPopover
                  isOpen={isNotificationsOpen}
                  onClose={() => setIsNotificationsOpen(false)}
                  onNavigate={handleNavigateProxy}
                />
              </div>

            </div>
          </div>
        </div>
      </header>

      <UserProfileModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
      />
    </>
  );
};
