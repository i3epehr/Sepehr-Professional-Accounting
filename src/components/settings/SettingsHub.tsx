import React, { useState } from 'react';
import {
  Settings,
  Store,
  Printer,
  UserCheck,
  Database,
  History,
  Shield,
  FileText,
  Sliders,
  CheckCircle2,
} from 'lucide-react';
import { PageHeader } from '../common/PageHeader.tsx';
import { SectionPills, SectionPillItem } from '../common/SectionPills.tsx';
import { SettingsModule } from './SettingsModule.tsx';
import { PrintBackupModule } from '../backup/PrintBackupModule.tsx';
import { UsersModule } from '../users/UsersModule.tsx';
import { AuditLogsModule } from '../audit/AuditLogsModule.tsx';
import { FoundationModule } from '../foundation/FoundationModule.tsx';

type SettingsSection = 'store_info' | 'print_templates' | 'users_rbac' | 'backup_system' | 'audit_logs';

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
      id: 'users_rbac',
      label: 'کاربران و سطوح دسترسی',
      icon: UserCheck,
    },
    {
      id: 'backup_system',
      label: 'پشتیبان‌گیری و سلامت دیتابیس',
      icon: Database,
    },
    {
      id: 'audit_logs',
      label: 'رویدادنگار امنیتی سیستم',
      icon: History,
    },
  ];

  return (
    <div className="space-y-5">
      {/* 1. Header */}
      <PageHeader
        title="مرکز تنظیمات سیستم، امنیت و پیکربندی"
        subtitle="مدیریت اطلاعات صنف و پروانه، قالب‌های چاپی، تعریف پرسنل و مجوزهای RBAC، پشتیبان‌گیری و ممیزی سیستم"
        icon={Settings}
      />

      {/* 2. Settings Sub-sections Switcher */}
      <SectionPills items={pillItems} activeId={activeSection} onChange={setActiveSection} />

      {/* 3. Section Content */}
      <div className="space-y-4">
        {activeSection === 'store_info' && <SettingsModule />}
        {activeSection === 'print_templates' && <PrintBackupModule />}
        {activeSection === 'users_rbac' && <UsersModule />}
        {activeSection === 'backup_system' && <FoundationModule />}
        {activeSection === 'audit_logs' && <AuditLogsModule />}
      </div>
    </div>
  );
};
