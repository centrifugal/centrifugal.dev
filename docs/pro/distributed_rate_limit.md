---
id: distributed_rate_limit
title: Distributed rate limit API
---

In addition to connection operation rate limiting features Centrifugo PRO provides a generic high precision rate limiting API. It may be used for custom quota managing tasks not even related to real-time connections. Its distributed nature allows managing quotas across different instances of your application backend.

The original reason why we decided to ship this as part of our PRO version APIs was the desire to simplify our PRO users the implementation of per-user push notification limits when using [Push Notification API](./push_notifications.md). But you are free to use the API for other custom needs as well - like using it for login rate limiting in your system, etc.

## Overview

Centrifugo distributed rate limiting is a high performance zero-configuration Redis-based token bucket with milliseconds precision. Zero configuration in this case means that you don't have to preconfigure buckets in Centrifugo – bucket configuration is a part of request to check allowed limits.

```bash
curl -X POST http://localhost:8000/api/rate_limit \
-H "Authorization: apikey <KEY>" \
-d @- <<'EOF'

{
    "key": "rate_limit_test",
    "rate": 10,
    "interval_ms": 60000
}
EOF
```

Example result:

```json
{
    "result": {
        "allowed": true,
        "tokens_left": 9
    }
}
```

Or, when no tokens left in a bucket:

```json
{
    "result": {
        "allowed": false,
        "tokens_left": 0,
        "allowed_in_ms": 5208,
        "server_time_ms": 1694627573210,
    }
}
```

In your app code call `rate_limit` API of Centrifugo PRO every time some action is executed and check `allowed` flag to allow or discard the action.

Centrifugo PRO also returns `allowed_in_ms` and `server_time_ms` fields to help understanding when action will be allowed again. These fields are only appended when `tokens_left` are less than requested `score`. `allowed_in_ms` + `server_time_ms` will provide you a timestamp in the future (in milliseconds) when action is possible to be executed. So you can delay next action execution till that time if possible.

## Configuration

To enable distributed rate limiter:

```json title="config.json"
{
  ...
  "distributed_rate_limit": {
    "enabled": true,
    "redis_address": "localhost:6379"
  }  
}
```

Note, that just like most of other features in Centrifugo it's possible to configure Redis shards here or use Redis Cluster. This provides a straighforward way to scale rate limiting since bucket keys will be distributed over different Redis nodes.

## API description

Now let's look at API description.

### rate_limit

Rate limit request, consumes tokens from bucket, returns whether action is allowed or not.

#### rate_limit request

| Field | Type | Required | Description |
|-------|------|----|-------------|
| `key`   | `string` | Yes | Key for a bucket - you can construct keys whatever way you like |
| `interval_ms` | `integer` | Yes | Interval in milliseconds |
| `rate` | `integer` | Yes | Allowed rate per provided interval |
| `score` | `integer` | No | Score for the current action, if not provided the default score 1 is used |
| `dry_run` | `bool` | No | If set runs rate limit request as usual, but does not actually modify Redis state for a bucket - i.e. tokens won't be really consumed from a bucket |

#### rate_limit result

| Field Name | Type | Required | Description |
| --- | --- | --- | --- |
| `allowed` | `bool` | Yes | Whether desired action is allowed at this point in time |
| `tokens_left` | `integer` | Yes | How many tokens left in a bucket |
| `allowed_in_ms` | `integer` | No | Milliseconds till desired score will be allowed again |
| `server_time_ms` | `integer` | No | Server time as Unix epoch in milliseconds used to calculate result |

### reset_rate_limit

Resets bucket counters in Redis

#### reset_rate_limit request

| Field | Type | Required | Description |
|-------|------|----|-------------|
| `key`   | `string` | Yes | Key to reset |

#### reset_rate_limit result

Empty object at the moment.

## Example

Here is an example of Go program which uses Centrifugo PRO distributed rate limiter and executes some heavy work as fast as possible according to selected rate limiting policy:

```go
package main

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"log"
	"net/http"
	"os"
	"os/signal"
	"time"
)

type RateLimitResponse struct {
	Result RateLimitResult `json:"result"`
}

type RateLimitResult struct {
	Allowed      bool  `json:"allowed"`
	TokensLeft   int64 `json:"tokens_left"`
	AllowedInMs  int64 `json:"allowed_in_ms,omitempty"`
	ServerTimeMs int64 `json:"server_time_ms,omitempty"`
}

func main() {
	ctx, cancel := signal.NotifyContext(context.Background(), os.Interrupt)
	defer cancel()

	client := &http.Client{
		Timeout: time.Second,
	}

	url := "http://localhost:8000/api/rate_limit"

	reqData := `{"key": "x", "rate": 1, "interval_ms": 5000}`

	for {
		req, _ := http.NewRequest(http.MethodPost, url, bytes.NewReader([]byte(reqData)))
		resp, _ := client.Do(req)
		body, _ := io.ReadAll(resp.Body)
		resp.Body.Close()

		var res RateLimitResponse
		_ = json.Unmarshal(body, &res)

		started := time.Now()
		if res.Result.Allowed {
			log.Println("do heavy work")
			select {
			case <-ctx.Done():
				return
			case <-time.After(500 * time.Millisecond):
			}
		}
		delay := time.Duration(res.Result.AllowedInMs)*time.Millisecond - time.Since(started)
		select {
		case <-ctx.Done():
			return
		case <-time.After(delay):
		}
	}
}
```

You can run several such programs in parallel and make sure that rate limits are preserved - `do heavy work` won't be printed faster than once in 5 secs.
