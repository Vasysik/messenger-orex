import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, FlatList, KeyboardAvoidingView, Platform } from 'react-native';
import { AppColors } from '../constants/Colors';
import XmppService from '../services/XmppService';

const ChatScreen = ({ route, navigation }) => {
  const { contact } = route.params;
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');

  useEffect(() => {
    navigation.setOptions({ title: contact.name });

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
  };

  const renderMessage = ({ item }) => (
    <View style={[styles.msgBox, item.type === 'out' ? styles.msgOut : styles.msgIn]}>
      <Text style={[styles.msgText, item.type === 'out' ? styles.textOut : styles.textIn]}>
        {item.body}
      </Text>
    </View>
  );

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}
    >
      <FlatList
        data={messages}
        keyExtractor={item => item.id}
        renderItem={renderMessage}
        contentContainerStyle={{ padding: 10 }}
      />
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
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  msgBox: { padding: 10, borderRadius: 15, marginBottom: 8, maxWidth: '80%' },
  msgIn: { alignSelf: 'flex-start', backgroundColor: '#fff' },
  msgOut: { alignSelf: 'flex-end', backgroundColor: AppColors.primaryBrown },
  msgText: { fontSize: 16 },
  textIn: { color: '#000' },
  textOut: { color: '#fff' },
  inputContainer: { flexDirection: 'row', padding: 10, backgroundColor: '#fff', alignItems: 'center' },
  input: { flex: 1, backgroundColor: '#f0f0f0', borderRadius: 20, paddingHorizontal: 15, paddingVertical: 8, maxHeight: 100 },
  sendBtn: { marginLeft: 10, width: 40, height: 40, borderRadius: 20, backgroundColor: AppColors.primaryBrown, justifyContent: 'center', alignItems: 'center' },
  sendBtnText: { color: '#fff', fontSize: 20 }
});

export default ChatScreen;
