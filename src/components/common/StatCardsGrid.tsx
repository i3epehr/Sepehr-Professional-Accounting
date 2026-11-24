import React from 'react';

export interface StatCardItem {
  title: string;
  value: string | number;
  subtitle?: React.ReactNode;
  icon: React.ElementType;
  color?: 'indigo' | 'emerald' | 'amber' | 'rose' | 'slate';
}

interface StatCardsGridProps {
  cards: StatCardItem[];
  columns?: 2 | 3 | 4;
}

export const StatCardsGrid: React.FC<StatCardsGridProps> = ({
  cards,
  columns = 4,
}) => {
  const getIconClass = (color: string = 'indigo') => {
    switch (color) {
      case 'emerald':
        return 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400';
      case 'amber':
        return 'bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400';
      case 'rose':
        return 'bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400';
      case 'slate':
        return 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400';
      case 'indigo':
      default:
        return 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400';
    }
  };

  const getValueClass = (color: string = 'indigo') => {
    switch (color) {
      case 'emerald':
        return 'text-emerald-700 dark:text-emerald-400';
      case 'amber':
        return 'text-amber-700 dark:text-amber-400';
      case 'rose':
        return 'text-rose-700 dark:text-rose-400';
      case 'slate':
      case 'indigo':
      default:
        return 'text-slate-900 dark:text-white';
    }
  };

  const getColsClass = () => {
    if (columns === 2) return 'grid-cols-1 sm:grid-cols-2';
    if (columns === 3) return 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3';
    return 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4';
  };

  return (
    <div className={`grid ${getColsClass()} gap-4`}>
      {cards.map((c, idx) => {
        const Icon = c.icon;
        return (
          <div
            key={idx}
            className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between"
          >
            <div className="flex justify-between items-start">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                {c.title}
              </span>
              <div
                className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${getIconClass(
                  c.color
                )}`}
              >
                <Icon className="w-4 h-4" />
              </div>
            </div>

            <div className="mt-2.5">
              <div
                className={`text-lg font-black tracking-tight ${getValueClass(
                  c.color
                )}`}
              >
                {c.value}
              </div>
              {c.subtitle && (
                <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 flex items-center justify-between">
                  {c.subtitle}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
