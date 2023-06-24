---
id: on_demand_streams
sidebar_label: On-demand streams
title: On-demand streams
---

Rejected 🚫

On-demand streams feature of Centrifugo PRO allows pushing data towards client channel subscription directly from your application backend over the unidirectional GRPC stream. The scheme may be useful if you want to generate individual streams for clients and these streams should only work for a time while client is subscribed – i.e. a stream must only be initialized on client's demand.

![](/img/proxy_streams.png)

Let's describe a real-life use case. Say you have Loki for keeping logs, it provides a streaming API for tailing logs. You decided to stream logs towards your clients. When client subscribes to some channel in Centrifugo and the unidirectional stream established between Centrifugo and your backend – backend starts tailing Loki logs and transfers them towards client over Centrifugo.

In that case all the client authentication and channel permission control may be delegated to common Centrifugo mechanisms, so when the stream is established you know the ID of user and the channel. You can also additionally check channel permissions at the moment of stream establishement. As soon as client unsubscribes from the channel – Centrifugo closes the unidirectional GRPC stream.

If for some reason connection between Centrifugo and backend is closed – then Centrifugo will unsubscribe a client with `insufficient state` reason and a client will soon resubscribe to a channel.

Note, that in this case Centrifugo broker's PUB/SUB and history are not used at all – because it's a direct connection between Centrifugo node and your backend.

:::caution

This scheme increases resource usage on both Centrifugo and app backend sides  – so if you don't need on-demand streams – prefer using Centrifugo usual approach for always publishing messages to channels whenever event happens.

:::
