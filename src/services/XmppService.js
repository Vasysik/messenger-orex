import { Platform } from 'react-native';
import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';
import { client, xml } from '@xmpp/client';
import EventEmitter from 'events';
import StorageService from './StorageService';
import MessageStorageService from './MessageStorageService'; // Импорт нового сервиса

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
        this.lastMessages = {};
        this.unreadCounts = {};
        this.presenceMap = {};
        this.userJid = '';
        this.userPassword = '';
        this.reconnectTimer = null;
        this.lastReadMessageId = {};
        this.uploadService = null;
        this.loadLastReadStatuses();
    }

    async loadLastReadStatuses() {
        try {
            const saved = await StorageService.getItem('lastReadMessages');
            if (saved) this.lastReadMessageId = JSON.parse(saved);
        } catch (e) { console.log('Failed to load last read statuses:', e); }
    }

    async saveLastReadStatuses() {
        try {
            await StorageService.setItem('lastReadMessages', JSON.stringify(this.lastReadMessageId));
        } catch (e) { console.log('Failed to save last read statuses:', e); }
    }
    
    setLastReadMessage(contactJid, msgId) {
        const bareJid = contactJid.split('/')[0];
        this.lastReadMessageId[bareJid] = msgId;
        this.saveLastReadStatuses();
    }

    getLastReadMessageId(contactJid) {
        return this.lastReadMessageId[contactJid.split('/')[0]] || null;
    }

    // --- Метод загрузки файла (оставлен без изменений) ---
    async uploadFile(uri) {
        try {
            if (!this.uploadService) await this.discoverUploadService();
            const getBlobFromUri = async (uri) => {
                return new Promise((resolve, reject) => {
                    const xhr = new XMLHttpRequest();
                    xhr.onload = () => resolve(xhr.response);
                    xhr.onerror = (e) => reject(new Error('Failed to convert URI to Blob'));
                    xhr.responseType = 'blob';
                    xhr.open('GET', uri, true);
                    xhr.send(null);
                });
            };
            const blob = await getBlobFromUri(uri);
            let filename = 'file_' + Date.now();
            const fileType = blob.type || 'application/octet-stream';
            const size = blob.size;
            const id = 'upload_' + uuidv4();
            const iq = xml('iq', { to: this.uploadService, type: 'get', id },
                xml('request', { xmlns: 'urn:xmpp:http:upload:0', filename, size, 'content-type': fileType })
            );
            this.xmpp.send(iq);
            return new Promise((resolve) => {
                const onStanza = (stanza) => {
                    if (stanza.is('iq') && stanza.attrs.id === id) {
                        this.xmpp.off('stanza', onStanza);
                        if (stanza.attrs.type === 'error') return resolve(null);
                        const slot = stanza.getChild('slot', 'urn:xmpp:http:upload:0');
                        if (slot) {
                            const putUrl = slot.getChild('put').attrs.url;
                            const getUrl = slot.getChild('get').attrs.url;
                            const xhr = new XMLHttpRequest();
                            xhr.open('PUT', putUrl);
                            slot.getChild('put').getChildren('header').forEach(h => {
                                xhr.setRequestHeader(h.attrs.name, h.getText().trim());
                            });
                            xhr.setRequestHeader('Content-Type', fileType);
                            xhr.onload = () => (xhr.status >= 200 && xhr.status < 300) ? resolve(getUrl) : resolve(null);
                            xhr.onerror = () => resolve(null);
                            xhr.send(blob);
                        } else resolve(null);
                    }
                };
                this.xmpp.on('stanza', onStanza);
                setTimeout(() => { this.xmpp.off('stanza', onStanza); resolve(null); }, 30000);
            });
        } catch (e) { return null; }
    }

    async discoverUploadService() {
        const id = 'disco_' + uuidv4();
        const iq = xml('iq', { type: 'get', id }, xml('query', { xmlns: 'http://jabber.org/protocol/disco#items' }));
        this.xmpp.send(iq);
        return new Promise((resolve) => {
            const onStanza = (stanza) => {
                if (stanza.is('iq') && stanza.attrs.id === id) {
                    this.xmpp.off('stanza', onStanza);
                    const items = stanza.getChild('query')?.getChildren('item') || [];
                    const uploadItem = items.find(item => item.attrs.jid.includes('upload'));
                    if (uploadItem) this.uploadService = uploadItem.attrs.jid;
                    resolve();
                }
            };
            this.xmpp.on('stanza', onStanza);
        });
    }

    connect(jid, password) {
        if (this.xmpp) this.disconnect();
        this.userJid = jid;
        this.userPassword = password;
        const [local, domain] = jid.split('@');
        const cleanDomain = domain ? domain.split('/')[0] : '';
        const serviceUrl = `wss://${cleanDomain}:5281/xmpp-websocket`;
        
        this.xmpp = client({ service: serviceUrl, domain: cleanDomain, resource: 'mobile', username: local, password: password });

        this.xmpp.on('error', (err) => { this.emit('error', err); this.scheduleReconnect(); });
        this.xmpp.on('offline', () => { this.isConnected = false; this.scheduleReconnect(); });
        this.xmpp.on('status', (status) => {
            this.isConnected = (status === 'online');
            this.emit('status', status);
        });

        this.xmpp.on('online', async (address) => {
            await this.xmpp.send(xml('presence'));
            this.discoverUploadService();
            this.emit('online', address);
            setTimeout(() => this.loadAllHistoryFromStorage(), 500);
        });

        this.xmpp.on('stanza', async (stanza) => {
            const from = stanza.attrs.from?.split('/')[0];

            if (stanza.is('presence')) {
                if (stanza.attrs.type === 'subscribe') await this.xmpp.send(xml('presence', { to: from, type: 'subscribed' }));
                else if (stanza.attrs.type === 'unavailable') this.presenceMap[from] = 'offline';
                else if (!stanza.attrs.type && from !== this.userJid.split('/')[0]) this.presenceMap[from] = 'online';
                this.emit('presence_update', { jid: from, status: this.presenceMap[from] });
            }

            if (stanza.is('message')) {
                // Обработка статусов печати и прочтения
                const composing = stanza.getChild('composing', 'http://jabber.org/protocol/chatstates');
                if (composing) this.emit('typing', { jid: from, isTyping: true });
                else if (stanza.getChild('active') || stanza.getChild('paused')) this.emit('typing', { jid: from, isTyping: false });
                
                const displayed = stanza.getChild('displayed', 'urn:xmpp:chat-markers:0');
                if (displayed) {
                    this.setLastReadMessage(from, displayed.attrs.id);
                    this.emit('read_update', { msgId: displayed.attrs.id, contactJid: from });
                }

                // Обработка тела сообщения
                if (stanza.getChild('body')) {
                    const msgId = stanza.attrs.id || uuidv4();
                    const body = stanza.getChildText('body');
                    const timestamp = new Date();
                    
                    const newMsg = { id: msgId, from, body, timestamp, type: 'in' };
                    
                    // СОХРАНЯЕМ В ЛОКАЛЬНУЮ БАЗУ
                    await MessageStorageService.saveMessages(from, [newMsg]);

                    this.lastMessages[from] = { body, timestamp, type: 'in' };
                    this.unreadCounts[from] = (this.unreadCounts[from] || 0) + 1;
                    
                    if (stanza.getChild('request', 'urn:xmpp:receipts')) {
                        await this.xmpp.send(xml('message', { to: stanza.attrs.from, type: 'chat', id: uuidv4() },
                            xml('received', { xmlns: 'urn:xmpp:receipts', id: msgId })
                        ));
                    }
                    this.emit('message', newMsg);
                    this.emit('last_message_update', from);
                }
            }
            if (stanza.is('iq') && stanza.attrs.type === 'set' && stanza.getChild('query', 'jabber:iq:roster')) {
                this.emit('roster_update');
            }
        });
        this.xmpp.start().catch(() => this.scheduleReconnect());
    }

    scheduleReconnect() {
        if (this.reconnectTimer) return;
        this.reconnectTimer = setTimeout(() => {
            this.reconnectTimer = null;
            if (this.userJid && this.userPassword) this.connect(this.userJid, this.userPassword);
        }, 5000);
    }
    
    // Загрузка последних сообщений для списка чатов из локальной базы
    async loadAllHistoryFromStorage() {
        const roster = await this.getRoster();
        for (const contact of roster) {
            const msgs = await MessageStorageService.getMessages(contact.jid);
            if (msgs.length > 0) {
                const last = msgs[msgs.length - 1];
                this.lastMessages[contact.jid] = { body: last.body, timestamp: last.timestamp, type: last.type };
                this.emit('last_message_update', contact.jid);
            }
        }
    }

    markAsRead(jid, msgId) {
        if (!this.isConnected || !msgId) return;
        this.clearUnread(jid);
        this.xmpp.send(xml('message', { to: jid, type: 'chat', id: uuidv4() },
            xml('displayed', { xmlns: 'urn:xmpp:chat-markers:0', id: msgId })
        ));
    }

    getLastMessage(jid) { return this.lastMessages[jid.split('/')[0]] || null; }
    getUnreadCount(jid) { return this.unreadCounts[jid.split('/')[0]] || 0; }
    clearUnread(jid) { this.unreadCounts[jid.split('/')[0]] = 0; }
    getPresence(jid) { return this.presenceMap[jid.split('/')[0]] || 'offline'; }

    sendTypingStatus(to, isTyping) {
        if (!this.isConnected) return;
        this.xmpp.send(xml('message', { to, type: 'chat' },
            xml(isTyping ? 'composing' : 'active', { xmlns: 'http://jabber.org/protocol/chatstates' })
        ));
    }

    sendMessage(to, text) {
        if (!this.isConnected) return null;
        const id = uuidv4();
        const timestamp = new Date();
        this.xmpp.send(xml('message', { to, type: 'chat', id },
            xml('body', {}, text),
            xml('request', { xmlns: 'urn:xmpp:receipts' }),
            xml('markable', { xmlns: 'urn:xmpp:chat-markers:0' }),
            xml('active', { xmlns: 'http://jabber.org/protocol/chatstates' })
        ));
        const bareJid = to.split('/')[0];
        const newMsg = { id, body: text, timestamp, type: 'out' };
        
        // СОХРАНЯЕМ ИСХОДЯЩЕЕ ЛОКАЛЬНО
        MessageStorageService.saveMessages(bareJid, [newMsg]);

        this.lastMessages[bareJid] = { body: text, timestamp, type: 'out' };
        this.emit('last_message_update', bareJid);
        return id;
    }

    // УМНЫЙ ЗАПРОС ИСТОРИИ: локальные + докачка с MAM
    async fetchHistory(withJid) {
        const bareJid = withJid.split('/')[0];
        
        // 1. Сначала отдаем то, что есть в телефоне (мгновенно)
        const localMessages = await MessageStorageService.getMessages(bareJid);
        
        if (!this.isConnected) return localMessages;

        // 2. Запрашиваем историю у сервера
        // Мы НЕ используем 'after', чтобы не пропустить сообщения из других веток (threads)
        // Мы просим последние 100 сообщений. Наш saveMessages сам отсеет дубликаты.
        const id = 'sync_mam_' + uuidv4();

        const queryFields = [
            xml('field', { var: 'FORM_TYPE', type: 'hidden' }, xml('value', {}, 'urn:xmpp:mam:2')),
            xml('field', { var: 'with' }, xml('value', {}, bareJid))
        ];

        const iq = xml('iq', { type: 'set', id },
            xml('query', { xmlns: 'urn:xmpp:mam:2' },
                xml('x', { xmlns: 'jabber:x:data', type: 'submit' }, ...queryFields),
                xml('set', { xmlns: 'http://jabber.org/protocol/rsm' }, 
                    xml('max', {}, '100'), // Берем пачку побольше
                    xml('before', {}, '')  // Начиная с самых свежих и назад
                )
            )
        );

        return new Promise((resolve) => {
            const fetched = [];
            const onStanza = (stanza) => {
                if (stanza.is('message')) {
                    const result = stanza.getChild('result', 'urn:xmpp:mam:2');
                    if (result) {
                        const msg = result.getChild('forwarded', 'urn:xmpp:forward:0')?.getChild('message');
                        const body = msg?.getChildText('body');
                        const delay = result.getChild('forwarded', 'urn:xmpp:forward:0')?.getChild('delay', 'urn:xmpp:delay');
                        if (body) {
                            const fromJid = msg.attrs.from.split('/')[0];
                            fetched.push({
                                id: result.attrs.id || msg.attrs.id || uuidv4(),
                                body,
                                from: fromJid,
                                timestamp: delay ? delay.attrs.stamp : new Date().toISOString(),
                                type: fromJid === this.userJid.split('/')[0] ? 'out' : 'in'
                            });
                        }
                    }
                }
                if (stanza.is('iq') && stanza.attrs.id === id) {
                    this.xmpp.off('stanza', onStanza);
                    // Сохраняем пачку в базу. Она сама сопоставит ID и отсортирует по времени.
                    MessageStorageService.saveMessages(bareJid, fetched).then(() => {
                        MessageStorageService.getMessages(bareJid).then(resolve);
                    });
                }
            };
            this.xmpp.on('stanza', onStanza);
            this.xmpp.send(iq);
            // Если сервер тупит, отдаем что было в локалке через 5 сек
            setTimeout(() => { this.xmpp.off('stanza', onStanza); resolve(localMessages); }, 5000);
        });
    }

    async processAndResolve(jid, newMsgs, resolve) {
        await MessageStorageService.saveMessages(jid, newMsgs);
        const all = await MessageStorageService.getMessages(jid);
        resolve(all);
    }

    async getRoster() {
        if (!this.isConnected) return [];
        const id = 'roster_' + uuidv4();
        this.xmpp.send(xml('iq', { type: 'get', id }, xml('query', { xmlns: 'jabber:iq:roster' })));
        return new Promise((resolve) => {
            const onStanza = (stanza) => {
                if (stanza.is('iq') && stanza.attrs.id === id) {
                    this.xmpp.off('stanza', onStanza);
                    const items = stanza.getChild('query')?.getChildren('item') || [];
                    resolve(items.map(i => ({ jid: i.attrs.jid, name: i.attrs.name || i.attrs.jid.split('@')[0] })));
                }
            };
            this.xmpp.on('stanza', onStanza);
        });
    }

    addContact(jid) {
        if (!this.isConnected) return;
        this.xmpp.send(xml('presence', { to: jid, type: 'subscribe' }));
        this.xmpp.send(xml('iq', { type: 'set', id: 'add_' + uuidv4() },
            xml('query', { xmlns: 'jabber:iq:roster' }, xml('item', { jid, name: jid.split('@')[0] }))
        ));
    }

    disconnect() {
        if (this.reconnectTimer) { clearTimeout(this.reconnectTimer); this.reconnectTimer = null; }
        if (this.xmpp) { this.xmpp.stop().catch(() => {}); this.xmpp = null; this.isConnected = false; }
    }
}

export default new XmppService();
