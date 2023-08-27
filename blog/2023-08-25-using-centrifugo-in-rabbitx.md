---
title: Using Centrifugo in RabbitX
tags: [centrifugo, interview, usecase]
description: In this post, Kirill Shilov, co-Founder of crypto exchange platform RabbitX, shares details about the usage of Centrifugo in their product.
author: Kirill Shilov
authorTitle: Co-Founder of RabbitX
authorImageURL: https://pbs.twimg.com/profile_images/1001349298414645248/4yydAl4A_400x400.jpg
image: /img/benthos.png
hide_table_of_contents: false
---

<img src="/img/rabbitx.png" />

This post introduces a new format in Centrifugal blog – interview with a Centrifugo user! Let's dive into an exciting chat with Kirill Shilov, the co-founder of [RabbitX platform](https://landing.rabbitx.io/), a global permissionless perpetuals exchange powered on Starknet. We will discover how Centrifugo  helped RabbitX team to build a broker platform with current trading volume of 25 million USD daily! 🚀🎉

<!--truncate-->

#### [Q] Hello, Kirill - thanks for your desire to share your Centrifugo use case. First of all, could you provide some information about RabbitX - what is it? 

RabbitX is a broker platform, like Binance, we have all the brokerage infrastructure including our own trade matching engine.

#### [Q] Great! What is the goal of Centrifugo in your project? Which real-time features you have?

Almost all the information users see in our terminal is streamed over Centrifugo. We use it for financial order books, candlestick chart updates, and stat number updates. We can also send real-time personal user notifications via Centrifugo. Instead of all the words, here is a short recording of our terminal trading BTC:

<video width="100%" loop={true} autoPlay="autoplay" muted controls="" src="/img/rabbitx.mp4?v=1"></video>

#### [Q] We know that you are using Centrifugo Tarantool engine - could you explain why and how it works in your case?

Well, that's an interesting thing. We heavily use Tarantool in our system. It grants us immense flexibility, performance, and the power to craft whatever we envision. It ensures the atomicity essential for trading match-making.

When we were in search of a WebSocket real-time bus for messages, we were pleasantly surprised to discover that Centrifugo integrates with Tarantool. In our scenario, this allowed us to bypass additional network round-trips, as we can stream data directly from Tarantool to Centrifugo channels. Reducing latency is paramount for financial instruments.

Furthermore, I can mention that over our nine months in production, we didn't encounter any issues with Centrifugo – it performed flawlessly!

Regarding authentication, we employ Centrifugo's JWT authentication and subscribe proxy. Thus, subscriptions are authorized on our specialized service written in Go. We're also actively using Centrifugo possibility to send initial channel data in the subscribe proxy response.

One challenge we overcame was bridging the gap between the subscription's initial request and the continuous message stream in the order book component. To address this, we employed our own sequence numbers in events, coupled with Centrifugo's channel history – this allowed us to deal with data races when needed. Such races are infrequent in practice, but now we're confident our users never experience them.

#### [Q] Looking at RabbitX terminal app we see quite modern UI - could you share more details about it too?

Our frontend is built on top of React in combination with [TradingView Supercharts](https://www.tradingview.com/chart/). And of course we are using `centrifuge-js` SDK for establishing connections with Centrifugo.

#### [Q] So you are nine months in production at this point. Can you share some real world numbers related to your Centrifugo setup?

At this point we can have up to 1000 active concurrent traders, we can send more than 60 messages per second towards one client in peak hours. All the load served with a single Centrifugo instance (and we have one standby instance).

#### [Q] Anything else you want to share with readers of Centrifugal blog?

TBD.
