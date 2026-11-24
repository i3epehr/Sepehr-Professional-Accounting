import React, { useState } from 'react';
import {
  Settings,
  Store,
  Printer,
  UserCheck,
  Database,
  History,
  ShieldCheck,
} from 'lucide-react';
import { PageHeader } from '../common/PageHeader.tsx';
import { SectionPills, SectionPillItem } from '../common/SectionPills.tsx';
import { SettingsModule } from './SettingsModule.tsx';
import { PrintBackupModule } from '../backup/PrintBackupModule.tsx';
import { SystemMaintenanceModule } from './SystemMaintenanceModule.tsx';
import { UsersModule } from '../users/UsersModule.tsx';
import { AuditLogsModule } from '../audit/AuditLogsModule.tsx';
import { FoundationModule } from '../foundation/FoundationModule.tsx';

type SettingsSection =
  | 'store_info'
  | 'print_templates'
  | 'system_maintenance'
  | 'users_rbac'
  | 'audit_logs'
  | 'foundation';

export const SettingsHub: React.FC = () => {
  const [activeSection, setActiveSection] = useState<SettingsSection>('store_info');

  const pillItems: SectionPillItem<SettingsSection>[] = [
    {
      id: 'store_info',
      label: 'اطلاعات فروشگاه و صنف',
      icon: Store,
    },
    {
      id: 'print_templates',
      label: 'چاپ و قالب‌های فاکتور',
      icon: Printer,
    },
    {
      id: 'system_maintenance',
      label: 'پشتیبان‌گیری، بروزرسانی و نگهداری سیستم',
      icon: Database,
    },
    {
      id: 'users_rbac',
      label: 'کاربران و سطوح دسترسی',
      icon: UserCheck,
    },
    {
      id: 'audit_logs',
      label: 'رویدادنگار امنیتی سیستم',
      icon: History,
    },
    {
      id: 'foundation',
      label: 'تراز و سلامت فنی دیتابیس',
      icon: ShieldCheck,
    },
  ];

  return (
    <div className="space-y-5">
      {/* 1. Header */}
      <PageHeader
        title="مرکز تنظیمات سیستم، امنیت و نگهداری"
        subtitle="مدیریت اطلاعات صنف، قالب‌های چاپی، پشتیبان‌گیری و بازیابی پایگاه داده، بروزرسانی آنلاین، صفر کردن برنامه و لاگ‌های امنیتی"
        icon={Settings}
      />

      {/* 2. Settings Sub-sections Switcher */}
      <SectionPills items={pillItems} activeId={activeSection} onChange={setActiveSection} />

      {/* 3. Section Content */}
      <div className="space-y-4">
        {activeSection === 'store_info' && <SettingsModule />}
        {activeSection === 'print_templates' && <PrintBackupModule />}
        {activeSection === 'system_maintenance' && <SystemMaintenanceModule />}
        {activeSection === 'users_rbac' && <UsersModule />}
        {activeSection === 'audit_logs' && <AuditLogsModule />}
        {activeSection === 'foundation' && <FoundationModule />}
      </div>
    </div>
  );
};
