/**
 * Конвертирует PNG в ICO формат с несколькими размерами
 * и генерирует PNG иконки всех необходимых размеров
 */
const fs = require('fs');
const path = require('path');

// Новый лого SmartPOS Pro (квадратный)
const pngSrc = path.join(__dirname, '..', '..', '.gemini', 'antigravity', 'brain',
    '6c7aead3-037e-4607-8f9e-2991a80a6671', 'smartpos_square_icon_1772357088573.png');

// Пути назначения
const buildDir = path.join(__dirname, 'client-accounting', 'build');
const iconsDir = path.join(buildDir, 'icons');

const destIco1 = path.join(buildDir, 'icon.ico');
const destIco2 = path.join(iconsDir, 'icon.ico');
const destPng1 = path.join(buildDir, 'icon.png');
const destPng2 = path.join(iconsDir, 'icon.png');

// Размеры для PNG иконок
const pngSizes = [16, 24, 32, 48, 64, 128, 256, 512, 1024];
// Размеры для ICO
const icoSizes = [256, 128, 64, 48, 32, 16];

async function convertPngToIco() {
    console.log('=== SmartPOS Pro Icon Converter ===');
    console.log(`Source: ${pngSrc}`);

    if (!fs.existsSync(pngSrc)) {
        console.error(`ERROR: Source file not found: ${pngSrc}`);
        process.exit(1);
    }

    // Создаём директории если не существуют
    if (!fs.existsSync(iconsDir)) {
        fs.mkdirSync(iconsDir, { recursive: true });
    }

    try {
        const sharp = require(path.join(__dirname, 'node_modules', 'sharp'));
        console.log('Using sharp for conversion...');

        // Генерируем PNG файлы разных размеров
        for (const sz of pngSizes) {
            const pngPath = path.join(iconsDir, `${sz}x${sz}.png`);
            await sharp(pngSrc).resize(sz, sz).png().toFile(pngPath);
            console.log(`  PNG: ${sz}x${sz}.png`);
        }

        // Копируем 256x256 как icon.png
        await sharp(pngSrc).resize(256, 256).png().toFile(destPng1);
        await sharp(pngSrc).resize(256, 256).png().toFile(destPng2);
        console.log('  Copied icon.png');

        // Копируем 256x256 как icon_256.png и icon_resized.png
        await sharp(pngSrc).resize(256, 256).png().toFile(path.join(buildDir, 'icon_256.png'));
        await sharp(pngSrc).resize(256, 256).png().toFile(path.join(buildDir, 'icon_resized.png'));

        // Генерируем ICO
        const pngBuffers = await Promise.all(
            icoSizes.map(sz => sharp(pngSrc).resize(sz, sz).png().toBuffer())
        );

        writeIco(pngBuffers, icoSizes, destIco1);
        writeIco(pngBuffers, icoSizes, destIco2);

        console.log('\n=== Done! All icons generated ===');
        return;
    } catch (e) {
        console.log('sharp not available:', e.message);
    }

    // Fallback: ICO с одним PNG размером
    console.log('Fallback: Writing simple ICO with embedded PNG...');
    const pngData = fs.readFileSync(pngSrc);
    const sizes = [256];
    writeIco([pngData], sizes, destIco1);
    writeIco([pngData], sizes, destIco2);

    // Копируем PNG
    fs.copyFileSync(pngSrc, destPng1);
    fs.copyFileSync(pngSrc, destPng2);
    console.log('Done with single-size ICO!');
}

/**
 * Создаёт ICO файл из массива PNG буферов
 */
function writeIco(pngBuffers, sizes, outputPath) {
    const count = pngBuffers.length;
    const headerSize = 6;
    const dirEntrySize = 16;
    const dirSize = headerSize + count * dirEntrySize;

    const offsets = [];
    let offset = dirSize;
    for (const buf of pngBuffers) {
        offsets.push(offset);
        offset += buf.length;
    }

    const totalSize = offset;
    const ico = Buffer.alloc(totalSize);

    // ICO Header
    ico.writeUInt16LE(0, 0);      // reserved
    ico.writeUInt16LE(1, 2);      // type: ICO
    ico.writeUInt16LE(count, 4);  // count

    // Directory entries
    for (let i = 0; i < count; i++) {
        const sz = sizes[i];
        const base = 6 + i * 16;
        ico.writeUInt8(sz === 256 ? 0 : sz, base);      // width
        ico.writeUInt8(sz === 256 ? 0 : sz, base + 1);  // height
        ico.writeUInt8(0, base + 2);   // color count
        ico.writeUInt8(0, base + 3);   // reserved
        ico.writeUInt16LE(1, base + 4); // color planes
        ico.writeUInt16LE(32, base + 6); // bit depth
        ico.writeUInt32LE(pngBuffers[i].length, base + 8); // size
        ico.writeUInt32LE(offsets[i], base + 12); // offset
    }

    // PNG data
    let pos = dirSize;
    for (const buf of pngBuffers) {
        buf.copy(ico, pos);
        pos += buf.length;
    }

    fs.writeFileSync(outputPath, ico);
    console.log(`  ICO: ${outputPath} (${Math.round(totalSize / 1024)}KB)`);
}

convertPngToIco().catch(console.error);
