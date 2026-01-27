import React, { useEffect, useRef } from 'react';
import { View, Image, StyleSheet, Text, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { AppColors } from '../constants/Colors';
import StorageService from '../services/StorageService';
import XmppService from '../services/XmppService';

const SplashScreen = ({ navigation }) => {
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 4,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
    ]).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    ).start();

    const checkAutoLogin = async () => {
      const jid = await StorageService.getItem('userJid');
      const pass = await StorageService.getItem('userPass');

      if (jid && pass) {
        let resolved = false;
        
        const onOnline = () => {
          if (resolved) return;
          resolved = true;
          cleanup();
          navigation.replace('ChatList');
        };
        
        const onError = () => {
          if (resolved) return;
          resolved = true;
          cleanup();
          navigation.replace('Login');
        };

        const cleanup = () => {
          XmppService.off('online', onOnline);
          XmppService.off('error', onError);
        };
        
        XmppService.on('online', onOnline);
        XmppService.on('error', onError);
        XmppService.connect(jid, pass);
        
        setTimeout(() => {
          if (!resolved) {
            resolved = true;
            cleanup();
            navigation.replace('Login');
          }
        }, 7000);
      } else {
        setTimeout(() => navigation.replace('Login'), 2000);
      }
    };
    
    checkAutoLogin();
  }, []);

  return (
    <LinearGradient
      colors={[AppColors.darkWalnut, AppColors.primaryBrown, AppColors.lightBrown]}
      style={styles.container}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
    >
      <Animated.View style={[
        styles.logoContainer,
        {
          opacity: opacityAnim,
          transform: [{ scale: scaleAnim }]
        }
      ]}>
        <Animated.View style={[
          styles.logoCircle,
          { transform: [{ scale: pulseAnim }] }
        ]}>
          <Image source={require('../../assets/logo.png')} style={styles.logo} />
        </Animated.View>
        <Text style={styles.title}>Орех</Text>
        <Text style={styles.subtitle}>Загружаем орехи...</Text>
      </Animated.View>

      <View style={styles.loader}>
        <View style={styles.loaderDot} />
        <View style={[styles.loaderDot, styles.loaderDotDelay1]} />
        <View style={[styles.loaderDot, styles.loaderDotDelay2]} />
      </View>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center',
  },
  logoContainer: {
    alignItems: 'center',
  },
  logoCircle: {
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 30,
  },
  logo: { 
    width: 120, 
    height: 120,
  },
  title: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#fff',
    letterSpacing: 3,
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 10,
  },
  loader: {
    flexDirection: 'row',
    position: 'absolute',
    bottom: 100,
    gap: 8,
  },
  loaderDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: 'rgba(255,255,255,0.8)',
  },
  loaderDotDelay1: {
    opacity: 0.6,
  },
  loaderDotDelay2: {
    opacity: 0.3,
  },
});

export default SplashScreen;
