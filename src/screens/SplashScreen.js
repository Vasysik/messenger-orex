import React, { useEffect } from 'react';
import { View, Image, StyleSheet, ActivityIndicator } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import XmppService from '../services/XmppService';
import { AppColors } from '../constants/Colors';

const SplashScreen = ({ navigation }) => {
  useEffect(() => {
    checkLogin();
  }, []);

  const checkLogin = async () => {
    try {
      const savedJid = await SecureStore.getItemAsync('userJid');
      const savedPass = await SecureStore.getItemAsync('userPass');

      if (savedJid && savedPass) {
        console.log('Найдены сохраненные данные, входим...');
        
        XmppService.xmpp.once('online', () => {
          navigation.replace('ChatList');
        });

        setTimeout(() => {
           navigation.replace('Login');
        }, 5000);

        XmppService.connect(savedJid, savedPass);
      } else {
        setTimeout(() => navigation.replace('Login'), 2000);
      }
    } catch (e) {
      navigation.replace('Login');
    }
  };

  return (
    <View style={styles.container}>
      <Image source={require('../../assets/logo.png')} style={styles.logo} />
      <ActivityIndicator size="large" color="#fff" style={{ marginTop: 20 }} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  logo: { width: 200, height: 200 },
});

export default SplashScreen;
