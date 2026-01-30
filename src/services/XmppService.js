import { Platform } from 'react-native';
import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';
import { client, xml } from '@xmpp/client';
import EventEmitter from 'events';
import StorageService from './StorageService';
import MessageStorageService from './MessageStorageService';

if (typeof global.process === 'undefined') global.process = require('process');
if (typeof global.Buffer === 'undefined') global.Buffer = require('buffer').Buffer;
if (Platform.OS !== 'web') {
    const { URL } = require('react-native-url-polyfill');
    global.URL = URL;
}
if (!global.crypto) global.crypto = {};
if (!global.crypto.randomUUID) global.crypto.randomUUID = uuidv4;

const getBlobFromUri = async (uri) => {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.onload = function () {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(xhr.response);
      } else {
        reject(new Error(`XHR failed with status ${xhr.status}: ${xhr.statusText}`));
      }
    };
    xhr.onerror = function (e) {
      reject(new Error('Failed to convert URI to Blob (network error)'));
    };
    xhr.responseType = 'blob';
    xhr.open('GET', uri, true);
    xhr.send(null);
  });
};

class XmppService extends EventEmitter {
    constructor() {
        super();
        this.xmpp = null;
        this.isConnected = false;
        this.lastMessages = {};
        this.unreadCounts = {};
        this.presenceMap = {};
        this.fullJidMap = {};
        this.typingMap = {};
        this.userJid = '';
        this.userPassword = '';
        this.reconnectTimer = null;
        this.reconnectAttempts = 0;
        this.lastReadMessageId = {};
        this.uploadService = null;
        this.pendingCalls = {};
        this.activeCalls = {};
        
        this.lastSyncTime = {};
        this.syncInProgress = {};
        this.SYNC_COOLDOWN = 30000;
        
        this.loadLastReadStatuses();
    }

    async loadLastReadStatuses() {
        try {
            const saved = await StorageService.getItem('lastReadMessages');
            if (saved) this.lastReadMessageId = JSON.parse(saved);
        } catch (e) {}
    }

    async saveLastReadStatuses() {
        try {
            await StorageService.setItem('lastReadMessages', JSON.stringify(this.lastReadMessageId));
        } catch (e) {}
    }
    
    setLastReadMessage(contactJid, msgId) {
        const bareJid = contactJid.split('/')[0];
        this.lastReadMessageId[bareJid] = msgId;
        this.saveLastReadStatuses();
    }

    getLastReadMessageId(contactJid) {
        return this.lastReadMessageId[contactJid.split('/')[0]] || null;
    }

    sendJingleInitiate(toJid, callId, isVideo = false) {
        if (!this.isConnected) return;
        
        const bareJid = toJid.split('/')[0];
        const targetJid = this.fullJidMap[bareJid] || toJid;
        
        console.log('[Jingle] Target JID:', targetJid, '(bare:', bareJid, ')');
        
        if (!this.fullJidMap[bareJid]) {
            console.warn('[Jingle] No full JID known for', bareJid, '- user may be offline');
        }
        
        this.pendingCalls[callId] = { to: targetJid, toBarejid: bareJid, isVideo, isOutgoing: true };
        this.activeCalls[callId] = true;
        
        const iqId = 'jingle_init_' + callId;
        const iq = xml('iq', { to: targetJid, type: 'set', id: iqId },
            xml('jingle', { 
                xmlns: 'urn:xmpp:jingle:1', 
                action: 'session-initiate', 
                initiator: this.userJid,
                sid: callId 
            },
                xml('content', { creator: 'initiator', name: 'audio' },
                    xml('description', { xmlns: 'urn:xmpp:jingle:apps:rtp:1', media: 'audio' }),
                    xml('transport', { xmlns: 'urn:xmpp:jingle:transports:ice-udp:1' })
                )
            )
        );
        
        this.xmpp.send(iq);
        console.log('[Jingle] session-initiate sent to:', targetJid, 'callId:', callId);
    }

    sendJingleAccept(toJid, callId) {
        if (!this.isConnected) return;
        
        const iqId = 'jingle_accept_' + callId;
        const iq = xml('iq', { to: toJid, type: 'set', id: iqId },
            xml('jingle', { 
                xmlns: 'urn:xmpp:jingle:1', 
                action: 'session-accept', 
                responder: this.userJid,
                sid: callId 
            },
                xml('content', { creator: 'initiator', name: 'audio' },
                    xml('description', { xmlns: 'urn:xmpp:jingle:apps:rtp:1', media: 'audio' }),
                    xml('transport', { xmlns: 'urn:xmpp:jingle:transports:ice-udp:1' })
                )
            )
        );
        
        this.xmpp.send(iq);
        console.log('[Jingle] session-accept sent to:', toJid, 'callId:', callId);
    }

    sendJingleTerminate(toJid, callId, reason = 'success') {
        if (!this.isConnected) return;
        
        delete this.pendingCalls[callId];
        delete this.activeCalls[callId];
        
        const iqId = 'jingle_term_' + callId;
        const iq = xml('iq', { to: toJid, type: 'set', id: iqId },
            xml('jingle', { 
                xmlns: 'urn:xmpp:jingle:1', 
                action: 'session-terminate', 
                sid: callId 
            },
                xml('reason', {},
                    xml(reason, {})
                )
            )
        );
        
        this.xmpp.send(iq);
        console.log('[Jingle] session-terminate sent to:', toJid, 'callId:', callId, 'reason:', reason);
    }

    async uploadFile(uri, onProgress) {
        console.log('--- Начало загрузки файла ---');
        
        if (!this.isConnected) {
            console.error('Не подключен к XMPP. Загрузка невозможна.');
            return null;
        }
        
        try {
            if (!this.uploadService) {
                console.log('Upload service not discovered yet, attempting discovery...');
                await this.discoverUploadService();
                if (!this.uploadService) {
                    console.error('Upload service could not be discovered. Aborting upload.');
                    return null;
                }
            }
            
            if (onProgress) onProgress(5);
            
            const blob = await getBlobFromUri(uri);
            if (!blob || blob.size === 0) {
                console.error('Failed to get a valid Blob from URI:', uri);
                return null;
            }
            
            if (onProgress) onProgress(10);
            
            let filename = uuidv4();
            let fileType = blob.type || 'application/octet-stream';
            
            const mimeToExt = {
                'image/jpeg': 'jpeg',
                'image/jpg': 'jpg', 
                'image/png': 'png',
                'image/gif': 'gif',
                'image/webp': 'webp',
                'image/bmp': 'bmp',
                'image/heic': 'heic',
                'video/mp4': 'mp4',
                'video/webm': 'webm',
                'video/quicktime': 'mov',
                'audio/mpeg': 'mp3',
                'audio/mp3': 'mp3',
                'audio/wav': 'wav',
                'audio/ogg': 'ogg',
                'audio/m4a': 'm4a',
                'audio/x-m4a': 'm4a',
                'application/pdf': 'pdf',
                'application/zip': 'zip',
                'text/plain': 'txt',
            };
            
            const ext = mimeToExt[fileType] || fileType.split('/')[1] || 'bin';
            filename = `${filename}.${ext}`;

            const size = blob.size;
            console.log(`Запрашиваю слот на ${this.uploadService}: ${filename} (${size} bytes, ${fileType})`);

            const id = 'upload_slot_' + uuidv4();
            const iq = xml('iq', { to: this.uploadService, type: 'get', id },
                xml('request', { 
                    xmlns: 'urn:xmpp:http:upload:0', 
                    filename, 
                    size: size.toString(),
                    'content-type': fileType 
                })
            );

            return new Promise((resolve) => {
                let handled = false;
                
                const onSlotStanza = (stanza) => {
                    if (!stanza.is('iq') || stanza.attrs.id !== id) return;
                    if (handled) return;
                    
                    handled = true;
                    this.xmpp.off('stanza', onSlotStanza);
                    clearTimeout(timeoutId);

                    if (stanza.attrs.type === 'error') {
                        const errorEl = stanza.getChild('error');
                        const errorText = errorEl?.getChild('text')?.getText() || 
                                         errorEl?.children?.[0]?.name || 
                                         'Unknown error';
                        console.error('Ошибка IQ при запросе слота:', errorText);
                        return resolve(null);
                    }

                    const slot = stanza.getChild('slot', 'urn:xmpp:http:upload:0');
                    if (!slot) {
                        console.error('В ответе сервера нет элемента <slot>');
                        return resolve(null);
                    }

                    const putElement = slot.getChild('put');
                    const getElement = slot.getChild('get');
                    
                    if (!putElement || !getElement) {
                        console.error('В слоте нет put/get URL');
                        return resolve(null);
                    }

                    const putUrl = putElement.attrs.url;
                    const getUrl = getElement.attrs.url;
                    
                    console.log('Слот получен. PUT URL:', putUrl);
                    console.log('GET URL:', getUrl);
                    
                    if (onProgress) onProgress(15);

                    const xhr = new XMLHttpRequest();
                    xhr.open('PUT', putUrl, true);

                    putElement.getChildren('header').forEach(h => {
                        const headerName = h.attrs.name;
                        const headerValue = h.getText().trim();
                        if (headerName && headerValue) {
                            xhr.setRequestHeader(headerName, headerValue);
                            console.log(`  Header: ${headerName}: ${headerValue}`);
                        }
                    });

                    xhr.setRequestHeader('Content-Type', fileType);
                    console.log(`  Header: Content-Type: ${fileType}`);

                    xhr.upload.onprogress = (e) => {
                        if (e.lengthComputable && onProgress) {
                            const percent = Math.round(15 + (e.loaded / e.total) * 80);
                            onProgress(percent);
                        }
                    };

                    xhr.onload = () => {
                        if (xhr.status >= 200 && xhr.status < 300) {
                            console.log('Файл успешно загружен:', getUrl);
                            if (onProgress) onProgress(100);
                            resolve(getUrl);
                        } else {
                            console.error('Ошибка загрузки:', xhr.status, xhr.statusText);
                            console.error('Response:', xhr.responseText);
                            resolve(null);
                        }
                    };

                    xhr.onerror = (e) => {
                        console.error('Сетевая ошибка при PUT:', e);
                        resolve(null);
                    };

                    xhr.send(blob);
                };
                
                this.xmpp.on('stanza', onSlotStanza);
                this.xmpp.send(iq);
                
                const timeoutId = setTimeout(() => {
                    if (!handled) {
                        handled = true;
                        this.xmpp.off('stanza', onSlotStanza);
                        console.error('Таймаут ожидания слота (30с) для:', id);
                        resolve(null);
                    }
                }, 30000);
            });
        } catch (e) {
            console.error('Критическая ошибка uploadFile:', e);
            return null;
        }
    }

    async discoverUploadService() {
        console.log('Начинаю обнаружение службы HTTP Upload...');
        const userDomain = this.userJid.split('@')[1]?.split('/')[0] || this.xmpp.options.domain;
        
        const potentialUploadJid = `upload.${userDomain}`;
        const discoInfoId = 'disco_info_' + uuidv4();
        const iqInfo = xml('iq', { type: 'get', to: potentialUploadJid, id: discoInfoId },
            xml('query', { xmlns: 'http://jabber.org/protocol/disco#info' })
        );
        
        this.xmpp.send(iqInfo);
        console.log(`Отправлен disco#info запрос к: ${potentialUploadJid} (ID: ${discoInfoId})`);

        return new Promise((resolve) => {
            let resolved = false;
            
            const onDiscoInfoStanza = (stanza) => {
                if (stanza.is('iq') && stanza.attrs.id === discoInfoId) {
                    if (resolved) return;
                    resolved = true;
                    this.xmpp.off('stanza', onDiscoInfoStanza);

                    if (stanza.attrs.type === 'result') {
                        const features = stanza.getChild('query', 'http://jabber.org/protocol/disco#info')?.getChildren('feature') || [];
                        const supportsUpload = features.some(f => f.attrs['var'] === 'urn:xmpp:http:upload:0');
                        if (supportsUpload) {
                            this.uploadService = potentialUploadJid;
                            console.log("Обнаружена служба HTTP Upload (disco#info):", this.uploadService);
                            return resolve();
                        }
                    }
                    console.log(`Служба HTTP Upload не найдена на ${potentialUploadJid} или не поддерживает 'urn:xmpp:http:upload:0'.`);
                    performItemsDiscovery();
                }
            };
            this.xmpp.on('stanza', onDiscoInfoStanza);

            setTimeout(() => {
                if (!this.uploadService && !resolved) {
                    resolved = true;
                    this.xmpp.off('stanza', onDiscoInfoStanza);
                    console.log('Таймаут для disco#info, перехожу к disco#items.');
                    performItemsDiscovery();
                }
            }, 5000);

            const performItemsDiscovery = () => {
                const discoItemsId = 'disco_items_' + uuidv4();
                const iqItems = xml('iq', { type: 'get', to: userDomain, id: discoItemsId },
                    xml('query', { xmlns: 'http://jabber.org/protocol/disco#items' })
                );
                this.xmpp.send(iqItems);
                console.log(`Отправлен disco#items запрос к: ${userDomain} (ID: ${discoItemsId})`);

                let itemsResolved = false;
                
                const onDiscoItemsStanza = (stanza) => {
                    if (stanza.is('iq') && stanza.attrs.id === discoItemsId) {
                        if (itemsResolved) return;
                        itemsResolved = true;
                        this.xmpp.off('stanza', onDiscoItemsStanza);
                        const items = stanza.getChild('query')?.getChildren('item') || [];
                        const uploadItem = items.find(item => item.attrs.jid && item.attrs.name?.toLowerCase().includes('upload'));
                        
                        if (uploadItem) {
                            const secondDiscoInfoId = 'disco_info_sub_' + uuidv4();
                            const secondIqInfo = xml('iq', { type: 'get', to: uploadItem.attrs.jid, id: secondDiscoInfoId },
                                xml('query', { xmlns: 'http://jabber.org/protocol/disco#info' })
                            );
                            this.xmpp.send(secondIqInfo);
                            console.log(`Отправлен вторичный disco#info запрос к: ${uploadItem.attrs.jid} (ID: ${secondDiscoInfoId})`);

                            let secondResolved = false;
                            
                            const onSecondDiscoInfoStanza = (subStanza) => {
                                if (subStanza.is('iq') && subStanza.attrs.id === secondDiscoInfoId) {
                                    if (secondResolved) return;
                                    secondResolved = true;
                                    this.xmpp.off('stanza', onSecondDiscoInfoStanza);
                                    if (subStanza.attrs.type === 'result') {
                                        const subFeatures = subStanza.getChild('query', 'http://jabber.org/protocol/disco#info')?.getChildren('feature') || [];
                                        const subSupportsUpload = subFeatures.some(f => f.attrs['var'] === 'urn:xmpp:http:upload:0');
                                        if (subSupportsUpload) {
                                            this.uploadService = uploadItem.attrs.jid;
                                            console.log("Обнаружена служба HTTP Upload (вторичный disco#info):", this.uploadService);
                                        }
                                    }
                                    resolve();
                                }
                            };
                            this.xmpp.on('stanza', onSecondDiscoInfoStanza);
                            setTimeout(() => {
                                if (!secondResolved) {
                                    secondResolved = true;
                                    this.xmpp.off('stanza', onSecondDiscoInfoStanza);
                                    if (!this.uploadService) console.log(`Таймаут вторичного disco#info для ${uploadItem.attrs.jid}.`);
                                    resolve();
                                }
                            }, 5000);

                        } else {
                            console.log("Служба HTTP Upload не найдена через disco#items.");
                            resolve();
                        }
                    }
                };
                this.xmpp.on('stanza', onDiscoItemsStanza);
                setTimeout(() => { 
                    if (!itemsResolved) {
                        itemsResolved = true;
                        this.xmpp.off('stanza', onDiscoItemsStanza); 
                        if (!this.uploadService) console.log('Таймаут ожидания disco#items ответа.');
                        resolve(); 
                    }
                }, 10000);
            };
        });
    }

    connect(jid, password) {
        if (this.xmpp) this.disconnect();
        this.userJid = jid;
        this.userPassword = password;
        this.reconnectAttempts = 0;
        
        this.lastSyncTime = {};
        this.syncInProgress = {};
        this.pendingCalls = {};
        this.activeCalls = {};
        this.fullJidMap = {};

        const [local, domain] = jid.split('@');
        const cleanDomain = domain ? domain.split('/')[0] : '';
        const resourceName = Platform.OS === 'web' ? 'web_' + Date.now() : 'mobile_' + Date.now();
        const serviceUrl = `wss://${cleanDomain}:5281/xmpp-websocket`;
        
        this.xmpp = client({ service: serviceUrl, domain: cleanDomain, resource: resourceName, username: local, password: password });

        this.xmpp.on('error', (err) => { console.log('XMPP Error:', err); this.emit('error', err); this.scheduleReconnect(); });
        this.xmpp.on('offline', () => { console.log('XMPP Offline'); this.isConnected = false; this.emit('offline'); this.scheduleReconnect(); });
        
        this.xmpp.on('status', (status) => {
            console.log('XMPP status changed:', status);
            this.isConnected = (status === 'online');
            if (this.isConnected) {
                this.reconnectAttempts = 0;
                if (this.reconnectTimer) { clearTimeout(this.reconnectTimer); this.reconnectTimer = null; }
            }
            this.emit('status', status);
        });

        this.xmpp.on('online', async (address) => {
            this.userJid = `${address._local}@${address._domain}/${address._resource}`;
            await this.xmpp.send(xml('presence'));
            console.log('XMPP Online:', address, 'Full JID:', this.userJid);
            this.discoverUploadService().then(() => {
                console.log('Upload Service Discovery completed. Service JID:', this.uploadService || 'None found');
            });
            this.emit('online', address);
            setTimeout(() => this.loadAllHistory(), 1000);
        });

        this.xmpp.on('stanza', async (stanza) => {
            const from = stanza.attrs.from;
            const fromBare = from?.split('/')[0];
            const to = stanza.attrs.to?.split('/')[0];
            const myBareJid = this.userJid.split('/')[0];

            if (stanza.is('presence')) {
                const fullJid = from;
                const bareJid = fromBare;
                
                if (stanza.attrs.type === 'subscribe') {
                    await this.xmpp.send(xml('presence', { to: bareJid, type: 'subscribed' }));
                } else if (stanza.attrs.type === 'unavailable') {
                    this.presenceMap[bareJid] = 'offline';
                    delete this.fullJidMap[bareJid];
                    console.log('[Presence] Offline:', bareJid);
                } else if (!stanza.attrs.type && bareJid !== myBareJid) {
                    this.presenceMap[bareJid] = 'online';
                    this.fullJidMap[bareJid] = fullJid;
                    console.log('[Presence] Online:', bareJid, 'fullJid:', fullJid);
                }
                this.emit('presence_update', { jid: bareJid, status: this.presenceMap[bareJid] });
            }

            if (stanza.is('iq')) {
                console.log('[IQ] Received:', stanza.attrs.type, 'from:', from, 'id:', stanza.attrs.id);
                
                const jingle = stanza.getChild('jingle', 'urn:xmpp:jingle:1');
                if (jingle) {
                    const action = jingle.attrs.action;
                    const sid = jingle.attrs.sid;
                    const initiator = jingle.attrs.initiator;
                    
                    console.log('[Jingle] Received action:', action, 'sid:', sid, 'from:', from, 'initiator:', initiator);
                    
                    if (action === 'session-initiate') {
                        if (this.activeCalls[sid]) {
                            console.log('[Jingle] Ignoring carbon copy of our own call:', sid);
                            await this.xmpp.send(xml('iq', { to: from, type: 'result', id: stanza.attrs.id }));
                            return;
                        }
                        
                        const initiatorBare = initiator?.split('/')[0];
                        if (initiatorBare === myBareJid) {
                            console.log('[Jingle] Ignoring session-initiate from ourselves (carbon):', sid);
                            await this.xmpp.send(xml('iq', { to: from, type: 'result', id: stanza.attrs.id }));
                            return;
                        }
                        
                        const contents = jingle.getChildren('content');
                        const hasVideo = contents.some(c => 
                            c.getChild('description')?.attrs.media === 'video'
                        );
                        
                        console.log('[Jingle] Real incoming call from:', from, 'callId:', sid, 'video:', hasVideo);
                        
                        await this.xmpp.send(xml('iq', { to: from, type: 'result', id: stanza.attrs.id }));
                        
                        this.emit('jingle_incoming', { 
                            from: from, 
                            callId: sid, 
                            isVideo: hasVideo 
                        });
                        
                    } else if (action === 'session-accept') {
                        console.log('[Jingle] Call accepted, sid:', sid);
                        await this.xmpp.send(xml('iq', { to: from, type: 'result', id: stanza.attrs.id }));
                        this.emit('jingle_accepted', { callId: sid });
                        
                    } else if (action === 'session-terminate') {
                        const reason = jingle.getChild('reason')?.children?.[0]?.name || 'unknown';
                        console.log('[Jingle] Call terminated, sid:', sid, 'reason:', reason);
                        delete this.activeCalls[sid];
                        delete this.pendingCalls[sid];
                        await this.xmpp.send(xml('iq', { to: from, type: 'result', id: stanza.attrs.id }));
                        this.emit('jingle_terminated', { callId: sid, reason });
                    }
                }
                
                if (stanza.attrs.type === 'error') {
                    const errorEl = stanza.getChild('error');
                    const errorType = errorEl?.attrs?.type;
                    const errorCondition = errorEl?.children?.[0]?.name;
                    console.log('[IQ Error] type:', errorType, 'condition:', errorCondition, 'id:', stanza.attrs.id);
                    
                    const callIdMatch = stanza.attrs.id?.match(/jingle_init_(.+)/);
                    if (callIdMatch) {
                        const callId = callIdMatch[1];
                        if (this.activeCalls[callId]) {
                            console.log('[Jingle] Call failed, emitting terminated for:', callId);
                            delete this.activeCalls[callId];
                            delete this.pendingCalls[callId];
                            this.emit('jingle_terminated', { callId, reason: errorCondition || 'error' });
                        }
                    }
                }
            }

            if (stanza.is('message')) {
                const composing = stanza.getChild('composing', 'http://jabber.org/protocol/chatstates');
                const active = stanza.getChild('active', 'http://jabber.org/protocol/chatstates');
                const paused = stanza.getChild('paused', 'http://jabber.org/protocol/chatstates');

                if (composing) this.emit('typing', { jid: fromBare, isTyping: true });
                else if (active || paused) this.emit('typing', { jid: fromBare, isTyping: false });
                
                const received = stanza.getChild('received', 'urn:xmpp:receipts');
                if (received) this.emit('delivery_update', { msgId: received.attrs.id, contactJid: fromBare });
                
                const displayed = stanza.getChild('displayed', 'urn:xmpp:chat-markers:0');
                if (displayed) {
                    this.setLastReadMessage(fromBare, displayed.attrs.id);
                    this.emit('read_update', { msgId: displayed.attrs.id, contactJid: fromBare });
                }

                if (stanza.getChild('body')) {
                    const body = stanza.getChildText('body');
                    const msgId = stanza.attrs.id || uuidv4();
                    const delayChild = stanza.getChild('delay', 'urn:xmpp:delay');
                    const timestamp = delayChild ? new Date(delayChild.attrs.stamp) : new Date();
                    
                    const isOutgoingEcho = fromBare === myBareJid;
                    const type = isOutgoingEcho ? 'out' : 'in';

                    const newMsg = { id: msgId, from: fromBare, body, timestamp, type: type };
                    
                    const relevantContactJid = isOutgoingEcho ? to : fromBare;
                    await MessageStorageService.saveMessages(relevantContactJid, [newMsg]);

                    this.lastMessages[relevantContactJid] = { body, timestamp, type: type };
                    if (type === 'in') {
                        this.unreadCounts[relevantContactJid] = (this.unreadCounts[relevantContactJid] || 0) + 1;
                    }
                    
                    this.emit('message', newMsg);
                    this.emit('last_message_update', relevantContactJid);
                }
            }
            if (stanza.is('iq') && stanza.attrs.type === 'set' && stanza.getChild('query', 'jabber:iq:roster')) {
                this.emit('roster_update');
            }
        });
        this.xmpp.start().catch((err) => { console.error('Failed to start XMPP:', err); this.scheduleReconnect(); });
    }

    scheduleReconnect() {
        if (this.reconnectTimer || this.reconnectAttempts >= 10) {
            return;
        }
        this.reconnectAttempts++;
        const delay = Math.min(this.reconnectAttempts * 2000, 30000);
        console.log(`Планирую переподключение через ${delay / 1000} секунд. Попытка ${this.reconnectAttempts}.`);
        this.reconnectTimer = setTimeout(() => {
            this.reconnectTimer = null;
            if (this.userJid && this.userPassword) {
                console.log('Попытка переподключения...');
                this.connect(this.userJid, this.userPassword);
            } else {
                this.emit('error', new Error('JID или пароль отсутствуют для переподключения.'));
            }
        }, delay);
    }
    
    async loadAllHistory() {
        const roster = await this.getRoster();
        for (const contact of roster) {
            const msgs = await MessageStorageService.getMessages(contact.jid);
            if (msgs.length > 0) {
                const last = msgs[msgs.length - 1];
                this.lastMessages[contact.jid.split('/')[0]] = { body: last.body, timestamp: last.timestamp, type: last.type };
                this.emit('last_message_update', contact.jid.split('/')[0]);
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
        if (!this.isConnected) {
            return null;
        }
        const id = uuidv4();
        const timestamp = new Date();
        const bareJid = to.split('/')[0];
        const myBareJid = this.userJid.split('/')[0];

        const newMsg = { id, body: text, timestamp, type: 'out', from: myBareJid };
        
        MessageStorageService.saveMessages(bareJid, [newMsg]);

        this.lastMessages[bareJid] = { body: text, timestamp, type: 'out' };
        this.emit('last_message_update', bareJid);

        this.xmpp.send(xml('message', { to, type: 'chat', id },
            xml('body', {}, text),
            xml('request', { xmlns: 'urn:xmpp:receipts' }),
            xml('markable', { xmlns: 'urn:xmpp:chat-markers:0' }),
            xml('active', { xmlns: 'http://jabber.org/protocol/chatstates' })
        ));
        
        this.emit('message', newMsg); 

        return id;
    }

    async fetchHistory(withJid, forceSync = false) {
        const bareJid = withJid.split('/')[0];

        let localMessages = await MessageStorageService.getMessages(bareJid);
        
        const now = Date.now();
        const lastSync = this.lastSyncTime[bareJid] || 0;
        const shouldSync = forceSync || (now - lastSync > this.SYNC_COOLDOWN);
        
        if (!this.isConnected) {
            console.log(`[MAM] Оффлайн, возвращаю ${localMessages.length} локальных сообщений для ${bareJid}`);
            return { messages: localMessages, isFromCache: true, newCount: 0 };
        }
        
        if (this.syncInProgress[bareJid]) {
            console.log(`[MAM] Синхронизация уже идёт для ${bareJid}`);
            return { messages: localMessages, isFromCache: true, newCount: 0 };
        }
        
        if (!shouldSync) {
            console.log(`[MAM] Кулдаун для ${bareJid}, ${Math.round((now - lastSync) / 1000)}с назад`);
            return { messages: localMessages, isFromCache: true, newCount: 0 };
        }
        
        this.syncInProgress[bareJid] = true;
        
        try {
            const lastTimestamp = await MessageStorageService.getLastMessageTimestamp(bareJid);
            
            const id = 'sync_mam_' + uuidv4();
            
            const queryFields = [
                xml('field', { var: 'FORM_TYPE', type: 'hidden' }, xml('value', {}, 'urn:xmpp:mam:2')),
                xml('field', { var: 'with' }, xml('value', {}, bareJid))
            ];
            
            if (lastTimestamp) {
                const startTime = new Date(lastTimestamp.getTime() + 1000);
                const isoTime = startTime.toISOString();
                queryFields.push(xml('field', { var: 'start' }, xml('value', {}, isoTime)));
                console.log(`[MAM] Инкрементальный запрос для ${bareJid} (после ${isoTime}, ID: ${id})`);
            } else {
                console.log(`[MAM] Первая загрузка для ${bareJid} (последние 100, ID: ${id})`);
            }

            const iq = xml('iq', { type: 'set', id },
                xml('query', { xmlns: 'urn:xmpp:mam:2' },
                    xml('x', { xmlns: 'jabber:x:data', type: 'submit' }, ...queryFields),
                    xml('set', { xmlns: 'http://jabber.org/protocol/rsm' }, 
                        xml('max', {}, '100'),
                        ...(lastTimestamp ? [] : [xml('before', {}, '')])
                    )
                )
            );

            return new Promise((resolve) => {
                const fetched = [];
                let handled = false;
                
                const onStanza = (stanza) => {
                    if (stanza.is('message')) {
                        const result = stanza.getChild('result', 'urn:xmpp:mam:2');
                        if (result) {
                            const forwarded = result.getChild('forwarded', 'urn:xmpp:forward:0');
                            const msg = forwarded?.getChild('message');
                            const body = msg?.getChildText('body');
                            const delay = forwarded?.getChild('delay', 'urn:xmpp:delay');
                            
                            if (body) {
                                const msgId = msg.attrs.id || result.attrs.id || uuidv4();
                                const fromJid = msg.attrs.from.split('/')[0];
                                const myBareJid = this.userJid.split('/')[0];
                                const type = (fromJid === myBareJid) ? 'out' : 'in';

                                fetched.push({
                                    id: msgId,
                                    body,
                                    from: fromJid,
                                    timestamp: delay ? new Date(delay.attrs.stamp) : new Date(),
                                    type: type
                                });
                            }
                        }
                    }
                    
                    if (stanza.is('iq') && stanza.attrs.id === id) {
                        if (handled) return;
                        handled = true;
                        this.xmpp.off('stanza', onStanza);
                        
                        this.lastSyncTime[bareJid] = Date.now();
                        this.syncInProgress[bareJid] = false;
                        
                        console.log(`[MAM] Получено ${fetched.length} новых сообщений для ${bareJid}`);
                        
                        if (fetched.length > 0) {
                            MessageStorageService.saveMessages(bareJid, fetched).then(async () => {
                                const allMessages = await MessageStorageService.getMessages(bareJid);
                                resolve({ messages: allMessages, isFromCache: false, newCount: fetched.length });
                            });
                        } else {
                            resolve({ messages: localMessages, isFromCache: true, newCount: 0 });
                        }
                    }
                };
                
                this.xmpp.on('stanza', onStanza);
                this.xmpp.send(iq);
                
                setTimeout(() => { 
                    if (handled) return;
                    handled = true;
                    this.xmpp.off('stanza', onStanza);
                    this.syncInProgress[bareJid] = false;
                    console.warn(`[MAM] Таймаут для ${bareJid}`);
                    resolve({ messages: localMessages, isFromCache: true, newCount: 0 }); 
                }, 10000);
            });
        } catch (e) {
            this.syncInProgress[bareJid] = false;
            console.error('[MAM] Ошибка:', e);
            return { messages: localMessages, isFromCache: true, newCount: 0 };
        }
    }

    async getRoster() {
        if (!this.isConnected) return [];
        const id = 'roster_' + uuidv4();
        this.xmpp.send(xml('iq', { type: 'get', id }, xml('query', { xmlns: 'jabber:iq:roster' })));
        return new Promise((resolve) => {
            let handled = false;
            const onStanza = (stanza) => {
                if (stanza.is('iq') && stanza.attrs.id === id) {
                    if (handled) return;
                    handled = true;
                    this.xmpp.off('stanza', onStanza);
                    const items = stanza.getChild('query')?.getChildren('item') || [];
                    resolve(items.map(i => ({ jid: i.attrs.jid, name: i.attrs.name || i.attrs.jid.split('@')[0] })));
                }
            };
            this.xmpp.on('stanza', onStanza);
            setTimeout(() => {
                if (handled) return;
                handled = true;
                this.xmpp.off('stanza', onStanza);
                console.warn('Таймаут получения ростера.');
                resolve([]);
            }, 5000);
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
        if (this.xmpp) { 
            console.log('Отключаю XMPP-клиент.');
            this.xmpp.stop().catch((err) => {}); 
            this.xmpp = null; 
            this.isConnected = false; 
            this.emit('offline');
        }
    }
}

export default new XmppService();
