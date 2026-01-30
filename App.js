import React, { useEffect, useRef, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import SplashScreen from './src/screens/SplashScreen';
import LoginScreen from './src/screens/LoginScreen';
import ChatListScreen from './src/screens/ChatListScreen';
import ChatScreen from './src/screens/ChatScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import CallScreen from './src/screens/CallScreen';
import CallService from './src/services/CallService';

const Stack = createStackNavigator();

export default function App() {
  const navigationRef = useRef(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const handleIncomingCall = (callData) => {
      console.log('[App] Incoming call event received:', callData);
      
      if (navigationRef.current && isReady) {
        const currentRoute = navigationRef.current.getCurrentRoute();
        console.log('[App] Current route:', currentRoute?.name);
        
        if (currentRoute?.name !== 'Call') {
          console.log('[App] Navigating to Call screen');
          navigationRef.current.navigate('Call', {
            contact: { 
              jid: callData.from, 
              name: callData.from.split('@')[0].split('/')[0] 
            },
            isIncoming: true,
            callId: callData.callId
          });
        }
      } else {
        console.log('[App] Navigation not ready yet');
      }
    };

    CallService.on('incoming_call', handleIncomingCall);

    return () => {
      CallService.off('incoming_call', handleIncomingCall);
    };
  }, [isReady]);

  return (
    <NavigationContainer 
      ref={navigationRef}
      onReady={() => {
        console.log('[App] Navigation ready');
        setIsReady(true);
      }}
    >
      <Stack.Navigator screenOptions={{ 
        headerStyle: { backgroundColor: '#945D2D' },
        headerTintColor: '#fff' 
      }}>
        <Stack.Screen name="Splash" component={SplashScreen} options={{ headerShown: false }} />
        <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
        <Stack.Screen name="ChatList" component={ChatListScreen} options={{ headerShown: false }} />
        <Stack.Screen name="Profile" component={ProfileScreen} options={{ title: 'Профиль' }} />
        <Stack.Screen name="Chat" component={ChatScreen} /> 
        <Stack.Screen name="Call" component={CallScreen} options={{ headerShown: false, gestureEnabled: false }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
