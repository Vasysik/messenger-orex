import { Platform } from 'react-native';
import EventEmitter from 'events';

let Notifications = null;

try {
  Notifications = require('expo-notifications');
  
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    }),
  });
} catch (e) {
  console.log('expo-notifications not available');
}

class NotificationService extends EventEmitter {
  constructor() {
    super();
    this.expoPushToken = null;
    this.notificationListener = null;
    this.responseListener = null;
    this.isAvailable = false;
  }

  async initialize() {
    if (Platform.OS === 'web' || !Notifications) {
      console.log('Notifications not supported on this platform');
      return;
    }

    try {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        console.log('Notification permissions not granted');
        return;
      }

      this.isAvailable = true;

      if (Platform.OS === 'android') {
        try {
          await Notifications.setNotificationChannelAsync('messages', {
            name: 'Сообщения',
            importance: Notifications.AndroidImportance.HIGH,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: '#8B4513',
            sound: 'default',
          });

          await Notifications.setNotificationChannelAsync('calls', {
            name: 'Звонки',
            importance: Notifications.AndroidImportance.MAX,
            vibrationPattern: [0, 500, 200, 500, 200, 500],
            lightColor: '#4CAF50',
            sound: 'default',
          });
        } catch (e) {
          console.log('Failed to create notification channels:', e.message);
        }
      }

      this.notificationListener = Notifications.addNotificationReceivedListener(notification => {
        this.emit('notification_received', notification);
      });

      this.responseListener = Notifications.addNotificationResponseReceivedListener(response => {
        const data = response.notification.request.content.data;
        this.emit('notification_tapped', data);
      });

      try {
        const tokenData = await Notifications.getExpoPushTokenAsync({
          projectId: '8a3e89fd-68e5-41fb-9f4b-354501eac107'
        });
        this.expoPushToken = tokenData.data;
        console.log('Push token:', this.expoPushToken);
      } catch (e) {
        console.log('Push tokens not available in Expo Go (SDK 53+)');
      }
    } catch (e) {
      console.log('Notification initialization error:', e.message);
    }
  }

  async showMessageNotification(fromJid, messageBody) {
    if (!this.isAvailable || !Notifications) return;

    try {
      const senderName = fromJid.split('@')[0];
      
      await Notifications.scheduleNotificationAsync({
        content: {
          title: senderName,
          body: messageBody.length > 100 ? messageBody.substring(0, 100) + '...' : messageBody,
          data: { type: 'message', jid: fromJid },
          sound: 'default',
        },
        trigger: null,
      });
    } catch (e) {
      console.log('Failed to show notification:', e.message);
    }
  }

  async showCallNotification(fromJid, isVideo = false) {
    if (!this.isAvailable || !Notifications) return;

    try {
      const callerName = fromJid.split('@')[0];
      
      await Notifications.scheduleNotificationAsync({
        content: {
          title: isVideo ? 'Видеозвонок' : 'Входящий звонок',
          body: `${callerName} звонит вам`,
          data: { type: 'call', jid: fromJid, isVideo },
          sound: 'default',
          priority: 'max',
        },
        trigger: null,
      });
    } catch (e) {
      console.log('Failed to show call notification:', e.message);
    }
  }

  async cancelAllNotifications() {
    if (!this.isAvailable || !Notifications) return;
    try {
      await Notifications.cancelAllScheduledNotificationsAsync();
    } catch (e) {}
  }

  async setBadgeCount(count) {
    if (!this.isAvailable || !Notifications) return;
    try {
      await Notifications.setBadgeCountAsync(count);
    } catch (e) {}
  }

  getExpoPushToken() {
    return this.expoPushToken;
  }

  cleanup() {
    if (this.notificationListener) {
      try {
        Notifications.removeNotificationSubscription(this.notificationListener);
      } catch (e) {}
    }
    if (this.responseListener) {
      try {
        Notifications.removeNotificationSubscription(this.responseListener);
      } catch (e) {}
    }
  }
}

export default new NotificationService();
