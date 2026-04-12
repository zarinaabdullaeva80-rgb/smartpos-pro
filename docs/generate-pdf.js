const fs = require('fs');
const path = require('path');

// Читаем markdown
const mdPath = path.join(__dirname, 'Инструкция_подключение_мобильного.md');
const content = fs.readFileSync(mdPath, 'utf-8');

// Простая конвертация MD → HTML
function mdToHtml(md) {
    let html = md;
    // Headers
    html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
    html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
    html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');
    // Bold
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    // Italic
    html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
    // Code blocks
    html = html.replace(/```[\s\S]*?\n([\s\S]*?)```/g, '<pre><code>$1</code></pre>');
    // Inline code
    html = html.replace(/`(.+?)`/g, '<code>$1</code>');
    // HR
    html = html.replace(/^---$/gm, '<hr>');
    // Blockquote
    html = html.replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>');
    // Tables
    html = html.replace(/\|(.+)\|/g, (match) => {
        const cells = match.split('|').filter(c => c.trim()).map(c => c.trim());
        if (cells.every(c => /^[-:]+$/.test(c))) return '';
        const tag = 'td';
        return '<tr>' + cells.map(c => `<${tag}>${c}</${tag}>`).join('') + '</tr>';
    });
    // Wrap consecutive tr in table
    html = html.replace(/((<tr>.*<\/tr>\s*)+)/g, '<table border="1" cellpadding="8" cellspacing="0">$1</table>');
    // First row = header
    html = html.replace(/<table([^>]*)><tr>(.*?)<\/tr>/g, (m, attrs, row) => {
        const headerRow = row.replace(/<td>/g, '<th>').replace(/<\/td>/g, '</th>');
        return `<table${attrs}><thead><tr>${headerRow}</tr></thead><tbody>`;
    });
    html = html.replace(/<\/table>/g, '</tbody></table>');
    // Paragraphs
    html = html.split('\n\n').map(block => {
        block = block.trim();
        if (!block) return '';
        if (block.startsWith('<')) return block;
        return `<p>${block.replace(/\n/g, '<br>')}</p>`;
    }).join('\n');
    return html;
}

const htmlContent = mdToHtml(content);

const fullHtml = `<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="UTF-8">
<title>Инструкция: Подключение мобильного приложения SmartPOS</title>
<style>
    @page { size: A4; margin: 25mm 20mm; }
    body { font-family: 'Segoe UI', Tahoma, Arial, sans-serif; color: #1e293b; line-height: 1.7; max-width: 800px; margin: 0 auto; padding: 20px; }
    h1 { color: #1e40af; border-bottom: 3px solid #3b82f6; padding-bottom: 8px; font-size: 22px; }
    h2 { color: #1e3a8a; margin-top: 28px; font-size: 18px; page-break-after: avoid; }
    h3 { color: #334155; margin-top: 20px; font-size: 15px; page-break-after: avoid; }
    p { margin: 8px 0; }
    code { background: #f1f5f9; padding: 2px 6px; border-radius: 4px; font-size: 12px; font-family: Consolas, monospace; }
    pre { background: #0f172a; color: #e2e8f0; padding: 16px; border-radius: 8px; font-size: 11px; overflow-x: auto; page-break-inside: avoid; }
    pre code { background: transparent; color: #e2e8f0; padding: 0; }
    table { border-collapse: collapse; width: 100%; margin: 12px 0; page-break-inside: avoid; }
    th, td { border: 1px solid #cbd5e1; padding: 8px 12px; text-align: left; font-size: 13px; }
    th { background: #f1f5f9; font-weight: 600; }
    blockquote { border-left: 4px solid #f59e0b; background: #fffbeb; padding: 12px 16px; margin: 16px 0; border-radius: 0 8px 8px 0; }
    hr { border: none; border-top: 2px solid #e2e8f0; margin: 24px 0; }
    strong { color: #0f172a; }
</style>
</head>
<body>
${htmlContent}
</body>
</html>`;

// Сохраняем HTML
const htmlPath = path.join(__dirname, 'Инструкция_подключение_мобильного.html');
fs.writeFileSync(htmlPath, fullHtml, 'utf-8');
console.log('HTML создан:', htmlPath);
console.log('Теперь конвертируем в PDF...');

// Используем puppeteer через md-to-pdf
const globalModPath = process.env.APPDATA + '\\npm\\node_modules\\md-to-pdf';
try {
    const { mdToPdf } = require(globalModPath);
    mdToPdf({ content }, {
        pdf_options: { format: 'A4', margin: { top: '25mm', bottom: '25mm', left: '20mm', right: '20mm' }, printBackground: true },
        css: `
            body { font-family: 'Segoe UI', Tahoma, Arial, sans-serif; color: #1e293b; line-height: 1.7; }
            h1 { color: #1e40af; border-bottom: 3px solid #3b82f6; padding-bottom: 8px; }
            h2 { color: #1e3a8a; margin-top: 28px; }
            h3 { color: #334155; }
            code { background: #f1f5f9; padding: 2px 6px; border-radius: 4px; font-size: 13px; }
            pre { background: #0f172a; color: #e2e8f0; padding: 16px; border-radius: 8px; font-size: 12px; }
            pre code { background: transparent; color: #e2e8f0; }
            table { border-collapse: collapse; width: 100%; margin: 12px 0; }
            th, td { border: 1px solid #cbd5e1; padding: 8px 12px; }
            th { background: #f1f5f9; }
            blockquote { border-left: 4px solid #f59e0b; background: #fffbeb; padding: 12px 16px; }
            hr { border: none; border-top: 2px solid #e2e8f0; margin: 24px 0; }
        `
    }).then(pdf => {
        const pdfPath = path.join(__dirname, 'Инструкция_подключение_мобильного.pdf');
        fs.writeFileSync(pdfPath, pdf.content);
        console.log('PDF создан:', pdfPath);
    }).catch(err => console.error('PDF ошибка:', err.message));
} catch (e) {
    console.log('md-to-pdf не найден, PDF не создан.');
    console.log('HTML файл можно открыть в браузере и напечатать как PDF (Ctrl+P)');
}
