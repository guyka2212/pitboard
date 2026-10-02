const os = require('os');

function localIPv4Addresses() {
  return Object.values(os.networkInterfaces())
    .flat()
    .filter((i) => i && i.family === 'IPv4' && !i.internal)
    .map((i) => i.address);
}

module.exports = { localIPv4Addresses };
