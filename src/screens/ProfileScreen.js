import React from 'react';
import { View, Text, TouchableOpacity, SafeAreaView, StatusBar } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { AppColors } from '../constants/Colors';
import { ProfileStyles as styles } from '../styles/ProfileStyles';
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
      
      <LinearGradient colors={[AppColors.darkWalnut, AppColors.primaryBrown]} style={styles.header}>
        <LinearGradient colors={[AppColors.lightBrown, AppColors.primaryBrown]} style={styles.avatar}>
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

export default ProfileScreen;
