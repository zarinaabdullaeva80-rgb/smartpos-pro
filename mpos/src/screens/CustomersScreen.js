import React, { useState, useEffect } from 'react';
import { View, StyleSheet, FlatList, Alert } from 'react-native';
import { Searchbar, Card, Title, Paragraph, Button, FAB, IconButton, TextInput, Modal, Portal } from 'react-native-paper';
import api from '../services/api';
import { useTheme } from '../context/ThemeContext';
import SoundManager from '../services/sounds';

export default function CustomersScreen({ navigation, route }) {
    const { colors } = useTheme();

    const [customers, setCustomers] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [loading, setLoading] = useState(true);
    const [modalVisible, setModalVisible] = useState(false);
    const [editingCustomer, setEditingCustomer] = useState(null);
    const [form, setForm] = useState({ name: '', phone: '', email: '', discount: '0', notes: '' });

    const { onSelect } = route.params || {};

    useEffect(() => { loadCustomers(); }, []);

    const loadCustomers = async () => {
        setLoading(true);
        try {
            const response = await api.get('/customers', { params: { search: searchQuery } });
            setCustomers(response.data.customers || []);
        } catch (error) {
            setCustomers([
                { id: 1, name: 'Иван Иванов', phone: '+998901234567', loyalty_points: 150, discount: 5 },
                { id: 2, name: 'Мария Петрова', phone: '+998909876543', loyalty_points: 500, discount: 10 },
            ]);
        } finally {
            setLoading(false);
        }
    };

    const openNewCustomerModal = () => {
        setEditingCustomer(null);
        setForm({ name: '', phone: '', email: '', discount: '0', notes: '' });
        setModalVisible(true);
    };

    const openEditModal = (customer) => {
        setEditingCustomer(customer);
        setForm({
            name: customer.name || '', phone: customer.phone || '', email: customer.email || '',
            discount: String(customer.discount || 0), notes: customer.notes || '',
        });
        setModalVisible(true);
    };

    const saveCustomer = async () => {
        if (!form.name.trim()) { Alert.alert('Ошибка', 'Введите имя клиента'); return; }
        try {
            if (editingCustomer) {
                await api.put(`/customers/${editingCustomer.id}`, form);
            } else {
                await api.post('/customers', form);
            }
            setModalVisible(false);
            loadCustomers();
            SoundManager.playSuccess();
            Alert.alert('Успех', editingCustomer ? 'Клиент обновлён' : 'Клиент добавлен');
        } catch (error) {
            SoundManager.playError();
            Alert.alert('Ошибка', 'Не удалось сохранить клиента');
        }
    };

    const selectCustomer = (customer) => {
        if (onSelect) { onSelect(customer); navigation.goBack(); }
    };

    const dynamicStyles = {
        container: { backgroundColor: colors.background },
        card: { backgroundColor: colors.card },
        modal: { backgroundColor: colors.card },
        input: { backgroundColor: colors.input },
        text: { color: colors.text },
        textSecondary: { color: colors.textSecondary },
        searchbar: { backgroundColor: colors.surface },
    };

    const renderCustomer = ({ item }) => (
        <Card style={[styles.card, dynamicStyles.card]} onPress={() => selectCustomer(item)}>
            <Card.Content style={styles.cardContent}>
                <View style={styles.customerInfo}>
                    <Title style={[styles.name, dynamicStyles.text]}>{item.name}</Title>
                    <Paragraph style={dynamicStyles.textSecondary}>{item.phone || 'Нет телефона'}</Paragraph>
                    <View style={styles.badges}>
                        {item.loyalty_points > 0 && <Paragraph style={{ color: colors.warning }}>🎁 {item.loyalty_points} баллов</Paragraph>}
                        {item.discount > 0 && <Paragraph style={{ color: colors.success }}>💰 Скидка {item.discount}%</Paragraph>}
                    </View>
                </View>
                <IconButton icon="pencil" iconColor={colors.primary} onPress={() => openEditModal(item)} />
            </Card.Content>
        </Card>
    );

    return (
        <View style={[styles.container, dynamicStyles.container]}>
            <Searchbar placeholder="Поиск..." value={searchQuery} onChangeText={setSearchQuery} onSubmitEditing={loadCustomers} style={[styles.searchbar, dynamicStyles.searchbar]} />

            <FlatList
                data={customers.filter(c => c.name?.toLowerCase().includes(searchQuery.toLowerCase()) || c.phone?.includes(searchQuery))}
                renderItem={renderCustomer}
                keyExtractor={item => String(item.id)}
                contentContainerStyle={styles.list}
                refreshing={loading}
                onRefresh={loadCustomers}
                ListEmptyComponent={<Paragraph style={[styles.empty, dynamicStyles.textSecondary]}>Клиенты не найдены</Paragraph>}
            />

            <FAB icon="plus" label="Новый клиент" style={[styles.fab, { backgroundColor: colors.success }]} onPress={openNewCustomerModal} />

            <Portal>
                <Modal visible={modalVisible} onDismiss={() => setModalVisible(false)} contentContainerStyle={[styles.modal, dynamicStyles.modal]}>
                    <Title style={[styles.modalTitle, dynamicStyles.text]}>{editingCustomer ? 'Редактировать' : 'Новый клиент'}</Title>
                    <TextInput label="Имя *" value={form.name} onChangeText={(t) => setForm({ ...form, name: t })} style={[styles.input, dynamicStyles.input]} mode="outlined" />
                    <TextInput label="Телефон" value={form.phone} onChangeText={(t) => setForm({ ...form, phone: t })} keyboardType="phone-pad" style={[styles.input, dynamicStyles.input]} mode="outlined" />
                    <TextInput label="Email" value={form.email} onChangeText={(t) => setForm({ ...form, email: t })} keyboardType="email-address" style={[styles.input, dynamicStyles.input]} mode="outlined" />
                    <TextInput label="Скидка %" value={form.discount} onChangeText={(t) => setForm({ ...form, discount: t })} keyboardType="numeric" style={[styles.input, dynamicStyles.input]} mode="outlined" />
                    <View style={styles.modalButtons}>
                        <Button mode="outlined" onPress={() => setModalVisible(false)}>Отмена</Button>
                        <Button mode="contained" onPress={saveCustomer}>Сохранить</Button>
                    </View>
                </Modal>
            </Portal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    searchbar: { margin: 16 },
    list: { padding: 16, paddingTop: 0, paddingBottom: 100 },
    card: { marginBottom: 12 },
    cardContent: { flexDirection: 'row', alignItems: 'center' },
    customerInfo: { flex: 1 },
    name: { fontSize: 16 },
    badges: { flexDirection: 'row', gap: 12, marginTop: 4 },
    empty: { textAlign: 'center', padding: 40 },
    fab: { position: 'absolute', right: 16, bottom: 16 },
    modal: { margin: 20, padding: 20, borderRadius: 12 },
    modalTitle: { marginBottom: 16 },
    input: { marginBottom: 12 },
    modalButtons: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 16 },
});
