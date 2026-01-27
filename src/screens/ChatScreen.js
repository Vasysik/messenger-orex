import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, TextInput, TouchableOpacity, FlatList, Keyboard, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { AppColors } from '../constants/Colors';
import { ChatStyles as styles } from '../styles/ChatStyles';
import XmppService from '../services/XmppService';

const ChatScreen = ({ route, navigation }) => {
  const { contact } = route.params;
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [typing, setTyping] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [lastReadId, setLastReadId] = useState(null);
  const listRef = useRef();
  const contactJid = contact.jid.split('/')[0];

  useEffect(() => {
    if (Platform.OS === 'web') return;
    
    const show = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', 
      e => setKeyboardHeight(e.endCoordinates.height)
    );
    const hide = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', 
      () => setKeyboardHeight(0)
    );
    return () => { show.remove(); hide.remove(); };
  }, []);

  useEffect(() => {
    navigation.setOptions({
      headerTitle: () => (
        <View>
          <Text style={{color:'#fff', fontWeight:'bold', fontSize: 16}}>{contact.name}</Text>
          {typing && <Text style={{color: AppColors.typing, fontSize: 11}}>печатает...</Text>}
        </View>
      ),
      headerStyle: { backgroundColor: AppColors.darkWalnut },
    });
  }, [contact.name, typing, navigation]);

  useEffect(() => {
    let isMounted = true;

    const loadHistory = async () => { 
      try {
        const savedLastReadId = XmppService.getLastReadMessageId(contactJid);
        if (isMounted) setLastReadId(savedLastReadId);
        
        const history = await XmppService.fetchHistory(contactJid);
        if (isMounted) {
          setMessages(history);
          const lastIn = history.filter(m => m.type === 'in').pop();
          if (lastIn) {
            XmppService.markAsRead(contactJid, lastIn.id);
          }
          setTimeout(() => listRef.current?.scrollToEnd({ animated: false }), 100);
        }
      } catch (err) {
        console.error('Failed to load history:', err);
      }
    };
    
    loadHistory();

    const onMessage = (m) => {
      const fromBare = m.from.split('/')[0];
      if (fromBare === contactJid) {
        setMessages(prev => {
          if (prev.some(msg => msg.id === m.id)) return prev;
          return [...prev, { ...m, type: 'in' }];
        });
        XmppService.markAsRead(contactJid, m.id);
        setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
      }
    };

    const onTyping = (data) => {
      if (data.jid.split('/')[0] === contactJid) {
        setTyping(data.isTyping);
      }
    };

    const onRead = (data) => {
      if (data.contactJid === contactJid) {
        setLastReadId(data.msgId);
      }
    };

    XmppService.on('message', onMessage);
    XmppService.on('typing', onTyping);
    XmppService.on('read_update', onRead);
    
    return () => {
      isMounted = false;
      XmppService.off('message', onMessage);
      XmppService.off('typing', onTyping);
      XmppService.off('read_update', onRead);
    };
  }, [contactJid]);

  const send = useCallback(() => {
    if (!text.trim()) return;
    const id = XmppService.sendMessage(contactJid, text);
    if (id) {
      setMessages(prev => [...prev, { 
        id, 
        body: text, 
        type: 'out', 
        timestamp: new Date()
      }]);
      setText('');
      XmppService.sendTypingStatus(contactJid, false);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [text, contactJid]);

  const handleTextChange = useCallback((t) => {
    setText(t);
    XmppService.sendTypingStatus(contactJid, t.length > 0);
  }, [contactJid]);

  const getMessageStatus = useCallback((msg, index, allMessages) => {
    if (msg.type !== 'out') return null;
    if (!lastReadId) return 'sent';
    const lastReadIndex = allMessages.findIndex(m => m.id === lastReadId);
    if (lastReadIndex === -1) return 'sent';
    return index <= lastReadIndex ? 'read' : 'sent';
  }, [lastReadId]);

  const getTickColor = (status) => {
    switch (status) {
      case 'read': return AppColors.tickRead;
      case 'delivered': return AppColors.tickDelivered;
      default: return AppColors.tickSent;
    }
  };

  const renderMessage = useCallback(({item, index}) => {
    const isOut = item.type === 'out';
    const time = new Date(item.timestamp).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
    const status = getMessageStatus(item, index, messages);
    
    return (
      <View style={[styles.msgWrapper, isOut ? styles.msgWrapperOut : styles.msgWrapperIn]}>
        {isOut ? (
          <LinearGradient colors={[AppColors.lightBrown, AppColors.primaryBrown]} style={styles.msgOut}>
            <Text style={styles.msgTextOut}>{item.body}</Text>
            <View style={styles.msgFooter}>
              <Text style={styles.timeOut}>{time}</Text>
              <Text style={[styles.tick, { color: getTickColor(status) }]}>✓</Text>
            </View>
          </LinearGradient>
        ) : (
          <View style={styles.msgIn}>
            <Text style={styles.msgTextIn}>{item.body}</Text>
            <Text style={styles.timeIn}>{time}</Text>
          </View>
        )}
      </View>
    );
  }, [messages, lastReadId, getMessageStatus]);

  return (
    <View style={styles.container}>
      <FlatList 
        ref={listRef} 
        data={messages} 
        keyExtractor={(item, index) => `${item.id}_${index}`}
        renderItem={renderMessage}
        contentContainerStyle={styles.messagesList}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
        keyboardShouldPersistTaps="handled"
        extraData={lastReadId}
      />
      <View style={[styles.inputBar, Platform.OS !== 'web' && { marginBottom: keyboardHeight }]}>
        <TextInput 
          style={styles.input} 
          value={text} 
          onChangeText={handleTextChange} 
          placeholder="Сообщение..." 
          placeholderTextColor={AppColors.textLight}
          multiline 
        />
        <TouchableOpacity onPress={send} disabled={!text.trim()}>
          <LinearGradient 
            colors={text.trim() ? [AppColors.lightBrown, AppColors.primaryBrown] : ['#ccc', '#aaa']} 
            style={styles.sendBtn}
          >
            <Text style={styles.sendBtnTxt}>↑</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </View>
  );
};

export default ChatScreen;
