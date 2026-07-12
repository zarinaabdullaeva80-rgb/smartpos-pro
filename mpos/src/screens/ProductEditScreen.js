import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { TextInput, Button, Title, Card, Paragraph, Portal, Dialog, List, Divider, HelperText } from 'react-native-paper';
import { productsAPI, categoriesAPI } from '../services/api';
import { useTheme } from '../context/ThemeContext';
import SoundManager from '../services/sounds';

export default function ProductEditScreen({ route, navigation }) {
    const { colors } = useTheme();
    const product = route.params?.product || null;
    const existingProducts = route.params?.existingProducts || [];

    const isEditMode = !!product;
    const [productId, setProductId] = useState(product?.id || null);
    
    // Form fields
    const [code, setCode] = useState(product?.code || '');
    const [name, setName] = useState(product?.name || '');
    const [barcode, setBarcode] = useState(product?.barcode || '');
    const [categoryId, setCategoryId] = useState(product?.category_id || null);
    const [categoryName, setCategoryName] = useState(product?.category_name || 'Выберите категорию');
    const [unit, setUnit] = useState(product?.unit || 'шт');
    const [pricePurchase, setPricePurchase] = useState(product?.price_purchase?.toString() || '0');
    const [priceSale, setPriceSale] = useState(product?.price_sale?.toString() || '0');
    const [minStock, setMinStock] = useState(product?.min_stock?.toString() || '0');
    const [quantity, setQuantity] = useState(product?.quantity?.toString() || '0');

    // UI States
    const [categories, setCategories] = useState([]);
    const [showCategoryDialog, setShowCategoryDialog] = useState(false);
    const [saving, setSaving] = useState(false);
    const [loadingCategories, setLoadingCategories] = useState(false);
    
    // Barcode check dialog state
    const [showBarcodeConflictDialog, setShowBarcodeConflictDialog] = useState(false);
    const [conflictingProduct, setConflictingProduct] = useState(null);

    // Form errors
    const [errors, setErrors] = useState({});

    useEffect(() => {
        loadCategories();
    }, []);

    const loadCategories = async () => {
        setLoadingCategories(true);
        try {
            const response = await categoriesAPI.getAll();
            const cats = response.data.categories || [];
            setCategories(cats);
            
            // Map category_id to name if we have categoryId
            if (categoryId) {
                const found = cats.find(c => c.id === categoryId);
                if (found) setCategoryName(found.name);
            }
        } catch (error) {
            console.log('[ProductEdit] Categories load error:', error.message);
        } finally {
            setLoadingCategories(false);
        }
    };

    // Check if barcode already exists
    const checkBarcodeConflict = (scannedBarcode) => {
        if (!scannedBarcode) return;
        
        // Find if any other product has this barcode
        const matched = existingProducts.find(p => p.barcode === scannedBarcode && p.id !== productId);
        if (matched) {
            SoundManager.playError();
            setConflictingProduct(matched);
            setShowBarcodeConflictDialog(true);
        }
    };

    const handleBarcodeChange = (text) => {
        setBarcode(text);
        if (text && text.length >= 8) {
            checkBarcodeConflict(text);
        }
    };

    const startScanning = () => {
        navigation.navigate('Scanner', {
            onScan: (scannedValue) => {
                setBarcode(scannedValue);
                // Check if this barcode exists
                const matched = existingProducts.find(p => p.barcode === scannedValue && p.id !== productId);
                if (matched) {
                    SoundManager.playError();
                    setConflictingProduct(matched);
                    setShowBarcodeConflictDialog(true);
                } else {
                    SoundManager.playSuccess();
                }
            }
        });
    };

    const handleSwitchToConflictProduct = () => {
        if (!conflictingProduct) return;
        
        // Switch form to edit the conflict product
        setProductId(conflictingProduct.id);
        setCode(conflictingProduct.code || '');
        setName(conflictingProduct.name || '');
        setBarcode(conflictingProduct.barcode || '');
        setCategoryId(conflictingProduct.category_id || null);
        setCategoryName(conflictingProduct.category_name || 'Выберите категорию');
        setUnit(conflictingProduct.unit || 'шт');
        setPricePurchase(conflictingProduct.price_purchase?.toString() || '0');
        setPriceSale(conflictingProduct.price_sale?.toString() || '0');
        setMinStock(conflictingProduct.min_stock?.toString() || '0');
        setQuantity(conflictingProduct.quantity?.toString() || '0');
        
        // Close dialog
        setShowBarcodeConflictDialog(false);
        setConflictingProduct(null);
        
        Alert.alert('Режим редактирования', `Вы переключились на редактирование товара: ${conflictingProduct.name}`);
    };

    const validateForm = () => {
        const newErrors = {};
        if (!name.trim()) newErrors.name = 'Наименование обязательно';
        if (!code.trim()) newErrors.code = 'Код обязателен';
        
        const saleVal = parseFloat(priceSale);
        if (isNaN(saleVal) || saleVal <= 0) {
            newErrors.priceSale = 'Цена продажи должна быть больше 0';
        }

        const purchVal = parseFloat(pricePurchase);
        if (isNaN(purchVal) || purchVal < 0) {
            newErrors.pricePurchase = 'Закупочная цена не может быть отрицательной';
        }

        const qtyVal = parseFloat(quantity);
        if (isNaN(qtyVal) || qtyVal < 0) {
            newErrors.quantity = 'Начальный остаток не может быть отрицательным';
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSave = async () => {
        if (!validateForm()) {
            SoundManager.playError();
            return;
        }

        setSaving(true);
        try {
            const data = {
                code: code.trim(),
                name: name.trim(),
                barcode: barcode.trim() || null,
                categoryId: categoryId,
                unit: unit.trim(),
                pricePurchase: parseFloat(pricePurchase) || 0,
                priceSale: parseFloat(priceSale) || 0,
                priceRetail: parseFloat(priceSale) || 0, // Использовать цену продажи как розничную по умолчанию
                vatRate: 20,
                description: '',
                imageUrl: product?.image_url || null,
                quantity: parseInt(quantity) || 0,
                minStock: parseInt(minStock) || 0,
                isActive: true
            };

            let response;
            if (productId) {
                response = await productsAPI.update(productId, data);
            } else {
                response = await productsAPI.create(data);
            }

            SoundManager.playSuccess();
            Alert.alert(
                'Успешно',
                productId ? 'Товар успешно обновлен' : 'Товар успешно добавлен',
                [{ text: 'OK', onPress: () => navigation.goBack() }]
            );
        } catch (error) {
            console.error('[ProductEdit] Save error:', error);
            SoundManager.playError();
            Alert.alert(
                'Ошибка',
                error.response?.data?.error || error.response?.data?.details || 'Не удалось сохранить товар'
            );
        } finally {
            setSaving(false);
        }
    };

    const dynamicStyles = {
        container: { backgroundColor: colors.background },
        card: { backgroundColor: colors.card },
        text: { color: colors.text },
        textSecondary: { color: colors.textSecondary },
        dialog: { backgroundColor: colors.surface },
    };

    return (
        <KeyboardAvoidingView
            style={[styles.container, dynamicStyles.container]}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}
        >
            <ScrollView contentContainerStyle={styles.scrollContainer}>
                <Card style={[styles.card, dynamicStyles.card]}>
                    <Card.Content>
                        <Title style={[styles.title, dynamicStyles.text]}>
                            {productId ? 'Редактирование товара' : 'Новый товар'}
                        </Title>
                        
                        <TextInput
                            label="Код товара *"
                            value={code}
                            onChangeText={setCode}
                            mode="outlined"
                            style={styles.input}
                            error={!!errors.code}
                            textColor={colors.text}
                        />
                        {errors.code && <HelperText type="error">{errors.code}</HelperText>}

                        <TextInput
                            label="Наименование товара *"
                            value={name}
                            onChangeText={setName}
                            mode="outlined"
                            style={styles.input}
                            error={!!errors.name}
                            textColor={colors.text}
                        />
                        {errors.name && <HelperText type="error">{errors.name}</HelperText>}

                        <View style={styles.barcodeContainer}>
                            <TextInput
                                label="Штрихкод"
                                value={barcode}
                                onChangeText={handleBarcodeChange}
                                mode="outlined"
                                style={[styles.input, styles.barcodeInput]}
                                textColor={colors.text}
                                right={<TextInput.Icon icon="barcode-scan" onPress={startScanning} />}
                            />
                        </View>

                        <List.Item
                            title="Категория"
                            description={categoryName}
                            style={[styles.categorySelect, { borderColor: colors.border }]}
                            titleStyle={dynamicStyles.text}
                            descriptionStyle={{ color: colors.primary }}
                            onPress={() => setShowCategoryDialog(true)}
                            right={() => <List.Icon icon="chevron-down" color={colors.textSecondary} />}
                        />

                        <TextInput
                            label="Единица измерения"
                            value={unit}
                            onChangeText={setUnit}
                            mode="outlined"
                            style={styles.input}
                            textColor={colors.text}
                        />

                        <View style={styles.row}>
                            <TextInput
                                label="Закуп. цена (UZS)"
                                value={pricePurchase}
                                onChangeText={setPricePurchase}
                                mode="outlined"
                                keyboardType="numeric"
                                style={[styles.input, styles.flexInput]}
                                error={!!errors.pricePurchase}
                                textColor={colors.text}
                            />
                            <TextInput
                                label="Продаж. цена (UZS) *"
                                value={priceSale}
                                onChangeText={setPriceSale}
                                mode="outlined"
                                keyboardType="numeric"
                                style={[styles.input, styles.flexInput]}
                                error={!!errors.priceSale}
                                textColor={colors.text}
                            />
                        </View>
                        {errors.priceSale && <HelperText type="error">{errors.priceSale}</HelperText>}

                        <View style={styles.row}>
                            <TextInput
                                label="Остаток (Количество)"
                                value={quantity}
                                onChangeText={setQuantity}
                                mode="outlined"
                                keyboardType="numeric"
                                style={[styles.input, styles.flexInput]}
                                error={!!errors.quantity}
                                textColor={colors.text}
                            />
                            <TextInput
                                label="Мин. остаток"
                                value={minStock}
                                onChangeText={setMinStock}
                                mode="outlined"
                                keyboardType="numeric"
                                style={[styles.input, styles.flexInput]}
                                textColor={colors.text}
                            />
                        </View>

                        <Button
                            mode="contained"
                            onPress={handleSave}
                            loading={saving}
                            disabled={saving}
                            style={styles.saveButton}
                            buttonColor={colors.primary}
                        >
                            Сохранить товар
                        </Button>
                        
                        <Button
                            mode="outlined"
                            onPress={() => navigation.goBack()}
                            disabled={saving}
                            style={styles.cancelButton}
                            textColor={colors.text}
                        >
                            Отмена
                        </Button>
                    </Card.Content>
                </Card>
            </ScrollView>

            {/* Category selection dialog */}
            <Portal>
                <Dialog visible={showCategoryDialog} onDismiss={() => setShowCategoryDialog(false)} style={dynamicStyles.dialog}>
                    <Dialog.Title style={dynamicStyles.text}>Выберите категорию</Dialog.Title>
                    <Dialog.ScrollArea style={{ maxHeight: 300 }}>
                        <ScrollView>
                            <List.Item
                                title="Без категории"
                                titleStyle={dynamicStyles.text}
                                onPress={() => {
                                    setCategoryId(null);
                                    setCategoryName('Без категории');
                                    setShowCategoryDialog(false);
                                }}
                            />
                            <Divider />
                            {categories.map((cat) => (
                                <View key={cat.id}>
                                    <List.Item
                                        title={cat.name}
                                        titleStyle={dynamicStyles.text}
                                        onPress={() => {
                                            setCategoryId(cat.id);
                                            setCategoryName(cat.name);
                                            setShowCategoryDialog(false);
                                        }}
                                    />
                                    <Divider />
                                </View>
                            ))}
                        </ScrollView>
                    </Dialog.ScrollArea>
                    <Dialog.Actions>
                        <Button onPress={() => setShowCategoryDialog(false)}>Отмена</Button>
                    </Dialog.Actions>
                </Dialog>
            </Portal>

            {/* Barcode conflict dialog */}
            <Portal>
                <Dialog visible={showBarcodeConflictDialog} onDismiss={() => setShowBarcodeConflictDialog(false)} style={dynamicStyles.dialog}>
                    <Dialog.Title style={{ color: colors.error }}>⚠️ Штрихкод уже занят</Dialog.Title>
                    <Dialog.Content>
                        <Paragraph style={dynamicStyles.text}>
                            Товар с таким штрихкодом уже существует: {'\n'}
                            <Paragraph style={{ fontWeight: 'bold', color: colors.text }}>
                                {conflictingProduct?.name} (Код: {conflictingProduct?.code})
                            </Paragraph>
                            {'\n'}{'\n'}
                            Что вы хотите сделать?
                        </Paragraph>
                    </Dialog.Content>
                    <Dialog.Actions style={{ flexDirection: 'column', alignItems: 'stretch', gap: 8, paddingHorizontal: 16 }}>
                        <Button 
                            mode="contained" 
                            buttonColor={colors.primary}
                            onPress={handleSwitchToConflictProduct}
                        >
                            Редактировать существующий товар
                        </Button>
                        <Button 
                            mode="outlined" 
                            textColor={colors.text}
                            onPress={() => setShowBarcodeConflictDialog(false)}
                        >
                            Использовать штрихкод для нового товара
                        </Button>
                        <Button 
                            textColor={colors.error}
                            onPress={() => {
                                setBarcode('');
                                setShowBarcodeConflictDialog(false);
                            }}
                        >
                            Очистить штрихкод и отменить
                        </Button>
                    </Dialog.Actions>
                </Dialog>
            </Portal>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    scrollContainer: {
        padding: 16,
    },
    card: {
        borderRadius: 12,
    },
    title: {
        fontSize: 22,
        fontWeight: 'bold',
        marginBottom: 16,
        textAlign: 'center',
    },
    input: {
        marginBottom: 12,
    },
    barcodeContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    barcodeInput: {
        flex: 1,
        marginBottom: 0,
    },
    categorySelect: {
        borderWidth: 1,
        borderRadius: 4,
        marginBottom: 16,
        paddingVertical: 8,
    },
    row: {
        flexDirection: 'row',
        gap: 12,
        marginBottom: 4,
    },
    flexInput: {
        flex: 1,
    },
    saveButton: {
        marginTop: 20,
        paddingVertical: 6,
    },
    cancelButton: {
        marginTop: 10,
    },
});
