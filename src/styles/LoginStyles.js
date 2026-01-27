import { StyleSheet } from 'react-native';
import { AppColors } from '../constants/Colors';

export const LoginStyles = StyleSheet.create({
  container: {
    flex: 1
  },
  keyboardView: {
    flex: 1
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 25
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 40
  },
  logoCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16
  },
  logo: {
    width: 85,
    height: 85
  },
  title: {
    fontSize: 36,
    color: '#fff',
    fontWeight: 'bold',
    letterSpacing: 2
  },
  subtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 4
  },
  formContainer: {
    width: '100%'
  },
  inputContainer: {
    marginBottom: 16
  },
  inputLabel: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 13,
    marginBottom: 6,
    marginLeft: 4,
    fontWeight: '600'
  },
  input: {
    width: '100%',
    height: 50,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 14,
    paddingHorizontal: 16,
    color: '#fff',
    fontSize: 15,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)'
  },
  button: {
    width: '100%',
    height: 52,
    borderRadius: 14,
    overflow: 'hidden',
    marginTop: 12
  },
  buttonGradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },
  buttonText: {
    color: AppColors.darkWalnut,
    fontSize: 16,
    fontWeight: 'bold'
  },
  footer: {
    position: 'absolute',
    bottom: 30
  },
  footerText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 11,
    letterSpacing: 1
  }
});
