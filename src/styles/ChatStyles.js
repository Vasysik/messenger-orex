import { StyleSheet, Platform } from 'react-native';
import { AppColors } from '../constants/Colors';

export const ChatStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: AppColors.backgroundWhite,
    ...(Platform.OS === 'web' && {
      height: 'calc(100vh - 64px)',
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      overflow: 'hidden',
    })
  },
  list: {
    flex: 1,
    ...(Platform.OS === 'web' && {
      height: '0px', 
      flexGrow: 1,
    })
  },
  messagesList: {
    padding: 12,
    paddingBottom: 20
  },
  msgWrapper: {
    marginVertical: 3
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
    maxWidth: '80%',
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
    maxWidth: '80%',
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
    marginTop: 4,
    gap: 4
  },
  timeOut: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.7)'
  },
  timeIn: {
    fontSize: 10,
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
    paddingVertical: 10,
    fontSize: 15,
    maxHeight: 100,
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
    width: 220,
    height: 220,
    borderRadius: 12,
    marginVertical: 4,
    backgroundColor: '#f0f0f0'
  },
  fileContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    maxWidth: 240,
    paddingVertical: 6,
    minHeight: 44
  },
  videoThumbnail: {
    width: 200,
    height: 150,
    borderRadius: 10,
    backgroundColor: '#333',
    justifyContent: 'center',
    alignItems: 'center'
  },
  uploadProgressContainer: {
    position: 'absolute',
    bottom: 70,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 100
  },
  uploadProgressContent: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    paddingHorizontal: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minWidth: 200
  },
  uploadProgressText: {
    fontSize: 13,
    color: AppColors.darkWalnut,
    fontWeight: '500'
  },
  uploadProgressBarBg: {
    flex: 1,
    height: 6,
    backgroundColor: '#eee',
    borderRadius: 3,
    overflow: 'hidden'
  },
  uploadProgressBar: {
    height: '100%',
    backgroundColor: AppColors.primaryBrown,
    borderRadius: 3
  },
  syncIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    backgroundColor: 'rgba(139, 69, 19, 0.1)',
    gap: 8
  },
  syncText: {
    fontSize: 12,
    color: AppColors.primaryBrown
  }
});
