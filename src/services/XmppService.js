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
        this.lastMessages = {};
        this.unreadCounts = {};
        this.presenceMap = {};
        this.typingMap = {};
        this.deliveryStatus = {}; 
        this.readStatus = {};
        this.userJid = '';
        this.userPassword = '';
        this.reconnectTimer = null;
        this.reconnectAttempts = 0;
    }

    connect(jid, password) {
        if (this.xmpp) this.disconnect();
        this.userJid = jid;
        this.userPassword = password;
        this.reconnectAttempts = 0;

        const [local, domain] = jid.split('@');
        const cleanDomain = domain ? domain.split('/')[0] : '';
        const serviceUrl = `wss://${cleanDomain}:5281/xmpp-websocket`;
        
        this.xmpp = client({
            service: serviceUrl,
            domain: cleanDomain,
            resource: 'mobile',
            username: local,
            password: password,
        });

        this.xmpp.on('error', (err) => {
            console.log('XMPP Error:', err);
            this.emit('error', err);
            this.scheduleReconnect();
        });

        this.xmpp.on('offline', () => {
            console.log('XMPP Offline');
            this.isConnected = false;
            this.scheduleReconnect();
        });
        
        this.xmpp.on('status', (status) => {
            console.log('XMPP Status:', status);
            this.isConnected = (status === 'online');
            if (this.isConnected) {
                this.reconnectAttempts = 0;
                if (this.reconnectTimer) {
                    clearTimeout(this.reconnectTimer);
                    this.reconnectTimer = null;
                }
            }
            this.emit('status', status);
        });

        this.xmpp.on('online', async (address) => {
            console.log('XMPP Online:', address);
            await this.xmpp.send(xml('presence'));
            this.emit('online', address);
            setTimeout(() => this.loadAllHistory(), 1000);
        });

        this.xmpp.on('stanza', async (stanza) => {
            const from = stanza.attrs.from?.split('/')[0];

            if (stanza.is('presence')) {
                if (stanza.attrs.type === 'subscribe') {
                    await this.xmpp.send(xml('presence', { to: from, type: 'subscribed' }));
                } else if (stanza.attrs.type === 'unavailable') {
                    this.presenceMap[from] = 'offline';
                } else if (!stanza.attrs.type && from !== this.userJid) {
                    this.presenceMap[from] = 'online';
                }
                this.emit('presence_update', { jid: from, status: this.presenceMap[from] });
            }

            if (stanza.is('message')) {
                const composing = stanza.getChild('composing', 'http://jabber.org/protocol/chatstates');
                const active = stanza.getChild('active', 'http://jabber.org/protocol/chatstates');
                
                if (composing) {
                    this.typingMap[from] = true;
                    this.emit('typing', { jid: from, isTyping: true });
                } else if (active || stanza.getChild('paused')) {
                    this.typingMap[from] = false;
                    this.emit('typing', { jid: from, isTyping: false });
                }

                const received = stanza.getChild('received', 'urn:xmpp:receipts');
                if (received) {
                    const msgId = received.attrs.id;
                    this.deliveryStatus[msgId] = 'delivered';
                    this.emit('delivery_update', { msgId, status: 'delivered' });
                }

                const displayed = stanza.getChild('displayed', 'urn:xmpp:chat-markers:0');
                if (displayed) {
                    const msgId = displayed.attrs.id;
                    this.readStatus[msgId] = true;
                    this.deliveryStatus[msgId] = 'read';
                    this.emit('read_update', { msgId, status: 'read' });
                }

                if (stanza.getChild('body')) {
                    const msgId = stanza.attrs.id || uuidv4();
                    const body = stanza.getChildText('body');
                    
                    this.lastMessages[from] = { body, timestamp: new Date(), type: 'in' };
                    this.unreadCounts[from] = (this.unreadCounts[from] || 0) + 1;

                    if (stanza.getChild('request', 'urn:xmpp:receipts')) {
                        await this.xmpp.send(xml('message', { to: stanza.attrs.from, type: 'chat', id: uuidv4() },
                            xml('received', { xmlns: 'urn:xmpp:receipts', id: msgId })
                        ));
                    }
                    
                    this.emit('message', { id: msgId, from, body, timestamp: new Date() });
                    this.emit('last_message_update', from);
                }
            }

            if (stanza.is('iq') && stanza.attrs.type === 'set' && stanza.getChild('query', 'jabber:iq:roster')) {
                this.emit('roster_update');
            }
        });

        this.xmpp.start().catch((err) => {
            console.error('Failed to start XMPP:', err);
            this.scheduleReconnect();
        });
    }

    scheduleReconnect() {
        if (this.reconnectTimer) return;
        if (this.reconnectAttempts >= 10) return;

        this.reconnectAttempts++;
        const delay = Math.min(this.reconnectAttempts * 2000, 30000);

        console.log(`Scheduling reconnect in ${delay}ms (attempt ${this.reconnectAttempts})`);
        
        this.reconnectTimer = setTimeout(() => {
            this.reconnectTimer = null;
            if (this.userJid && this.userPassword) {
                console.log('Attempting to reconnect...');
                this.connect(this.userJid, this.userPassword);
            }
        }, delay);
    }

    async loadAllHistory() {
        const roster = await this.getRoster();
        for (const contact of roster) {
            const history = await this.fetchHistory(contact.jid);
            if (history.length > 0) {
                const last = history[history.length - 1];
                this.lastMessages[contact.jid] = {
                    body: last.body,
                    timestamp: last.timestamp,
                    type: last.type
                };
                this.emit('last_message_update', contact.jid);
            }
        }
    }

    getMessageStatus(msgId) {
        return this.deliveryStatus[msgId] || 'sent';
    }

    markAsRead(jid, msgId) {
        if (!this.isConnected || !msgId) return;
        this.clearUnread(jid);
        // Отправляем маркер прочтения
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
        this.xmpp.send(xml('message', { to, type: 'chat', id },
            xml('body', {}, text),
            xml('request', { xmlns: 'urn:xmpp:receipts' }),
            xml('markable', { xmlns: 'urn:xmpp:chat-markers:0' }),
            xml('active', { xmlns: 'http://jabber.org/protocol/chatstates' })
        ));
        const bareJid = to.split('/')[0];
        this.lastMessages[bareJid] = { body: text, timestamp: new Date(), type: 'out' };
        this.deliveryStatus[id] = 'sent';
        this.emit('last_message_update', bareJid);
        return id;
    }

    async fetchHistory(withJid) {
        if (!this.isConnected) return [];
        const bareJid = withJid.split('/')[0];
        const id = 'mam_' + uuidv4();
        const iq = xml('iq', { type: 'set', id },
            xml('query', { xmlns: 'urn:xmpp:mam:2' },
                xml('x', { xmlns: 'jabber:x:data', type: 'submit' },
                    xml('field', { var: 'FORM_TYPE', type: 'hidden' }, xml('value', {}, 'urn:xmpp:mam:2')),
                    xml('field', { var: 'with' }, xml('value', {}, bareJid))
                ),
                xml('set', { xmlns: 'http://jabber.org/protocol/rsm' }, xml('max', {}, '50'))
            )
        );

        return new Promise((resolve) => {
            const historyMap = new Map();
            const onStanza = (stanza) => {
                if (stanza.is('message')) {
                    const result = stanza.getChild('result', 'urn:xmpp:mam:2');
                    if (result) {
                        const msg = result.getChild('forwarded', 'urn:xmpp:forward:0')?.getChild('message');
                        const body = msg?.getChildText('body');
                        const delay = result.getChild('forwarded', 'urn:xmpp:forward:0')?.getChild('delay', 'urn:xmpp:delay');
                        if (body) {
                            const msgId = msg.attrs.id || result.attrs.id || uuidv4();
                            const isOut = msg.attrs.from.split('/')[0] !== bareJid;
                            if (!historyMap.has(msgId)) {
                                historyMap.set(msgId, {
                                    id: msgId,
                                    body,
                                    from: msg.attrs.from.split('/')[0],
                                    timestamp: delay ? new Date(delay.attrs.stamp) : new Date(),
                                    type: isOut ? 'out' : 'in',
                                    status: 'delivered'
                                });
                            }
                        }
                    }
                }
                if (stanza.is('iq') && stanza.attrs.id === id) {
                    this.xmpp.off('stanza', onStanza);
                    const history = Array.from(historyMap.values()).sort((a, b) => a.timestamp - b.timestamp);
                    resolve(history);
                }
            };
            this.xmpp.on('stanza', onStanza);
            this.xmpp.send(iq);
            setTimeout(() => { 
                this.xmpp.off('stanza', onStanza); 
                resolve(Array.from(historyMap.values()).sort((a, b) => a.timestamp - b.timestamp)); 
            }, 5000);
        });
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
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
        if (this.xmpp) { 
            this.xmpp.stop().catch(() => {}); 
            this.xmpp = null; 
            this.isConnected = false; 
        }
    }
}

export default new XmppService();
