import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, StatusBar } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { AppColors } from '../constants/Colors';
import XmppService from '../services/XmppService';
import StorageService from '../services/StorageService';

const ProfileScreen = ({ navigation }) => {
  const logout = async () => {
    XmppService.disconnect();
    await StorageService.deleteItem('userJid');
    await StorageService.deleteItem('userPass');
    navigation.replace('Login');
  };

  const jid = XmppService.userJid || '';
  const username = jid.split('@')[0] || '';

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={AppColors.darkWalnut} />
      
      <LinearGradient 
        colors={[AppColors.darkWalnut, AppColors.primaryBrown]} 
        style={styles.header}
      >
        <LinearGradient
          colors={[AppColors.lightBrown, AppColors.primaryBrown]}
          style={styles.avatar}
        >
          <Text style={styles.avatarTxt}>{username[0]?.toUpperCase()}</Text>
        </LinearGradient>
        <Text style={styles.username}>{username}</Text>
        <Text style={styles.jid}>{jid}</Text>
        <View style={styles.statusRow}>
          <View style={[styles.statusDot, { backgroundColor: XmppService.isConnected ? AppColors.online : AppColors.offline }]} />
          <Text style={styles.statusText}>{XmppService.isConnected ? 'В сети' : 'Не в сети'}</Text>
        </View>
      </LinearGradient>

      <View style={styles.content}>
        <TouchableOpacity style={styles.logoutBtn} onPress={logout}>
          <Text style={styles.logoutTxt}>Выйти из аккаунта</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: AppColors.backgroundWhite 
  },
  header: {
    paddingTop: 30,
    paddingBottom: 35,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 25,
    borderBottomRightRadius: 25,
    alignItems: 'center'
  },
  avatar: { 
    width: 100, 
    height: 100, 
    borderRadius: 50, 
    justifyContent: 'center', 
    alignItems: 'center',
    marginBottom: 15
  },
  avatarTxt: { 
    color: '#fff', 
    fontSize: 42, 
    fontWeight: 'bold' 
  },
  username: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 5
  },
  jid: { 
    fontSize: 14, 
    color: 'rgba(255,255,255,0.7)',
    marginBottom: 15
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8
  },
  statusText: {
    color: '#fff',
    fontSize: 14
  },
  content: {
    flex: 1,
    padding: 20,
    justifyContent: 'flex-end',
    paddingBottom: 40
  },
  logoutBtn: { 
    backgroundColor: '#FFEDED', 
    padding: 18, 
    borderRadius: 16, 
    alignItems: 'center',
    shadowColor: AppColors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 2
  },
  logoutTxt: { 
    color: AppColors.error, 
    fontWeight: 'bold',
    fontSize: 16
  }
});

export default ProfileScreen;
