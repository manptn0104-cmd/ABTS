const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');

const config = getDefaultConfig(__dirname);

// Fix: Metro's file map may not hash files in metro-runtime/src on Windows.
// Override getSha1 to compute from disk when the file map doesn't have it.
const originalGetSha1 = config.getSha1;
config.getSha1 = (filename) => {
  try {
    if (originalGetSha1) {
      return originalGetSha1(filename);
    }
  } catch (_) {}
  try {
    const content = fs.readFileSync(filename);
    return crypto.createHash('sha1').update(content).digest('hex');
  } catch (_) {
    return '0000000000000000000000000000000000000000';
  }
};

module.exports = config;
