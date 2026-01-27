import React, { useState } from 'react';
import { 
  View, Text, TextInput, TouchableOpacity, StyleSheet, 
  Image, Alert, ActivityIndicator, KeyboardAvoidingView, 
  Platform, Dimensions 
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { AppColors } from '../constants/Colors';
import XmppService from '../services/XmppService';
import StorageService from '../services/StorageService';

const { width, height } = Dimensions.get('window');

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
      removeListeners();
      setIsLoading(false);
      navigation.replace('ChatList');
    };

    const onError = (err) => {
      setIsLoading(false);
      Alert.alert('Упс! 🥜', 'Не удалось войти. Проверь данные.');
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
    <LinearGradient
      colors={[AppColors.darkWalnut, AppColors.primaryBrown, AppColors.lightBrown]}
      style={styles.container}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
    >
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
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
              <TextInput 
                style={styles.input} 
                placeholder="username@server.com"
                placeholderTextColor="rgba(255,255,255,0.4)"
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                value={jid} 
                onChangeText={setJid} 
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Пароль</Text>
              <TextInput 
                style={styles.input} 
                placeholder="••••••••"
                secureTextEntry 
                placeholderTextColor="rgba(255,255,255,0.4)"
                value={password} 
                onChangeText={setPassword}
              />
            </View>

            <TouchableOpacity 
              style={styles.button} 
              onPress={handleLogin} 
              disabled={isLoading}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={['#fff', AppColors.cream]}
                style={styles.buttonGradient}
              >
                {isLoading ? (
                  <ActivityIndicator color={AppColors.primaryBrown} />
                ) : (
                  <Text style={styles.buttonText}>Войти 🌰</Text>
                )}
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

const styles = StyleSheet.create({
  container: { 
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 30,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 50,
  },
  logoCircle: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  logo: { 
    width: 100, 
    height: 100,
  },
  title: { 
    fontSize: 42, 
    color: '#fff', 
    fontWeight: 'bold',
    letterSpacing: 2,
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 5,
    letterSpacing: 1,
  },
  formContainer: {
    width: '100%',
  },
  inputContainer: {
    marginBottom: 20,
  },
  inputLabel: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
    marginBottom: 8,
    marginLeft: 5,
    fontWeight: '600',
  },
  input: { 
    width: '100%', 
    height: 55, 
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: 16,
    paddingHorizontal: 20,
    color: '#fff',
    fontSize: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  button: { 
    width: '100%',
    height: 58,
    borderRadius: 16,
    overflow: 'hidden',
    marginTop: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  buttonGradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonText: { 
    color: AppColors.darkWalnut, 
    fontSize: 18, 
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  footer: {
    position: 'absolute',
    bottom: 40,
  },
  footerText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 12,
    letterSpacing: 2,
  },
});

export default LoginScreen;
