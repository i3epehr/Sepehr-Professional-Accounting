import React from 'react';
import { X, Layers, ShoppingCart, User, Package, Scale, Wallet, FileText } from 'lucide-react';

export interface WorkingTab {
  id: string;
  title: string;
  category: string;
  icon?: React.ElementType;
  closable?: boolean;
  metadata?: any;
}

interface WorkingTabsBarProps {
  tabs: WorkingTab[];
  activeTabId: string;
  onSelectTab: (id: string) => void;
  onCloseTab: (id: string) => void;
  onCloseAllTabs?: () => void;
}

export const WorkingTabsBar: React.FC<WorkingTabsBarProps> = ({
  tabs,
  activeTabId,
  onSelectTab,
  onCloseTab,
  onCloseAllTabs,
}) => {
  // If there are no work tabs (only the default central page or empty), we can show minimal or nothing
  if (tabs.length === 0) return null;

  return (
    <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-3 sm:px-5 py-1.5 flex items-center justify-between gap-2 overflow-x-auto select-none print:hidden">
      <div className="flex items-center gap-1.5 overflow-x-auto py-0.5 scrollbar-thin">
        <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 pl-2 shrink-0 flex items-center gap-1">
          <Layers className="w-3 h-3 text-indigo-500" />
          <span>برگه‌های کاری باز:</span>
        </span>

        {tabs.map((tab) => {
          const isActive = tab.id === activeTabId;
          const Icon = tab.icon || FileText;

          return (
            <div
              key={tab.id}
              onClick={() => onSelectTab(tab.id)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer border shrink-0 ${
                isActive
                  ? 'bg-indigo-50 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800 shadow-2xs'
                  : 'bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 border-slate-200/80 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <Icon className="w-3.5 h-3.5 shrink-0 text-indigo-600 dark:text-indigo-400" />
              <span className="truncate max-w-[150px] sm:max-w-[200px]">{tab.title}</span>
              {tab.closable !== false && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onCloseTab(tab.id);
                  }}
                  title="بستن برگه کاری"
                  className="text-slate-400 hover:text-rose-500 dark:hover:text-rose-400 p-0.5 rounded hover:bg-slate-200/60 dark:hover:bg-slate-700 cursor-pointer transition"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          );
        })}
      </div>

      {tabs.length > 2 && onCloseAllTabs && (
        <button
          type="button"
          onClick={onCloseAllTabs}
          className="text-[10px] font-bold text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 px-2 py-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer shrink-0"
        >
          بستن همه
        </button>
      )}
    </div>
  );
};
