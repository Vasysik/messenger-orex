import { StyleSheet } from 'react-native';
import { AppColors } from '../constants/Colors';

export const ChatListStyles = StyleSheet.create({
  top: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  actions: {
    flexDirection: 'row',
    gap: 8
  },
  actionIcon: {
    fontSize: 18
  },
  search: {
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderRadius: 10,
    padding: 10,
    marginTop: 10,
    color: '#fff'
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    position: 'absolute',
    bottom: 0,
    right: 0,
    borderWidth: 2,
    borderColor: '#fff'
  },
  info: {
    flex: 1,
    marginLeft: 12,
    justifyContent: 'center'
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  name: {
    fontSize: 15,
    fontWeight: '600',
    color: AppColors.darkWalnut
  },
  time: {
    fontSize: 11,
    color: '#999'
  },
  msg: {
    fontSize: 13,
    color: '#888',
    flex: 1,
    marginRight: 8
  },
  badge: {
    backgroundColor: AppColors.unread,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6
  },
  badgeTxt: {
    color: '#fff',
    fontSize: 11,
    fontWeight: 'bold'
  },
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 24,
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: AppColors.primaryBrown,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4
  },
  fabTxt: {
    color: '#fff',
    fontSize: 28
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    color: AppColors.darkWalnut,
    marginBottom: 16
  },
  buttons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20
  }
});
