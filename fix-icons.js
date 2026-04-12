const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

// Build ICO from PNG buffer - proper ICO format with multiple sizes
function buildIcoBuffer(pngBuffers) {
    const numImages = pngBuffers.length;
    const headerSize = 6;
    const dirEntrySize = 16;
    const dirSize = dirEntrySize * numImages;

    let dataOffset = headerSize + dirSize;
    const entries = [];

    for (const buf of pngBuffers) {
        entries.push({ buffer: buf, offset: dataOffset });
        dataOffset += buf.length;
    }

    const totalSize = dataOffset;
    const ico = Buffer.alloc(totalSize);

    // ICO header
    ico.writeUInt16LE(0, 0);     // reserved
    ico.writeUInt16LE(1, 2);     // type (1 = ICO)
    ico.writeUInt16LE(numImages, 4); // count

    // Directory entries
    const sizes = [16, 24, 32, 48, 64, 128, 256];
    for (let i = 0; i < numImages; i++) {
        const off = headerSize + (i * dirEntrySize);
        const size = sizes[i] || 256;
        ico.writeUInt8(size >= 256 ? 0 : size, off);     // width (0 = 256)
        ico.writeUInt8(size >= 256 ? 0 : size, off + 1); // height
        ico.writeUInt8(0, off + 2);   // color palette
        ico.writeUInt8(0, off + 3);   // reserved
        ico.writeUInt16LE(1, off + 4);  // color planes
        ico.writeUInt16LE(32, off + 6); // bits per pixel
        ico.writeUInt32LE(entries[i].buffer.length, off + 8);  // size
        ico.writeUInt32LE(entries[i].offset, off + 12);  // offset
    }

    // Image data
    for (const entry of entries) {
        entry.buffer.copy(ico, entry.offset);
    }

    return ico;
}

async function createIco(pngPath, destDir) {
    console.log(`  Source: ${pngPath}`);
    const pngBuffer = fs.readFileSync(pngPath);

    const sizes = [16, 24, 32, 48, 64, 128, 256];
    const pngBuffers = [];

    for (const size of sizes) {
        const resized = await sharp(pngBuffer)
            .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
            .png()
            .toBuffer();
        pngBuffers.push(resized);
    }

    const icoBuffer = buildIcoBuffer(pngBuffers);
    const icoPath = path.join(destDir, 'icon.ico');
    fs.writeFileSync(icoPath, icoBuffer);
    console.log(`  ✅ ICO: ${icoPath} (${icoBuffer.length} bytes, ${sizes.length} sizes)`);

    // Verify
    const verify = fs.readFileSync(icoPath);
    console.log(`  Verify: header=${verify[0]},${verify[1]},${verify[2]},${verify[3]} images=${verify.readUInt16LE(4)}`);
}

async function main() {
    console.log('📦 SmartPOS ADMIN:');
    await createIco(
        path.join(__dirname, 'client-admin', 'build', 'icon.png'),
        path.join(__dirname, 'client-admin', 'build')
    );

    console.log('\n📦 SmartPOS PRO:');
    await createIco(
        path.join(__dirname, 'client-accounting', 'build', 'icon.png'),
        path.join(__dirname, 'client-accounting', 'build')
    );

    console.log('\n✨ ICO files regenerated!');
}

main().catch(console.error);
