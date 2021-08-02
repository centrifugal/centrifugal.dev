---
id: api
title: Server API libraries 
---

Sending an API request to Centrifugo is a simple task to do in any programming language - this is just a POST request with JSON payload in body and `Authorization` header. See more in [special chapter](../server/server_api.md#http_api) in server section.

We have several official client libraries for different languages, so you don't have to construct proper HTTP requests manually:

* [cent](https://github.com/centrifugal/cent) for Python
* [phpcent](https://github.com/centrifugal/phpcent) for PHP
* [gocent](https://github.com/centrifugal/gocent) for Go

Also, there are API libraries created by community:

* [crystalcent](https://github.com/devops-israel/crystalcent) API client for Crystal language

:::note

Also, keep in mind that Centrifugo [has GRPC API](../server/server_api.md#grpc_api) so you can automatically generate client API code for your language.

:::
