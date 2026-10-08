// Monorepo: watch the whole workspace so edits to ../../copy/*.json and the @sanguine/* packages hot-reload.
const path = require('node:path');
const { getDefaultConfig } = require('expo/metro-config');

const root = path.resolve(__dirname, '../..');
const config = getDefaultConfig(__dirname);
config.watchFolders = [root];
config.resolver.nodeModulesPaths = [path.join(__dirname, 'node_modules'), path.join(root, 'node_modules')];
module.exports = config;
