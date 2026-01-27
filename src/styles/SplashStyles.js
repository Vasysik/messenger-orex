import { StyleSheet } from 'react-native';

export const SplashStyles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },
  logoContainer: {
    alignItems: 'center'
  },
  logoCircle: {
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24
  },
  logo: {
    width: 100,
    height: 100
  },
  title: {
    fontSize: 42,
    fontWeight: 'bold',
    color: '#fff',
    letterSpacing: 2
  },
  subtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 8
  },
  loader: {
    flexDirection: 'row',
    position: 'absolute',
    bottom: 80,
    gap: 6
  },
  loaderDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.8)'
  },
  loaderDotDelay1: {
    opacity: 0.6
  },
  loaderDotDelay2: {
    opacity: 0.3
  }
});
