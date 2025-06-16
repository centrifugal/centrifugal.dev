---
title: Streaming AI responses with Centrifugo
tags: [centrifugo, ai, python, tutorial]
description: Centrifugo is an efficient and scalable transport for streaming AI responses. In this article, we will stream GPT-3.5 Turbo responses in real-time using Centrifugo temporary channels and Python. Simple and effective!
author: Alexander Emelin
authorTitle: Founder of Centrifugal Labs
authorImageURL: /img/alexander_emelin.jpeg
image: /img/gpt_cover.jpg
hide_table_of_contents: false
---

<!--truncate-->

Centrifugo may be used as an efficient and scalable transport for streaming AI responses. In this article, we will stream GPT-3.5 Turbo responses in real-time using Centrifugo temporary channels and Python. We will use OpenAI API to get the answers to user's prompts and stream them to the user using Centrifugo. The user will be able to see the response as it is being generated, similar to how ChatGPT works.

Here is a video of the final result:

<video width="100%" loop={true} autoPlay="autoplay" muted controls="" src="/img/gpt.mp4"></video>

## Source code

The source code of this example is available on [GitHub](https://github.com/centrifugal/examples/tree/master/v6/gpt-stream).

## 🧰 Tech Stack

In this example, we will use the following technologies:

- [FastAPI](https://fastapi.tiangolo.com/) – async backend in Python which is good for streaming.
- **Centrifugo** – will be used as transport for streaming responses to web clients.
- [OpenAI API](https://openai.com/api/) – LLM responses (via GPT-3.5 Turbo is used in the example).
- Some [Tailwind CSS](https://tailwindcss.com/) for styling.
- [Nginx](https://nginx.org/) as a reverse proxy to serve the frontend and route API requests to the backend.
- [Docker Compose](https://docs.docker.com/compose/) to run everything with a single command.

## Backend

We will build the backend using [FastAPI](https://fastapi.tiangolo.com/) - which is a modern web framework for building APIs with Python. It is easy to use, and has great support for asynchronous programming, which is perfect for streaming responses.

The entire backend app is about 70 lines of code only:

```python
from fastapi import FastAPI
from pydantic import BaseModel
from openai import OpenAI
import httpx
import os

app = FastAPI()

client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

CENTRIFUGO_HTTP_API_URL = "http://centrifugo:8000/api"
CENTRIFUGO_HTTP_API_KEY = "secret"

class Command(BaseModel):
    text: str
    channel: str


@app.post("/api/execute")
async def api_execute(cmd: Command):
    await handle_command(cmd)
    return {}


class StreamMessage(BaseModel):
    text: str
    done: bool


async def handle_command(cmd: Command):
    text = cmd.text
    channel = cmd.channel

    try:
        response = client.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=[{"role": "user", "content": text}],
            stream=True,
        )
        for chunk in response:
            token = chunk.choices[0].delta.content or ""
            if token:
                await publish_message(
                    channel,
                    StreamMessage(text=token, done=False).model_dump()
                )
        await publish_message(
            channel,
            StreamMessage(text=token, done=True).model_dump()
        )
    except Exception as e:
        await publish_message(
            channel,
            StreamMessage(text=f"⚠️ Error: {e}", done=True).model_dump()
        )


async def publish_message(channel, stream_message):
    payload = {
        "channel": channel,
        "data": stream_message
    }

    headers = {
        "X-API-Key": f"{CENTRIFUGO_HTTP_API_KEY}",
        "Content-Type": "application/json"
    }

    async with httpx.AsyncClient() as http_client:
        await http_client.post(
            f"{CENTRIFUGO_HTTP_API_URL}/publish", json=payload, headers=headers
        )
```

Let's go through the code step by step:

1. **FastAPI Setup**: We create a FastAPI application instance.
2. **OpenAI Client**: We initialize the OpenAI client with the API key from environment variables.
3. **Command Model**: We define a Pydantic model `Command` to validate incoming requests with `text` and `channel` fields.
4. **API Endpoint**: We create an endpoint `/api/execute` that accepts POST requests with a `Command` payload.
5. **Command Handler**: The `handle_command` function processes the command, sending the user's text to OpenAI's chat completion API and streaming the response.
6. **Stream Message Model**: We define a `StreamMessage` model to structure the messages sent to Centrifugo.
7. **Publish Message**: The `publish_message` function sends the streamed messages to the specified Centrifugo channel using its HTTP API.
8. **Error Handling**: If an error occurs during the OpenAI API call, we send an error message to the Centrifugo channel.
9. **Asynchronous Execution**: The use of `async` and `await` allows the application to handle multiple requests concurrently, making it efficient for streaming responses.

## Frontend

The frontend in this example is a single `index.html` file which draws a chat interface, handles user prompts and connects to Centrifugo to receive answer tokens in real-time.

Here is the code for the frontend (`frontend/index.html`):

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Chat with GPT Streaming</title>
  <script src="https://unpkg.com/centrifuge@5.3.5/dist/centrifuge.js"></script>
  <script src="https://cdn.tailwindcss.com"></script>
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
</head>
<body class="bg-black text-gray-200 min-h-screen flex flex-col items-center justify-start py-6 px-4 text-base">
  <div class="w-full max-w-2xl bg-black shadow-lg rounded-xl overflow-hidden border border-gray-700">
    <div class="bg-gradient-to-r from-blue-700 to-indigo-700 text-white px-6 py-4 text-2xl font-bold">
      🧠 Chat with GPT Streaming
    </div>
    <div id="chat" class="h-96 overflow-y-auto p-4 space-y-3 bg-black text-base"></div>
    <div class="border-t border-gray-700 px-4 py-3 bg-black flex gap-3">
      <input id="input" type="text" placeholder="Type your question..."
        class="flex-1 border border-gray-600 bg-gray-900 text-white rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
        onkeydown="if(event.key === 'Enter') handleSend()" />
      <button onclick="handleSend()"
        class="bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 py-2 rounded-lg transition text-base">Send</button>
    </div>
  </div>

  <script>
    const USER = "User_" + Math.floor(Math.random() * 1000);
    const BACKEND_URL = "/api/execute";
    const CENTRIFUGO_WS = "ws://" + location.host + "/connection/websocket";
    const centrifuge = new Centrifuge(CENTRIFUGO_WS);
    centrifuge.connect();

    const chat = document.getElementById("chat");
    const input = document.getElementById("input");

    function appendMessage(text, id = null, type = "user") {
      let el = id ? document.getElementById(id) : null;
      if (!el) {
        el = document.createElement("div");
        el.className = `msg px-3 py-2 rounded-lg max-w-full break-words ${
          type === "user" ? "bg-blue-500 text-white self-end ml-auto" : "bg-gray-700 text-gray-100"
        }`;
        el.id = id || "";
        chat.appendChild(el);
      }

      el.innerHTML = text.replace(/\n/g, '<br>');
      chat.scrollTop = chat.scrollHeight;
    }

    async function handleStreamSubscription(channel, replyId) {
      const sub = centrifuge.newSubscription(channel);
      let reply = "";

      sub.on("publication", ctx => {
        const msg = ctx.data;
        if (msg.text) {
          const token = msg.text || "";
          reply += token;
          appendMessage(`GPTBot: ${reply}`, replyId, "bot");
        }
        if (msg.done) {
          sub.unsubscribe();
        }
      });

      sub.subscribe();
      await sub.ready();
    }

    async function handleSend() {
      const text = input.value.trim();
      if (!text) return;
      input.value = "";
      const msgId = crypto.randomUUID();
      const channel = `stream_${msgId}`;

      appendMessage(`${USER}: ${text}`, null, "user");

      const cmd = {
        text: text,
        channel: channel,
      };

      await handleStreamSubscription(channel, msgId);

      await fetch(BACKEND_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cmd)
      });
    }
  </script>
</body>
</html>
```

The key parts of the code are:

1. **Centrifugo Connection**: The frontend connects to Centrifugo WebSocket endpoint using the [centrifuge-js](https://github.com/centrifugal/centrifuge-js) library.
2. **Chat Interface**: The chat interface is built using Tailwind CSS for styling. It consists of a chat area and an input field for user prompts.
3. **Message Handling**: The `appendMessage` function appends messages to the chat area, distinguishing between user and bot messages.
4. **Stream Subscription**: The `handleStreamSubscription` function subscribes to a temporary channel for the user's prompt. It listens for incoming messages from Centrifugo and appends them to the chat interface in real-time.
5. **Sending User Prompts**: The `handleSend` function sends the user's prompt to the backend API and initiates the stream subscription for the response.
6. **UUID Generation**: Each user prompt is assigned a unique ID using `crypto.randomUUID()`, which is used to create a temporary channel for streaming the response.
7. **Real-time Updates**: The frontend updates the chat interface in real-time as tokens are received from the backend via Centrifugo. Once done signal is received, the subscription is unsubscribed.

## Centrifugo

As we can see frontend connects to Centrifugo WebSocket endpoint and subscribes to a temporary channel for each user prompt. The backend publishes the response tokens to this channel, and the frontend appends them to the chat interface in real-time.

Here we run Centrifugo with a simple configuration. The `config.json` file for Centrifugo will look like this:

```json
{
  "http_api": {
    "key": "secret"
  },
  "client": {
    "allowed_origins": ["*"],
    "insecure": true
  },
  "log": {
    "level": "debug"
  }
}
```

Note, we enabled insecure mode for the client, which allows us to not think about authentication in this example. In a real application, you should use secure connections and proper authentication mechanisms. We are also using a simple HTTP API key "secret" for the backend to publish messages to Centrifugo – you of course should use a more secure key in your app.

## Nginx

We will use Nginx as a reverse proxy to serve the frontend and route API requests to the backend. Nginx will also handle static files and provide a simple configuration for serving the application. Here is a Nginx server configuration we used (`nginx/default.conf`):

```nginx
server {
  listen 80;

  location / {
    root /usr/share/nginx/html;
    index index.html;
    try_files $uri $uri/ =404;
  }

  location /api {
    proxy_pass http://backend:5000;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
  }

  location /connection {
    proxy_pass http://centrifugo:8000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
  }
}
```

Basically it consists of three locations:

* `/` – serves the static files from the frontend directory
* `/api` – proxies requests to the backend FastAPI application
* `/connection` – proxies requests to Centrifugo for establishing a connection properly proxying WebSocket Upgrade headers

## Combining everything with Docker Compose

Finally, we will combine everything with Docker Compose. The `docker-compose.yml` file will look like this:

```yaml
services:
  centrifugo:
    image: centrifugo/centrifugo:v6
    container_name: centrifugo
    ports:
      - "8000:8000"
    volumes:
      - ./centrifugo:/centrifugo
    command: centrifugo -c /centrifugo/config.json
    env_file:
      - .env

  backend:
    build: ./backend
    container_name: backend
    ports:
      - "5000:5000"
    volumes:
      - ./backend:/app
    env_file:
      - .env
    depends_on:
      - centrifugo
    command: uvicorn app:app --host 0.0.0.0 --port 5000 --reload

  nginx:
    image: nginx:latest
    container_name: nginx
    ports:
      - "9000:80"
    volumes:
      - ./frontend:/usr/share/nginx/html:ro
      - ./nginx/default.conf:/etc/nginx/conf.d/default.conf:ro
    depends_on:
      - backend
      - centrifugo
```

Note, that to test the app with real OpenAI API you need to set your OpenAI API key in the `.env` file:

```
OPENAI_API_KEY="<YOUR_OPEN_AI_TOKEN>"
```

We made Nginx available on port `9000`, so once you start the application with:

```bash
docker compose up
```

you can access the frontend at [http://localhost:9000](http://localhost:9000).

## Conclusion

In this article, we have shown how to stream ChatGPT responses in real-time using Centrifugo as a real-time transport. We used FastAPI for the backend and OpenAI API for generating responses, but it may be easily adapted to other LLMs or backend frameworks. The example is simple and effective, and it can be used as a starting point for building more complex applications that require real-time streaming of AI responses.

In real app don't forget to handle user authentication, including proper authentication of user in Centrifugo. For Centrifugo part see for example [JWT auth example](/docs/tutorial/centrifugo#adding-jwt-connection-authentication) in our Grand Chat tutorial.
