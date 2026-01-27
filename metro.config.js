const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Указываем сборщику, что вместо тяжелых Node-модулей нужно использовать нашу пустышку
config.resolver.extraNodeModules = {
  ...config.resolver.extraNodeModules,
  dns: require.resolve('./src/mocks/dummy.js'),
  net: require.resolve('./src/mocks/dummy.js'),
  tls: require.resolve('./src/mocks/dummy.js'),
  fs: require.resolve('./src/mocks/dummy.js'),
  "node:dns": require.resolve('./src/mocks/dummy.js'), // Перехватываем именно твою ошибку
};

module.exports = config;
