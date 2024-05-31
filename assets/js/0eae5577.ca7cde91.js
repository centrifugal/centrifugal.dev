"use strict";(self.webpackChunkcentrifugal_dev=self.webpackChunkcentrifugal_dev||[]).push([[5048],{30433:(e,n,i)=>{i.d(n,{Z:()=>a});i(67294);var s=i(36905);const t={tabItem:"tabItem_Ymn6"};var o=i(85893);function a(e){let{children:n,hidden:i,className:a}=e;return(0,o.jsx)("div",{role:"tabpanel",className:(0,s.Z)(t.tabItem,a),hidden:i,children:n})}},22808:(e,n,i)=>{i.d(n,{Z:()=>w});var s=i(67294),t=i(36905),o=i(63735),a=i(16550),r=i(20613),c=i(34423),l=i(20636),u=i(99200);function d(e){return s.Children.toArray(e).filter((e=>"\n"!==e)).map((e=>{if(!e||(0,s.isValidElement)(e)&&function(e){const{props:n}=e;return!!n&&"object"==typeof n&&"value"in n}(e))return e;throw new Error(`Docusaurus error: Bad <Tabs> child <${"string"==typeof e.type?e.type:e.type.name}>: all children of the <Tabs> component should be <TabItem>, and every <TabItem> should have a unique "value" prop.`)}))?.filter(Boolean)??[]}function h(e){const{values:n,children:i}=e;return(0,s.useMemo)((()=>{const e=n??function(e){return d(e).map((e=>{let{props:{value:n,label:i,attributes:s,default:t}}=e;return{value:n,label:i,attributes:s,default:t}}))}(i);return function(e){const n=(0,l.l)(e,((e,n)=>e.value===n.value));if(n.length>0)throw new Error(`Docusaurus error: Duplicate values "${n.map((e=>e.value)).join(", ")}" found in <Tabs>. Every value needs to be unique.`)}(e),e}),[n,i])}function p(e){let{value:n,tabValues:i}=e;return i.some((e=>e.value===n))}function b(e){let{queryString:n=!1,groupId:i}=e;const t=(0,a.k6)(),o=function(e){let{queryString:n=!1,groupId:i}=e;if("string"==typeof n)return n;if(!1===n)return null;if(!0===n&&!i)throw new Error('Docusaurus error: The <Tabs> component groupId prop is required if queryString=true, because this value is used as the search param name. You can also provide an explicit value such as queryString="my-search-param".');return i??null}({queryString:n,groupId:i});return[(0,c._X)(o),(0,s.useCallback)((e=>{if(!o)return;const n=new URLSearchParams(t.location.search);n.set(o,e),t.replace({...t.location,search:n.toString()})}),[o,t])]}function m(e){const{defaultValue:n,queryString:i=!1,groupId:t}=e,o=h(e),[a,c]=(0,s.useState)((()=>function(e){let{defaultValue:n,tabValues:i}=e;if(0===i.length)throw new Error("Docusaurus error: the <Tabs> component requires at least one <TabItem> children component");if(n){if(!p({value:n,tabValues:i}))throw new Error(`Docusaurus error: The <Tabs> has a defaultValue "${n}" but none of its children has the corresponding value. Available values are: ${i.map((e=>e.value)).join(", ")}. If you intend to show no default tab, use defaultValue={null} instead.`);return n}const s=i.find((e=>e.default))??i[0];if(!s)throw new Error("Unexpected error: 0 tabValues");return s.value}({defaultValue:n,tabValues:o}))),[l,d]=b({queryString:i,groupId:t}),[m,f]=function(e){let{groupId:n}=e;const i=function(e){return e?`docusaurus.tab.${e}`:null}(n),[t,o]=(0,u.Nk)(i);return[t,(0,s.useCallback)((e=>{i&&o.set(e)}),[i,o])]}({groupId:t}),g=(()=>{const e=l??m;return p({value:e,tabValues:o})?e:null})();(0,r.Z)((()=>{g&&c(g)}),[g]);return{selectedValue:a,selectValue:(0,s.useCallback)((e=>{if(!p({value:e,tabValues:o}))throw new Error(`Can't select invalid tab value=${e}`);c(e),d(e),f(e)}),[d,f,o]),tabValues:o}}var f=i(5730);const g={tabList:"tabList__CuJ",tabItem:"tabItem_LNqP"};var x=i(85893);function v(e){let{className:n,block:i,selectedValue:s,selectValue:a,tabValues:r}=e;const c=[],{blockElementScrollPositionUntilNextRender:l}=(0,o.o5)(),u=e=>{const n=e.currentTarget,i=c.indexOf(n),t=r[i].value;t!==s&&(l(n),a(t))},d=e=>{let n=null;switch(e.key){case"Enter":u(e);break;case"ArrowRight":{const i=c.indexOf(e.currentTarget)+1;n=c[i]??c[0];break}case"ArrowLeft":{const i=c.indexOf(e.currentTarget)-1;n=c[i]??c[c.length-1];break}}n?.focus()};return(0,x.jsx)("ul",{role:"tablist","aria-orientation":"horizontal",className:(0,t.Z)("tabs",{"tabs--block":i},n),children:r.map((e=>{let{value:n,label:i,attributes:o}=e;return(0,x.jsx)("li",{role:"tab",tabIndex:s===n?0:-1,"aria-selected":s===n,ref:e=>c.push(e),onKeyDown:d,onClick:u,...o,className:(0,t.Z)("tabs__item",g.tabItem,o?.className,{"tabs__item--active":s===n}),children:i??n},n)}))})}function y(e){let{lazy:n,children:i,selectedValue:t}=e;const o=(Array.isArray(i)?i:[i]).filter(Boolean);if(n){const e=o.find((e=>e.props.value===t));return e?(0,s.cloneElement)(e,{className:"margin-top--md"}):null}return(0,x.jsx)("div",{className:"margin-top--md",children:o.map(((e,n)=>(0,s.cloneElement)(e,{key:n,hidden:e.props.value!==t})))})}function j(e){const n=m(e);return(0,x.jsxs)("div",{className:(0,t.Z)("tabs-container",g.tabList),children:[(0,x.jsx)(v,{...n,...e}),(0,x.jsx)(y,{...n,...e})]})}function w(e){const n=(0,f.Z)();return(0,x.jsx)(j,{...e,children:d(e.children)},String(n))}},41183:(e,n,i)=>{i.r(n),i.d(n,{assets:()=>u,contentTitle:()=>c,default:()=>p,frontMatter:()=>r,metadata:()=>l,toc:()=>d});var s=i(85893),t=i(11151),o=i(22808),a=i(30433);const r={title:"101 ways to subscribe user on a personal channel in Centrifugo",tags:["centrifugo","tutorial"],description:"In this post we are discussing vaious ways developers can use to subscribe user to a personal channel in Centrifugo",author:"Alexander Emelin",authorTitle:"Author of Centrifugo",authorImageURL:"https://github.com/FZambia.png",image:"/img/101-way_thumb.jpg",hide_table_of_contents:!1},c=void 0,l={permalink:"/blog/2022/07/29/101-way-to-subscribe",editUrl:"https://github.com/centrifugal/centrifugal.dev/edit/main/blog/2022-07-29-101-way-to-subscribe.md",source:"@site/blog/2022-07-29-101-way-to-subscribe.md",title:"101 ways to subscribe user on a personal channel in Centrifugo",description:"In this post we are discussing vaious ways developers can use to subscribe user to a personal channel in Centrifugo",date:"2022-07-29T00:00:00.000Z",tags:[{label:"centrifugo",permalink:"/blog/tags/centrifugo"},{label:"tutorial",permalink:"/blog/tags/tutorial"}],readingTime:10.64,hasTruncateMarker:!0,authors:[{name:"Alexander Emelin",title:"Author of Centrifugo",imageURL:"https://github.com/FZambia.png"}],frontMatter:{title:"101 ways to subscribe user on a personal channel in Centrifugo",tags:["centrifugo","tutorial"],description:"In this post we are discussing vaious ways developers can use to subscribe user to a personal channel in Centrifugo",author:"Alexander Emelin",authorTitle:"Author of Centrifugo",authorImageURL:"https://github.com/FZambia.png",image:"/img/101-way_thumb.jpg",hide_table_of_contents:!1},unlisted:!1,prevItem:{title:"Improving Centrifugo Redis Engine throughput and allocation efficiency with Rueidis Go library",permalink:"/blog/2022/12/20/improving-redis-engine-performance"},nextItem:{title:"Centrifugo v4 released \u2013 a little revolution",permalink:"/blog/2022/07/19/centrifugo-v4-released"}},u={authorsImageUrls:[void 0]},d=[{value:"Setup",id:"setup",level:2},{value:"#1 \u2013 user-limited channel",id:"1--user-limited-channel",level:2},{value:"#2 - channel token authorization",id:"2---channel-token-authorization",level:2},{value:"#3 - subscribe proxy",id:"3---subscribe-proxy",level:2},{value:"#4 - server-side channel in connection JWT",id:"4---server-side-channel-in-connection-jwt",level:2},{value:"#5 - server-side channel in connect proxy",id:"5---server-side-channel-in-connect-proxy",level:2},{value:"#6 - automatic personal channel subscription",id:"6---automatic-personal-channel-subscription",level:2},{value:"#7 \u2013 capabilities in connection JWT",id:"7--capabilities-in-connection-jwt",level:2},{value:"#8 \u2013 capabilities in connect proxy",id:"8--capabilities-in-connect-proxy",level:2},{value:"Teardown",id:"teardown",level:2}];function h(e){const n={a:"a",admonition:"admonition",code:"code",h2:"h2",img:"img",li:"li",p:"p",pre:"pre",ul:"ul",...(0,t.a)(),...e.components};return(0,s.jsxs)(s.Fragment,{children:[(0,s.jsx)(n.p,{children:(0,s.jsx)(n.img,{alt:"Centrifuge",src:i(25583).Z+"",width:"1600",height:"542"})}),"\n",(0,s.jsx)(n.p,{children:"Let's say you develop an application and want a real-time connection which is subscribed to one channel. Let's also assume that this channel is used for user personal notifications. So only one user in the application can subcribe to that channel to receive its notifications in real-time."}),"\n",(0,s.jsx)(n.p,{children:"In this post we will look at various ways to achieve this with Centrifugo, and consider trade-offs of the available approaches. The main goal of this tutorial is to help Centrifugo newcomers be aware of all the ways to control channel permissions by reading just one document."}),"\n",(0,s.jsx)(n.p,{children:"And... well, there are actually 8 ways I found, not 101 \ud83d\ude07"}),"\n",(0,s.jsx)(n.h2,{id:"setup",children:"Setup"}),"\n",(0,s.jsxs)(n.p,{children:["To make the post a bit easier to consume let's setup some things. Let's assume that the user for which we provide all the examples in this post has ID ",(0,s.jsx)(n.code,{children:'"17"'}),". Of course in real-life the examples given here can be extrapolated to any user ID."]}),"\n",(0,s.jsx)(n.p,{children:"When you create a real-time connection to Centrifugo the connection is authenticated using the one of the following ways:"}),"\n",(0,s.jsxs)(n.ul,{children:["\n",(0,s.jsxs)(n.li,{children:["using ",(0,s.jsx)(n.a,{href:"/docs/server/authentication",children:"connection JWT"})]}),"\n",(0,s.jsxs)(n.li,{children:["using connection request proxy from Centrifugo to the configured endpoint of the application backend (",(0,s.jsx)(n.a,{href:"/docs/server/proxy#connect-proxy",children:"connect proxy"}),")"]}),"\n"]}),"\n",(0,s.jsx)(n.p,{children:"As soon as the connection is successfully established and authenticated Centrifugo knows the ID of connected user. This is important to understand."}),"\n",(0,s.jsx)(n.p,{children:"And let's define a namespace in Centrifugo configuration which will be used for personal user channels:"}),"\n",(0,s.jsx)(n.pre,{children:(0,s.jsx)(n.code,{className:"language-json",children:'{\n    ...\n    "namespaces": [\n        {\n            "name": "personal",\n            "presence": true\n        }\n    ]\n}\n'})}),"\n",(0,s.jsxs)(n.p,{children:["Defining namespaces for each new real-time feature is a good practice in Centrifugo. As an awesome improvement we also enabled ",(0,s.jsx)(n.code,{children:"presence"})," in the ",(0,s.jsx)(n.code,{children:"personal"})," namespace, so whenever users subscribe to a channel in this namespace Centrifugo will maintain online presence information for each channel. So you can find out all connections of the specific user existing at any moment. Defining ",(0,s.jsx)(n.code,{children:"presence"})," is fully optional though - turn it of if you don't need presence information and don't want to spend additional server resources on maintaining presence."]}),"\n",(0,s.jsx)(n.h2,{id:"1--user-limited-channel",children:"#1 \u2013 user-limited channel"}),"\n",(0,s.jsx)(n.admonition,{type:"tip",children:(0,s.jsx)(n.p,{children:"Probably the most performant approach."})}),"\n",(0,s.jsxs)(n.p,{children:["All you need to do is to extend namespace configuration with ",(0,s.jsx)(n.code,{children:"allow_user_limited_channels"})," option:"]}),"\n",(0,s.jsx)(n.pre,{children:(0,s.jsx)(n.code,{className:"language-json",children:'{\n    "namespaces": [\n        {\n            "name": "personal",\n            "presence": true,\n            "allow_user_limited_channels": true\n        }\n    ]\n}\n'})}),"\n",(0,s.jsx)(n.p,{children:"On the client side you need to have sth like this (of course the ID of current user will be dynamic in real-life):"}),"\n",(0,s.jsx)(n.pre,{children:(0,s.jsx)(n.code,{className:"language-javascript",children:"const sub = centrifuge.newSubscription('personal:#17');\nsub.on('publication', function(ctx) {\n    console.log(ctx.data);\n})\nsub.subscribe();\n"})}),"\n",(0,s.jsxs)(n.p,{children:["Here you are subscribing to a channel in ",(0,s.jsx)(n.code,{children:"personal"})," namespace and listening to publications coming from a channel. Having ",(0,s.jsx)(n.code,{children:"#"})," in channel name tells Centrifugo that this is a user-limited channel (because ",(0,s.jsx)(n.code,{children:"#"})," is a special symbol that is treated in a special way by Centrifugo as soon as ",(0,s.jsx)(n.code,{children:"allow_user_limited_channels"})," enabled)."]}),"\n",(0,s.jsxs)(n.p,{children:["In this case the user ID part of user-limited channel is ",(0,s.jsx)(n.code,{children:'"17"'}),". So Centrifugo allows user with ID ",(0,s.jsx)(n.code,{children:'"17"'})," to subscribe on ",(0,s.jsx)(n.code,{children:"personal:#17"})," channel. Other users won't be able to subscribe on it."]}),"\n",(0,s.jsxs)(n.p,{children:["To publish updates to subscription all you need to do is to publish to ",(0,s.jsx)(n.code,{children:"personal:#17"})," using server publish API (HTTP or GRPC)."]}),"\n",(0,s.jsx)(n.h2,{id:"2---channel-token-authorization",children:"#2 - channel token authorization"}),"\n",(0,s.jsx)(n.admonition,{type:"tip",children:(0,s.jsx)(n.p,{children:"Probably the most flexible approach, with reasonably good performance characteristics."})}),"\n",(0,s.jsx)(n.p,{children:"Another way we will look at is using subscription JWT for subscribing. When you create Subscription object on the client side you can pass it a subscription token, and also provide a function to retrieve subscription token (useful to automatically handle token refresh, it also handles initial token loading)."}),"\n",(0,s.jsx)(n.pre,{children:(0,s.jsx)(n.code,{className:"language-javascript",children:"const token = await getSubscriptionToken('personal:17');\n\nconst sub = centrifuge.newSubscription('personal:17', {\n    token: token\n});\nsub.on('publication', function(ctx) {\n    console.log(ctx.data);\n})\nsub.subscribe();\n"})}),"\n",(0,s.jsxs)(n.p,{children:["Inside ",(0,s.jsx)(n.code,{children:"getSubscriptionToken"})," you can issue a request to the backend, for example in browser it's possible to do with fetch API."]}),"\n",(0,s.jsxs)(n.p,{children:["On the backend side you know the ID of current user due to the native session mechanism of your app, so you can decide whether current user has permission to subsribe on ",(0,s.jsx)(n.code,{children:"personal:17"})," or not. If yes \u2013 return subscription JWT according to our rules. If not - return empty string so subscription will go to unsubscribed state with ",(0,s.jsx)(n.code,{children:"unauthorized"})," reason."]}),"\n",(0,s.jsxs)(n.p,{children:["Here are examples for generating subscription HMAC SHA-256 JWTs for channel ",(0,s.jsx)(n.code,{children:"personal:17"})," and HMAC secret key ",(0,s.jsx)(n.code,{children:"secret"}),":"]}),"\n","\n",(0,s.jsxs)(o.Z,{className:"unique-tabs",defaultValue:"python",values:[{label:"Python",value:"python"},{label:"NodeJS",value:"node"}],children:[(0,s.jsx)(a.Z,{value:"python",children:(0,s.jsx)(n.pre,{children:(0,s.jsx)(n.code,{className:"language-python",children:'import jwt\nimport time\n\nclaims = {\n    "sub": "17",\n    "channel": "personal:17"\n    "exp": int(time.time()) + 30*60\n}\n\ntoken = jwt.encode(claims, "secret", algorithm="HS256").decode()\nprint(token)\n'})})}),(0,s.jsx)(a.Z,{value:"node",children:(0,s.jsx)(n.pre,{children:(0,s.jsx)(n.code,{className:"language-javascript",children:"const jose = require('jose')\n\n(async function main() {\n  const secret = new TextEncoder().encode('secret')\n  const alg = 'HS256'\n\n  const token = await new jose.SignJWT({ 'sub': '17', 'channel': 'personal:17' })\n    .setProtectedHeader({ alg })\n    .setExpirationTime('30m')\n    .sign(secret)\n\n  console.log(token);\n})();\n"})})})]}),"\n",(0,s.jsxs)(n.p,{children:["Since we set expiration time for subscription JWT tokens we also need to provide a ",(0,s.jsx)(n.code,{children:"getToken"})," function to a client on the frontend side:"]}),"\n",(0,s.jsx)(n.pre,{children:(0,s.jsx)(n.code,{className:"language-javascript",children:"const sub = centrifuge.newSubscription('personal:17', {\n    getToken: async function (ctx) {\n        const token = await getSubscriptionToken('personal:17');\n        return token;\n    }\n});\nsub.on('publication', function(ctx) {\n    console.log(ctx.data);\n})\nsub.subscribe();\n"})}),"\n",(0,s.jsxs)(n.p,{children:["This function will be called by SDK automatically to refresh subscription token when it's going to expire. And note that we omitted setting ",(0,s.jsx)(n.code,{children:"token"})," option here \u2013 since SDK is smart enough to call provided ",(0,s.jsx)(n.code,{children:"getToken"})," function to extract initial subscription token from the backend."]}),"\n",(0,s.jsxs)(n.p,{children:["The good thing in using subscription JWT approach is that you can provide token expiration time, so permissions to subscribe on a channel will be validated from time to time while connection is active. You can also provide additional channel context info which will be attached to presence information (using ",(0,s.jsx)(n.code,{children:"info"})," claim of subscription JWT). And you can granularly control channel permissions using ",(0,s.jsx)(n.code,{children:"allow"})," claim of token \u2013 and give client capabilities to publish, call history or presence information (this is Centrifugo PRO feature at this point). Token also allows to override some namespace options on per-subscription basis (with ",(0,s.jsx)(n.code,{children:"override"})," claim)."]}),"\n",(0,s.jsx)(n.p,{children:"Using subscription tokens is a general approach for any channels where you need to check access first, not only for personal user channels."}),"\n",(0,s.jsx)(n.h2,{id:"3---subscribe-proxy",children:"#3 - subscribe proxy"}),"\n",(0,s.jsx)(n.admonition,{type:"tip",children:(0,s.jsx)(n.p,{children:"Probably the most secure approach."})}),"\n",(0,s.jsx)(n.p,{children:"Subscription JWT gives client a way to subscribe on a channel, and avoid requesting your backend for permission on every resubscribe. Token approach is very good in massive reconnect scenario, when you have many connections and they all resubscribe at once (due to your load balancer reload, for example). But this means that if you unsubscribed client from a channel using server API, client can still resubscribe with token again - until token will expire. In some cases you may want to avoid this."}),"\n",(0,s.jsx)(n.p,{children:"Also, in some cases you want to be notified when someone subscribes to a channel."}),"\n",(0,s.jsx)(n.p,{children:"In this case you may use subscribe proxy feature. When using subscribe proxy every attempt of a client to subscribe on a channel will be translated to request (HTTP or GRPC) from Centrifugo to the application backend. Application backend can decide whether client is allowed to subscribe or not."}),"\n",(0,s.jsxs)(n.p,{children:["One advantage of using subscribe proxy is that backend can additionally provide initial channel data for the subscribing client. This is possible using ",(0,s.jsx)(n.code,{children:"data"})," field of subscribe result generated by backend subscribe handler."]}),"\n",(0,s.jsx)(n.pre,{children:(0,s.jsx)(n.code,{className:"language-json",children:'{\n    "proxy_subscribe_endpoint": "http://localhost:9000/centrifugo/subscribe",\n    "namespaces": [\n        {\n            "name": "personal",\n            "presence": true,\n            "proxy_subscribe": true\n        }\n    ]\n}\n'})}),"\n",(0,s.jsxs)(n.p,{children:["And on the backend side define a route ",(0,s.jsx)(n.code,{children:"/centrifugo/subscribe"}),", check permissions of user upon subscription and return result to Centrifugo according to our subscribe proxy docs. Or simply run GRPC server using our proxy definitions and react on subscription attempt sent from Centrifugo to backend over GRPC."]}),"\n",(0,s.jsx)(n.p,{children:"On the client-side code is as simple as:"}),"\n",(0,s.jsx)(n.pre,{children:(0,s.jsx)(n.code,{className:"language-javascript",children:"const sub = centrifuge.newSubscription('personal:17');\nsub.on('publication', function(ctx) {\n    console.log(ctx.data);\n})\nsub.subscribe();\n"})}),"\n",(0,s.jsx)(n.h2,{id:"4---server-side-channel-in-connection-jwt",children:"#4 - server-side channel in connection JWT"}),"\n",(0,s.jsx)(n.admonition,{type:"tip",children:(0,s.jsx)(n.p,{children:"The approach where you don't need to manage client-side subscriptions."})}),"\n",(0,s.jsxs)(n.p,{children:[(0,s.jsx)(n.a,{href:"/docs/server/server_subs",children:"Server-side subscriptions"})," is a way to consume publications from channels without even create Subscription objects on the client side. In general, client side Subscription objects provide a more flexible and controllable way to work with subscriptions. Clients can subscribe/unsubscribe on channels at any point. Client-side subscriptions provide more details about state transitions."]}),"\n",(0,s.jsx)(n.p,{children:"With server-side subscriptions though you are consuming publications directly from Client instance:"}),"\n",(0,s.jsx)(n.pre,{children:(0,s.jsx)(n.code,{className:"language-javascript",children:"const client = new Centrifuge('ws://localhost:8000/connection/websocket', {\n    token: 'CONNECTION-JWT'\n});\nclient.on('publication', function(ctx) {\n    console.log('publication received from server-side channel', ctx.channel, ctx.data);\n});\nclient.connect();\n"})}),"\n",(0,s.jsxs)(n.p,{children:["In this case you don't have separate Subscription objects and need to look at ",(0,s.jsx)(n.code,{children:"ctx.channel"})," upon receiving publication or to publication content to decide how to handle it. Server-side subscriptions could be a good choice if you are using Centrifugo unidirectional transports and don't need dynamic subscribe/unsubscribe behavior."]}),"\n",(0,s.jsxs)(n.p,{children:["The first way to subscribe client on a server-side channel is to include ",(0,s.jsx)(n.code,{children:"channels"})," claim into connection JWT:"]}),"\n",(0,s.jsx)(n.pre,{children:(0,s.jsx)(n.code,{className:"language-json",children:'{\n    "sub": "17",\n    "channels": ["personal:17"]\n}\n'})}),"\n",(0,s.jsx)(n.p,{children:"Upon successful connection user will be subscribed to a server-side channel by Centrifugo. One downside of using server-side channels is that errors in one server-side channel (like impossible to recover missed messages) may affect the entire connection and result into reconnects, while with client-side subscriptions individual subsription failures do not affect the entire connection."}),"\n",(0,s.jsx)(n.p,{children:"But having one server-side channel per-connection seems a very reasonable idea to me in many cases. And if you have stable set of subscriptions which do not require lifetime state management \u2013 this can be a nice approach without additional protocol/network overhead involved."}),"\n",(0,s.jsx)(n.h2,{id:"5---server-side-channel-in-connect-proxy",children:"#5 - server-side channel in connect proxy"}),"\n",(0,s.jsx)(n.p,{children:"Similar to the previous one for cases when you are authenticating connections over connect proxy instead of using JWT."}),"\n",(0,s.jsxs)(n.p,{children:["This is possible using ",(0,s.jsx)(n.code,{children:"channels"})," field of connect proxy handler result. The code on the client-side is the same as in Option #4 \u2013 since we only change the way how list of server-side channels is provided."]}),"\n",(0,s.jsx)(n.h2,{id:"6---automatic-personal-channel-subscription",children:"#6 - automatic personal channel subscription"}),"\n",(0,s.jsx)(n.admonition,{type:"tip",children:(0,s.jsx)(n.p,{children:"Almost no code approach."})}),"\n",(0,s.jsx)(n.p,{children:"As we pointed above Centrifugo knows an ID of the user due to authentication process. So why not combining this knowledge with automatic server-side personal channel subscription? Centrifugo provides exactly this with user personal channel feature."}),"\n",(0,s.jsx)(n.pre,{children:(0,s.jsx)(n.code,{className:"language-json",children:'{\n    "user_subscribe_to_personal": true,\n    "user_personal_channel_namespace": "personal",\n    "namespaces": [\n        {\n            "name": "personal",\n            "presence": true\n        }\n    ]\n}\n'})}),"\n",(0,s.jsxs)(n.p,{children:["This feature only subscribes non-anonymous users to personal channels (those with non-empty user ID). The configuration above will subscribe our user ",(0,s.jsx)(n.code,{children:'"17"'})," to channel ",(0,s.jsx)(n.code,{children:"personal:#17"})," automatically after successful authentication."]}),"\n",(0,s.jsx)(n.h2,{id:"7--capabilities-in-connection-jwt",children:"#7 \u2013 capabilities in connection JWT"}),"\n",(0,s.jsx)(n.p,{children:"Allows using client-side subscriptions, but skip receiving subscription token. This is only available in Centrifugo PRO at this point."}),"\n",(0,s.jsxs)(n.p,{children:["So when generating JWT you can provide additional ",(0,s.jsx)(n.code,{children:"caps"})," claim which contains channel resource capabilities:"]}),"\n",(0,s.jsxs)(o.Z,{className:"unique-tabs",defaultValue:"python",values:[{label:"Python",value:"python"},{label:"NodeJS",value:"node"}],children:[(0,s.jsx)(a.Z,{value:"python",children:(0,s.jsx)(n.pre,{children:(0,s.jsx)(n.code,{className:"language-python",children:'import jwt\nimport time\n\nclaims = {\n    "sub": "17",\n    "exp": int(time.time()) + 30*60,\n    "caps": [\n        {\n            "channels": ["personal:17"],\n            "allow": ["sub"]\n        }\n    ]\n}\n\ntoken = jwt.encode(claims, "secret", algorithm="HS256").decode()\nprint(token)\n'})})}),(0,s.jsx)(a.Z,{value:"node",children:(0,s.jsx)(n.pre,{children:(0,s.jsx)(n.code,{className:"language-javascript",children:"const jose = require('jose');\n\n(async function main() {\n  const secret = new TextEncoder().encode('secret')\n  const alg = 'HS256'\n\n  const token = await new jose.SignJWT({\n    sub: '17',\n    caps: [\n      {\n        \"channels\": [\"personal:17\"],\n        \"allow\": [\"sub\"]\n      }\n    ]\n  })\n    .setProtectedHeader({ alg })\n    .setExpirationTime('30m')\n    .sign(secret)\n\n  console.log(token);\n})();\n"})})})]}),"\n",(0,s.jsx)(n.p,{children:"While in case of single channel the benefit of using this approach is not really obvious, it can help when you are using several channels with stric access permissions per connection, where providing capabilities can help to save some traffic and CPU resources since we avoid generating subscription token for each individual channel."}),"\n",(0,s.jsx)(n.h2,{id:"8--capabilities-in-connect-proxy",children:"#8 \u2013 capabilities in connect proxy"}),"\n",(0,s.jsx)(n.p,{children:"This is very similar to the previous approach, but capabilities are passed to Centrifugo in connect proxy result. So if you are using connect proxy for auth then you can still provide capabilities in the same form as in JWT. This is also a Centrifugo PRO feature."}),"\n",(0,s.jsx)(n.h2,{id:"teardown",children:"Teardown"}),"\n",(0,s.jsx)(n.p,{children:"Which way to choose? Well, it depends. Since your application will have more than only a personal user channel in many cases you should decide which approach suits you better in each particular case \u2013 it's hard to give the universal advice."}),"\n",(0,s.jsx)(n.p,{children:"Client-side subscriptions are more flexible in general, so I'd suggest using them whenever possible. Though you may use unidirectional transports of Centrifugo where subscribing to channels from the client side is not simple to achieve (though still possible using our server subscribe API). Server-side subscriptions make more sense there."}),"\n",(0,s.jsx)(n.p,{children:"The good news is that all our official bidirectional client SDKs support all the approaches mentioned in this post. Hope designing the channel configuration on top of Centrifugo will be a pleasant experience for you."}),"\n",(0,s.jsx)(n.admonition,{title:"Attributions",type:"note",children:(0,s.jsxs)(n.ul,{children:["\n",(0,s.jsxs)(n.li,{children:["\n",(0,s.jsxs)("a",{href:"https://www.freepik.com/vectors/internet-network",children:["Internet network vector created by rawpixel.com - ",(0,s.jsx)(n.a,{href:"http://www.freepik.com",children:"www.freepik.com"})]}),"\n"]}),"\n",(0,s.jsxs)(n.li,{children:["\n",(0,s.jsx)("a",{href:"https://www.flaticon.com/free-icons/cyber-security",title:"cyber security icons",children:"Cyber security icons created by Smashicons - Flaticon"}),"\n"]}),"\n"]})})]})}function p(e={}){const{wrapper:n}={...(0,t.a)(),...e.components};return n?(0,s.jsx)(n,{...e,children:(0,s.jsx)(h,{...e})}):h(e)}},25583:(e,n,i)=>{i.d(n,{Z:()=>s});const s=i.p+"assets/images/101-way-c2185f0f2f7d884bd0a95f8c37d14b2a.png"},11151:(e,n,i)=>{i.d(n,{Z:()=>r,a:()=>a});var s=i(67294);const t={},o=s.createContext(t);function a(e){const n=s.useContext(o);return s.useMemo((function(){return"function"==typeof e?e(n):{...n,...e}}),[n,e])}function r(e){let n;return n=e.disableParentContext?"function"==typeof e.components?e.components(t):e.components||t:a(e.components),s.createElement(o.Provider,{value:n},e.children)}}}]);