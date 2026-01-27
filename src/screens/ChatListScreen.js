import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, SafeAreaView, ActivityIndicator } from 'react-native';
import { AppColors } from '../constants/Colors';
import XmppService from '../services/XmppService';
import StorageService from '../services/StorageService';

const ChatListScreen = ({ navigation }) => {
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadRoster();
  }, []);

  const loadRoster = async () => {
    try {
      const roster = await XmppService.getRoster();
      setContacts(roster);
    } catch (err) {
      console.log('Ошибка ростера:', err);
    } finally {
      setLoading(false);
    }
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
        <Text style={styles.avatarText}>{item.name[0].toUpperCase()}</Text>
      </View>
      <View style={styles.contactInfo}>
        <Text style={styles.contactName}>{item.name}</Text>
        <Text style={styles.contactJid}>{item.jid}</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Орехи</Text>
        <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn}>
          <Text style={styles.logoutText}>Выйти</Text>
        </TouchableOpacity>
      </View>
      
      {loading ? (
        <ActivityIndicator size="large" color={AppColors.primaryBrown} style={{marginTop: 50}} />
      ) : (
        <FlatList
          data={contacts}
          keyExtractor={(item) => item.jid}
          renderItem={renderItem}
          ListEmptyComponent={<Text style={styles.emptyText}>Контактов пока нет</Text>}
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: { height: 60, backgroundColor: AppColors.primaryBrown, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 15 },
  headerTitle: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
  logoutBtn: { padding: 8, borderRadius: 5, backgroundColor: 'rgba(255,255,255,0.2)' },
  logoutText: { color: '#fff', fontWeight: 'bold' },
  contactItem: { flexDirection: 'row', padding: 15, borderBottomWidth: 1, borderBottomColor: '#eee', alignItems: 'center' },
  avatar: { width: 50, height: 50, borderRadius: 25, backgroundColor: AppColors.lightBrown, justifyContent: 'center', alignItems: 'center' },
  avatarText: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
  contactInfo: { marginLeft: 15 },
  contactName: { fontSize: 16, fontWeight: 'bold', color: '#333' },
  contactJid: { fontSize: 13, color: '#999' },
  emptyText: { textAlign: 'center', marginTop: 50, color: '#999' }
});

export default ChatListScreen;
