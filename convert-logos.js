/**
 * Converts the SmartPOS landscape logo PNGs to square ICO + PNG icons.
 * Extracts the left-center area (POS terminal icon) from each landscape banner.
 * Uses sharp for cropping/resizing.
 * Run: node convert-logos.js
 */

const path = require('path');
const fs = require('fs');
const sharp = require('sharp');

const BRAIN_DIR = path.join(
    process.env.USERPROFILE || process.env.HOME,
    '.gemini', 'antigravity', 'brain', '7a5de254-5a29-4d45-b57f-25e0e38a15c4'
);

// User-provided landscape logos
const PRO_SRC = path.join(BRAIN_DIR, 'media__1771639055849.png');    // SmartPOS PRO
const ADMIN_SRC = path.join(BRAIN_DIR, 'media__1771639055948.png');  // SmartPOS PRO ADMIN

const ADMIN_BUILD = path.join(__dirname, 'client-admin', 'build');
const PRO_BUILD = path.join(__dirname, 'client-accounting', 'build');

// ICO sizes required by Windows
const ICO_SIZES = [16, 24, 32, 48, 64, 128, 256];

async function resizePng(buffer, size) {
    return sharp(buffer)
        .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .png()
        .toBuffer();
}

async function extractIcon(srcPath) {
    // Get image metadata
    const metadata = await sharp(srcPath).metadata();
    const { width, height } = metadata;
    console.log(`  Source: ${width}x${height}`);

    // The POS terminal icon is in the left-center area of the landscape banner
    // Extract a square region from the left side, centered vertically
    const squareSize = Math.min(width, height);
    const extractSize = Math.floor(squareSize * 0.85); // Use 85% of height
    const left = Math.floor(width * 0.08);  // Start 8% from left
    const top = Math.floor((height - extractSize) / 2);

    console.log(`  Extracting: left=${left}, top=${top}, size=${extractSize}x${extractSize}`);

    return sharp(srcPath)
        .extract({ left, top, width: extractSize, height: extractSize })
        .resize(512, 512, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .png()
        .toBuffer();
}

async function buildIco(iconBuffer, destDir, name) {
    // Ensure dest dir exists
    fs.mkdirSync(destDir, { recursive: true });

    // Save PNG at 256x256 for the .png file
    const pngPath = path.join(destDir, `${name}.png`);
    await sharp(iconBuffer)
        .resize(256, 256, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .png()
        .toFile(pngPath);
    console.log(`  ✅ Saved PNG: ${pngPath}`);

    // Save multiple sizes for icons/ folder
    const iconsDir = path.join(destDir, 'icons');
    fs.mkdirSync(iconsDir, { recursive: true });
    const allSizes = [16, 24, 32, 48, 64, 128, 256, 512, 1024];
    for (const size of allSizes) {
        const sizePath = path.join(iconsDir, `${size}x${size}.png`);
        await sharp(iconBuffer)
            .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
            .png()
            .toFile(sizePath);
    }
    console.log(`  ✅ Saved icon sizes to: ${iconsDir}`);

    // Build ICO manually: header + PNG entries per size
    const icoPath = path.join(destDir, `${name}.ico`);

    const pngBuffers = await Promise.all(
        ICO_SIZES.map(size => resizePng(iconBuffer, size))
    );

    // ICO format: ICONDIR (6 bytes) + ICONDIRENTRY per image (16 bytes each) + image data
    const HEADER_SIZE = 6;
    const ENTRY_SIZE = 16;
    const dataOffset = HEADER_SIZE + ENTRY_SIZE * pngBuffers.length;

    const header = Buffer.alloc(HEADER_SIZE);
    header.writeUInt16LE(0, 0);               // Reserved
    header.writeUInt16LE(1, 2);               // Type: 1 = ICO
    header.writeUInt16LE(pngBuffers.length, 4); // Count

    const entries = [];
    let currentOffset = dataOffset;
    for (let i = 0; i < pngBuffers.length; i++) {
        const size = ICO_SIZES[i];
        const displaySize = size >= 256 ? 0 : size;
        const entry = Buffer.alloc(ENTRY_SIZE);
        entry.writeUInt8(displaySize, 0);
        entry.writeUInt8(displaySize, 1);
        entry.writeUInt8(0, 2);
        entry.writeUInt8(0, 3);
        entry.writeUInt16LE(1, 4);
        entry.writeUInt16LE(32, 6);
        entry.writeUInt32LE(pngBuffers[i].length, 8);
        entry.writeUInt32LE(currentOffset, 12);
        entries.push(entry);
        currentOffset += pngBuffers[i].length;
    }

    const icoBuffer = Buffer.concat([header, ...entries, ...pngBuffers]);
    fs.writeFileSync(icoPath, icoBuffer);
    console.log(`  ✅ Saved ICO: ${icoPath} (${(icoBuffer.length / 1024).toFixed(0)} KB)`);

    // Also save ICO in icons/ folder
    fs.copyFileSync(icoPath, path.join(iconsDir, 'icon.ico'));
}

async function main() {
    console.log('🚀 Converting SmartPOS logos to ICO...\n');

    if (!fs.existsSync(PRO_SRC)) {
        console.error(`❌ Pro logo not found: ${PRO_SRC}`);
        process.exit(1);
    }
    if (!fs.existsSync(ADMIN_SRC)) {
        console.error(`❌ Admin logo not found: ${ADMIN_SRC}`);
        process.exit(1);
    }

    console.log('📦 SmartPOS PRO (client-accounting):');
    const proIcon = await extractIcon(PRO_SRC);
    await buildIco(proIcon, PRO_BUILD, 'icon');

    // Also save full-size logo for web UI
    const proLogoPath = path.join(__dirname, 'client-accounting', 'public', 'smartpos-logo.png');
    fs.mkdirSync(path.dirname(proLogoPath), { recursive: true });
    fs.copyFileSync(PRO_SRC, proLogoPath);
    console.log(`  ✅ Full logo → ${proLogoPath}`);

    console.log('\n📦 SmartPOS PRO ADMIN (client-admin):');
    const adminIcon = await extractIcon(ADMIN_SRC);
    await buildIco(adminIcon, ADMIN_BUILD, 'icon');

    // Also save full logo for admin web UI
    const adminLogoPath = path.join(__dirname, 'client-admin', 'public', 'smartpos-logo.png');
    fs.mkdirSync(path.dirname(adminLogoPath), { recursive: true });
    fs.copyFileSync(ADMIN_SRC, adminLogoPath);
    console.log(`  ✅ Full logo → ${adminLogoPath}`);

    console.log('\n✨ All logos converted and saved!');
    console.log('   Pro:   client-accounting/build/icon.ico + icon.png');
    console.log('   Admin: client-admin/build/icon.ico + icon.png');
}

main().catch(err => {
    console.error('❌ Error:', err.message);
    process.exit(1);
});
