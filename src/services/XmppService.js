// ================= POLYFILLS START =================
// 1. Подключаем генератор случайных чисел
import 'react-native-get-random-values';

// 2. Подключаем библиотеку UUID
import { v4 as uuidv4 } from 'uuid';

// 3. Полифилл для URL (чтобы работали ws:// ссылки)
import { URL } from 'react-native-url-polyfill';
global.URL = URL;

// 4. Добавляем process и Buffer (нужны для xmpp.js)
global.process = require('process');
global.Buffer = require('buffer').Buffer;

// 5. САМОЕ ГЛАВНОЕ: Чиним randomUUID
if (!global.crypto) {
    global.crypto = {};
}
if (!global.crypto.randomUUID) {
    // Говорим: "Если кто-то попросит randomUUID, используй функцию uuidv4"
    global.crypto.randomUUID = uuidv4; 
}
// ================= POLYFILLS END =================

import { client, xml } from '@xmpp/client';

class XmppService {
    constructor() {
        this.xmpp = null;
    }

    connect(jid, password) {
        if (!jid || !password) return;

        console.log(`🔌 Подключаемся к ${jid}...`);

        const [local, domain] = jid.split('@');

        // Убираем '/resource', если юзер его ввел, чтобы не дублировать
        const cleanDomain = domain.split('/')[0];

        try {
            this.xmpp = client({
                service: `ws://${cleanDomain}:5280/xmpp-websocket`,
                domain: cleanDomain,
                resource: 'orekh-mobile',
                username: local,
                password: password,
            });

            this.xmpp.on('error', (err) => {
                console.error('❌ XMPP Error:', err);
            });

            this.xmpp.on('offline', () => {
                console.log('zzz Офлайн');
            });

            this.xmpp.on('status', (status) => {
                console.log('ℹ️ Статус соединения:', status);
            });

            this.xmpp.on('online', async (address) => {
                console.log('✅ ОРЕХ В СЕТИ! Адрес:', address.toString());
                // Отправляем всем "Привет, я тут"
                await this.xmpp.send(xml('presence'));
            });
            
            // Ловим входящие сообщения (для теста)
            this.xmpp.on('stanza', async (stanza) => {
                if (stanza.is('message')) {
                    console.log('📩 Входящее:', stanza.toString());
                }
            });

            this.xmpp.start().catch((e) => {
                console.error('❌ Ошибка старта:', e);
            });

        } catch (e) {
            console.error('🔥 Критическая ошибка в connect:', e);
        }
    }
}

export default new XmppService();
