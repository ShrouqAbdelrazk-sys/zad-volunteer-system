# استخدم نسخة نود مستقرة
FROM node:18-slim

# إنشاء مجلد العمل
WORKDIR /app

# نسخ ملف package.json فقط أولاً
COPY package.json ./

# تسطيب المكتبات (هنا مش هيعترض على الـ lock)
RUN npm install

# نسخ باقي ملفات المشروع
COPY . .

# تحديد المنفذ (Port)
EXPOSE 3000

# أمر تشغيل السيرفر
CMD ["node", "server.js"]
