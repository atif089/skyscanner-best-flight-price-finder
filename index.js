// prettier-ignore
const config     = require('./config'),
      logger     = require('./logger'),
      fs         = require('fs'),
      async      = require('async'),
      AsciiTable = require('ascii-table'),
      dateFormat = require('dateformat'),
      _          = require('lodash'),
      scanner    = require('./lib/scanner'),
      mailer     = require('./lib/mailer');

function main() {}

main.start = function() {
  // prettier-ignore
  let x        = 1,
      mailData = '',
      table    = new AsciiTable();

  table.setBorder(' ', '-', ' ', ' ');
  table.setHeading('price', 'dep. time', 'ret. time', 'dep. from', 'dep. via', 'ret. via', 'carrier', 'Book URL');

  var dateCombos = generateItineryOptions(config.dateCombos);

  async.eachSeries(
    dateCombos,
    function(thisTrip, next) {
      async.series(
        [
          function(cb) {
            scanner.createSessionwithDate(thisTrip[0], thisTrip[1], thisTrip[2], cb);
          }
        ],
        function(err, data) {
          var data = data[0];

          if (data) {
            data.map(function(thisRow) {
              table.addRow(thisRow);
              table.sort(function(a, b) {
                return a[0] - b[0];
              });
            });
          }

          mailData = table.toString();
          fs.writeFileSync('data.txt', mailData, { encoding: 'utf-8' });
          setTimeout(next, config.pollInterval);
        }
      );
    },
    function(err) {
      if (err) {
        return console.log(err);
      }

      logger.log.info('list complete...', 'sending email');
      let mailerInstance = new mailer(mailData);
      mailerInstance.sendMail(mailData);
    }
  );
};

/**
 * generate a list of dates baased on the date range that is used to be fed
 * to the price grabber
 * @param {*} dateCombos
 * @return {*} dateComboFinalRange 
 */
function generateItineryOptions(dateCombos) {
  let _profiler = new Date(),
      _dateCombos = [];

  logger.log.debug('Generating Itinerary Options', 'generateItineryOptions');

  dateCombos.forEach(function(currentRange) {
    let startDate = new Date(currentRange.startDate.value);
    let returnDate = new Date(currentRange.returnDate.value);
    for (let i = 0; i <= currentRange.startDate.lookAheadRange; i++) {
      for (let j = 0; j <= currentRange.returnDate.lookAheadRange; j++) {
        if (returnDate - startDate <= 60000) continue;
        let currentStartDate = new Date(startDate);
        let currentReturnDate = new Date(returnDate);
        currentStartDate.setDate(currentStartDate.getDate() + i);
        currentReturnDate.setDate(currentReturnDate.getDate() + j);
        currentStartDate = dateFormat(currentStartDate, 'yyyy-mm-dd');
        currentReturnDate = dateFormat(currentReturnDate, 'yyyy-mm-dd');
        _dateCombos.push([currentStartDate, currentReturnDate, currentRange.routeOptions]);
      }
    }
  });

  // get only unique ones
  _.uniqBy(_dateCombos, function(a) {
    return a[0] + a[1] + a[2].originPlace + a[2].destinationPlace;
  });

  logger.log.info('%s Itinerary Options Found', _dateCombos.length);
  logger.log.debug('took %s ms', new Date() - _profiler, 'generateItineryOptions');
  return _dateCombos;
}

// exports
module.exports = main;
