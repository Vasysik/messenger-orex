import { StyleSheet } from 'react-native';
import { AppColors } from '../constants/Colors';

export const CommonStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: AppColors.backgroundWhite
  },
  header: {
    paddingTop: 15,
    paddingBottom: 20,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 25,
    borderBottomRightRadius: 25
  },
  headerTitle: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold'
  },
  card: {
    flexDirection: 'row',
    padding: 12,
    backgroundColor: '#fff',
    marginHorizontal: 12,
    marginVertical: 4,
    borderRadius: 14,
    shadowColor: AppColors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 2
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center'
  },
  avatarText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold'
  },
  actionBtn: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center'
  },
  modal: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end'
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 25,
    borderTopRightRadius: 25,
    padding: 20,
    paddingBottom: 35
  },
  input: {
    borderWidth: 1,
    borderColor: AppColors.sand,
    borderRadius: 12,
    padding: 12,
    fontSize: 15,
    backgroundColor: AppColors.cream
  },
  btnPrimary: {
    flex: 1,
    padding: 14,
    backgroundColor: AppColors.primaryBrown,
    borderRadius: 12,
    alignItems: 'center'
  },
  btnSecondary: {
    flex: 1,
    padding: 14,
    backgroundColor: '#f0f0f0',
    borderRadius: 12,
    alignItems: 'center'
  }
});
