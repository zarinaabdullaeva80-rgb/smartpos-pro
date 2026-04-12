/**
 * Jest Configuration для Mobile POS
 */

module.exports = {
    preset: 'jest-expo',
    transformIgnorePatterns: [
        'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg)'
    ],
    setupFilesAfterEnv: ['@testing-library/jest-native/extend-expect'],
    testMatch: ['**/__tests__/**/*.test.js'],
    collectCoverageFrom: [
        'src/**/*.{js,jsx}',
        '!src/**/*.test.{js,jsx}',
        '!**/node_modules/**'
    ],
    moduleFileExtensions: ['js', 'jsx', 'json', 'node'],
    testEnvironment: 'jsdom',
    globals: {
        __DEV__: true
    }
};
