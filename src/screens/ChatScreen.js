import React, { useState, useEffect, useRef } from 'react';
import { 
  View, Text, StyleSheet, TextInput, TouchableOpacity, 
  FlatList, KeyboardAvoidingView, Platform, ActivityIndicator,
  Animated, Keyboard
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { AppColors } from '../constants/Colors';
import XmppService from '../services/XmppService';

const ChatScreen = ({ route, navigation }) => {
  const { contact } = route.params;
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const flatListRef = useRef();
  const inputHeight = useRef(new Animated.Value(50)).current;

  useEffect(() => {
    navigation.setOptions({ 
      title: contact.name,
      headerStyle: { 
        backgroundColor: AppColors.darkWalnut,
        elevation: 0,
        shadowOpacity: 0,
      },
      headerTintColor: '#fff',
      headerTitleStyle: {
        fontWeight: 'bold',
      },
    });

    const loadHistory = async () => {
      const history = await XmppService.fetchHistory(contact.jid);
      setMessages(history);
      setLoading(false);
    };

    loadHistory();

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
    Keyboard.dismiss();
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
  };

  const formatMessageTime = (date) => {
    return new Date(date).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const renderMessage = ({ item, index }) => {
    const isOut = item.type === 'out';
    const showTail = index === messages.length - 1 || 
      messages[index + 1]?.type !== item.type;
    
    return (
      <View style={[
        styles.msgWrapper, 
        isOut ? styles.msgWrapperOut : styles.msgWrapperIn
      ]}>
        {isOut ? (
          <LinearGradient
            colors={[AppColors.lightBrown, AppColors.primaryBrown]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.msgBox, styles.msgOut, showTail && styles.msgOutTail]}
          >
            <Text style={styles.msgTextOut}>{item.body}</Text>
            <Text style={styles.timeTextOut}>{formatMessageTime(item.timestamp)}</Text>
          </LinearGradient>
        ) : (
          <View style={[styles.msgBox, styles.msgIn, showTail && styles.msgInTail]}>
            <Text style={styles.msgTextIn}>{item.body}</Text>
            <Text style={styles.timeTextIn}>{formatMessageTime(item.timestamp)}</Text>
          </View>
        )}
      </View>
    );
  };

  const renderDateSeparator = () => null;

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[AppColors.cream, AppColors.backgroundWhite]}
        style={styles.chatBackground}
      >
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={AppColors.primaryBrown} />
            <Text style={styles.loadingText}>Загружаем переписку...</Text>
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={(item, index) => item.id + index}
            renderItem={renderMessage}
            contentContainerStyle={styles.messagesContainer}
            onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={styles.emptyChat}>
                <Text style={styles.emptyChatEmoji}>🌰</Text>
                <Text style={styles.emptyChatText}>Начните переписку!</Text>
              </View>
            }
          />
        )}
      </LinearGradient>
      
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={90}
      >
        <View style={styles.inputContainer}>
          <View style={styles.inputWrapper}>
            <TextInput
              style={styles.input}
              value={inputText}
              onChangeText={setInputText}
              placeholder="Сообщение..."
              placeholderTextColor="#999"
              multiline
              maxLength={2000}
            />
          </View>
          <TouchableOpacity 
            style={[
              styles.sendBtn,
              inputText.trim().length === 0 && styles.sendBtnDisabled
            ]} 
            onPress={sendMessage}
            disabled={inputText.trim().length === 0}
          >
            <LinearGradient
              colors={inputText.trim().length > 0 
                ? [AppColors.lightBrown, AppColors.primaryBrown]
                : ['#ccc', '#aaa']
              }
              style={styles.sendBtnGradient}
            >
              <Text style={styles.sendBtnText}>↑</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { 
    flex: 1,
    backgroundColor: AppColors.backgroundWhite,
  },
  chatBackground: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 15,
    color: AppColors.primaryBrown,
    fontSize: 16,
  },
  messagesContainer: { 
    padding: 15,
    paddingBottom: 10,
  },
  msgWrapper: { 
    width: '100%', 
    marginBottom: 4,
    paddingHorizontal: 5,
  },
  msgWrapperIn: {
    alignItems: 'flex-start',
  },
  msgWrapperOut: {
    alignItems: 'flex-end',
  },
  msgBox: { 
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    maxWidth: '80%',
    minWidth: 80,
  },
  msgIn: { 
    backgroundColor: '#fff',
    borderBottomLeftRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  msgInTail: {
    borderBottomLeftRadius: 4,
  },
  msgOut: { 
    borderBottomRightRadius: 20,
    shadowColor: AppColors.primaryBrown,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  msgOutTail: {
    borderBottomRightRadius: 4,
  },
  msgTextIn: { 
    fontSize: 16,
    color: AppColors.darkWalnut,
    lineHeight: 22,
  },
  msgTextOut: { 
    fontSize: 16,
    color: '#fff',
    lineHeight: 22,
  },
  timeTextIn: { 
    fontSize: 11, 
    color: '#999', 
    alignSelf: 'flex-end', 
    marginTop: 4,
  },
  timeTextOut: { 
    fontSize: 11, 
    color: 'rgba(255,255,255,0.7)', 
    alignSelf: 'flex-end', 
    marginTop: 4,
  },
  inputContainer: { 
    flexDirection: 'row', 
    padding: 12,
    paddingBottom: Platform.OS === 'ios' ? 25 : 12,
    backgroundColor: '#fff',
    alignItems: 'flex-end',
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  inputWrapper: {
    flex: 1,
    backgroundColor: AppColors.cream,
    borderRadius: 25,
    borderWidth: 1,
    borderColor: AppColors.sand,
    overflow: 'hidden',
  },
  input: { 
    paddingHorizontal: 18,
    paddingVertical: 12,
    fontSize: 16,
    maxHeight: 120,
    color: AppColors.darkWalnut,
  },
  sendBtn: { 
    marginLeft: 10,
    borderRadius: 25,
    overflow: 'hidden',
  },
  sendBtnDisabled: {
    opacity: 0.6,
  },
  sendBtnGradient: {
    width: 50,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendBtnText: { 
    color: '#fff', 
    fontSize: 24,
    fontWeight: 'bold',
  },
  emptyChat: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 150,
  },
  emptyChatEmoji: {
    fontSize: 60,
    marginBottom: 15,
  },
  emptyChatText: {
    fontSize: 18,
    color: '#999',
  },
});

export default ChatScreen;
