---
id: quickstart
sidebar_label: Quickstart tutorial
title: Quickstart tutorial ⏱️
---

Here we will build a very simple browser application with Centrifugo. It works in a way that users connect to Centrifugo over WebSocket, subscribe to a channel, and start receiving all messages published to that channel. In our case, we will send a counter value to all channel subscribers to update it in all open browser tabs in real-time.

First you need to [install Centrifugo](installation.md). Below in this example, we will use a binary file release for simplicity. Once you have Centrifugo available on your machine you can generate minimal required configuration file with the following command:

```
./centrifugo genconfig
```

This helper command will generate `config.json` file in the working directory with content like this:

```json title="config.json"
{
  "token_hmac_secret_key": "46b38493-147e-4e3f-86e0-dc5ec54f5133",
  "admin_password": "ad0dff75-3131-4a02-8d64-9279b4f1c57b",
  "admin_secret": "583bc4b7-0fa5-4c4a-8566-16d3ce4ad401",
  "api_key": "aaaf202f-b5f8-4b34-bf88-f6c03a1ecda6",
  "allowed_origins": []
}
```

Now we can start a server. Let's start it with a built-in admin web interface:

```console
./centrifugo --config=config.json --admin
```

We could also enable the admin web interface by not using `--admin` flag but by adding `"admin": true` option to the JSON configuration file:

```json title="config.json"
{
  "token_hmac_secret_key": "46b38493-147e-4e3f-86e0-dc5ec54f5133",
  "admin": true,
  "admin_password": "ad0dff75-3131-4a02-8d64-9279b4f1c57b",
  "admin_secret": "583bc4b7-0fa5-4c4a-8566-16d3ce4ad401",
  "api_key": "aaaf202f-b5f8-4b34-bf88-f6c03a1ecda6",
  "allowed_origins": []
}
```

And then running only with a path to a configuration file:

```console
./centrifugo --config=config.json
```

Now open [http://localhost:8000](http://localhost:8000). You should see Centrifugo admin web panel. Enter `admin_password` value from the configuration file to log in.

![Admin web panel](/img/quick_start_admin.png)

Inside the admin panel, you should see that one Centrifugo node is running, and it does not have connected clients.

Now let's create `index.html` file with our simple app:

```html title="index.html"
<html>
    <head>
        <title>Centrifugo quick start</title>
    </head>
    <body>
        <div id="counter">-</div>
        <script src="https://cdnjs.cloudflare.com/ajax/libs/centrifuge/3.0.0/centrifuge.js"></script>
        <script type="text/javascript">
            const container = document.getElementById('counter');
            
            const centrifuge = new Centrifuge("ws://localhost:8000/connection/websocket", {
              token: "<TOKEN>"
            });

            centrifuge.on('connecting', function(ctx) {
                console.log(`connecting: ${ctx.code}, ${ctx.reason}`);
            }).on('connected', function(ctx) {
                console.log(`connected over ${ctx.transport}`);
            }).on('disconnected', function(ctx) {
                console.log(`disconnected: ${ctx.code}, ${ctx.reason}`);
            }).connect();

            const sub = centrifuge.newSubscription("channel");
            sub.on('publication', function(ctx) {
                container.innerHTML = ctx.data.value;
                document.title = ctx.data.value;
            }).on('subscribing', function(ctx) {
                console.log(`subscribing: ${ctx.code}, ${ctx.reason}`);
            }).on('subscribed', function(ctx) {
                console.log('subscribed', ctx);
            }).on('unsubscribed', function(ctx) {
                console.log(`unsubscribed: ${ctx.code}, ${ctx.reason}`);
            }).subscribe();
        </script>
    </body>
</html>
```

Note that we are using `centrifuge-js` 3.0.0 in this example, you better use its latest version at the moment of reading this tutorial.

In `index.html` above we created an instance of a client (called `Centrifuge`) passing Centrifugo default WebSocket endpoint address to it, then we subscribed to a channel called `channel` and provided a callback function to process incoming real-time messages (publications). Then we called `.subscribe()` to initialte subscription and then `.connect()` method of client to start a WebSocket connection. 

Now you need to serve this file with an HTTP server. In a real-world Javascript application, you will serve your HTML files with a web server of your choice – but for this simple example we can use a simple built-in Centrifugo static file server:

```bash
./centrifugo serve --port 3000
```

Alternatively, if you have Python 3 installed:

```bash
python3 -m http.server 3000
```

These commands start a simple static file web server that serves the current directory on port 3000. Make sure you still have Centrifugo server running. Open [http://localhost:3000/](http://localhost:3000/).

Now if you look at browser developer tools or in Centrifugo logs you will notice that a connection can not be successfully established:

```
2021-09-01 10:17:33 [INF] request Origin is not authorized due to empty allowed_origins origin=http://localhost:3000
```

That's because we have not set `allowed_origins` in the configuration. Modify `allowed_origins` like this:

```json title="config.json"
{
  ...
  "allowed_origins": [
    "http://localhost:3000"
  ]
}
```

Allowed origins is a security option for request originating from web browsers – see [more details](../server/configuration.md#allowed_origins) in server configuration docs. Restart Centrifugo after modifying `allowed_origins` in a configuration file.

Now if you reload a browser window with an application you should see new information logs in server output:

```
2021-02-26 17:47:47 [INF] invalid connection token error="jwt: token format is not valid" client=45a1b8f4-d6dc-4679-9927-93e41c14ad93
2021-02-26 17:47:47 [INF] disconnect after handling command client=45a1b8f4-d6dc-4679-9927-93e41c14ad93 command="id:1 params:\"{\\\"token\\\":\\\"<TOKEN>\\\"}\" " reason="invalid token" user=
```

We still can not connect. That's because the client should provide a valid JWT (JSON Web Token) to authenticate itself. This token **must be generated on your backend** and passed to a client-side (over template variables or using separate AJAX call – whatever way you prefer). Since in our simple example we don't have an application backend we can quickly generate an example token for a user using `centrifugo` sub-command `gentoken`. Like this:

```bash
./centrifugo gentoken -u 123722
```

– where `-u` flag sets user ID. The output should be like this:

```
HMAC SHA-256 JWT for user "123722" with expiration TTL 168h0m0s:
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM3MjIiLCJleHAiOjE2NTUzNjAyODR9.fvlHvZ6o4W7fVUtuu51Mej_JmDfmRR9Qp9yAetl6nLY
```

– you will have another token value since this one is based on randomly generated `token_hmac_secret_key` from the configuration file we created at the beginning of this tutorial. See [authentication docs](../server/authentication.md) for information about proper token generation in real app.

Now we can copy generated HMAC SHA-256 JWT and paste it into Centrifugo constructor instead of `<TOKEN>` placeholder in `index.html` file. I.e.:

```javascript
const centrifuge = new Centrifuge("ws://localhost:8000/connection/websocket", {
    token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM3MjIiLCJleHAiOjE2NTUzNjAyODR9.fvlHvZ6o4W7fVUtuu51Mej_JmDfmRR9Qp9yAetl6nLY"
});
```

If you reload your browser tab – the connection will be successfully established, but the client still can not subscribe to a channel.

We need to give a client permission to subscribe on channel `channel`. Let's do this by issuing subscription token for user using one more command-line helper `gensubtoken`:

```
./centrifugo gensubtoken -u 123722 -s channel
```

You should see an output like this:

```
HMAC SHA-256 JWT for user "123722" and channel "channel" with expiration TTL 168h0m0s:
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM3MjIiLCJleHAiOjE2NTUzNjE1MTQsImNoYW5uZWwiOiJjaGFubmVsIn0.fDI9u692WSnzBmeaWZRqXykPa_emomvtySguUKbojAw
```

Now add the initial subscription token to the example above:

```javascript
const sub = centrifuge.newSubscription("channel", {
  token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM3MjIiLCJleHAiOjE2NTUzNjE1MTQsImNoYW5uZWwiOiJjaGFubmVsIn0.fDI9u692WSnzBmeaWZRqXykPa_emomvtySguUKbojAw"
});
```

And that's it, now everything should work.

Open developer tools and look at WebSocket frames panel, you should see sth like this:

![Connected](/img/quick_start_connected.png)

Note, that in this example we generated both connection and subscription JWT – but they have expiration time, so after some time Centrifugo stops accepting those tokens. In real-life you need to add a token refresh function to client to rotate tokens.

Also note, that token auth is not the only way to connect to Centrifugo or to subscribe on a channel. There are other ways described throughout documentation.

OK, the last thing we need to do here is to publish a new counter value to a channel and make sure our app works properly.

We can do this over Centrifugo API sending an HTTP request to default API endpoint `http://localhost:8000/api`, but let's do this over the admin web panel first.

Open Centrifugo admin web panel in another browser tab ([http://localhost:8000/](http://localhost:8000/)) and go to `Actions` section. Select publish action, insert channel name that you want to publish to – in our case this is a string `channel` and insert into `data` area JSON like this:

```json
{
    "value": 1
}
```

![Admin publish](/img/quick_start_publish.png)

Click `Submit` button and check out the application browser tab – counter value must be immediately received and displayed.

Open several browser tabs with our app and make sure all tabs receive a message as soon as you publish it.

![Message received](/img/quick_start_message.png)

BTW, let's also look at how you can publish data to channel over Centrifugo API from a terminal using `curl` tool:

```bash
curl --header "Content-Type: application/json" \
  --header "Authorization: apikey aaaf202f-b5f8-4b34-bf88-f6c03a1ecda6" \
  --request POST \
  --data '{"method": "publish", "params": {"channel": "channel", "data": {"value": 2}}}' \
  http://localhost:8000/api
```

– where for `Authorization` header we set `api_key` value from Centrifugo config file generated above.

We did it! We built the simplest browser real-time app with Centrifugo and its Javascript client. It does not have a backend, it's not very useful, to be honest, but it should give you an insight on how to start working with Centrifugo server. Read more about Centrifugo server in the next documentations chapters – it can do much much more than we just showed here. [Integration guide](integration.md) describes a process of idiomatic Centrifugo integration with your application backend.

### More examples

Several more examples are located on Github – [check out this repo](https://github.com/centrifugal/examples).

Also, check out [our blog](/blog) with several tutorials.
