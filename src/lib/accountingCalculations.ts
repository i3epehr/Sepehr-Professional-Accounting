import {
  AccountingAccount,
  AccountingVoucher,
  VoucherLine,
  Person,
  TreasuryAccount,
} from '../types/index.ts';

export interface VoucherValidationResult {
  isBalanced: boolean;
  totalDebit: number;
  totalCredit: number;
  variance: number;
  lineCount: number;
  isValid: boolean;
  errorMessage?: string;
}

export interface DuplicateVoucherCheckResult {
  isDuplicate: boolean;
  warning?: string;
  matchedVoucherId?: string;
  matchedVoucherNumber?: string;
}

export interface JournalLedgerEntry {
  voucherId: string;
  voucherNumber: string;
  date: string;
  lineId: string;
  rowNumber: number;
  accountCode: string;
  accountTitle: string;
  personName?: string;
  description: string;
  debit: number;
  credit: number;
  status: string;
}

export interface LedgerAccountSummary {
  accountCode: string;
  accountTitle: string;
  level: string;
  accountType: string;
  parentCode?: string;
  initialBalance: number;
  totalDebit: number;
  totalCredit: number;
  netTurnover: number; // debit - credit
  closingBalance: number; // absolute value
  balanceNature: 'debit' | 'credit' | 'balanced'; // ماهیت مانده
  entries: {
    voucherId: string;
    voucherNumber: string;
    date: string;
    description: string;
    personName?: string;
    debit: number;
    credit: number;
    runningDebit: number;
    runningCredit: number;
    runningBalance: number;
    runningNature: 'debit' | 'credit' | 'balanced';
  }[];
}

export interface DetailedPersonLedgerSummary {
  personId: string;
  personName: string;
  personCode?: string;
  personType: string;
  initialBalance: number;
  totalDebit: number; // خریدهای مشتری یا دریافت‌های تامین‌کننده
  totalCredit: number; // پرداخت‌های مشتری یا فاکتورهای تامین‌کننده
  currentLedgerBalance: number;
  recordedBalance: number;
  isReconciled: boolean;
  variance: number;
  balanceNature: 'بدهکار' | 'بستانکار' | 'بی‌حساب (صفر)';
  entries: {
    voucherId: string;
    voucherNumber: string;
    date: string;
    accountCode: string;
    accountTitle: string;
    description: string;
    debit: number;
    credit: number;
    runningBalance: number;
    runningNature: 'بدهکار' | 'بستانکار' | 'صفر';
  }[];
}

export interface TrialBalanceRow {
  code: string;
  title: string;
  level: 'group' | 'general' | 'subsidiary';
  parentCode?: string;
  // مانده ابتدای دوره
  initialDebit: number;
  initialCredit: number;
  // گردش طی دوره
  turnoverDebit: number;
  turnoverCredit: number;
  // مانده پایان دوره
  closingDebit: number;
  closingCredit: number;
}

export interface TrialBalanceReport {
  rows: TrialBalanceRow[];
  totalInitialDebit: number;
  totalInitialCredit: number;
  totalTurnoverDebit: number;
  totalTurnoverCredit: number;
  totalClosingDebit: number;
  totalClosingCredit: number;
  isTurnoverBalanced: boolean;
  isClosingBalanced: boolean;
}

/**
 * اعتبارسنجی توازن سند دوطرفه حسابداری (Double-Entry Balance & Validation)
 */
export function validateDoubleEntryVoucher(lines: VoucherLine[]): VoucherValidationResult {
  if (!lines || lines.length < 2) {
    return {
      isBalanced: false,
      totalDebit: 0,
      totalCredit: 0,
      variance: 0,
      lineCount: lines ? lines.length : 0,
      isValid: false,
      errorMessage: 'سند حسابداری دوطرفه باید حداقل دارای دو آرتیکل (ردیف) باشد.',
    };
  }

  let totalDebit = 0;
  let totalCredit = 0;

  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    const d = Math.round(Number(l.debit) || 0);
    const c = Math.round(Number(l.credit) || 0);

    if (d < 0 || c < 0) {
      return {
        isBalanced: false,
        totalDebit,
        totalCredit,
        variance: 0,
        lineCount: lines.length,
        isValid: false,
        errorMessage: `مبالغ ردیف شماره ${i + 1} نمی‌توانند منفی باشند.`,
      };
    }

    if (d > 0 && c > 0) {
      return {
        isBalanced: false,
        totalDebit,
        totalCredit,
        variance: 0,
        lineCount: lines.length,
        isValid: false,
        errorMessage: `در ردیف شماره ${i + 1}، ثبت هم‌زمان بدهکار و بستانکار در یک آرتیکل مجاز نیست.`,
      };
    }

    if (!l.accountCode?.trim()) {
      return {
        isBalanced: false,
        totalDebit,
        totalCredit,
        variance: 0,
        lineCount: lines.length,
        isValid: false,
        errorMessage: `کد سرفصل حسابداری در ردیف شماره ${i + 1} مشخص نشده است.`,
      };
    }

    totalDebit += d;
    totalCredit += c;
  }

  const variance = totalDebit - totalCredit;
  const isBalanced = variance === 0 && totalDebit > 0;

  if (totalDebit === 0) {
    return {
      isBalanced: false,
      totalDebit: 0,
      totalCredit: 0,
      variance: 0,
      lineCount: lines.length,
      isValid: false,
      errorMessage: 'مجموع سند صفر است. حداقل یک ردیف بدهکار و یک ردیف بستانکار با مبلغ بزرگتر از صفر الزامی است.',
    };
  }

  if (!isBalanced) {
    return {
      isBalanced: false,
      totalDebit,
      totalCredit,
      variance,
      lineCount: lines.length,
      isValid: false,
      errorMessage: `سند حسابداری تراز نیست! اختلاف بدهکار و بستانکار: ${Math.abs(variance).toLocaleString('fa-IR')} تومان (بدهکار: ${totalDebit.toLocaleString('fa-IR')} | بستانکار: ${totalCredit.toLocaleString('fa-IR')})`,
    };
  }

  return {
    isBalanced: true,
    totalDebit,
    totalCredit,
    variance: 0,
    lineCount: lines.length,
    isValid: true,
  };
}

/**
 * جلوگیری از تولید سند تکراری (Duplicate Voucher Prevention)
 */
export function checkForDuplicateVoucher(
  existingVouchers: AccountingVoucher[],
  candidate: {
    id?: string;
    date: string;
    description: string;
    totalDebit: number;
    lines: { accountCode: string; debit: number; credit: number; personId?: string }[];
  }
): DuplicateVoucherCheckResult {
  const candAmt = Math.round(Number(candidate.totalDebit) || 0);
  const candDate = candidate.date?.trim();
  const candDesc = candidate.description?.trim().toLowerCase();

  for (const vch of existingVouchers) {
    if (candidate.id && vch.id === candidate.id) continue;

    // اگر تاریخ و مبلغ کل دقیقاً یکسان باشد
    if (vch.date?.trim() === candDate && Math.round(vch.totalDebit) === candAmt) {
      // مقایسه شرح
      const isDescExact = vch.description?.trim().toLowerCase() === candDesc;

      // مقایسه ساختار آرتیکل‌ها
      const linesMatch =
        vch.lines.length === candidate.lines.length &&
        candidate.lines.every((cLine) =>
          vch.lines.some(
            (vLine) =>
              vLine.accountCode === cLine.accountCode &&
              Math.round(vLine.debit) === Math.round(cLine.debit) &&
              Math.round(vLine.credit) === Math.round(cLine.credit) &&
              (cLine.personId ? vLine.personId === cLine.personId : true)
          )
        );

      if (linesMatch && (isDescExact || candidate.lines.length > 2)) {
        return {
          isDuplicate: true,
          warning: `یک سند حسابداری دقیقاً مشابه با شماره ${vch.voucherNumber} در تاریخ ${vch.date} به مبلغ ${candAmt.toLocaleString('fa-IR')} تومان در سیستم موجود است. از تولید سند تکراری جلوگیری شد.`,
          matchedVoucherId: vch.id,
          matchedVoucherNumber: vch.voucherNumber,
        };
      }
    }
  }

  return { isDuplicate: false };
}

/**
 * استخراج دفتر روزنامه (Journal Ledger)
 */
export function generateJournalLedger(
  vouchers: AccountingVoucher[],
  dateFrom?: string,
  dateTo?: string
): { entries: JournalLedgerEntry[]; totalDebit: number; totalCredit: number; isBalanced: boolean } {
  let list = vouchers.filter((v) => v.status !== 'draft');

  if (dateFrom) list = list.filter((v) => v.date >= dateFrom);
  if (dateTo) list = list.filter((v) => v.date <= dateTo);

  // مرتب‌سازی زمانی صعودی بر اساس تاریخ و شماره سند
  list.sort((a, b) => {
    const cmp = (a.date || '').localeCompare(b.date || '');
    if (cmp !== 0) return cmp;
    return (Number(a.voucherNumber) || 0) - (Number(b.voucherNumber) || 0);
  });

  const entries: JournalLedgerEntry[] = [];
  let totalDebit = 0;
  let totalCredit = 0;

  for (const vch of list) {
    vch.lines.forEach((line, idx) => {
      const d = Number(line.debit) || 0;
      const c = Number(line.credit) || 0;
      totalDebit += d;
      totalCredit += c;

      entries.push({
        voucherId: vch.id,
        voucherNumber: vch.voucherNumber,
        date: vch.date,
        lineId: line.id || `vl-${vch.id}-${idx}`,
        rowNumber: idx + 1,
        accountCode: line.accountCode,
        accountTitle: line.accountTitle,
        personName: line.personName,
        description: line.description || vch.description,
        debit: d,
        credit: c,
        status: vch.status,
      });
    });
  }

  return {
    entries,
    totalDebit,
    totalCredit,
    isBalanced: totalDebit === totalCredit,
  };
}

/**
 * استخراج دفتر کل (General Ledger) بر اساس کدهای کل ۲ یا ۳ رقمی
 */
export function generateGeneralLedger(
  vouchers: AccountingVoucher[],
  accounts: AccountingAccount[],
  dateFrom?: string,
  dateTo?: string
): LedgerAccountSummary[] {
  const generalAccounts = accounts.filter((a) => a.level === 'general' || a.level === 'group');

  // استخراج تمام سطرهای سندهای قطعی
  const validVouchers = vouchers
    .filter((v) => v.status !== 'draft')
    .filter((v) => (!dateFrom || v.date >= dateFrom) && (!dateTo || v.date <= dateTo))
    .sort((a, b) => (a.date || '').localeCompare(b.date || ''));

  return generalAccounts.map((acc) => {
    // ردیف‌هایی که کد حساب آن‌ها با کد کل شروع می‌شود
    const matchingLines: {
      voucherId: string;
      voucherNumber: string;
      date: string;
      description: string;
      personName?: string;
      debit: number;
      credit: number;
    }[] = [];

    for (const v of validVouchers) {
      for (const l of v.lines) {
        if (l.accountCode === acc.code || l.accountCode.startsWith(acc.code)) {
          matchingLines.push({
            voucherId: v.id,
            voucherNumber: v.voucherNumber,
            date: v.date,
            description: l.description || v.description,
            personName: l.personName,
            debit: Number(l.debit) || 0,
            credit: Number(l.credit) || 0,
          });
        }
      }
    }

    const hasOpeningVoucher = validVouchers.some((v) => v.referenceType === 'opening_balance');
    const initialBal = hasOpeningVoucher ? 0 : (acc.balance || 0);
    const accType = acc.type || (acc as any).accountType || (acc.code.startsWith('1') ? 'asset' : acc.code.startsWith('2') ? 'liability' : acc.code.startsWith('3') ? 'equity' : acc.code.startsWith('4') ? 'revenue' : 'expense');
    const isDebitNature = accType === 'asset' || accType === 'expense';
    let runningBal = initialBal;
    let totalDebit = 0;
    let totalCredit = 0;

    const entries = matchingLines.map((m) => {
      totalDebit += m.debit;
      totalCredit += m.credit;

      // محاسبه ماهیت و مانده لحظه‌ای بر حسب نوع دارایی/هزینه (بدهکار) یا بدهی/درآمد/سرمایه (بستانکار)
      if (isDebitNature) {
        runningBal += m.debit - m.credit;
      } else {
        runningBal += m.credit - m.debit;
      }

      const runningNature: 'debit' | 'credit' | 'balanced' =
        runningBal > 0 ? (isDebitNature ? 'debit' : 'credit') : runningBal < 0 ? (isDebitNature ? 'credit' : 'debit') : 'balanced';

      return {
        ...m,
        runningDebit: totalDebit,
        runningCredit: totalCredit,
        runningBalance: Math.abs(runningBal),
        runningNature,
      };
    });

    const netBalance = isDebitNature ? (initialBal + totalDebit - totalCredit) : (initialBal + totalCredit - totalDebit);
    const closingBalance = Math.abs(netBalance);
    const balanceNature: 'debit' | 'credit' | 'balanced' =
      netBalance > 0 ? (isDebitNature ? 'debit' : 'credit') : netBalance < 0 ? (isDebitNature ? 'credit' : 'debit') : 'balanced';

    return {
      accountCode: acc.code,
      accountTitle: acc.title,
      level: acc.level,
      accountType: accType,
      parentCode: acc.parentCode,
      initialBalance: initialBal,
      totalDebit,
      totalCredit,
      netTurnover: totalDebit - totalCredit,
      closingBalance,
      balanceNature,
      entries,
    };
  });
}

/**
 * استخراج دفتر معین (Subsidiary Ledger) بر اساس کدهای معین ۴ الی ۶ رقمی
 */
export function generateSubsidiaryLedger(
  vouchers: AccountingVoucher[],
  accounts: AccountingAccount[],
  dateFrom?: string,
  dateTo?: string,
  generalCodeFilter?: string
): LedgerAccountSummary[] {
  let subAccounts = accounts.filter((a) => a.level === 'subsidiary');

  if (generalCodeFilter && generalCodeFilter !== 'all') {
    subAccounts = subAccounts.filter((a) => a.parentCode === generalCodeFilter);
  }

  const validVouchers = vouchers
    .filter((v) => v.status !== 'draft')
    .filter((v) => (!dateFrom || v.date >= dateFrom) && (!dateTo || v.date <= dateTo))
    .sort((a, b) => (a.date || '').localeCompare(b.date || ''));

  const hasOpeningVoucher = validVouchers.some((v) => v.referenceType === 'opening_balance');

  return subAccounts.map((acc) => {
    const matchingLines: {
      voucherId: string;
      voucherNumber: string;
      date: string;
      description: string;
      personName?: string;
      debit: number;
      credit: number;
    }[] = [];

    for (const v of validVouchers) {
      for (const l of v.lines) {
        if (l.accountCode === acc.code) {
          matchingLines.push({
            voucherId: v.id,
            voucherNumber: v.voucherNumber,
            date: v.date,
            description: l.description || v.description,
            personName: l.personName,
            debit: Number(l.debit) || 0,
            credit: Number(l.credit) || 0,
          });
        }
      }
    }

    const initialBal = hasOpeningVoucher ? 0 : (acc.balance || 0);
    const accType = acc.type || (acc as any).accountType || (acc.code.startsWith('1') ? 'asset' : acc.code.startsWith('2') ? 'liability' : acc.code.startsWith('3') ? 'equity' : acc.code.startsWith('4') ? 'revenue' : 'expense');
    const isDebitNature = accType === 'asset' || accType === 'expense';
    let runningBal = initialBal;
    let totalDebit = 0;
    let totalCredit = 0;

    const entries = matchingLines.map((m) => {
      totalDebit += m.debit;
      totalCredit += m.credit;

      if (isDebitNature) {
        runningBal += m.debit - m.credit;
      } else {
        runningBal += m.credit - m.debit;
      }

      const runningNature: 'debit' | 'credit' | 'balanced' =
        runningBal > 0 ? (isDebitNature ? 'debit' : 'credit') : runningBal < 0 ? (isDebitNature ? 'credit' : 'debit') : 'balanced';

      return {
        ...m,
        runningDebit: totalDebit,
        runningCredit: totalCredit,
        runningBalance: Math.abs(runningBal),
        runningNature,
      };
    });

    const netBalance = isDebitNature ? (initialBal + totalDebit - totalCredit) : (initialBal + totalCredit - totalDebit);
    const closingBalance = Math.abs(netBalance);
    const balanceNature: 'debit' | 'credit' | 'balanced' =
      netBalance > 0 ? (isDebitNature ? 'debit' : 'credit') : netBalance < 0 ? (isDebitNature ? 'credit' : 'debit') : 'balanced';

    return {
      accountCode: acc.code,
      accountTitle: acc.title,
      level: acc.level,
      accountType: accType,
      parentCode: acc.parentCode,
      initialBalance: initialBal,
      totalDebit,
      totalCredit,
      netTurnover: totalDebit - totalCredit,
      closingBalance,
      balanceNature,
      entries,
    };
  });
}

/**
 * استخراج دفتر تفصیلی اشخاص (Persons Detailed Ledger) و تطبیق مانده
 */
export function generateDetailedPersonLedger(
  vouchers: AccountingVoucher[],
  persons: Person[],
  targetPersonId?: string,
  dateFrom?: string,
  dateTo?: string
): DetailedPersonLedgerSummary[] {
  let personList = persons;
  if (targetPersonId) {
    personList = persons.filter((p) => p.id === targetPersonId);
  }

  const validVouchers = vouchers
    .filter((v) => v.status !== 'draft')
    .filter((v) => (!dateFrom || v.date >= dateFrom) && (!dateTo || v.date <= dateTo))
    .sort((a, b) => (a.date || '').localeCompare(b.date || ''));

  return personList.map((p) => {
    const linesForPerson: {
      voucherId: string;
      voucherNumber: string;
      date: string;
      accountCode: string;
      accountTitle: string;
      description: string;
      debit: number;
      credit: number;
    }[] = [];

    for (const v of validVouchers) {
      for (const l of v.lines) {
        if (l.personId === p.id) {
          linesForPerson.push({
            voucherId: v.id,
            voucherNumber: v.voucherNumber,
            date: v.date,
            accountCode: l.accountCode,
            accountTitle: l.accountTitle,
            description: l.description || v.description,
            debit: Number(l.debit) || 0,
            credit: Number(l.credit) || 0,
          });
        }
      }
    }

    let running = 0;
    let totalDebit = 0;
    let totalCredit = 0;

    const entries = linesForPerson.map((m) => {
      totalDebit += m.debit;
      totalCredit += m.credit;
      // بدهکار: افزایش طلب فروشگاه از شخص (+). بستانکار: کاهش طلب یا افزایش بدهی فروشگاه (-).
      running += m.debit - m.credit;

      return {
        ...m,
        runningBalance: Math.abs(running),
        runningNature: running > 0 ? ('بدهکار' as const) : running < 0 ? ('بستانکار' as const) : ('صفر' as const),
      };
    });

    const netLedgerBalance = totalDebit - totalCredit;
    const recordedBalance = Number(p.currentBalance) || 0;
    const variance = recordedBalance - netLedgerBalance;
    const isReconciled = Math.abs(variance) < 1;

    return {
      personId: p.id,
      personName: p.name,
      personCode: p.code,
      personType: p.personType,
      initialBalance: 0,
      totalDebit,
      totalCredit,
      currentLedgerBalance: netLedgerBalance,
      recordedBalance,
      isReconciled,
      variance,
      balanceNature: netLedgerBalance > 0 ? 'بدهکار' : netLedgerBalance < 0 ? 'بستانکار' : 'بی‌حساب (صفر)',
      entries,
    };
  });
}

/**
 * محاسبه تراز آزمایشی چهار ستونی و شش ستونی (Trial Balance)
 */
export function generateTrialBalance(
  vouchers: AccountingVoucher[],
  accounts: AccountingAccount[],
  dateFrom?: string,
  dateTo?: string,
  level: 'general' | 'subsidiary' | 'all' = 'general'
): TrialBalanceReport {
  let effectiveDateFrom = dateFrom;
  let effectiveDateTo = dateTo;
  let effectiveLevel = level;
  if (dateFrom === 'general' || dateFrom === 'subsidiary' || dateFrom === 'all') {
    effectiveLevel = dateFrom;
    effectiveDateFrom = undefined;
    effectiveDateTo = undefined;
  }

  let targetAccounts = accounts.filter((a) => a.level !== 'group');
  if (effectiveLevel === 'general') {
    targetAccounts = accounts.filter((a) => a.level === 'general');
  } else if (effectiveLevel === 'subsidiary') {
    targetAccounts = accounts.filter((a) => a.level === 'subsidiary');
  }

  const targetCodeSet = new Set(targetAccounts.map((a) => a.code));

  const validVouchers = vouchers
    .filter((v) => v.status !== 'draft')
    .filter((v) => (!effectiveDateFrom || v.date >= effectiveDateFrom) && (!effectiveDateTo || v.date <= effectiveDateTo));

  const hasOpeningVoucher = validVouchers.some((v) => v.referenceType === 'opening_balance');

  let totalInitialDebit = 0;
  let totalInitialCredit = 0;
  let totalTurnoverDebit = 0;
  let totalTurnoverCredit = 0;
  let totalClosingDebit = 0;
  let totalClosingCredit = 0;

  const rows: TrialBalanceRow[] = targetAccounts.map((acc) => {
    let opnDebit = 0;
    let opnCredit = 0;
    let tDebit = 0;
    let tCredit = 0;

    for (const v of validVouchers) {
      for (const l of v.lines) {
        const isExactMatch = l.accountCode === acc.code;
        const isChildRollup =
          acc.level === 'general' &&
          l.accountCode.startsWith(acc.code) &&
          l.accountCode !== acc.code &&
          !targetCodeSet.has(l.accountCode);
        if (isExactMatch || isChildRollup) {
          if (hasOpeningVoucher && v.referenceType === 'opening_balance') {
            opnDebit += Number(l.debit) || 0;
            opnCredit += Number(l.credit) || 0;
          } else {
            tDebit += Number(l.debit) || 0;
            tCredit += Number(l.credit) || 0;
          }
        }
      }
    }

    const accType = acc.type || (acc as any).accountType || (acc.code.startsWith('1') ? 'asset' : acc.code.startsWith('2') ? 'liability' : acc.code.startsWith('3') ? 'equity' : acc.code.startsWith('4') ? 'revenue' : 'expense');
    const isDebitNature = accType === 'asset' || accType === 'expense';
    const initBal = Number(acc.balance) || 0;

    const initialDebit = hasOpeningVoucher ? opnDebit : (isDebitNature && initBal > 0 ? initBal : 0);
    const initialCredit = hasOpeningVoucher ? opnCredit : (!isDebitNature && initBal > 0 ? initBal : 0);

    // مانده پایان دوره
    const net = (initialDebit - initialCredit) + (tDebit - tCredit);
    const closingDebit = net > 0 ? net : 0;
    const closingCredit = net < 0 ? Math.abs(net) : 0;

    totalInitialDebit += initialDebit;
    totalInitialCredit += initialCredit;
    totalTurnoverDebit += tDebit;
    totalTurnoverCredit += tCredit;
    totalClosingDebit += closingDebit;
    totalClosingCredit += closingCredit;

    return {
      code: acc.code,
      title: acc.title,
      level: acc.level as any,
      parentCode: acc.parentCode,
      initialDebit,
      initialCredit,
      turnoverDebit: tDebit,
      turnoverCredit: tCredit,
      closingDebit,
      closingCredit,
    };
  });

  return {
    rows,
    totalInitialDebit,
    totalInitialCredit,
    totalTurnoverDebit,
    totalTurnoverCredit,
    totalClosingDebit,
    totalClosingCredit,
    isTurnoverBalanced: totalTurnoverDebit === totalTurnoverCredit,
    isClosingBalanced: totalClosingDebit === totalClosingCredit,
  };
}

export interface AccountingAuditResult {
  isIntegrityPassed: boolean;
  checks: {
    vouchersBalanced: boolean;
    personsReconciled: boolean;
    treasuryReconciled: boolean;
  };
  metrics: {
    unbalancedVouchersCount: number;
    personsWithVarianceCount: number;
    treasuryAccountsWithVarianceCount: number;
  };
  issues: string[];
  summary: string;
}

/**
 * ممیزی انطباق اسناد حسابداری با مانده تفصیلی اشخاص و خزانه‌داری (Integrity Audit)
 */
export function auditAccountingIntegrity(
  vouchers: AccountingVoucher[],
  accounts: AccountingAccount[],
  persons: Person[],
  treasuryAccounts: TreasuryAccount[]
): AccountingAuditResult {
  let unbalancedVouchersCount = 0;
  const issues: string[] = [];

  const validVouchers = vouchers.filter(
    (v) => v.status !== 'draft' && v.referenceType !== 'closing_temporary' && v.referenceType !== 'closing_permanent'
  );
  const hasOpeningVoucher = validVouchers.some((v) => v.referenceType === 'opening_balance');

  // ۱. بررسی تراز بودن تک‌تک اسناد
  for (const v of vouchers) {
    const d = v.lines.reduce((s, l) => s + (Number(l.debit) || 0), 0);
    const c = v.lines.reduce((s, l) => s + (Number(l.credit) || 0), 0);
    if (d !== c || d <= 0) {
      unbalancedVouchersCount++;
      issues.push(`سند شماره ${v.voucherNumber} تراز نیست (بدهکار: ${d.toLocaleString('fa-IR')} | بستانکار: ${c.toLocaleString('fa-IR')})`);
    }
  }

  // ۲. بررسی مغایرت تفصیلی اشخاص
  const safePersons = persons || [];
  const personLedgers = generateDetailedPersonLedger(validVouchers, safePersons);
  const personVariances = personLedgers.filter((p) => !p.isReconciled);
  const personsWithVarianceCount = personVariances.length;
  for (const pv of personVariances) {
    issues.push(`مغایرت تفصیلی طرف حساب «${pv.personName}»: اختلاف دفتری ${pv.variance.toLocaleString('fa-IR')} تومان`);
  }

  // ۳. بررسی گردش سرفصل‌های خزانه (صندوق و بانک)
  let treasuryAccountsWithVarianceCount = 0;
  const safeTreasuryAccounts = treasuryAccounts || [];
  for (const trAcc of safeTreasuryAccounts) {
    if (!trAcc.accountingAccountCode) continue;
    let trDebit = 0;
    let trCredit = 0;
    for (const v of validVouchers) {
      for (const l of v.lines) {
        if (l.accountCode === trAcc.accountingAccountCode) {
          trDebit += Number(l.debit) || 0;
          trCredit += Number(l.credit) || 0;
        }
      }
    }
    const baseInitial = hasOpeningVoucher ? 0 : (trAcc.initialBalance || 0);
    const net = baseInitial + trDebit - trCredit;
    if (Math.abs(net - trAcc.balance) > 1) {
      treasuryAccountsWithVarianceCount++;
      issues.push(`مغایرت موجودی حساب «${trAcc.title}»: مانده در خزانه ${trAcc.balance.toLocaleString('fa-IR')} تومان ولی مانده دفتری ${net.toLocaleString('fa-IR')} تومان است.`);
    }
  }

  const vouchersBalanced = unbalancedVouchersCount === 0;
  const personsReconciled = personsWithVarianceCount === 0;
  const treasuryReconciled = treasuryAccountsWithVarianceCount === 0;
  const isIntegrityPassed = vouchersBalanced && personsReconciled && treasuryReconciled;

  const summary = isIntegrityPassed
    ? 'کلیه اسناد حسابداری تراز، دفاتر قانونی منطبق و مانده تفصیلی اشخاص و خزانه‌داری دارای انطباق ۱۰۰٪ است.'
    : `سیستم با دقت بالا پایش شد: ${issues.length} عدم انطباق یا مغایرت شناسایی گردید.`;

  return {
    isIntegrityPassed,
    checks: {
      vouchersBalanced,
      personsReconciled,
      treasuryReconciled,
    },
    metrics: {
      unbalancedVouchersCount,
      personsWithVarianceCount,
      treasuryAccountsWithVarianceCount,
    },
    issues,
    summary,
  };
}
