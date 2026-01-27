import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView } from 'react-native';
import XmppService from '../services/XmppService';
import StorageService from '../services/StorageService';

const ProfileScreen = ({ navigation }) => {
  const logout = async () => {
    XmppService.disconnect();
    await StorageService.deleteItem('userJid');
    await StorageService.deleteItem('userPass');
    navigation.replace('Login');
  };

  return (
    <SafeAreaView style={{flex:1, backgroundColor:'#fff'}}>
      <View style={styles.content}>
        <View style={styles.avatar}><Text style={styles.avatarTxt}>{XmppService.userJid[0]?.toUpperCase()}</Text></View>
        <Text style={styles.jid}>{XmppService.userJid}</Text>
        <TouchableOpacity style={styles.btn} onPress={logout}><Text style={styles.btnTxt}>Выйти из аккаунта</Text></TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 },
  avatar: { width: 100, height: 100, borderRadius: 50, backgroundColor: '#8B4513', justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  avatarTxt: { color: '#fff', fontSize: 40, fontWeight: 'bold' },
  jid: { fontSize: 18, color: '#666', marginBottom: 50 },
  btn: { width: '100%', backgroundColor: '#FFEDED', padding: 18, borderRadius: 15, alignItems: 'center' },
  btnTxt: { color: '#FF3B30', fontWeight: 'bold' }
});

export default ProfileScreen;
