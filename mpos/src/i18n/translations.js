// Мобильное приложение — словари переводов
const translations = {
  ru: {
    // Табы навигации
    home: 'Главная',
    products: 'Товары',
    cart: 'Корзина',
    sales: 'Продажи',
    profile: 'Профиль',
    settings: 'Настройки',
    
    // Авторизация
    login: 'Вход',
    username: 'Логин',
    password: 'Пароль',
    loginBtn: 'Войти',
    loggingIn: 'Вход...',
    serverAddress: 'Адрес сервера',
    loginError: 'Неверные данные',
    
    // Товары
    searchProducts: 'Поиск товаров...',
    allCategories: 'Все',
    noProducts: 'Товары не найдены',
    price: 'Цена',
    stock: 'Остаток',
    barcode: 'Штрих-код',
    addToCart: 'В корзину',
    
    // Корзина
    emptyCart: 'Корзина пуста',
    total: 'Итого',
    checkout: 'Оформить',
    clearCart: 'Очистить',
    quantity: 'Кол-во',
    discount: 'Скидка',
    
    // Продажи
    salesHistory: 'История продаж',
    receipt: 'Чек',
    date: 'Дата',
    amount: 'Сумма',
    cash: 'Наличные',
    card: 'Карта',
    
    // Оплата
    payment: 'Оплата',
    paymentType: 'Тип оплаты',
    cashPayment: 'Наличные',
    cardPayment: 'Карта',
    transferPayment: 'Перевод',
    change: 'Сдача',
    confirm: 'Подтвердить',
    
    // Профиль
    shift: 'Смена',
    openShift: 'Открыть смену',
    closeShift: 'Закрыть смену',
    shiftOpen: 'Смена открыта',
    shiftClosed: 'Смена закрыта',
    
    // Общие
    loading: 'Загрузка...',
    error: 'Ошибка',
    success: 'Успешно',
    cancel: 'Отмена',
    save: 'Сохранить',
    delete: 'Удалить',
    edit: 'Редактировать',
    back: 'Назад',
    sync: 'Синхронизация',
    syncing: 'Синхронизация...',
    syncComplete: 'Синхронизация завершена',
    offline: 'Офлайн режим',
    online: 'Онлайн',
    language: 'Язык',
    russian: 'Русский',
    uzbek: 'O\'zbek',
    logout: 'Выход',
    
    // Сканер
    scanBarcode: 'Сканировать штрих-код',
    productFound: 'Товар найден',
    productNotFound: 'Товар не найден',
  },
  
  uz: {
    // Tab navigatsiya
    home: 'Bosh sahifa',
    products: 'Mahsulotlar',
    cart: 'Savat',
    sales: 'Sotuvlar',
    profile: 'Profil',
    settings: 'Sozlamalar',
    
    // Avtorizatsiya
    login: 'Kirish',
    username: 'Login',
    password: 'Parol',
    loginBtn: 'Kirish',
    loggingIn: 'Kirilmoqda...',
    serverAddress: 'Server manzili',
    loginError: 'Noto\'g\'ri ma\'lumotlar',
    
    // Mahsulotlar
    searchProducts: 'Mahsulot qidirish...',
    allCategories: 'Hammasi',
    noProducts: 'Mahsulotlar topilmadi',
    price: 'Narx',
    stock: 'Qoldiq',
    barcode: 'Shtrix-kod',
    addToCart: 'Savatga',
    
    // Savat
    emptyCart: 'Savat bo\'sh',
    total: 'Jami',
    checkout: 'Rasmiylashtirish',
    clearCart: 'Tozalash',
    quantity: 'Miqdor',
    discount: 'Chegirma',
    
    // Sotuvlar
    salesHistory: 'Sotuv tarixi',
    receipt: 'Chek',
    date: 'Sana',
    amount: 'Summa',
    cash: 'Naqd',
    card: 'Karta',
    
    // To'lov
    payment: 'To\'lov',
    paymentType: 'To\'lov turi',
    cashPayment: 'Naqd pul',
    cardPayment: 'Karta',
    transferPayment: 'O\'tkazma',
    change: 'Qaytim',
    confirm: 'Tasdiqlash',
    
    // Profil
    shift: 'Smena',
    openShift: 'Smena ochish',
    closeShift: 'Smena yopish',
    shiftOpen: 'Smena ochildi',
    shiftClosed: 'Smena yopildi',
    
    // Umumiy
    loading: 'Yuklanmoqda...',
    error: 'Xatolik',
    success: 'Muvaffaqiyatli',
    cancel: 'Bekor qilish',
    save: 'Saqlash',
    delete: 'O\'chirish',
    edit: 'Tahrirlash',
    back: 'Orqaga',
    sync: 'Sinxronizatsiya',
    syncing: 'Sinxronlanmoqda...',
    syncComplete: 'Sinxronizatsiya tugadi',
    offline: 'Oflayn rejim',
    online: 'Onlayn',
    language: 'Til',
    russian: 'Русский',
    uzbek: 'O\'zbek',
    logout: 'Chiqish',
    
    // Skaner
    scanBarcode: 'Shtrix-kodni skanerlash',
    productFound: 'Mahsulot topildi',
    productNotFound: 'Mahsulot topilmadi',
  },
};

export default translations;
