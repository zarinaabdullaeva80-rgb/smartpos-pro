#!/bin/bash
# ═══════════════════════════════════════════════════════════
#  SmartPOS Pro — iOS Build Script (только для Mac)
# ═══════════════════════════════════════════════════════════
#
#  Запуск:
#    chmod +x build-ios.sh
#    ./build-ios.sh [expo-go|dev|simulator|release]
#
#  Варианты:
#    expo-go    — Запустить через Expo Go (без сборки)
#    dev        — Dev-сборка на физическое устройство (Xcode)
#    simulator  — Запуск на iOS симуляторе
#    release    — Продакшн сборка через EAS (Apple Developer $99/год)
#
# ═══════════════════════════════════════════════════════════

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
MPOS_DIR="$SCRIPT_DIR/mpos"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo ""
echo "╔══════════════════════════════════════════════════════╗"
echo "║        SmartPOS Pro — iOS Build                      ║"
echo "╚══════════════════════════════════════════════════════╝"
echo ""

# Проверка ОС
if [[ "$(uname)" != "Darwin" ]]; then
    echo -e "${RED}❌ Этот скрипт работает ТОЛЬКО на macOS!${NC}"
    echo "   Текущая ОС: $(uname)"
    echo ""
    echo "Для сборки iOS приложения вам нужен Mac с:"
    echo "  • macOS 12+ (Monterey или новее)"
    echo "  • Xcode 14+ (из App Store)"
    echo "  • Node.js 18+"
    echo ""
    exit 1
fi

# Проверка Xcode
if ! command -v xcodebuild &> /dev/null; then
    echo -e "${YELLOW}⚠️  Xcode не установлен или не настроен${NC}"
    echo "   Установите Xcode из App Store:"
    echo "   https://apps.apple.com/app/xcode/id497799835"
    echo ""
    echo "   После установки выполните:"
    echo "   sudo xcode-select --switch /Applications/Xcode.app"
    echo "   sudo xcodebuild -license accept"
    echo ""
fi

# Проверка Node.js
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js не найден! Установите:${NC}"
    echo "   brew install node"
    exit 1
fi

# Перейти в директорию мобильного приложения
cd "$MPOS_DIR"

# Установить зависимости если нужно
if [ ! -d "node_modules" ]; then
    echo -e "${BLUE}📦 Установка зависимостей...${NC}"
    npm install
fi

# Определить вариант сборки
MODE="${1:-help}"

case "$MODE" in
    expo-go|expo|go)
        echo ""
        echo -e "${GREEN}═══ Вариант A: Expo Go ═══${NC}"
        echo ""
        echo "Запуск Metro сервера..."
        echo ""
        echo -e "${YELLOW}📱 Инструкция:${NC}"
        echo "  1. Установите приложение 'Expo Go' на iPhone из App Store"
        echo "  2. Отсканируйте QR-код камерой iPhone"
        echo "  3. SmartPOS Pro откроется в Expo Go"
        echo ""
        echo -e "${YELLOW}⚠️  Ограничения Expo Go:${NC}"
        echo "  • Нужен Wi-Fi (Mac и iPhone в одной сети)"
        echo "  • Не все нативные модули доступны"
        echo "  • Для тестирования, НЕ для продакшена"
        echo ""

        npx expo start
        ;;

    dev|device)
        echo ""
        echo -e "${GREEN}═══ Вариант B: Dev-сборка на устройство ═══${NC}"
        echo ""
        echo -e "${YELLOW}📱 Требования:${NC}"
        echo "  • iPhone подключён к Mac по USB"
        echo "  • Бесплатный Apple ID (Settings → Sign In)"
        echo "  • Xcode установлен"
        echo ""
        echo -e "${YELLOW}⚠️  Ограничения (без Apple Developer Program):${NC}"
        echo "  • Приложение работает 7 дней, потом нужно пересобрать"
        echo "  • Максимум 3 устройства"
        echo "  • На iPhone: Настройки → Основные → Профили → Доверять разработчику"
        echo ""
        echo "Начинаю сборку..."
        echo ""

        # Установить CocoaPods если нужно
        if ! command -v pod &> /dev/null; then
            echo -e "${BLUE}📦 Установка CocoaPods...${NC}"
            sudo gem install cocoapods
        fi

        # Prebuild если нужно
        if [ ! -d "ios" ]; then
            echo -e "${BLUE}📦 Генерация iOS проекта (expo prebuild)...${NC}"
            npx expo prebuild --platform ios
        fi

        # Установить pods
        cd ios
        pod install
        cd ..

        # Собрать и установить на устройство
        npx expo run:ios --device
        ;;

    simulator|sim)
        echo ""
        echo -e "${GREEN}═══ Вариант: iOS Симулятор ═══${NC}"
        echo ""
        echo "Запуск на iOS симуляторе..."
        echo ""

        # Prebuild если нужно
        if [ ! -d "ios" ]; then
            echo -e "${BLUE}📦 Генерация iOS проекта...${NC}"
            npx expo prebuild --platform ios
        fi

        npx expo run:ios
        ;;

    release|production|prod)
        echo ""
        echo -e "${GREEN}═══ Вариант C: Продакшн (EAS Build) ═══${NC}"
        echo ""
        echo -e "${RED}⚠️  Требуется Apple Developer Program ($99/год)${NC}"
        echo "   https://developer.apple.com/programs/"
        echo ""
        echo -e "${YELLOW}Без Apple Developer Program сборка НЕ БУДЕТ работать!${NC}"
        echo ""
        read -p "У вас есть Apple Developer аккаунт? (y/n): " has_account

        if [[ "$has_account" != "y" && "$has_account" != "Y" ]]; then
            echo ""
            echo "Используйте варианты 'expo-go' или 'dev' пока без Apple Developer."
            echo ""
            exit 0
        fi

        echo ""
        echo "Запуск EAS Build для iOS..."
        npx eas-cli build --platform ios --profile production
        ;;

    help|--help|-h|*)
        echo "Использование: ./build-ios.sh [вариант]"
        echo ""
        echo "Варианты:"
        echo ""
        echo -e "  ${GREEN}expo-go${NC}     Запуск через Expo Go (тестирование)"
        echo "              Не требует Apple Developer"
        echo "              iPhone + Mac в одной Wi-Fi сети"
        echo ""
        echo -e "  ${GREEN}dev${NC}         Dev-сборка на физическое устройство"
        echo "              Требует: Xcode + бесплатный Apple ID"
        echo "              Ограничение: 7 дней, потом пересобрать"
        echo ""
        echo -e "  ${GREEN}simulator${NC}   Запуск на iOS симуляторе"
        echo "              Требует: Xcode"
        echo ""
        echo -e "  ${YELLOW}release${NC}     Продакшн сборка (App Store / TestFlight)"
        echo "              Требует: Apple Developer Program ($99/год)"
        echo ""
        echo "Примеры:"
        echo "  ./build-ios.sh expo-go      # Быстро протестировать"
        echo "  ./build-ios.sh dev          # Установить на iPhone"
        echo "  ./build-ios.sh simulator    # Запустить на симуляторе"
        echo ""
        ;;
esac

echo ""
echo "════════════════════════════════════════"
echo "Готово!"
echo "════════════════════════════════════════"
