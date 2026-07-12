const fs = require('fs');
const path = require('path');

const buildGradlePath = path.join(process.cwd(), 'android', 'app', 'build.gradle');

if (!fs.existsSync(buildGradlePath)) {
  console.error(`[ERROR] File build.gradle not found at: ${buildGradlePath}`);
  process.exit(1);
}

let content = fs.readFileSync(buildGradlePath, 'utf8');

// Проверяем, есть ли уже блок release в signingConfigs
const hasReleaseConfig = /release\s*\{[^\}]*storeFile/g.test(content);

if (!hasReleaseConfig) {
  // Находим блок signingConfigs { и вставляем туда release
  const signingConfigsRegex = /(signingConfigs\s*\{)/g;
  const releaseSigningConfig = `$1\n        release {\n            storeFile file(MYAPP_UPLOAD_STORE_FILE)\n            storePassword MYAPP_UPLOAD_STORE_PASSWORD\n            keyAlias MYAPP_UPLOAD_KEY_ALIAS\n            keyPassword MYAPP_UPLOAD_KEY_PASSWORD\n        }`;
  
  content = content.replace(signingConfigsRegex, releaseSigningConfig);
  console.log('Injected release signing config into signingConfigs');
} else {
  console.log('Release signing config is already present');
}

// Убеждаемся, что в buildTypes { release { ... } } используется release подпись
const releaseBuildTypeRegex = /(release\s*\{\s*[^}]*signingConfig\s+signingConfigs\.)debug/g;
if (releaseBuildTypeRegex.test(content)) {
  content = content.replace(releaseBuildTypeRegex, '$1release');
  console.log('Switched release signingConfig from debug to release');
} else {
  // На всякий случай делаем прямую замену
  content = content.replace(/signingConfig\s+signingConfigs\.debug/g, 'signingConfig signingConfigs.release');
  console.log('Applied fallback signingConfig replace to release');
}

fs.writeFileSync(buildGradlePath, content, 'utf8');
console.log('build.gradle successfully updated (without BOM) ✅');
