import React from 'react';

interface PageHeaderAction {
  label: string;
  icon?: React.ElementType;
  onClick: () => void;
  color?: 'indigo' | 'emerald' | 'amber' | 'slate';
  disabled?: boolean;
}

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  icon: React.ElementType;
  badge?: string;
  primaryAction?: PageHeaderAction;
  secondaryActions?: PageHeaderAction[];
  children?: React.ReactNode;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  subtitle,
  icon: Icon,
  badge,
  primaryAction,
  secondaryActions,
  children,
}) => {
  const getButtonClass = (color: 'indigo' | 'emerald' | 'amber' | 'slate' = 'indigo') => {
    switch (color) {
      case 'emerald':
        return 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs';
      case 'amber':
        return 'bg-amber-500 hover:bg-amber-600 text-white shadow-xs';
      case 'slate':
        return 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700';
      case 'indigo':
      default:
        return 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs';
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs p-4">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        {/* Title & Icon & Subtitle */}
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
            <Icon className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base font-black text-slate-800 dark:text-white">
                {title}
              </h2>
              {badge && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                  {badge}
                </span>
              )}
            </div>
            {subtitle && (
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                {subtitle}
              </p>
            )}
          </div>
        </div>

        {/* Action Buttons & Children */}
        <div className="flex flex-wrap items-center gap-2">
          {children}

          {secondaryActions?.map((sec, idx) => {
            const SecIcon = sec.icon;
            return (
              <button
                key={idx}
                type="button"
                onClick={sec.onClick}
                disabled={sec.disabled}
                className={`px-3 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50 ${getButtonClass(
                  sec.color || 'slate'
                )}`}
              >
                {SecIcon && <SecIcon className="w-4 h-4 shrink-0" />}
                <span>{sec.label}</span>
              </button>
            );
          })}

          {primaryAction && (
            <button
              type="button"
              onClick={primaryAction.onClick}
              disabled={primaryAction.disabled}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50 ${getButtonClass(
                primaryAction.color || 'indigo'
              )}`}
            >
              {primaryAction.icon && <primaryAction.icon className="w-4 h-4 shrink-0" />}
              <span>{primaryAction.label}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
