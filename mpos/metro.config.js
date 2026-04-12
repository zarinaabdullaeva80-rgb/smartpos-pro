const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

// Use junction path to avoid Cyrillic encoding issues during build
const PROJECT_ROOT = process.env.METRO_PROJECT_ROOT || __dirname;

const config = getDefaultConfig(PROJECT_ROOT);

// Explicitly set projectRoot and watchFolders
config.projectRoot = PROJECT_ROOT;
config.watchFolders = [PROJECT_ROOT];

// Resolver configuration
config.resolver = config.resolver || {};
config.resolver.nodeModulesPaths = [path.resolve(PROJECT_ROOT, 'node_modules')];

// Force axios to use the browser bundle (not node bundle with crypto/http)
config.resolver.resolveRequest = (context, moduleName, platform) => {
    if (moduleName === 'axios') {
        return {
            filePath: path.resolve(PROJECT_ROOT, 'node_modules/axios/dist/browser/axios.cjs'),
            type: 'sourceFile',
        };
    }
    // Fall back to default resolution
    return context.resolveRequest(context, moduleName, platform);
};

// Disable problematic node: protocol shims
config.server = config.server || {};
config.server.enableVisualizer = false;

module.exports = config;
