import React, { useEffect, useState } from 'react';
import { 
  View, Text, StyleSheet, TouchableOpacity, FlatList, 
  SafeAreaView, ActivityIndicator, Alert, Modal, TextInput, StatusBar
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { AppColors } from '../constants/Colors';
import XmppService from '../services/XmppService';

const ChatListScreen = ({ navigation }) => {
  const [contacts, setContacts] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [isModalVisible, setModalVisible] = useState(false);
  const [newJid, setNewJid] = useState('');
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    const update = () => setRefresh(k => k + 1);
    load();
    XmppService.on('online', load);
    XmppService.on('roster_update', load);
    XmppService.on('presence_update', update);
    XmppService.on('last_message_update', update);
    return () => {
      XmppService.off('online', load);
      XmppService.off('roster_update', load);
      XmppService.off('presence_update', update);
      XmppService.off('last_message_update', update);
    };
  }, []);

  const load = async () => {
    try { const r = await XmppService.getRoster(); setContacts(r); } 
    finally { setLoading(false); }
  };

  const filtered = contacts.filter(c => {
    const last = XmppService.getLastMessage(c.jid)?.body || '';
    return c.name.toLowerCase().includes(search.toLowerCase()) || last.toLowerCase().includes(search.toLowerCase());
  });

  const renderItem = ({ item }) => {
    const last = XmppService.getLastMessage(item.jid);
    const unread = XmppService.getUnreadCount(item.jid);
    const isOnline = XmppService.getPresence(item.jid) === 'online';

    return (
      <TouchableOpacity style={styles.card} onPress={() => { XmppService.clearUnread(item.jid); navigation.navigate('Chat', { contact: item }); }}>
        <View>
          <LinearGradient colors={['#A0522D', '#5D3A1A']} style={styles.avatar}>
            <Text style={styles.avatarTxt}>{item.name[0].toUpperCase()}</Text>
          </LinearGradient>
          <View style={[styles.dot, { backgroundColor: isOnline ? '#4CAF50' : '#9E9E9E' }]} />
        </View>
        <View style={styles.info}>
          <View style={styles.row}>
            <Text style={styles.name}>{item.name}</Text>
            {last && <Text style={styles.time}>{new Date(last.timestamp).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</Text>}
          </View>
          <View style={styles.row}>
            <Text style={styles.msg} numberOfLines={1}>{last ? (last.type === 'out' ? 'Вы: ' + last.body : last.body) : 'Нет сообщений'}</Text>
            {unread > 0 && <View style={styles.badge}><Text style={styles.badgeTxt}>{unread}</Text></View>}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#3E2512" />
      <View style={styles.header}>
        <View style={styles.top}>
          <Text style={styles.title}>Мессенджер</Text>
          <TouchableOpacity onPress={() => navigation.navigate('Profile')} style={styles.pBtn}><Text style={styles.pBtnTxt}>Профиль</Text></TouchableOpacity>
        </View>
        <TextInput style={styles.search} placeholder="Поиск..." placeholderTextColor="#A58266" value={search} onChangeText={setSearch} />
      </View>

      {loading ? <ActivityIndicator style={{flex:1}} color="#8B4513" /> : (
        <FlatList data={filtered} keyExtractor={i => i.jid} renderItem={renderItem} contentContainerStyle={{paddingBottom: 100}} />
      )}

      <TouchableOpacity style={styles.fab} onPress={() => setModalVisible(true)}><Text style={styles.fabTxt}>+</Text></TouchableOpacity>

      <Modal visible={isModalVisible} transparent animationType="slide">
        <View style={styles.modal}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Новый контакт</Text>
            <TextInput style={styles.input} placeholder="jid@server.com" value={newJid} onChangeText={setNewJid} autoCapitalize="none" />
            <View style={styles.buttons}>
              <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.btnSec}><Text>Отмена</Text></TouchableOpacity>
              <TouchableOpacity onPress={() => { XmppService.addContact(newJid); setModalVisible(false); setNewJid(''); setTimeout(load, 1000); }} style={styles.btnPri}><Text style={{color:'#fff'}}>Добавить</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FDF8F3' },
  header: { backgroundColor: '#3E2512', padding: 20, borderBottomLeftRadius: 20, borderBottomRightRadius: 20 },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  title: { color: '#fff', fontSize: 22, fontWeight: 'bold' },
  pBtn: { backgroundColor: 'rgba(255,255,255,0.1)', paddingHorizontal: 15, paddingVertical: 8, borderRadius: 20 },
  pBtnTxt: { color: '#fff', fontWeight: 'bold' },
  search: { backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: 12, padding: 12, color: '#fff' },
  card: { flexDirection: 'row', padding: 15, backgroundColor: '#fff', marginHorizontal: 15, marginVertical: 5, borderRadius: 15, elevation: 1 },
  avatar: { width: 50, height: 50, borderRadius: 25, justifyContent: 'center', alignItems: 'center' },
  avatarTxt: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
  dot: { width: 12, height: 12, borderRadius: 6, position: 'absolute', bottom: 0, right: 0, borderWidth: 2, borderColor: '#fff' },
  info: { flex: 1, marginLeft: 15, justifyContent: 'center' },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  name: { fontSize: 16, fontWeight: 'bold', color: '#3E2512' },
  time: { fontSize: 11, color: '#999' },
  msg: { fontSize: 14, color: '#666', flex: 1, marginRight: 10 },
  badge: { backgroundColor: '#FF5722', borderRadius: 10, minWidth: 20, height: 20, alignItems: 'center', justifyContent: 'center' },
  badgeTxt: { color: '#fff', fontSize: 10, fontWeight: 'bold' },
  fab: { position: 'absolute', right: 20, bottom: 30, width: 60, height: 60, borderRadius: 30, backgroundColor: '#8B4513', justifyContent: 'center', alignItems: 'center', elevation: 4 },
  fabTxt: { color: '#fff', fontSize: 30 },
  modal: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
  modalContent: { backgroundColor: '#fff', borderRadius: 20, padding: 20 },
  modalTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 15, textAlign: 'center' },
  input: { borderBottomWidth: 1, borderColor: '#ddd', padding: 10, marginBottom: 20 },
  buttons: { flexDirection: 'row', gap: 10 },
  btnSec: { flex: 1, padding: 12, alignItems: 'center' },
  btnPri: { flex: 1, padding: 12, backgroundColor: '#8B4513', borderRadius: 10, alignItems: 'center' }
});

export default ChatListScreen;
