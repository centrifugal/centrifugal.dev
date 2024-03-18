---
title: Stream logs from Loki to browser with Centrifugo Websocket-to-GRPC subscriptions
tags: [centrifugo, loki, grpc]
description: Centrifugo has GRPC subscription streams feature, in this post we show how this feature may simplify a task of delivering data to application UI in real-time. We integrate with Loki, injest log entries and stream logs to the browser based on user-supplied query
author: Alexander Emelin
authorTitle: Founder of Centrifugal Labs
authorImageURL: /img/alexander_emelin.jpeg
image: /img/centrifugo_loki.jpg
hide_table_of_contents: false
---

<img src="/img/centrifugo_loki.jpg" />

As of version 5.1.0, Centrifugo introduces an experimental yet powerful extension that promises to simplify the data delivery process to the browser using GRPC streams. We believe it may help you to solve some practical tasks in minutes. Let's dive into how this feature works and how you can leverage it in your applications integrating with [Loki](https://grafana.com/oss/loki/) real-time log streaming capabilities.

<!--truncate-->

## What Are Proxy Subscription Streams?

[Proxy Subscription Streams](/docs/server/proxy_streams) support pushing data directly to Centrifugo client channel subscriptions from your application backend over GRPC streams. This feature is designed to facilitate individual data streams to clients as soon as they subscribe to a channel, acting as a bridge between WebSocket connections from clients and GRPC streams to the backend. It supports both unidirectional (backend to client) and bidirectional (both ways) streams, thereby enhancing flexibility in data streaming.

![](/img/on_demand_stream_connections.png)

The design is inspired by [Websocketd](http://websocketd.com/) server – but while Websocketd transforms data from programs running locally, Centrifugo provides a more generic network interface with GRPC. And all other features of Centrifugo like connection authentication, online presence come as a great bonus.

In the documentation for Proxy Subscription Streams we mentioned streaming logs from Loki as one of the possible use cases. Let's expand on the idea and implement the working solution in just 10 minutes.

## Demo and source code

Here is a demo of what we well get:

<video width="100%" loop={true} autoPlay="autoplay" muted controls="" src="/img/loki.mp4"></video>

Take a look at [full source code on Github](https://github.com/centrifugal/examples/tree/master/v5/subscription_streams_loki).

## Setting Up Loki

[Loki](https://grafana.com/oss/loki/) is a horizontally-scalable, highly-available, multi-tenant log aggregation system inspired by Prometheus. It is designed to be very cost-effective and easy to operate, making it a perfect candidate for our real-time log streaming example.

We will build the example using Docker Compose, all we have to do for the example is to include Loki image to `docker-compose.yml`: 

```yaml
services:
  loki:
    image: grafana/loki:2.9.5
    ports:
      - "3100:3100"
```

Loki can ingest logs via various methods, including Promtail, Grafana Agent, Fluentd, and more. For simplicity, we will send logs to Loki ourselves from the Go application.

To send logs to Loki, we can use the HTTP API that Loki provides. This is a straightforward way to push logs directly from an application. The example below demonstrates how to create a simple Go application that generates logs and sends them to Loki using HTTP POST requests.

For this post we will be using Go language to implement the backend part. But it could be any other programming language.

First, let's some code to send a log entries to Loki:

```go
const (
	lokiPushEndpoint = "http://loki:3100/loki/api/v1/push"
)

type lokiPushMessage struct {
	Streams []lokiStream `json:"streams"`
}

type lokiStream struct {
	Stream map[string]string `json:"stream"`
	Values [][]string        `json:"values"`
}

func sendLogMessageToLoki(_ context.Context) error {
	sources := []string{"backend1", "backend2", "backend3"}
	source := sources[rand.Intn(len(sources))]
	logMessage := fmt.Sprintf("log from %s source", source)

	payload := lokiPushMessage{
		Streams: []lokiStream{
			{
				Stream: map[string]string{
					"source": source,
				},
				Values: [][]string{
					{fmt.Sprintf("%d", time.Now().UnixNano()), logMessage},
				},
			},
		},
	}

	jsonData, err := json.Marshal(payload)
	if err != nil {
		return err
	}
	resp, err := http.Post(
		lokiPushEndpoint, "application/json", bytes.NewBuffer(jsonData))
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusNoContent {
		return fmt.Errorf("unexpected status code: %d", resp.StatusCode)
	}
	return nil
}

func sendLogsToLoki(ctx context.Context) {
	for {
		select {
		case <-ctx.Done():
			return
		case <-time.After(200 * time.Millisecond):
			err := sendLogMessageToLoki(ctx)
			if err != nil {
				log.Println("error sending log to Loki:", err)
				continue
			}
		}
	}
}

func main() {
	ctx, cancel := signal.NotifyContext(context.Background(), syscall.SIGTERM, syscall.SIGINT)
	defer cancel()

	sendLogsToLoki(ctx)
}
```

This program defines a `sendLogsToLoki` function that constructs a log entry and sends it to Loki using its HTTP API. It continuously generates log messages every 200 milliseconds.

The `lokiPushMessage` struct is structured to match the JSON payload expected by Loki's [`/loki/api/v1/push`](https://grafana.com/docs/loki/latest/reference/api/#push-log-entries-to-loki) endpoint. Each log entry consists of a set of labels (in the Stream map) and log line values, where each value is a two-element array containing the timestamp and the log line. The timestamp is in nanoseconds to match Loki's expected format.

Note, in the example we randomly set log entry `source` label choosing between `backend1`, `backend2` and `backend3` values.

At this point our program pushes some logs to Loki, now let's add Centrifugo to consume them from browser in real-time.

## Configuring Centrifugo

Adding Centrifugo is also rather straightforward:

```yaml
services:
  centrifugo:
    image: centrifugo/centrifugo:v5.3.0
    restart: unless-stopped
    volumes:
      - ./centrifugo/config.json:/centrifugo/config.json
    command: centrifugo -c config.json
    expose:
      - 8000
```

Where `config.json` is:

```json
{
    "client_insecure": true,
    "allowed_origins": ["http://localhost:9000"],
    "proxy_subscribe_stream_endpoint": "grpc://backend:12000",
    "proxy_subscribe_stream_timeout": "3s",
    "namespaces": [
      {
          "name": "logs",
          "proxy_subscribe_stream": true
      }
    ]
}
```

Note, we enabled `client_insecure` option here – this is to keep example short, but in real live you may benefit from Centrifugo authentication: [JWT-based](/docs/server/authentication) or [proxy-based](/docs/server/proxy#connect-proxy).

## Writing frontend

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Streaming logs with Centrifugo and Loki</title>
</head>
<body>
    <div id="app">
        <form id="input" onsubmit="subscribeToLogs(event)">
            <input type="text" id="query" autocomplete="off" placeholder="Enter log query" />
            <button id="submit" type="submit">SUBSCRIBE</button>
        </form>
        <div id="logs" style="margin-top: 20px;">
            <ul id="lines"></ul>
        </div>
    </div>
    <script src="https://unpkg.com/centrifuge@^5/dist/centrifuge.js"></script>
    <script src="app.js"></script>
</body>
</html>
```

In the final version we've also included some CSS to this HTML to make it look a bit nicer.

And our Javascript code in `app.js`:

```javascript
const logs = document.getElementById('logs');
const lines = document.getElementById('lines');
const queryInput = document.getElementById('query');
const button = document.getElementById('submit');

function subscribeToLogs(e) {
    e.preventDefault();

    const query = queryInput.value;
    if (!query) {
        alert('Please enter a query.');
        return;
    }
    queryInput.disabled = true;
    button.disabled = true;

    const centrifuge = new Centrifuge('ws://localhost:9000/connection/websocket');

    const subscription = centrifuge.newSubscription('logs:stream', {
        data: { query: query }
    });

    subscription.on('publication', function(ctx) {
        const logLine = ctx.data.line;
        const logItem = document.createElement('li');
        logItem.textContent = logLine;
        lines.appendChild(logItem);
        logs.scrollTop = logs.scrollHeight;
    });

    subscription.subscribe();
    centrifuge.connect();
}
```

In the final example we've also added Nginx container to serve static files and proxy WebSocket connections to Centrifugo. Check it out in the source code.

When user enters Loki query to input, subscription goes to Centrifugo and Centrifugo then realizes it's a proxy stream subscription (since channel belongs to `logs` channel namespace). Centrifugo then calls the backend GRPC endpoint (`backend:12000`) and expect it to implement unidirectional GRPC stream contract. Our last part here - to implement it.

## Handle subscription stream on the Go side

On your backend, we'll implement a GRPC service that interacts with Loki to tail logs and then re-send them to Centrifugo subscription stream. Let's implement such service.

We first need to take Centrifugo [proxy.proto](https://github.com/centrifugal/centrifugo/blob/master/internal/proxyproto/proxy.proto) definitions. And we will implement `SubscribeUnidirectional` method from it.

You need to install [`protoc`](https://grpc.io/docs/protoc-installation/), also install plugins for Go and GRPC:

```bash
go install google.golang.org/protobuf/cmd/protoc-gen-go@latest
go install google.golang.org/grpc/cmd/protoc-gen-go-grpc@latest
```

And then:

```bash
protoc -I ./ proxy.proto --go_out=./ --go-grpc_out=./
```

This will generate Protobuf messages and GRPC code required for writing GRPC service. We can use generated definitions now:

```go
import (
	"log"
	"fmt"

	pb "backend/internal/proxyproto"
	"github.com/grafana/loki/pkg/logproto"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
)

const (
	lokiGRPCAddress  = "loki:9095"
)

type streamerServer struct {
	pb.UnimplementedCentrifugoProxyServer
	lokiQuerierClient logproto.QuerierClient
}

type clientData struct {
	Query string `json:"query"`
}

func (s *streamerServer) SubscribeUnidirectional(
	req *pb.SubscribeRequest,
	stream pb.CentrifugoProxy_SubscribeUnidirectionalServer,
) error {
	var cd clientData
	err := json.Unmarshal(req.Data, &cd)
	if err != nil {
		return fmt.Errorf("error unmarshaling data: %w", err)
	}
	query := &logproto.TailRequest{
		Query: cd.Query,
	}
	ctx, cancel := context.WithCancel(stream.Context())
	defer cancel()

	logStream, err := s.lokiQuerierClient.Tail(ctx, query)
	if err != nil {
		return fmt.Errorf("error querying Loki: %w", err)
	}

	started := time.Now()
	log.Println("unidirectional subscribe called with request", req)
	defer func() {
		log.Println("unidirectional subscribe finished, elapsed", time.Since(started))
	}()
	err = stream.Send(&pb.StreamSubscribeResponse{
		SubscribeResponse: &pb.SubscribeResponse{},
	})
	if err != nil {
		return err
	}

	for {
		select {
		case <-stream.Context().Done():
			return stream.Context().Err()
		default:
			resp, err := logStream.Recv()
			if err != nil {
				return fmt.Errorf("error receiving from Loki stream: %v", err)
			}
			for _, entry := range resp.Stream.Entries {
				line := fmt.Sprintf("%s: %s", entry.Timestamp.Format("2006-01-02T15:04:05.000Z07:00"), entry.Line)
				err = stream.Send(&pb.StreamSubscribeResponse{
					Publication: &pb.Publication{Data: []byte(`{"line":"` + line + `"}`)},
				})
				if err != nil {
					return err
				}
			}
		}
	}
}

func main() {
	querierConn, err := grpc.Dial(lokiGRPCAddress, grpc.WithTransportCredentials(insecure.NewCredentials()))
	if err != nil {
		log.Fatalf("failed to dial Loki: %v", err)
	}
	querierClient := logproto.NewQuerierClient(querierConn)

	addr := ":12000"
	lis, err := net.Listen("tcp", addr)
	if err != nil {
		log.Fatalf("failed to listen: %v", err)
	}

	s := grpc.NewServer(grpc.MaxConcurrentStreams(math.MaxUint32))
	pb.RegisterCentrifugoProxyServer(s, &streamerServer{
		lokiQuerierClient: querierClient,
	})

	log.Println("Server listening on", addr)
	if err := s.Serve(lis); err != nil {
		log.Fatalf("failed to serve: %v", err)
	}
}
```

Things to note:

* Loki also supports GRPC interface to tail logs, so we use it here. We could also use Loki WebSocket endpoint [`/loki/api/v1/tail`](https://grafana.com/docs/loki/latest/reference/api/#stream-log-messages) but this would mean establishing new connection for every tail operation - with GRPC we can use many concurrent tail requests all multiplexed over a single network connection.
* When subscription stream initialized from Centrifugo side we start tailing logs from Loki and resend them to Centrifugo
* Centrifugo then packs data to WebSocket connection and delivers to browser.

:::caution

Note, we bypass some security considerations in this example. In practice you must be more careful with query supplied by user in the form - validate and sanitize it before passing to Loki. Proxy subscription GRPC contract allows you to communicate custom errors with the client-side.

:::

## Conclusion

Subscription streams may be a very powerful generic feature in your arsenal. Here we've shown how simple it could be to make a proof of concept of the real-time application which consumes individual data from third-party streaming provider.

Centrifugo provides WebSocket SDKs for popular languages used to build UI layer, provides authentication and proper management of real-time connections. And with subscription streams feature Centrifugo gives you an answer on how to quickly translate real-time data based on individual query to user.
