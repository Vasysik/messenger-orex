import { StyleSheet } from 'react-native';
import { AppColors } from '../constants/Colors';

export const ChatStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: AppColors.backgroundWhite
  },
  messagesList: {
    padding: 12
  },
  msgWrapper: {
    marginVertical: 2
  },
  msgWrapperIn: {
    alignItems: 'flex-start'
  },
  msgWrapperOut: {
    alignItems: 'flex-end'
  },
  msgOut: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    borderBottomRightRadius: 4,
    maxWidth: '78%',
    shadowColor: AppColors.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 3,
    elevation: 1
  },
  msgIn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    borderBottomLeftRadius: 4,
    maxWidth: '78%',
    backgroundColor: '#fff',
    shadowColor: AppColors.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 1
  },
  msgTextOut: {
    fontSize: 15,
    color: '#fff',
    lineHeight: 20
  },
  msgTextIn: {
    fontSize: 15,
    color: AppColors.darkWalnut,
    lineHeight: 20
  },
  msgFooter: {
    flexDirection: 'row',
    alignSelf: 'flex-end',
    alignItems: 'center',
    marginTop: 3,
    gap: 3
  },
  timeOut: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.7)'
  },
  timeIn: {
    fontSize: 10,
    color: AppColors.textLight,
    alignSelf: 'flex-end',
    marginTop: 3
  },
  tick: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.8)'
  },
  inputBar: {
    flexDirection: 'row',
    padding: 10,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: AppColors.sand,
    alignItems: 'flex-end',
    gap: 8
  },
  input: {
    flex: 1,
    backgroundColor: AppColors.cream,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    fontSize: 15,
    maxHeight: 90,
    borderWidth: 1,
    borderColor: AppColors.sand,
    color: AppColors.darkWalnut
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center'
  },
  sendBtnTxt: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold'
  },
  attachBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center'
  },
  imageAttachment: {
    width: 200,
    height: 200,
    borderRadius: 10,
    marginTop: 4
  },
  fileContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    maxWidth: 220,
    paddingVertical: 4
  }
});
