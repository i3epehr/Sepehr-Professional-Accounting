import React from 'react';
import { ReportsModule } from '../reports/ReportsModule.tsx';

export const FinancialReportsModule: React.FC = () => {
  return <ReportsModule initialTab="income_balance_sheet" />;
};
