import React, { useState, useMemo } from 'react';
import { Search, User, Phone, Check, X, ShieldAlert, Users, CreditCard } from 'lucide-react';
import { Person } from '../../types/index.ts';
import { toPersianDigits, formatCurrency } from '../../lib/formatters.ts';

interface PersonSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  persons: Person[];
  selectedPersonId: string;
  onSelectPerson: (person: Person) => void;
  roleFilter?: 'customer' | 'supplier' | 'all';
  targetType?: 'customer' | 'supplier' | 'all';
}

export const PersonSelectorModal: React.FC<PersonSelectorModalProps> = ({
  isOpen,
  onClose,
  persons,
  selectedPersonId,
  onSelectPerson,
  roleFilter = 'all',
  targetType,
}) => {
  const effectiveFilter = targetType || roleFilter;
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'all' | 'customer' | 'supplier'>(
    effectiveFilter === 'supplier' ? 'supplier' : effectiveFilter === 'customer' ? 'customer' : 'all'
  );

  const filteredPersons = useMemo(() => {
    return persons.filter((p) => {
      // Role filter
      if (activeTab === 'customer') {
        if (p.personType !== 'customer' && p.personType !== 'both') return false;
      } else if (activeTab === 'supplier') {
        if (p.personType !== 'supplier' && p.personType !== 'both') return false;
      }

      // Search term
      if (!searchTerm.trim()) return true;
      const term = searchTerm.trim().toLowerCase();
      const name = (p.name || '').toLowerCase();
      const code = (p.code || '').toLowerCase();
      const phone = (p.phone || '').toLowerCase();
      const mobile = (p.mobile || '').toLowerCase();
      const extra = ((p as any).company || p.notes || '').toLowerCase();

      return (
        name.includes(term) ||
        code.includes(term) ||
        phone.includes(term) ||
        mobile.includes(term) ||
        extra.includes(term)
      );
    });
  }, [persons, searchTerm, activeTab]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5">
      <div className="bg-white dark:bg-slate-900 w-full max-w-3xl rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col max-h-[88vh] overflow-hidden">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/60">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-black text-sm text-slate-800 dark:text-white">
                انتخاب سریع طرف حساب / مشتری
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                جستجوی آنی بر اساس نام، شماره تلفن، کد حسابداری یا نام شرکت
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filter Bar & Tabs */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 space-y-3 bg-white dark:bg-slate-900">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute right-3 top-3" />
              <input
                type="text"
                autoFocus
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="جستجوی نام شخص، موبایل یا کد حسابداری..."
                className="w-full pr-9 pl-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="absolute left-2.5 top-2.5 text-slate-400 hover:text-slate-600 text-xs cursor-pointer"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Quick Type Filter Tabs */}
            <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl shrink-0 gap-1">
              <button
                type="button"
                onClick={() => setActiveTab('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                  activeTab === 'all'
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                همه ({toPersianDigits(persons.length)})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('customer')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                  activeTab === 'customer'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                مشتریان
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('supplier')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                  activeTab === 'supplier'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                تأمین‌کنندگان
              </button>
            </div>
          </div>
        </div>

        {/* Persons List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {filteredPersons.length === 0 ? (
            <div className="py-12 text-center text-slate-400 space-y-2">
              <User className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-700 stroke-[1.5]" />
              <p className="text-xs font-bold">هیچ طرف حسابی با عبارت «{searchTerm}» یافت نشد.</p>
              <p className="text-[11px] text-slate-500">می‌توانید کلمه جستجو را ویرایش کرده یا تب دیگری را انتخاب کنید.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {filteredPersons.map((person) => {
                const isSelected = person.id === selectedPersonId;
                const isDebtor = person.currentBalance > 0;
                const isCreditor = person.currentBalance < 0;

                return (
                  <div
                    key={person.id}
                    onClick={() => {
                      onSelectPerson(person);
                      onClose();
                    }}
                    className={`p-3 rounded-xl border transition-all cursor-pointer text-right flex flex-col justify-between ${
                      isSelected
                        ? 'bg-indigo-50/80 dark:bg-indigo-950/40 border-indigo-500 ring-2 ring-indigo-500/20'
                        : 'bg-white dark:bg-slate-800/80 border-slate-200 dark:border-slate-700/80 hover:border-indigo-300 dark:hover:border-indigo-700 hover:bg-slate-50 dark:hover:bg-slate-800 shadow-2xs'
                    }`}
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <div
                            className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 ${
                              isSelected
                                ? 'bg-indigo-600 text-white'
                                : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                            }`}
                          >
                            <User className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <h4 className="font-black text-xs text-slate-800 dark:text-slate-100 leading-tight">
                                {person.name}
                              </h4>
                              {person.code && (
                                <span className="text-[10px] text-slate-400 font-mono">
                                  #{toPersianDigits(person.code)}
                                </span>
                              )}
                            </div>
                            {((person as any).company || person.notes) && (
                              <span className="text-[10px] text-slate-500 dark:text-slate-400 block mt-0.5">
                                {(person as any).company || person.notes}
                              </span>
                            )}
                          </div>
                        </div>

                        {isSelected && (
                          <span className="px-2 py-0.5 rounded-full bg-indigo-600 text-white text-[10px] font-bold flex items-center gap-1">
                            <Check className="w-3 h-3" />
                            انتخاب‌شده
                          </span>
                        )}
                      </div>

                      {/* Phone / Mobile */}
                      <div className="mt-2 text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5 font-mono">
                        <Phone className="w-3 h-3 text-slate-400" />
                        <span>{person.mobile || person.phone || 'بدون شماره ثبت‌شده'}</span>
                      </div>
                    </div>

                    {/* Balance & Credit Limit Footer */}
                    <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-700/80 flex items-center justify-between text-xs">
                      <div>
                        <span className="text-[10px] text-slate-400 block">مانده حساب:</span>
                        <span
                          className={`font-black ${
                            isDebtor
                              ? 'text-rose-600 dark:text-rose-400'
                              : isCreditor
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : 'text-slate-600 dark:text-slate-400'
                          }`}
                        >
                          {person.currentBalance === 0
                            ? 'بی‌حساب (تسویه)'
                            : `${formatCurrency(Math.abs(person.currentBalance))} (${
                                isDebtor ? 'بدهکار' : 'بستانکار'
                              })`}
                        </span>
                      </div>

                      {person.creditLimit > 0 && (
                        <div className="text-left">
                          <span className="text-[10px] text-slate-400 block">سقف اعتبار:</span>
                          <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                            {formatCurrency(person.creditLimit)}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3 bg-slate-50 dark:bg-slate-800/60 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs">
          <span className="text-slate-500 dark:text-slate-400">
            تعداد یافته‌ها: <b className="text-slate-800 dark:text-white">{toPersianDigits(filteredPersons.length)}</b> شخص
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 font-bold transition cursor-pointer"
          >
            بستن
          </button>
        </div>
      </div>
    </div>
  );
};
