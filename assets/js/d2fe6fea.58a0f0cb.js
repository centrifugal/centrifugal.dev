"use strict";(self.webpackChunkcentrifugal_dev=self.webpackChunkcentrifugal_dev||[]).push([[5901],{3905:(e,t,n)=>{n.d(t,{Zo:()=>p,kt:()=>h});var i=n(7294);function a(e,t,n){return t in e?Object.defineProperty(e,t,{value:n,enumerable:!0,configurable:!0,writable:!0}):e[t]=n,e}function o(e,t){var n=Object.keys(e);if(Object.getOwnPropertySymbols){var i=Object.getOwnPropertySymbols(e);t&&(i=i.filter((function(t){return Object.getOwnPropertyDescriptor(e,t).enumerable}))),n.push.apply(n,i)}return n}function r(e){for(var t=1;t<arguments.length;t++){var n=null!=arguments[t]?arguments[t]:{};t%2?o(Object(n),!0).forEach((function(t){a(e,t,n[t])})):Object.getOwnPropertyDescriptors?Object.defineProperties(e,Object.getOwnPropertyDescriptors(n)):o(Object(n)).forEach((function(t){Object.defineProperty(e,t,Object.getOwnPropertyDescriptor(n,t))}))}return e}function s(e,t){if(null==e)return{};var n,i,a=function(e,t){if(null==e)return{};var n,i,a={},o=Object.keys(e);for(i=0;i<o.length;i++)n=o[i],t.indexOf(n)>=0||(a[n]=e[n]);return a}(e,t);if(Object.getOwnPropertySymbols){var o=Object.getOwnPropertySymbols(e);for(i=0;i<o.length;i++)n=o[i],t.indexOf(n)>=0||Object.prototype.propertyIsEnumerable.call(e,n)&&(a[n]=e[n])}return a}var l=i.createContext({}),c=function(e){var t=i.useContext(l),n=t;return e&&(n="function"==typeof e?e(t):r(r({},t),e)),n},p=function(e){var t=c(e.components);return i.createElement(l.Provider,{value:t},e.children)},u={inlineCode:"code",wrapper:function(e){var t=e.children;return i.createElement(i.Fragment,{},t)}},d=i.forwardRef((function(e,t){var n=e.components,a=e.mdxType,o=e.originalType,l=e.parentName,p=s(e,["components","mdxType","originalType","parentName"]),d=c(n),h=a,m=d["".concat(l,".").concat(h)]||d[h]||u[h]||o;return n?i.createElement(m,r(r({ref:t},p),{},{components:n})):i.createElement(m,r({ref:t},p))}));function h(e,t){var n=arguments,a=t&&t.mdxType;if("string"==typeof e||a){var o=n.length,r=new Array(o);r[0]=d;var s={};for(var l in t)hasOwnProperty.call(t,l)&&(s[l]=t[l]);s.originalType=e,s.mdxType="string"==typeof e?e:a,r[1]=s;for(var c=2;c<o;c++)r[c]=n[c];return i.createElement.apply(null,r)}return i.createElement.apply(null,n)}d.displayName="MDXCreateElement"},4548:(e,t,n)=>{n.r(t),n.d(t,{assets:()=>l,contentTitle:()=>r,default:()=>u,frontMatter:()=>o,metadata:()=>s,toc:()=>c});var i=n(7462),a=(n(7294),n(3905));const o={id:"channel_token_auth",title:"Channel JWT authorization"},r=void 0,s={unversionedId:"server/channel_token_auth",id:"server/channel_token_auth",title:"Channel JWT authorization",description:"In the chapter about channel permissions we mentioned that to subscribe on a channel client can provide subscription token. This chapter has more information about the subscription token mechanism in Centrifugo.",source:"@site/docs/server/channel_token_auth.md",sourceDirName:"server",slug:"/server/channel_token_auth",permalink:"/docs/server/channel_token_auth",draft:!1,editUrl:"https://github.com/centrifugal/centrifugal.dev/edit/main/docs/server/channel_token_auth.md",tags:[],version:"current",frontMatter:{id:"channel_token_auth",title:"Channel JWT authorization"},sidebar:"Guides",previous:{title:"Channel permission model",permalink:"/docs/server/channel_permissions"},next:{title:"Server-side subscriptions",permalink:"/docs/server/server_subs"}},l={},c=[{value:"Subscription JWT claims",id:"subscription-jwt-claims",level:2},{value:"sub",id:"sub",level:3},{value:"channel",id:"channel",level:3},{value:"info",id:"info",level:3},{value:"b64info",id:"b64info",level:3},{value:"exp",id:"exp",level:3},{value:"expire_at",id:"expire_at",level:3},{value:"aud",id:"aud",level:3},{value:"iss",id:"iss",level:3},{value:"iat",id:"iat",level:3},{value:"jti",id:"jti",level:3},{value:"override",id:"override",level:3},{value:"Example",id:"example",level:2},{value:"gensubtoken cli command",id:"gensubtoken-cli-command",level:2},{value:"Separate subscription token config",id:"separate-subscription-token-config",level:2}],p={toc:c};function u(e){let{components:t,...n}=e;return(0,a.kt)("wrapper",(0,i.Z)({},p,n,{components:t,mdxType:"MDXLayout"}),(0,a.kt)("p",null,"In the chapter about ",(0,a.kt)("a",{parentName:"p",href:"/docs/server/channel_permissions"},"channel permissions")," we mentioned that to subscribe on a channel client can provide subscription token. This chapter has more information about the subscription token mechanism in Centrifugo."),(0,a.kt)("p",null,"Subscription token is also JWT. Very similar to ",(0,a.kt)("a",{parentName:"p",href:"/docs/server/authentication"},"connection token"),", but with specific custom claims."),(0,a.kt)("p",null,"Valid subscription token passed to Centrifugo in subscribe request will tell Centrifugo that subscription must be accepted."),(0,a.kt)("p",null,"The way how this token is obtained on the frontend side varies depending on a client SDK implementation. "),(0,a.kt)("admonition",{type:"tip"},(0,a.kt)("p",{parentName:"admonition"},"Connection token and subscription token are both JWT and both can be generated with any JWT library.")),(0,a.kt)("admonition",{type:"tip"},(0,a.kt)("p",{parentName:"admonition"},"Even when authorizing a subscription to a channel with a subscription JWT you should still set a proper connection JWT for a client as it provides user authentication details to Centrifugo.")),(0,a.kt)("admonition",{type:"tip"},(0,a.kt)("p",{parentName:"admonition"},"Just like connection JWT using subscription JWT with a reasonable expiration time may help you have a good level of security in channels and still survive massive reconnect scenario \u2013 when many clients resubscribe alltogether.")),(0,a.kt)("p",null,"Supported JWT algorithms for private subscription tokens match algorithms to create connection JWT. The same HMAC secret key, RSA, and ECDSA public keys set for authentication tokens are re-used to check subscription JWT."),(0,a.kt)("h2",{id:"subscription-jwt-claims"},"Subscription JWT claims"),(0,a.kt)("p",null,"For subscription JWT Centrifugo uses some standard claims defined in ",(0,a.kt)("a",{parentName:"p",href:"https://datatracker.ietf.org/doc/html/rfc7519"},"rfc7519"),", also some custom Centrifugo-specific."),(0,a.kt)("h3",{id:"sub"},"sub"),(0,a.kt)("p",null,"This is a standard JWT claim which must contain an ID of the current application user (",(0,a.kt)("strong",{parentName:"p"},"as string"),"). "),(0,a.kt)("p",null,"The value must match a user in connection JWT \u2013 since it's the same real-time connection. The missing claim will mean that token issued for anonymous user (i.e. with empty user ID)."),(0,a.kt)("h3",{id:"channel"},"channel"),(0,a.kt)("p",null,"Required. Channel that client tries to subscribe to with this token (",(0,a.kt)("strong",{parentName:"p"},"string"),")."),(0,a.kt)("h3",{id:"info"},"info"),(0,a.kt)("p",null,"Optional. Additional information for connection inside this channel (",(0,a.kt)("strong",{parentName:"p"},"valid JSON"),")."),(0,a.kt)("h3",{id:"b64info"},"b64info"),(0,a.kt)("p",null,"Optional. Additional information for connection inside this channel in base64 format (",(0,a.kt)("strong",{parentName:"p"},"string"),"). Will be decoded by Centrifugo to raw bytes."),(0,a.kt)("h3",{id:"exp"},"exp"),(0,a.kt)("p",null,"Optional. This is a standard JWT claim that allows setting private channel subscription token expiration time (a UNIX timestamp in the future, in seconds, as integer) and configures subscription expiration time."),(0,a.kt)("p",null,"At the moment if the subscription expires client connection will be closed and the client will try to reconnect. In most cases, you don't need this and should prefer using the expiration of the connection JWT to deactivate the connection (see ",(0,a.kt)("a",{parentName:"p",href:"/docs/server/authentication"},"authentication"),"). But if you need more granular per-channel control this may fit your needs."),(0,a.kt)("p",null,"Once ",(0,a.kt)("inlineCode",{parentName:"p"},"exp")," is set in token every subscription token must be periodically refreshed. This refresh workflow happens on the client side. Refer to the specific client documentation to see how to refresh subscriptions."),(0,a.kt)("h3",{id:"expire_at"},"expire_at"),(0,a.kt)("p",null,"Optional. By default, Centrifugo looks on ",(0,a.kt)("inlineCode",{parentName:"p"},"exp")," claim to both check token expiration and configure subscription expiration time. In most cases this is fine, but there could be situations where you want to decouple subscription token expiration check with subscription expiration time. As soon as the ",(0,a.kt)("inlineCode",{parentName:"p"},"expire_at")," claim is provided (set) in subscription JWT Centrifugo relies on it for setting subscription expiration time (JWT expiration still checked over ",(0,a.kt)("inlineCode",{parentName:"p"},"exp")," though)."),(0,a.kt)("p",null,(0,a.kt)("inlineCode",{parentName:"p"},"expire_at")," is a UNIX timestamp seconds when the subscription should expire."),(0,a.kt)("ul",null,(0,a.kt)("li",{parentName:"ul"},"Set it to the future time for expiring subscription at some point"),(0,a.kt)("li",{parentName:"ul"},"Set it to ",(0,a.kt)("inlineCode",{parentName:"li"},"0")," to disable subscription expiration (but still check token ",(0,a.kt)("inlineCode",{parentName:"li"},"exp")," claim). This allows implementing a one-time subscription token. ")),(0,a.kt)("h3",{id:"aud"},"aud"),(0,a.kt)("p",null,"By default, Centrifugo does not check JWT audience (",(0,a.kt)("a",{parentName:"p",href:"https://datatracker.ietf.org/doc/html/rfc7519#section-4.1.3"},"rfc7519 aud")," claim). But if you set ",(0,a.kt)("inlineCode",{parentName:"p"},"token_audience")," option as described in ",(0,a.kt)("a",{parentName:"p",href:"/docs/server/authentication#aud"},"client authentication")," then audience for subscription JWT will also be checked."),(0,a.kt)("h3",{id:"iss"},"iss"),(0,a.kt)("p",null,"By default, Centrifugo does not check JWT issuer (",(0,a.kt)("a",{parentName:"p",href:"https://datatracker.ietf.org/doc/html/rfc7519#section-4.1.1"},"rfc7519 iss")," claim). But if you set ",(0,a.kt)("inlineCode",{parentName:"p"},"token_issuer")," option as described in ",(0,a.kt)("a",{parentName:"p",href:"/docs/server/authentication#iss"},"client authentication")," then issuer for subscription JWT will also be checked."),(0,a.kt)("h3",{id:"iat"},"iat"),(0,a.kt)("p",null,"This is a UNIX time when token was issued (seconds). See ",(0,a.kt)("a",{parentName:"p",href:"https://datatracker.ietf.org/doc/html/rfc7519#section-4.1.6"},"definition in RFC"),". This claim is optional but can be useful together with ",(0,a.kt)("a",{parentName:"p",href:"/docs/pro/token_revocation"},"Centrifugo PRO token revocation features"),"."),(0,a.kt)("h3",{id:"jti"},"jti"),(0,a.kt)("p",null,"This is a token unique ID. See ",(0,a.kt)("a",{parentName:"p",href:"https://datatracker.ietf.org/doc/html/rfc7519#section-4.1.7"},"definition in RFC"),". This claim is optional but can be useful together with ",(0,a.kt)("a",{parentName:"p",href:"/docs/pro/token_revocation"},"Centrifugo PRO token revocation features"),"."),(0,a.kt)("h3",{id:"override"},"override"),(0,a.kt)("p",null,"One more claim is ",(0,a.kt)("inlineCode",{parentName:"p"},"override"),". This is an object which allows overriding channel options for the particular channel subscriber which comes with subscription token."),(0,a.kt)("table",null,(0,a.kt)("thead",{parentName:"table"},(0,a.kt)("tr",{parentName:"thead"},(0,a.kt)("th",{parentName:"tr",align:null},"Field"),(0,a.kt)("th",{parentName:"tr",align:null},"Type"),(0,a.kt)("th",{parentName:"tr",align:null},"Optional"),(0,a.kt)("th",{parentName:"tr",align:null},"Description"))),(0,a.kt)("tbody",{parentName:"table"},(0,a.kt)("tr",{parentName:"tbody"},(0,a.kt)("td",{parentName:"tr",align:null},"presence"),(0,a.kt)("td",{parentName:"tr",align:null},"BoolValue"),(0,a.kt)("td",{parentName:"tr",align:null},"yes"),(0,a.kt)("td",{parentName:"tr",align:null},"override ",(0,a.kt)("inlineCode",{parentName:"td"},"presence")," channel option")),(0,a.kt)("tr",{parentName:"tbody"},(0,a.kt)("td",{parentName:"tr",align:null},"join_leave"),(0,a.kt)("td",{parentName:"tr",align:null},"BoolValue"),(0,a.kt)("td",{parentName:"tr",align:null},"yes"),(0,a.kt)("td",{parentName:"tr",align:null},"override ",(0,a.kt)("inlineCode",{parentName:"td"},"join_leave")," channel option")),(0,a.kt)("tr",{parentName:"tbody"},(0,a.kt)("td",{parentName:"tr",align:null},"force_push_join_leave"),(0,a.kt)("td",{parentName:"tr",align:null},"BoolValue"),(0,a.kt)("td",{parentName:"tr",align:null},"yes"),(0,a.kt)("td",{parentName:"tr",align:null},"override ",(0,a.kt)("inlineCode",{parentName:"td"},"force_push_join_leave")," channel option")),(0,a.kt)("tr",{parentName:"tbody"},(0,a.kt)("td",{parentName:"tr",align:null},"force_recovery"),(0,a.kt)("td",{parentName:"tr",align:null},"BoolValue"),(0,a.kt)("td",{parentName:"tr",align:null},"yes"),(0,a.kt)("td",{parentName:"tr",align:null},"override ",(0,a.kt)("inlineCode",{parentName:"td"},"force_recovery")," channel option")),(0,a.kt)("tr",{parentName:"tbody"},(0,a.kt)("td",{parentName:"tr",align:null},"force_positioning"),(0,a.kt)("td",{parentName:"tr",align:null},"BoolValue"),(0,a.kt)("td",{parentName:"tr",align:null},"yes"),(0,a.kt)("td",{parentName:"tr",align:null},"override ",(0,a.kt)("inlineCode",{parentName:"td"},"force_positioning")," channel option")))),(0,a.kt)("p",null,(0,a.kt)("inlineCode",{parentName:"p"},"BoolValue")," is an object like this:"),(0,a.kt)("pre",null,(0,a.kt)("code",{parentName:"pre",className:"language-json"},'{\n  "value": true/false\n}\n')),(0,a.kt)("p",null,"So for example, you want to turn off emitting a presence information for a particular subscriber in a channel:"),(0,a.kt)("pre",null,(0,a.kt)("code",{parentName:"pre",className:"language-json"},'{\n    ...\n    "override": {\n        "presence": {\n            "value": false\n        }\n    }\n}\n')),(0,a.kt)("h2",{id:"example"},"Example"),(0,a.kt)("p",null,"So to generate a subscription token you can use something like this in Python (assuming user ID is ",(0,a.kt)("inlineCode",{parentName:"p"},"42")," and the channel is ",(0,a.kt)("inlineCode",{parentName:"p"},"gossips"),"):"),(0,a.kt)("pre",null,(0,a.kt)("code",{parentName:"pre",className:"language-python"},'import jwt\n\ntoken = jwt.encode({\n    "sub": "42",\n    "channel": "$gossips"\n}, "secret", algorithm="HS256").decode()\n\nprint(token)\n')),(0,a.kt)("p",null,"Where ",(0,a.kt)("inlineCode",{parentName:"p"},'"secret"')," is the ",(0,a.kt)("inlineCode",{parentName:"p"},"token_hmac_secret_key")," from Centrifugo configuration (we use HMAC tokens in this example which relies on a shared secret key, for RSA or ECDSA tokens you need to use a private key known only by your backend)."),(0,a.kt)("h2",{id:"gensubtoken-cli-command"},"gensubtoken cli command"),(0,a.kt)("p",null,"During development you can quickly generate valid subscription token using Centrifugo ",(0,a.kt)("inlineCode",{parentName:"p"},"gensubtoken")," cli command."),(0,a.kt)("pre",null,(0,a.kt)("code",{parentName:"pre"},"./centrifugo gensubtoken -u 123722 -s channel\n")),(0,a.kt)("p",null,"You should see an output like this:"),(0,a.kt)("pre",null,(0,a.kt)("code",{parentName:"pre"},'HMAC SHA-256 JWT for user "123722" and channel "channel" with expiration TTL 168h0m0s:\neyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM3MjIiLCJleHAiOjE2NTU0NDg0MzgsImNoYW5uZWwiOiJjaGFubmVsIn0.JyRI3ovNV-abV8VxCmZCD556o2F2mNL1UoU58gNR-uI\n')),(0,a.kt)("p",null,"But in real app subscription JWT must be generated by your application backend."),(0,a.kt)("h2",{id:"separate-subscription-token-config"},"Separate subscription token config"),(0,a.kt)("p",null,"When ",(0,a.kt)("inlineCode",{parentName:"p"},"separate_subscription_token_config")," boolean option is ",(0,a.kt)("inlineCode",{parentName:"p"},"true")," Centrifugo does not look at general token options at all when verifying subscription tokens and uses config options starting from ",(0,a.kt)("inlineCode",{parentName:"p"},"subscription_token_")," prefix instead. "),(0,a.kt)("p",null,"Here is an example how to use JWKS for connection tokens, but have HMAC-based verification for subscription tokens:"),(0,a.kt)("pre",null,(0,a.kt)("code",{parentName:"pre",className:"language-json",metastring:'title="config.json"',title:'"config.json"'},'{\n  "token_jwks_public_endpoint": "https://example.com/openid-connect/certs",\n  "separate_subscription_token_config": true,\n  "subscription_token_hmac_secret_key": "separate_secret_which_must_be_strong"\n}\n')),(0,a.kt)("p",null,"All the options which are available for connection token configuration may be re-used for a separate subscription token configuration \u2013 just prefix them with ",(0,a.kt)("inlineCode",{parentName:"p"},"subscription_token_")," instead of ",(0,a.kt)("inlineCode",{parentName:"p"},"token_"),"."))}u.isMDXComponent=!0}}]);