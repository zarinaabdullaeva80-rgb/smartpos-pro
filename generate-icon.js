import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const srcPng = path.join(__dirname, 'client-accounting/build/icon.png');
const destIco = path.join(__dirname, 'client-accounting/build/icon.ico');

// Обязательные размеры для Windows ICO
const sizes = [16, 24, 32, 48, 64, 128, 256];

console.log('Generating ICO from:', srcPng);

// Генерируем PNG буферы всех размеров
const buffers = await Promise.all(
    sizes.map(size => sharp(srcPng).resize(size, size).png().toBuffer())
);

// Создаём ICO вручную (формат ICO)
function buildIco(pngBuffers) {
    const count = pngBuffers.length;
    // Header: 6 bytes
    // Directory entries: 16 bytes * count
    // Images: сами PNG данные
    const headerSize = 6 + 16 * count;
    let offset = headerSize;
    
    const entries = pngBuffers.map((buf, i) => {
        const size = sizes[i];
        const entry = { size, buf, offset };
        offset += buf.length;
        return entry;
    });
    
    const totalSize = offset;
    const ico = Buffer.alloc(totalSize);
    
    // ICO header
    ico.writeUInt16LE(0, 0);      // Reserved = 0
    ico.writeUInt16LE(1, 2);      // Type = 1 (ICO)
    ico.writeUInt16LE(count, 4);  // Count
    
    // Directory entries
    let dirOffset = 6;
    for (const entry of entries) {
        const w = entry.size >= 256 ? 0 : entry.size;
        const h = entry.size >= 256 ? 0 : entry.size;
        ico[dirOffset] = w;           // Width
        ico[dirOffset + 1] = h;       // Height
        ico[dirOffset + 2] = 0;       // Color count
        ico[dirOffset + 3] = 0;       // Reserved
        ico.writeUInt16LE(1, dirOffset + 4);     // Planes
        ico.writeUInt16LE(32, dirOffset + 6);    // Bit count
        ico.writeUInt32LE(entry.buf.length, dirOffset + 8);  // Size
        ico.writeUInt32LE(entry.offset, dirOffset + 12);     // Offset
        dirOffset += 16;
    }
    
    // Copy image data
    for (const entry of entries) {
        entry.buf.copy(ico, entry.offset);
    }
    
    return ico;
}

const icoBuffer = buildIco(buffers);
fs.writeFileSync(destIco, icoBuffer);
console.log(`✅ icon.ico создан: ${Math.round(icoBuffer.length/1024)} KB, ${sizes.length} размеров: ${sizes.join(', ')}px`);
