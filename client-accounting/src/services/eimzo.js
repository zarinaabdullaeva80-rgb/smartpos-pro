/**
 * E-IMZO WebSocket Client для SmartPOS Pro
 * Интеграция с ПО E-IMZO (Республика Узбекистан)
 * Документация: https://github.com/qo0p/e-imzo-doc
 */

const EIMZO_WS_URLS = [
    'wss://127.0.0.1:64443/service/cryptapi',
    'ws://127.0.0.1:64646/service/cryptapi'
];

const API_KEYS = [
    'localhost', '96D0C1491615C82B9A54D9989779DF825B690748224C2B04F500F370D51827CE2644D8D4A82C18184D73AB8530BB8ED537269603F61DB0D03D2104ABF789970B',
    '127.0.0.1', 'A7BCFA5D490B351BE0754130DF03A068F855DB4333D43921125B9CF2670EF6A40370C646B90401955E1F7BC9CDBF59CE0B2C5467D820BE189C845D0B79CFC96F'
];

let _ws = null;
let _callbacks = {};
let _callId = 0;
let _connected = false;
let _version = null;

// ═══════════════════════════════════════════
// Base64 encode/decode
// ═══════════════════════════════════════════
const Base64 = {
    encode: (str) => {
        try {
            return btoa(unescape(encodeURIComponent(str)));
        } catch {
            return btoa(str);
        }
    },
    decode: (b64) => {
        try {
            return decodeURIComponent(escape(atob(b64)));
        } catch {
            return atob(b64);
        }
    }
};

// ═══════════════════════════════════════════
// WebSocket подключение к E-IMZO
// ═══════════════════════════════════════════
function _callFunction(func, callback, errorCallback) {
    const id = ++_callId;
    _callbacks[id] = { success: callback, error: errorCallback };
    func.id = id;

    if (_ws && _ws.readyState === WebSocket.OPEN) {
        _ws.send(JSON.stringify(func));
    } else {
        errorCallback('E-IMZO не подключён');
    }
}

function _connect(urlIndex = 0) {
    return new Promise((resolve, reject) => {
        if (urlIndex >= EIMZO_WS_URLS.length) {
            reject(new Error('Не удалось подключиться к E-IMZO. Убедитесь что программа E-IMZO запущена.'));
            return;
        }

        const url = EIMZO_WS_URLS[urlIndex];
        try {
            const ws = new WebSocket(url);
            const timeout = setTimeout(() => {
                ws.close();
                _connect(urlIndex + 1).then(resolve).catch(reject);
            }, 3000);

            ws.onopen = () => {
                clearTimeout(timeout);
                _ws = ws;
                _connected = true;
                resolve(ws);
            };

            ws.onmessage = (event) => {
                const data = JSON.parse(event.data);
                const cb = _callbacks[data.id];
                if (cb) {
                    delete _callbacks[data.id];
                    cb.success(event, data);
                }
            };

            ws.onerror = () => {
                clearTimeout(timeout);
                ws.close();
                _connect(urlIndex + 1).then(resolve).catch(reject);
            };

            ws.onclose = () => {
                _connected = false;
                _ws = null;
            };
        } catch {
            _connect(urlIndex + 1).then(resolve).catch(reject);
        }
    });
}

// ═══════════════════════════════════════════
// Разбор X500Name (DN) из сертификата
// ═══════════════════════════════════════════
function _getX500Val(s, field) {
    if (!s) return '';
    const regex = new RegExp(`(?:^|,)\\s*${field}=([^,]*)`, 'i');
    const match = s.match(regex);
    return match ? match[1].trim() : '';
}

// ═══════════════════════════════════════════
// Публичное API
// ═══════════════════════════════════════════
// ═══════════════════════════════════════════
// Публичное API
// ═══════════════════════════════════════════
const EImzoService = {

    /** Статус подключения */
    isConnected: () => _connected,
    getVersion: () => _version,

    /** Подключение к E-IMZO */
    connect: async () => {
        if (_connected && _ws?.readyState === WebSocket.OPEN) return true;

        await _connect();

        // Установка API-ключей
        return new Promise((resolve, reject) => {
            _callFunction(
                { name: 'apikey', arguments: API_KEYS },
                (event, data) => {
                    if (data.success) {
                        // Проверяем версию
                        _callFunction(
                            { name: 'version' },
                            (event, vData) => {
                                if (vData.success) {
                                    _version = `${vData.major}.${vData.minor}`;
                                }
                                resolve(true);
                            },
                            () => resolve(true)
                        );
                    } else {
                        reject(new Error(data.reason || 'Ошибка API-ключа E-IMZO'));
                    }
                },
                (err) => reject(new Error(err || 'Ошибка подключения к E-IMZO'))
            );
        });
    },

    /** Отключение */
    disconnect: () => {
        if (_ws) {
            _ws.close();
            _ws = null;
            _connected = false;
        }
    },

    /** Показать меню E-IMZO */
    showMenu: () => {
        return new Promise((resolve) => {
            _callFunction({ plugin: 'app', name: 'show_menu' }, resolve, resolve);
        });
    },

    /** Получить версию JVM */
    getJvmVersion: () => {
        return new Promise((resolve) => {
            _callFunction({ plugin: 'app', name: 'get_jvm_version' }, (e, d) => resolve(d), () => resolve(null));
        });
    },

    /** Получить список всех ключей ЭЦП (агрегированный из разных плагинов) */
    listKeys: async () => {
        const plugins = [
            { id: 'pfx', method: 'list_all_certificates' },
            { id: 'ytks', method: 'list_all_certificates' },
            { id: 'baikey', method: 'list_tokens' },
            { id: 'uzgrd', method: 'list_tokens' },
            { id: 'idcard', method: 'list_readers' }
        ];

        const allKeys = [];
        const seenSerials = new Set();

        for (const plugin of plugins) {
            try {
                const data = await new Promise((resolve, reject) => {
                    _callFunction(
                        { plugin: plugin.id, name: plugin.method },
                        (event, res) => resolve(res),
                        (err) => reject(err)
                    );
                });

                if (data.success) {
                    const certs = data.certificates || data.tokens || data.readers || [];
                    certs.forEach((el, idx) => {
                        let alias = (el.alias || '').toUpperCase();
                        alias = alias.replace('1.2.860.3.16.1.1=', 'INN=');
                        alias = alias.replace('1.2.860.3.16.1.2=', 'PINFL=');

                        const serial = _getX500Val(alias, 'SERIALNUMBER');
                        
                        // Избегаем дубликатов (иногда один и тот же ключ виден в разных плагинах)
                        if (serial && seenSerials.has(serial)) return;
                        if (serial) seenSerials.add(serial);

                        allKeys.push({
                            id: `${plugin.id}_${idx}`,
                            plugin: plugin.id,
                            disk: el.disk,
                            path: el.path,
                            name: el.name,
                            alias: el.alias,
                            serialNumber: serial,
                            validFrom: _getX500Val(alias, 'VALIDFROM'),
                            validTo: _getX500Val(alias, 'VALIDTO'),
                            CN: _getX500Val(alias, 'CN'),
                            TIN: _getX500Val(alias, 'INN') || _getX500Val(alias, 'UID'),
                            UID: _getX500Val(alias, 'UID'),
                            PINFL: _getX500Val(alias, 'PINFL'),
                            O: _getX500Val(alias, 'O'),
                            T: _getX500Val(alias, 'T'),
                            type: plugin.id // Сохраняем тип плагина для load_key
                        });
                    });
                }
            } catch (e) {
                console.warn(`[E-IMZO] Failed to list keys for plugin ${plugin.id}:`, e);
            }
        }

        // Фильтруем только те, у которых есть ИНН или ПИНФЛ (валидные подписи)
        return allKeys.filter(k => k.TIN || k.PINFL);
    },

    /** Загрузить ключ (получить keyId для подписания) */
    loadKey: (keyObj) => {
        return new Promise((resolve, reject) => {
            const plugin = keyObj.plugin || 'pfx';
            const args = [keyObj.disk, keyObj.path, keyObj.name, keyObj.alias];
            
            // Для YTKS может потребоваться серийный номер
            if (plugin === 'ytks' && keyObj.serialNumber) {
                args.push(keyObj.serialNumber);
            }

            _callFunction(
                { plugin, name: 'load_key', arguments: args },
                (event, data) => {
                    if (data.success) {
                        resolve(data.keyId);
                    } else {
                        reject(new Error(data.reason || 'Ошибка загрузки ключа'));
                    }
                },
                (err) => reject(new Error(err || 'Ошибка'))
            );
        });
    },

    /** Создать PKCS#7 подпись */
    createPkcs7: (keyId, dataToSign, detached = false) => {
        return new Promise((resolve, reject) => {
            const data64 = Base64.encode(dataToSign);
            _callFunction(
                { plugin: 'pkcs7', name: 'create_pkcs7', arguments: [data64, keyId, detached ? 'yes' : 'no'] },
                (event, data) => {
                    if (data.success) {
                        resolve(data.pkcs7_64);
                    } else {
                        reject(new Error(data.reason || 'Ошибка создания подписи'));
                    }
                },
                (err) => reject(new Error(err || 'Ошибка'))
            );
        });
    },

    /** Подписать файл (ArrayBuffer → base64 → PKCS#7) */
    signFile: (keyId, fileArrayBuffer, detached = false) => {
        return new Promise((resolve, reject) => {
            // ArrayBuffer → Base64
            const bytes = new Uint8Array(fileArrayBuffer);
            let binary = '';
            for (let i = 0; i < bytes.byteLength; i++) {
                binary += String.fromCharCode(bytes[i]);
            }
            const data64 = btoa(binary);

            _callFunction(
                { plugin: 'pkcs7', name: 'create_pkcs7', arguments: [data64, keyId, detached ? 'yes' : 'no'] },
                (event, data) => {
                    if (data.success) {
                        resolve(data.pkcs7_64);
                    } else {
                        reject(new Error(data.reason || 'Ошибка подписания файла'));
                    }
                },
                (err) => reject(new Error(err || 'Ошибка'))
            );
        });
    },

    /** Подписать хэш (SHA-256 или другой) */
    signHash: (keyId, hashHex, detached = true) => {
        return new Promise((resolve, reject) => {
            // Hex → Base64
            const hash64 = btoa(hashHex.match(/\w{2}/g).map(a => String.fromCharCode(parseInt(a, 16))).join(''));
            
            _callFunction(
                { plugin: 'pkcs7', name: 'create_pkcs7', arguments: [hash64, keyId, detached ? 'yes' : 'no'] },
                (event, data) => {
                    if (data.success) {
                        resolve(data.pkcs7_64);
                    } else {
                        reject(new Error(data.reason || 'Ошибка подписания хэша'));
                    }
                },
                (err) => reject(new Error(err || 'Ошибка'))
            );
        });
    },

    /** Форматирование информации о ключе для отображения */
    formatKeyInfo: (key) => {
        const parts = [];
        if (key.CN) parts.push(key.CN);
        if (key.O) parts.push(key.O);
        if (key.TIN) parts.push(`ИНН: ${key.TIN}`);
        if (key.PINFL) parts.push(`ПИНФЛ: ${key.PINFL}`);
        
        let storageType = 'PFX';
        switch(key.plugin) {
            case 'ytks': storageType = 'YTKS'; break;
            case 'baikey': storageType = 'BAIK-Token'; break;
            case 'uzgrd': storageType = 'UZGUARD'; break;
            case 'idcard': storageType = 'ID-Card'; break;
            case 'ckc': storageType = 'CKC'; break;
        }

        return {
            title: key.CN || key.name || 'Ключ ЭЦП',
            subtitle: key.O || '',
            tin: key.TIN || '',
            pinfl: key.PINFL || '',
            validFrom: key.validFrom || '',
            validTo: key.validTo || '',
            serialNumber: key.serialNumber || '',
            fullInfo: parts.join(' | '),
            storageType: storageType
        };
    }
};

export default EImzoService;
export { Base64 };
