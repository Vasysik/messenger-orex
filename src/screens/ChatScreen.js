import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, FlatList, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { AppColors } from '../constants/Colors';
import XmppService from '../services/XmppService';

const ChatScreen = ({ route, navigation }) => {
  const { contact } = route.params;
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const flatListRef = useRef();

  useEffect(() => {
    navigation.setOptions({ title: contact.name });

    // 1. Загружаем историю из MAM
    const loadHistory = async () => {
        const history = await XmppService.fetchHistory(contact.jid);
        setMessages(history);
        setLoading(false);
    };

    loadHistory();

    // 2. Слушаем новые сообщения
    const onMessage = (msg) => {
      if (msg.from === contact.jid) {
        setMessages(prev => [...prev, { ...msg, type: 'in' }]);
      }
    };

    XmppService.on('message', onMessage);
    return () => XmppService.off('message', onMessage);
  }, [contact]);

  const sendMessage = () => {
    if (inputText.trim().length === 0) return;

    XmppService.sendMessage(contact.jid, inputText);
    
    const myMsg = {
      id: Math.random().toString(),
      body: inputText,
      type: 'out',
      timestamp: new Date()
    };
    
    setMessages(prev => [...prev, myMsg]);
    setInputText('');
    setTimeout(() => flatListRef.current?.scrollToEnd(), 100);
  };

  const renderMessage = ({ item }) => (
    <View style={[styles.msgWrapper, item.type === 'out' ? { alignItems: 'flex-end' } : { alignItems: 'flex-start' }]}>
        <View style={[styles.msgBox, item.type === 'out' ? styles.msgOut : styles.msgIn]}>
        <Text style={[styles.msgText, item.type === 'out' ? styles.textOut : styles.textIn]}>
            {item.body}
        </Text>
        <Text style={styles.timeText}>
            {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </Text>
        </View>
    </View>
  );

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}
    >
      {loading ? (
          <ActivityIndicator size="large" color={AppColors.primaryBrown} style={{flex: 1}} />
      ) : (
        <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={(item, index) => item.id + index}
            renderItem={renderMessage}
            contentContainerStyle={{ padding: 10 }}
            onContentSizeChange={() => flatListRef.current?.scrollToEnd()}
        />
      )}
      
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          value={inputText}
          onChangeText={setInputText}
          placeholder="Сообщение..."
          multiline
        />
        <TouchableOpacity style={styles.sendBtn} onPress={sendMessage}>
          <Text style={styles.sendBtnText}>➤</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F0EAD6' },
  msgWrapper: { width: '100%', marginBottom: 8 },
  msgBox: { padding: 10, borderRadius: 15, maxWidth: '85%', minWidth: 60 },
  msgIn: { backgroundColor: '#fff', borderBottomLeftRadius: 2 },
  msgOut: { backgroundColor: AppColors.primaryBrown, borderBottomRightRadius: 2 },
  msgText: { fontSize: 16 },
  textIn: { color: '#000' },
  textOut: { color: '#fff' },
  timeText: { fontSize: 10, color: '#999', alignSelf: 'flex-end', marginTop: 4 },
  inputContainer: { flexDirection: 'row', padding: 10, backgroundColor: '#fff', alignItems: 'center' },
  input: { flex: 1, backgroundColor: '#f0f0f0', borderRadius: 20, paddingHorizontal: 15, paddingVertical: 8, maxHeight: 100 },
  sendBtn: { marginLeft: 10, width: 40, height: 40, borderRadius: 20, backgroundColor: AppColors.primaryBrown, justifyContent: 'center', alignItems: 'center' },
  sendBtnText: { color: '#fff', fontSize: 20 }
});

export default ChatScreen;
