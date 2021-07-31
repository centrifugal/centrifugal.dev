---
id: tracing
title: User and channel tracing
---

This is a unique thing. Tracing feature of Centrifugo PRO allows attaching to any channel to see all messages flying towards subscribers or attach to a specific user ID to see all user-related events in real-time.

It's possible to attach to trace streams using Centrifugo admin UI panel or simply from terminal using CURL and admin token. 

This can be super useful for debugging issues, investigating application behaviour, understanding that application works as expected. 

<video width="100%" controls>
  <source src="/img/tracing.mp4" type="video/mp4" />
  Sorry, your browser doesn't support embedded video.
</video>

:::note

Tracing feature works fine for JSON messages. For binary payloads there are some limitations currently.

:::

### Save to a file

It's possible to connect to admin tracing endpoint with CURL using admin session token and save tracing output to a file for later processing.

```
curl -X POST http://localhost:8000/admin/trace -H "Authorization: token <ADMIN_AUTH_TOKEN>" -d '{"type": "user", "entity": "56"}' -o trace.txt
```

At this moment you should copy admin auth token from browser developer tools, this may be improved in the future.
