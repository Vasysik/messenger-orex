import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView } from 'react-native';
import { AppColors } from '../constants/Colors';
import StorageService from '../services/StorageService';
import XmppService from '../services/XmppService';

const ChatListScreen = ({ navigation }) => {
  
  const handleLogout = async () => {
    XmppService.disconnect();
    await StorageService.deleteItem('userJid');
    await StorageService.deleteItem('userPass');
    navigation.replace('Login');
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Орехи</Text>
        <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn}>
          <Text style={styles.logoutText}>Выйти</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.content}>
        <Text style={styles.emptyText}>Здесь будут ваши чаты</Text>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  header: { 
    height: 60, 
    backgroundColor: AppColors.primaryBrown, 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    paddingHorizontal: 15 
  },
  headerTitle: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
  logoutBtn: { padding: 8, borderRadius: 5, backgroundColor: 'rgba(255,255,255,0.2)' },
  logoutText: { color: '#fff', fontWeight: 'bold' },
  content: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { color: '#999', fontSize: 16 }
});

export default ChatListScreen;
