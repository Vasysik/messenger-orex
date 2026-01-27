import { Platform } from 'react-native';
import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';
import { client, xml } from '@xmpp/client';

if (typeof global.process === 'undefined') {
    global.process = require('process');
}
if (typeof global.Buffer === 'undefined') {
    global.Buffer = require('buffer').Buffer;
}

if (Platform.OS !== 'web') {
    const { URL } = require('react-native-url-polyfill');
    global.URL = URL;
}

if (!global.crypto) {
    global.crypto = {};
}
if (!global.crypto.randomUUID) {
    global.crypto.randomUUID = uuidv4; 
}

class XmppService {
    constructor() {
        this.xmpp = null;
    }

    connect(jid, password) {
        if (!jid || !password) return;

        console.log(`🔌 Подключаемся к ${jid}...`);

        const [local, domain] = jid.split('@')

        const cleanDomain = domain ? domain.split('/')[0] : '';

        if (!cleanDomain) {
            console.error('❌ Некорректный домен в JID');
            return;
        }

        const serviceUrl = `wss://${cleanDomain}:5281/xmpp-websocket`;
        
        console.log(`🌐 URL сервиса: ${serviceUrl}`);

        try {
            this.xmpp = client({
                service: serviceUrl,
                domain: cleanDomain,
                resource: 'orekh-mobile',
                username: local,
                password: password,
                sasl: ['PLAIN'],
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
                await this.xmpp.send(xml('presence'));
            });
            
            this.xmpp.on('stanza', async (stanza) => {
                if (stanza.is('message')) {
                    console.log('📩 Входящее:', stanza.toString());
                }
            });

            this.xmpp.start().catch((e) => {
                console.error('❌ Ошибка старта (в promise):', e);
            });

        } catch (e) {
            console.error('🔥 Критическая ошибка в connect:', e);
        }
    }
}

export default new XmppService();
