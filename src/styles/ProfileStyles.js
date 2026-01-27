import { StyleSheet } from 'react-native';
import { AppColors } from '../constants/Colors';

export const ProfileStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: AppColors.backgroundWhite
  },
  header: {
    paddingTop: 25,
    paddingBottom: 30,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 25,
    borderBottomRightRadius: 25,
    alignItems: 'center'
  },
  avatar: {
    width: 90,
    height: 90,
    borderRadius: 45,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12
  },
  avatarTxt: {
    color: '#fff',
    fontSize: 38,
    fontWeight: 'bold'
  },
  username: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4
  },
  jid: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.7)',
    marginBottom: 12
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6
  },
  statusText: {
    color: '#fff',
    fontSize: 13
  },
  content: {
    flex: 1,
    padding: 16,
    justifyContent: 'flex-end',
    paddingBottom: 30
  },
  logoutBtn: {
    backgroundColor: '#FFEDED',
    padding: 16,
    borderRadius: 14,
    alignItems: 'center'
  },
  logoutTxt: {
    color: AppColors.error,
    fontWeight: 'bold',
    fontSize: 15
  }
});
