import AsyncStorage from '@react-native-async-storage/async-storage';

const MSG_KEY_PREFIX = 'msgs_';

const MessageStorageService = {
  async getMessages(jid) {
    try {
      const bareJid = jid.split('/')[0];
      const json = await AsyncStorage.getItem(MSG_KEY_PREFIX + bareJid);
      const msgs = json ? JSON.parse(json) : [];
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
      existing.forEach(m => map.set(m.id, m));
      newMsgs.forEach(m => map.set(m.id, m));
      const merged = Array.from(map.values())
        .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
      const limited = merged.slice(-500);
      
      await AsyncStorage.setItem(MSG_KEY_PREFIX + bareJid, JSON.stringify(limited));
      return limited;
    } catch (e) {
      console.error('Failed to save messages', e);
    }
  },

  async getLastMessageTimestamp(jid) {
    const msgs = await this.getMessages(jid);
    if (msgs.length === 0) return null;
    
    const lastMsg = msgs[msgs.length - 1];
    const timestamp = new Date(lastMsg.timestamp);
    
    if (isNaN(timestamp.getTime())) return null;
    
    return timestamp;
  },

  async getLastMessageId(jid) {
    const msgs = await this.getMessages(jid);
    return msgs.length > 0 ? msgs[msgs.length - 1].id : null;
  }
};

export default MessageStorageService;
