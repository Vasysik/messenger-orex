import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, FlatList, KeyboardAvoidingView, Platform } from 'react-native';
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
      )
    });
    const load = async () => { setMessages(await XmppService.fetchHistory(contact.jid)); };
    load();

    const onMsg = (m) => m.from === contact.jid && setMessages(p => [...p, { ...m, type: 'in' }]);
    const onTyping = (d) => d.jid === contact.jid && setTyping(d.isTyping);
    const onDeliv = (d) => setMessages(p => p.map(m => m.id === d.msgId ? {...m, status: d.status} : m));

    XmppService.on('message', onMsg);
    XmppService.on('typing', onTyping);
    XmppService.on('delivery_update', onDeliv);
    return () => {
      XmppService.off('message', onMsg);
      XmppService.off('typing', onTyping);
      XmppService.off('delivery_update', onDeliv);
    };
  }, [contact, typing]);

  const send = () => {
    if (!text.trim()) return;
    const id = XmppService.sendMessage(contact.jid, text);
    setMessages(p => [...p, { id, body: text, type: 'out', timestamp: new Date(), status: 'sent' }]);
    setText('');
    XmppService.sendTypingStatus(contact.jid, false);
  };

  return (
    <KeyboardAvoidingView style={{flex:1, backgroundColor:'#FDF8F3'}} behavior={Platform.OS === 'ios' ? 'padding' : null} keyboardVerticalOffset={90}>
      <FlatList ref={listRef} data={messages} keyExtractor={i => i.id} renderItem={({item}) => (
        <View style={[styles.msg, item.type === 'out' ? styles.out : styles.in]}>
          <Text style={{color: item.type === 'out' ? '#fff' : '#333'}}>{item.body}</Text>
          <View style={styles.footer}>
            <Text style={styles.time}>{new Date(item.timestamp).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</Text>
            {item.type === 'out' && <Text style={styles.tick}>{item.status === 'delivered' ? '✓✓' : '✓'}</Text>}
          </View>
        </View>
      )} onContentSizeChange={() => listRef.current?.scrollToEnd()} />
      <View style={styles.inputBar}>
        <TextInput style={styles.input} value={text} onChangeText={t => { setText(t); XmppService.sendTypingStatus(contact.jid, t.length > 0); }} placeholder="Cообщение" multiline />
        <TouchableOpacity onPress={send} style={styles.sBtn}><Text style={styles.sBtnTxt}>↑</Text></TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  msg: { padding: 10, borderRadius: 12, marginVertical: 2, maxWidth: '80%', marginHorizontal: 15 },
  out: { alignSelf: 'flex-end', backgroundColor: '#8B4513' },
  in: { alignSelf: 'flex-start', backgroundColor: '#fff' },
  footer: { flexDirection: 'row', alignSelf: 'flex-end', alignItems: 'center', marginTop: 2 },
  time: { fontSize: 9, opacity: 0.6 },
  tick: { fontSize: 11, color: '#fff', marginLeft: 3 },
  inputBar: { flexDirection: 'row', padding: 10, backgroundColor: '#fff', alignItems: 'center' },
  input: { flex: 1, backgroundColor: '#F0E6DD', borderRadius: 20, paddingHorizontal: 15, paddingVertical: 8, maxHeight: 100 },
  sBtn: { marginLeft: 10, width: 40, height: 40, borderRadius: 20, backgroundColor: '#8B4513', justifyContent: 'center', alignItems: 'center' },
  sBtnTxt: { color: '#fff', fontSize: 20, fontWeight: 'bold' }
});

export default ChatScreen;
