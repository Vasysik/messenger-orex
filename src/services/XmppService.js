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

        this.xmpp.on('error', (err) => this.emit('error', err));
        this.xmpp.on('status', (status) => this.emit('status', status));
        this.xmpp.on('online', async (address) => {
            await this.xmpp.send(xml('presence'));
            this.emit('online', address);
        });
        this.xmpp.on('stanza', (stanza) => this.emit('stanza', stanza));
        this.xmpp.start().catch((e) => this.emit('error', e));
    }

    disconnect() {
        if (this.xmpp) {
            this.xmpp.stop().catch(() => {});
            this.xmpp = null;
        }
        this.emit('status', 'disconnect');
    }
}

export default new XmppService();
