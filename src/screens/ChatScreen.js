import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, TextInput, TouchableOpacity, FlatList, Keyboard, Platform, Pressable, Clipboard, Alert, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { AppColors } from '../constants/Colors';
import { ChatStyles as styles } from '../styles/ChatStyles';
import XmppService from '../services/XmppService';
import MessageStorageService from '../services/MessageStorageService'; // Импорт
import { Feather, AntDesign } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { Audio } from 'expo-audio';

const ChatScreen = ({ route, navigation }) => {
  const { contact } = route.params;
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [typing, setTyping] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [lastReadId, setLastReadId] = useState(null);
  const [sound, setSound] = useState();
  const [playingUri, setPlayingUri] = useState(null);
  const listRef = useRef();
  const contactJid = contact.jid.split('/')[0];

  const EMOJI_REGEX = /(\u00a9|\u00ae|[\u2000-\u3300]|\ud83c[\ud000-\udfff]|\ud83d[\ud000-\udfff]|\ud83e[\ud000-\udfff])/g;

  useEffect(() => {
    return sound ? () => { sound.unloadAsync(); } : undefined;
  }, [sound]);

  useEffect(() => {
    if (Platform.OS === 'web') return;
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
  }, [contact.name, typing, navigation]);

  useEffect(() => {
    let isMounted = true;

    const initChat = async () => {
      // 1. Показываем то, что уже есть в телефоне (мгновенно)
      const local = await MessageStorageService.getMessages(contactJid);
      if (isMounted) {
          setMessages(local);
          setLastReadId(XmppService.getLastReadMessageId(contactJid));
          setTimeout(() => listRef.current?.scrollToEnd({ animated: false }), 50);
      }

      // 2. Докачиваем новые сообщения с сервера
      const fullHistory = await XmppService.fetchHistory(contactJid);
      if (isMounted) {
          setMessages(fullHistory);
          const lastIn = fullHistory.filter(m => m.type === 'in').pop();
          if (lastIn) XmppService.markAsRead(contactJid, lastIn.id);
          setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
      }
    };
    
    initChat();

    const onMessage = (m) => {
      const fromBare = m.from.split('/')[0];
      if (fromBare === contactJid) {
        setMessages(prev => {
          if (prev.some(msg => msg.id === m.id)) return prev;
          return [...prev, m];
        });
        XmppService.markAsRead(contactJid, m.id);
        setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
      }
    };

    const onTyping = (data) => {
      if (data.jid.split('/')[0] === contactJid) setTyping(data.isTyping);
    };

    const onRead = (data) => {
      if (data.contactJid === contactJid) setLastReadId(data.msgId);
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
    const trimmed = text.trim();
    if (!trimmed) return;
    const id = XmppService.sendMessage(contactJid, trimmed);
    if (id) {
      setMessages(prev => [...prev, { id, body: trimmed, type: 'out', timestamp: new Date() }]);
      setText('');
      XmppService.sendTypingStatus(contactJid, false);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [text, contactJid]);
  
  const handleFileUpload = async (uri) => {
    const uploadedUrl = await XmppService.uploadFile(uri);
    if (uploadedUrl) {
      const id = XmppService.sendMessage(contactJid, uploadedUrl);
      if (id) {
          setMessages(prev => [...prev, { id, body: uploadedUrl, type: 'out', timestamp: new Date() }]);
          setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
      }
    } else {
      Alert.alert("Ошибка", "Не удалось загрузить файл.");
    }
  };

  const pickImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.All, quality: 1 });
    if (!result.canceled) handleFileUpload(result.assets[0].uri);
  };

  const pickDocument = async () => {
      let result = await DocumentPicker.getDocumentAsync({});
      if (!result.canceled) handleFileUpload(result.assets[0].uri);
  };

  const showAttachmentMenu = () => {
    if (Platform.OS === 'web') { pickImage(); return; }
    Alert.alert("Отправить файл", "Выберите тип файла", [
        { text: "Изображение/Видео", onPress: pickImage },
        { text: "Документ", onPress: pickDocument },
        { text: "Отмена", style: "cancel" }
    ]);
  };

  const handleTextChange = useCallback((t) => {
    const filteredText = t.replace(EMOJI_REGEX, '');
    setText(filteredText);
    XmppService.sendTypingStatus(contactJid, filteredText.length > 0);
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

  const renderMessageContent = (item) => {
    const isOut = item.type === 'out';
    const uri = item.body;
    const isUrl = uri.startsWith('http');
    const isImage = isUrl && /\.(jpeg|jpg|gif|png|bmp|webp)$/i.test(uri);
    const isAudio = isUrl && /\.(m4a|mp3|wav|aac|ogg)$/i.test(uri);

    if (isImage) return <Image source={{ uri }} style={styles.imageAttachment} resizeMode="cover" />;
    if (isAudio) {
        const isPlaying = playingUri === uri;
        const playAudio = async () => {
            if (sound) await sound.unloadAsync();
            if (isPlaying) { setPlayingUri(null); return; }
            const { sound: newSound } = await Audio.Sound.createAsync({ uri });
            setSound(newSound);
            setPlayingUri(uri);
            await newSound.playAsync();
        };
        return (
            <TouchableOpacity onPress={playAudio} style={styles.fileContainer}>
                <AntDesign name={isPlaying ? "pausecircleo" : "playcircleo"} size={32} color={isOut ? "#fff" : AppColors.primaryBrown} />
                <Text style={isOut ? styles.msgTextOut : styles.msgTextIn}> Аудиофайл</Text>
            </TouchableOpacity>
        );
    }
    if (isUrl) {
        return (
            <View style={styles.fileContainer}>
                <AntDesign name="file1" size={30} color={isOut ? "#fff" : AppColors.primaryBrown} />
                <Text style={[isOut ? styles.msgTextOut : styles.msgTextIn, {marginLeft: 8}]} numberOfLines={2}>{decodeURIComponent(uri.split('/').pop())}</Text>
            </View>
        );
    }
    return <Text style={isOut ? styles.msgTextOut : styles.msgTextIn}>{item.body}</Text>;
  };

  const renderMessage = useCallback(({item, index}) => {
    const isOut = item.type === 'out';
    const time = new Date(item.timestamp).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
    const status = getMessageStatus(item, index, messages);
    
    return (
        <Pressable onLongPress={() => !item.body.startsWith('http') && Clipboard.setString(item.body)}>
            <View style={[styles.msgWrapper, isOut ? styles.msgWrapperOut : styles.msgWrapperIn]}>
                {isOut ? (
                <LinearGradient colors={[AppColors.lightBrown, AppColors.primaryBrown]} style={styles.msgOut}>
                    {renderMessageContent(item)}
                    <View style={styles.msgFooter}>
                    <Text style={styles.timeOut}>{time}</Text>
                    <Text style={[styles.tick, { color: getTickColor(status) }]}>✓</Text>
                    </View>
                </LinearGradient>
                ) : (
                <View style={styles.msgIn}>
                    {renderMessageContent(item)}
                    <Text style={styles.timeIn}>{time}</Text>
                </View>
                )}
            </View>
      </Pressable>
    );
  }, [messages, lastReadId, playingUri]);

  return (
    <View style={styles.container}>
      <FlatList 
        ref={listRef} 
        data={messages} 
        keyExtractor={(item, index) => item.id || `${index}`}
        renderItem={renderMessage}
        contentContainerStyle={styles.messagesList}
        keyboardShouldPersistTaps="handled"
        extraData={lastReadId}
      />
      <View style={[styles.inputBar, Platform.OS !== 'web' && { marginBottom: keyboardHeight }]}>
        <TouchableOpacity onPress={showAttachmentMenu} style={styles.attachBtn}>
            <Feather name="paperclip" size={22} color={AppColors.primaryBrown} />
        </TouchableOpacity>
        <TextInput 
          style={styles.input} 
          value={text} 
          onChangeText={handleTextChange} 
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
