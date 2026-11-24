import React, { createContext, useContext, useState, useEffect } from 'react';
import { StoreSettings } from '../types/index.ts';
import { api } from '../lib/api.ts';
import { formatCurrency } from '../lib/formatters.ts';

interface SettingsContextType {
  settings: StoreSettings;
  isLoading: boolean;
  updateSettings: (newSettings: Partial<StoreSettings>) => Promise<void>;
  formatMoney: (amount: number, showUnit?: boolean) => string;
}

const defaultSettings: StoreSettings = {
  storeName: 'فروشگاه و بازرگانی سپهر',
  guildName: 'صنف بازرگانی و فروشگاهی',
  storeOwner: 'مدیر سیستم',
  phone: '۰۲۱-۵۵۴۴۳۳۲۲',
  address: 'تهران، بازار مرکزی',
  economicCode: '۴۱۱۵۶۷۸۹۲۳۴۱',
  nationalId: '۱۰۱۰۲۸۳۴۷۵۶',
  postalCode: '۱۱۶۳۸۴۷۲۹۱',
  currency: 'ریال',
  defaultTaxPercent: 0,
  activeFiscalYear: '۱۴۰۴',
  allowNegativeStock: false,
  requireBalancedVouchers: true,
  defaultPrintLayout: 'a4',
  printHeaderNote: 'سامانه جامع مالی، حسابداری و انبارداری سپهر',
  printFooterNote: 'از حسن انتخاب و اعتماد شما سپاسگزاریم.',
  invoicePrintConfig: {
    theme: 'holoo-teal',
    templateStyle: 'holoo_classic',
    paperSize: 'a4',
    orientation: 'portrait',
    fontSize: 'sm',
    printScale: 100,
    showBarcode: true,
    showTax: true,
    showDiscount: true,
    showColorSize: true,
    showAmountInWords: true,
    showPaymentBreakdown: true,
    showSignatures: true,
    showStoreLogo: true,
    showGuildName: true,
    showCustomerBalance: true,
    showEconomicCode: true,
    customTitle: 'فاکتور رسمی فروش کالا و خدمات',
    customSlogan: 'سامانه یکپارچه مدیریت مالی و فروشگاهی سپهر',
    customTerms: 'شرایط: تعویض کالا تا ۴۸ ساعت با ارائه فاکتور امکان‌پذیر است.',
    headerAlignment: 'right',
    customerInfoAlignment: 'right',
    tableHeaderAlignment: 'center',
    tableBodyAlignment: 'right',
    notesAlignment: 'right',
    termsAlignment: 'right',
    signaturesAlignment: 'between',
  },
};

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<StoreSettings>(defaultSettings);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const loadSettings = async () => {
    try {
      setIsLoading(true);
      const data = await api.getSettings();
      setSettings(data);
    } catch (err) {
      console.error('Failed to load settings:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  const updateSettings = async (newSettings: Partial<StoreSettings>) => {
    try {
      const updated = await api.updateSettings(newSettings);
      setSettings(updated);
    } catch (err) {
      console.error('Failed to update settings:', err);
      throw err;
    }
  };

  const formatMoney = (amount: number, showUnit: boolean = true): string => {
    return formatCurrency(amount, settings.currency, showUnit);
  };

  return (
    <SettingsContext.Provider
      value={{
        settings,
        isLoading,
        updateSettings,
        formatMoney,
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
};
