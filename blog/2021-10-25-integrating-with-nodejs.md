---
title: Centrifugo integration with NodeJS tutorial
tags: [centrifugo, tutorial, proxy]
description: In this tutorial we are integrating Centrifugo with NodeJS. We are using Centrifugo connect proxy feature to authenticate connections over standard Express.js session middleware.
author: Alexander Emelin
authorTitle: Creator of Centrifugo
authorImageURL: https://github.com/FZambia.png
hide_table_of_contents: false
---

Centrifugo is a scalable real-time messaging server in a language-agnostic way. In this tutorial we will integrate Centrifugo with NodeJS backend using a connect proxy feature of Centrifugo for user authentication and native session middleware of ExpressJS framework.

Why would NodeJS developers want to integrate a project with Centrifugo? This is a good question especially since there are lots of various tools for real-time messaging available in NodeJS ecosystem.

<!--truncate-->

I found several points which could be a good motivation:

* Centrifugo scales well – we have a very optimized Redis Engine with client-side sharding and Redis Cluster support. We can also scale with KeyDB, Nats, or Tarantool. Centrifugo can scale to millions connections distributed over different server nodes.
* Centrifugo is pretty fast (written in Go) and can handle thousands of clients per node. Client protocol is optimized for thousands of messages per second.
* Centrifugo provides a variety of features out-of-the-box – some of them are unique, especially for real-time servers that scale to many nodes.
* Centrifugo works as a separate service – so can be a universal tool in developer's pocket, can migrate from one project to another, no matter what programming language or framework is used for a business logic.

Having said this all – let's move to a tutorial itself.

## What we are building

Not a super-cool app to be honest. Our goal here is to give a reader an idea how integration with Centrifugo could look like. There are many possible apps which could be built on top of this knowledge.

The end result here will allow application user to authenticate and once authenticated – connect to Centrifugo. Centrifugo will proxy connection requests to NodeJS backend and native ExpressJS session middleware will be used for connection authentication. We will also send some periodical real-time messages to a user personal channel.

The [full source code of this tutorial](https://github.com/centrifugal/examples/tree/master/nodejs_proxy) located on Github. You can clone examples repo and run this demo by simply writing:

```bash
docker compose up
```

## Creating Express.js app

Start new NodeJS app:

```bash
npm init
```

Install dependencies:

```bash
npm install express express-session cookie-parser axios morgan
```

Create `index.js` file.

```javascript title="index.js"
const express = require('express');
const cookieParser = require("cookie-parser");
const sessions = require('express-session');
const morgan = require('morgan');
const axios = require('axios');

const app = express();
const port = 3000;
app.use(express.json());

const oneDay = 1000 * 60 * 60 * 24;

app.use(sessions({
  secret: "this_is_my_secret_key",
  saveUninitialized: true,
  cookie: { maxAge: oneDay },
  resave: false
}));
app.use(cookieParser());
app.use(express.urlencoded({ extended: true }))
app.use(express.json())
app.use(express.static('static'));
app.use(morgan('dev'));

app.get('/', (req, res) => {
  if (req.session.userid) {
    res.sendFile('views/app.html', { root: __dirname });
  } else
    res.sendFile('views/login.html', { root: __dirname })
});

app.listen(port, () => {
  console.log(`Example app listening at http://localhost:${port}`);
});
```

Create `login.html` file in `views` folder:

```html title="views/login.html"
<html>

<body>
    <form action="/login" method="post">
        <h2>Login (username: demo-user, password: demo-pass)</h2>
        <div class="input-field">
            <input type="text" name="username" id="username" placeholder="Enter Username">
        </div>
        <div class="input-field">
            <input type="password" name="password" id="password" placeholder="Enter Password">
        </div>
        <input type="submit" value="Log in">
    </form>
</body>

</html>
```

Also create `app.html` file in `views` folder:

```html title="views/app.html"
<html>

<head>
  <link rel="stylesheet" href="app.css">
  <script src="https://cdn.jsdelivr.net/gh/centrifugal/centrifuge-js@2.8.3/dist/centrifuge.min.js"></script>
</head>

<body>
  <div>
    <a href='/logout'>Click to logout</a>
  </div>
  <div id="log"></div>
</body>

</html>
```

Make attention that we import `centrifuge-js` client here which abstracts away Centrifugo bidirectional WebSocket protocol.

Let's write an HTTP handler for login form:

```javascript title="index.js"
const myusername = 'demo-user'
const mypassword = 'demo-pass'

app.post('/login', (req, res) => {
  if (req.body.username == myusername && req.body.password == mypassword) {
    req.session.userid = req.body.username;
    res.redirect('/');
  } else {
    res.send('Invalid username or password');
  }
});
```

In this example we use hardcoded username and password for out single user. Of course in real app you will have a database with user credentials. But since our goal is only show integration with Centrifugo – we are skipping these hard parts here.

Also create a handler for a logout request:

```javascript title="index.js"
app.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/');
});
```

Now if you run an app with `node index.js` you will see a login form using which you can authenticate. At this point this is a mostly convenient NodeJS application, let's add Centrifugo integration. 

## Starting Centrifugo

Run Centrifugo with `config.json` like this:

```json title="config.json"
{
  "token_hmac_secret_key": "secret",
  "admin": true,
  "admin_password": "password",
  "admin_secret": "my_admin_secret",
  "api_key": "my_api_key",
  "allowed_origins": [
    "http://localhost:9000"
  ],
  "user_subscribe_to_personal": true,
  "proxy_connect_endpoint": "http://localhost:3000/centrifugo/connect",
  "proxy_http_headers": [
    "Cookie"
  ]
}
```

I.e.:

```
./centrifugo -c config.json
```

Create `app.js` file in `static` folder:

```javascript title="static/app.js"
function drawText(text) {
    const div = document.createElement('div');
    div.innerHTML = text;
    document.getElementById('log').appendChild(div);
}

const centrifuge = new Centrifuge('ws://localhost:9000/connection/websocket');

centrifuge.on('connect', function () {
    drawText('Connected to Centrifugo');
});

centrifuge.on('disconnect', function () {
    drawText('Disconnected from Centrifugo');
});

centrifuge.on('publish', function (ctx) {
    drawText('Publication, time = ' + ctx.data.time);
});

centrifuge.connect();
```

## Adding Nginx

Since we are going to use native session auth of ExpressJS we can't just connect from localhost:3000 (where our NodeJS app is served) to Centrifugo running on localhost:8000 – browser won't send a `Cookie` header to Centrifugo in this case. Due to this reason we need a reverse proxy which will terminate a traffic from frontend and proxy requests to NodeJS process or to Centrifugo depending on URL path. In this case both browser and NodeJS app will share the same origin – so Cookie will be sent to Centrifugo in WebSocket Upgrade request.

:::tip

Alternatively, we could also use [JWT authentication](/docs/server/authentication) of Centrifugo but that's a topic for another tutorial. Here we are using [connect proxy feature](/docs/server/proxy#connect-proxy) for auth. 

:::

Nginx config will look like this:

```
server {
  listen 9000;

  server_name localhost;

  location / {
    proxy_pass http://localhost:3000;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Fowarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Fowarded-Proto $scheme;
  }

  location /connection {
    proxy_pass http://localhost:8000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Fowarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Fowarded-Proto $scheme;
    proxy_cache_bypass $http_upgrade;
  }
}
```

Run Nginx and open [http://localhost:9000](http://localhost:9000). After authenticating in app you should see an attempt to connect to a WebSocket endpoint. But connection will fail since we need to implement connect proxy handler in NodeJS app.

```javascript title="index.js"
app.post('/centrifugo/connect', (req, res) => {
  if (req.session.userid) {
    res.json({
      result: {
        user: req.session.userid
      }
    });
  } else
    res.json({
      disconnect: {
        code: 1000,
        reason: "unauthorized",
        reconnect: false
      }
    });
});
```

Restart NodeJS process and try opening an app again. Application should now successfully connect to Centrifugo.

## Send real-time messages

Let's also periodically publish current server time to a client's personal channel. In Centrifugo configuration we set a `user_subscribe_to_personal` option which turns on [automatic subscription to a personal channel](/docs/server/server_subs#automatic-personal-channel-subscription) for each connected user. We can use `axios` library and send publish API requests to Centrifugo periodically (according to [API docs](/docs/server/server_api#http-api)): 

```javascript title="index.js"
const centrifugoApiClient = axios.create({
  baseURL: `http://centrifugo:8000/api`,
  headers: {
    Authorization: `apikey my_api_key`,
    'Content-Type': 'application/json',
  },
});

setInterval(async () => {
  try {
    await centrifugoApiClient.post('', {
      method: 'publish',
      params: {
        channel: '#' + myusername, // construct personal channel name.
        data: {
          time: Math.floor(new Date().getTime() / 1000),
        },
      },
    });
  } catch (e) {
    console.error(e.message);
  }
}, 5000);
```

After restarting NodeJS you should see periodical updates on application web page.

You can also log in into Centrifugo admin web UI [http://localhost:8000](http://localhost:8000) using password `password` - and play with other available server API from within web interface.

## Conclusion

While not being super useful this example can help understanding core concepts of Centrifugo - specifically connect proxy feature and server API.

It's possible to use unidirectional Centrifugo transports instead of bidrectional WebSocket used here – in this case you can go without using `centrifuge-js` at all.

This application scales perfectly if you need to handle more connections – thanks to Centrifugo builtin PUB/SUB engines.

It's also possible to use client-side subscriptions, keep channel history cache, enable channel presence and more. All the power of Centrifugo is in your hands.
