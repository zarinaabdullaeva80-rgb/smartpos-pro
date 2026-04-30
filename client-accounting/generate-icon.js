import pngToIco from 'png-to-ico';
import fs from 'fs';
import path from 'path';

const pngPath = 'public/icons/icon-512x512.png';
const icoPath = 'build/icon.ico';

async function generate() {
  console.log('Generating ico from', pngPath);
  try {
    const buf = await pngToIco(pngPath);
    fs.writeFileSync(icoPath, buf);
    console.log('Success! Saved to', icoPath);
  } catch (e) {
    console.error('Error:', e.message);
  }
}

generate();
