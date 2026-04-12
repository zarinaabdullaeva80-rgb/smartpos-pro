# PDF Generation Setup (Optional - Production)

## Вариант 1: Puppeteer (Рекомендуется)

### Установка
```bash
npm install puppeteer
```

### Использование
В файле `server/src/routes/documents.js` раскомментируйте код с puppeteer.

### Пример
```javascript
const puppeteer = require('puppeteer');

const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
});
const page = await browser.newPage();
await page.setContent(html, { waitUntil: 'networkidle0' });
const pdf = await page.pdf({
    format: 'A4',
    printBackground: true,
    margin: {
        top: '20mm',
        right: '10mm',
        bottom: '20mm',
        left: '10mm'
    }
});
await browser.close();

res.contentType('application/pdf');
res.setHeader('Content-Disposition', `attachment; filename="TORG-12_${documentNumber}.pdf"`);
res.send(pdf);
```

---

## Вариант 2: wkhtmltopdf (Легковесный)

### Установка
1. Скачать: https://wkhtmltopdf.org/downloads.html
2. Установить в систему
3. `npm install wkhtmltopdf`

### Использование
```javascript
const wkhtmltopdf = require('wkhtmltopdf');

wkhtmltopdf(html, {
    pageSize: 'A4',
    marginTop: '20mm',
    marginBottom: '20mm'
}).pipe(res);
```

---

## Вариант 3: PDFKit (Node.js native)

### Установка
```bash
npm install pdfkit
```

### Использование
```javascript
const PDFDocument = require('pdfkit');
const doc = new PDFDocument();

doc.pipe(res);
doc.fontSize(20).text('ТОРГ-12', 100, 50);
doc.fontSize(12).text('Номер: ' + documentNumber, 100, 80);
// ... добавить остальной контент
doc.end();
```

---

## Текущее состояние

В данный момент `/api/documents/generate-torg12/:saleId` возвращает **HTML**.

Для production нужно:
1. Выбрать один из вариантов выше
2. Установить зависимости
3. Раскомментировать/добавить код генерации PDF
4. Настроить сохранение файлов в `uploads/documents/`

---

## Тестирование

```bash
# Демо (возвращает HTML)
GET /api/documents/generate-torg12/1

# После настройки (вернёт PDF)
GET /api/documents/generate-torg12/1
```

---

## В production

- Использовать очередь (Bull/BullMQ) для генерации больших документов
- Кэшировать PDF (Redis)
- Хранить в S3/MinIO вместо локальных файлов
