import React from 'react';

export interface SectionPillItem<T extends string> {
  id: T;
  label: string;
  icon?: React.ElementType;
  badge?: string | number | null;
  activeColor?: string; // custom Tailwind classes for active tab e.g. 'bg-emerald-600 text-white'
}

interface SectionPillsProps<T extends string> {
  items: SectionPillItem<T>[];
  activeId: T;
  onChange: (id: T) => void;
  className?: string;
}

export function SectionPills<T extends string>({
  items,
  activeId,
  onChange,
  className = '',
}: SectionPillsProps<T>) {
  return (
    <div
      className={`grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-flow-col lg:auto-cols-fr gap-2 ${className}`}
    >
      {items.map((item) => {
        const isActive = activeId === item.id;
        const Icon = item.icon;
        const activeClass = item.activeColor || 'bg-indigo-600 text-white shadow-xs';

        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onChange(item.id)}
            className={`px-3 py-2.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer border ${
              isActive
                ? `${activeClass} border-transparent`
                : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/80'
            }`}
          >
            {Icon && <Icon className="w-3.5 h-3.5 shrink-0" />}
            <span className="truncate">{item.label}</span>
            {item.badge !== undefined && item.badge !== null && (
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-md font-mono ${
                  isActive
                    ? 'bg-white/20 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                }`}
              >
                {item.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
