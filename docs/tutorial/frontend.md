---
description: "Build a React SPA frontend with TypeScript and Vite for the Centrifugo chat tutorial, including state management, routing, and chat UI components."
id: frontend
sidebar_label: "Creating SPA frontend"
title: "Creating SPA frontend with React"
---

On the frontend we will use Vite with React and Typescript. In this tutorial we are not paying a lot of attention to making all the types strict and using `any` a lot. Which is actually a point for improvement, but at least helps to make the tutorial slightly shorter. The prerequisites is NodeJS >= 18.

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
FROM node:18-slim

WORKDIR /usr/src/app

ENV PATH /usr/src/app/node_modules/.bin:$PATH

# install and cache app dependencies
COPY package.json .
COPY package-lock.json .
RUN npm ci

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

When you eventually run application with docker compose, the frontend will be updated automatically upon changes in source code files – which is super nice for the development. 

## App layout

Describing frontend code will be not so linear like we had for the backend case. First, let's start with the application top-level layout:

```javascript title="frontend/src/App.tsx"
const App: React.FC = () => {
  let localAuth: any = {};
  if (localStorage.getItem(LOCAL_STORAGE_AUTH_KEY)) {
    localAuth = JSON.parse(localStorage.getItem(LOCAL_STORAGE_AUTH_KEY)!)
  }
  const [authenticated, setAuthenticated] = useState<boolean>(localAuth.id !== undefined)
  const [userInfo, setUserInfo] = useState<any>(localAuth)
  const [csrf, setCSRF] = useState('')
  const [unrecoverableError, setUnrecoverableError] = useState('')
  const [chatState, dispatch] = useReducer(reducer, initialChatState);
  const [realTimeStatus, setRealTimeStatus] = useState('🔴')
  const [messageQueue, setMessageQueue] = useState<any[]>([]);

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

First thing to note is that we wrapped the app into two React contexts: `CsrfContext` and `AuthContext`. React contexts allow sharing some state without need to pass it over props to children components. `CsrfContext` allows access to CSRF token everywhere in the app, `AuthContext` provides authentication information.

We render `ChatLogin` page if user is not authenticated and one of the chat screens if user authenticated. [React Router](https://reactrouter.com/en/main) is used for the navigation.

Authentication information is stored in `LocalStorage` and we load it from there during the app initial load.

Note, that here we are using [React reducer](https://react.dev/reference/react/useReducer) to manage chat state. We do this to serialize changes and thus simplify state management – trust us before we started using the reducer chat state management was a hell. It's not the only approach – there are other techniques to manage state in complex React apps (like [Redux](https://react-redux.js.org/), etc), but reducer works for us here. The initial chat state looks like this:

```javascript title="frontend/src/App.tsx"
const initialChatState = {
  rooms: [],
  roomsById: {},
  messagesByRoomId: {}
};
```

* `rooms` is an array with room IDs for room sorting during rendering.
* `roomsById` keeps room objects by id
* `messagesByRoomId` keeps messages by room id

We are not pretending that the way we show here is the best – it could be organized differently no doubt.

Regarding `realTimeStatus` and `messageQueue` – those will be later used for real-time features.

## Login screen

Let's look at `ChatLogin` component. To make it we need to render a login form:

```javascript title=" title="frontend/src/ChatLogin.tsx"
import React, { useState, useContext } from 'react';
import logo from './assets/centrifugo.svg'
import CsrfContext from './CsrfContext';
import { login } from './AppApi';

interface ChatLoginProps {
  onSuccess: (userId: string) => void;
}

const ChatLogin: React.FC<ChatLoginProps> = ({ onSuccess }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const csrf = useContext(CsrfContext);

  const handleLogin = async () => {
    try {
      const resp = await login(csrf, username, password)
      onSuccess(resp.user.id.toString());
    } catch (err) {
      console.error('Login failed:', err);
    }
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
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" />
      </div>
      <div className='login-button-container'>
        <button>Login</button>
      </div>
    </form>
  );
};

export default ChatLogin;
```

This is quite a straightforward component. Note the import from `./AppApi` - we've put all the API methods to a separate file, where we use `axios` HTTP client to communicate with the backend API. For example, `login` call looks like this:

```javascript title="frontend/src/AppApi.tsx"
import { API_ENDPOINT_BASE } from "./AppSettings";

export const login = async (csrfToken: string, username: string, password: string) => {
  const response = await axios.post(`${API_ENDPOINT_BASE}/api/login/`, { username, password }, {
    headers: {
      "X-CSRFToken": csrfToken
    }
  });
  return response.data
}
```

Other API calls look very similar, so we wan't pay attention to them further – but you can always take a look in source code.

## Chat room list screen

On the root page we show rooms current user is member of. `ChatRoomList` component renders rooms. But note that rooms are managed outside of this component – it just renders rooms from application chat state.

```javascript title="frontend/src/ChatRoomList.tsx"
import { useContext } from 'react';
import { Link } from 'react-router-dom';
import ChatContext from './ChatContext'

const ChatRoomList = () => {
  const { state } = useContext(ChatContext);

  return (
    <div id="chat-rooms">
      {state.rooms.map((roomId: number) => {
        const room = state.roomsById[roomId]
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

Note, we iterate over `state.rooms` array which only contains IDs of rooms and is a source of truth for the order of rooms on the screen. To remind: we sort rooms on this screen by `bumped_at` field in the descending order. 

## Chat room search screen

Chat rooms search screen shows list of all rooms in the app available to join. What's important to note here – as soon as user joins/leaves the room we update chat state by dispatching `ADD_ROOMS` or `DELETE_ROOM` state events. This allows us to synchronize room state – so that after user joins some room, the room appears on room list screen.

```javascript  title="frontend/src/ChatSearch.tsx"
import { useState, useEffect, useContext } from 'react';
import CsrfContext from './CsrfContext';
import ChatContext from './ChatContext';
import { joinRoom, leaveRoom, searchRooms } from './AppApi';

interface ChatSearchProps {
  fetchRoom: (roomId: string) => Promise<void>
}

const ChatSearch: React.FC<ChatSearchProps> = ({ fetchRoom }) => {
  const csrf = useContext(CsrfContext);
  const { state, dispatch } = useContext(ChatContext);
  const [rooms, setRooms] = useState<any>([]);
  const [loading, setLoading] = useState<any>({})

  const setLoadingFlag = (roomId: any, value: boolean) => {
    setLoading((prev: any) => ({
      ...prev,
      [roomId]: value
    }));
  };

  const onJoin = async (roomId: any) => {
    setLoadingFlag(roomId, true)
    try {
      await joinRoom(csrf, roomId)
      const room = await fetchRoom(roomId)
      dispatch({
        type: "ADD_ROOMS", payload: {
          rooms: [room]
        }
      })
      setRooms(rooms.map((room: any) => 
        room.id === roomId
          ? { ...room, is_member: true }
          : room
      ))
    } catch (e) {
      console.log(e)
    }
    setLoadingFlag(roomId, false)
  };

  const onLeave = async (roomId: any) => {
    setLoadingFlag(roomId, true)
    try {
      await leaveRoom(csrf, roomId)
      dispatch({
        type: "DELETE_ROOM", payload: {
          roomId: roomId
        }
      })
      setRooms(rooms.map((room: any) => 
        room.id === roomId
          ? { ...room, is_member: false }
          : room
      ))
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
      {rooms.map((room: any) => {
        const roomState = state.roomsById[room.id]
        let isMember: boolean;
        if (roomState == null) {
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

```javascript title="frontend/src/CharRoomDetail.tsx"
import { useState, useEffect, useContext, useRef, UIEvent } from 'react';
import { useParams } from 'react-router-dom';
import AuthContext from './AuthContext';
import ChatContext from './ChatContext';

interface ChatRoomDetailProps {
  fetchRoom: (roomId: string) => Promise<void>
  fetchMessages: (roomId: string) => Promise<any[]>
  publishMessage: (roomId: string, content: string) => Promise<boolean>
}

const ChatRoomDetail: React.FC<ChatRoomDetailProps> = ({ fetchRoom, fetchMessages, publishMessage }) => {
  const { id } = useParams() as { id: string };
  const userInfo = useContext(AuthContext);
  const { state, dispatch } = useContext(ChatContext);
  const [content, setContent] = useState('')
  const [messagesLoading, setMessagesLoading] = useState(false)
  const [roomLoading, setRoomLoading] = useState(false)
  const [sendLoading, setSendLoading] = useState(false)
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (messagesLoading) return
    const init = async () => {
      setMessagesLoading(true)
      if (!state.messagesByRoomId[id]) {
        const messages = await fetchMessages(id)
        if (messages === null) {
          setNotFound(true);
        } else {
          setNotFound(false);
          dispatch({
            type: "ADD_MESSAGES", payload: {
              roomId: id,
              messages: messages
            }
          })
        }
      }
      setMessagesLoading(false)
    }
    init()
  }, [id, state.messagesByRoomId, fetchMessages]);

  useEffect(() => {
    if (roomLoading) return
    const init = async () => {
      setRoomLoading(true)
      if (!state.roomsById[id]) {
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
  }, [id, state.roomsById, fetchRoom]);

  const room = state.roomsById[id] || {};
  const messages = state.messagesByRoomId[id] || [];

  const messagesEndRef = useRef<any>(null); // Ref for the messages container

  const scrollToBottom = () => {
    const container = messagesEndRef.current;
    if (container) {
      const scrollOptions = {
        top: container.scrollHeight,
        behavior: 'auto'
      };
      container.scrollTo(scrollOptions);
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
      const message = await publishMessage(id!, content)
      dispatch({
        type: "ADD_MESSAGES", payload: {
          roomId: id,
          messages: [message]
        }
      })
      setContent('')
    } catch (e) {
      console.log(e)
    }
    setSendLoading(false)
  }

  const handleScroll = (e: UIEvent<HTMLDivElement>) => {
    const container = (e.target as HTMLElement);
    if (!container) return;
    const threshold = 40; // Pixels from the bottom to be considered 'near bottom'
    const position = container.scrollTop + container.offsetHeight;
    const height = container.scrollHeight;
    setIsAtBottom(position + threshold >= height)
  };

  const [isAtBottom, setIsAtBottom] = useState(true);

  // Scroll to bottom after layout changes.
  useEffect(() => {
    if (isAtBottom) {
      scrollToBottom();
    }
  }, [messages, isAtBottom]); // Dependency on messages ensures it runs after messages are updated.

  return (
    <div id="chat-room">
      {notFound ? (
        <div id="room-not-found">
          NOT A MEMBER OF THIS ROOM
        </div>
      ) : (
        <>
          <div id="room-description">
            <span id="room-name">{room.name}</span>
            <span id="room-member-count">{room.member_count} <span className='chat-room-member-counter-icon'>🐈</span></span>
          </div>
          <div id="room-messages" onScroll={handleScroll} ref={messagesEndRef}>
            {messages.map((message: any) => (
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

To remind, the initial chat state looks like this:

```javascript title="frontend/src/App.tsx"
const initialChatState = {
  rooms: [],
  roomsById: {},
  messagesByRoomId: {}
};
```

In the app we have several reducer actions to modify this state:

* `CLEAR_CHAT_STATE`
* `ADD_ROOMS`
* `DELETE_ROOM`
* `ADD_MESSAGES`
* `SET_ROOM_MEMBER_COUNT`

State management in React is not very handy to write to be honest. What we've found though while writing this tutorial is that ChatGPT helps a lot with this task. If you describe the desired behavior properly – ChatGPT answers correctly.

### CLEAR_CHAT_STATE

Allows dropping the entire chat state, simply returns `initialChatState` const:

```javascript
function reducer(state: any, action: any) {
  switch (action.type) {
    case 'CLEAR_CHAT_STATE': {
      return initialChatState;
    }
```

### ADD_ROOMS

Used to add rooms to the state. This may happen when we load rooms for room list screen, when we got an event from a room which is not yet known, also it's called from search screen when user joins some room:

```javascript
case 'ADD_ROOMS': {
  const newRooms = action.payload.rooms;

  // Update roomsById with new rooms, avoiding duplicates.
  const updatedRoomsById = { ...state.roomsById };
  newRooms.forEach((room: any) => {
    if (!updatedRoomsById[room.id]) {
      updatedRoomsById[room.id] = room;
    }
  });

  // Merge new room IDs with existing ones, filtering out duplicates.
  const mergedRoomIds = [...new Set([...newRooms.map((room: any) => room.id), ...state.rooms])];

  // Sort mergedRoomIds based on bumped_at field in updatedRoomsById.
  const sortedRoomIds = mergedRoomIds.sort((a, b) => {
    const roomA = updatedRoomsById[a];
    const roomB = updatedRoomsById[b];
    // Compare RFC 3339 date strings directly
    return roomB.bumped_at.localeCompare(roomA.bumped_at);
  });

  return {
    ...state,
    roomsById: updatedRoomsById,
    rooms: sortedRoomIds
  };
}
```

### DELETE_ROOM

This action helps to remove the room from room list screen. Used when current user leaves the room from search screen, or when we received an event that current user left the room – this help us to sync accross different devices.

```javascript
case 'DELETE_ROOM': {
  const roomId = action.payload.roomId;

  // Set the specified room to null instead of deleting it.
  const newRoomsById = {
    ...state.roomsById,
    [roomId]: null // On delete we set roomId to null. This allows to sync membership state of rooms on ChatSearch screen.
  };

  // Remove the room from the rooms array.
  const newRooms = state.rooms.filter((id: any) => id !== roomId);

  // Remove associated messages.
  const { [roomId]: deletedMessages, ...newMessagesByRoomId } = state.messagesByRoomId;

  return {
    ...state,
    roomsById: newRoomsById,
    rooms: newRooms,
    messagesByRoomId: newMessagesByRoomId
  };
}
```

### ADD_MESSAGES

Whenever we send message, got async real-time message, or simply load messages on Chat Detail Screen - we call this action to maintain a proper message list for each known room on room list screen.

```javascript
case 'ADD_MESSAGES': {
  const roomId = action.payload.roomId;
  const newMessages = action.payload.messages;
  let currentMessages = state.messagesByRoomId[roomId] || [];

  // Combine current and new messages, then filter out duplicates.
  const combinedMessages = [...currentMessages, ...newMessages].filter(
    (message, index, self) =>
      index === self.findIndex(m => m.id === message.id)
  );

  // Sort the combined messages by id in ascending order.
  combinedMessages.sort((a, b) => a.id - b.id);

  // Find the message with the highest ID.
  const maxMessageId = combinedMessages.length > 0 ? combinedMessages[combinedMessages.length - 1].id : null;

  let needSort = false;

  // Update the roomsById object with the new last_message if necessary.
  const updatedRoomsById = { ...state.roomsById };
  if (maxMessageId !== null && updatedRoomsById[roomId] && (!updatedRoomsById[roomId].last_message || maxMessageId > updatedRoomsById[roomId].last_message.id)) {
    const newLastMessage = combinedMessages.find(message => message.id === maxMessageId);
    updatedRoomsById[roomId].last_message = newLastMessage;
    updatedRoomsById[roomId].bumped_at = newLastMessage.room.bumped_at;
    needSort = true;
  }

  let updatedRooms = [...state.rooms];
  if (needSort) {
      // Sort mergedRoomIds based on bumped_at field in updatedRoomsById.
      updatedRooms = updatedRooms.sort((a: any, b: any) => {
        const roomA = updatedRoomsById[a];
        const roomB = updatedRoomsById[b];
        // Compare RFC 3339 date strings directly
        return roomB.bumped_at.localeCompare(roomA.bumped_at);
      });
  }

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

This reducer is called whenever we are getting events about membership changes – we will add such events soon when talk about Centrifugo integration.

```javascript
case 'SET_ROOM_MEMBER_COUNT': {
  const { roomId, version, memberCount } = action.payload;

  // Check if the roomId exists in roomsById.
  if (!state.roomsById[roomId]) {
    console.error(`Room with ID ${roomId} not found.`);
    return state;
  }

  // Check if the version in the event is greater than the version in the room object.
  if (version <= state.roomsById[roomId].version) {
    console.error(`Outdated version for room ID ${roomId}.`);
    return state;
  }

  // Update the member_count and version of the specified room.
  const updatedRoom = {
    ...state.roomsById[roomId],
    member_count: memberCount,
    version: version,
  };

  // Return the new state with the updated roomsById.
  return {
    ...state,
    roomsById: {
      ...state.roomsById,
      [roomId]: updatedRoom,
    },
  };
}
```

## Adding styles

For making frontend layout we use flexbox for CSS rules so the app will be fully responsive and look good on different screen sizes. If you are interested to learn more about it: check out [this guide](https://css-tricks.com/snippets/css/a-guide-to-flexbox/). Here we won't pay attention to CSS styles anymore.

## What we have at this point

Actually, at this point we have an app which provides messenger functionality. 

You can use Django admin web UI to create some rooms and interact with them. Users can join/leave rooms, send messages. But to see new messages in room users need to reload a page. Not a good thing for chat app, right? Counters about number of users in particular room are also not updated until page reload. So finally we are ready to integrate the app with Centrifugo.
