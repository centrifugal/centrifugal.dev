---
description: "Official Centrifugo server SDKs for Go, Python, JavaScript and TypeScript, PHP, Ruby, Rust and .NET: every server API method, typed errors, batching, retries, tokens, proxy handlers."
id: server_sdks
sidebar_label: Server SDKs
title: Server SDKs
---

A server SDK is the library your backend uses to work with Centrifugo - as opposed to a [client SDK](../transports/client_sdk.md), which runs in browsers and apps. It covers what a backend does with Centrifugo over HTTP, not only API calls:

* **The [server API](./server_api.md)**: every method, Centrifugo PRO's included. The API is plain HTTP with JSON, so you can always call it directly, but an SDK takes care of what is easy to get wrong: retries which don't publish twice, broadcasts where some channels fail, timeouts.
* **[Connection tokens](./authentication.md)** and **[subscription tokens](./channel_token_auth.md)**, signed with HMAC, RSA, ECDSA or Ed25519 keys, with a JWKS endpoint for the public keys - and the endpoints your client SDK's [connection](../transports/client_api.md#client-connection-token) and [subscription](../transports/client_api.md#subscription-token) token callbacks call.
* **[Shared poll signatures](./shared_poll.md#authorization-with-hmac-signatures)**, and the endpoint client SDKs call for them.
* **[Proxy](./proxy.md) handlers**: your backend's side of Centrifugo's HTTP proxy - connect, subscribe, publish, RPC, refresh and the rest - each answering with exactly what its proxy type can carry.

## Official SDKs

| Language | SDK | Install | Requires |
|---|---|---|---|
| Go | [gocent](https://github.com/centrifugal/gocent) | `go get github.com/centrifugal/gocent/v4` | Go 1.27 |
| Python | [cent](https://github.com/centrifugal/pycent) | `pip install cent` | Python 3.11 |
| JavaScript, TypeScript | [jscent](https://github.com/centrifugal/jscent) | `npm install jscent` | Node.js 22, Deno 2, Bun 1.2, edge runtimes |
| PHP | [phpcent](https://github.com/centrifugal/phpcent) | `composer require centrifugal/phpcent` | PHP 8.3 |
| Ruby | [cent](https://github.com/centrifugal/rubycent) | `gem "cent", "~> 5.0"` | Ruby 3.4 |
| Rust | [cent](https://github.com/centrifugal/rustcent) | `cargo add cent` | Rust 1.85 |
| .NET | [Centrifugal.Cent](https://github.com/centrifugal/csharpcent) | `dotnet add package Centrifugal.Cent` | .NET 8 |

All of them work with Centrifugo v6. The map and shared poll methods need Centrifugo v6.8.0 or newer, and the methods marked "Centrifugo PRO only" need [Centrifugo PRO](../pro/overview.md).

## What every SDK does

The SDKs follow one [specification](https://github.com/centrifugal/gocent/blob/master/spec.md), so they behave the same in every language - only the way a call is written is the language's own. Each SDK:

* **Calls every server API method**, Centrifugo PRO's included, with request and result types generated from Centrifugo's own API schema.
* **Returns an error unless the call did everything asked.** A [broadcast](./server_api.md#broadcast) or [batch](./server_api.md#batch) in which some parts failed is an error which still holds every part's outcome, so you can see which channels got the publication.
* **Matches Centrifugo errors by code** - unknown channel, not available, too many requests - and tells which errors a retry may fix.
* **Retries safely.** A publication is retried with the same `idempotency_key`, and a broadcast retry is sent only to the channels which have not got it yet.
* **Bounds every call by a timeout** - 10 seconds by default - which a call can shorten or replace.
* **Checks a request before sending it**: a missing required field or a payload which is not valid JSON fails at once, naming the field, rather than as a bad request from Centrifugo.
* **Batches concurrent calls automatically**, if you enable it, to cut the requests Centrifugo handles under load - never delaying a call while requests are below the limit you set.
* **Reads paged results for you**: history, map state and device lists are iterated a page at a time, each item with its [stream position](./history_and_recovery.md).
* **Signs tokens**: [connection](./authentication.md) and [subscription](./channel_token_auth.md) tokens with HMAC, RSA, ECDSA or Ed25519 keys, a JWKS endpoint for the public keys, and API tokens for Centrifugo PRO's [JWKS authentication](../pro/server_api_enhancements.md#jwks-authentication) of the server API.
* **Serves the endpoints client SDKs call** for connection and subscription tokens and [shared poll](./shared_poll.md) signatures.
* **Answers the [proxy](./proxy.md)**: a handler per proxy type, which answers with exactly what the proxy type can carry.
* **Writes commands for the [async consumers](./consumers.md)**, to put into an outbox table or a Kafka topic.

Each SDK's README has the details for its language, and its API reference documents every method.

## A first publication

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

<Tabs
  className="unique-tabs"
  defaultValue="go"
  values={[
    {label: 'Go', value: 'go'},
    {label: 'Python', value: 'python'},
    {label: 'JavaScript', value: 'javascript'},
    {label: 'PHP', value: 'php'},
    {label: 'Ruby', value: 'ruby'},
    {label: 'Rust', value: 'rust'},
    {label: '.NET', value: 'dotnet'},
  ]
}>
<TabItem value="go">

```go
client, err := gocent.New(gocent.Config{
	APIEndpoint: "http://localhost:8000/api",
	APIKey:      os.Getenv("CENTRIFUGO_API_KEY"),
})
if err != nil {
	log.Fatal(err)
}
res, err := client.Publish(ctx, gocent.PublishRequest{
	Channel: "news",
	Data:    jsontext.Value(`{"text":"hello"}`),
})
if err != nil {
	log.Fatal(err)
}
log.Printf("published at offset %d", res.Offset)
```

</TabItem>
<TabItem value="python">

```python
import os
import cent

client = cent.Client("http://localhost:8000/api", api_key=os.environ["CENTRIFUGO_API_KEY"])

res = client.publish(channel="news", data={"text": "hello"})
print(f"published at offset {res.offset}")
```

</TabItem>
<TabItem value="javascript">

```javascript
import { Client } from 'jscent';

const client = new Client({ apiEndpoint: 'http://localhost:8000/api', apiKey: process.env.CENTRIFUGO_API_KEY });

const res = await client.publish({ channel: 'news', data: { text: 'hello' } });
console.log(`published at offset ${res.offset}`);
```

</TabItem>
<TabItem value="php">

```php
use Centrifugal\Phpcent\Client;

$client = new Client('http://localhost:8000/api', apiKey: (string) getenv('CENTRIFUGO_API_KEY'));

$res = $client->publish(channel: 'news', data: ['text' => 'hello']);
echo "published at offset {$res->offset}\n";
```

</TabItem>
<TabItem value="ruby">

```ruby
require "cent"

client = Cent::Client.new(api_endpoint: "http://localhost:8000/api", api_key: ENV.fetch("CENTRIFUGO_API_KEY"))

res = client.publish(channel: "news", data: { text: "hello" })
puts "published at offset #{res.offset}"
```

</TabItem>
<TabItem value="rust">

```rust
use cent::{Client, Config, PublishRequest};
use serde_json::json;

let client = Client::new(
    Config::new("http://localhost:8000/api").api_key(std::env::var("CENTRIFUGO_API_KEY").unwrap()),
)?;
let data = cent::json(&json!({"text": "hello"}))?;
let res = client.publish(PublishRequest::new("news").data(data)).await?;
println!("published at offset {}", res.offset);
```

</TabItem>
<TabItem value="dotnet">

```csharp
using Centrifugal.Cent;

await using var client = new CentClient(new CentClientOptions
{
    ApiEndpoint = "http://localhost:8000/api",
    ApiKey = apiKey,
});
var result = await client.PublishAsync("news", new { text = "hello" });
Console.WriteLine(result.Offset);
```

</TabItem>
</Tabs>

## For AI coding agents

If you are an AI coding agent writing a backend which talks to Centrifugo, these are the points where generated code most often goes wrong:

* **Use the SDK for the language rather than raw HTTP calls.** It already handles the error model, timeouts and retries below.
* **Retry a publication only with an `idempotency_key`**, the same one on every attempt: an error does not mean nothing was published. A key built from an ID must name the event too - `order-42-paid`, not `order-42`.
* **Don't retry a failed broadcast as a whole**: it would publish twice into the channels which got it. Use the SDK's broadcast retry, which resends only to the channels which failed.
* **Check every part of a broadcast or batch.** An error from a broadcast may be partial - some channels got the publication - and the error holds each channel's outcome.
* **A 404 from a method marked "Centrifugo PRO only" means the server is Centrifugo OSS**, not that the endpoint is wrong.
* **Put the API key in the `X-API-Key` header** - the SDKs do - and never in a client-side token or the browser.
* **Keep proxy handlers reachable by Centrifugo only**: whoever can call them can claim to be any user.
* **For streaming AI responses**, see [Real-time for AI apps](../getting-started/ai-apps.md): publish chunks in order, one call after another, not concurrently.

## HTTP or GRPC

The server SDKs use the [HTTP API](./server_api.md#http-api). Centrifugo also has a [GRPC API](./server_api.md#grpc-api) with the same methods, for which you generate a client from Centrifugo's Protobuf schema. HTTP is the default choice: with connections kept alive and calls batched automatically, its per-call cost is small, it needs no dependencies, and it works on every platform - edge runtimes included.

GRPC is worth it when:

* **you publish at very high rates**, and serializing JSON shows in your profiles: GRPC uses Protobuf;
* **your payloads are binary**: GRPC carries them as bytes, where the HTTP API takes them base64-encoded in `b64data`;
* **you need the [proxy streams](./proxy_streams.md)**, which only GRPC supports.

A generated GRPC client calls the methods, and nothing more: what the SDKs add - retries which don't publish twice, broadcast errors with each channel's outcome, Centrifugo errors matched by code, one timeout per call - you write yourself. The SDKs' token signing, client SDK endpoints and proxy handlers work the same alongside a GRPC client, as they don't depend on the API transport.

## Community libraries

These server API libraries are made by the community. They are not part of the official set, and may not cover every method:

* [katarinamolotova/javacent](https://github.com/katarinamolotova/javacent) – HTTP API client for Java
* [SocketSomeone/cent.js](https://github.com/SocketSomeone/cent.js) – API client for NodeJS
* [sajjad-fatehi/CentriAgent](https://github.com/sajjad-fatehi/centri-agent) – one more API client for NodeJS
* [ismkdc/Centrifugo.AspNetCore](https://github.com/ismkdc/Centrifugo.AspNetCore) – API client for ASP.NET Core
* [devops-israel/crystalcent](https://github.com/devops-israel/crystalcent) – API client for Crystal language
* [Cyberguru1/rucent](https://github.com/Cyberguru1/rucent) – HTTP API client for Rust

