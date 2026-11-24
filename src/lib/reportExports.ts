/**
 * ابزارهای خروجی Excel (XLS / CSV با BOM فارسی) و تولید گزارش چاپی / PDF رسمی
 */
import { api } from './api.ts';
import { PermissionModule } from '../types/index.ts';

export interface ExportColumn {
  key: string;
  header: string;
  align?: 'right' | 'center' | 'left';
  isCurrency?: boolean;
}

export interface ExportReportConfig {
  filename: string;
  reportTitle: string;
  reportSubtitle?: string;
  storeName?: string;
  fiscalYear?: string;
  activeFiltersText?: string;
  columns: ExportColumn[];
  rows: Record<string, any>[];
  summaryCards?: { label: string; value: string }[];
  footerTotals?: Record<string, any>;
  permissionModule?: PermissionModule;
}

/**
 * ۱. خروجی CSV استاندارد با UTF-8 BOM جهت باز شدن مستقیم و صحیح حروف فارسی در Microsoft Excel
 */
export function exportReportToCSV(config: ExportReportConfig): void {
  const { filename, reportTitle, activeFiltersText, columns, rows, footerTotals } = config;
  api
    .authorizeAction({
      module: config.permissionModule || 'reports',
      action: 'export',
      description: `خروجی CSV گزارش «${reportTitle}» (${rows.length} ردیف)`,
      entityId: filename,
    })
    .catch(() => {});

  const escapeCsvCell = (val: any): string => {
    if (val === null || val === undefined) return '""';
    const str = String(val).replace(/"/g, '""');
    return `"${str}"`;
  };

  const csvLines: string[] = [];
  // سطر عنوان گزارش
  csvLines.push(escapeCsvCell(`${config.storeName || 'فروشگاه خرازی نگین'} - ${reportTitle}`));
  if (activeFiltersText) {
    csvLines.push(escapeCsvCell(`فیلترهای اعمال‌شده: ${activeFiltersText}`));
  }
  csvLines.push(''); // خط خالی

  // هدر ستون‌ها
  csvLines.push(columns.map((c) => escapeCsvCell(c.header)).join(','));

  // ردیف‌های داده
  for (const row of rows) {
    const line = columns.map((c) => escapeCsvCell(row[c.key] ?? '')).join(',');
    csvLines.push(line);
  }

  // ردیف جمع کل در صورت وجود
  if (footerTotals) {
    const footerLine = columns.map((c) => escapeCsvCell(footerTotals[c.key] ?? '')).join(',');
    csvLines.push(footerLine);
  }

  const csvContent = '\uFEFF' + csvLines.join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  triggerBrowserDownload(blob, `${filename}.csv`);
}

/**
 * ۲. خروجی فایل Excel قالب‌بندی شده (.xls) با جدول راست‌به‌چپ، کادر، فونت فارسی و ردیف جمع کل
 */
export function exportReportToExcelXLS(config: ExportReportConfig): void {
  const {
    filename,
    reportTitle,
    reportSubtitle,
    storeName = 'فروشگاه خرازی و ملزومات خیاطی نگین',
    fiscalYear = '۱۴۰۳',
    activeFiltersText,
    columns,
    rows,
    summaryCards,
    footerTotals,
  } = config;

  api
    .authorizeAction({
      module: config.permissionModule || 'reports',
      action: 'export',
      description: `خروجی Excel (.xls) گزارش «${reportTitle}» (${rows.length} ردیف)`,
      entityId: filename,
    })
    .catch(() => {});

  const esc = (v: any) =>
    String(v ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

  const summaryHtml =
    summaryCards && summaryCards.length > 0
      ? `<tr>
          <td colspan="${columns.length}" style="background:#f8fafc;padding:8px;border:1px solid #cbd5e1;font-family:Tahoma,sans-serif;font-size:11pt;">
            ${summaryCards.map((s) => `<b>${esc(s.label)}:</b> ${esc(s.value)}`).join(' &nbsp; | &nbsp; ')}
          </td>
        </tr>`
      : '';

  const headersHtml = columns
    .map(
      (c) =>
        `<th style="background:#312e81;color:#ffffff;font-weight:bold;padding:8px 10px;border:1px solid #1e1b4b;text-align:${
          c.align || 'right'
        };font-family:Tahoma,sans-serif;font-size:10pt;">${esc(c.header)}</th>`
    )
    .join('');

  const rowsHtml = rows
    .map((r, idx) => {
      const bg = idx % 2 === 0 ? '#ffffff' : '#f8fafc';
      const cells = columns
        .map(
          (c) =>
            `<td style="background:${bg};padding:6px 10px;border:1px solid #cbd5e1;text-align:${
              c.align || 'right'
            };font-family:Tahoma,sans-serif;font-size:10pt;">${esc(r[c.key] ?? '')}</td>`
        )
        .join('');
      return `<tr>${cells}</tr>`;
    })
    .join('');

  const footerHtml = footerTotals
    ? `<tr>
        ${columns
          .map(
            (c) =>
              `<td style="background:#e0e7ff;color:#1e1b4b;font-weight:bold;padding:8px 10px;border:1px solid #818cf8;text-align:${
                c.align || 'right'
              };font-family:Tahoma,sans-serif;font-size:10pt;">${esc(footerTotals[c.key] ?? '')}</td>`
          )
          .join('')}
      </tr>`
    : '';

  const htmlWorkbook = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40" dir="rtl">
<head>
  <meta charset="utf-8" />
  <!--[if gte mso 9]>
  <xml>
    <x:ExcelWorkbook>
      <x:ExcelWorksheets>
        <x:ExcelWorksheet>
          <x:Name>${esc(reportTitle.slice(0, 28))}</x:Name>
          <x:WorksheetOptions>
            <x:DisplayRightToLeft/>
          </x:WorksheetOptions>
        </x:ExcelWorksheet>
      </x:ExcelWorksheets>
    </x:ExcelWorkbook>
  </xml>
  <![endif]-->
</head>
<body dir="rtl">
  <table dir="rtl" style="border-collapse:collapse;width:100%;">
    <tr>
      <td colspan="${columns.length}" style="background:#1e1b4b;color:#ffffff;font-weight:bold;font-size:13pt;padding:12px;text-align:center;font-family:Tahoma,sans-serif;">
        ${esc(storeName)} - ${esc(reportTitle)} (سال مالی ${esc(fiscalYear)})
      </td>
    </tr>
    ${
      reportSubtitle || activeFiltersText
        ? `<tr>
            <td colspan="${columns.length}" style="background:#eef2ff;color:#312e81;font-size:10pt;padding:6px 10px;text-align:right;border:1px solid #c7d2fe;font-family:Tahoma,sans-serif;">
              ${reportSubtitle ? `${esc(reportSubtitle)} &nbsp; ` : ''}${
            activeFiltersText ? `| فیلترها: ${esc(activeFiltersText)}` : ''
          }
            </td>
          </tr>`
        : ''
    }
    ${summaryHtml}
    <thead>
      <tr>${headersHtml}</tr>
    </thead>
    <tbody>
      ${rowsHtml}
      ${footerHtml}
    </tbody>
  </table>
</body>
</html>`;

  const blob = new Blob(['\uFEFF' + htmlWorkbook], {
    type: 'application/vnd.ms-excel;charset=utf-8;',
  });
  triggerBrowserDownload(blob, `${filename}.xls`);
}

/**
 * ۳. تولید و دانلود سند رسمی آماده چاپ / PDF مستقل (مناسب ذخیره یا چاپ در هر مرورگر)
 */
export function downloadPrintablePdfDocument(config: ExportReportConfig): void {
  const {
    filename,
    reportTitle,
    reportSubtitle,
    storeName = 'فروشگاه خرازی و ملزومات خیاطی نگین',
    fiscalYear = '۱۴۰۳',
    activeFiltersText,
    columns,
    rows,
    summaryCards,
    footerTotals,
  } = config;

  api
    .authorizeAction({
      module: config.permissionModule || 'reports',
      action: 'print',
      description: `چاپ / خروجی PDF رسمی گزارش «${reportTitle}» (${rows.length} ردیف)`,
      entityId: filename,
    })
    .catch(() => {});

  const esc = (v: any) =>
    String(v ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

  const nowDate = new Date().toLocaleDateString('fa-IR');

  const summaryHtml =
    summaryCards && summaryCards.length > 0
      ? `<div class="summary-grid">
          ${summaryCards
            .map(
              (c) => `<div class="summary-card">
                <div class="summary-label">${esc(c.label)}</div>
                <div class="summary-val">${esc(c.value)}</div>
              </div>`
            )
            .join('')}
        </div>`
      : '';

  const html = `<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head>
  <meta charset="utf-8" />
  <title>${esc(reportTitle)} - ${esc(storeName)}</title>
  <style>
    @page { size: A4 landscape; margin: 12mm; }
    * { box-sizing: border-box; }
    body {
      font-family: 'Vazirmatn', Tahoma, Arial, sans-serif;
      direction: rtl;
      color: #0f172a;
      background: #ffffff;
      margin: 0;
      padding: 20px;
      font-size: 12px;
    }
    .header-box {
      border: 2px solid #1e293b;
      border-radius: 12px;
      padding: 14px 18px;
      margin-bottom: 14px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: #f8fafc;
    }
    .store-title { font-size: 18px; font-weight: 900; color: #1e1b4b; margin-bottom: 4px; }
    .report-title { font-size: 15px; font-weight: bold; color: #334155; }
    .meta-box { text-align: left; font-size: 11px; color: #475569; line-height: 1.7; }
    .filters-bar {
      background: #eef2ff;
      border: 1px solid #c7d2fe;
      color: #312e81;
      padding: 8px 12px;
      border-radius: 8px;
      margin-bottom: 12px;
      font-size: 11px;
      font-weight: bold;
    }
    .summary-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
      gap: 10px;
      margin-bottom: 14px;
    }
    .summary-card {
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      padding: 8px 12px;
      background: #f8fafc;
    }
    .summary-label { font-size: 10px; color: #64748b; margin-bottom: 3px; }
    .summary-val { font-size: 13px; font-weight: bold; color: #0f172a; }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 20px;
    }
    th {
      background: #1e293b;
      color: #ffffff;
      padding: 8px 10px;
      border: 1px solid #1e293b;
      font-size: 11px;
      font-weight: bold;
    }
    td {
      padding: 7px 10px;
      border: 1px solid #cbd5e1;
      font-size: 11px;
    }
    tr:nth-child(even) td { background: #f8fafc; }
    .footer-row td {
      background: #e0e7ff !important;
      font-weight: bold;
      border-top: 2px solid #4338ca;
      color: #1e1b4b;
    }
    .signatures {
      display: flex;
      justify-content: space-around;
      margin-top: 28px;
      padding-top: 16px;
      border-top: 1px dashed #94a3b8;
      font-size: 11px;
      color: #475569;
    }
    .sig-box { text-align: center; width: 200px; }
    .no-print-bar {
      background: #1e1b4b;
      color: #fff;
      padding: 10px 16px;
      border-radius: 8px;
      margin-bottom: 16px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .btn-print {
      background: #4f46e5;
      color: #fff;
      border: none;
      padding: 8px 16px;
      border-radius: 6px;
      font-weight: bold;
      cursor: pointer;
      font-family: inherit;
    }
    @media print {
      .no-print-bar { display: none !important; }
      body { padding: 0; }
    }
  </style>
</head>
<body>
  <div class="no-print-bar">
    <span>نسخه رسمی آماده چاپ و ذخیره PDF (در پنجره چاپ گزینه Save as PDF را انتخاب نمایید)</span>
    <button class="btn-print" onclick="window.print()">چاپ / ذخیره به صورت PDF</button>
  </div>
  <div class="header-box">
    <div>
      <div class="store-title">${esc(storeName)}</div>
      <div class="report-title">${esc(reportTitle)}</div>
      ${reportSubtitle ? `<div style="font-size:11px;color:#64748b;margin-top:3px;">${esc(reportSubtitle)}</div>` : ''}
    </div>
    <div class="meta-box">
      <div><b>سال مالی:</b> ${esc(fiscalYear)}</div>
      <div><b>تاریخ استخراج گزارش:</b> ${esc(nowDate)}</div>
      <div><b>تعداد ردیف‌ها:</b> ${rows.length.toLocaleString('fa-IR')} ردیف</div>
    </div>
  </div>
  ${activeFiltersText ? `<div class="filters-bar">فیلترهای گزارش: ${esc(activeFiltersText)}</div>` : ''}
  ${summaryHtml}
  <table>
    <thead>
      <tr>
        ${columns.map((c) => `<th style="text-align:${c.align || 'right'}">${esc(c.header)}</th>`).join('')}
      </tr>
    </thead>
    <tbody>
      ${rows
        .map(
          (r) =>
            `<tr>${columns
              .map((c) => `<td style="text-align:${c.align || 'right'}">${esc(r[c.key] ?? '')}</td>`)
              .join('')}</tr>`
        )
        .join('')}
      ${
        footerTotals
          ? `<tr class="footer-row">${columns
              .map(
                (c) =>
                  `<td style="text-align:${c.align || 'right'}">${esc(footerTotals[c.key] ?? '')}</td>`
              )
              .join('')}</tr>`
          : ''
      }
    </tbody>
  </table>
  <div class="signatures">
    <div class="sig-box">مهر و امضای تهیه‌کننده گزارش / حسابدار</div>
    <div class="sig-box">مهر و امضای مسئول انبار / خزانه‌دار</div>
    <div class="sig-box">مهر و امضای مدیریت فروشگاه خرازی</div>
  </div>
</body>
</html>`;

  const blob = new Blob([html], { type: 'text/html;charset=utf-8;' });
  triggerBrowserDownload(blob, `${filename}-PDF-Print.html`);
}

function triggerBrowserDownload(blob: Blob, fullFilename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', fullFilename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 2500);
}
