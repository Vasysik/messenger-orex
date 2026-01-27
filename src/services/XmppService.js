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
    }

    connect(jid, password) {
        if (this.xmpp) this.disconnect();

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
            this.emit('error', err);
        });
        
        this.xmpp.on('status', (status) => {
            this.isConnected = (status === 'online');
            this.emit('status', status);
        });

        this.xmpp.on('online', async (address) => {
            await this.xmpp.send(xml('presence'));
            this.emit('online', address);
        });

        this.xmpp.on('stanza', async (stanza) => {
            if (stanza.is('presence') && stanza.attrs.type === 'subscribe') {
                const from = stanza.attrs.from;
                await this.xmpp.send(xml('presence', { to: from, type: 'subscribed' }));
                await this.xmpp.send(xml('presence', { to: from, type: 'subscribe' }));
                this.emit('roster_update');
            }

            if (stanza.is('message') && stanza.getChild('body')) {
                if (stanza.getChild('result', 'urn:xmpp:mam:2')) return;

                const fromJid = stanza.attrs.from.split('/')[0];
                const messageData = {
                    id: stanza.attrs.id || uuidv4(),
                    from: fromJid,
                    body: stanza.getChildText('body'),
                    timestamp: new Date(),
                };
                
                this.lastMessages[fromJid] = {
                    body: messageData.body,
                    timestamp: messageData.timestamp,
                    type: 'in'
                };
                this.unreadCounts[fromJid] = (this.unreadCounts[fromJid] || 0) + 1;
                
                this.emit('message', messageData);
                this.emit('last_message_update', fromJid);
            }

            if (stanza.is('iq') && stanza.attrs.type === 'set' && stanza.getChild('query', 'jabber:iq:roster')) {
                this.emit('roster_update');
            }
        });

        this.xmpp.start().catch(() => {});
    }

    getLastMessage(jid) {
        return this.lastMessages[jid.split('/')[0]] || null;
    }

    getUnreadCount(jid) {
        return this.unreadCounts[jid.split('/')[0]] || 0;
    }

    clearUnread(jid) {
        this.unreadCounts[jid.split('/')[0]] = 0;
    }

    async fetchHistory(withJid) {
        if (!this.isConnected) return [];
        const bareJid = withJid.split('/')[0];
        
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
                if (stanza.is('message')) {
                    const result = stanza.getChild('result');
                    if (result && (result.attrs.xmlns === 'urn:xmpp:mam:2' || result.attrs.xmlns === 'urn:xmpp:mam:1')) {
                        
                        const forwarded = result.getChild('forwarded');
                        const msg = forwarded?.getChild('message');
                        const body = msg?.getChildText('body');
                        const delay = forwarded?.getChild('delay');

                        if (body) {
                            const msgType = msg.attrs.from.split('/')[0] === bareJid ? 'in' : 'out';
                            history.push({
                                id: result.attrs.id || uuidv4(),
                                body: body,
                                from: msg.attrs.from.split('/')[0],
                                timestamp: delay ? new Date(delay.attrs.stamp) : new Date(),
                                type: msgType
                            });
                        }
                    }
                }

                if (stanza.is('iq') && stanza.attrs.id === id) {
                    this.xmpp.off('stanza', onStanza);
                    const sorted = history.sort((a, b) => a.timestamp - b.timestamp);
                    if (sorted.length > 0) {
                        const last = sorted[sorted.length - 1];
                        this.lastMessages[bareJid] = {
                            body: last.body,
                            timestamp: last.timestamp,
                            type: last.type
                        };
                    }
                    resolve(sorted);
                }
            };

            this.xmpp.on('stanza', onStanza);
            this.xmpp.send(iq);

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
        const message = xml('message', { to, type: 'chat', id }, xml('body', {}, text));
        this.xmpp.send(message);
        
        const bareJid = to.split('/')[0];
        this.lastMessages[bareJid] = {
            body: text,
            timestamp: new Date(),
            type: 'out'
        };
        this.emit('last_message_update', bareJid);
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
