// prettier-ignore
const config      = require('../config'),
      logger      = require('../logger'),
      _           = require('lodash'),
      request     = require('request'),
      dateFormat  = require('dateformat'),
      
      // other constants
      apiEndpoint = config.apiEndpoint,
      apiKey      = config.apiKey;

/**
 * constructor
 */
function flightScanner() {}

/**
 * initialize a skyscanner session with dates
 * @param  {string} departDate - date in YYYY-MM-DD format ex. 2023-01-17
 * @param  {string} returnDate - date in YYYY-MM-DD format ex. 2023-01-17
 * @param  {Object} moreOptions - a lot of options
 * @param  {string} moreOptions.originPlace - 3 letter destination code
 * @param  {string} moreOptions.destinationPlace - 3 letter destination code
 * @param  {number} moreOptions.passengers - 3 letter destination code
 * @param  {*} cb - callback function
 * @return {null}
 */
flightScanner.createSessionwithDate = function(departDate, returnDate, moreOptions, cb) {
  let sessionIdentifier = `${moreOptions.originPlace}-${moreOptions.destinationPlace} (${departDate}::${returnDate})`;

  request(
    {
      method  : 'POST',
      url     : apiEndpoint,
      headers : {
        accept            : 'application/json',
        'content-type'    : 'application/x-www-form-urlencoded',
        'X-Forwarded-For' : config.XForwardIPAddress || '31.201.243.239'
      },
      form: {
        apiKey           : apiKey,
        country          : config.market,
        currency         : config.currency,
        locale           : config.locale,
        originPlace      : moreOptions.originPlace,
        destinationPlace : moreOptions.destinationPlace,
        outbounddate     : departDate,
        inbounddate      : returnDate || '',
        adults           : moreOptions.passengers || '1',
        cabinClass       : 'economy',
        locationschema   : 'iata'
      }
    },
    function(err, response) {
      if (!response.headers.location) {
        logger.log.error('unable to get prices for this session from skyscanner', 'err', 'createSessionwithDate');
        return cb('Skyscanner Error', 'err');
      }

      logger.log.info(`skyscanner session created ${sessionIdentifier}`, 'createSessionwithDate');

      // From their API, after creating the session please allow at
      // least 1 second before polling the session
      setTimeout(function() {
        logger.log.info(`Fetching price list ${sessionIdentifier}`, 'createSessionwithDate');
        flightScanner.getPricesList(response.headers.location, moreOptions, sessionIdentifier, cb);
      }, 1200);
    }
  );
};

/**
 * get prices list for a given date
 * @param  {string}   url
 * @param  {Object}   options
 * @param  {Function} callback
 * @return {Array}  array of itineraries
 */
flightScanner.getPricesList = function(url, moreOptions, sessionIdentifier, cb) {
  var _self = this;
  var getPricesListArguments = arguments;
  var requestOptions = {
    method : 'GET',
    url    : url,
    qs     : _.merge(
      {
        apiKey : apiKey,
        stops  : moreOptions.stops || '1'
      },
      moreOptions
    )
  };

  request(requestOptions, function handleSkyScannerPriceList(err, response, body) {
    if (err || !body) {
      if (err) {
        logger.log.error(err);
      }

      // poll again
      if (response.statusCode == 304) {
        logger.log.info('304 Poll again', 'handleSkyScannerPriceList');
        return setTimeout(function() {
          _self.getPricesList.apply(_self, getPricesListArguments);
        }, 1100);
      }

      logger.log.warn(`Response Body Missing for session ${sessionIdentifier}`, 'handleSkyScannerPriceList');
      return cb('unable to follow prices location link on skyscanner');
    }

    // prettier-ignore
    let _PriceListFinal   = [],
        _profiler         = new Date(),
        pricingInfo       = JSON.parse(body);

    if (!pricingInfo.Itineraries) {
      logger.log.warn(`Unable to parse body for session ${sessionIdentifier}`, 'handleSkyScannerPriceList');
    }

    logger.log.info(
      `${pricingInfo.Itineraries.length} Itineraries received for session ${sessionIdentifier}`,
      'handleSkyScannerPriceList'
    );

    // filter out high priced tickets
    if (moreOptions.maxPrice && moreOptions.maxPrice) {
      pricingInfo.Itineraries = _.filter(pricingInfo.Itineraries, function(v) {
        return moreOptions.maxPrice >= v.PricingOptions[0].Price;
      });
    }

    logger.log.info(
      `${pricingInfo.Itineraries.length} Itineraries after filter for session ${sessionIdentifier}`,
      'handleSkyScannerPriceList'
    );

    if (!pricingInfo.Itineraries) return;

    pricingInfo.Itineraries.map(function(thisItinerary) {
      let ticketPrice = thisItinerary.PricingOptions[0].Price;

      // Legs
      let outboundLeg = _.find(pricingInfo.Legs, { Id: thisItinerary.OutboundLegId });
      let inboundLeg = _.find(pricingInfo.Legs, { Id: thisItinerary.InboundLegId });

      // carriers
      let Carriers = getCarrierInfo(outboundLeg, inboundLeg, pricingInfo);

      // set departure and arrival
      var departureDate = dateFormat(new Date(outboundLeg.Departure), 'mmmm dS, yyyy, h:MM:ss TT');
      var returnDate =
        inboundLeg && inboundLeg.Departure
          ? dateFormat(new Date(inboundLeg.Departure), 'mmmm dS, yyyy, h:MM:ss TT')
          : '';

      var outFrom = _.find(pricingInfo.Places, { Id: outboundLeg.OriginStation })['Name'];

      // set stops
      try {
        var outVia = _.find(pricingInfo.Places, { Id: outboundLeg.Stops[0] })['Name'];
      } catch (err) {
        outVia = '';
      }

      try {
        var inVia = _.find(pricingInfo.Places, { Id: inboundLeg.Stops[0] })['Name'];
      } catch (err) {
        inVia = '';
      }

      // set booking URL
      var bookURL = thisItinerary.PricingOptions[0].DeeplinkUrl;

      // add row
      _PriceListFinal.push([ticketPrice, departureDate, returnDate, outFrom, outVia, inVia, Carriers, bookURL]);
    });

    // profiling
    logger.log.debug('Parsed %s results in %s ms', _PriceListFinal.length, new Date() - _profiler);

    return cb(null, _PriceListFinal);
  });
};

/**
 * 
 * @param {*} Carriers 
 * @param {*} outboundLeg 
 * @param {*} inboundLeg 
 * @param {*} pricingInfo 
 */
function getCarrierInfo(outboundLeg, inboundLeg, pricingInfo) {
  let _carriers = [];
  _carriers = _.concat(_carriers, outboundLeg.OperatingCarriers);
  _carriers = inboundLeg ? (_carriers = _.concat(_carriers, inboundLeg.OperatingCarriers)) : _carriers;
  _carriers = _.uniq(_carriers);
  _carriers.map(function(thisCarrier, index) {
    thisCarrier = _.find(pricingInfo.Carriers, { Id: thisCarrier })['Name'];
    _carriers[index] = thisCarrier;
  });
  return _carriers;
}

module.exports = flightScanner;
