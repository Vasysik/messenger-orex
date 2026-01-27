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
  const [searchVisible, setSearchVisible] = useState(false);
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

  const filtered = searchVisible && search ? contacts.filter(c => {
    const last = XmppService.getLastMessage(c.jid)?.body || '';
    return c.name.toLowerCase().includes(search.toLowerCase()) || last.toLowerCase().includes(search.toLowerCase());
  }) : contacts;

  const renderItem = ({ item }) => {
    const last = XmppService.getLastMessage(item.jid);
    const unread = XmppService.getUnreadCount(item.jid);
    const isOnline = XmppService.getPresence(item.jid) === 'online';

    return (
      <TouchableOpacity style={styles.card} onPress={() => { 
        XmppService.clearUnread(item.jid); 
        navigation.navigate('Chat', { contact: item });
      }}>
        <View>
          <LinearGradient colors={[AppColors.lightBrown, AppColors.primaryBrown]} style={styles.avatar}>
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
      <StatusBar barStyle="light-content" backgroundColor={AppColors.darkWalnut} />
      
      <LinearGradient colors={[AppColors.darkWalnut, AppColors.primaryBrown]} style={styles.header}>
        <View style={styles.top}>
          <Text style={styles.title}>Орехи</Text>
          <View style={styles.actions}>
            <TouchableOpacity onPress={() => { setSearchVisible(!searchVisible); setSearch(''); }} style={styles.actionBtn}>
              <Text style={styles.actionIcon}>🔍</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => navigation.navigate('Profile')} style={styles.actionBtn}>
              <Text style={styles.actionIcon}>👤</Text>
            </TouchableOpacity>
          </View>
        </View>
        {searchVisible && (
          <TextInput 
            style={styles.search} 
            placeholder="Поиск..." 
            placeholderTextColor="rgba(255,255,255,0.5)" 
            value={search} 
            onChangeText={setSearch} 
          />
        )}
      </LinearGradient>

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
  container: { flex: 1, backgroundColor: AppColors.backgroundWhite },
  header: { paddingTop: 15, paddingBottom: 20, paddingHorizontal: 20, borderBottomLeftRadius: 25, borderBottomRightRadius: 25 },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 },
  title: { color: '#fff', fontSize: 28, fontWeight: 'bold' },
  actions: { flexDirection: 'row', gap: 10 },
  actionBtn: { backgroundColor: 'rgba(255,255,255,0.2)', width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  actionIcon: { fontSize: 20 },
  search: { backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: 12, padding: 12, marginTop: 10, color: '#fff' },
  card: { flexDirection: 'row', padding: 15, backgroundColor: '#fff', marginHorizontal: 15, marginVertical: 5, borderRadius: 16, shadowColor: AppColors.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 3 },
  avatar: { width: 56, height: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center' },
  avatarTxt: { color: '#fff', fontSize: 22, fontWeight: 'bold' },
  dot: { width: 12, height: 12, borderRadius: 6, position: 'absolute', bottom: 0, right: 0, borderWidth: 2, borderColor: '#fff' },
  info: { flex: 1, marginLeft: 15, justifyContent: 'center' },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  name: { fontSize: 17, fontWeight: '600', color: AppColors.darkWalnut },
  time: { fontSize: 12, color: '#999' },
  msg: { fontSize: 14, color: '#888', flex: 1, marginRight: 10 },
  badge: { backgroundColor: AppColors.unread, borderRadius: 12, minWidth: 24, height: 24, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 8 },
  badgeTxt: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
  fab: { position: 'absolute', right: 20, bottom: 30, width: 60, height: 60, borderRadius: 30, backgroundColor: AppColors.primaryBrown, justifyContent: 'center', alignItems: 'center', elevation: 5 },
  fabTxt: { color: '#fff', fontSize: 30 },
  modal: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 25, paddingBottom: 40 },
  modalTitle: { fontSize: 24, fontWeight: 'bold', textAlign: 'center', color: AppColors.darkWalnut, marginBottom: 20 },
  input: { borderWidth: 2, borderColor: AppColors.sand, borderRadius: 15, padding: 15, fontSize: 16, backgroundColor: AppColors.cream },
  buttons: { flexDirection: 'row', gap: 15, marginTop: 25 },
  btnSec: { flex: 1, padding: 16, alignItems: 'center', backgroundColor: '#f0f0f0', borderRadius: 15 },
  btnPri: { flex: 1, padding: 16, backgroundColor: AppColors.primaryBrown, borderRadius: 15, alignItems: 'center' }
});

export default ChatListScreen;
