import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

// Input: the user's logo
const inputPath = process.argv[2];
const outputIco = process.argv[3] || 'build/icon.ico';
const outputPng = 'build/icon.png';

if (!inputPath) {
    console.error('Usage: node convert-icon.js <input.png> [output.ico]');
    process.exit(1);
}

// ICO file format helper
function createIco(pngBuffers) {
    // ICO header: 6 bytes
    const header = Buffer.alloc(6);
    header.writeUInt16LE(0, 0); // Reserved
    header.writeUInt16LE(1, 2); // Type: ICO
    header.writeUInt16LE(pngBuffers.length, 4); // Number of images

    // Directory entries: 16 bytes each
    const dirEntries = [];
    let offset = 6 + (16 * pngBuffers.length);

    for (const { buffer, size } of pngBuffers) {
        const entry = Buffer.alloc(16);
        entry.writeUInt8(size >= 256 ? 0 : size, 0); // Width (0 = 256)
        entry.writeUInt8(size >= 256 ? 0 : size, 1); // Height
        entry.writeUInt8(0, 2);  // Color palette
        entry.writeUInt8(0, 3);  // Reserved
        entry.writeUInt16LE(1, 4);  // Color planes
        entry.writeUInt16LE(32, 6); // Bits per pixel
        entry.writeUInt32LE(buffer.length, 8); // Size of data
        entry.writeUInt32LE(offset, 12); // Offset
        dirEntries.push(entry);
        offset += buffer.length;
    }

    return Buffer.concat([header, ...dirEntries, ...pngBuffers.map(p => p.buffer)]);
}

async function main() {
    console.log(`📦 Конвертация ${inputPath} → ICO...`);

    const sizes = [16, 24, 32, 48, 64, 128, 256];
    const pngBuffers = [];

    for (const size of sizes) {
        const buffer = await sharp(inputPath)
            .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
            .png()
            .toBuffer();
        pngBuffers.push({ buffer, size });
        console.log(`  ✓ ${size}x${size}`);
    }

    // Save 256x256 PNG separately (for electron-builder)
    await sharp(inputPath)
        .resize(256, 256, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .png()
        .toFile(outputPng);
    console.log(`  ✓ ${outputPng}`);

    // Create ICO
    const ico = createIco(pngBuffers);
    fs.writeFileSync(outputIco, ico);
    console.log(`\n✅ Иконка сохранена: ${outputIco} (${Math.round(ico.length / 1024)} KB)`);
}

main().catch(e => { console.error('❌', e.message); process.exit(1); });
