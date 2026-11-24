-- =========================================================================
-- نرم‌افزار حسابداری تخصصی خرازی - ساختار پایگاه داده PostgreSQL
-- Kharrazi Haberdashery ERP - PostgreSQL Relational Database Schema
-- =========================================================================

-- Enable UUID extension if needed
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. جدول کاربران و سطوح دسترسی
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(64) PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    role VARCHAR(30) NOT NULL CHECK (role IN ('admin', 'accountant', 'cashier', 'inventory_clerk')),
    is_active BOOLEAN DEFAULT TRUE,
    avatar VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. جدول سال‌های مالی
CREATE TABLE IF NOT EXISTS fiscal_years (
    id VARCHAR(64) PRIMARY KEY,
    title VARCHAR(50) NOT NULL,
    start_date VARCHAR(10) NOT NULL, -- تاریخ شمسی e.g. 1403/01/01
    end_date VARCHAR(10) NOT NULL,
    is_closed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. جدول سرفصل‌های حسابداری (کدینگ حسابداری سه سطحی: کل، معین، تفصیلی)
CREATE TABLE IF NOT EXISTS accounts_chart (
    id VARCHAR(64) PRIMARY KEY,
    code VARCHAR(20) UNIQUE NOT NULL,
    title VARCHAR(150) NOT NULL,
    level VARCHAR(20) NOT NULL CHECK (level IN ('group', 'general', 'subsidiary', 'detail')),
    account_type VARCHAR(20) NOT NULL CHECK (account_type IN ('asset', 'liability', 'equity', 'revenue', 'expense')),
    parent_code VARCHAR(20),
    balance NUMERIC(18, 2) DEFAULT 0.00
);

-- 4. جدول اشخاص (طرف‌های حساب: مشتریان، تامین‌کنندگان و همکاران)
CREATE TABLE IF NOT EXISTS persons (
    id VARCHAR(64) PRIMARY KEY,
    code VARCHAR(20) UNIQUE NOT NULL,
    name VARCHAR(150) NOT NULL,
    person_type VARCHAR(20) NOT NULL CHECK (person_type IN ('customer', 'supplier', 'both')),
    phone VARCHAR(30),
    mobile VARCHAR(30) NOT NULL,
    national_code VARCHAR(20),
    economic_code VARCHAR(30),
    address TEXT,
    credit_limit NUMERIC(18, 2) DEFAULT 0.00,
    current_balance NUMERIC(18, 2) DEFAULT 0.00, -- مثبت: بدهکار به ما، منفی: بستانکار از ما
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 5. جدول دسته‌بندی کالاهای خرازی
CREATE TABLE IF NOT EXISTS categories (
    id VARCHAR(64) PRIMARY KEY,
    code VARCHAR(20) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    parent_id VARCHAR(64) REFERENCES categories(id) ON DELETE SET NULL,
    description TEXT
);

-- 6. جدول واحدهای اندازه‌گیری و ضرایب تبدیل (رول، متر، سانتی‌متر، بسته، کارتن، عدد، کیلوگرم)
CREATE TABLE IF NOT EXISTS units (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(50) NOT NULL,
    symbol VARCHAR(20) NOT NULL,
    is_decimal_allowed BOOLEAN DEFAULT FALSE,
    base_unit_id VARCHAR(64) REFERENCES units(id) ON DELETE SET NULL,
    conversion_factor NUMERIC(12, 4) DEFAULT 1.0000,
    description TEXT
);

-- 7. جدول کالاها و مشخصات تخصصی خرازی
CREATE TABLE IF NOT EXISTS products (
    id VARCHAR(64) PRIMARY KEY,
    code VARCHAR(30) UNIQUE NOT NULL,
    barcode VARCHAR(60) UNIQUE NOT NULL,
    name VARCHAR(200) NOT NULL,
    category_id VARCHAR(64) REFERENCES categories(id),
    base_unit_id VARCHAR(64) REFERENCES units(id) NOT NULL,
    -- ویژگی‌های تخصصی خرازی
    color VARCHAR(60),
    size VARCHAR(60),
    material VARCHAR(80),
    brand VARCHAR(80),
    model VARCHAR(80),
    -- قیمت‌گذاری و کنترل فروش
    purchase_price NUMERIC(18, 2) NOT NULL DEFAULT 0.00,
    retail_price NUMERIC(18, 2) NOT NULL DEFAULT 0.00,
    wholesale_price NUMERIC(18, 2) NOT NULL DEFAULT 0.00,
    min_allowed_price NUMERIC(18, 2) NOT NULL DEFAULT 0.00, -- کف قیمت مجاز
    -- موجودی و هشدار
    current_stock NUMERIC(14, 3) NOT NULL DEFAULT 0.000,
    min_stock_alert NUMERIC(14, 3) NOT NULL DEFAULT 0.000,
    allow_decimal BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 8. جدول واحدهای فرعی کالا و ضرایب تبدیل اختصاصی
CREATE TABLE IF NOT EXISTS product_unit_conversions (
    id VARCHAR(64) PRIMARY KEY,
    product_id VARCHAR(64) NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    unit_id VARCHAR(64) NOT NULL REFERENCES units(id),
    conversion_factor NUMERIC(12, 4) NOT NULL, -- ضریب تبدیل به واحد پایه
    price NUMERIC(18, 2)
);

-- 9. جدول اسناد حسابداری (سند دوبل متوازن)
CREATE TABLE IF NOT EXISTS accounting_vouchers (
    id VARCHAR(64) PRIMARY KEY,
    voucher_number VARCHAR(30) UNIQUE NOT NULL,
    voucher_date VARCHAR(10) NOT NULL,
    description TEXT NOT NULL,
    fiscal_year_id VARCHAR(64) REFERENCES fiscal_years(id),
    status VARCHAR(20) NOT NULL CHECK (status IN ('draft', 'approved', 'permanent')),
    total_debit NUMERIC(18, 2) NOT NULL DEFAULT 0.00,
    total_credit NUMERIC(18, 2) NOT NULL DEFAULT 0.00,
    is_balanced BOOLEAN NOT NULL DEFAULT TRUE,
    created_by VARCHAR(64) REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_balanced_voucher CHECK (is_balanced = TRUE)
);

-- 10. جدول ردیف‌های سند حسابداری (آرتیکل‌های سند)
CREATE TABLE IF NOT EXISTS accounting_voucher_items (
    id VARCHAR(64) PRIMARY KEY,
    voucher_id VARCHAR(64) NOT NULL REFERENCES accounting_vouchers(id) ON DELETE CASCADE,
    account_code VARCHAR(20) NOT NULL REFERENCES accounts_chart(code),
    account_title VARCHAR(150) NOT NULL,
    person_id VARCHAR(64) REFERENCES persons(id) ON DELETE SET NULL,
    debit NUMERIC(18, 2) NOT NULL DEFAULT 0.00,
    credit NUMERIC(18, 2) NOT NULL DEFAULT 0.00,
    description TEXT
);

-- 11. جدول فاکتورهای خرید، فروش، برگشت و پیش‌فاکتور
CREATE TABLE IF NOT EXISTS invoices (
    id VARCHAR(64) PRIMARY KEY,
    invoice_number VARCHAR(30) UNIQUE NOT NULL,
    invoice_type VARCHAR(20) NOT NULL CHECK (invoice_type IN ('sale', 'purchase', 'proforma', 'return_sale', 'return_purchase')),
    person_id VARCHAR(64) NOT NULL REFERENCES persons(id),
    fiscal_year_id VARCHAR(64) REFERENCES fiscal_years(id),
    invoice_date VARCHAR(10) NOT NULL,
    status VARCHAR(20) NOT NULL CHECK (status IN ('draft', 'approved', 'cancelled')),
    subtotal NUMERIC(18, 2) NOT NULL DEFAULT 0.00,
    total_discount NUMERIC(18, 2) NOT NULL DEFAULT 0.00,
    tax_amount NUMERIC(18, 2) NOT NULL DEFAULT 0.00,
    final_amount NUMERIC(18, 2) NOT NULL DEFAULT 0.00,
    paid_amount NUMERIC(18, 2) NOT NULL DEFAULT 0.00,
    remaining_amount NUMERIC(18, 2) NOT NULL DEFAULT 0.00,
    accounting_voucher_id VARCHAR(64) REFERENCES accounting_vouchers(id),
    created_by VARCHAR(64) REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 12. جدول اقلام فاکتور
CREATE TABLE IF NOT EXISTS invoice_items (
    id VARCHAR(64) PRIMARY KEY,
    invoice_id VARCHAR(64) NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    product_id VARCHAR(64) NOT NULL REFERENCES products(id),
    unit_id VARCHAR(64) NOT NULL REFERENCES units(id),
    conversion_factor NUMERIC(12, 4) NOT NULL DEFAULT 1.0000,
    quantity NUMERIC(14, 3) NOT NULL, -- مقدار به واحد انتخابی
    base_quantity NUMERIC(14, 3) NOT NULL, -- مقدار به واحد پایه انبار
    unit_price NUMERIC(18, 2) NOT NULL,
    discount NUMERIC(18, 2) DEFAULT 0.00,
    tax NUMERIC(18, 2) DEFAULT 0.00,
    total_price NUMERIC(18, 2) NOT NULL,
    color VARCHAR(60),
    size VARCHAR(60)
);

-- 13. جدول کاردکس انبار (ردیابی دقیق موجودی ورودی و خروجی)
CREATE TABLE IF NOT EXISTS stock_kardex (
    id VARCHAR(64) PRIMARY KEY,
    product_id VARCHAR(64) NOT NULL REFERENCES products(id),
    date VARCHAR(10) NOT NULL,
    reference_type VARCHAR(30) NOT NULL, -- فاکتور فروش، فاکتور خرید، انبارگردانی
    reference_number VARCHAR(30) NOT NULL,
    in_quantity NUMERIC(14, 3) DEFAULT 0.000,
    out_quantity NUMERIC(14, 3) DEFAULT 0.000,
    unit_price NUMERIC(18, 2) NOT NULL DEFAULT 0.00,
    balance_quantity NUMERIC(14, 3) NOT NULL,
    balance_value NUMERIC(18, 2) NOT NULL,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 14. جدول حساب‌های خزانه (صندوق‌ها و حساب‌های بانکی)
CREATE TABLE IF NOT EXISTS treasury_accounts (
    id VARCHAR(64) PRIMARY KEY,
    type VARCHAR(20) NOT NULL CHECK (type IN ('cash', 'bank', 'pos')),
    title VARCHAR(100) NOT NULL,
    account_number VARCHAR(50),
    bank_name VARCHAR(50),
    balance NUMERIC(18, 2) DEFAULT 0.00
);

-- 15. جدول تراکنش‌های خزانه (دریافت و پرداخت نقدی و کارتخوان)
CREATE TABLE IF NOT EXISTS treasury_transactions (
    id VARCHAR(64) PRIMARY KEY,
    transaction_type VARCHAR(20) NOT NULL CHECK (transaction_type IN ('receive', 'pay')),
    treasury_account_id VARCHAR(64) NOT NULL REFERENCES treasury_accounts(id),
    person_id VARCHAR(64) NOT NULL REFERENCES persons(id),
    amount NUMERIC(18, 2) NOT NULL,
    date VARCHAR(10) NOT NULL,
    tracking_number VARCHAR(50),
    description TEXT,
    voucher_id VARCHAR(64) REFERENCES accounting_vouchers(id),
    created_by VARCHAR(64) REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 16. جدول چک‌های تجاری (دریافتی و پرداختی)
CREATE TABLE IF NOT EXISTS cheques (
    id VARCHAR(64) PRIMARY KEY,
    cheque_type VARCHAR(20) NOT NULL CHECK (cheque_type IN ('received', 'issued')),
    cheque_number VARCHAR(50) NOT NULL,
    bank_name VARCHAR(50) NOT NULL,
    branch_name VARCHAR(50),
    account_number VARCHAR(50) NOT NULL,
    sayad_number VARCHAR(30),
    due_date VARCHAR(10) NOT NULL,
    amount NUMERIC(18, 2) NOT NULL,
    person_id VARCHAR(64) NOT NULL REFERENCES persons(id),
    status VARCHAR(20) NOT NULL CHECK (status IN ('in_process', 'cleared', 'bounced', 'returned')),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 17. جدول لاگ‌ها و تاریخچه عملیات (Audit Trail)
CREATE TABLE IF NOT EXISTS audit_logs (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL,
    user_name VARCHAR(100) NOT NULL,
    action VARCHAR(20) NOT NULL CHECK (action IN ('create', 'update', 'delete', 'approve', 'login')),
    module VARCHAR(50) NOT NULL,
    entity_id VARCHAR(64),
    description TEXT NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 18. جدول تنظیمات نرم‌افزار
CREATE TABLE IF NOT EXISTS store_settings (
    key VARCHAR(50) PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =========================================================================
-- ایندکس‌ها برای بهینه‌سازی سرعت جست‌وجو و گزارش‌گیری
-- =========================================================================
CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode);
CREATE INDEX IF NOT EXISTS idx_products_code ON products(code);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_persons_mobile ON persons(mobile);
CREATE INDEX IF NOT EXISTS idx_invoices_person ON invoices(person_id);
CREATE INDEX IF NOT EXISTS idx_invoices_date ON invoices(invoice_date);
CREATE INDEX IF NOT EXISTS idx_kardex_product ON stock_kardex(product_id);
CREATE INDEX IF NOT EXISTS idx_voucher_items_account ON accounting_voucher_items(account_code);
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp);
