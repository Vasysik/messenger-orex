import { Platform } from 'react-native';
import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';
import { client, xml } from '@xmpp/client';
import EventEmitter from 'events';
import StorageService from './StorageService';
import MessageStorageService from './MessageStorageService'; // Убедись, что этот импорт правильный

if (typeof global.process === 'undefined') global.process = require('process');
if (typeof global.Buffer === 'undefined') global.Buffer = require('buffer').Buffer;
if (Platform.OS !== 'web') {
    const { URL } = require('react-native-url-polyfill');
    global.URL = URL;
}
if (!global.crypto) global.crypto = {};
if (!global.crypto.randomUUID) global.crypto.randomUUID = uuidv4;

// Вспомогательная функция для получения Blob через XHR
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
      console.error('XHR Blob Error:', e);
      reject(new Error('Failed to convert URI to Blob (network error)'));
    };
    xhr.responseType = 'blob'; // Важно: получить как Blob
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
        this.typingMap = {}; // Пока не используется
        this.userJid = '';
        this.userPassword = '';
        this.reconnectTimer = null;
        this.reconnectAttempts = 0;
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

    async uploadFile(uri) {
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
            
            // 1. Получаем Blob через XHR
            const blob = await getBlobFromUri(uri);
            if (!blob || blob.size === 0) {
                console.error('Failed to get a valid Blob from URI:', uri);
                return null;
            }
            
            // 2. Генерируем чистое имя файла
            let filename = uuidv4(); // Всегда уникальное имя
            let fileType = blob.type || 'application/octet-stream';
            
            // Определяем расширение по MIME-типу
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
                    size: size.toString(), // Некоторые серверы хотят строку
                    'content-type': fileType 
                })
            );

            return new Promise((resolve) => {
                let handled = false;
                
                const onSlotStanza = (stanza) => {
                    // Проверяем только IQ с нашим ID
                    if (!stanza.is('iq') || stanza.attrs.id !== id) return;
                    if (handled) return; // Уже обработали
                    
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

                    // Выполняем PUT-запрос
                    const xhr = new XMLHttpRequest();
                    xhr.open('PUT', putUrl, true);

                    // Устанавливаем заголовки из ответа сервера
                    putElement.getChildren('header').forEach(h => {
                        const headerName = h.attrs.name;
                        const headerValue = h.getText().trim();
                        if (headerName && headerValue) {
                            xhr.setRequestHeader(headerName, headerValue);
                            console.log(`  Header: ${headerName}: ${headerValue}`);
                        }
                    });

                    // Content-Type обязательно
                    xhr.setRequestHeader('Content-Type', fileType);
                    console.log(`  Header: Content-Type: ${fileType}`);

                    xhr.onload = () => {
                        if (xhr.status >= 200 && xhr.status < 300) {
                            console.log('✅ Файл успешно загружен:', getUrl);
                            resolve(getUrl);
                        } else {
                            console.error('❌ Ошибка загрузки:', xhr.status, xhr.statusText);
                            console.error('Response:', xhr.responseText);
                            resolve(null);
                        }
                    };

                    xhr.onerror = (e) => {
                        console.error('❌ Сетевая ошибка при PUT:', e);
                        resolve(null);
                    };

                    xhr.upload.onprogress = (e) => {
                        if (e.lengthComputable) {
                            const percent = Math.round((e.loaded / e.total) * 100);
                            console.log(`Загрузка: ${percent}%`);
                        }
                    };

                    xhr.send(blob);
                };
                
                this.xmpp.on('stanza', onSlotStanza);
                this.xmpp.send(iq);
                
                const timeoutId = setTimeout(() => {
                    if (!handled) {
                        handled = true;
                        this.xmpp.off('stanza', onSlotStanza);
                        console.error('⏱️ Таймаут ожидания слота (30с) для:', id);
                        resolve(null);
                    }
                }, 30000);
            });
        } catch (e) {
            console.error('💥 Критическая ошибка uploadFile:', e);
            return null;
        }
    }

    async discoverUploadService() {
        console.log('Начинаю обнаружение службы HTTP Upload...');
        const userDomain = this.userJid.split('@')[1]?.split('/')[0] || this.xmpp.options.domain;
        
        // 1. Попробуем сначала на стандартном JID 'upload.domain' через disco#info
        const potentialUploadJid = `upload.${userDomain}`;
        const discoInfoId = 'disco_info_' + uuidv4();
        const iqInfo = xml('iq', { type: 'get', to: potentialUploadJid, id: discoInfoId },
            xml('query', { xmlns: 'http://jabber.org/protocol/disco#info' })
        );
        
        this.xmpp.send(iqInfo);
        console.log(`Отправлен disco#info запрос к: ${potentialUploadJid} (ID: ${discoInfoId})`);

        return new Promise((resolve) => {
            const onDiscoInfoStanza = (stanza) => {
                if (stanza.is('iq') && stanza.attrs.id === discoInfoId) {
                    this.xmpp.off('stanza', onDiscoInfoStanza); // Удаляем слушателя

                    if (stanza.attrs.type === 'result') {
                        const features = stanza.getChild('query', 'http://jabber.org/protocol/disco#info')?.getChildren('feature') || [];
                        const supportsUpload = features.some(f => f.attrs['var'] === 'urn:xmpp:http:upload:0');
                        if (supportsUpload) {
                            this.uploadService = potentialUploadJid;
                            console.log("Обнаружена служба HTTP Upload (disco#info):", this.uploadService);
                            return resolve(); // Успех, завершаем
                        }
                    }
                    console.log(`Служба HTTP Upload не найдена на ${potentialUploadJid} или не поддерживает 'urn:xmpp:http:upload:0'.`);
                    // Если не нашли, пробуем disco#items на основном домене
                    performItemsDiscovery();
                }
            };
            this.xmpp.on('stanza', onDiscoInfoStanza);

            // Таймаут для disco#info, чтобы не ждать вечно
            setTimeout(() => {
                if (!this.uploadService) {
                    this.xmpp.off('stanza', onDiscoInfoStanza);
                    console.log('Таймаут для disco#info, перехожу к disco#items.');
                    performItemsDiscovery();
                }
            }, 5000); // 5 секунд на disco#info

            const performItemsDiscovery = () => {
                const discoItemsId = 'disco_items_' + uuidv4();
                const iqItems = xml('iq', { type: 'get', to: userDomain, id: discoItemsId },
                    xml('query', { xmlns: 'http://jabber.org/protocol/disco#items' })
                );
                this.xmpp.send(iqItems);
                console.log(`Отправлен disco#items запрос к: ${userDomain} (ID: ${discoItemsId})`);

                const onDiscoItemsStanza = (stanza) => {
                    if (stanza.is('iq') && stanza.attrs.id === discoItemsId) {
                        this.xmpp.off('stanza', onDiscoItemsStanza); // Удаляем слушателя
                        const items = stanza.getChild('query')?.getChildren('item') || [];
                        // Ищем элемент, чей JID содержит "upload" и поддерживающий нужный "feature"
                        const uploadItem = items.find(item => item.attrs.jid && item.attrs.name?.toLowerCase().includes('upload'));
                        
                        if (uploadItem) {
                            // Если нашли потенциальный upload-сервис, проверим его возможности
                            const secondDiscoInfoId = 'disco_info_sub_' + uuidv4();
                            const secondIqInfo = xml('iq', { type: 'get', to: uploadItem.attrs.jid, id: secondDiscoInfoId },
                                xml('query', { xmlns: 'http://jabber.org/protocol/disco#info' })
                            );
                            this.xmpp.send(secondIqInfo);
                            console.log(`Отправлен вторичный disco#info запрос к: ${uploadItem.attrs.jid} (ID: ${secondDiscoInfoId})`);

                            const onSecondDiscoInfoStanza = (subStanza) => {
                                if (subStanza.is('iq') && subStanza.attrs.id === secondDiscoInfoId) {
                                    this.xmpp.off('stanza', onSecondDiscoInfoStanza);
                                    if (subStanza.attrs.type === 'result') {
                                        const subFeatures = subStanza.getChild('query', 'http://jabber.org/protocol/disco#info')?.getChildren('feature') || [];
                                        const subSupportsUpload = subFeatures.some(f => f.attrs['var'] === 'urn:xmpp:http:upload:0');
                                        if (subSupportsUpload) {
                                            this.uploadService = uploadItem.attrs.jid;
                                            console.log("Обнаружена служба HTTP Upload (вторичный disco#info):", this.uploadService);
                                        }
                                    }
                                    resolve(); // Завершаем после вторичной проверки
                                }
                            };
                            this.xmpp.on('stanza', onSecondDiscoInfoStanza);
                            setTimeout(() => { // Таймаут для вторичной проверки
                                this.xmpp.off('stanza', onSecondDiscoInfoStanza);
                                if (!this.uploadService) console.log(`Таймаут вторичного disco#info для ${uploadItem.attrs.jid}.`);
                                resolve();
                            }, 5000);

                        } else {
                            console.log("Служба HTTP Upload не найдена через disco#items.");
                            resolve(); // Завершаем, если не нашли
                        }
                    }
                };
                this.xmpp.on('stanza', onDiscoItemsStanza);
                setTimeout(() => { 
                    this.xmpp.off('stanza', onDiscoItemsStanza); 
                    if (!this.uploadService) console.log('Таймаут ожидания disco#items ответа.');
                    resolve(); 
                }, 10000); // 10 секунд на disco#items
            };
        });
    }

    connect(jid, password) {
        if (this.xmpp) this.disconnect();
        this.userJid = jid;
        this.userPassword = password;
        this.reconnectAttempts = 0;

        const [local, domain] = jid.split('@');
        const cleanDomain = domain ? domain.split('/')[0] : '';
        // Установка this.uploadService по умолчанию здесь удалена, теперь полностью полагаемся на discoverUploadService
        const serviceUrl = `wss://${cleanDomain}:5281/xmpp-websocket`;
        
        this.xmpp = client({ service: serviceUrl, domain: cleanDomain, resource: 'mobile', username: local, password: password });

        this.xmpp.on('error', (err) => { console.log('XMPP Error:', err); this.emit('error', err); this.scheduleReconnect(); });
        this.xmpp.on('offline', () => { console.log('XMPP Offline'); this.isConnected = false; this.emit('offline'); this.scheduleReconnect(); });
        
        this.xmpp.on('status', (status) => {
            this.isConnected = (status === 'online');
            if (this.isConnected) {
                this.reconnectAttempts = 0;
                if (this.reconnectTimer) { clearTimeout(this.reconnectTimer); this.reconnectTimer = null; }
            } else if (status === 'connecting' || status === 'disconnecting') {
                // Do nothing
            } else {
                console.log('XMPP status changed:', status);
            }
            this.emit('status', status);
        });

        this.xmpp.on('online', async (address) => {
            await this.xmpp.send(xml('presence'));
            console.log('XMPP Online:', address);
            // Обнаруживаем службу загрузки *после* установления соединения
            this.discoverUploadService().then(() => {
                console.log('Upload Service Discovery completed. Service JID:', this.uploadService || 'None found');
            });
            this.emit('online', address);
            setTimeout(() => this.loadAllHistory(), 1000); // Загружаем историю после небольшой задержки
        });

        this.xmpp.on('stanza', async (stanza) => {
            const from = stanza.attrs.from?.split('/')[0];
            const to = stanza.attrs.to?.split('/')[0]; // Получаем JID получателя для контекста
            const myBareJid = this.userJid.split('/')[0];

            if (stanza.is('presence')) {
                if (stanza.attrs.type === 'subscribe') await this.xmpp.send(xml('presence', { to: from, type: 'subscribed' }));
                else if (stanza.attrs.type === 'unavailable') this.presenceMap[from] = 'offline';
                else if (!stanza.attrs.type && from !== myBareJid) this.presenceMap[from] = 'online';
                this.emit('presence_update', { jid: from, status: this.presenceMap[from] });
            }

            if (stanza.is('message')) {
                // Состояние чата (набор текста)
                const composing = stanza.getChild('composing', 'http://jabber.org/protocol/chatstates');
                const active = stanza.getChild('active', 'http://jabber.org/protocol/chatstates');
                const paused = stanza.getChild('paused', 'http://jabber.org/protocol/chatstates');

                if (composing) this.emit('typing', { jid: from, isTyping: true });
                else if (active || paused) this.emit('typing', { jid: from, isTyping: false });
                
                // Квитанции о доставке
                const received = stanza.getChild('received', 'urn:xmpp:receipts');
                if (received) this.emit('delivery_update', { msgId: received.attrs.id, contactJid: from }); // 'from' здесь - отправитель квитанции
                
                // Маркеры чата (статус прочтения)
                const displayed = stanza.getChild('displayed', 'urn:xmpp:chat-markers:0');
                if (displayed) {
                    this.setLastReadMessage(from, displayed.attrs.id);
                    this.emit('read_update', { msgId: displayed.attrs.id, contactJid: from });
                }

                // Тело сообщения
                if (stanza.getChild('body')) {
                    const body = stanza.getChildText('body');
                    const msgId = stanza.attrs.id || uuidv4(); // Предпочитаем ID сервера для дедупликации
                    const delayChild = stanza.getChild('delay', 'urn:xmpp:delay');
                    const timestamp = delayChild ? new Date(delayChild.attrs.stamp) : new Date();
                    
                    // Определяем, это входящее сообщение или эхо нашего собственного исходящего
                    // Если `from` = мой JID, то это исходящее сообщение (эхо)
                    // Если `to` = мой JID И `from` != мой JID, то это входящее сообщение
                    const isOutgoingEcho = from === myBareJid;
                    const type = isOutgoingEcho ? 'out' : 'in';

                    const newMsg = { id: msgId, from: from, body, timestamp, type: type };
                    
                    // Сохраняем в локальное хранилище (MessageStorageService обрабатывает дедупликацию по ID)
                    // Для исходящих (эхо), `to` - это контакт. Для входящих, `from` - это контакт.
                    const relevantContactJid = isOutgoingEcho ? to : from;
                    await MessageStorageService.saveMessages(relevantContactJid, [newMsg]);

                    // Обновляем последнее сообщение и счетчик непрочитанных
                    this.lastMessages[relevantContactJid] = { body, timestamp, type: type };
                    if (type === 'in') {
                        this.unreadCounts[relevantContactJid] = (this.unreadCounts[relevantContactJid] || 0) + 1;
                    }
                    
                    this.emit('message', newMsg); // Эмитим обработанное сообщение
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
            console.warn(`Максимальное количество попыток переподключения достигнуто (${this.reconnectAttempts}) или таймер уже активен.`);
            return;
        }
        this.reconnectAttempts++;
        const delay = Math.min(this.reconnectAttempts * 2000, 30000); // Экспоненциальная задержка, макс. 30с
        console.log(`Планирую переподключение через ${delay / 1000} секунд. Попытка ${this.reconnectAttempts}.`);
        this.reconnectTimer = setTimeout(() => {
            this.reconnectTimer = null;
            if (this.userJid && this.userPassword) {
                console.log('Попытка переподключения...');
                this.connect(this.userJid, this.userPassword);
            } else {
                console.error('Невозможно переподключиться: JID или пароль отсутствуют.');
                this.emit('error', new Error('JID или пароль отсутствуют для переподключения.'));
            }
        }, delay);
    }
    
    // loadAllHistory был модифицирован для использования MessageStorageService.getMessages
    async loadAllHistory() {
        const roster = await this.getRoster();
        for (const contact of roster) {
            // Загружаем все сообщения для каждого контакта из локального хранилища
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
            console.warn('Невозможно отправить сообщение: XMPP не подключен.');
            return null;
        }
        const id = uuidv4(); // ID, генерируемый клиентом
        const timestamp = new Date();
        const bareJid = to.split('/')[0];
        const myBareJid = this.userJid.split('/')[0];

        // Создаем объект сообщения для локального отображения и хранения
        const newMsg = { id, body: text, timestamp, type: 'out', from: myBareJid };
        
        // Немедленно сохраняем исходящее сообщение в локальное хранилище
        MessageStorageService.saveMessages(bareJid, [newMsg]);

        // Обновляем последнее сообщение в памяти
        this.lastMessages[bareJid] = { body: text, timestamp, type: 'out' };
        this.emit('last_message_update', bareJid);

        // Отправляем XMPP-станзу
        this.xmpp.send(xml('message', { to, type: 'chat', id }, // Используем ID, сгенерированный клиентом
            xml('body', {}, text),
            xml('request', { xmlns: 'urn:xmpp:receipts' }), // Запрашиваем квитанцию о доставке
            xml('markable', { xmlns: 'urn:xmpp:chat-markers:0' }), // Включаем маркеры чата
            xml('active', { xmlns: 'http://jabber.org/protocol/chatstates' }) // Указываем активное состояние чата
        ));
        
        // Эмитим сообщение немедленно, чтобы UI обновился, не дожидаясь эхо с сервера.
        // Обработчик onMessage в ChatScreen обработает его и дедуплицирует, если эхо придет.
        this.emit('message', newMsg); 

        return id;
    }

    // fetchHistory теперь умнее: сначала локальные, потом докачка с сервера
    async fetchHistory(withJid) {
        const bareJid = withJid.split('/')[0];
        
        // 1. Сначала отдаем то, что есть в телефоне (мгновенно)
        let localMessages = await MessageStorageService.getMessages(bareJid);
        
        if (!this.isConnected) {
            console.log(`Нет подключения, возвращаю ${localMessages.length} локальных сообщений для ${bareJid}`);
            return localMessages;
        }

        // 2. Запрашиваем историю у сервера через MAM
        const id = 'sync_mam_' + uuidv4();
        console.log(`Запрашиваю MAM историю для ${bareJid} (ID: ${id})`);

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
                        const forwarded = result.getChild('forwarded', 'urn:xmpp:forward:0');
                        const msg = forwarded?.getChild('message');
                        const body = msg?.getChildText('body');
                        const delay = forwarded?.getChild('delay', 'urn:xmpp:delay');
                        
                        if (body) {
                            const msgId = msg.attrs.id || result.attrs.id || uuidv4();
                            const fromJid = msg.attrs.from.split('/')[0];
                            const myBareJid = this.userJid.split('/')[0];

                            // Тип сообщения для MAM: если отправитель - я, то 'out', иначе 'in'
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
                    this.xmpp.off('stanza', onStanza);
                    console.log(`Получено ${fetched.length} сообщений MAM для ${bareJid}.`);
                    // Сохраняем пачку в базу. Она сама сопоставит ID и отсортирует по времени.
                    MessageStorageService.saveMessages(bareJid, fetched).then(async () => {
                        const allMessages = await MessageStorageService.getMessages(bareJid);
                        resolve(allMessages); // Возвращаем объединенный и отсортированный список
                    });
                }
            };
            this.xmpp.on('stanza', onStanza);
            this.xmpp.send(iq);
            // Если сервер тупит, отдаем что было в локалке через 5 сек
            setTimeout(() => { 
                this.xmpp.off('stanza', onStanza); 
                console.warn(`Таймаут получения MAM истории для ${bareJid}. Возвращаю локальные сообщения.`);
                resolve(localMessages); 
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
            setTimeout(() => {
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
            this.xmpp.stop().catch((err) => { console.error('Ошибка при остановке XMPP:', err); }); 
            this.xmpp = null; 
            this.isConnected = false; 
            this.emit('offline');
        }
    }
}

export default new XmppService();
