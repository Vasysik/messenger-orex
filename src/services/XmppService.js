import { Platform } from 'react-native';
import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';
import { client, xml } from '@xmpp/client';
import EventEmitter from 'events';

if (typeof global.process === 'undefined') global.process = require('process');
if (typeof global.Buffer === 'undefined') global.Buffer = require('buffer').Buffer;
if (Platform.OS !== 'web') {
    const { URL } = require('react-native-url-polyfill');
    global.URL = URL;
}
if (!global.crypto) global.crypto = {};
if (!global.crypto.randomUUID) global.crypto.randomUUID = uuidv4;

class XmppService extends EventEmitter {
    constructor() {
        super();
        this.xmpp = null;
        this.isConnected = false;
    }

    connect(jid, password) {
        if (this.xmpp) this.disconnect();
        console.log("Попытка подключения к:", jid);

        const [local, domain] = jid.split('@');
        const cleanDomain = domain ? domain.split('/')[0] : '';
        const serviceUrl = `wss://${cleanDomain}:5281/xmpp-websocket`;
        
        this.xmpp = client({
            service: serviceUrl,
            domain: cleanDomain,
            resource: 'orekh-mobile',
            username: local,
            password: password,
        });

        this.xmpp.on('error', (err) => {
            console.error('❌ XMPP Error:', err.message);
            this.emit('error', err);
        });
        
        this.xmpp.on('status', (status) => {
            console.log('📡 Статус:', status);
            this.isConnected = (status === 'online');
            this.emit('status', status);
        });

        this.xmpp.on('online', async (address) => {
            console.log('✅ В сети как:', address.toString());
            await this.xmpp.send(xml('presence'));
            this.emit('online', address);
        });

        this.xmpp.on('stanza', async (stanza) => {
            console.log('📩 Входящая станза:', stanza.toString());

            // 1. Обработка запросов на подписку (Авто-добавление)
            if (stanza.is('presence') && stanza.attrs.type === 'subscribe') {
                const from = stanza.attrs.from;
                console.log('🤝 Запрос дружбы от:', from);
                // Автоматически подтверждаем подписку
                await this.xmpp.send(xml('presence', { to: from, type: 'subscribed' }));
                // И подписываемся в ответ
                await this.xmpp.send(xml('presence', { to: from, type: 'subscribe' }));
                this.emit('roster_update');
            }

            // 2. Обработка сообщений
            if (stanza.is('message') && stanza.getChild('body')) {
                if (stanza.getChild('result', 'urn:xmpp:mam:2')) return;

                const messageData = {
                    id: stanza.attrs.id || uuidv4(),
                    from: stanza.attrs.from.split('/')[0],
                    body: stanza.getChildText('body'),
                    timestamp: new Date(),
                };
                console.log('💬 Новое сообщение:', messageData);
                this.emit('message', messageData);
            }

            // 3. Обработка обновления ростера сервером
            if (stanza.is('iq') && stanza.attrs.type === 'set' && stanza.getChild('query', 'jabber:iq:roster')) {
                console.log('🔄 Ростер обновился на сервере');
                this.emit('roster_update');
            }
        });

        this.xmpp.start().catch((e) => console.error("Ошибка старта:", e));
    }

    async fetchHistory(withJid) {
        if (!this.isConnected) return [];
        const bareJid = withJid.split('/')[0];
        console.log('📜 Запрос истории MAM для:', bareJid);
        
        const id = 'mam_' + uuidv4();
        
        const iq = xml('iq', { type: 'set', id },
            xml('query', { xmlns: 'urn:xmpp:mam:2' },
                xml('x', { xmlns: 'jabber:x:data', type: 'submit' },
                    xml('field', { var: 'FORM_TYPE', type: 'hidden' }, 
                        xml('value', {}, 'urn:xmpp:mam:2')
                    ),
                    xml('field', { var: 'with' }, 
                        xml('value', {}, bareJid)
                    )
                ),
                xml('set', { xmlns: 'http://jabber.org/protocol/rsm' },
                    xml('max', {}, '50')
                )
            )
        );

        return new Promise((resolve) => {
            const history = [];
            
            const onStanza = (stanza) => {
                // Ищем тег <result> внутри <message>
                if (stanza.is('message')) {
                    const result = stanza.getChild('result');
                    if (result && (result.attrs.xmlns === 'urn:xmpp:mam:2' || result.attrs.xmlns === 'urn:xmpp:mam:1')) {
                        
                        const forwarded = result.getChild('forwarded');
                        const msg = forwarded?.getChild('message');
                        const body = msg?.getChildText('body');
                        const delay = forwarded?.getChild('delay');

                        if (body) {
                            history.push({
                                id: result.attrs.id || uuidv4(),
                                body: body,
                                from: msg.attrs.from.split('/')[0],
                                timestamp: delay ? new Date(delay.attrs.stamp) : new Date(),
                                // Если сообщение пришло от того, с кем мы в чате - оно входящее (in)
                                type: msg.attrs.from.split('/')[0] === bareJid ? 'in' : 'out'
                            });
                        }
                    }
                }

                // Ждем финальный IQ результат
                if (stanza.is('iq') && stanza.attrs.id === id) {
                    this.xmpp.off('stanza', onStanza);
                    console.log(`🎬 Финиш MAM! Сообщений в базе: ${history.length}`);
                    resolve(history.sort((a, b) => a.timestamp - b.timestamp));
                }
            };

            this.xmpp.on('stanza', onStanza);
            this.xmpp.send(iq);

            // Страховка
            setTimeout(() => {
                this.xmpp.off('stanza', onStanza);
                resolve(history);
            }, 5000);
        });
    }

    async getRoster() {
        if (!this.isConnected) return [];
        const id = 'roster_' + uuidv4();
        const iq = xml('iq', { type: 'get', id }, xml('query', { xmlns: 'jabber:iq:roster' }));

        return new Promise((resolve) => {
            const onStanza = (stanza) => {
                if (stanza.is('iq') && stanza.attrs.id === id) {
                    this.xmpp.off('stanza', onStanza);
                    if (stanza.attrs.type === 'result') {
                        const query = stanza.getChild('query');
                        const items = query ? query.getChildren('item') : [];
                        console.log('👥 Загружен ростер:', items.length, 'контактов');
                        resolve(items.map(item => ({
                            jid: item.attrs.jid,
                            name: item.attrs.name || item.attrs.jid.split('@')[0],
                        })));
                    } else resolve([]);
                }
            };
            this.xmpp.on('stanza', onStanza);
            this.xmpp.send(iq);
        });
    }

    addContact(jid) {
        if (!this.isConnected) return;
        console.log('➕ Добавление контакта и подписка на:', jid);
        this.xmpp.send(xml('presence', { to: jid, type: 'subscribe' }));
        const iq = xml('iq', { type: 'set', id: 'add_' + uuidv4() },
            xml('query', { xmlns: 'jabber:iq:roster' },
                xml('item', { jid: jid, name: jid.split('@')[0] })
            )
        );
        this.xmpp.send(iq);
    }

    sendMessage(to, text) {
        if (!this.isConnected) return;
        const id = uuidv4();
        console.log('📤 Отправка сообщения для:', to);
        const message = xml('message', { to, type: 'chat', id }, xml('body', {}, text));
        this.xmpp.send(message);
    }

    disconnect() {
        if (this.xmpp) {
            this.xmpp.stop().catch(() => {});
            this.xmpp = null;
            this.isConnected = false;
        }
    }
}

export default new XmppService();
