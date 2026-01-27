import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Image, Alert, ActivityIndicator } from 'react-native';
import { AppColors } from '../constants/Colors';
import XmppService from '../services/XmppService';
import StorageService from '../services/StorageService';

const LoginScreen = ({ navigation }) => {
  const [jid, setJid] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = () => {
    if (!jid || !password) {
      Alert.alert('Эй!', 'Введи данные');
      return;
    }

    setIsLoading(true);

    const onOnline = async () => {
      await StorageService.setItem('userJid', jid);
      await StorageService.setItem('userPass', password);
      removeListeners();
      setIsLoading(false);
      navigation.replace('ChatList');
    };

    const onError = (err) => {
      setIsLoading(false);
      Alert.alert('Ошибка', 'Не удалось войти');
      removeListeners();
    };

    const removeListeners = () => {
      XmppService.off('online', onOnline);
      XmppService.off('error', onError);
    };

    XmppService.on('online', onOnline);
    XmppService.on('error', onError);

    XmppService.connect(jid, password);
  };

  return (
    <View style={styles.container}>
      <Image source={require('../../assets/logo.png')} style={styles.logo} />
      <Text style={styles.title}>Орех Messenger</Text>
      <TextInput 
        style={styles.input} placeholder="JID" placeholderTextColor="#ccc"
        autoCapitalize="none" value={jid} onChangeText={setJid} 
      />
      <TextInput 
        style={styles.input} placeholder="Пароль" secureTextEntry 
        placeholderTextColor="#ccc" value={password} onChangeText={setPassword}
      />
      <TouchableOpacity style={styles.button} onPress={handleLogin} disabled={isLoading}>
        {isLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Войти</Text>}
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: AppColors.primaryBrown, alignItems: 'center', justifyContent: 'center', padding: 20 },
  logo: { width: 120, height: 120, marginBottom: 20 },
  title: { fontSize: 28, color: '#fff', fontWeight: 'bold', marginBottom: 40 },
  input: { width: '100%', height: 50, backgroundColor: AppColors.inputBg, borderRadius: 10, paddingHorizontal: 15, color: '#fff', marginBottom: 15 },
  button: { width: '100%', height: 50, backgroundColor: AppColors.lightBrown, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginTop: 10 },
  buttonText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
});

export default LoginScreen;
