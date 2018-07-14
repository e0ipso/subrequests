# Subrequests

[![Coverage Status](https://coveralls.io/repos/github/e0ipso/subrequests/badge.svg)](https://coveralls.io/github/e0ipso/subrequests)
[![Known Vulnerabilities](https://snyk.io/test/github/e0ipso/subrequests/badge.svg)](https://snyk.io/test/github/e0ipso/subrequests)
[![semantic-release](https://img.shields.io/badge/%20%20%F0%9F%93%A6%F0%9F%9A%80-semantic--release-e10079.svg)](https://github.com/semantic-release/semantic-release)
[![Commitizen friendly](https://img.shields.io/badge/commitizen-friendly-brightgreen.svg)](http://commitizen.github.io/cz-cli/)
[![Greenkeeper badge](https://badges.greenkeeper.io/e0ipso/subrequests.svg)](https://greenkeeper.io/)
[![Build Status](https://travis-ci.org/e0ipso/subrequests.svg?branch=master)](https://travis-ci.org/e0ipso/subrequests)

[![NPM](https://nodei.co/npm/subrequests.png)](https://nodei.co/npm/subrequests/)

## Installation

```npm
npm install --save subrequests
```

or

```
yarn add subrequests
```

## Usage

### On the Server

If you want to enable subrequests in an Express application, please see
[Subrequests Express](https://github.com/e0ipso/subrequests-express#readme) to learn how to do so
in two lines of code.

You can use _Subrequests_ anywhere you are serving requests. I makes a lot of sense to add it as a middleware in an
Express application, for instance. In order to provide an easier testing experience _Subrequests_ comes with a super
simple server that will:

  - Collect requests with a blueprint from the consumers.
  - Make an HTTP request for each subrequest in the blueprint resolving dependencies.
  - Respond to the consumer with all the responses to the subrequests in the blueprint.

To start the demo server:

```
npm start
```

That will create the server in `127.0.0.1:3456`. This server is now ready to receive request blueprints.

#### Use It in Your App

Even if having that small server deployed will already give you a bunch of nice features, _Subrequests_ is most useful
when integrated in your stack. _Subrequests_ uses a _"requestor"_ to resolve each request in the blueprint. Best overall
performance will be achieved when resolving the requests to your service locally.

Imagine that you have an Express application. In that you install _Subrequests_ and create a route that accepts
blueprints in `/subrequests`. In that scenario, when the blueprint contains a request you want to treat differenrly
based on some conditions. To do so, extend the `HttpRequestor` as your `MyCustomRequestor`. `MyCustomRequestor`
detects the _special conditions_ in the requests and reacts accordingly (maybe dropping the request)  and uses HTTP to
resolve the other requests. You can tell the system to use your new requestor. Istead of
[this code](./exampleServer.js#L25) use:

```js
subrequests.request(blueprint, new MyCustomRequestor())
```

### Client Code

Once your API server has `subrequests` installed just make a regular request to
the route listening to subrequests.

I created a collection of JSON documents for this test that you can use. You can
find them in
[foo-bar.json](https://gist.github.com/e0ipso/7cafb6b7debe786cfb60f617fa89ba81).

```js
// You can use whatever HTTP library you like.
const axios = require('axios');

const blueprint = [
  {
    requestId: 'req1',
    uri: 'https://gist.githubusercontent.com/e0ipso/7cafb6b7debe786cfb60f617fa89ba81/raw/a6590d3cc87d0c00485c9e428c8b7c29da21b704/foo-bar.json',
    action: 'view'
  },
  {
    requestId: 'req2',
    uri: 'https://gist.githubusercontent.com/e0ipso/7cafb6b7debe786cfb60f617fa89ba81/raw/a6590d3cc87d0c00485c9e428c8b7c29da21b704/the-end.json',
    action: 'view'
  },
  {
    requestId: 'req1.1',
    uri: "https://gist.githubusercontent.com/e0ipso/7cafb6b7debe786cfb60f617fa89ba81/raw/a6590d3cc87d0c00485c9e428c8b7c29da21b704/{{req1.body@$['my-key']}}.json",
    action: 'view',
    waitFor: ['req1']
  },
  {
    requestId: 'req1.1.1',
    uri: 'https://gist.githubusercontent.com/e0ipso/7cafb6b7debe786cfb60f617fa89ba81/raw/a6590d3cc87d0c00485c9e428c8b7c29da21b704/{{req1.1.body@$.akward[*]}}.json',
    action: 'view',
    waitFor: ['req1.1']
  }
];

// Assuming '/subrequests' is listening for subrequests calls.
axios.get('http://127.0.0.1:3456/subrequests', {
    params: {
      query: JSON.stringify(blueprint),
    }
  })
  .then(function (response) {
    console.log(response);
  })
  .catch(function (error) {
    console.log(error);
  });
```

This will return a response body like the following (it's been abbreviated for
readability purposes).

```
9799c4--
content-length: 23
…
x-subrequest-id: req1
Content-ID: <req1>

{
  "my-key": "lorem"
}
--9799c4
x-cache: HIT
…
x-subrequest-id: req2
Content-ID: <req2>

{
  "runs": {
    "in": "parallel"
  }
}
--9799c4
x-xss-protection: 1; mode=block
expires: Fri, 21 Jul 2017 13:51:19 GMT
…
x-subrequest-id: req1.1#uri{0}
Content-ID: <req1.1#uri{0}>

{
  "akward": ["moar", "hip", "tests"]
}
--9799c4
content-length: 26
…
x-subrequest-id: req1.1.1#uri{0}
Content-ID: <req1.1.1#uri{0}>

[
  {
    "ha": "li"
  }
]
--9799c4
date: Fri, 21 Jul 2017 13:46:19 GMT
via: 1.1 varnish
…
x-subrequest-id: req1.1.1#uri{1}
Content-ID: <req1.1.1#uri{1}>

true
--9799c4
etag: "1a55725f5478ba88781322669bc08b4b633e67a0"
content-type: text/plain; charset=utf-8
…
x-subrequest-id: req1.1.1#uri{2}
Content-ID: <req1.1.1#uri{2}>

{
  "we need": "nonsensical strings"
}
--9799c4--
```

#### Customizing the Response Format

If you want to have a different format consider providing a different
sub-responses merger. You can see an example of that in the
[`subrequests-json-merger`](https://github.com/e0ipso/subrequests-json-merger) contributed module. For greater control,
write your own!
