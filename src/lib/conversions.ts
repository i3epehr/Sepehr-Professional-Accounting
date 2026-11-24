/**
 * موتور تخصصی محاسبات و تبدیل واحدهای اندازه‌گیری خرازی و تسهیم هزینه‌های جانبی و خرج‌کار
 * Haberdashery Measurement Units Conversion & Cost Allocation Engine
 */

import { Unit, Product, AllocationMethod, AllocatedProductItem } from '../types/index.ts';

/**
 * ماتریس پیش‌فرض ضرایب تبدیل خانواده‌های استاندارد خرازی
 */
export const STANDARD_CONVERSIONS: Record<string, { to: string; factor: number }> = {
  // خانواده طول
  'u-roll': { to: 'u-meter', factor: 25 }, // پیش‌فرض استاندارد رول به متر (۲۵ متر)
  'u-bolt': { to: 'u-meter', factor: 50 }, // طاقه به متر (۵۰ متر)
  'u-cm': { to: 'u-meter', factor: 0.01 }, // سانتیمتر به متر
  'u-yard': { to: 'u-meter', factor: 0.9144 }, // یارد به متر
  // خانواده وزن
  'u-gram': { to: 'u-kg', factor: 0.001 }, // گرم به کیلوگرم
  // خانواده شمارش
  'u-pair': { to: 'u-item', factor: 2 }, // جفت به عدد (۲ عدد)
  'u-pack': { to: 'u-item', factor: 100 }, // پیش‌فرض بسته به عدد
  'u-dozen': { to: 'u-item', factor: 12 }, // جین به عدد (۱۲ عدد)
  'u-gross': { to: 'u-item', factor: 144 }, // قواره به عدد (۱۴۴ عدد)
  'u-box': { to: 'u-pack', factor: 24 }, // کارتن به بسته (۲۴ بسته)
};

/**
 * تبدیل دقیق بین دو واحد اندازه‌گیری
 */
export function convertBetweenUnits(
  quantity: number,
  fromUnit: Unit,
  toUnit: Unit,
  product?: Product
): {
  result: number;
  factor: number;
  formula: string;
  isExact: boolean;
  notes?: string;
} {
  if (quantity === 0) {
    return { result: 0, factor: 1, formula: '۰', isExact: true };
  }

  // ۱. حالت واحدهای یکسان
  if (fromUnit.id === toUnit.id) {
    return {
      result: quantity,
      factor: 1,
      formula: `${quantity} ${fromUnit.name} = ${quantity} ${toUnit.name}`,
      isExact: true,
    };
  }

  // ۲. بررسی ضریب اختصاصی در کالا (Product Specific Conversion Override)
  if (product && product.unitConversions && product.unitConversions.length > 0) {
    // از واحد فرعی کالا به واحد اصلی کالا
    const fromSpecific = product.unitConversions.find((c) => c.unitId === fromUnit.id);
    if (fromSpecific && toUnit.id === product.baseUnitId) {
      const res = roundPrecision(quantity * fromSpecific.conversionFactor, 4);
      return {
        result: res,
        factor: fromSpecific.conversionFactor,
        formula: `${quantity} ${fromUnit.name} × ${fromSpecific.conversionFactor} = ${res} ${toUnit.name}`,
        isExact: true,
        notes: `بر اساس ضریب اختصاصی تعریف‌شده در مشخصات کالا «${product.name}»`,
      };
    }

    // از واحد اصلی کالا به واحد فرعی
    const toSpecific = product.unitConversions.find((c) => c.unitId === toUnit.id);
    if (toSpecific && fromUnit.id === product.baseUnitId && toSpecific.conversionFactor > 0) {
      const res = roundPrecision(quantity / toSpecific.conversionFactor, 4);
      return {
        result: res,
        factor: 1 / toSpecific.conversionFactor,
        formula: `${quantity} ${fromUnit.name} ÷ ${toSpecific.conversionFactor} = ${res} ${toUnit.name}`,
        isExact: true,
        notes: `بر اساس معکوس ضریب اختصاصی کالا «${product.name}»`,
      };
    }

    // بین دو واحد فرعی همان کالا
    if (fromSpecific && toSpecific && toSpecific.conversionFactor > 0) {
      const toBase = quantity * fromSpecific.conversionFactor;
      const res = roundPrecision(toBase / toSpecific.conversionFactor, 4);
      const compositeFactor = roundPrecision(fromSpecific.conversionFactor / toSpecific.conversionFactor, 6);
      return {
        result: res,
        factor: compositeFactor,
        formula: `(${quantity} × ${fromSpecific.conversionFactor}) ÷ ${toSpecific.conversionFactor} = ${res} ${toUnit.name}`,
        isExact: true,
      };
    }
  }

  // ۳. تبدیل‌های مستقیم تعریف‌شده در خود Unit
  if (fromUnit.baseUnitId === toUnit.id && fromUnit.conversionFactor) {
    const res = roundPrecision(quantity * fromUnit.conversionFactor, 4);
    return {
      result: res,
      factor: fromUnit.conversionFactor,
      formula: `${quantity} ${fromUnit.name} × ${fromUnit.conversionFactor} = ${res} ${toUnit.name}`,
      isExact: true,
    };
  }

  if (toUnit.baseUnitId === fromUnit.id && toUnit.conversionFactor && toUnit.conversionFactor > 0) {
    const res = roundPrecision(quantity / toUnit.conversionFactor, 4);
    return {
      result: res,
      factor: 1 / toUnit.conversionFactor,
      formula: `${quantity} ${fromUnit.name} ÷ ${toUnit.conversionFactor} = ${res} ${toUnit.name}`,
      isExact: true,
    };
  }

  // ۴. تبدیل هم‌خانواده از طریق واحد ریشه مشترک
  if (fromUnit.unitFamily === toUnit.unitFamily && fromUnit.unitFamily !== 'other') {
    // محاسبه ضریب نسبت به واحد مبنای سیستم
    const fromFactor = getBaseFamilyFactor(fromUnit);
    const toFactor = getBaseFamilyFactor(toUnit);

    if (toFactor > 0) {
      const valueInRoot = quantity * fromFactor;
      const finalResult = roundPrecision(valueInRoot / toFactor, 4);
      const netFactor = roundPrecision(fromFactor / toFactor, 6);
      return {
        result: finalResult,
        factor: netFactor,
        formula: `${quantity} ${fromUnit.name} × (${fromFactor} / ${toFactor}) = ${finalResult} ${toUnit.name}`,
        isExact: true,
      };
    }
  }

  // ۵. تبدیل‌های بین خانواده با استفاده از ابعاد و چگالی کالا
  // مثلا تبدیل متراژ به وزن با استفاده از وزن در هر متر، یا تبدیل بسته به وزن
  if (product) {
    // اگر کالایی وزن و متراژ دارد
    if (
      (fromUnit.unitFamily === 'weight' && toUnit.unitFamily === 'length') ||
      (fromUnit.unitFamily === 'length' && toUnit.unitFamily === 'weight')
    ) {
      const weightKg = product.weight ? (product.weightUnit === 'گرم' ? product.weight / 1000 : product.weight) : 0;
      const lengthMeters = product.length ? (product.lengthUnit === 'سانتی‌متر' ? product.length / 100 : product.length) : 0;

      if (weightKg > 0 && lengthMeters > 0) {
        const kgPerMeter = weightKg / lengthMeters;
        if (fromUnit.unitFamily === 'length' && toUnit.unitFamily === 'weight') {
          // تبدیل طول به متر
          const meters = fromUnit.id === 'u-cm' ? quantity / 100 : quantity;
          const totalKg = meters * kgPerMeter;
          const finalVal = toUnit.id === 'u-gram' ? totalKg * 1000 : totalKg;
          return {
            result: roundPrecision(finalVal, 4),
            factor: roundPrecision(finalVal / quantity, 6),
            formula: `طول ${meters} متر با تراکم وزنی ${roundPrecision(kgPerMeter, 4)} کیلو/متر`,
            isExact: false,
            notes: 'محاسبه تخمینی بر اساس ابعاد و وزن ثبت‌شده در مشخصات کالا',
          };
        }
      }
    }
  }

  // حالت پیش‌فرض در صورت عدم یافتن رابطه تبدیل
  return {
    result: quantity,
    factor: 1,
    formula: `تبدیل مستقیم تعریف نشده است (${fromUnit.name} به ${toUnit.name})`,
    isExact: false,
    notes: 'برای این دو واحد ضریب ریاضی مستقیم یافت نشد.',
  };
}

/**
 * دریافت ضریب تبدیل واحد نسبت به واحد مرجع خانواده فیزیکی
 */
export function getBaseFamilyFactor(unit: Unit): number {
  if (unit.id === 'u-meter') return 1;
  if (unit.id === 'u-cm') return 0.01;
  if (unit.id === 'u-roll') return unit.conversionFactor || 25;
  if (unit.id === 'u-bolt') return unit.conversionFactor || 50;
  if (unit.id === 'u-yard') return 0.9144;

  if (unit.id === 'u-kg') return 1;
  if (unit.id === 'u-gram') return 0.001;

  if (unit.id === 'u-item') return 1;
  if (unit.id === 'u-pair') return 2;
  if (unit.id === 'u-dozen') return 12;
  if (unit.id === 'u-gross') return 144;
  if (unit.id === 'u-pack') return unit.conversionFactor || 100;
  if (unit.id === 'u-box') return (unit.conversionFactor || 24) * 100;

  return unit.conversionFactor || 1;
}

/**
 * محاسبه مقدار کسر شونده از انبار به واحد اصلی کالا
 */
export function calculateItemBaseQuantity(
  quantity: number,
  selectedUnitId: string,
  units: Unit[],
  product: Product
): number {
  if (selectedUnitId === product.baseUnitId) {
    return quantity;
  }

  // ۱. بررسی جدول ضرایب اختصاصی کالا
  const specificConversion = product.unitConversions?.find((c) => c.unitId === selectedUnitId);
  if (specificConversion && specificConversion.conversionFactor > 0) {
    return roundPrecision(quantity * specificConversion.conversionFactor, 4);
  }

  // ۲. بررسی ضریب واحد انتخابی
  const selUnit = units.find((u) => u.id === selectedUnitId);
  const baseUnit = units.find((u) => u.id === product.baseUnitId);

  if (selUnit && baseUnit) {
    const conv = convertBetweenUnits(quantity, selUnit, baseUnit, product);
    return conv.result;
  }

  return quantity;
}

/**
 * محاسبه هوشمند قیمت فروش بر اساس واحد انتخابی (تعداد، متراژ، وزن)
 */
export function calculatePriceForSelectedUnit(
  product: Product,
  selectedUnitId: string,
  units: Unit[],
  priceType: 'retailPrice' | 'wholesalePrice' | 'purchasePrice' = 'retailPrice'
): number {
  const basePrice = product[priceType] || 0;

  if (selectedUnitId === product.baseUnitId) {
    return basePrice;
  }

  // ۱. اگر قیمت اختصاصی برای این واحد فرعی ثبت شده باشد
  const specific = product.unitConversions?.find((c) => c.unitId === selectedUnitId);
  if (specific && specific.price && specific.price > 0) {
    return specific.price;
  }

  // ۲. محاسبه بر اساس ضریب تبدیل
  if (specific && specific.conversionFactor > 0) {
    return Math.round(basePrice * specific.conversionFactor);
  }

  const selUnit = units.find((u) => u.id === selectedUnitId);
  const baseUnit = units.find((u) => u.id === product.baseUnitId);

  if (selUnit && baseUnit) {
    const conv = convertBetweenUnits(1, selUnit, baseUnit, product);
    return Math.round(basePrice * conv.result);
  }

  return basePrice;
}

/**
 * اعتبارسنجی مقادیر اعشاری
 */
export function validateQuantityDecimals(
  quantity: number,
  unit?: Unit
): { valid: boolean; error?: string } {
  if (quantity <= 0) {
    return { valid: false, error: 'مقدار وارد شده باید بزرگتر از صفر باشد.' };
  }

  if (unit && !unit.isDecimalAllowed && !Number.isInteger(quantity)) {
    return {
      valid: false,
      error: `واحد «${unit.name}» فقط مقادیر صحیح می‌پذیرد و امکان ثبت اعشار برای آن وجود ندارد.`,
    };
  }

  return { valid: true };
}

/**
 * الگوریتم جامع تسهیم هزینه جانبی و خرج‌کار (Accessory Cost Allocation)
 * قابلیت تخصیص بر اساس: تعداد، ارزش ریالی، وزن، طول، یا دستی
 */
export interface CostAllocationInputItem {
  productId: string;
  productCode: string;
  productName: string;
  quantity: number;
  unitName: string;
  originalUnitCost: number;
  weightPerUnit?: number; // وزن هر واحد به کیلوگرم
  lengthPerUnit?: number; // طول هر واحد به متر
}

export function allocateAccessoryCost(params: {
  totalAmount: number;
  method: AllocationMethod;
  items: CostAllocationInputItem[];
}): {
  allocatedItems: AllocatedProductItem[];
  totalAllocated: number;
  roundingDifference: number;
  formulaDescription: string;
} {
  const { totalAmount, method, items } = params;

  if (items.length === 0 || totalAmount <= 0) {
    return {
      allocatedItems: [],
      totalAllocated: 0,
      roundingDifference: 0,
      formulaDescription: 'هیچ ردیفی جهت تسهیم هزینه انتخاب نشده است.',
    };
  }

  // حالت سربار عمومی دوره
  if (method === 'overhead') {
    return {
      allocatedItems: [],
      totalAllocated: totalAmount,
      roundingDifference: 0,
      formulaDescription: 'هزینه به عنوان سربار عمومی دوره منظور شد و بر بهای تمام‌شده کالاهای انفرادی سرشکن نمی‌شود.',
    };
  }

  // محاسبه مبنای تسهیم برای هر آیتم
  let weights: number[] = [];
  let formulaDescription = '';

  switch (method) {
    case 'quantity': {
      // تسهیم بر اساس تعداد اقلام
      const totalQuantity = items.reduce((sum, it) => sum + (it.quantity > 0 ? it.quantity : 0), 0);
      formulaDescription = `تسهیم بر اساس تعداد کل اقلام (${totalQuantity.toLocaleString('fa-IR')} واحد)`;
      weights = items.map((it) => (totalQuantity > 0 ? it.quantity / totalQuantity : 1 / items.length));
      break;
    }

    case 'value': {
      // تسهیم بر اساس ارزش خرید کل هر قلم (تعداد × قیمت خرید پایه)
      const itemValues = items.map((it) => it.quantity * it.originalUnitCost);
      const totalValue = itemValues.reduce((sum, v) => sum + v, 0);
      formulaDescription = `تسهیم تناسبی بر اساس ارزش ریالی اقلام (مجموع ارزش: ${totalValue.toLocaleString('fa-IR')} تومان)`;
      weights = itemValues.map((v) => (totalValue > 0 ? v / totalValue : 1 / items.length));
      break;
    }

    case 'weight': {
      // تسهیم بر اساس وزن فیزیکی (تعداد × وزن واحد)
      const itemWeights = items.map((it) => it.quantity * (it.weightPerUnit && it.weightPerUnit > 0 ? it.weightPerUnit : 1));
      const totalWeight = itemWeights.reduce((sum, w) => sum + w, 0);
      formulaDescription = `تسهیم بر اساس وزن کل بار (${roundPrecision(totalWeight, 3).toLocaleString('fa-IR')} کیلوگرم)`;
      weights = itemWeights.map((w) => (totalWeight > 0 ? w / totalWeight : 1 / items.length));
      break;
    }

    case 'length': {
      // تسهیم بر اساس متراژ/طول کل (تعداد × طول واحد)
      const itemLengths = items.map((it) => it.quantity * (it.lengthPerUnit && it.lengthPerUnit > 0 ? it.lengthPerUnit : 1));
      const totalLength = itemLengths.reduce((sum, l) => sum + l, 0);
      formulaDescription = `تسهیم بر اساس متراژ کل (${roundPrecision(totalLength, 2).toLocaleString('fa-IR')} متر)`;
      weights = itemLengths.map((l) => (totalLength > 0 ? l / totalLength : 1 / items.length));
      break;
    }

    case 'manual':
    default: {
      formulaDescription = `تسهیم مساوی بین ${items.length} قلم کالا`;
      weights = items.map(() => 1 / items.length);
      break;
    }
  }

  // محاسبه سهم ریالی با حفظ دقت اتمیک و تصحیح اختلاف گردکردن (Penny Balancing)
  let allocatedSum = 0;
  const rawShares = weights.map((w) => Math.round(w * totalAmount));
  allocatedSum = rawShares.reduce((s, a) => s + a, 0);

  const roundingDifference = totalAmount - allocatedSum;
  // اعمال اختلاف ریالی گردکردن به اولین و بیشترین سهم جهت تطابق ۱۰۰٪ ریاضی با کل مبلغ
  if (roundingDifference !== 0 && rawShares.length > 0) {
    let maxIdx = 0;
    for (let i = 1; i < rawShares.length; i++) {
      if (rawShares[i] > rawShares[maxIdx]) maxIdx = i;
    }
    rawShares[maxIdx] += roundingDifference;
  }

  const allocatedItems: AllocatedProductItem[] = items.map((item, idx) => {
    const allocatedShare = rawShares[idx];
    const qty = item.quantity > 0 ? item.quantity : 1;
    const allocatedPerUnit = Math.round(allocatedShare / qty);
    const newUnitCost = item.originalUnitCost + allocatedPerUnit;

    return {
      productId: item.productId,
      productCode: item.productCode,
      productName: item.productName,
      quantity: item.quantity,
      unitName: item.unitName,
      originalUnitCost: item.originalUnitCost,
      allocatedShare,
      allocatedPerUnit,
      newUnitCost,
      weight: item.weightPerUnit,
      length: item.lengthPerUnit,
    };
  });

  return {
    allocatedItems,
    totalAllocated: totalAmount,
    roundingDifference,
    formulaDescription,
  };
}

/**
 * رند کردن با دقت اعشار دلخواه
 */
export function roundPrecision(value: number, decimals: number = 2): number {
  const multiplier = Math.pow(10, decimals);
  return Math.round((value + Number.EPSILON) * multiplier) / multiplier;
}
