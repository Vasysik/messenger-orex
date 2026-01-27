import React, { useState, useEffect, useRef } from 'react';
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
  const listRef = useRef();

  useEffect(() => {
    const show = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', e => setKeyboardHeight(e.endCoordinates.height));
    const hide = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () => setKeyboardHeight(0));
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

    const load = async () => { 
      const history = await XmppService.fetchHistory(contact.jid);
      setMessages(history);
      const lastIn = history.filter(m => m.type === 'in').pop();
      if (lastIn) XmppService.markAsRead(contact.jid, lastIn.id);
    };
    load();

    const onMsg = m => {
      if (m.from === contact.jid) {
        setMessages(p => [...p, { ...m, type: 'in', status: 'delivered' }]);
        XmppService.markAsRead(contact.jid, m.id);
      }
    };
    const onTyping = d => d.jid === contact.jid && setTyping(d.isTyping);
    const onDeliv = d => setMessages(p => p.map(m => m.id === d.msgId ? {...m, status: 'delivered'} : m));
    const onRead = d => setMessages(p => p.map(m => m.id === d.msgId ? {...m, status: 'read'} : m));

    XmppService.on('message', onMsg);
    XmppService.on('typing', onTyping);
    XmppService.on('delivery_update', onDeliv);
    XmppService.on('read_update', onRead);
    return () => {
      XmppService.off('message', onMsg);
      XmppService.off('typing', onTyping);
      XmppService.off('delivery_update', onDeliv);
      XmppService.off('read_update', onRead);
    };
  }, [contact, typing]);

  const send = () => {
    if (!text.trim()) return;
    const id = XmppService.sendMessage(contact.jid, text);
    setMessages(p => [...p, { id, body: text, type: 'out', timestamp: new Date(), status: 'sent' }]);
    setText('');
    XmppService.sendTypingStatus(contact.jid, false);
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
  };

  const getStatus = s => s === 'read' || s === 'delivered' ? '✓✓' : '✓';

  const renderMessage = ({item}) => {
    const isOut = item.type === 'out';
    const time = new Date(item.timestamp).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
    
    return (
      <View style={[styles.msgWrapper, isOut ? styles.msgWrapperOut : styles.msgWrapperIn]}>
        {isOut ? (
          <LinearGradient colors={[AppColors.lightBrown, AppColors.primaryBrown]} style={styles.msgOut}>
            <Text style={styles.msgTextOut}>{item.body}</Text>
            <View style={styles.msgFooter}>
              <Text style={styles.timeOut}>{time}</Text>
              <Text style={styles.tick}>{getStatus(item.status)}</Text>
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
  };

  return (
    <View style={styles.container}>
      <FlatList 
        ref={listRef} 
        data={messages} 
        keyExtractor={i => i.id} 
        renderItem={renderMessage}
        contentContainerStyle={styles.messagesList}
        onContentSizeChange={() => listRef.current?.scrollToEnd()}
        keyboardShouldPersistTaps="handled"
      />
      <View style={[styles.inputBar, { marginBottom: keyboardHeight }]}>
        <TextInput 
          style={styles.input} 
          value={text} 
          onChangeText={t => { setText(t); XmppService.sendTypingStatus(contact.jid, t.length > 0); }} 
          placeholder="Сообщение..." 
          placeholderTextColor={AppColors.textLight}
          multiline 
        />
        <TouchableOpacity onPress={send} disabled={!text.trim()}>
          <LinearGradient colors={text.trim() ? [AppColors.lightBrown, AppColors.primaryBrown] : ['#ccc', '#aaa']} style={styles.sendBtn}>
            <Text style={styles.sendBtnTxt}>↑</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </View>
  );
};

export default ChatScreen;
