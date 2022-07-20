"use strict";(self.webpackChunkcentrifugal_dev=self.webpackChunkcentrifugal_dev||[]).push([[2353],{3905:function(e,t,n){n.d(t,{Zo:function(){return u},kt:function(){return g}});var r=n(7294);function i(e,t,n){return t in e?Object.defineProperty(e,t,{value:n,enumerable:!0,configurable:!0,writable:!0}):e[t]=n,e}function o(e,t){var n=Object.keys(e);if(Object.getOwnPropertySymbols){var r=Object.getOwnPropertySymbols(e);t&&(r=r.filter((function(t){return Object.getOwnPropertyDescriptor(e,t).enumerable}))),n.push.apply(n,r)}return n}function a(e){for(var t=1;t<arguments.length;t++){var n=null!=arguments[t]?arguments[t]:{};t%2?o(Object(n),!0).forEach((function(t){i(e,t,n[t])})):Object.getOwnPropertyDescriptors?Object.defineProperties(e,Object.getOwnPropertyDescriptors(n)):o(Object(n)).forEach((function(t){Object.defineProperty(e,t,Object.getOwnPropertyDescriptor(n,t))}))}return e}function s(e,t){if(null==e)return{};var n,r,i=function(e,t){if(null==e)return{};var n,r,i={},o=Object.keys(e);for(r=0;r<o.length;r++)n=o[r],t.indexOf(n)>=0||(i[n]=e[n]);return i}(e,t);if(Object.getOwnPropertySymbols){var o=Object.getOwnPropertySymbols(e);for(r=0;r<o.length;r++)n=o[r],t.indexOf(n)>=0||Object.prototype.propertyIsEnumerable.call(e,n)&&(i[n]=e[n])}return i}var c=r.createContext({}),l=function(e){var t=r.useContext(c),n=t;return e&&(n="function"==typeof e?e(t):a(a({},t),e)),n},u=function(e){var t=l(e.components);return r.createElement(c.Provider,{value:t},e.children)},d={inlineCode:"code",wrapper:function(e){var t=e.children;return r.createElement(r.Fragment,{},t)}},p=r.forwardRef((function(e,t){var n=e.components,i=e.mdxType,o=e.originalType,c=e.parentName,u=s(e,["components","mdxType","originalType","parentName"]),p=l(n),g=i,h=p["".concat(c,".").concat(g)]||p[g]||d[g]||o;return n?r.createElement(h,a(a({ref:t},u),{},{components:n})):r.createElement(h,a({ref:t},u))}));function g(e,t){var n=arguments,i=t&&t.mdxType;if("string"==typeof e||i){var o=n.length,a=new Array(o);a[0]=p;var s={};for(var c in t)hasOwnProperty.call(t,c)&&(s[c]=t[c]);s.originalType=e,s.mdxType="string"==typeof e?e:i,a[1]=s;for(var l=2;l<o;l++)a[l]=n[l];return r.createElement.apply(null,a)}return r.createElement.apply(null,n)}p.displayName="MDXCreateElement"},5007:function(e,t,n){n.r(t),n.d(t,{assets:function(){return u},contentTitle:function(){return c},default:function(){return g},frontMatter:function(){return s},metadata:function(){return l},toc:function(){return d}});var r=n(3117),i=n(102),o=(n(7294),n(3905)),a=["components"],s={id:"introduction",title:"Centrifugo introduction"},c=void 0,l={unversionedId:"getting-started/introduction",id:"getting-started/introduction",title:"Centrifugo introduction",description:"Centrifugo is an open-source scalable real-time messaging server. Centrifugo can instantly deliver messages to application online users connected over supported transports (WebSocket, HTTP-streaming, SSE/EventSource, GRPC, SockJS). Centrifugo has the concept of a channel \u2013 so it's a user-facing PUB/SUB server.",source:"@site/docs/getting-started/introduction.md",sourceDirName:"getting-started",slug:"/getting-started/introduction",permalink:"/docs/getting-started/introduction",draft:!1,editUrl:"https://github.com/centrifugal/centrifugal.dev/edit/main/docs/getting-started/introduction.md",tags:[],version:"current",frontMatter:{id:"introduction",title:"Centrifugo introduction"},sidebar:"Introduction",next:{title:"Install Centrifugo",permalink:"/docs/getting-started/installation"}},u={},d=[{value:"Background",id:"background",level:2},{value:"Basic concept",id:"basic-concept",level:2},{value:"Join community",id:"join-community",level:2}],p={toc:d};function g(e){var t=e.components,s=(0,i.Z)(e,a);return(0,o.kt)("wrapper",(0,r.Z)({},p,s,{components:t,mdxType:"MDXLayout"}),(0,o.kt)("p",null,"Centrifugo is an open-source scalable real-time messaging server. Centrifugo can instantly deliver messages to application online users connected over supported transports (WebSocket, HTTP-streaming, SSE/EventSource, GRPC, SockJS). Centrifugo has the concept of a channel \u2013 so it's a user-facing PUB/SUB server."),(0,o.kt)("p",null,"Centrifugo is language-agnostic and can be used to build chat apps, live comments, multiplayer games, real-time data visualizations, collaborative tools, etc. in combination with any backend. It is well suited for modern architectures and allows decoupling the business logic from the real-time transport layer."),(0,o.kt)("p",null,"Several official client SDKs for browser and mobile development wrap the bidirectional protocol. In addition, Centrifugo supports a unidirectional approach for simple use cases with no SDK dependency."),(0,o.kt)("admonition",{title:"Real-time?",type:"info"},(0,o.kt)("p",{parentName:"admonition"},"By real-time, we indicate a soft real-time. Due to network latencies, garbage collection cycles, and so on, the delay of a delivered message can be up to several hundred milliseconds or higher.")),(0,o.kt)("h2",{id:"background"},"Background"),(0,o.kt)("p",null,(0,o.kt)("img",{src:n(740).Z,width:"2000",height:"1068"})),(0,o.kt)("p",null,"Centrifugo was born a decade ago to help applications with a server-side written in a language or a framework without built-in concurrency support. In this case, dealing with persistent connections is a real headache that usually can only be resolved by introducing a shift in the technology stack and spending time to create a production-ready solution."),(0,o.kt)("p",null,"For example, frameworks like Django, Flask, Yii, Laravel, Ruby on Rails, and others have poor or not really performant support of working with many persistent connections for the real-time messaging tasks."),(0,o.kt)("p",null,"In this case, Centrifugo is a straightforward and non-obtrusive way to introduce real-time updates and handle lots of persistent connections without radical changes in the application backend architecture. Developers could proceed writing the application backend with a favorite language or favorite framework, keep existing architecture \u2013 and just let Centrifugo deal with persistent connections."),(0,o.kt)("p",null,"At the moment, Centrifugo provides some advanced and unique features that can simplify a developer's life and save months of development, even if the application backend is built with the asynchronous concurrent language. One example is that Centrifugo can scale out-of-the-box to many machines with several supported brokers. And there are more things to mention \u2013 see detailed highlights further in the docs."),(0,o.kt)("h2",{id:"basic-concept"},"Basic concept"),(0,o.kt)("p",null,"As mentioned above, Centrifugo runs as a standalone service that cares about handling persistent connections from the application users. The application backend and frontend can be written in any programming language. Clients connect to Centrifugo and subscribe to channels."),(0,o.kt)("p",null,"As soon as some event happens the application backend can publish a message with event payload into a channel using Centrifugo publishing API. The message will be delivered to all clients currently connected and subscribed to a channel."),(0,o.kt)("p",null,"That's right, Centrifugo is basically a user-facing PUB/SUB server. Here is a simplified scheme: "),(0,o.kt)("p",null,(0,o.kt)("img",{alt:"Centrifugo scheme",src:n(8687).Z,width:"1186",height:"626"})),(0,o.kt)("p",null,"Although the basic concept is simple, there are many challenges on the way to a production-ready system with a developer-friendly API and scalability. Centrifugo tries to solve them for you. We are describing many interesting solutions and advanced features in the documentation and our blog."),(0,o.kt)("h2",{id:"join-community"},"Join community"),(0,o.kt)("p",null,"By the way, we have rooms in Telegram (the most active) and Discord:"),(0,o.kt)("p",null,(0,o.kt)("a",{parentName:"p",href:"https://t.me/joinchat/ABFVWBE0AhkyyhREoaboXQ"},(0,o.kt)("img",{parentName:"a",src:"https://img.shields.io/badge/Telegram-Group-orange?style=flat&logo=telegram",alt:"Join the chat at https://t.me/joinchat/ABFVWBE0AhkyyhREoaboXQ"}))," ","\xa0",(0,o.kt)("a",{parentName:"p",href:"https://discord.gg/tYgADKx"},(0,o.kt)("img",{parentName:"a",src:"https://img.shields.io/discord/719186998686122046?style=flat&label=Discord&logo=discord",alt:"Join the chat at https://discord.gg/tYgADKx"}))),(0,o.kt)("p",null,"See you there!"))}g.isMDXComponent=!0},740:function(e,t,n){t.Z=n.p+"assets/images/bg_cat-4454fbaae0446c3b1964e06821dd378b.jpg"},8687:function(e,t,n){t.Z=n.p+"assets/images/scheme_sketch-74c962b2089dc49399e093b1e9812403.png"}}]);