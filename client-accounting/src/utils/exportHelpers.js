// Export Helper Utilities for folder-based file organization
// Handles creation of export folders and path management

/**
 * Get the exports base directory path
 * For Electron app, use app's userData directory
 */
export const getExportsBasePath = () => {
    // Check if running in Electron
    if (window.electron && window.electron.getPath) {
        const userDataPath = window.electron.getPath('userData');
        return `${userDataPath}/exports`;
    }
    // Fallback for development/browser
    return 'exports';
};

/**
 * Ensure export folder exists (create if necessary)
 * @param {string} folderName - Name of the subfolder (e.g., 'products', 'sales')
 */
export const ensureExportFolder = async (folderName) => {
    const basePath = getExportsBasePath();
    const fullPath = `${basePath}/${folderName}`;

    // In Electron, use IPC to create folder
    if (window.electron && window.electron.ensureFolder) {
        try {
            await window.electron.ensureFolder(fullPath);
            return fullPath;
        } catch (error) {
            console.error(`Failed to create folder ${fullPath}:`, error);
            throw error;
        }
    }

    return fullPath;
};

/**
 * Get full export file path with date timestamp
 * @param {string} configKey - Config key from exportConfig (e.g., 'products')
 * @param {string} filename - Base filename without extension
 * @param {string} extension - File extension (default: 'xlsx')
 */
export const getExportFilePath = async (configKey, filename, extension = 'xlsx') => {
    const folder = await ensureExportFolder(configKey);
    const timestamp = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const fullFilename = `${filename}_${timestamp}.${extension}`;
    return `${folder}/${fullFilename}`;
};

/**
 * Format export data according to config
 * @param {Array} data - Raw data array
 * @param {Object} config - Export configuration with columns
 */
export const formatExportData = (data, config) => {
    if (!config || !config.columns) return data;

    return data.map(row => {
        const formatted = {};
        config.columns.forEach(col => {
            let value = row[col.key];

            // Format dates
            if (col.key.includes('date') || col.key.includes('_at')) {
                if (value) {
                    value = new Date(value).toLocaleString('ru-RU');
                }
            }

            // Format boolean
            if (typeof value === 'boolean') {
                value = value ? 'Да' : 'Нет';
            }

            // Format active status
            if (col.key === 'is_active') {
                value = value ? 'Активен' : 'Отключен';
            }

            formatted[col.header] = value !== undefined && value !== null ? value : '';
        });
        return formatted;
    });
};

/**
 * Initialize all export folders on app start
 * Should be called from main Electron process
 */
export const initializeExportFolders = async () => {
    const folders = ['products', 'sales', 'zreports', 'shifts', 'dashboard'];

    for (const folder of folders) {
        try {
            await ensureExportFolder(folder);
            console.log(`Created export folder: ${folder}`);
        } catch (error) {
            console.error(`Failed to create folder ${folder}:`, error);
        }
    }
};
