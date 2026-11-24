/**
 * توابع کاربردی تقویم شمسی، قالب‌بندی اعداد و مبالغ به فارسی
 * Persian/Jalali dates, numbers and currency formatters
 */

const PERSIAN_DIGITS = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
const LATIN_DIGITS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];

export function toPersianDigits(input: string | number | null | undefined): string {
  if (input === null || input === undefined) return '';
  const str = input.toString();
  return str.replace(/[0-9]/g, (w) => PERSIAN_DIGITS[+w]).replace(/,/g, '٬');
}

export function toLatinDigits(input: string): string {
  if (!input) return '';
  let str = input.replace(/٬/g, '');
  for (let i = 0; i < 10; i++) {
    str = str.replace(new RegExp(PERSIAN_DIGITS[i], 'g'), LATIN_DIGITS[i]);
  }
  return str;
}

export function formatCurrency(
  amount: number | null | undefined,
  currency: 'تومان' | 'ریال' = 'ریال',
  showUnit: boolean = true
): string {
  if (amount === null || amount === undefined || isNaN(amount)) {
    return showUnit ? `۰ ${currency}` : '۰';
  }

  const isNeg = amount < 0;
  const parts = Math.round(Math.abs(amount)).toString().split('.');
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, '٬');
  const formatted = (isNeg ? '−' : '') + toPersianDigits(parts.join('.'));

  return showUnit ? `${formatted} ${currency}` : formatted;
}

export function formatQuantity(qty: number, isDecimalAllowed: boolean = false): string {
  if (qty === null || qty === undefined || isNaN(qty)) return '۰';
  const val = isDecimalAllowed ? Number(qty.toFixed(2)) : Math.round(qty);
  return toPersianDigits(val.toLocaleString('fa-IR'));
}

/**
 * الگوریتم دقیق تبدیل میلادی به شمسی (Jalali Converter)
 */
export function gregorianToJalali(gy: number, gm: number, gd: number): [number, number, number] {
  const g_d_m = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
  let jy = gy <= 1600 ? 0 : 979;
  gy -= gy <= 1600 ? 621 : 1600;
  const gy2 = gm > 2 ? gy + 1 : gy;
  let days =
    365 * gy +
    Math.floor((gy2 + 3) / 4) -
    Math.floor((gy2 + 99) / 100) +
    Math.floor((gy2 + 399) / 400) -
    80 +
    gd +
    g_d_m[gm - 1];
  jy += 33 * Math.floor(days / 12053);
  days %= 12053;
  jy += 4 * Math.floor(days / 1461);
  days %= 1461;
  if (days > 365) {
    jy += Math.floor((days - 1) / 365);
    days = (days - 1) % 365;
  }
  let jm: number;
  let jd: number;
  if (days < 186) {
    jm = 1 + Math.floor(days / 31);
    jd = 1 + (days % 31);
  } else {
    jm = 7 + Math.floor((days - 186) / 30);
    jd = 1 + ((days - 186) % 30);
  }
  return [jy, jm, jd];
}

export function getCurrentJalaliDate(): string {
  const now = new Date();
  const [jy, jm, jd] = gregorianToJalali(now.getFullYear(), now.getMonth() + 1, now.getDate());
  const monthStr = jm < 10 ? `0${jm}` : `${jm}`;
  const dayStr = jd < 10 ? `0${jd}` : `${jd}`;
  return `${jy}/${monthStr}/${dayStr}`;
}

export function getCurrentJalaliDatePersian(): string {
  return toPersianDigits(getCurrentJalaliDate());
}

export function getMonthName(monthNumber: number): string {
  const months = [
    'فروردین',
    'اردیبهشت',
    'خرداد',
    'تیر',
    'مرداد',
    'شهریور',
    'مهر',
    'آبان',
    'آذر',
    'دی',
    'بهمن',
    'اسفند',
  ];
  return months[monthNumber - 1] || '';
}

export function formatJalaliReadable(jalaliDate: string): string {
  const parts = toLatinDigits(jalaliDate).split('/');
  if (parts.length !== 3) return toPersianDigits(jalaliDate);
  const year = parts[0];
  const month = parseInt(parts[1], 10);
  const day = parseInt(parts[2], 10);
  return `${toPersianDigits(day)} ${getMonthName(month)} ${toPersianDigits(year)}`;
}

/**
 * تبدیل اعداد و ارقام مالی به حروف فارسی (برای فاکتورهای رسمی و هلو)
 */
export function numberToPersianWords(num: number | null | undefined): string {
  if (num === null || num === undefined || isNaN(num) || num === 0) return 'صفر تومان';

  const isNegative = num < 0;
  let n = Math.abs(Math.round(num));

  const units = ['', 'یک', 'دو', 'سه', 'چهار', 'پنج', 'شش', 'هفت', 'هشت', 'نه'];
  const teens = ['ده', 'یازده', 'دوازده', 'سیزده', 'چهارده', 'پانزده', 'شانزده', 'هفده', 'هجده', 'نوزده'];
  const tens = ['', '', 'بیست', 'سی', 'چهل', 'پنجاه', 'شصت', 'هفتاد', 'هشتاد', 'نود'];
  const hundreds = ['', 'صد', 'دویست', 'سیصد', 'چهارصد', 'پانصد', 'ششصد', 'هفتصد', 'هشتصد', 'نهصد'];
  const scales = ['', 'هزار', 'میلیون', 'میلیارد', 'تریلیون'];

  function convertThreeDigits(val: number): string {
    const parts: string[] = [];
    const h = Math.floor(val / 100);
    const rem = val % 100;
    const t = Math.floor(rem / 10);
    const u = rem % 10;

    if (h > 0) parts.push(hundreds[h]);

    if (rem >= 10 && rem <= 19) {
      parts.push(teens[rem - 10]);
    } else {
      if (t > 1) parts.push(tens[t]);
      if (u > 0) parts.push(units[u]);
    }

    return parts.join(' و ');
  }

  const chunks: string[] = [];
  let scaleIndex = 0;

  while (n > 0) {
    const chunk = n % 1000;
    if (chunk > 0) {
      const words = convertThreeDigits(chunk);
      const scale = scales[scaleIndex];
      chunks.unshift(scale ? `${words} ${scale}` : words);
    }
    n = Math.floor(n / 1000);
    scaleIndex++;
  }

  const result = (isNegative ? 'منفی ' : '') + chunks.join(' و ') + ' تومان';
  return result;
}
