/**
 * موتور محاسبات تخصصی فروش، تسویه ترکیبی، تخفیفات و ارزش افزوده
 * Sales Calculation Engine for Haberdashery ERP
 */

import { InvoiceItem, InvoicePayment, Person } from '../types/index.ts';

export interface RowCalculationInput {
  quantity: number;
  unitPrice: number;
  discount: number;
  isTaxEnabled?: boolean;
  taxRate?: number; // e.g. 10 for 10%
}

export interface RowCalculationResult {
  grossAmount: number; // مقدار * قیمت واحد
  discountAmount: number; // تخفیف ردیف
  taxableAmount: number; // مبلغ پس از تخفیف ردیف
  taxAmount: number; // مالیات بر ارزش افزوده
  totalPrice: number; // مبلغ نهایی ردیف
}

/**
 * محاسبه دقیق ارقام مالی یک ردیف فاکتور فروش
 */
export function calculateRowFinancials(input: RowCalculationInput): RowCalculationResult {
  const qty = Math.max(0, Number(input.quantity) || 0);
  const price = Math.max(0, Number(input.unitPrice) || 0);
  const discount = Math.max(0, Number(input.discount) || 0);
  const isTaxEnabled = Boolean(input.isTaxEnabled);
  const taxRate = Math.max(0, Number(input.taxRate ?? 10));

  const grossAmount = Math.round(qty * price);
  const discountAmount = Math.min(grossAmount, discount);
  const taxableAmount = grossAmount - discountAmount;
  const taxAmount = isTaxEnabled ? Math.round((taxableAmount * taxRate) / 100) : 0;
  const totalPrice = taxableAmount + taxAmount;

  return {
    grossAmount,
    discountAmount,
    taxableAmount,
    taxAmount,
    totalPrice,
  };
}

export interface InvoiceCalculationInput {
  items: Array<{
    quantity: number;
    unitPrice: number;
    discount?: number;
    tax?: number;
    totalPrice?: number;
  }>;
  totalDiscount?: number;
  isTaxEnabled?: boolean;
  taxRate?: number;
  payments?: InvoicePayment[];
}

export interface InvoiceCalculationResult {
  subtotal: number; // جمع اقلام بدون تخفیف کلی
  itemsDiscount: number; // مجموع تخفیف‌های ردیفی
  totalDiscount: number; // تخفیف سرجمع فاکتور
  netBeforeTax: number; // مبلغ خالص پس از همه تخفیف‌ها
  taxAmount: number; // مالیات ارزش افزوده
  finalAmount: number; // مبلغ کل قابل پرداخت
  paidAmount: number; // جمع مبالغ پرداخت‌شده
  remainingAmount: number; // مانده نسیه یا حساب دفتری
  cashChange: number; // پول خرد / باقی‌مانده وجه نقد پرداختی
  paymentBreakdown: {
    cash: number;
    pos: number;
    bankTransfer: number;
    cheque: number;
    credit: number;
  };
}

/**
 * محاسبه سرجمع فاکتور فروش، ارزش افزوده، تسویه ترکیبی و مانده حساب
 */
export function calculateInvoiceFinancials(input: InvoiceCalculationInput): InvoiceCalculationResult {
  const items = input.items || [];
  const invoiceDiscount = Math.max(0, Number(input.totalDiscount) || 0);
  const isTaxEnabled = Boolean(input.isTaxEnabled);
  const taxRate = Math.max(0, Number(input.taxRate ?? 10));
  const payments = input.payments || [];

  let subtotal = 0;
  let itemsDiscount = 0;
  let rowTaxes = 0;

  items.forEach((item) => {
    const qty = Math.max(0, Number(item.quantity) || 0);
    const price = Math.max(0, Number(item.unitPrice) || 0);
    const disc = Math.max(0, Number(item.discount) || 0);
    const rowGross = Math.round(qty * price);
    const rowNet = Math.max(0, rowGross - disc);

    subtotal += rowGross;
    itemsDiscount += disc;

    if (item.tax !== undefined) {
      rowTaxes += Number(item.tax) || 0;
    }
  });

  const netAfterItemsDiscount = Math.max(0, subtotal - itemsDiscount);
  const netBeforeTax = Math.max(0, netAfterItemsDiscount - invoiceDiscount);

  // در صورتی که مالیات روی اقلام به طور جداگانه ثبت نشده باشد، بر اساس نرخ سرجمع محاسبه می‌شود
  const taxAmount = isTaxEnabled
    ? rowTaxes > 0
      ? rowTaxes
      : Math.round((netBeforeTax * taxRate) / 100)
    : 0;

  const finalAmount = netBeforeTax + taxAmount;

  // محاسبه تفکیکی روش‌های پرداخت
  const breakdown = {
    cash: 0,
    pos: 0,
    bankTransfer: 0,
    cheque: 0,
    credit: 0,
  };

  payments.forEach((p) => {
    const amt = Math.max(0, Number(p.amount) || 0);
    if (p.method === 'cash') breakdown.cash += amt;
    else if (p.method === 'pos') breakdown.pos += amt;
    else if (p.method === 'bank_transfer') breakdown.bankTransfer += amt;
    else if (p.method === 'cheque') breakdown.cheque += amt;
    else if (p.method === 'credit') breakdown.credit += amt;
  });

  const totalDirectPaid = breakdown.cash + breakdown.pos + breakdown.bankTransfer + breakdown.cheque;
  const paidAmount = totalDirectPaid;

  const remainingAmount = Math.max(0, finalAmount - paidAmount);
  // پول خرد دریافتی اضافی در پرداخت نقدی
  const cashChange = paidAmount > finalAmount ? paidAmount - finalAmount : 0;

  return {
    subtotal,
    itemsDiscount,
    totalDiscount: invoiceDiscount,
    netBeforeTax,
    taxAmount,
    finalAmount,
    paidAmount,
    remainingAmount,
    cashChange,
    paymentBreakdown: breakdown,
  };
}

/**
 * اعتبارسنجی سقف اعتبار مشتری برای فروش نسیه
 */
export function validateCustomerCredit(
  person: Person | null | undefined,
  creditAmount: number
): { isExceeded: boolean; creditLimit: number; currentBalance: number; newBalance: number; excessAmount: number } {
  if (!person) {
    return {
      isExceeded: false,
      creditLimit: 0,
      currentBalance: 0,
      newBalance: creditAmount,
      excessAmount: 0,
    };
  }

  const creditLimit = Number(person.creditLimit) || 0;
  const currentBalance = Number(person.currentBalance) || 0;
  const newBalance = currentBalance + creditAmount;

  if (creditLimit > 0 && newBalance > creditLimit) {
    return {
      isExceeded: true,
      creditLimit,
      currentBalance,
      newBalance,
      excessAmount: newBalance - creditLimit,
    };
  }

  return {
    isExceeded: false,
    creditLimit,
    currentBalance,
    newBalance,
    excessAmount: 0,
  };
}
