import React, { useEffect, useState } from 'react';
import { 
  View, Text, StyleSheet, TouchableOpacity, FlatList, 
  SafeAreaView, ActivityIndicator, Alert, Modal, TextInput 
} from 'react-native';
import { AppColors } from '../constants/Colors';
import XmppService from '../services/XmppService';
import StorageService from '../services/StorageService';

const ChatListScreen = ({ navigation }) => {
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalVisible, setModalVisible] = useState(false);
  const [newContactJid, setNewContactJid] = useState('');

  useEffect(() => {
    loadRoster();
    XmppService.on('online', loadRoster);
    XmppService.on('roster_update', loadRoster);
    return () => {
      XmppService.off('online', loadRoster);
      XmppService.off('roster_update', loadRoster);
    };
  }, []);

  const loadRoster = async () => {
    try {
      const roster = await XmppService.getRoster();
      setContacts(roster);
    } catch (err) {
      console.log('Roster error', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddContact = () => {
    if (!newContactJid.includes('@')) {
      Alert.alert("Ошибка", "Введите корректный JID (например, orekh@xmpp.jp)");
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

  const renderItem = ({ item }) => (
    <TouchableOpacity 
      style={styles.contactItem}
      onPress={() => navigation.navigate('Chat', { contact: item })}
    >
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{item.name[0]?.toUpperCase()}</Text>
      </View>
      <View style={styles.contactInfo}>
        <Text style={styles.contactName}>{item.name}</Text>
        <Text style={styles.contactJid}>{item.jid}</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Модалка добавления контакта */}
      <Modal visible={isModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Добавить ореха</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="user@server.com"
              value={newContactJid}
              onChangeText={setNewContactJid}
              autoCapitalize="none"
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.modalBtn}>
                <Text style={{color: '#666'}}>Отмена</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleAddContact} style={[styles.modalBtn, styles.modalBtnMain]}>
                <Text style={{color: '#fff', fontWeight: 'bold'}}>Добавить</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <View style={styles.header}>
        <Text style={styles.headerTitle}>Орехи</Text>
        <View style={styles.headerBtns}>
          <TouchableOpacity onPress={() => setModalVisible(true)} style={styles.addBtn}>
            <Text style={styles.addBtnText}>+</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn}>
            <Text style={styles.logoutText}>Выйти</Text>
          </TouchableOpacity>
        </View>
      </View>
      
      {loading ? (
        <ActivityIndicator size="large" color={AppColors.primaryBrown} style={{marginTop: 50}} />
      ) : (
        <FlatList
          data={contacts}
          keyExtractor={(item) => item.jid}
          renderItem={renderItem}
          ListEmptyComponent={<Text style={styles.emptyText}>У вас пока нет контактов</Text>}
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: { height: 60, backgroundColor: AppColors.primaryBrown, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 15 },
  headerTitle: { color: '#fff', fontSize: 22, fontWeight: 'bold' },
  headerBtns: { flexDirection: 'row', alignItems: 'center' },
  addBtn: { marginRight: 20, padding: 5 },
  addBtnText: { color: '#fff', fontSize: 28, fontWeight: '300' },
  logoutBtn: { padding: 8, borderRadius: 5, backgroundColor: 'rgba(255,255,255,0.2)' },
  logoutText: { color: '#fff', fontWeight: 'bold' },
  contactItem: { flexDirection: 'row', padding: 15, borderBottomWidth: 1, borderBottomColor: '#eee', alignItems: 'center' },
  avatar: { width: 50, height: 50, borderRadius: 25, backgroundColor: AppColors.lightBrown, justifyContent: 'center', alignItems: 'center' },
  avatarText: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
  contactInfo: { marginLeft: 15 },
  contactName: { fontSize: 16, fontWeight: 'bold', color: '#333' },
  contactJid: { fontSize: 13, color: '#999' },
  emptyText: { textAlign: 'center', marginTop: 50, color: '#999' },
  
  // Стили модалки
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { width: '80%', backgroundColor: '#fff', borderRadius: 15, padding: 20, elevation: 5 },
  modalTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 15, textAlign: 'center' },
  modalInput: { borderWidth: 1, borderColor: '#ddd', borderRadius: 10, padding: 10, marginBottom: 20 },
  modalButtons: { flexDirection: 'row', justifyContent: 'flex-end' },
  modalBtn: { padding: 10, marginLeft: 10, borderRadius: 5 },
  modalBtnMain: { backgroundColor: AppColors.primaryBrown }
});

export default ChatListScreen;
