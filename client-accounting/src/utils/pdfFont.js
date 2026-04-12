// PDF Font Configuration for Cyrillic Support
// This file will contain the base64-encoded font for use in jsPDF

export const addCyrillicFont = (doc) => {
    // Using built-in courier font which has better Cyrillic support
    // For full support, we would need to embed a custom font
    try {
        doc.setFont('courier');
        doc.setLanguage('ru-RU');
    } catch (error) {
        console.warn('Could not set Cyrillic font, using default');
    }
};

// Alternative: Use the roboto font we installed
// We'll need to generate the font file separately using jsPDF font converter
// For now, this is a placeholder that uses courier as fallback
