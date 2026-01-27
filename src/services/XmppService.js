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
            console.error('XMPP Error:', err);
            this.emit('error', err);
        });

        this.xmpp.on('online', async (address) => {
            this.isConnected = true;
            await this.xmpp.send(xml('presence'));
            this.emit('online', address);
        });

        this.xmpp.on('stanza', (stanza) => {
            if (stanza.is('message') && stanza.getChild('body')) {
                const messageData = {
                    id: stanza.attrs.id || Math.random().toString(),
                    from: stanza.attrs.from.split('/')[0],
                    body: stanza.getChildText('body'),
                    timestamp: new Date(),
                };
                this.emit('message', messageData);
            }
            this.emit('stanza', stanza);
        });

        this.xmpp.start().catch((e) => this.emit('error', e));
    }

    async getRoster() {
        const id = 'roster_' + Math.random().toString(36).substr(2, 9);
        const iq = xml('iq', { type: 'get', id }, xml('query', { xmlns: 'jabber:iq:roster' }));
        
        const response = await this.xmpp.sendIQ(iq);
        const items = response.getChild('query').getChildren('item');
        
        return items.map(item => ({
            jid: item.attrs.jid,
            name: item.attrs.name || item.attrs.jid.split('@')[0],
            subscription: item.attrs.subscription
        }));
    }

    sendMessage(to, text) {
        if (!this.isConnected) return;
        const message = xml(
            'message',
            { to, type: 'chat', id: uuidv4() },
            xml('body', {}, text)
        );
        this.xmpp.send(message);
    }

    disconnect() {
        if (this.xmpp) {
            this.xmpp.stop().catch(() => {});
            this.xmpp = null;
            this.isConnected = false;
        }
        this.emit('status', 'disconnect');
    }
}

export default new XmppService();
