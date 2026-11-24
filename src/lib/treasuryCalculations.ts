import {
  TreasuryAccount,
  TreasuryTransaction,
  Invoice,
  Cheque,
  ChequeStatus,
  ChequeStatusHistoryItem,
} from '../types/index.ts';

export interface SettlementValidationResult {
  isValid: boolean;
  errorMessage?: string;
  settlementType: 'full' | 'partial' | 'on_account';
  requestedAmount: number;
  newPaidAmount: number;
  newRemainingAmount: number;
  isFullySettled: boolean;
}

export interface DuplicateCheckResult {
  isDuplicate: boolean;
  warning?: string;
  matchedTxId?: string;
}

export interface AccountStatementRow {
  transactionId: string;
  transactionNumber?: string;
  date: string;
  description: string;
  transactionType: string;
  typeTitle: string;
  inflow: number;
  outflow: number;
  runningBalance: number;
  trackingNumber?: string;
  personName?: string;
}

export interface AccountReconciliationResult {
  accountId: string;
  accountTitle: string;
  accountType: string;
  initialBalance: number;
  totalInflow: number;
  totalOutflow: number;
  calculatedBalance: number;
  recordedBalance: number;
  variance: number;
  isReconciled: boolean;
  transactionCount: number;
  entries: AccountStatementRow[];
}

/**
 * اعتبارسنجی تسویه فاکتور و کنترل سقف بدهی جهت جلوگیری از اضافه‌پرداخت
 */
export function validateInvoiceSettlement(
  invoice: Invoice,
  requestedAmount: number
): SettlementValidationResult {
  const req = Math.round(Number(requestedAmount) || 0);

  if (req <= 0) {
    return {
      isValid: false,
      errorMessage: 'مبلغ تسویه باید بزرگتر از صفر باشد.',
      settlementType: 'on_account',
      requestedAmount: 0,
      newPaidAmount: invoice.paidAmount,
      newRemainingAmount: invoice.remainingAmount,
      isFullySettled: invoice.remainingAmount <= 0,
    };
  }

  const remaining = Math.max(0, invoice.remainingAmount);

  if (remaining === 0) {
    return {
      isValid: false,
      errorMessage: `فاکتور شماره ${invoice.invoiceNumber} قبلاً به‌طور کامل تسویه شده است. ثبت پرداخت مجدد مجاز نیست.`,
      settlementType: 'full',
      requestedAmount: req,
      newPaidAmount: invoice.paidAmount,
      newRemainingAmount: 0,
      isFullySettled: true,
    };
  }

  if (req > remaining) {
    return {
      isValid: false,
      errorMessage: `مبلغ پرداختی (${req.toLocaleString('fa-IR')} تومان) بیش از مانده بدهی فاکتور (${remaining.toLocaleString('fa-IR')} تومان) است.`,
      settlementType: 'full',
      requestedAmount: req,
      newPaidAmount: invoice.paidAmount,
      newRemainingAmount: remaining,
      isFullySettled: false,
    };
  }

  const newPaidAmount = invoice.paidAmount + req;
  const newRemainingAmount = remaining - req;
  const isFullySettled = newRemainingAmount === 0;
  const settlementType: 'full' | 'partial' = isFullySettled ? 'full' : 'partial';

  return {
    isValid: true,
    settlementType,
    requestedAmount: req,
    newPaidAmount,
    newRemainingAmount,
    isFullySettled,
  };
}

/**
 * بررسی و پیشگیری از ثبت دوباره یک دریافت یا پرداخت تکراری
 */
export function checkForDuplicateTransaction(
  existingTxs: TreasuryTransaction[],
  candidate: {
    treasuryAccountId: string;
    personId?: string;
    invoiceId?: string;
    amount: number;
    trackingNumber?: string;
    date: string;
    transactionType: string;
  }
): DuplicateCheckResult {
  const amt = Math.round(Number(candidate.amount) || 0);
  const cleanTrack = candidate.trackingNumber?.trim();

  // 1. بررسی شماره پیگیری یکسان و تکراری (در صورت وجود)
  if (cleanTrack && cleanTrack.length > 2) {
    const matchedTrack = existingTxs.find(
      (tx) => tx.trackingNumber?.trim() === cleanTrack && tx.id !== (candidate as any).id
    );
    if (matchedTrack) {
      return {
        isDuplicate: true,
        warning: `شماره پیگیری «${cleanTrack}» قبلاً در تراکنش تاریخ ${matchedTrack.date} به مبلغ ${matchedTrack.amount.toLocaleString('fa-IR')} تومان ثبت شده است.`,
        matchedTxId: matchedTrack.id,
      };
    }
  }

  // 2. بررسی تکرار دقیق تراکنش برای همان شخص و فاکتور در همان تاریخ با مبلغ یکسان
  if (candidate.personId && candidate.invoiceId) {
    const exactMatch = existingTxs.find(
      (tx) =>
        tx.personId === candidate.personId &&
        tx.invoiceId === candidate.invoiceId &&
        tx.transactionType === candidate.transactionType &&
        Math.round(tx.amount) === amt &&
        tx.date === candidate.date
    );
    if (exactMatch) {
      return {
        isDuplicate: true,
        warning: `یک تراکنش با مبلغ دقیقاً مشابه (${amt.toLocaleString('fa-IR')} تومان) برای همین فاکتور و طرف‌حساب در تاریخ ${candidate.date} قبلاً ثبت شده است. از ثبت تکراری جلوگیری شد.`,
        matchedTxId: exactMatch.id,
      };
    }
  }

  return { isDuplicate: false };
}

/**
 * محاسبه گردش حساب (صورت‌حساب) و تطبیق مانده حساب با مجموع تراکنش‌های واقعی
 */
export function calculateAccountStatementAndReconciliation(
  account: TreasuryAccount,
  allTransactions: TreasuryTransaction[]
): AccountReconciliationResult {
  // فیلتر کردن تراکنش‌های مؤثر بر این حساب
  const relatedTxs = allTransactions
    .filter((tx) => {
      if (tx.treasuryAccountId === account.id) return true;
      if (tx.sourceAccountId === account.id) return true;
      if (tx.destinationAccountId === account.id) return true;
      return false;
    })
    // مرتب‌سازی بر اساس تاریخ و شناسه صعودی
    .sort((a, b) => (a.createdAt || a.date).localeCompare(b.createdAt || b.date));

  const initialBal = Number(account.initialBalance) || 0;
  let runningBal = initialBal;
  let totalInflow = 0;
  let totalOutflow = 0;

  const entries: AccountStatementRow[] = [];

  for (const tx of relatedTxs) {
    let inflow = 0;
    let outflow = 0;
    let typeTitle = 'تراکنش خزانه';

    if (tx.transactionType === 'receive' || tx.transactionType === 'income') {
      inflow = Number(tx.amount) || 0;
      typeTitle = tx.transactionType === 'receive' ? 'دریافت وجه' : 'درآمد متفرقه';
    } else if (tx.transactionType === 'pay' || tx.transactionType === 'expense') {
      outflow = Number(tx.amount) || 0;
      typeTitle = tx.transactionType === 'pay' ? 'پرداخت وجه' : 'هزینه جاری';
    } else if (tx.transactionType === 'transfer') {
      if (tx.destinationAccountId === account.id) {
        inflow = Number(tx.amount) || 0;
        typeTitle = `انتقال وجه از ${tx.sourceAccountTitle || 'حساب مبدأ'}`;
      } else if (tx.sourceAccountId === account.id) {
        outflow = Number(tx.amount) || 0;
        typeTitle = `انتقال وجه به ${tx.destinationAccountTitle || 'حساب مقصد'}`;
      } else if (tx.treasuryAccountId === account.id) {
        // Fallback
        outflow = Number(tx.amount) || 0;
        typeTitle = 'انتقال وجه';
      }
    }

    totalInflow += inflow;
    totalOutflow += outflow;
    runningBal = runningBal + inflow - outflow;

    entries.push({
      transactionId: tx.id,
      transactionNumber: tx.transactionNumber,
      date: tx.date,
      description: tx.description,
      transactionType: tx.transactionType,
      typeTitle,
      inflow,
      outflow,
      runningBalance: runningBal,
      trackingNumber: tx.trackingNumber,
      personName: tx.personName,
    });
  }

  const recordedBalance = Number(account.balance) || 0;
  const variance = recordedBalance - runningBal;
  const isReconciled = Math.abs(variance) < 1; // تطبیق دقیق تا ۱ تومان به علت گرد کردن

  return {
    accountId: account.id,
    accountTitle: account.title,
    accountType: account.type,
    initialBalance: initialBal,
    totalInflow,
    totalOutflow,
    calculatedBalance: runningBal,
    recordedBalance,
    variance,
    isReconciled,
    transactionCount: entries.length,
    entries: entries.reverse(), // بازگشت به ترتیب جدیدترین در ابتدا جهت نمایش در جدول
  };
}

/**
 * اعتبارسنجی قوانین انتقال وضعیت چک
 */
export function validateChequeStatusTransition(
  cheque: Cheque,
  targetStatus: ChequeStatus,
  params?: {
    depositedBankAccountId?: string;
    transferredPersonId?: string;
    bounceReason?: string;
  }
): { isValid: boolean; errorMessage?: string; actionTitle: string } {
  const current = cheque.status;

  if (current === targetStatus) {
    return {
      isValid: false,
      errorMessage: 'چک در حال حاضر در همین وضعیت قرار دارد.',
      actionTitle: 'تکراری',
    };
  }

  if (current === 'cancelled') {
    return {
      isValid: false,
      errorMessage: 'چک باطل شده است و امکان تغییر وضعیت مجدد آن وجود ندارد.',
      actionTitle: 'غیرمجاز',
    };
  }

  if (cheque.chequeType === 'received') {
    switch (targetStatus) {
      case 'deposited': {
        if (current !== 'registered' && current !== 'bounced') {
          return {
            isValid: false,
            errorMessage: 'فقط چک‌های نزد صندوق یا برگشتی امکان واگذاری به بانک دارند.',
            actionTitle: 'خواباندن به حساب بانک',
          };
        }
        if (!params?.depositedBankAccountId) {
          return {
            isValid: false,
            errorMessage: 'انتخاب حساب بانکی مقصد جهت واگذاری چک الزامی است.',
            actionTitle: 'خواباندن به حساب بانک',
          };
        }
        return { isValid: true, actionTitle: 'واگذاری به بانک جهت وصول' };
      }

      case 'collected':
      case 'cleared': {
        if (current !== 'deposited' && current !== 'registered') {
          return {
            isValid: false,
            errorMessage: 'فقط چک‌های واگذار شده به بانک یا نزد صندوق امکان وصول دارند.',
            actionTitle: 'وصول چک',
          };
        }
        return { isValid: true, actionTitle: 'وصول قطعی چک و واریز به بانک' };
      }

      case 'transferred': {
        if (current !== 'registered') {
          return {
            isValid: false,
            errorMessage: 'تنها چک‌های موجود نزد صندوق امکان خرج و واگذاری به شخص ثالث را دارند.',
            actionTitle: 'خرج و واگذاری به شخص ثالث',
          };
        }
        if (!params?.transferredPersonId) {
          return {
            isValid: false,
            errorMessage: 'انتخاب طرف‌حساب دریافت‌کننده چک الزامی است.',
            actionTitle: 'خرج چک',
          };
        }
        return { isValid: true, actionTitle: 'خرج و واگذاری به شخص ثالث' };
      }

      case 'bounced': {
        if (current !== 'deposited' && current !== 'registered') {
          return {
            isValid: false,
            errorMessage: 'فقط چک‌های واگذار شده یا در دست اقدام امکان برگشت زدن دارند.',
            actionTitle: 'برگشت چک',
          };
        }
        return { isValid: true, actionTitle: 'برگشت چک و عدم وصول' };
      }

      case 'refunded':
      case 'returned': {
        if (current !== 'registered' && current !== 'bounced') {
          return {
            isValid: false,
            errorMessage: 'تنها چک‌های نزد صندوق یا برگشت خورده قابل عودت به صاحب چک هستند.',
            actionTitle: 'عودت چک به صاحب چک',
          };
        }
        return { isValid: true, actionTitle: 'عودت فیزیکی چک به صاحب چک' };
      }

      case 'cancelled': {
        if (current === 'collected' || current === 'transferred') {
          return {
            isValid: false,
            errorMessage: 'چک وصول شده یا خرج شده به شخص ثالث را نمی‌توان مستقیماً باطل نمود.',
            actionTitle: 'ابطال چک',
          };
        }
        return { isValid: true, actionTitle: 'ابطال و امحای سند چک' };
      }

      default:
        return { isValid: true, actionTitle: 'تغییر وضعیت' };
    }
  } else {
    // Issued Cheques (چک‌های پرداختی)
    switch (targetStatus) {
      case 'collected':
      case 'cleared': {
        if (current !== 'registered') {
          return {
            isValid: false,
            errorMessage: 'فقط چک‌های صادره در جریان امکان پاس شدن و وصول از حساب بانکی دارند.',
            actionTitle: 'پاس شدن چک صادره',
          };
        }
        return { isValid: true, actionTitle: 'پاس شدن چک و کسر از حساب بانکی' };
      }

      case 'bounced': {
        if (current !== 'registered') {
          return {
            isValid: false,
            errorMessage: 'فقط چک‌های صادره در جریان امکان ثبت به عنوان برگشت خورده دارند.',
            actionTitle: 'برگشت خوردن چک صادره',
          };
        }
        return { isValid: true, actionTitle: 'برگشت خوردن چک پرداختی' };
      }

      case 'cancelled': {
        if (current === 'collected') {
          return {
            isValid: false,
            errorMessage: 'چک پرداختی پاس شده از بانک امکان ابطال ندارد.',
            actionTitle: 'ابطال لاشه چک',
          };
        }
        return { isValid: true, actionTitle: 'ابطال و دریافت لاشه چک' };
      }

      default:
        return { isValid: true, actionTitle: 'تغییر وضعیت' };
    }
  }
}

/**
 * ایجاد ردیف جدید در تاریخچه تغییر وضعیت چک
 */
export function createStatusHistoryEntry(
  fromStatus: string,
  toStatus: string,
  actionTitle: string,
  description: string,
  userName: string,
  extras?: {
    relatedAccountId?: string;
    relatedAccountTitle?: string;
    targetPersonId?: string;
    targetPersonName?: string;
    voucherId?: string;
  }
): ChequeStatusHistoryItem {
  return {
    id: `chq-hist-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    timestamp: new Date().toISOString(),
    date: new Date().toLocaleDateString('fa-IR'),
    fromStatus,
    toStatus,
    actionTitle,
    description,
    performedBy: userName,
    relatedAccountId: extras?.relatedAccountId,
    relatedAccountTitle: extras?.relatedAccountTitle,
    targetPersonId: extras?.targetPersonId,
    targetPersonName: extras?.targetPersonName,
    voucherId: extras?.voucherId,
  };
}
