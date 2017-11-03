var bunyan = require('bunyan');
var PrettyStream = require('bunyan-pretty-colors');
var prettyStdOut = new PrettyStream({ mode: 'short' });

prettyStdOut.pipe(process.stdout);

function obj() {}

if (!obj.log) {
  obj.log = bunyan.createLogger({
    name    : 'App',
    streams : [
      {
        level  : 'debug',
        // level  : 'info', // DEFAULT
        type   : 'raw',
        stream : prettyStdOut
      }
    ]
  });
}

module.exports = obj;
