---
description: "Build a React SPA frontend with TypeScript and Vite for the Centrifugo chat tutorial, including state management, routing, and chat UI components."
id: frontend
sidebar_label: "Creating SPA frontend"
title: "Creating SPA frontend with React"
---

On the frontend we will use Vite with React and TypeScript. To keep the code clean and easy to follow, we define a small set of TypeScript interfaces in `frontend/src/types.ts` that mirror the JSON our backend API returns (users, rooms, messages, real-time events) and use them throughout the app. We still keep things simple and avoid advanced React patterns – the goal is readability, not showing off the type system. The prerequisite is NodeJS >= 20 (required by Vite).

We can start by creating frontend app with Vite inside `grand-chat-tutorial` dir:

```bash
npm create vite@latest
```

When asked, call the app `frontend`, select `React + Typescript` template. Then:

```bash
cd frontend
npm install
```

Since we want to start the entire application with a single docker compose command – let's again update `docker-compose.yml`. First, create custom Dockerfile in the frontend folder:

```Dockerfile title="frontend/Dockerfile"
FROM node:24-slim

WORKDIR /usr/src/app

ENV PATH=/usr/src/app/node_modules/.bin:$PATH

# install and cache app dependencies
COPY package.json .
COPY package-lock.json .
RUN npm ci

# start app
CMD ["vite", "--host"]
```

And add `frontend` service to `docker-compose.yaml` file:

```yaml title="docker-compose.yml"
frontend:
  stdin_open: true
  build: ./frontend
  volumes:
    - ./frontend:/usr/src/app
    - /usr/src/app/node_modules
  expose:
    - 5173
  environment:
    - NODE_ENV=development
  depends_on:
    - backend
```

When you eventually run the application with docker compose, the frontend will be updated automatically upon changes in source code files – which is very nice for development.

## App layout

Describing frontend code will be not so linear like we had for the backend case. First, let's start with the application top-level layout:

```javascript title="frontend/src/App.tsx"
const App: React.FC = () => {
  let localAuth: AuthInfo = {};
  if (localStorage.getItem(LOCAL_STORAGE_AUTH_INFO_KEY)) {
    localAuth = JSON.parse(localStorage.getItem(LOCAL_STORAGE_AUTH_INFO_KEY)!)
  }
  const [authenticated, setAuthenticated] = useState<boolean>(localAuth.id !== undefined)
  const [userInfo, setUserInfo] = useState<AuthInfo>(localAuth)
  const [csrf, setCSRF] = useState('')
  const [unrecoverableError, setUnrecoverableError] = useState('')
  const [chatState, dispatch] = useReducer(reducer, initialChatState);
  const [connected, setConnected] = useState(false)

  return (
    <CsrfContext.Provider value={csrf}>
      <AuthContext.Provider value={userInfo}>
        {authenticated ? (
          <ChatContext.Provider value={{ state: chatState, dispatch }}>
            <Router>
              <ChatLayout>
                <Routes>
                  <Route path="/" element={<ChatRoomList />} />
                  <Route path="/search" element={<ChatSearch />} />
                  <Route path="/rooms/:id" element={<ChatRoomDetail />} />
                </Routes>
              </ChatLayout>
            </Router>
          </ChatContext.Provider>
        ) : (
          <ChatLogin />
        )}
      </AuthContext.Provider>
    </CsrfContext.Provider>
  );
};

export default App;
```

Here we skipped some final code to emphasize the core layout.

The first thing to note is that we wrapped the app into two React contexts: `CsrfContext` and `AuthContext`. React contexts allow sharing some state without needing to pass it over props to children components. `CsrfContext` allows access to the CSRF token everywhere in the app; `AuthContext` provides authentication information.

We render `ChatLogin` page if user is not authenticated and one of the chat screens if user authenticated. [React Router](https://reactrouter.com/en/main) is used for the navigation.

Authentication information is stored in `LocalStorage` and we load it from there during the app initial load.

Note, that here we are using [React reducer](https://react.dev/reference/react/useReducer) to manage chat state. We do this to serialize changes and thus simplify state management – trust us before we started using the reducer chat state management was a hell. It's not the only approach – there are other techniques to manage state in complex React apps (like [Redux](https://react-redux.js.org/), etc), but reducer works for us here. The chat state shape and its initial value are defined in `frontend/src/types.ts` together with the rest of our domain types:

```typescript title="frontend/src/types.ts"
export interface ChatState {
  // Ordered room IDs – the source of truth for room order on the screen.
  rooms: number[];
  // Room objects by id. A `null` value marks a room the user has left.
  roomsById: Record<number, Room | null>;
  // Messages by room id.
  messagesByRoomId: Record<number, Message[]>;
}

export const initialChatState: ChatState = {
  rooms: [],
  roomsById: {},
  messagesByRoomId: {},
};
```

* `rooms` is an array with room IDs for room sorting during rendering.
* `roomsById` keeps room objects by id
* `messagesByRoomId` keeps messages by room id

We are not pretending that the way we show here is the best – it could be organized differently no doubt.

Regarding `connected` – it will be used later to show whether the real-time connection is currently established (the 🟢 / 🔴 indicator).

## Login screen

Let's look at `ChatLogin` component. To make it we need to render a login form:

```typescript title="frontend/src/ChatLogin.tsx"
import { useState, useContext } from 'react';
import axios from 'axios';
import logo from './assets/centrifugo.svg'
import CsrfContext from './CsrfContext';
import { login } from './AppApi';
import type { AuthInfo } from './types';

interface ChatLoginProps {
  onSuccess: (userInfo: AuthInfo) => void;
}

const ChatLogin: React.FC<ChatLoginProps> = ({ onSuccess }) => {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const csrf = useContext(CsrfContext)

  const handleLogin = async () => {
    setLoading(true)
    setError('')
    try {
      const userInfo = await login(csrf, username, password)
      onSuccess(userInfo);
    } catch (err) {
      // The backend returns a human-readable reason (e.g. "invalid credentials").
      if (axios.isAxiosError(err) && err.response?.data?.detail) {
        setError(err.response.data.detail)
      } else {
        setError('Login failed, please try again.')
      }
    }
    setLoading(false)
  };

  return (
    <form id="chat-login" onSubmit={(e) => {
      e.preventDefault()
      handleLogin()
    }}>
      <div id="chat-login-logo-container">
        <img src={logo} width="100px" height="100px" />
      </div>
      <div className="input-container">
        <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Username" />
      </div>
      <div className="input-container">
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" autoComplete="current-password" />
      </div>
      {error && <div className="login-error">{error}</div>}
      <div className='login-button-container'>
        <button disabled={loading} className={`${(loading) ? 'loading' : ''}`}>Login</button>
      </div>
    </form>
  );
};

export default ChatLogin;
```

This is quite a straightforward component. On success it hands the authenticated user info back to `App` via the `onSuccess` callback; on failure it shows the reason returned by the backend (e.g. wrong credentials). Note the import from `./AppApi` - we've put all the API methods to a separate file, where we use the `axios` HTTP client to communicate with the backend API. Each call is typed with the interfaces from `types.ts`, for example the `login` call looks like this:

```typescript title="frontend/src/AppApi.tsx"
import axios from "axios";
import { API_ENDPOINT_BASE } from "./AppSettings";
import type { AuthInfo } from "./types";

export const login = async (csrfToken: string, username: string, password: string): Promise<AuthInfo> => {
  const response = await axios.post(`${API_ENDPOINT_BASE}/api/login/`, { username, password }, {
    headers: {
      "X-CSRFToken": csrfToken
    }
  });
  return response.data
}
```

Other API calls look very similar, so we won't pay attention to them further – but you can always take a look in the source code.

## Chat room list screen

On the root page we show rooms current user is member of. `ChatRoomList` component renders rooms. But note that rooms are managed outside of this component – it just renders rooms from application chat state.

```typescript title="frontend/src/ChatRoomList.tsx"
import { useContext } from 'react';
import { Link } from 'react-router-dom';
import ChatContext from './ChatContext'

const ChatRoomList = () => {
  const { state } = useContext(ChatContext);

  return (
    <div id="chat-rooms">
      {state.rooms.map((roomId) => {
        const room = state.roomsById[roomId]
        if (!room) {
          return null
        }
        return <div className="chat-room-block" key={room.id}>
          <Link to={`/rooms/${room.id}`}>
            <div className="left-column">
              <span className="name">{room.name}</span>
              <span className="message-content">
                {room.last_message? (
                  <span>
                    <span className='message-content-author'>{room.last_message.user.username}:</span>
                    &nbsp;
                    {room.last_message.content}
                  </span>
                ) : (<></>)}
              </span>
            </div>
            <div className="right-column">
              <span className="chat-room-member-counter">{room.member_count}&nbsp;<span className="chat-room-member-counter-icon">🐈</span></span>
            </div>
          </Link>
        </div>
      })}
    </div>
  );
};

export default ChatRoomList;
```

Note, we iterate over the `state.rooms` array which only contains IDs of rooms and is the source of truth for the order of rooms on the screen. As a reminder: we sort rooms on this screen by the `bumped_at` field in descending order.

## Chat room search screen

Chat rooms search screen shows list of all rooms in the app available to join. What's important to note here – as soon as user joins/leaves the room we update chat state by dispatching `ADD_ROOMS` or `DELETE_ROOM` state events. This allows us to synchronize room state – so that after user joins some room, the room appears on room list screen.

```typescript title="frontend/src/ChatSearch.tsx"
import { useState, useEffect, useContext } from 'react';
import CsrfContext from './CsrfContext';
import ChatContext from './ChatContext';
import { joinRoom, leaveRoom, searchRooms } from './AppApi';
import type { Room, RoomSearchResult } from './types';

interface ChatSearchProps {
  fetchRoom: (roomId: string) => Promise<Room | null>
}

const ChatSearch: React.FC<ChatSearchProps> = ({ fetchRoom }) => {
  const csrf = useContext(CsrfContext);
  const { state, dispatch } = useContext(ChatContext);
  const [rooms, setRooms] = useState<RoomSearchResult[]>([]);
  const [loading, setLoading] = useState<Record<number, boolean>>({})

  const setLoadingFlag = (roomId: number, value: boolean) => {
    setLoading((prev) => ({
      ...prev,
      [roomId]: value
    }));
  };

  const onJoin = async (roomId: number) => {
    setLoadingFlag(roomId, true)
    try {
      await joinRoom(csrf, String(roomId))
      const room = await fetchRoom(String(roomId))
      if (room) {
        dispatch({ type: "ADD_ROOMS", payload: { rooms: [room] } })
      }
    } catch (e) {
      console.log(e)
    }
    setLoadingFlag(roomId, false)
  };

  const onLeave = async (roomId: number) => {
    setLoadingFlag(roomId, true)
    try {
      await leaveRoom(csrf, String(roomId))
      dispatch({ type: "DELETE_ROOM", payload: { roomId: roomId } })
    } catch (e) {
      console.log(e)
    }
    setLoadingFlag(roomId, false)
  };

  useEffect(() => {
    const fetchRooms = async () => {
      const rooms = await searchRooms()
      setRooms(rooms)
    };
    fetchRooms();
  }, []);

  return (
    <div id="chat-rooms">
      {rooms.map((room) => {
        const roomState = state.roomsById[room.id]
        let isMember: boolean;
        if (roomState === null) {
          isMember = false
        } else if (roomState !== undefined) {
          isMember = true
        } else {
          isMember = room.is_member
        }
        return <div className={`chat-room-block ${(isMember) ? 'member' : 'not-member'}`} key={room.id}>
          <div className='room-search-item'>
            <span>
              {room.name}
            </span>
            <span className="room-actions">
              <button disabled={loading[room.id] === true} className={`${(isMember) ? 'member' : 'not-member'} ${(loading[room.id]) ? 'loading' : ''}`} onClick={() => {
                if (isMember) {
                  onLeave(room.id)
                } else {
                  onJoin(room.id)
                }
              }}>
                {(isMember) ? 'Leave' : 'Join'}
              </button>
            </span>
          </div>
        </div>
      })}
    </div>
  );
};

export default ChatSearch;
```

## Chat room detail screen

This screen displays information about the room, renders its messages and provides an input to send new messages.

```typescript title="frontend/src/ChatRoomDetail.tsx"
import { useState, useEffect, useContext, useRef } from 'react';
import type { UIEvent } from 'react';
import { useParams } from 'react-router-dom';
import AuthContext from './AuthContext';
import ChatContext from './ChatContext';
import type { Message, Room } from './types';

interface ChatRoomDetailProps {
  fetchRoom: (roomId: string) => Promise<Room | null>
  fetchMessages: (roomId: string) => Promise<Message[] | null>
  publishMessage: (roomId: string, content: string) => Promise<Message | null>
}

const ChatRoomDetail: React.FC<ChatRoomDetailProps> = ({ fetchRoom, fetchMessages, publishMessage }) => {
  const { id } = useParams() as { id: string };
  const roomId = Number(id);
  const userInfo = useContext(AuthContext);
  const { state, dispatch } = useContext(ChatContext);
  const [content, setContent] = useState('')
  const [messagesLoading, setMessagesLoading] = useState(false)
  const [roomLoading, setRoomLoading] = useState(false)
  const [sendLoading, setSendLoading] = useState(false)
  const [notFound, setNotFound] = useState(false);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null); // Ref for the messages container.

  useEffect(() => {
    if (messagesLoading) return
    const init = async () => {
      setMessagesLoading(true)
      if (!state.messagesByRoomId[roomId]) {
        const messages = await fetchMessages(id)
        if (messages === null) {
          setNotFound(true);
        } else {
          setNotFound(false);
          dispatch({
            type: "ADD_MESSAGES", payload: {
              roomId: roomId,
              messages: messages
            }
          })
        }
      }
      setMessagesLoading(false)
    }
    init()
  }, [id, roomId, state.messagesByRoomId, fetchMessages]);

  useEffect(() => {
    if (roomLoading) return
    const init = async () => {
      setRoomLoading(true)
      if (!state.roomsById[roomId]) {
        const room = await fetchRoom(id)
        if (room === null) {
          setNotFound(true);
        } else {
          setNotFound(false);
          dispatch({
            type: "ADD_ROOMS", payload: {
              rooms: [room],
            }
          })
        }
      }
      setRoomLoading(false)
    }
    init()
  }, [id, roomId, state.roomsById, fetchRoom]);

  const room = state.roomsById[roomId];
  const messages = state.messagesByRoomId[roomId] || [];

  const scrollToBottom = () => {
    const container = messagesEndRef.current;
    if (container) {
      container.scrollTo({ top: container.scrollHeight, behavior: 'auto' });
    }
  };

  const getTime = (timeString: string) => {
    const date = new Date(timeString);
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const seconds = date.getSeconds().toString().padStart(2, '0');
    return `${hours}:${minutes}:${seconds}`;
  }

  const onFormSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (sendLoading) {
      return
    }
    setSendLoading(true)
    try {
      const message = await publishMessage(id, content)
      if (message) {
        dispatch({
          type: "ADD_MESSAGES", payload: {
            roomId: roomId,
            messages: [message]
          }
        })
        setContent('')
      }
    } catch (e) {
      console.log(e)
    }
    setSendLoading(false)
  }

  const handleScroll = (e: UIEvent<HTMLDivElement>) => {
    const container = e.target as HTMLElement;
    if (!container) return;
    const threshold = 40; // Pixels from the bottom to be considered 'near bottom'.
    const position = container.scrollTop + container.offsetHeight;
    const height = container.scrollHeight;
    setIsAtBottom(position + threshold >= height)
  };

  // Scroll to bottom after layout changes – but only if the user is already near
  // the bottom, so we don't yank them down while they're reading older messages.
  useEffect(() => {
    if (isAtBottom) {
      scrollToBottom();
    }
  }, [messages, isAtBottom]);

  return (
    <div id="chat-room">
      {notFound ? (
        <div id="room-not-found">
          NOT A MEMBER OF THIS ROOM
        </div>
      ) : (
        <>
          <div id="room-description">
            <span id="room-name">{room?.name}</span>
            <span id="room-member-count">{room?.member_count} <span className='chat-room-member-counter-icon'>🐈</span></span>
          </div>
          <div id="room-messages" onScroll={handleScroll} ref={messagesEndRef}>
            {messages.map((message) => (
              <div key={message.id} className={`room-message ${(userInfo.id == message.user.id) ? 'room-message-mine' : 'room-message-not-mine'}`}>
                <div className='message-avatar'>
                  <img src={`https://robohash.org/user${message.user.id}.png?set=set4`} alt="" />
                </div>
                <div className='message-bubble'>
                  <div className='message-meta'>
                    <div className='message-author'>
                      {message.user.username}
                    </div>
                    <div className='message-time'>
                      {getTime(message.created_at)}
                    </div>
                  </div>
                  <div className='message-content'>
                    {message.content}
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div id="chat-input-container" className={`${(sendLoading) ? 'loading' : ''}`}>
            <form onSubmit={onFormSubmit}>
              <input type="text" autoComplete="off" value={content} placeholder="Enter message..." onChange={e => setContent(e.currentTarget.value)} required />
            </form>
          </div>
        </>
      )}
    </div>
  );
};

export default ChatRoomDetail;
```

Let's discuss some important or non-so-obvious things in the implementation.

One interesting thing is how we handle scroll – if user currently in the end of messages area - then we scroll to the end again after adding a new message. If user scrolls top – we prevent automatic scrolling on new message – because user most probably does not want scroll to work at that moment. This is a very common UX decision in messenger apps.

For faking avatars we are using cute pictures of cats generated by [robohash.org](https://robohash.org/). Each user gets unique cat picture based on user ID.

The core behaviour is straightforward – we render messages in chat and render an input for sending new messages. As soon as user submits input form – we call the backend API to create a new message in the room.

The thing to note – again, we use calls to modify state here, `ADD_ROOMS` and `ADD_MESSAGES`. We will look at reducer and describe state management shortly.

## Chat state reducer

To remind, the initial chat state (defined in `frontend/src/types.ts`) looks like this:

```typescript title="frontend/src/types.ts"
export const initialChatState: ChatState = {
  rooms: [],
  roomsById: {},
  messagesByRoomId: {},
};
```

The reducer itself lives in `frontend/src/App.tsx` and is fully typed – it takes the `ChatState` and a `ChatAction` (a discriminated union of all our actions, also declared in `types.ts`) and returns the next `ChatState`. In the app we have several reducer actions to modify this state:

* `CLEAR_CHAT_STATE`
* `ADD_ROOMS`
* `DELETE_ROOM`
* `ADD_MESSAGES`
* `SET_ROOM_MEMBER_COUNT`

State management like this is not the easiest thing to get right. Keeping the reducer as the single place where chat state changes – with each action small and focused – is what makes the logic easy to follow, and it's why the real-time handlers we saw can stay so simple.

### CLEAR_CHAT_STATE

Allows dropping the entire chat state, simply returns `initialChatState` const:

```typescript
function reducer(state: ChatState, action: ChatAction): ChatState {
  switch (action.type) {
    case 'CLEAR_CHAT_STATE': {
      return initialChatState;
    }
```

### ADD_ROOMS

Used to add rooms to the state. This may happen when we load rooms for room list screen, when we got an event from a room which is not yet known, also it's called from search screen when user joins some room:

```typescript
case 'ADD_ROOMS': {
  const newRooms = action.payload.rooms;

  // Update roomsById with new rooms, avoiding duplicates.
  const updatedRoomsById = { ...state.roomsById };
  newRooms.forEach((room) => {
    if (!updatedRoomsById[room.id]) {
      updatedRoomsById[room.id] = room;
    }
  });

  // Merge new room IDs with existing ones, filtering out duplicates.
  const mergedRoomIds = [...new Set([...newRooms.map((room) => room.id), ...state.rooms])];

  // Sort room IDs by the bumped_at field of their rooms, newest first.
  const sortedRoomIds = sortRoomIds(mergedRoomIds, updatedRoomsById);

  return {
    ...state,
    roomsById: updatedRoomsById,
    rooms: sortedRoomIds
  };
}
```

Sorting is shared by a couple of actions, so we extract it into a small helper. Note that RFC 3339 date strings are directly comparable lexicographically, so we don't need to parse them into `Date` objects:

```typescript
function sortRoomIds(roomIds: number[], roomsById: Record<number, Room | null>): number[] {
  return [...roomIds].sort((a, b) => {
    const roomA = roomsById[a];
    const roomB = roomsById[b];
    if (!roomA || !roomB) return 0;
    return roomB.bumped_at.localeCompare(roomA.bumped_at);
  });
}
```

### DELETE_ROOM

This action helps to remove the room from the room list screen. Used when the current user leaves the room from the search screen, or when we receive an event that the current user left the room – this helps us to sync across different devices.

```typescript
case 'DELETE_ROOM': {
  const roomId = action.payload.roomId;

  // Set the specified room to null instead of deleting it. This lets the
  // search screen keep its membership badge in sync.
  const newRoomsById = {
    ...state.roomsById,
    [roomId]: null
  };

  // Remove the room from the rooms array.
  const newRooms = state.rooms.filter((id) => id !== roomId);

  // Remove associated messages.
  const newMessagesByRoomId = { ...state.messagesByRoomId };
  delete newMessagesByRoomId[roomId];

  return {
    ...state,
    roomsById: newRoomsById,
    rooms: newRooms,
    messagesByRoomId: newMessagesByRoomId
  };
}
```

### ADD_MESSAGES

Whenever we send a message, receive an async real-time message, or simply load messages on the Chat Detail Screen - we call this action to maintain a proper message list for each known room on the room list screen.

```typescript
case 'ADD_MESSAGES': {
  const roomId = action.payload.roomId;
  const newMessages = action.payload.messages;
  const currentMessages = state.messagesByRoomId[roomId] || [];

  // Combine current and new messages, then filter out duplicates.
  const combinedMessages = [...currentMessages, ...newMessages].filter(
    (message, index, self) =>
      index === self.findIndex(m => m.id === message.id)
  );

  // Sort the combined messages by id in ascending order.
  combinedMessages.sort((a, b) => a.id - b.id);

  // The message with the highest ID is the latest one.
  const lastMessage = combinedMessages.length > 0 ? combinedMessages[combinedMessages.length - 1] : null;

  let needSort = false;

  // Update the room's last_message and bumped_at if we got a newer message.
  // We create a new room object instead of mutating the existing one.
  const updatedRoomsById = { ...state.roomsById };
  const room = updatedRoomsById[roomId];
  if (lastMessage && room && (!room.last_message || lastMessage.id > room.last_message.id)) {
    updatedRoomsById[roomId] = {
      ...room,
      last_message: lastMessage,
      bumped_at: lastMessage.room.bumped_at,
    };
    needSort = true;
  }

  const updatedRooms = needSort ? sortRoomIds(state.rooms, updatedRoomsById) : state.rooms;

  return {
    ...state,
    messagesByRoomId: {
      ...state.messagesByRoomId,
      [roomId]: combinedMessages
    },
    roomsById: updatedRoomsById,
    rooms: updatedRooms,
  };
}
```

### SET_ROOM_MEMBER_COUNT

This reducer is called whenever we get events about membership changes – we will add such events soon when we talk about Centrifugo integration.

```typescript
case 'SET_ROOM_MEMBER_COUNT': {
  const { roomId, version, memberCount } = action.payload;

  const room = state.roomsById[roomId];
  if (!room) {
    console.error(`Room with ID ${roomId} not found.`);
    return state;
  }

  // Ignore events older than the state we already have.
  if (version <= room.version) {
    console.error(`Outdated version for room ID ${roomId}.`);
    return state;
  }

  // Return the new state with an updated room object.
  return {
    ...state,
    roomsById: {
      ...state.roomsById,
      [roomId]: { ...room, member_count: memberCount, version: version },
    },
  };
}
```

## Adding styles

For making frontend layout we use flexbox for CSS rules so the app will be fully responsive and look good on different screen sizes. If you are interested to learn more about it: check out [this guide](https://css-tricks.com/snippets/css/a-guide-to-flexbox/). Here we won't pay attention to CSS styles anymore.

## What we have at this point

Actually, at this point we have an app which provides messenger functionality.

You can use Django admin web UI to create some rooms and interact with them. Users can join/leave rooms and send messages. But to see new messages in a room, users need to reload the page. Not a good thing for a chat app, right? Counters about the number of users in a particular room are also not updated until page reload. So finally we are ready to integrate the app with Centrifugo.
