import { StyleSheet, Dimensions } from 'react-native';
import { AppColors } from '../constants/Colors';

const { width } = Dimensions.get('window');

export const CallStyles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'space-between',
    paddingTop: 80,
    paddingBottom: 50
  },
  contactInfo: {
    alignItems: 'center'
  },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20
  },
  avatarText: {
    color: '#fff',
    fontSize: 48,
    fontWeight: 'bold'
  },
  contactName: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8
  },
  callStatus: {
    fontSize: 18,
    color: 'rgba(255,255,255,0.8)'
  },
  controls: {
    alignItems: 'center'
  },
  callControls: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 40,
    gap: 40
  },
  controlBtn: {
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.15)',
    minWidth: 80
  },
  controlBtnActive: {
    backgroundColor: 'rgba(255,255,255,0.3)'
  },
  controlLabel: {
    color: '#fff',
    fontSize: 12,
    marginTop: 6
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 60
  },
  acceptBtn: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: AppColors.online,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4
  },
  rejectBtn: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: AppColors.error,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4
  },
  endCallBtn: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: AppColors.error,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4
  }
});
