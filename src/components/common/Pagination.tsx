import React from 'react';
import { ChevronRight, ChevronLeft } from 'lucide-react';
import { toPersianDigits } from '../../lib/formatters.ts';

interface PaginationProps {
  currentPage: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  pageSizeOptions?: number[];
  className?: string;
}

export const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalItems,
  pageSize,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 20, 50, 100],
  className = '',
}) => {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

  if (totalItems === 0) return null;

  const startItem = (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(totalItems, currentPage * pageSize);

  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      if (currentPage <= 4) {
        pages.push(1, 2, 3, 4, 5, '...', totalPages);
      } else if (currentPage >= totalPages - 3) {
        pages.push(1, '...', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages);
      } else {
        pages.push(1, '...', currentPage - 1, currentPage, currentPage + 1, '...', totalPages);
      }
    }
    return pages;
  };

  return (
    <div
      dir="rtl"
      className={`flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400 ${className}`}
    >
      {/* Items Count Summary & Page Size Switcher */}
      <div className="flex items-center gap-3">
        <span>
          نمایش ردیف <strong className="text-slate-800 dark:text-slate-200 font-mono">{toPersianDigits(startItem)}</strong> تا{' '}
          <strong className="text-slate-800 dark:text-slate-200 font-mono">{toPersianDigits(endItem)}</strong> از مجموع{' '}
          <strong className="text-slate-800 dark:text-slate-200 font-mono">{toPersianDigits(totalItems)}</strong> مورد
        </span>

        {onPageSizeChange && (
          <div className="flex items-center gap-1.5 mr-2">
            <span className="text-[11px]">تعداد:</span>
            <select
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              className="px-2 py-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold font-mono"
            >
              {pageSizeOptions.map((sz) => (
                <option key={sz} value={sz}>
                  {toPersianDigits(sz)}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Page Navigation Controls */}
      <div className="flex items-center gap-1">
        {/* Previous Page */}
        <button
          type="button"
          disabled={currentPage === 1}
          onClick={() => onPageChange(currentPage - 1)}
          className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition flex items-center gap-1 text-[11px] font-bold"
        >
          <ChevronRight className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">قبلی</span>
        </button>

        {/* Page Buttons */}
        <div className="flex items-center gap-1">
          {getPageNumbers().map((p, idx) => {
            if (p === '...') {
              return (
                <span key={`dots-${idx}`} className="px-2 py-1 text-slate-400 select-none">
                  ...
                </span>
              );
            }
            const isCurrent = p === currentPage;
            return (
              <button
                key={`page-${p}`}
                type="button"
                onClick={() => onPageChange(Number(p))}
                className={`w-7 h-7 rounded-lg text-xs font-bold font-mono transition cursor-pointer flex items-center justify-center ${
                  isCurrent
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                }`}
              >
                {toPersianDigits(p)}
              </button>
            );
          })}
        </div>

        {/* Next Page */}
        <button
          type="button"
          disabled={currentPage === totalPages}
          onClick={() => onPageChange(currentPage + 1)}
          className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition flex items-center gap-1 text-[11px] font-bold"
        >
          <span className="hidden sm:inline">بعدی</span>
          <ChevronLeft className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
