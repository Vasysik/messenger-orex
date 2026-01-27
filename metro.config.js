const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

config.resolver.extraNodeModules = {
  ...config.resolver.extraNodeModules,
  // Полифилы для работы xmpp.js (SCRAM-SHA-1 auth)
  crypto: require.resolve('crypto-browserify'),
  stream: require.resolve('stream-browserify'),
  vm: require.resolve('vm-browserify'),
  
  // Заглушки для модулей, которые не нужны в браузере/RN, но требуются библиотеками
  dns: require.resolve('./src/mocks/dummy.js'),
  net: require.resolve('./src/mocks/dummy.js'),
  tls: require.resolve('./src/mocks/dummy.js'),
  fs: require.resolve('./src/mocks/dummy.js'),
  "node:dns": require.resolve('./src/mocks/dummy.js'),
};

module.exports = config;
