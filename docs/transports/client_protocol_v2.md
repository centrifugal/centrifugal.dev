---
id: client_protocol_v2
title: Client protocol V2
---

Centrifugo has several client SDKs to establish a realtime connection with a server. Most of our libraries use WebSocket transport and send messages encoded with our own bidirectional protocol. That protocol allows asynchronous communication, sending RPC, multiplexing subscriptions to channels.

For Centrifugo v4 we are introducing a new generation of SDKs for Javascript, Dart, Go, Swift and Java. They all based on client protocol v2. This doc describes the protocol.

