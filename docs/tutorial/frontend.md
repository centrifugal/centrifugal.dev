---
id: frontend
sidebar_label: "Creating SPA frontend"
title: "Creating SPA frontend with React"
---

On the frontend we will use Vite with React and Typescript. The prerequisites is NodeJS >= 18.

We can start by creating frontend app with Vite inside `fusionchat` dir:

```bash
npm create vite@latest
```

Call the app `frontend`, select `React + Typescript` template.

```bash
cd frontend
npm install
```

Since we want to start the entire app with single docker compose command – let's again update `docker-compose.yml`. First, create custom Dockerfile in frontend folder:

```Dockerfile title="frontend/Dockerfile"
FROM node:18-slim

WORKDIR /usr/src/app

ENV PATH /usr/src/app/node_modules/.bin:$PATH

# install and cache app dependencies
COPY package.json .
COPY package-lock.json .
RUN npm ci

# start app
CMD ["vite", "--host"]
```

And add `frontend` service to `docker-compose.yaml` file:

```yaml
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

## App layout

Describing frontend code will be not so linear. First, lets start on the application top-level layout:

```javascript
const App: React.FC = () => {
  let localAuth: any = {};
  if (localStorage.getItem(LOCAL_STORAGE_AUTH_KEY)) {
    localAuth = JSON.parse(localStorage.getItem(LOCAL_STORAGE_AUTH_KEY)!)
  }
  const [authenticated, setAuthenticated] = useState<boolean>(localAuth.id !== undefined)
  const [userInfo, setUserInfo] = useState<any>(localAuth)
  const [csrf, setCSRF] = useState('')
  const [chatState, dispatch] = useReducer(reducer, initialChatState);

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

Here we skipped some final code to start with basics.

First thing to note is that we wrapped the app into two React contexts: `CsrfContext` and `AuthContext`. First one will allow access to CSRF token everywhere in the app, second will provide authentication information.

We render `ChatLogin` page if user is not authenticated and one of the chat pages if user authenticated. React Router is used for navigation.

Authentication information is stored in LocalStorage and we load it from there on app initial load.

Note, that here we are using reducer to manage chat state. We do this to serialize and simplify state management – before we started using reducer chat state management was a hell. The initial chat state looks like this:

```javascript
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

## Login screen

Let's look at `ChatLogin` component. To make it we need to render a login form:

```javascript title="ChatLogin.tsx"
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

This is quite a straightforward component.

## Chat room list screen

On the root page we show rooms current user is member of. `ChatRoomList` component renders rooms. But note that rooms are managed outside of this component – it just renders rooms from application chat state.

```javascript title="ChatRoomList.tsx"
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

## Chat room search screen

Chat rooms search screen shows list of all rooms in the app available to join. What's important to note here – as soon as user joins/leaves the room we update chat state by dispatching `ADD_ROOMS` or `DELETE_ROOM` state events. This allows us to synchronize room state – so that after user joins some room, the room appears on room list screen.

```javascript title="ChatSearch.tsx"
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

This screen renders messages in particular chat room and provides an input to send new messages.

```javascript title="CharRoomDetail.tsx"
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

Let's discuss some important things in the implementation.

One interesting thing is how we handle scroll – if user currently in the end of messages area - then we scroll to the end again after adding a new message. If user scrolls top – we prevent automatic scrolling on new message – because user most probably does not want scroll to work at that moment.

For faking avatars we are using nice pictures of generated by robohash.org. So each user gets unique cat picture based on user ID.

The core behaviour is straightforward – we render messages in chat and render an input for sending new messages. As soon as user submits input form – we call the backend API to create a new message in the room.

## Adding styles

For making frontend layout we use flexbox for CSS rules so the app will be fully responsive and look good on different screen sizes. If you are interested to learn more about it: check out [this guide](https://css-tricks.com/snippets/css/a-guide-to-flexbox/). Here we won't pay attention to CSS styles anymore.

## What we have at this point

Actually, at this point we have an app which provides messenger functionality. Users can join/leave rooms, send messages. But to see new messages in room users need to reload a page. Not a good thing for chat app, right? Counters about number of users in particular room are also not updated until page reload. So finally we are ready to integrate the app with Centrifugo.
