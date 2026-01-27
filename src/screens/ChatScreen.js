import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, FlatList, KeyboardAvoidingView, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { AppColors } from '../constants/Colors';
import XmppService from '../services/XmppService';

const ChatScreen = ({ route, navigation }) => {
  const { contact } = route.params;
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [typing, setTyping] = useState(false);
  const listRef = useRef();

  useEffect(() => {
    navigation.setOptions({
      headerTitle: () => (
        <View>
          <Text style={{color:'#fff', fontWeight:'bold'}}>{contact.name}</Text>
          {typing && <Text style={{color:'#FFA500', fontSize:11}}>печатает...</Text>}
        </View>
      ),
      headerStyle: { backgroundColor: AppColors.darkWalnut },
    });
    const load = async () => { 
      const history = await XmppService.fetchHistory(contact.jid);
      setMessages(history);
      if (history.length > 0 && history[history.length - 1].type === 'in') {
        XmppService.markAsRead(contact.jid, history[history.length - 1].id);
      }
    };
    load();

    const onMsg = (m) => {
      if (m.from === contact.jid) {
        setMessages(p => [...p, { ...m, type: 'in', status: 'delivered' }]);
        XmppService.markAsRead(contact.jid, m.id);
      }
    };
    const onTyping = (d) => d.jid === contact.jid && setTyping(d.isTyping);
    const onDeliv = (d) => setMessages(p => p.map(m => m.id === d.msgId ? {...m, status: 'delivered'} : m));
    const onRead = (d) => setMessages(p => p.map(m => m.id === d.msgId ? {...m, status: 'read'} : m));

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
  };

  const getStatusIcon = (status) => {
    if (status === 'read') return '✓✓';
    if (status === 'delivered') return '✓';
    return '✓';
  };

  const getStatusColor = (status) => {
    if (status === 'read') return '#4FC3F7';
    return 'rgba(255,255,255,0.6)';
  };

  return (
    <KeyboardAvoidingView style={{flex:1, backgroundColor: AppColors.cream}} behavior={Platform.OS === 'ios' ? 'padding' : null} keyboardVerticalOffset={90}>
      <LinearGradient colors={[AppColors.cream, AppColors.backgroundWhite]} style={{flex:1}}>
        <FlatList ref={listRef} data={messages} keyExtractor={i => i.id} renderItem={({item}) => {
          const isOut = item.type === 'out';
          return isOut ? (
            <LinearGradient colors={[AppColors.lightBrown, AppColors.primaryBrown]} style={[styles.msg, styles.out]}>
              <Text style={styles.msgTextOut}>{item.body}</Text>
              <View style={styles.footer}>
                <Text style={styles.timeOut}>{new Date(item.timestamp).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</Text>
                <Text style={[styles.tick, {color: getStatusColor(item.status)}]}>
                  {getStatusIcon(item.status)}
                </Text>
              </View>
            </LinearGradient>
          ) : (
            <View style={[styles.msg, styles.in]}>
              <Text style={styles.msgTextIn}>{item.body}</Text>
              <View style={styles.footer}>
                <Text style={styles.timeIn}>{new Date(item.timestamp).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</Text>
              </View>
            </View>
          );
        }} onContentSizeChange={() => listRef.current?.scrollToEnd()} />
      </LinearGradient>
      <View style={styles.inputBar}>
        <TextInput style={styles.input} value={text} onChangeText={t => { setText(t); XmppService.sendTypingStatus(contact.jid, t.length > 0); }} placeholder="Сообщение..." placeholderTextColor="#999" multiline />
        <TouchableOpacity onPress={send} style={styles.sBtn}>
          <LinearGradient colors={text.trim() ? [AppColors.lightBrown, AppColors.primaryBrown] : ['#ccc', '#aaa']} style={styles.sBtnGradient}>
            <Text style={styles.sBtnTxt}>↑</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  msg: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 20, marginVertical: 4, maxWidth: '80%', marginHorizontal: 15 },
  out: { alignSelf: 'flex-end', shadowColor: AppColors.primaryBrown, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4, elevation: 3 },
  in: { alignSelf: 'flex-start', backgroundColor: '#fff', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 4, elevation: 2 },
  msgTextOut: { fontSize: 16, color: '#fff', lineHeight: 22 },
  msgTextIn: { fontSize: 16, color: AppColors.darkWalnut, lineHeight: 22 },
  footer: { flexDirection: 'row', alignSelf: 'flex-end', alignItems: 'center', marginTop: 4 },
  timeOut: { fontSize: 11, color: 'rgba(255,255,255,0.7)' },
  timeIn: { fontSize: 11, color: '#999' },
  tick: { fontSize: 11, marginLeft: 3 },
  inputBar: { flexDirection: 'row', padding: 12, paddingBottom: Platform.OS === 'ios' ? 25 : 12, backgroundColor: '#fff', alignItems: 'flex-end', borderTopWidth: 1, borderTopColor: '#f0f0f0' },
  input: { flex: 1, backgroundColor: AppColors.cream, borderRadius: 25, paddingHorizontal: 18, paddingVertical: 12, fontSize: 16, maxHeight: 120, borderWidth: 1, borderColor: AppColors.sand },
  sBtn: { marginLeft: 10, borderRadius: 25, overflow: 'hidden' },
  sBtnGradient: { width: 50, height: 50, justifyContent: 'center', alignItems: 'center' },
  sBtnTxt: { color: '#fff', fontSize: 24, fontWeight: 'bold' }
});

export default ChatScreen;
