const fs = require('fs');
const path = require('path');

const artifactDir = 'C:\\Users\\user\\.gemini\\antigravity\\brain\\7a5de254-5a29-4d45-b57f-25e0e38a15c4';

// SmartPOS Pro logo (desktop client)
const desktopPng = path.join(artifactDir, 'media__1772163643566.png');
// SmartPOS Pro Admin logo (admin panel) 
const adminPng = path.join(artifactDir, 'media__1772163643598.png');

// Simple PNG to ICO conversion (creates a valid ICO file with embedded PNG)
function pngToIco(pngPath) {
    const pngData = fs.readFileSync(pngPath);

    // ICO header (6 bytes)
    const header = Buffer.alloc(6);
    header.writeUInt16LE(0, 0); // Reserved
    header.writeUInt16LE(1, 2); // Type (1 = ICO)
    header.writeUInt16LE(1, 4); // Number of images

    // ICO directory entry (16 bytes)
    const entry = Buffer.alloc(16);
    entry.writeUInt8(0, 0);    // Width (0 = 256)
    entry.writeUInt8(0, 1);    // Height (0 = 256)
    entry.writeUInt8(0, 2);    // Color palette
    entry.writeUInt8(0, 3);    // Reserved
    entry.writeUInt16LE(1, 4); // Color planes
    entry.writeUInt16LE(32, 6); // Bits per pixel
    entry.writeUInt32LE(pngData.length, 8); // Image data size
    entry.writeUInt32LE(22, 12); // Offset to image data (6 + 16 = 22)

    return Buffer.concat([header, entry, pngData]);
}

// Copy and convert desktop logo
const desktopLocations = [
    'C:\\Users\\user\\Desktop\\1С бухгалтерия\\client-accounting\\build\\icon.ico',
    'C:\\Users\\user\\Desktop\\1С бухгалтерия\\client-accounting\\build\\icons\\icon.ico',
];
const desktopPngLocations = [
    'C:\\Users\\user\\Desktop\\1С бухгалтерия\\client-accounting\\build\\icon.png',
    'C:\\Users\\user\\Desktop\\1С бухгалтерия\\client-accounting\\build\\icons\\icon.png',
    'C:\\Users\\user\\Desktop\\1С бухгалтерия\\client-accounting\\public\\smartpos-logo.png',
];

// Copy and convert admin logo
const adminLocations = [
    'C:\\Users\\user\\Desktop\\1С бухгалтерия\\admin-panel\\build\\icon.ico',
    'C:\\Users\\user\\Desktop\\1С бухгалтерия\\admin-panel\\build\\icons\\icon.ico',
];
const adminPngLocations = [
    'C:\\Users\\user\\Desktop\\1С бухгалтерия\\admin-panel\\build\\icon.png',
    'C:\\Users\\user\\Desktop\\1С бухгалтерия\\admin-panel\\build\\icons\\icon.png',
];

try {
    const desktopIco = pngToIco(desktopPng);
    desktopLocations.forEach(loc => {
        fs.writeFileSync(loc, desktopIco);
        console.log('Written ICO:', loc, desktopIco.length, 'bytes');
    });
    desktopPngLocations.forEach(loc => {
        fs.copyFileSync(desktopPng, loc);
        console.log('Copied PNG:', loc);
    });
} catch (e) {
    console.error('Desktop error:', e.message);
}

try {
    const adminIco = pngToIco(adminPng);
    adminLocations.forEach(loc => {
        fs.writeFileSync(loc, adminIco);
        console.log('Written ICO:', loc, adminIco.length, 'bytes');
    });
    adminPngLocations.forEach(loc => {
        fs.copyFileSync(adminPng, loc);
        console.log('Copied PNG:', loc);
    });
} catch (e) {
    console.error('Admin error:', e.message);
}

console.log('Done!');
