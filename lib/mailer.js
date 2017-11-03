// prettier-ignore
const config        = require('../config'),
      nodemailer    = require('nodemailer'),
      authTransport = config.mailer.authTransport;

function mailer(mailData) {
  this.mailOptions = {
    to      : 'example@example.com',
    cc      : 'example@example.com',
    subject : 'Skyscanner Tickets Price List',
    html    : '',
    text    : mailData
  };
}

mailer.prototype.sendMail = function sendMail() {
  // create reusable transporter object using the default SMTP transport
  const transporter = nodemailer.createTransport(authTransport);

  // send mail with defined transport object
  transporter.sendMail(this.mailOptions, function(error, info) {
    if (error) {
      return new Error(error);
    }
    console.log('Message sent: ' + info.response);
  });
};

module.exports = mailer;
