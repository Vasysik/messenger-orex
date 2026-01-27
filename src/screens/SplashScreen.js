import React, { useEffect } from 'react';
import { View, Image, StyleSheet, ActivityIndicator } from 'react-native';
import StorageService from '../services/StorageService';
import XmppService from '../services/XmppService';

const SplashScreen = ({ navigation }) => {
  useEffect(() => {
    const checkAutoLogin = async () => {
      const jid = await StorageService.getItem('userJid');
      const pass = await StorageService.getItem('userPass');

      if (jid && pass) {
        XmppService.once('online', () => navigation.replace('ChatList'));
        XmppService.once('error', () => navigation.replace('Login'));
        XmppService.connect(jid, pass);
        // Таймаут 5 сек
        setTimeout(() => navigation.replace('Login'), 5000);
      } else {
        setTimeout(() => navigation.replace('Login'), 1500);
      }
    };
    checkAutoLogin();
  }, []);

  return (
    <View style={styles.container}>
      <Image source={require('../../assets/logo.png')} style={styles.logo} />
      <ActivityIndicator size="large" color="#fff" />
    </View>
  );
};
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#945D2D', justifyContent: 'center', alignItems: 'center' },
  logo: { width: 150, height: 150, marginBottom: 20 },
});
export default SplashScreen;
