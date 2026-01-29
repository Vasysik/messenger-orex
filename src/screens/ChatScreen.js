import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, TextInput, TouchableOpacity, FlatList, Keyboard, Platform, Pressable, Clipboard, Alert, Image, Linking } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { AppColors } from '../constants/Colors';
import { ChatStyles as styles } from '../styles/ChatStyles';
import XmppService from '../services/XmppService';
import MessageStorageService from '../services/MessageStorageService';
import { Feather, AntDesign, Ionicons } from '@expo/vector-icons';
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
  const [failedImages, setFailedImages] = useState(new Set()); // Отслеживаем битые картинки
  const listRef = useRef();
  const contactJid = contact.jid.split('/')[0];

  const EMOJI_REGEX = /(\u00a9|\u00ae|[\u2000-\u3300]|\ud83c[\ud000-\udfff]|\ud83d[\ud000-\udfff]|\ud83e[\ud000-\udfff])/g;

  // Хелперы для определения типа контента
  const isValidUrl = (str) => {
    try {
      return str.startsWith('http://') || str.startsWith('https://');
    } catch {
      return false;
    }
  };

  const getFileExtension = (url) => {
    try {
      // Убираем query параметры и берём расширение
      const cleanUrl = url.split('?')[0].split('#')[0];
      const parts = cleanUrl.split('.');
      if (parts.length > 1) {
        return parts.pop().toLowerCase();
      }
      return '';
    } catch {
      return '';
    }
  };

  const isImageUrl = (url) => {
    if (!isValidUrl(url)) return false;
    const ext = getFileExtension(url);
    const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg', 'ico', 'heic', 'heif', 'avif'];
    
    // Проверяем по расширению
    if (imageExtensions.includes(ext)) return true;
    
    // Проверяем по содержимому URL (для сервисов без расширения)
    const urlLower = url.toLowerCase();
    return urlLower.includes('/image') || 
           urlLower.includes('img.') || 
           urlLower.includes('/photo') ||
           urlLower.includes('content-type=image');
  };

  const isAudioUrl = (url) => {
    if (!isValidUrl(url)) return false;
    const ext = getFileExtension(url);
    const audioExtensions = ['mp3', 'wav', 'ogg', 'm4a', 'aac', 'flac', 'wma', 'opus'];
    return audioExtensions.includes(ext);
  };

  const isVideoUrl = (url) => {
    if (!isValidUrl(url)) return false;
    const ext = getFileExtension(url);
    const videoExtensions = ['mp4', 'webm', 'mov', 'avi', 'mkv', 'm4v', '3gp'];
    return videoExtensions.includes(ext);
  };

  const getFileName = (url) => {
    try {
      const cleanUrl = url.split('?')[0].split('#')[0];
      const name = cleanUrl.split('/').pop();
      return decodeURIComponent(name) || 'Файл';
    } catch {
      return 'Файл';
    }
  };

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
      const local = await MessageStorageService.getMessages(contactJid);
      if (isMounted) {
          setMessages(local);
          setLastReadId(XmppService.getLastReadMessageId(contactJid));
          setTimeout(() => listRef.current?.scrollToEnd({ animated: false }), 50);
      }

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
    let result = await ImagePicker.launchImageLibraryAsync({ 
      mediaTypes: ['images', 'videos'], // Новый API вместо deprecated MediaTypeOptions
      quality: 0.8 
    });
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

  const handleImageError = (uri) => {
    console.log('Image load failed:', uri);
    setFailedImages(prev => new Set([...prev, uri]));
  };

  const openUrl = (url) => {
    Linking.openURL(url).catch(err => {
      console.error('Failed to open URL:', err);
      Alert.alert('Ошибка', 'Не удалось открыть ссылку');
    });
  };

  const renderMessageContent = (item) => {
    const isOut = item.type === 'out';
    const uri = item.body;
    const textColor = isOut ? '#fff' : AppColors.darkWalnut;
    const iconColor = isOut ? '#fff' : AppColors.primaryBrown;

    // Не URL — просто текст
    if (!isValidUrl(uri)) {
      return <Text style={isOut ? styles.msgTextOut : styles.msgTextIn}>{item.body}</Text>;
    }

    // Изображение (включая GIF)
    if (isImageUrl(uri) && !failedImages.has(uri)) {
      return (
        <TouchableOpacity onPress={() => openUrl(uri)} activeOpacity={0.9}>
          <Image 
            source={{ uri }} 
            style={styles.imageAttachment} 
            resizeMode="cover"
            onError={() => handleImageError(uri)}
          />
        </TouchableOpacity>
      );
    }

    // Аудио
    if (isAudioUrl(uri)) {
      const isPlaying = playingUri === uri;
      const playAudio = async () => {
        try {
          if (sound) await sound.unloadAsync();
          if (isPlaying) { setPlayingUri(null); return; }
          const { sound: newSound } = await Audio.Sound.createAsync({ uri });
          setSound(newSound);
          setPlayingUri(uri);
          await newSound.playAsync();
          newSound.setOnPlaybackStatusUpdate((status) => {
            if (status.didJustFinish) setPlayingUri(null);
          });
        } catch (e) {
          console.error('Audio play error:', e);
          Alert.alert('Ошибка', 'Не удалось воспроизвести аудио');
        }
      };
      return (
        <TouchableOpacity onPress={playAudio} style={styles.fileContainer}>
          <AntDesign name={isPlaying ? "pausecircleo" : "playcircleo"} size={32} color={iconColor} />
          <Text style={[isOut ? styles.msgTextOut : styles.msgTextIn, {marginLeft: 8, flex: 1}]} numberOfLines={1}>
            {getFileName(uri)}
          </Text>
        </TouchableOpacity>
      );
    }

    // Видео
    if (isVideoUrl(uri)) {
      return (
        <TouchableOpacity onPress={() => openUrl(uri)} style={styles.fileContainer}>
          <Ionicons name="videocam-outline" size={30} color={iconColor} />
          <View style={{marginLeft: 8, flex: 1}}>
            <Text style={[isOut ? styles.msgTextOut : styles.msgTextIn]} numberOfLines={1}>
              {getFileName(uri)}
            </Text>
            <Text style={{color: isOut ? 'rgba(255,255,255,0.7)' : '#999', fontSize: 11}}>
              Нажмите для просмотра
            </Text>
          </View>
        </TouchableOpacity>
      );
    }

    // Общий файл / битая картинка / ссылка
    return (
      <TouchableOpacity onPress={() => openUrl(uri)} style={styles.fileContainer}>
        <Feather name="file" size={28} color={iconColor} />
        <View style={{marginLeft: 8, flex: 1}}>
          <Text style={[isOut ? styles.msgTextOut : styles.msgTextIn]} numberOfLines={2}>
            {getFileName(uri)}
          </Text>
          <Text style={{color: isOut ? 'rgba(255,255,255,0.7)' : '#999', fontSize: 11}}>
            Нажмите для открытия
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  const renderMessage = useCallback(({item, index}) => {
    const isOut = item.type === 'out';
    const time = new Date(item.timestamp).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
    const status = getMessageStatus(item, index, messages);
    
    return (
      <Pressable onLongPress={() => {
        if (!isValidUrl(item.body)) {
          Clipboard.setString(item.body);
          Alert.alert('', 'Скопировано в буфер');
        }
      }}>
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
  }, [messages, lastReadId, playingUri, failedImages]);

  return (
    <View style={styles.container}>
      <FlatList 
        ref={listRef}
        style={styles.list}
        data={messages} 
        keyExtractor={(item, index) => item.id || `${index}`}
        renderItem={renderMessage}
        contentContainerStyle={styles.messagesList}
        keyboardShouldPersistTaps="handled"
        extraData={[lastReadId, playingUri, failedImages]}
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
