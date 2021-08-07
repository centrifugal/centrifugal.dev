---
id: overview
title: Real-time transports 
---

Centrifugo supports a variety of transports to deliver real-time messages to clients.

:::info Every transport is a persistent connection

Here we describe supported transports between your application frontend and Centrifugo itself. Every Centrifugo transport is a persistent connection so the server can push data towards clients at any moment.

:::

The important distinction here is that all supported transports belong to one of two possible groups:

* Bidirectional
* Unidirectional

## Bidirectional

Bidirectional transports are capable to serve all Centrifugo features. These transports are the main Centrifugo focus.

Bidirectional transports come with a cost that developers need to use a special client connector library which speaks Centrifugo [client protocol](./protocol.md). The reason why we need a special client connector library is that a bidirectional connection is asynchronous – it's required to match requests to responses, properly manage connection state and request queueng/timeouts/errors.

Centrifigo has [client connector libraries](../ecosystem/client.md) for popular environments.

## Unidirectional

Unidirectional transports suit well for simple use-cases with stable subscriptions.

The advantage is that unidirectional transports do not require special client connectors - developers can use native browser APIs (like WebSocket, SSE, HTTP streaming), or GRPC generated code to receive real-time updates from Centrifugo – thus avoiding dependency to a client connector that abstracts bidirectional communication.

The drawback is that with unidirectional transports you are not inheriting all Centrifugo features out of the box (like dynamic subscriptions/unsubscriptions, automatic message recovery on reconnect, possibility to send RPC calls over persistent connection). But some of the missing client APIs can be mimicked by using calls to Centrifugo [server API](../server/server_api.md) (i.e. over client -> application backend -> Centrifugo).
