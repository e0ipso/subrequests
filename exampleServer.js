const http = require('http');
const subrequests = require('./lib/index');
const querystring = require('querystring');
const util = require('util');

const server = http.createServer();

server.on('request', (req, res) => {
  // All this code is not specific of Subrequests, we need to have the request
  // body string. This is the standard way to do it with nodejs' http server.
  let body = '';
  req.on('data', (chunk) => {
    body += chunk;
  });
  new Promise((resolve) => {
    req.on('end', (chunk) => {
      body += chunk || '';
      const [url, qs] = req.url.split('?');
      const query = querystring.parse(qs || '').query;
      resolve(body.length ? body : query);
    });
  })
  // ----- This is the stuff that you care about -----
  // Generate a single response with many subresponses.
    .then(blueprint => subrequests.request(blueprint))
    .then((response) => {
      // Write all the headers to the response.
      const headers = {};
      response.headers.forEach((value, name) => {
        if (name === 'Status') {
          return;
        }
        headers[name] = value;
      });
      res.writeHead(parseInt(response.headers.get('Status') || '207', 10), headers);
      // Write the body.
      res.write(response.body);
      res.end();
    })
    .catch((e) => {
      const message = util.inspect(e, false, null);
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.write(message);
      res.end();
    });
});

server.listen('3456');
