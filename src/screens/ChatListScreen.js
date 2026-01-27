import React from 'react';
import { View, Text, StyleSheet, FlatList } from 'react-native';
import { AppColors } from '../constants/Colors';

const ChatListScreen = () => {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Мои Орехи (Чаты)</Text>
      </View>
      <View style={styles.content}>
        <Text style={{color: '#666'}}>Здесь скоро будут твои сообщения...</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: { 
    height: 100, 
    backgroundColor: AppColors.primaryBrown, 
    justifyContent: 'center', 
    alignItems: 'center',
    paddingTop: 40
  },
  headerTitle: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
  content: { flex: 1, justifyContent: 'center', alignItems: 'center' }
});

export default ChatListScreen;
