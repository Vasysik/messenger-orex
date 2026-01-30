import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StatusBar, Vibration, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { AppColors } from '../constants/Colors';
import { CallStyles as styles } from '../styles/CallStyles';
import CallService from '../services/CallService';

const CallScreen = ({ route, navigation }) => {
  const { contact, isIncoming, callId: initialCallId } = route.params;
  const [callState, setCallState] = useState(isIncoming ? 'ringing' : 'calling');
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeaker, setIsSpeaker] = useState(false);
  const [callId, setCallId] = useState(initialCallId || null);
  const durationInterval = useRef(null);
  const hasStartedCall = useRef(false);

  useEffect(() => {
    if (!isIncoming && !hasStartedCall.current) {
      hasStartedCall.current = true;
      CallService.startCall(contact.jid, false).then(id => {
        console.log('Call started with id:', id);
        if (id) setCallId(id);
      });
    }

    const onStateChange = (data) => {
      console.log('CallScreen: state changed', data);
      
      if (callId && data.callId !== callId && data.callId !== initialCallId) {
        return;
      }
      
      setCallState(data.state);
      
      if (data.isMuted !== undefined) setIsMuted(data.isMuted);
      if (data.isSpeaker !== undefined) setIsSpeaker(data.isSpeaker);
      
      if (data.state === 'ended') {
        if (Platform.OS !== 'web') Vibration.cancel();
        setTimeout(() => navigation.goBack(), 1500);
      }
    };

    CallService.on('call_state_changed', onStateChange);

    return () => {
      CallService.off('call_state_changed', onStateChange);
      if (Platform.OS !== 'web') Vibration.cancel();
      if (durationInterval.current) {
        clearInterval(durationInterval.current);
      }
    };
  }, [callId, initialCallId]);

  useEffect(() => {
    if (callState === 'connected') {
      if (Platform.OS !== 'web') Vibration.cancel();
      durationInterval.current = setInterval(() => {
        setDuration(CallService.getCallDuration());
      }, 1000);
    }

    return () => {
      if (durationInterval.current) {
        clearInterval(durationInterval.current);
      }
    };
  }, [callState]);

  const handleAccept = () => {
    console.log('Accept pressed, callId:', callId || initialCallId);
    CallService.acceptCall(callId || initialCallId);
  };

  const handleReject = () => {
    console.log('Reject pressed, callId:', callId || initialCallId);
    if (Platform.OS !== 'web') Vibration.cancel();
    CallService.rejectCall(callId || initialCallId);
  };

  const handleEndCall = () => {
    console.log('End call pressed, callId:', callId || initialCallId);
    CallService.endCall(callId || initialCallId);
  };

  const handleToggleMute = () => {
    CallService.toggleMute();
  };

  const handleToggleSpeaker = () => {
    CallService.toggleSpeaker();
  };

  const getStatusText = () => {
    switch (callState) {
      case 'calling': return 'Вызов...';
      case 'ringing': return 'Входящий звонок';
      case 'connected': return CallService.formatDuration(duration);
      case 'ended': return 'Звонок завершён';
      default: return '';
    }
  };

  return (
    <LinearGradient colors={[AppColors.darkWalnut, AppColors.primaryBrown]} style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={AppColors.darkWalnut} />
      
      <View style={styles.contactInfo}>
        <LinearGradient colors={[AppColors.lightBrown, AppColors.primaryBrown]} style={styles.avatar}>
          <Text style={styles.avatarText}>{contact.name[0].toUpperCase()}</Text>
        </LinearGradient>
        <Text style={styles.contactName}>{contact.name}</Text>
        <Text style={styles.callStatus}>{getStatusText()}</Text>
      </View>

      <View style={styles.controls}>
        {callState === 'connected' && (
          <View style={styles.callControls}>
            <TouchableOpacity 
              style={[styles.controlBtn, isMuted && styles.controlBtnActive]} 
              onPress={handleToggleMute}
            >
              <Ionicons name={isMuted ? "mic-off" : "mic"} size={28} color="#fff" />
              <Text style={styles.controlLabel}>{isMuted ? 'Вкл. микр.' : 'Микрофон'}</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.controlBtn, isSpeaker && styles.controlBtnActive]} 
              onPress={handleToggleSpeaker}
            >
              <Ionicons name={isSpeaker ? "volume-high" : "volume-medium"} size={28} color="#fff" />
              <Text style={styles.controlLabel}>{isSpeaker ? 'Динамик' : 'Телефон'}</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.actionButtons}>
          {isIncoming && callState === 'ringing' ? (
            <>
              <TouchableOpacity style={styles.rejectBtn} onPress={handleReject}>
                <Ionicons name="call" size={32} color="#fff" style={{ transform: [{ rotate: '135deg' }] }} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.acceptBtn} onPress={handleAccept}>
                <Ionicons name="call" size={32} color="#fff" />
              </TouchableOpacity>
            </>
          ) : callState !== 'ended' ? (
            <TouchableOpacity style={styles.endCallBtn} onPress={handleEndCall}>
              <Ionicons name="call" size={36} color="#fff" style={{ transform: [{ rotate: '135deg' }] }} />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
    </LinearGradient>
  );
};

export default CallScreen;
