---
id: tracing
title: User and channel tracing
---

The tracing feature of Centrifugo PRO allows attaching to any channel to see all messages flying towards subscribers or attach to a specific user ID to see all user-related events in real-time.

![tracing](/img/tracing.png)

It's possible to attach to trace streams using Centrifugo admin UI panel or from terminal using CURL.

This can be super-useful for debugging issues, investigating application behavior, understanding that the application works as expected. 

<video width="100%" controls>
  <source src="/img/tracing_ui.mp4" type="video/mp4" />
  Sorry, your browser doesn't support embedded video.
</video>

### Trace with curl

It's possible to connect to the admin tracing endpoint with CURL and save tracing output to a file for later processing.

The simplest way is to configure `admin.api_key` in your Centrifugo config:

```json title="config.json"
{
  "admin": {
    "api_key": "<your-secret-key>"
  }
}
```

Then use admin trace API directly with the `X-API-Key` header:

```
curl -X POST http://localhost:8000/admin/trace \
  -H "X-API-Key: <your-secret-key>" \
  -d '{"type": "user", "entity": "56"}'
```

Or for channel tracing:

```
curl -X POST http://localhost:8000/admin/trace \
  -H "X-API-Key: <your-secret-key>" \
  -d '{"type": "channel", "entity": "mychannel"}'
```

To save output to a file, add `-o trace.txt` (the file will be written to continuously until the connection is closed with Ctrl+C).

:::caution

Please note, this API is not meant to be stable at this point – we can change format of messages and requests while Centrifugo evolves.

:::

Alternatively, you can use the admin session token approach. To obtain the admin auth token, log into the admin UI and copy the token from browser developer tools (Network tab). When password-based admin authentication is used, you can also obtain the token programmatically:

```
curl -s -X POST http://localhost:8000/admin/auth -d "password=<ADMIN_PASSWORD>"
```

This returns a JSON response with a `token` field you can then use in the tracing request:

```
curl -X POST http://localhost:8000/admin/trace -H "Authorization: token <ADMIN_AUTH_TOKEN>" -d '{"type": "user", "entity": "56"}'
```
