import React, { useEffect, useState } from 'react';
import { 
  View, Text, TouchableOpacity, FlatList, SafeAreaView, 
  ActivityIndicator, Modal, TextInput, StatusBar
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { AppColors } from '../constants/Colors';
import { CommonStyles } from '../styles/CommonStyles';
import { ChatListStyles as styles } from '../styles/ChatListStyles';
import XmppService from '../services/XmppService';

const ChatListScreen = ({ navigation }) => {
  const [contacts, setContacts] = useState([]);
  const [searchVisible, setSearchVisible] = useState(false);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [isModalVisible, setModalVisible] = useState(false);
  const [newJid, setNewJid] = useState('');
  const [, setRefresh] = useState(0);

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
    try { setContacts(await XmppService.getRoster()); } 
    finally { setLoading(false); }
  };

  const filtered = searchVisible && search 
    ? contacts.filter(c => {
        const last = XmppService.getLastMessage(c.jid)?.body || '';
        return c.name.toLowerCase().includes(search.toLowerCase()) || 
               last.toLowerCase().includes(search.toLowerCase());
      }) 
    : contacts;

  const renderItem = ({ item }) => {
    const last = XmppService.getLastMessage(item.jid);
    const unread = XmppService.getUnreadCount(item.jid);
    const isOnline = XmppService.getPresence(item.jid) === 'online';

    return (
      <TouchableOpacity 
        style={CommonStyles.card} 
        onPress={() => { 
          XmppService.clearUnread(item.jid); 
          navigation.navigate('Chat', { contact: item });
        }}
      >
        <View>
          <LinearGradient colors={[AppColors.lightBrown, AppColors.primaryBrown]} style={CommonStyles.avatar}>
            <Text style={CommonStyles.avatarText}>{item.name[0].toUpperCase()}</Text>
          </LinearGradient>
          <View style={[styles.dot, { backgroundColor: isOnline ? AppColors.online : AppColors.offline }]} />
        </View>
        <View style={styles.info}>
          <View style={styles.row}>
            <Text style={styles.name}>{item.name}</Text>
            {last && <Text style={styles.time}>{new Date(last.timestamp).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</Text>}
          </View>
          <View style={styles.row}>
            <Text style={styles.msg} numberOfLines={1}>
              {last ? (last.type === 'out' ? 'Вы: ' + last.body : last.body) : 'Нет сообщений'}
            </Text>
            {unread > 0 && <View style={styles.badge}><Text style={styles.badgeTxt}>{unread}</Text></View>}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const handleAdd = () => {
    XmppService.addContact(newJid);
    setModalVisible(false);
    setNewJid('');
    setTimeout(load, 1000);
  };

  return (
    <SafeAreaView style={CommonStyles.container}>
      <StatusBar barStyle="light-content" backgroundColor={AppColors.darkWalnut} />
      
      <LinearGradient colors={[AppColors.darkWalnut, AppColors.primaryBrown]} style={CommonStyles.header}>
        <View style={styles.top}>
          <Text style={CommonStyles.headerTitle}>Орехи</Text>
          <View style={styles.actions}>
            <TouchableOpacity onPress={() => { setSearchVisible(!searchVisible); setSearch(''); }} style={CommonStyles.actionBtn}>
              <Text style={styles.actionIcon}>🔍</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => navigation.navigate('Profile')} style={CommonStyles.actionBtn}>
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

      {loading 
        ? <ActivityIndicator style={{flex:1}} color={AppColors.primaryBrown} /> 
        : <FlatList data={filtered} keyExtractor={i => i.jid} renderItem={renderItem} contentContainerStyle={{paddingBottom: 80}} />
      }

      <TouchableOpacity style={styles.fab} onPress={() => setModalVisible(true)}>
        <Text style={styles.fabTxt}>+</Text>
      </TouchableOpacity>

      <Modal visible={isModalVisible} transparent animationType="slide">
        <View style={CommonStyles.modal}>
          <View style={CommonStyles.modalContent}>
            <Text style={styles.modalTitle}>Новый контакт</Text>
            <TextInput 
              style={CommonStyles.input} 
              placeholder="jid@server.com" 
              value={newJid} 
              onChangeText={setNewJid} 
              autoCapitalize="none" 
            />
            <View style={styles.buttons}>
              <TouchableOpacity onPress={() => setModalVisible(false)} style={CommonStyles.btnSecondary}>
                <Text>Отмена</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleAdd} style={CommonStyles.btnPrimary}>
                <Text style={{color:'#fff'}}>Добавить</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

export default ChatListScreen;
