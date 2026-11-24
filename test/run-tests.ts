import { runAllCalculationTests } from '../src/lib/calculations.test.ts';
import { serverDb } from '../src/server/db.ts';

console.log('====================================================');
console.log('🧪 ۱. اجرای آزمون‌های واحد (Unit Tests - 66 Scenarios)');
console.log('====================================================\n');

const results = runAllCalculationTests();

let passedCount = 0;
let failedCount = 0;

results.forEach((r, idx) => {
  const status = r.passed ? '✅ PASS' : '❌ FAIL';
  console.log(`${idx + 1}. [${r.suite}] ${r.name} -> ${status} (${r.durationMs}ms)`);
  if (!r.passed) {
    console.log(`   ❌ انتظار:`, r.expected);
    console.log(`   ❌ خروجی واقعی:`, r.actual);
    if (r.message) console.log(`   پیام: ${r.message}`);
    failedCount++;
  } else {
    passedCount++;
  }
});

console.log('\n====================================================');
console.log('⚖️ ۲. ممیزی ۵گانه مغایرت‌ها (موجودی، اشخاص، صندوق، بانک، دفتر کل)');
console.log('====================================================');
const reconciliation = serverDb.runMasterReconciliationAudit();
console.log(`- تطابق موجودی کالا و کاردکس: ${reconciliation.inventory.isReconciled ? '✅ منطبق' : '❌ مغایرت'}`);
console.log(`- تطابق مانده اشخاص با دفتر تفصیلی: ${reconciliation.persons.isReconciled ? '✅ منطبق' : '❌ مغایرت'}`);
console.log(`- تطابق صندوق‌های نقدی با دفتر کل: ${reconciliation.cash.isReconciled ? '✅ منطبق' : '❌ مغایرت'}`);
console.log(`- تطابق حساب‌های بانکی و کارتخوان: ${reconciliation.bank.isReconciled ? '✅ منطبق' : '❌ مغایرت'}`);
console.log(`- توازن دفتر کل و تراز آزمایشی: ${reconciliation.generalLedger.isReconciled ? '✅ منطبق' : '❌ مغایرت'}`);
console.log(`- مجموع مغایرت‌ها: ${reconciliation.summary.totalDiscrepancies}`);

if (reconciliation.allReconciled) {
  passedCount++;
} else {
  failedCount++;
  console.error('❌ جزئیات مغایرت:', JSON.stringify(reconciliation, null, 2));
}

console.log('\n====================================================');
console.log('💾 ۳. آزمون عملیاتی پشتیبان‌گیری و بازیابی واقعی پایگاه داده (SHA-256)');
console.log('====================================================');
const adminUser = serverDb.users[0];
const backupTest = serverDb.testRealBackupAndRestoreCycle(adminUser);
backupTest.steps.forEach((st) => {
  console.log(`- گام ${st.step}: ${st.title} -> ${st.passed ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`  جزئیات: ${st.detail}`);
});
if (backupTest.passed) {
  passedCount++;
} else {
  failedCount++;
}

console.log('\n====================================================');
console.log('🔗 ۴. آزمون‌های یکپارچه ۸ سناریوی عملیاتی (End-to-End Integration Suite)');
console.log('====================================================');
const integrationSuite = serverDb.runFullSystemIntegrationSuite(adminUser);
integrationSuite.scenarios.forEach((sc) => {
  console.log(`${sc.stepNumber}. ${sc.title} -> ${sc.passed ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`   انتظار: ${sc.expected}`);
  console.log(`   واقعی:  ${sc.actual}`);
  if (sc.passed) {
    passedCount++;
  } else {
    failedCount++;
  }
});

console.log('\n====================================================');
console.log('🛡️ ۵. آزمون اتمیک بودن تراکنش و Rollback خودکار (ACID Invariant)');
console.log('====================================================');
const initialUsersCount = serverDb.users.length;
let acidPassed = false;
try {
  serverDb.simulateFailedTransaction();
} catch (err: any) {
  const afterCount = serverDb.users.length;
  acidPassed = initialUsersCount === afterCount;
  console.log(`- آزمایش رول‌بک تراکنش سند نامتوازن: ${acidPassed ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`  خطای مهارشده: ${err.message} | رکوردهای قبل: ${initialUsersCount}، بعد از رول‌بک: ${afterCount}`);
}
if (acidPassed) {
  passedCount++;
} else {
  failedCount++;
}

console.log('\n====================================================');
console.log(`📊 نتیجه نهایی کل سامانه: ${passedCount} آزمون موفق | ${failedCount} خطا`);
console.log('====================================================');

if (failedCount > 0) {
  process.exit(1);
} else {
  console.log('🎉 تمامی آزمون‌های واحد، یکپارچه، تطابق ۵گانه و پشتیبان‌گیری ۱۰۰٪ پاس شدند!\n');
  process.exit(0);
}
