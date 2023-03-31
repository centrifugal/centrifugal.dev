For swimlanes.io:

```
Client <- App Backend: JWT

note:
The backend generates JWT for a user and passes it to the client side.

Client -> Centrifugo: Client connects to Centrifugo with JWT

...: {fas-spinner} Persistent connection established

Client -> Centrifugo: Client issues channel subscribe requests

Centrifugo -->> Client: Client receives real-time updates from channels
```

```
Client -> Centrifugo: Connect request

note:
Client connects to Centrifugo without JWT.

Centrifugo -> App backend: Sends request further (via HTTP or GRPC)

note: The application backend validates client connection and tells Centrifugo user credentials in Connect reply.

App backend -> Centrifugo: Connect reply

Centrifugo -> Client: Connect Reply

...: {fas-spinner} Persistent connection established
```

```
Client -> App Backend: Publish request

note:
Client sends data to publish to the application backend.

Backend validates it, maybe modifies, optionally saves to the main database, constructs real-time update and publishes it to the Centrifugo server API.

App Backend -> Centrifugo: Publish over Centrifugo API

Centrifugo -->> Client: {far-bolt fa-lg} Real-time notification

note: Centrifugo delivers real-time message to active channel subscribers.
```

```
Client -> App Backend: Publish request

note:
Client sends data to publish to the application backend.

Backend validates it, maybe modifies, optionally saves to the main database, constructs real-time update and publishes it to the Centrifugo server API.

App Backend -> Centrifugo: Publish over Centrifugo API

Centrifugo -->> Client: {far-bolt fa-lg} Real-time notification

note: Centrifugo delivers real-time message to active channel subscribers.
```