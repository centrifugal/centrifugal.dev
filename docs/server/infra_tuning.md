---
description: "Tune your server infrastructure for Centrifugo. Covers open file limits, ephemeral port exhaustion, TIME_WAIT sockets, proxy settings, and DDoS protection."
id: infra_tuning
title: Infrastructure tuning
---

Since Centrifugo deals with lots of persistent connections your operating system and server infrastructure must be ready for it too.

### Open files limit

Centrifugo opens one file descriptor per connection, so the maximum number of open files the process is allowed effectively caps how many clients a single node can serve. The default soft limit is low for this purpose — commonly `1024` on Linux distributions and `256` on macOS.

To see the current limit:

```
ulimit -n
```

On Linux you can check the limits of a running process with:

```
cat /proc/<PID>/limits
```

How you raise it depends on how Centrifugo is launched:

* **As a systemd service** (the usual case in production) – set `LimitNOFILE` in the unit, for example `LimitNOFILE=65536`, then run `systemctl daemon-reload` and restart the service. Note that a `ulimit` change in your shell does **not** affect a systemd-managed process. Centrifugo's official RPM/DEB packages already ship a service unit with a high limit (`65536`).
* **From a shell or another supervisor** – raise the limit in `/etc/security/limits.conf` (or a drop-in under `/etc/security/limits.d/`), or call `ulimit -n` before starting the process.

Don't forget to raise the same limit for any proxy in front of Centrifugo (Nginx, HAProxy, Envoy).

### Ephemeral port exhaustion

The ephemeral port exhaustion problem can happen between your load balancer and the Centrifugo server. If your clients connect directly to Centrifugo without any load balancer or reverse proxy software in between, then you most likely won't have this problem. But load balancing is a very common thing.

The problem arises due to the fact that each TCP connection uniquely identified in the OS by the 4-part-tuple:

```
source ip | source port | destination ip | destination port
```

On the load balancer/server boundary you are limited to 65536 possible source ports per destination. In practice only the ephemeral range is used for outgoing connections — on modern Linux that's `ip_local_port_range`, which defaults to `32768–60999` (~28k ports).

In order to eliminate a problem you can:

* Increase the ephemeral port range by tuning `ip_local_port_range` option
* Deploy more Centrifugo server instances to load balance across
* Deploy more load balancer instances
* Use virtual network interfaces

See [this archived Pusher blog post](https://web.archive.org/web/20220823105606/https://making.pusher.com/ephemeral-port-exhaustion-and-how-to-avoid-it/) about this problem and more detailed solution steps.

### Sockets in TIME_WAIT state

On the load balancer/server boundary, one more problem can arise: sockets in TIME_WAIT state.

Under load, when many connections and disconnections happen, socket descriptors can stay in TIME_WAIT state. Those descriptors cannot be reused for a while. So you can get various
errors when using Centrifugo. For example, something like `(99: Cannot assign requested address) while connecting to upstream` in the Nginx error log and 502 on the client side.

Check how many socket descriptors are in TIME_WAIT state:

```
ss -tan state time-wait | wc -l
```

Nice article about TIME_WAIT sockets: https://vincent.bernat.ch/en/blog/2014-tcp-time-wait-state-linux

The advices here are similar to ephemeral port exhaustion problem:

* Increase the ephemeral port range by tuning `ip_local_port_range` option
* Deploy more Centrifugo server instances to load balance across
* Deploy more load balancer instances
* Use virtual network interfaces

### Proxy max connections

Proxies like Nginx and Envoy have default limits on maximum number of connections which can be established.

Make sure you have a reasonable limit for the maximum number of incoming and outgoing connections in your proxy configuration.

### Conntrack table

More rare (since default limit is usually sufficient) your possible number of connections can be limited by conntrack table. Netfilter framework which is part of iptables keeps information about all connections and has limited size for this information. See how to see its limits and instructions to increase [in this article](https://morganwu277.github.io/2018/05/26/Solve-production-issue-of-nf-conntrack-table-full-dropping-packet/).

### Additional server protection

You should also consider adding additional protection to your Centrifugo endpoints. Centrifugo itself provides several options (described in [configuration](./configuration.md) section) regarding server protection from the malicious behavior. Though an additional layer of DDOS protection on network or infrastructure level is highly recommended. For example, you may want to limit the number of connections coming from particular IP address.

Here we list some possible ways you can use to protect your Centrifugo installation:

* Adding Nginx [limit_conn_zone](https://nginx.org/en/docs/http/ngx_http_limit_conn_module.html#limit_conn_zone) configuration
* Using [stick tables](https://www.haproxy.com/blog/introduction-to-haproxy-stick-tables/) of Haproxy
* Configuring [rate limiting rules](https://developers.cloudflare.com/waf/rate-limiting-rules/) with Cloudflare

The list is not exhaustive of course.
