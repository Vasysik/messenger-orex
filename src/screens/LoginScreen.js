import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Image, Alert, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { AppColors } from '../constants/Colors';
import { LoginStyles as styles } from '../styles/LoginStyles';
import XmppService from '../services/XmppService';
import StorageService from '../services/StorageService';

const LoginScreen = ({ navigation }) => {
  const [jid, setJid] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = () => {
    if (!jid || !password) {
      Alert.alert('Эй, орех! 🌰', 'Введи данные для входа');
      return;
    }
    setIsLoading(true);

    const onOnline = async () => {
      await StorageService.setItem('userJid', jid);
      await StorageService.setItem('userPass', password);
      cleanup();
      setIsLoading(false);
      navigation.replace('ChatList');
    };

    const onError = () => {
      setIsLoading(false);
      Alert.alert('Упс! 🥜', 'Не удалось войти. Проверь данные.');
      cleanup();
    };

    const cleanup = () => {
      XmppService.off('online', onOnline);
      XmppService.off('error', onError);
    };

    XmppService.on('online', onOnline);
    XmppService.on('error', onError);
    XmppService.connect(jid, password);
  };

  return (
    <LinearGradient colors={[AppColors.darkWalnut, AppColors.primaryBrown, AppColors.lightBrown]} style={styles.container} start={{x:0,y:0}} end={{x:1,y:1}}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.keyboardView}>
        <View style={styles.content}>
          <View style={styles.logoContainer}>
            <View style={styles.logoCircle}>
              <Image source={require('../../assets/logo.png')} style={styles.logo} />
            </View>
            <Text style={styles.title}>Орех</Text>
            <Text style={styles.subtitle}>Скрепный мессенджер</Text>
          </View>

          <View style={styles.formContainer}>
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>JID</Text>
              <TextInput style={styles.input} placeholder="username@server.com" placeholderTextColor="rgba(255,255,255,0.4)" autoCapitalize="none" value={jid} onChangeText={setJid} />
            </View>
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Пароль</Text>
              <TextInput style={styles.input} placeholder="••••••••" secureTextEntry placeholderTextColor="rgba(255,255,255,0.4)" value={password} onChangeText={setPassword} />
            </View>
            <TouchableOpacity style={styles.button} onPress={handleLogin} disabled={isLoading}>
              <LinearGradient colors={['#fff', AppColors.cream]} style={styles.buttonGradient}>
                {isLoading ? <ActivityIndicator color={AppColors.primaryBrown} /> : <Text style={styles.buttonText}>Войти 🌰</Text>}
              </LinearGradient>
            </TouchableOpacity>
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>XMPP • Свобода • Приватность</Text>
          </View>
        </View>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
};

export default LoginScreen;
