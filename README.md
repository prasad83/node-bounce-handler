Usage
=====

  ```javascript```
  var BounceHandler = require('node-bounce-handler').BounceHandler;

  var bh = new BounceHandler();
  var bounceResult = bh.parse\_email(emlDataString);


NodeJS Bounce Handler
=====================
Ported (PHP-Bounce-Handler - https://github.com/cfortune/PHP-Bounce-Handler v7.3) code
to NodeJS.

About PHP-Bounce-Handler
========================
This class can be used to parse bounced message reports. 
It parses e-mail messages with multipart report content type formatted 
according to RFC 1892 and 1894 documents. If the bounce is not well formed, 
it also tries to extract some useful information. Exim is supported, partially. 
More... http://anti-spam-man.com/php_bouncehandler/

