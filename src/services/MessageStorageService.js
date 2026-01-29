import AsyncStorage from '@react-native-async-storage/async-storage';

const MSG_KEY_PREFIX = 'msgs_';

const MessageStorageService = {
  async getMessages(jid) {
    try {
      const bareJid = jid.split('/')[0];
      const json = await AsyncStorage.getItem(MSG_KEY_PREFIX + bareJid);
      const msgs = json ? JSON.parse(json) : [];
      // ПРИНУДИТЕЛЬНАЯ СОРТИРОВКА по дате при каждом чтении
      return msgs.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    } catch (e) {
      console.error('Failed to load local messages', e);
      return [];
    }
  },

  async saveMessages(jid, newMsgs) {
    if (!newMsgs || newMsgs.length === 0) return;
    try {
      const bareJid = jid.split('/')[0];
      const existing = await this.getMessages(bareJid);
      
      const map = new Map();
      // Кладём старые
      existing.forEach(m => map.set(m.id, m));
      // Накладываем новые (если ID совпадет, перезапишется — это исключит дубли)
      newMsgs.forEach(m => map.set(m.id, m));

      // Превращаем обратно в список и СОРТИРУЕМ
      const merged = Array.from(map.values())
        .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

      // Храним последние 500 для жирности
      const limited = merged.slice(-500);
      
      await AsyncStorage.setItem(MSG_KEY_PREFIX + bareJid, JSON.stringify(limited));
      return limited;
    } catch (e) {
      console.error('Failed to save messages', e);
    }
  },

  async getLastMessageId(jid) {
    const msgs = await this.getMessages(jid);
    // Берем ID именно последнего по ВРЕМЕНИ сообщения
    return msgs.length > 0 ? msgs[msgs.length - 1].id : null;
  }
};

export default MessageStorageService;
