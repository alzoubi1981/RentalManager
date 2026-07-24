Rental Manager V9.1
=================

نسخة نظيفة للمستودع الجديد RentalManager.

الميزات الأساسية:
- حفظ الغرف محليًا ومزامنتها مع Firestore.
- عرض الغرف المؤجرة فقط.
- تاريخ بداية ونهاية العقد.
- حذف الغرفة وأرشفتها مع بيانات المستأجر والدفعات.
- تذكيرات مخصصة وتنبيهات الإيجار والعقود.
- GitHub Action لإرسال التنبيهات إلى Telegram.
- PWA ودعم العمل دون اتصال.

مهم عند الرفع:
ارفع الملفات داخل هذا المجلد إلى جذر مستودع RentalManager، وتأكد أن المسار التالي موجود كما هو:
.github/workflows/telegram-reminders.yml

بعد الرفع فعّل GitHub Pages من Settings > Pages > Deploy from a branch > main / root.
