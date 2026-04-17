const { getDefaultConfig } = require('expo/metro-config')

const config = getDefaultConfig(__dirname)

// Firebase 11 uses .mjs files — Metro needs to know about them
config.resolver.sourceExts = [...config.resolver.sourceExts, 'mjs']

module.exports = config
