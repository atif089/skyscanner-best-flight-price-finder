Script to get live prices from SkyScanner for a date range and find the cheapest route.

## Please do not use this with your production Skyscanner API Key otherwise your API KEY will be blocked by SkyScanner

I was playing around with this and suddenly found that my API Key was revoked. On further inspecting, I found that the calls taht I was making to fetch Live prices are not supposed to be automated as per Skyscanner's API Terms of Use. 

* Uses SkyScanner API Key
* (and optionally) Google's App Specific Password send an email through GMail (https://myaccount.google.com/apppasswords)