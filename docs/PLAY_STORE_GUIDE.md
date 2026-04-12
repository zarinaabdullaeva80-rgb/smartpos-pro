# 📱 Публикация в Play Store

## Подготовка

### 1. Настройка app.json

Файл `mobile-pos/app.json` уже настроен:

- `version`: 1.4.0
- `android.package`: com.company.accounting_pos
- `android.versionCode`: 5

### 2. Сборка APK

```bash
cd mobile-pos
npx expo prebuild --platform android
cd android
./gradlew assembleRelease
```

APK будет в: `android/app/build/outputs/apk/release/`

### Альтернатива: EAS Build

```bash
npm install -g eas-cli
eas login
eas build --platform android
```

---

## Публикация в Play Console

### 1. Создайте аккаунт разработчика

- <https://play.google.com/console>
- Регистрация: $25 (одноразово)

### 2. Создайте приложение

- Название: **1С Продажа** / **SmartPOS Pro**
- Категория: Бизнес / Финансы
- Язык: Русский

### 3. Настройка страницы

- Описание (краткое и полное)
- Скриншоты (min 2-3 для телефона)
- Иконка 512x512
- Feature Graphic 1024x500

### 4. Загрузка APK

- Production → Releases → Create new
- Загрузите APK/AAB файл
- Заполните Release notes

### 5. Рейтинг контента

- Пройдите анкету IARC
- Получите рейтинг контента

### 6. Отправка на проверку

- Проверка занимает 1-7 дней

---

## Обновление приложения

1. Увеличьте `version` и `versionCode` в app.json
2. Соберите новый APK
3. Загрузите в Play Console
4. Создайте новый Release
