const logger = require('../logger');

/**
 * @returns {string} Random IP Address
 */
function generateRandomIp() {
  // '31.201.243.239';
  var _ip =
    '31' +
    ('.' + (201 + parseInt(Math.random() * 2))) +
    ('.' + (200 + parseInt(Math.random() * 4))) +
    ('.' + parseInt(Math.random() * 255));

  logger.log.debug({ ip: _ip }, 'Random IP Generated', 'generateRandomIp');
  return _ip;
}

module.exports = generateRandomIp;
