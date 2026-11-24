import { pgTable, text, numeric, boolean, timestamp, jsonb } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: text('id').primaryKey(),
  username: text('username').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  fullName: text('full_name').notNull(),
  role: text('role').notNull(), // 'admin' | 'accountant' | 'cashier' | 'inventory_clerk'
  isActive: boolean('is_active').default(true),
  avatar: text('avatar'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

export const fiscalYears = pgTable('fiscal_years', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  startDate: text('start_date').notNull(),
  endDate: text('end_date').notNull(),
  isClosed: boolean('is_closed').default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

export const accountsChart = pgTable('accounts_chart', {
  id: text('id').primaryKey(),
  code: text('code').notNull().unique(),
  title: text('title').notNull(),
  level: text('level').notNull(), // 'group' | 'general' | 'subsidiary' | 'detail'
  accountType: text('account_type').notNull(), // 'asset' | 'liability' | 'equity' | 'revenue' | 'expense'
  parentCode: text('parent_code'),
  balance: numeric('balance', { precision: 18, scale: 2 }).default('0.00'),
});

export const persons = pgTable('persons', {
  id: text('id').primaryKey(),
  code: text('code').notNull().unique(),
  name: text('name').notNull(),
  personType: text('person_type').notNull(), // 'customer' | 'supplier' | 'both'
  phone: text('phone'),
  mobile: text('mobile').notNull(),
  nationalCode: text('national_code'),
  economicCode: text('economic_code'),
  address: text('address'),
  creditLimit: numeric('credit_limit', { precision: 18, scale: 2 }).default('0.00'),
  currentBalance: numeric('current_balance', { precision: 18, scale: 2 }).default('0.00'),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

export const categories = pgTable('categories', {
  id: text('id').primaryKey(),
  code: text('code').notNull().unique(),
  name: text('name').notNull(),
  parentId: text('parent_id'),
  description: text('description'),
});

export const units = pgTable('units', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  symbol: text('symbol').notNull(),
  isDecimalAllowed: boolean('is_decimal_allowed').default(false),
  baseUnitId: text('base_unit_id'),
  conversionFactor: numeric('conversion_factor', { precision: 12, scale: 4 }).default('1.0000'),
  description: text('description'),
});

export const products = pgTable('products', {
  id: text('id').primaryKey(),
  code: text('code').notNull().unique(),
  barcode: text('barcode').notNull().unique(),
  name: text('name').notNull(),
  categoryId: text('category_id'),
  baseUnitId: text('base_unit_id').notNull(),
  color: text('color'),
  size: text('size'),
  material: text('material'),
  brand: text('brand'),
  model: text('model'),
  purchasePrice: numeric('purchase_price', { precision: 18, scale: 2 }).default('0.00'),
  retailPrice: numeric('retail_price', { precision: 18, scale: 2 }).default('0.00'),
  wholesalePrice: numeric('wholesale_price', { precision: 18, scale: 2 }).default('0.00'),
  minAllowedPrice: numeric('min_allowed_price', { precision: 18, scale: 2 }).default('0.00'),
  currentStock: numeric('current_stock', { precision: 14, scale: 3 }).default('0.000'),
  minStockAlert: numeric('min_stock_alert', { precision: 14, scale: 3 }).default('0.000'),
  allowDecimal: boolean('allow_decimal').default(false),
  isActive: boolean('is_active').default(true),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const invoices = pgTable('invoices', {
  id: text('id').primaryKey(),
  invoiceNumber: text('invoice_number').notNull().unique(),
  invoiceType: text('invoice_type').notNull(),
  personId: text('person_id').notNull(),
  fiscalYearId: text('fiscal_year_id'),
  invoiceDate: text('invoice_date').notNull(),
  status: text('status').notNull(),
  subtotal: numeric('subtotal', { precision: 18, scale: 2 }).default('0.00'),
  totalDiscount: numeric('total_discount', { precision: 18, scale: 2 }).default('0.00'),
  taxAmount: numeric('tax_amount', { precision: 18, scale: 2 }).default('0.00'),
  finalAmount: numeric('final_amount', { precision: 18, scale: 2 }).default('0.00'),
  paidAmount: numeric('paid_amount', { precision: 18, scale: 2 }).default('0.00'),
  remainingAmount: numeric('remaining_amount', { precision: 18, scale: 2 }).default('0.00'),
  accountingVoucherId: text('accounting_voucher_id'),
  createdBy: text('created_by'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

export const invoiceItems = pgTable('invoice_items', {
  id: text('id').primaryKey(),
  invoiceId: text('invoice_id').notNull(),
  productId: text('product_id').notNull(),
  unitId: text('unit_id').notNull(),
  conversionFactor: numeric('conversion_factor', { precision: 12, scale: 4 }).default('1.0000'),
  quantity: numeric('quantity', { precision: 14, scale: 3 }).notNull(),
  baseQuantity: numeric('base_quantity', { precision: 14, scale: 3 }).notNull(),
  unitPrice: numeric('unit_price', { precision: 18, scale: 2 }).notNull(),
  discount: numeric('discount', { precision: 18, scale: 2 }).default('0.00'),
  tax: numeric('tax', { precision: 18, scale: 2 }).default('0.00'),
  totalPrice: numeric('total_price', { precision: 18, scale: 2 }).notNull(),
  color: text('color'),
  size: text('size'),
});

export const accountingVouchers = pgTable('accounting_vouchers', {
  id: text('id').primaryKey(),
  voucherNumber: text('voucher_number').notNull().unique(),
  voucherDate: text('voucher_date').notNull(),
  description: text('description').notNull(),
  fiscalYearId: text('fiscal_year_id'),
  status: text('status').notNull(),
  totalDebit: numeric('total_debit', { precision: 18, scale: 2 }).default('0.00'),
  totalCredit: numeric('total_credit', { precision: 18, scale: 2 }).default('0.00'),
  isBalanced: boolean('is_balanced').default(true),
  createdBy: text('created_by'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

export const stockKardex = pgTable('stock_kardex', {
  id: text('id').primaryKey(),
  productId: text('product_id').notNull(),
  date: text('date').notNull(),
  referenceType: text('reference_type').notNull(),
  referenceNumber: text('reference_number').notNull(),
  inQuantity: numeric('in_quantity', { precision: 14, scale: 3 }).default('0.000'),
  outQuantity: numeric('out_quantity', { precision: 14, scale: 3 }).default('0.000'),
  unitPrice: numeric('unit_price', { precision: 18, scale: 2 }).default('0.00'),
  balanceQuantity: numeric('balance_quantity', { precision: 14, scale: 3 }).notNull(),
  balanceValue: numeric('balance_value', { precision: 18, scale: 2 }).notNull(),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

export const treasuryAccounts = pgTable('treasury_accounts', {
  id: text('id').primaryKey(),
  type: text('type').notNull(),
  title: text('title').notNull(),
  accountNumber: text('account_number'),
  bankName: text('bank_name'),
  balance: numeric('balance', { precision: 18, scale: 2 }).default('0.00'),
});

export const cheques = pgTable('cheques', {
  id: text('id').primaryKey(),
  chequeType: text('cheque_type').notNull(),
  chequeNumber: text('cheque_number').notNull(),
  bankName: text('bank_name').notNull(),
  accountNumber: text('account_number').notNull(),
  sayadNumber: text('sayad_number'),
  dueDate: text('due_date').notNull(),
  amount: numeric('amount', { precision: 18, scale: 2 }).notNull(),
  personId: text('person_id').notNull(),
  status: text('status').notNull(),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

export const auditLogs = pgTable('audit_logs', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  userName: text('user_name').notNull(),
  action: text('action').notNull(),
  module: text('module').notNull(),
  entityId: text('entity_id'),
  description: text('description').notNull(),
  timestamp: timestamp('timestamp', { withTimezone: true }).defaultNow(),
});

export const storeSettings = pgTable('store_settings', {
  key: text('key').primaryKey(),
  value: jsonb('value').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});
