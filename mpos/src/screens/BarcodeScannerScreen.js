import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Alert, Platform, TextInput as RNTextInput } from 'react-native';
import { Button, Title, Paragraph, IconButton, TextInput } from 'react-native-paper';
import { useTheme } from '../context/ThemeContext';
import SoundManager from '../services/sounds';

// Camera only available on native
let Camera = null;
let CameraView = null;
if (Platform.OS !== 'web') {
    const cameraModule = require('expo-camera');
    Camera = cameraModule.Camera;
    CameraView = cameraModule.CameraView;
}

export default function BarcodeScannerScreen({ route, navigation }) {
    const { colors } = useTheme();
    const { onScan } = route.params || {};

    const [hasPermission, setHasPermission] = useState(Platform.OS === 'web' ? true : null);
    const [scanned, setScanned] = useState(false);
    const [torch, setTorch] = useState(false);
    const [webBarcode, setWebBarcode] = useState('');

    useEffect(() => {
        if (Platform.OS !== 'web') {
            requestPermission();
        }
    }, []);

    const requestPermission = async () => {
        if (!Camera) return;
        const { status } = await Camera.requestCameraPermissionsAsync();
        setHasPermission(status === 'granted');
    };

    const handleWebSubmit = () => {
        if (webBarcode.trim()) {
            SoundManager.playScan();
            if (onScan) {
                onScan(webBarcode.trim());
                navigation.goBack();
            }
        }
    };

    const handleBarCodeScanned = ({ type, data }) => {
        if (scanned) return;

        setScanned(true);
        SoundManager.playScan();

        if (onScan) {
            onScan(data);
            navigation.goBack();
        } else {
            Alert.alert('Штрихкод', data, [
                { text: 'OK', onPress: () => setScanned(false) }
            ]);
        }
    };

    const dynamicStyles = {
        container: { backgroundColor: colors.background },
        text: { color: colors.text },
        textSecondary: { color: colors.textSecondary },
    };

    // На вебе показываем поле для ручного ввода штрихкода
    if (Platform.OS === 'web') {
        return (
            <View style={[styles.container, styles.center, dynamicStyles.container]}>
                <Title style={[dynamicStyles.text, { marginBottom: 20 }]}>📦 Ввод штрихкода</Title>
                <TextInput
                    label="Штрихкод"
                    value={webBarcode}
                    onChangeText={setWebBarcode}
                    mode="outlined"
                    style={{ width: 300, marginBottom: 16 }}
                    autoFocus={true}
                    onSubmitEditing={handleWebSubmit}
                    keyboardType="numeric"
                />
                <Button mode="contained" onPress={handleWebSubmit} style={[styles.button, { width: 300 }]}>
                    Найти товар
                </Button>
                <Button mode="outlined" onPress={() => navigation.goBack()} style={[styles.button, { width: 300 }]}>
                    Назад
                </Button>
            </View>
        );
    }

    if (hasPermission === null) {
        return (
            <View style={[styles.container, styles.center, dynamicStyles.container]}>
                <Paragraph style={dynamicStyles.textSecondary}>Запрос разрешения на камеру...</Paragraph>
            </View>
        );
    }

    if (hasPermission === false) {
        return (
            <View style={[styles.container, styles.center, dynamicStyles.container]}>
                <Title style={dynamicStyles.text}>Нет доступа к камере</Title>
                <Paragraph style={[dynamicStyles.textSecondary, styles.message]}>
                    Разрешите доступ к камере в настройках
                </Paragraph>
                <Button mode="contained" onPress={requestPermission} style={styles.button}>
                    Запросить доступ
                </Button>
                <Button mode="outlined" onPress={() => navigation.goBack()} style={styles.button}>
                    Назад
                </Button>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <CameraView
                style={styles.camera}
                facing="back"
                enableTorch={torch}
                onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
                barcodeScannerSettings={{
                    barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e', 'code128', 'code39', 'qr'],
                }}
            />

            {/* Рамка сканирования */}
            <View style={styles.overlay}>
                <View style={styles.scanFrame}>
                    <View style={[styles.corner, styles.topLeft]} />
                    <View style={[styles.corner, styles.topRight]} />
                    <View style={[styles.corner, styles.bottomLeft]} />
                    <View style={[styles.corner, styles.bottomRight]} />
                </View>
                <Paragraph style={styles.hint}>Наведите камеру на штрихкод</Paragraph>
            </View>

            {/* Кнопки управления */}
            <View style={styles.controls}>
                <IconButton
                    icon="close"
                    iconColor="#fff"
                    size={32}
                    style={styles.controlButton}
                    onPress={() => navigation.goBack()}
                />
                <IconButton
                    icon={torch ? "flashlight-off" : "flashlight"}
                    iconColor="#fff"
                    size={32}
                    style={[styles.controlButton, torch && { backgroundColor: colors.warning }]}
                    onPress={() => setTorch(!torch)}
                />
            </View>

            {scanned && (
                <Button
                    mode="contained"
                    onPress={() => setScanned(false)}
                    style={styles.rescanButton}
                >
                    Сканировать снова
                </Button>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#000' },
    center: { justifyContent: 'center', alignItems: 'center' },
    camera: { flex: 1 },
    message: { textAlign: 'center', marginVertical: 16, paddingHorizontal: 32 },
    button: { marginTop: 16, width: 200 },
    overlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center' },
    scanFrame: { width: 280, height: 200, borderColor: 'transparent', position: 'relative' },
    corner: { position: 'absolute', width: 30, height: 30, borderColor: '#10b981', borderWidth: 4 },
    topLeft: { top: 0, left: 0, borderBottomWidth: 0, borderRightWidth: 0 },
    topRight: { top: 0, right: 0, borderBottomWidth: 0, borderLeftWidth: 0 },
    bottomLeft: { bottom: 0, left: 0, borderTopWidth: 0, borderRightWidth: 0 },
    bottomRight: { bottom: 0, right: 0, borderTopWidth: 0, borderLeftWidth: 0 },
    hint: { color: '#fff', marginTop: 24, textAlign: 'center' },
    controls: { position: 'absolute', top: 40, left: 0, right: 0, flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16 },
    controlButton: { backgroundColor: 'rgba(0,0,0,0.5)' },
    rescanButton: { position: 'absolute', bottom: 40, left: 40, right: 40 },
});
