"use strict";(self.webpackChunkcentrifugal_dev=self.webpackChunkcentrifugal_dev||[]).push([[8655],{11698:(e,t,n)=>{n.r(t),n.d(t,{assets:()=>l,contentTitle:()=>o,default:()=>h,frontMatter:()=>a,metadata:()=>r,toc:()=>c});var i=n(85893),s=n(11151);const a={id:"design",title:"Design overview"},o=void 0,r={id:"getting-started/design",title:"Design overview",description:"Let's discuss some architectural and design topics about Centrifugo.",source:"@site/versioned_docs/version-3/getting-started/design.md",sourceDirName:"getting-started",slug:"/getting-started/design",permalink:"/docs/3/getting-started/design",draft:!1,unlisted:!1,editUrl:"https://github.com/centrifugal/centrifugal.dev/edit/main/versioned_docs/version-3/getting-started/design.md",tags:[],version:"3",frontMatter:{id:"design",title:"Design overview"},sidebar:"Introduction",previous:{title:"Integration guide",permalink:"/docs/3/getting-started/integration"},next:{title:"Migrating to v3",permalink:"/docs/3/getting-started/migration_v3"}},l={},c=[{value:"Idiomatic usage",id:"idiomatic-usage",level:2},{value:"Message history considerations",id:"message-history-considerations",level:2},{value:"Message delivery model",id:"message-delivery-model",level:2},{value:"Message order guarantees",id:"message-order-guarantees",level:2},{value:"Graceful degradation",id:"graceful-degradation",level:2},{value:"Online presence considerations",id:"online-presence-considerations",level:2},{value:"Scalability considerations",id:"scalability-considerations",level:2}];function d(e){const t={a:"a",code:"code",h2:"h2",img:"img",li:"li",p:"p",ul:"ul",...(0,s.a)(),...e.components};return(0,i.jsxs)(i.Fragment,{children:[(0,i.jsx)(t.p,{children:"Let's discuss some architectural and design topics about Centrifugo."}),"\n",(0,i.jsx)(t.h2,{id:"idiomatic-usage",children:"Idiomatic usage"}),"\n",(0,i.jsx)(t.p,{children:"Originally Centrifugo was built with the unidirectional flow as the main approach. Though Centrifugo itself used a bidirectional protocol between a client and a server to allow client dynamically create subscriptions, Centrifugo did not allow using it for sending data from client to server."}),"\n",(0,i.jsx)(t.p,{children:"With this approach publications travel only from server to a client. All requests that generate new data first go to the application backend (for example over AJAX call of backend API). The backend can validate the message, process it, save it into a database for long-term persistence \u2013 and then publish an event from a backend side to Centrifugo API."}),"\n",(0,i.jsx)(t.p,{children:"This is a pretty natural workflow for applications since this is how applications traditionally work (without real-time features) and Centrifugo is decoupled from the application in this case."}),"\n",(0,i.jsx)(t.p,{children:(0,i.jsx)(t.img,{alt:"diagram_unidirectional_publish",src:n(81192).Z+"",width:"2600",height:"881"})}),"\n",(0,i.jsx)(t.p,{children:"During Centrifugo v2 life cycle this paradigm evolved a bit. It's now possible to send RPC requests from client to Centrifugo and the request will be then proxied to the application backend. Also, connection attempts and publications to channels can now be proxied. So bidirectional connection between client and Centrifugo is now available for utilizing by developers in both directions. For example, here is how publish diagram could look like when using publish request proxy feature:"}),"\n",(0,i.jsx)(t.p,{children:(0,i.jsx)(t.img,{src:n(97172).Z+"",width:"2600",height:"1098"})}),"\n",(0,i.jsx)(t.p,{children:"So at the moment, the number of possible integration ways increased."}),"\n",(0,i.jsx)(t.h2,{id:"message-history-considerations",children:"Message history considerations"}),"\n",(0,i.jsx)(t.p,{children:"Idiomatic Centrifugo usage requires having the main application database from which initial and actual state can be loaded at any point in time."}),"\n",(0,i.jsx)(t.p,{children:"While Centrifugo has channel history, it has been mostly designed to reduce the load on the main application database when all users reconnect at once (in case of load balancer configuration reload, Centrifugo restart, temporary network problems, etc). This allows to radically reduce the load on the application main database during reconnect storm. Since such disconnects are usually pretty short in time having a reasonably small number of messages cached in history is sufficient."}),"\n",(0,i.jsx)(t.p,{children:"The addition of history iteration API shifts possible use cases a bit. Calling history chunk by chunk allows keeping larger number of publications per channel. But depending on Engine used and configuration of the underlying storage history stream persistence characteristics can vary. For example, with Memory Engine history will be lost upon Centrifugo restart. With Redis or Tarantool engines history will survive Centrifugo restarts but depending on a storage configuration it can be lost upon storage restart \u2013 so you should take into account storage configuration and persistence properties as well. For example, consider enabling Redis RDB and AOF, configure replication for storage high-availability, use Redis Cluster or maybe synchronous replication with Tarantool."}),"\n",(0,i.jsx)(t.p,{children:"Centrifugo provides ways to distinguish whether the missed messages can't be restored from Centrifugo history upon recovery so a client should restore state from the main application database. So Centrifugo message history can be used as a complementary way to restore messages and thus reduce a load on the main application database most of the time."}),"\n",(0,i.jsx)(t.h2,{id:"message-delivery-model",children:"Message delivery model"}),"\n",(0,i.jsx)(t.p,{children:"By default, the message delivery model of Centrifugo is at most once. With history and the position/recovery features enabled it's possible to achieve at least once guarantee within history retention time and size. After abnormal disconnect clients have an option to recover missed messages from the publication stream cache that Centrifugo maintains."}),"\n",(0,i.jsx)(t.p,{children:"Without the positioning or recovery features enabled a message sent to Centrifugo can be theoretically lost while moving towards clients. Centrifugo tries to do its best to prevent message loss on a way to online clients, but the application should tolerate a loss."}),"\n",(0,i.jsx)(t.p,{children:"As noted Centrifugo has a feature called message recovery to automatically recover messages missed due to short network disconnections. Also, it compensates at most once delivery of broker (Redis, Tarantool) PUB/SUB by using additional publication offset checks and periodic offset synchronization."}),"\n",(0,i.jsx)(t.p,{children:"At this moment Centrifugo message recovery is designed for a short-term disconnect period (think no more than one hour for a typical chat application, but this can vary). After this period (which can be configured per channel basis) Centrifugo removes messages from the channel history cache. In this case, Centrifugo may tell the client that some messages can not be recovered, so your application state should be loaded from the main database."}),"\n",(0,i.jsx)(t.h2,{id:"message-order-guarantees",children:"Message order guarantees"}),"\n",(0,i.jsx)(t.p,{children:"Message order in channels is guaranteed to be the same while you publish messages into channel one after another or publish them in one request. If you do parallel publications into the same channel then Centrifugo can't guarantee message order since those may be processed concurrently by Centrifugo."}),"\n",(0,i.jsx)(t.h2,{id:"graceful-degradation",children:"Graceful degradation"}),"\n",(0,i.jsx)(t.p,{children:"It is recommended to design an application in a way that users don't even notice when Centrifugo does not work. Use graceful degradation. For example, if a user posts a new comment over AJAX to your application backend - you should not rely only on Centrifugo to receive a new comment from a channel and display it. You should return new comment data in AJAX call response and render it. This way user that posts a comment will think that everything works just fine. Be careful to not draw comments twice in this case - think about idempotent identifiers for your entities."}),"\n",(0,i.jsx)(t.h2,{id:"online-presence-considerations",children:"Online presence considerations"}),"\n",(0,i.jsx)(t.p,{children:"Online presence in a channel is designed to be eventually consistent. It will return the correct state most of the time. But when using Redis or Tarantool engines, due to the network failures and unexpected shut down of Centrifugo node, there are chances that clients can be presented in a presence up to one minute more (until presence entry expiration)."}),"\n",(0,i.jsxs)(t.p,{children:["Also, channel presence does not scale well for channels with lots of active subscribers. This is due to the fact that presence returns the entire snapshot of all clients in a channel \u2013 as soon as the number of active subscribers grows the response size becomes larger. In some cases, ",(0,i.jsx)(t.code,{children:"presence_stats"})," API call can be sufficient to avoid receiving the entire presence state."]}),"\n",(0,i.jsx)(t.h2,{id:"scalability-considerations",children:"Scalability considerations"}),"\n",(0,i.jsxs)(t.p,{children:["Centrifugo can scale horizontally with built-in engines (Redis, Tarantool, KeyDB) or with Nats broker. See ",(0,i.jsx)(t.a,{href:"/docs/3/server/engines",children:"engines"}),"."]}),"\n",(0,i.jsx)(t.p,{children:"All supported brokers are fast \u2013 they can handle hundreds of thousands of requests per second. This should be enough for most applications."}),"\n",(0,i.jsx)(t.p,{children:"But, if you approach broker resource limits (CPU or memory) then it's possible:"}),"\n",(0,i.jsxs)(t.ul,{children:["\n",(0,i.jsx)(t.li,{children:"Use Centrifugo consistent sharding support to balance queries between different broker instances (supported for Redis, KeyDB, Tarantool)"}),"\n",(0,i.jsx)(t.li,{children:"Use Redis Cluster (it's also possible to consistently shard data between different Redis Clusters)"}),"\n",(0,i.jsx)(t.li,{children:"Nats broker should scale well itself in cluster setup"}),"\n"]}),"\n",(0,i.jsx)(t.p,{children:"All brokers can be set up in highly available way so there won't be a single point of failure."}),"\n",(0,i.jsx)(t.p,{children:"All Centrifugo data (history, online presence) is designed to be ephemeral and have an expiration time. Due to this fact and the fact that Centrifugo provides hooks for the application to understand history loss makes the process of resharding mostly automatic. As soon as you need to add additional broker shard (when using client-side sharding) you can just add it to the configuration and restart Centrifugo. Since data is sharded consistently part of the data will stay on the same broker nodes. Applications should handle cases that channel data moved to another shard and restore a state from the main application database when needed."})]})}function h(e={}){const{wrapper:t}={...(0,s.a)(),...e.components};return t?(0,i.jsx)(t,{...e,children:(0,i.jsx)(d,{...e})}):d(e)}},97172:(e,t,n)=>{n.d(t,{Z:()=>i});const i=n.p+"assets/images/diagram_publish_proxy-66ccb1e8b37ed8912d218b4529597bd9.png"},81192:(e,t,n)=>{n.d(t,{Z:()=>i});const i=n.p+"assets/images/diagram_unidirectional_publish-791f0862f2aa9632dec9c3515bcdc6ea.png"},11151:(e,t,n)=>{n.d(t,{Z:()=>r,a:()=>o});var i=n(67294);const s={},a=i.createContext(s);function o(e){const t=i.useContext(a);return i.useMemo((function(){return"function"==typeof e?e(t):{...t,...e}}),[t,e])}function r(e){let t;return t=e.disableParentContext?"function"==typeof e.components?e.components(s):e.components||s:o(e.components),i.createElement(a.Provider,{value:t},e.children)}}}]);