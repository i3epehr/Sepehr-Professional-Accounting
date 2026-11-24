/**
 * مدیر تراکنش‌های اتمیک پایگاه داده (ACID Transaction Manager)
 * تضمین می‌کند در صورت بروز هرگونه خطا یا نقض قوانین حسابداری،
 * تغییرات به طور کامل به حالت قبل بازگردد (Rollback).
 */

export interface TransactionContext {
  commit: () => Promise<void>;
  rollback: () => void;
  isCommitted: boolean;
  isRolledBack: boolean;
}

export class TransactionError extends Error {
  constructor(message: string, public readonly details?: any) {
    super(message);
    this.name = 'TransactionError';
  }
}

/**
 * بررسی تراز بودن سند حسابداری
 */
export function validateVoucherBalance(totalDebit: number, totalCredit: number): void {
  const diff = Math.abs(totalDebit - totalCredit);
  if (diff > 0.001) {
    throw new TransactionError(
      `نقض قانون تراز حسابداری: جمع بدهکار (${totalDebit.toLocaleString('fa-IR')}) با جمع بستانکار (${totalCredit.toLocaleString('fa-IR')}) برابر نیست. اختلاف: ${diff.toLocaleString('fa-IR')}`
    );
  }
}

/**
 * بررسی عدم منفی شدن موجودی انبار در صورت غیرمجاز بودن
 */
export function validateInventoryStock(
  productName: string,
  currentStock: number,
  reductionAmount: number,
  allowNegative: boolean = false
): void {
  if (!allowNegative && currentStock - reductionAmount < 0) {
    throw new TransactionError(
      `نقض قانون انبارداری: موجودی کالای "${productName}" (${currentStock}) کافی نیست. کسر ${reductionAmount} منجر به موجودی منفی می‌شود.`
    );
  }
}
