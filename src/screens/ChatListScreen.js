import React, { useEffect, useState } from 'react';
import { 
  View, Text, StyleSheet, TouchableOpacity, FlatList, 
  SafeAreaView, ActivityIndicator, Alert, Modal, TextInput,
  StatusBar, Dimensions
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { AppColors } from '../constants/Colors';
import XmppService from '../services/XmppService';
import StorageService from '../services/StorageService';

const { width } = Dimensions.get('window');

const ChatListScreen = ({ navigation }) => {
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalVisible, setModalVisible] = useState(false);
  const [newContactJid, setNewContactJid] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    loadRoster();
    XmppService.on('online', loadRoster);
    XmppService.on('roster_update', loadRoster);
    XmppService.on('last_message_update', () => setRefreshKey(k => k + 1));
    return () => {
      XmppService.off('online', loadRoster);
      XmppService.off('roster_update', loadRoster);
      XmppService.off('last_message_update', () => {});
    };
  }, []);

  const loadRoster = async () => {
    try {
      const roster = await XmppService.getRoster();
      setContacts(roster);
    } catch (err) {
    } finally {
      setLoading(false);
    }
  };

  const handleAddContact = () => {
    if (!newContactJid.includes('@')) {
      Alert.alert("Ошибка", "Введите корректный JID");
      return;
    }
    XmppService.addContact(newContactJid);
    setModalVisible(false);
    setNewContactJid('');
    Alert.alert("Успех", "Запрос отправлен");
    setTimeout(loadRoster, 1500);
  };

  const handleLogout = async () => {
    XmppService.disconnect();
    await StorageService.deleteItem('userJid');
    await StorageService.deleteItem('userPass');
    navigation.replace('Login');
  };

  const openChat = (contact) => {
    XmppService.clearUnread(contact.jid);
    setRefreshKey(k => k + 1);
    navigation.navigate('Chat', { contact });
  };

  const formatTime = (date) => {
    if (!date) return '';
    const now = new Date();
    const msgDate = new Date(date);
    const diffDays = Math.floor((now - msgDate) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
      return msgDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (diffDays === 1) {
      return 'Вчера';
    } else if (diffDays < 7) {
      return ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'][msgDate.getDay()];
    } else {
      return msgDate.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
    }
  };

  const renderItem = ({ item }) => {
    const lastMsg = XmppService.getLastMessage(item.jid);
    const unreadCount = XmppService.getUnreadCount(item.jid);
    
    return (
      <TouchableOpacity 
        style={styles.contactItem}
        onPress={() => openChat(item)}
        activeOpacity={0.7}
      >
        <LinearGradient
          colors={[AppColors.lightBrown, AppColors.primaryBrown]}
          style={styles.avatar}
        >
          <Text style={styles.avatarText}>{item.name[0]?.toUpperCase()}</Text>
        </LinearGradient>
        
        <View style={styles.contactInfo}>
          <View style={styles.contactHeader}>
            <Text style={styles.contactName} numberOfLines={1}>{item.name}</Text>
            {lastMsg && (
              <Text style={styles.timeText}>{formatTime(lastMsg.timestamp)}</Text>
            )}
          </View>
          <View style={styles.contactFooter}>
            <Text style={styles.lastMessage} numberOfLines={1}>
              {lastMsg ? (
                lastMsg.type === 'out' ? `Вы: ${lastMsg.body}` : lastMsg.body
              ) : item.jid}
            </Text>
            {unreadCount > 0 && (
              <View style={styles.unreadBadge}>
                <Text style={styles.unreadText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={AppColors.darkWalnut} />
      
      <Modal visible={isModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>🌰 Добавить ореха</Text>
            <Text style={styles.modalSubtitle}>Введите JID пользователя</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="username@server.com"
              placeholderTextColor="#999"
              value={newContactJid}
              onChangeText={setNewContactJid}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity 
                onPress={() => setModalVisible(false)} 
                style={styles.modalBtnCancel}
              >
                <Text style={styles.modalBtnCancelText}>Отмена</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                onPress={handleAddContact} 
                style={styles.modalBtnMain}
              >
                <LinearGradient
                  colors={[AppColors.lightBrown, AppColors.primaryBrown]}
                  style={styles.modalBtnGradient}
                >
                  <Text style={styles.modalBtnMainText}>Добавить</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <LinearGradient
        colors={[AppColors.darkWalnut, AppColors.primaryBrown]}
        style={styles.header}
      >
        <View>
          <Text style={styles.headerTitle}>🌰 Орехи</Text>
          <Text style={styles.headerSubtitle}>{contacts.length} контактов</Text>
        </View>
        <View style={styles.headerBtns}>
          <TouchableOpacity onPress={() => setModalVisible(true)} style={styles.iconBtn}>
            <Text style={styles.iconBtnText}>＋</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn}>
            <Text style={styles.logoutText}>⎋</Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>
      
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={AppColors.primaryBrown} />
          <Text style={styles.loadingText}>Загружаем орехи...</Text>
        </View>
      ) : (
        <FlatList
          data={contacts}
          keyExtractor={(item) => item.jid}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyEmoji}>🥜</Text>
              <Text style={styles.emptyTitle}>Пока пусто</Text>
              <Text style={styles.emptyText}>Добавьте первого ореха!</Text>
              <TouchableOpacity 
                style={styles.emptyBtn}
                onPress={() => setModalVisible(true)}
              >
                <Text style={styles.emptyBtnText}>+ Добавить</Text>
              </TouchableOpacity>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: AppColors.backgroundWhite 
  },
  header: { 
    paddingTop: 15,
    paddingBottom: 20,
    paddingHorizontal: 20,
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center',
    borderBottomLeftRadius: 25,
    borderBottomRightRadius: 25,
  },
  headerTitle: { 
    color: '#fff', 
    fontSize: 28, 
    fontWeight: 'bold' 
  },
  headerSubtitle: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 13,
    marginTop: 2,
  },
  headerBtns: { 
    flexDirection: 'row', 
    alignItems: 'center',
    gap: 10,
  },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconBtnText: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '300',
  },
  logoutBtn: { 
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoutText: { 
    color: '#fff', 
    fontSize: 20,
  },
  listContent: {
    paddingTop: 10,
  },
  contactItem: { 
    flexDirection: 'row', 
    padding: 15,
    paddingHorizontal: 20,
    alignItems: 'center',
    backgroundColor: '#fff',
    marginHorizontal: 15,
    marginVertical: 5,
    borderRadius: 16,
    shadowColor: AppColors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  avatar: { 
    width: 56, 
    height: 56, 
    borderRadius: 28, 
    justifyContent: 'center', 
    alignItems: 'center',
  },
  avatarText: { 
    color: '#fff', 
    fontSize: 22, 
    fontWeight: 'bold' 
  },
  contactInfo: { 
    flex: 1,
    marginLeft: 15,
  },
  contactHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  contactName: { 
    fontSize: 17, 
    fontWeight: '600', 
    color: AppColors.darkWalnut,
    flex: 1,
    marginRight: 10,
  },
  timeText: {
    fontSize: 12,
    color: '#999',
  },
  contactFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  lastMessage: { 
    fontSize: 14, 
    color: '#888',
    flex: 1,
    marginRight: 10,
  },
  unreadBadge: {
    backgroundColor: AppColors.unread,
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  unreadText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 15,
    color: AppColors.primaryBrown,
    fontSize: 16,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
  },
  emptyEmoji: {
    fontSize: 80,
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: AppColors.darkWalnut,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
    marginBottom: 30,
  },
  emptyBtn: {
    backgroundColor: AppColors.primaryBrown,
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 25,
  },
  emptyBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  modalOverlay: { 
    flex: 1, 
    backgroundColor: 'rgba(0,0,0,0.6)', 
    justifyContent: 'flex-end',
  },
  modalContent: { 
    backgroundColor: '#fff', 
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    padding: 25,
    paddingBottom: 40,
  },
  modalHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#ddd',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 20,
  },
  modalTitle: { 
    fontSize: 24, 
    fontWeight: 'bold', 
    textAlign: 'center',
    color: AppColors.darkWalnut,
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    marginTop: 5,
    marginBottom: 25,
  },
  modalInput: { 
    borderWidth: 2, 
    borderColor: AppColors.sand, 
    borderRadius: 15, 
    padding: 15,
    fontSize: 16,
    backgroundColor: AppColors.cream,
  },
  modalButtons: { 
    flexDirection: 'row', 
    justifyContent: 'space-between',
    marginTop: 25,
    gap: 15,
  },
  modalBtnCancel: { 
    flex: 1,
    padding: 16,
    borderRadius: 15,
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
  },
  modalBtnCancelText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '600',
  },
  modalBtnMain: {
    flex: 1,
    borderRadius: 15,
    overflow: 'hidden',
  },
  modalBtnGradient: {
    padding: 16,
    alignItems: 'center',
  },
  modalBtnMainText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default ChatListScreen;
