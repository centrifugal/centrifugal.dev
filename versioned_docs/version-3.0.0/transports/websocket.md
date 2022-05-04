---
id: websocket
title: WebSocket
---

[Websocket](https://en.wikipedia.org/wiki/WebSocket) is the main transport in Centrifugo. It's a very efficient low-overhead protocol on top of TCP.

The biggest advantage is that Websocket works out of the box in all modern browsers and almost all programming languages have Websocket implementations. This makes Websocket a pretty universal transport that can even be used to connect to Centrifugo from web apps and mobile apps and other environments.

Default WebSocket connection endpoint in Centrifugo is:

```
/connection/websocket
```

By default WebSocket connection uses JSON protocol internally.

## Options

### websocket_message_size_limit

Default: 65536 (64KB)

Maximum allowed size of a message received from WebSocket connection in bytes.

### websocket_read_buffer_size

In bytes, by default 0 which tells Centrifugo to reuse read buffer from HTTP server for WebSocket connection (usually 4096 bytes in size). If set to a lower value can reduce memory usage per WebSocket connection (but can increase number of system calls depending on average message size).

```json title="config.json"
{
    ...
    "websocket_read_buffer_size": 512
}
```

### websocket_write_buffer_size

In bytes, by default 0 which tells Centrifugo to reuse write buffer from HTTP server for WebSocket connection (usually 4096 bytes in size). If set to a lower value can reduce memory usage per WebSocket connection (but HTTP buffer won't be reused):

```json title="config.json"
{
    ...
    "websocket_write_buffer_size": 512
}
```

### websocket_use_write_buffer_pool

If you have a few writes then `websocket_use_write_buffer_pool` (boolean, default `false`) option can reduce memory usage of Centrifugo a bit as there won't be separate write buffer binded to each WebSocket connection.

### websocket_compression

An experimental feature for raw WebSocket endpoint - `permessage-deflate` compression for  websocket messages. Btw look at [great article](https://www.igvita.com/2013/11/27/configuring-and-optimizing-websocket-compression/) about websocket compression. WebSocket compression can reduce an amount of traffic travelling over the wire.

We consider this experimental because this websocket compression is experimental in [Gorilla Websocket](https://github.com/gorilla/websocket) library that Centrifugo uses internally.

:::caution

Enabling WebSocket compression will result in much slower Centrifugo performance and more memory usage – depending on your message rate this can be very noticeable.

:::

To enable WebSocket compression for raw WebSocket endpoint set `websocket_compression` to `true` in a configuration file. After this clients that support `permessage-deflate` will negotiate compression with server automatically. Note that enabling compression does not mean that every connection will use it - this depends on client support for this feature.

Another option is `websocket_compression_min_size`. Default 0. This is a minimal size of message in bytes for which we use `deflate` compression when writing it to client's connection. Default value `0` means that we will compress all messages when `websocket_compression` enabled and compression support negotiated with client.

It's also possible to control websocket compression level defined at [compress/flate](https://golang.org/pkg/compress/flate/#NewWriter) By default when compression with a client negotiated Centrifugo uses compression level 1 (BestSpeed). If you want to set custom compression level use `websocket_compression_level` configuration option.

## Protobuf binary protocol

In most cases you will use Centrifugo with JSON protocol which is used by default. It consists of simple human-readable frames that can be easily inspected. Also it's a very simple task to publish JSON encoded data to HTTP API endpoint. You may want to use binary Protobuf client protocol if:

* you want less traffic on wire as Protobuf is very compact
* you want maximum performance on server-side as Protobuf encoding/decoding is very efficient
* you can sacrifice human-readable JSON for your application

Binary protobuf protocol only works for raw Websocket connections (as SockJS can't deal with binary). With most clients to use binary you just need to provide query parameter `format` to Websocket URL, so final URL look like:

```
wss://centrifugo.example.com/connection/websocket?format=protobuf
```

After doing this Centrifugo will use binary frames to pass data between client and server. Your application specific payload can be random bytes.

:::tip

You still can continue to encode your application specific data as JSON when using Protobuf protocol thus have a possibility to co-exist with clients that use JSON protocol on the same Centrifugo installation inside the same channels.

:::
