/**
 * محاسبات تخصصی و اعتبارسنجی مقادیر قابل برگشت از فروش و خرید
 * Returns Calculation and Validation Engine for Haberdashery ERP
 */

import { Invoice, InvoiceItem } from '../types/index.ts';
import { roundPrecision } from './conversions.ts';

export interface ReturnableItemInfo {
  productId: string;
  productCode: string;
  productName: string;
  unitId: string;
  unitName: string;
  conversionFactor: number;
  originalUnitPrice: number;
  originalDiscount: number;
  originalQuantity: number;
  cumulativeReturnedQuantity: number;
  remainingReturnableQuantity: number;
  isFullyReturned: boolean;
}

/**
 * استخراج و محاسبه دقیق اقلام قابل برگشت از یک فاکتور با احتساب کلیه مرجوعی‌های قبلی
 */
export function calculateReturnableItems(
  originalInvoice: Invoice,
  existingReturnInvoices: Invoice[]
): ReturnableItemInfo[] {
  // فاکتورهای مرجوعی معتبر قبلی مرتبط با این فاکتور (غیر از ابطال‌شده‌ها)
  const linkedReturns = existingReturnInvoices.filter(
    (inv) =>
      inv.originalInvoiceId === originalInvoice.id &&
      (inv.invoiceType === 'sale_return' || inv.invoiceType === 'purchase_return') &&
      inv.status === 'approved'
  );

  return originalInvoice.items.map((origItem) => {
    // محاسبه مجموع مقادیر برگشت داده شده در اسناد قبلی
    let cumulativeReturned = 0;
    linkedReturns.forEach((retInv) => {
      retInv.items.forEach((retItem) => {
        if (retItem.productId === origItem.productId) {
          cumulativeReturned += Number(retItem.quantity) || 0;
        }
      });
    });

    cumulativeReturned = roundPrecision(cumulativeReturned, 4);
    const originalQty = Number(origItem.quantity) || 0;
    const remaining = Math.max(0, roundPrecision(originalQty - cumulativeReturned, 4));

    return {
      productId: origItem.productId,
      productCode: origItem.productCode,
      productName: origItem.productName,
      unitId: origItem.unitId,
      unitName: origItem.unitName,
      conversionFactor: origItem.conversionFactor || 1,
      originalUnitPrice: origItem.unitPrice,
      originalDiscount: origItem.discount || 0,
      originalQuantity: originalQty,
      cumulativeReturnedQuantity: cumulativeReturned,
      remainingReturnableQuantity: remaining,
      isFullyReturned: remaining <= 0,
    };
  });
}

export interface ReturnValidationResult {
  isValid: boolean;
  errorMessage?: string;
  exceededItem?: {
    productName: string;
    requestedQty: number;
    remainingQty: number;
  };
}

/**
 * کنترل قطعی و اعتبارسنجی مقادیر درخواستی جهت ممانعت اکید از برگشت بیش از سقف مجاز
 */
export function validateReturnQuantities(
  originalInvoice: Invoice,
  existingReturnInvoices: Invoice[],
  requestedItems: Array<{ productId: string; quantity: number }>
): ReturnValidationResult {
  if (originalInvoice.status !== 'approved') {
    return {
      isValid: false,
      errorMessage: 'امکان ثبت مرجوعی تنها برای فاکتورهای قطعی و تایید‌شده وجود دارد.',
    };
  }

  const validItems = requestedItems.filter((it) => (Number(it.quantity) || 0) > 0);
  if (validItems.length === 0) {
    return {
      isValid: false,
      errorMessage: 'حداقل یک قلم کالا با مقدار بزرگتر از صفر برای ثبت مرجوعی الزامی است.',
    };
  }

  const returnables = calculateReturnableItems(originalInvoice, existingReturnInvoices);
  const returnableMap = new Map(returnables.map((r) => [r.productId, r]));

  for (const req of validItems) {
    const itemInfo = returnableMap.get(req.productId);
    if (!itemInfo) {
      return {
        isValid: false,
        errorMessage: `کالای مورد نظر در فاکتور مرجع شماره ${originalInvoice.invoiceNumber} وجود ندارد.`,
      };
    }

    const requested = Number(req.quantity) || 0;
    if (requested > itemInfo.remainingReturnableQuantity) {
      return {
        isValid: false,
        errorMessage: `برگشت کالای «${itemInfo.productName}» به مقدار ${requested} غیرمجاز است. حداکثر مقدار قابل برگشت باقیمانده ${itemInfo.remainingReturnableQuantity} ${itemInfo.unitName} است (مقدار اولیه فاکتور: ${itemInfo.originalQuantity}، برگشت‌های قبلی: ${itemInfo.cumulativeReturnedQuantity}).`,
        exceededItem: {
          productName: itemInfo.productName,
          requestedQty: requested,
          remainingQty: itemInfo.remainingReturnableQuantity,
        },
      };
    }
  }

  return { isValid: true };
}

export interface RefundAllocationResult {
  totalReturnAmount: number;
  offsetDebtAmount: number; // مبلغی که بدهی معوقه قبلی را کسر و صفر می‌کند
  directRefundOrCreditAmount: number; // مبلغ مازاد که نقداً مسترد یا بستانکار دفتری می‌شود
}

/**
 * تسهیم اثر مالی مرجوعی بر روی مانده معوقه فاکتور و استرداد مازاد
 */
export function calculateRefundAllocation(
  returnAmount: number,
  originalInvoiceRemainingDebt: number
): RefundAllocationResult {
  const returnAmt = Math.max(0, Number(returnAmount) || 0);
  const remainingDebt = Math.max(0, Number(originalInvoiceRemainingDebt) || 0);

  // اگر فاکتور نسیه بوده و مانده بدهی دارد، ابتدا مانده بدهی فاکتور کاهش می‌یابد
  const offsetDebtAmount = Math.min(returnAmt, remainingDebt);
  // مازاد مبلغ مرجوعی پس از تسویه بدهی (یا کل مبلغ اگر فاکتور قبلاً تسویه شده بوده است)
  const directRefundOrCreditAmount = returnAmt - offsetDebtAmount;

  return {
    totalReturnAmount: returnAmt,
    offsetDebtAmount,
    directRefundOrCreditAmount,
  };
}
