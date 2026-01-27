import React, { useState, useEffect, useRef } from 'react';
import { 
  View, Text, StyleSheet, TextInput, TouchableOpacity, FlatList, 
  KeyboardAvoidingView, Platform, InputAccessoryView, Keyboard
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { AppColors } from '../constants/Colors';
import XmppService from '../services/XmppService';

const ChatScreen = ({ route, navigation }) => {
  const { contact } = route.params;
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [typing, setTyping] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const listRef = useRef();
  const lastIncomingMsgId = useRef(null);

  useEffect(() => {
    const keyboardWillShow = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (e) => setKeyboardHeight(e.endCoordinates.height)
    );
    const keyboardWillHide = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setKeyboardHeight(0)
    );

    return () => {
      keyboardWillShow.remove();
      keyboardWillHide.remove();
    };
  }, []);

  useEffect(() => {
    navigation.setOptions({
      headerTitle: () => (
        <View>
          <Text style={{color:'#fff', fontWeight:'bold', fontSize: 17}}>{contact.name}</Text>
          {typing && <Text style={{color: AppColors.typing, fontSize: 12}}>печатает...</Text>}
        </View>
      ),
      headerStyle: { backgroundColor: AppColors.darkWalnut },
    });
    
    const load = async () => { 
      const history = await XmppService.fetchHistory(contact.jid);
      setMessages(history);
      for (let i = history.length - 1; i >= 0; i--) {
        if (history[i].type === 'in') {
          lastIncomingMsgId.current = history[i].id;
          XmppService.markAsRead(contact.jid, history[i].id);
          break;
        }
      }
    };
    load();

    const onMsg = (m) => {
      if (m.from === contact.jid) {
        lastIncomingMsgId.current = m.id;
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
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
  };

  const getStatusIcon = (status) => {
    switch(status) {
      case 'read': return '✓✓';
      case 'delivered': return '✓✓';
      default: return '✓';
    }
  };

  const renderMessage = ({item}) => {
    const isOut = item.type === 'out';
    return (
      <View style={[styles.msgWrapper, isOut ? styles.msgWrapperOut : styles.msgWrapperIn]}>
        {isOut ? (
          <LinearGradient 
            colors={[AppColors.lightBrown, AppColors.primaryBrown]} 
            style={styles.msgOut}
          >
            <Text style={styles.msgTextOut}>{item.body}</Text>
            <View style={styles.msgFooter}>
              <Text style={styles.timeOut}>
                {new Date(item.timestamp).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}
              </Text>
              <Text style={styles.tick}>{getStatusIcon(item.status)}</Text>
            </View>
          </LinearGradient>
        ) : (
          <View style={styles.msgIn}>
            <Text style={styles.msgTextIn}>{item.body}</Text>
            <Text style={styles.timeIn}>
              {new Date(item.timestamp).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}
            </Text>
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
        contentContainerStyle={[
          styles.messagesList,
          { paddingBottom: keyboardHeight > 0 ? 10 : 10 }
        ]}
        onContentSizeChange={() => listRef.current?.scrollToEnd()}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
      />
      
      <View style={[styles.inputBar, { marginBottom: keyboardHeight > 0 ? keyboardHeight : 0 }]}>
        <TextInput 
          style={styles.input} 
          value={text} 
          onChangeText={t => { 
            setText(t); 
            XmppService.sendTypingStatus(contact.jid, t.length > 0); 
          }} 
          placeholder="Сообщение..." 
          placeholderTextColor={AppColors.textLight}
          multiline 
          maxLength={1000}
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

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: AppColors.backgroundWhite 
  },
  messagesList: {
    padding: 15,
  },
  msgWrapper: {
    marginVertical: 3,
  },
  msgWrapperIn: {
    alignItems: 'flex-start'
  },
  msgWrapperOut: {
    alignItems: 'flex-end'
  },
  msgOut: {
    paddingHorizontal: 14, 
    paddingVertical: 10, 
    borderRadius: 18,
    borderBottomRightRadius: 4,
    maxWidth: '80%',
    shadowColor: AppColors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2
  },
  msgIn: {
    paddingHorizontal: 14, 
    paddingVertical: 10, 
    borderRadius: 18,
    borderBottomLeftRadius: 4,
    maxWidth: '80%',
    backgroundColor: '#fff',
    shadowColor: AppColors.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 1
  },
  msgTextOut: {
    fontSize: 16,
    color: '#fff',
    lineHeight: 21
  },
  msgTextIn: {
    fontSize: 16,
    color: AppColors.darkWalnut,
    lineHeight: 21
  },
  msgFooter: {
    flexDirection: 'row',
    alignSelf: 'flex-end',
    alignItems: 'center',
    marginTop: 4,
    gap: 4
  },
  timeOut: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.7)'
  },
  timeIn: {
    fontSize: 11,
    color: AppColors.textLight,
    alignSelf: 'flex-end',
    marginTop: 4
  },
  tick: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)'
  },
  inputBar: {
    flexDirection: 'row',
    padding: 12,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: AppColors.sand,
    alignItems: 'flex-end',
    gap: 10
  },
  input: {
    flex: 1,
    backgroundColor: AppColors.cream,
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 16,
    maxHeight: 100,
    borderWidth: 1,
    borderColor: AppColors.sand,
    color: AppColors.darkWalnut
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center'
  },
  sendBtnTxt: {
    color: '#fff',
    fontSize: 22,
    fontWeight: 'bold'
  }
});

export default ChatScreen;
