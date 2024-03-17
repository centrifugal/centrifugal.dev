---
title: Stream logs from Loki to browser with Centrifugo Websocket-to-GRPC subscriptions
tags: [centrifugo, loki, grpc]
description: Centrifugo has GRPC subscription streams feature, in this post we show how this feature may simplify a task of delivering data to application UI in real-time. We integrate with Loki, injest log entries and stream logs to the browser based on user-supplied query
author: Alexander Emelin
authorTitle: TBD
authorImageURL: /img/alexander_emelin.jpeg
image: /img/centrifugo_loki.png
hide_table_of_contents: false
draft: true
---

<img src="/img/centrifugo_loki.png" />

As of version 5.1.0, Centrifugo introduces an experimental yet powerful extension that promises to simplify the data delivery process to the browser using GRPC streams. We believe it may help you to solve some practical tasks in minutes. Let's dive into how this feature works and how you can leverage it in your applications integrating with Loki real-time log streaming endpoint.

<!--truncate-->

## What Are Proxy Subscription Streams?

[Proxy Subscription Streams](/docs/server/proxy_streams) support pushing data directly to Centrifugo client channel subscriptions from your application backend over GRPC streams. This feature is designed to facilitate individual data streams to clients as soon as they subscribe to a channel, acting as a bridge between WebSocket connections from clients and GRPC streams to the backend. It supports both unidirectional (backend to client) and bidirectional (both ways) streams, thereby enhancing flexibility in data streaming.

![](/img/on_demand_stream_connections.png)

The essence of Proxy Subscription Streams lies in its simplicity and efficiency. By establishing a stream between Centrifugo and your application backend upon a channel subscription, it provides a straightforward path for data to travel directly to the subscribed clients. This mechanism not only simplifies the architecture for real-time data delivery but also ensures fast and individualized data streaming.

In the documentation for Proxy Subscription Streams we mentioned streaming logs from Loki as one of the possible use cases. Let's expand on the idea and implement the working solution in just 10 minutes.

## Setting Up Loki

Loki is a horizontally-scalable, highly-available, multi-tenant log aggregation system inspired by Prometheus. It is designed to be very cost-effective and easy to operate, making it a perfect candidate for our real-time log streaming example.

```
services:
  loki:
    image: grafana/loki:latest
    ports:
      - "3100:3100"
```

First, ensure you have Loki set up and running. Loki can ingest logs from various sources, but for simplicity, we'll assume it's already collecting logs that you want to stream. If you're new to Loki, you can find setup instructions on the Grafana website.

Before we generate logs, ensure that Loki is set up to receive logs. Loki can ingest logs via various methods, including Promtail, Grafana Agent, Fluentd, and more. For simplicity, we'll assume Loki is running and accessible for log ingestion.

To send logs to Loki, we can use the HTTP API that Loki provides. This is a straightforward way to push logs directly from an application. The example below demonstrates how to create a simple Go application that generates logs and sends them to Loki using HTTP POST requests.

First, define a function to send a log entry to Loki:

```go
package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"time"
)

// LogEntry represents a single log entry
type LogEntry struct {
	Timestamp time.Time `json:"timestamp"`
	Line      string    `json:"line"`
}

// LokiPushMessage represents the structure of data pushed to Loki
type LokiPushMessage struct {
	Streams []struct {
		Stream map[string]string `json:"stream"`
		Values [][]string        `json:"values"`
	} `json:"streams"`
}

// SendLogToLoki sends a log message to Loki
func SendLogToLoki(lokiURL, logMessage string) error {
	// Construct the payload
	payload := LokiPushMessage{
		Streams: []struct {
			Stream map[string]string `json:"stream"`
			Values [][]string        `json:"values"`
		}{
			{
				Stream: map[string]string{
					"source": "go_application", // You can add more labels here
				},
				Values: [][]string{
					{fmt.Sprintf("%d", time.Now().UnixNano()), logMessage},
				},
			},
		},
	}

	// Marshal the payload to JSON
	jsonData, err := json.Marshal(payload)
	if err != nil {
		return err
	}

	// Send the request
	resp, err := http.Post(lokiURL+"/loki/api/v1/push", "application/json", bytes.NewBuffer(jsonData))
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("unexpected status code: %d", resp.StatusCode)
	}

	return nil
}

func main() {
	lokiURL := "http://localhost:3100" // Change this to your Loki instance URL
	logMessage := "Hello, Loki! This is a log from our Go application."

	// Generate and send a log entry every 5 seconds
	for range time.Tick(5 * time.Second) {
		if err := SendLogToLoki(lokiURL, logMessage); err != nil {
			fmt.Println("Error sending log to Loki:", err)
			continue
		}
		fmt.Println("Log sent to Loki:", logMessage)
	}
}
```

This program defines a `SendLogToLoki` function that constructs a log entry and sends it to Loki using its HTTP API. It continuously generates log messages every 5 seconds. Note that lokiURL should be updated to point to your Loki instance.

The LokiPushMessage struct is structured to match the JSON payload expected by Loki's /loki/api/v1/push endpoint. Each log entry consists of a set of labels (in the Stream map) and log line values, where each value is a two-element array containing the timestamp and the log line. The timestamp is in nanoseconds to match Loki's expected format.

## Configuring Centrifugo

Assuming you have Centrifugo and a Go backend setup as previously described, you will configure Centrifugo to use Proxy Subscription Streams. Ensure your config.json for Centrifugo includes the necessary proxy subscription stream configuration, pointing to your Go backend service that will handle the Loki log streaming:

```
{
  "proxy_subscribe_stream_endpoint": "grpc://localhost:12000",
  "proxy_subscribe_stream_timeout": "3s",
  "namespaces": [
    {
        "name": "logs",
        "proxy_subscribe_stream": true
    }
  ]
}
```

Implementing the Go Backend for Loki Log Streaming
On your backend, you'll implement a GRPC service that interacts with Loki to fetch and stream logs. The example below demonstrates how you might set up a simple service in Go to handle streaming logs from Loki to clients through Centrifugo:

```go
package main

import (
	"context"
	"fmt"
	"log"
	"net"
	"time"

	"github.com/golang/protobuf/ptypes/empty"
	"github.com/grafana/loki/pkg/logproto"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
	pb "path/to/your/protobuf" // Your generated protobuf file for Centrifugo
)

type streamServer struct {
	pb.UnimplementedCentrifugoProxyServer
	lokiClient logproto.QuerierClient
}

func NewStreamServer(lokiAddress string) (*streamServer, error) {
	conn, err := grpc.Dial(lokiAddress, grpc.WithTransportCredentials(insecure.NewCredentials()))
	if err != nil {
		return nil, fmt.Errorf("failed to dial Loki: %w", err)
	}
	lokiClient := logproto.NewQuerierClient(conn)
	return &streamServer{lokiClient: lokiClient}, nil
}

func (s *streamServer) SubscribeUnidirectional(req *pb.SubscribeRequest, stream pb.CentrifugoProxy_SubscribeUnidirectionalServer) error {
	query := &logproto.QueryRequest{
		// Your query parameters here, e.g., `{job="your_job"}`, time range, etc.
	}
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	logStream, err := s.lokiClient.Query(ctx, query)
	if err != nil {
		return fmt.Errorf("error querying Loki: %w", err)
	}

	for {
		select {
		case <-stream.Context().Done():
			return nil
		default:
			resp, err := logStream.Recv()
			if err != nil {
				log.Printf("error receiving from Loki stream: %v", err)
				continue
			}
			for _, stream := range resp.GetStreams() {
				for _, entry := range stream.Entries {
					data := fmt.Sprintf("%s: %s", entry.Timestamp, entry.Line)
					stream.Send(&pb.StreamSubscribeResponse{
						Publication: &pb.Publication{Data: []byte(data)},
					})
				}
			}
		}
	}
}

func main() {
	lis, err := net.Listen("tcp", ":12000")
	if err != nil {
		log.Fatalf("failed to listen: %v", err)
	}
	streamSrv, err := NewStreamServer("localhost:9095") // Loki GRPC server address
	if err != nil {
		log.Fatalf("failed to create stream server: %v", err)
	}
	s := grpc.NewServer()
	pb.RegisterCentrifugoProxyServer(s, streamSrv)
	if err := s.Serve(lis); err != nil {
		log.Fatalf("failed to serve: %v", err)
	}
}
```

This example demonstrates a basic implementation and assumes familiarity with setting up GRPC services in Go, as well as working with Loki's GRPC API for querying logs. You'll need to adjust the NewStreamServer function to connect to your specific Loki instance and configure the SubscribeUnidirectional method to query logs according to your needs (e.g., based on a specific log query or time range).

## Client-Side Integration

On the client side, using Centrifugo's JavaScript client, you can subscribe to the logs namespace and listen for log entries as they are streamed from Loki:

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Log Streaming</title>
</head>
<body>
    <input type="text" id="logQuery" placeholder="Enter log query" />
    <button onclick="subscribeToLogs()">Subscribe</button>

    <div id="logs" style="margin-top: 20px;">
        <h4>Logs:</h4>
        <ul id="logList"></ul>
    </div>

    <script src="centrifuge.min.js"></script>
    <script src="app.js"></script>
</body>
</html>
```

And Javascript:

```javascript
const centrifuge = new Centrifuge('ws://localhost:8000/connection/websocket');

function subscribeToLogs() {
    const query = document.getElementById('logQuery').value;
    if (!query) {
        alert('Please enter a query.');
        return;
    }

    const subscription = centrifuge.newSubscription('logs', {
        data: { query: query } // Sending query with subscription request
    });

    subscription.on('publication', function(message) {
        displayLog(message.data);
    });

    subscription.on('subscribe', function(context) {
        console.log('Subscribed to logs with query:', query);
    });

    subscription.on('error', function(error) {
        console.error('Subscription error:', error);
    });

    subscription.subscribe();
}

function displayLog(log) {
    const logList = document.getElementById('logList');
    const logItem = document.createElement('li');
    logItem.textContent = log; // Assuming log is a string. Adjust if log is an object.
    logList.appendChild(logItem);
}

centrifuge.connect();
```

Replace "logs:your_log_channel" with the appropriate channel name that matches your configuration and use case. This setup will start streaming logs to your web application in real-time, directly from Loki, through Centrifugo, and into the browser, showcasing the power and simplicity of Proxy Subscription Streams for real-time log streaming.

In this basic example, upon a client subscribing to a channel, a stream is established, and the server is ready to push data through this stream to the client. You would expand the SubscribeUnidirectional function to include your logic for fetching and streaming data.

## Conclusion

Subscription streams may be a very powerful generic feature in your arsenal. Here we showed how simple it could be to make a proof of concept of the real-time application. Centrifugo provides WebSocket SDKs for popular languages used to build UI layer, provides authentication and proper management of real-time connections. And with subscription streams feature Centrifugo gives you an answer on how to quickly translate real-time data based on individual query to user.
