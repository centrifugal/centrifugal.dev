"use strict";(self.webpackChunkcentrifugal_dev=self.webpackChunkcentrifugal_dev||[]).push([[5901],{3905:(e,t,n)=>{n.d(t,{Zo:()=>c,kt:()=>m});var a=n(7294);function i(e,t,n){return t in e?Object.defineProperty(e,t,{value:n,enumerable:!0,configurable:!0,writable:!0}):e[t]=n,e}function r(e,t){var n=Object.keys(e);if(Object.getOwnPropertySymbols){var a=Object.getOwnPropertySymbols(e);t&&(a=a.filter((function(t){return Object.getOwnPropertyDescriptor(e,t).enumerable}))),n.push.apply(n,a)}return n}function o(e){for(var t=1;t<arguments.length;t++){var n=null!=arguments[t]?arguments[t]:{};t%2?r(Object(n),!0).forEach((function(t){i(e,t,n[t])})):Object.getOwnPropertyDescriptors?Object.defineProperties(e,Object.getOwnPropertyDescriptors(n)):r(Object(n)).forEach((function(t){Object.defineProperty(e,t,Object.getOwnPropertyDescriptor(n,t))}))}return e}function l(e,t){if(null==e)return{};var n,a,i=function(e,t){if(null==e)return{};var n,a,i={},r=Object.keys(e);for(a=0;a<r.length;a++)n=r[a],t.indexOf(n)>=0||(i[n]=e[n]);return i}(e,t);if(Object.getOwnPropertySymbols){var r=Object.getOwnPropertySymbols(e);for(a=0;a<r.length;a++)n=r[a],t.indexOf(n)>=0||Object.prototype.propertyIsEnumerable.call(e,n)&&(i[n]=e[n])}return i}var s=a.createContext({}),u=function(e){var t=a.useContext(s),n=t;return e&&(n="function"==typeof e?e(t):o(o({},t),e)),n},c=function(e){var t=u(e.components);return a.createElement(s.Provider,{value:t},e.children)},p={inlineCode:"code",wrapper:function(e){var t=e.children;return a.createElement(a.Fragment,{},t)}},d=a.forwardRef((function(e,t){var n=e.components,i=e.mdxType,r=e.originalType,s=e.parentName,c=l(e,["components","mdxType","originalType","parentName"]),d=u(n),m=i,h=d["".concat(s,".").concat(m)]||d[m]||p[m]||r;return n?a.createElement(h,o(o({ref:t},c),{},{components:n})):a.createElement(h,o({ref:t},c))}));function m(e,t){var n=arguments,i=t&&t.mdxType;if("string"==typeof e||i){var r=n.length,o=new Array(r);o[0]=d;var l={};for(var s in t)hasOwnProperty.call(t,s)&&(l[s]=t[s]);l.originalType=e,l.mdxType="string"==typeof e?e:i,o[1]=l;for(var u=2;u<r;u++)o[u]=n[u];return a.createElement.apply(null,o)}return a.createElement.apply(null,n)}d.displayName="MDXCreateElement"},5162:(e,t,n)=>{n.d(t,{Z:()=>o});var a=n(7294),i=n(6010);const r="tabItem_Ymn6";function o(e){let{children:t,hidden:n,className:o}=e;return a.createElement("div",{role:"tabpanel",className:(0,i.Z)(r,o),hidden:n},t)}},4866:(e,t,n)=>{n.d(t,{Z:()=>w});var a=n(7462),i=n(7294),r=n(6010),o=n(6775),l=n(1980),s=n(7392),u=n(12);function c(e){return function(e){var t;return(null==(t=i.Children.map(e,(e=>{if(!e||(0,i.isValidElement)(e)&&function(e){const{props:t}=e;return!!t&&"object"==typeof t&&"value"in t}(e))return e;throw new Error(`Docusaurus error: Bad <Tabs> child <${"string"==typeof e.type?e.type:e.type.name}>: all children of the <Tabs> component should be <TabItem>, and every <TabItem> should have a unique "value" prop.`)})))?void 0:t.filter(Boolean))??[]}(e).map((e=>{let{props:{value:t,label:n,attributes:a,default:i}}=e;return{value:t,label:n,attributes:a,default:i}}))}function p(e){const{values:t,children:n}=e;return(0,i.useMemo)((()=>{const e=t??c(n);return function(e){const t=(0,s.l)(e,((e,t)=>e.value===t.value));if(t.length>0)throw new Error(`Docusaurus error: Duplicate values "${t.map((e=>e.value)).join(", ")}" found in <Tabs>. Every value needs to be unique.`)}(e),e}),[t,n])}function d(e){let{value:t,tabValues:n}=e;return n.some((e=>e.value===t))}function m(e){let{queryString:t=!1,groupId:n}=e;const a=(0,o.k6)(),r=function(e){let{queryString:t=!1,groupId:n}=e;if("string"==typeof t)return t;if(!1===t)return null;if(!0===t&&!n)throw new Error('Docusaurus error: The <Tabs> component groupId prop is required if queryString=true, because this value is used as the search param name. You can also provide an explicit value such as queryString="my-search-param".');return n??null}({queryString:t,groupId:n});return[(0,l._X)(r),(0,i.useCallback)((e=>{if(!r)return;const t=new URLSearchParams(a.location.search);t.set(r,e),a.replace({...a.location,search:t.toString()})}),[r,a])]}function h(e){const{defaultValue:t,queryString:n=!1,groupId:a}=e,r=p(e),[o,l]=(0,i.useState)((()=>function(e){let{defaultValue:t,tabValues:n}=e;if(0===n.length)throw new Error("Docusaurus error: the <Tabs> component requires at least one <TabItem> children component");if(t){if(!d({value:t,tabValues:n}))throw new Error(`Docusaurus error: The <Tabs> has a defaultValue "${t}" but none of its children has the corresponding value. Available values are: ${n.map((e=>e.value)).join(", ")}. If you intend to show no default tab, use defaultValue={null} instead.`);return t}const a=n.find((e=>e.default))??n[0];if(!a)throw new Error("Unexpected error: 0 tabValues");return a.value}({defaultValue:t,tabValues:r}))),[s,c]=m({queryString:n,groupId:a}),[h,k]=function(e){let{groupId:t}=e;const n=function(e){return e?`docusaurus.tab.${e}`:null}(t),[a,r]=(0,u.Nk)(n);return[a,(0,i.useCallback)((e=>{n&&r.set(e)}),[n,r])]}({groupId:a}),f=(()=>{const e=s??h;return d({value:e,tabValues:r})?e:null})();(0,i.useLayoutEffect)((()=>{f&&l(f)}),[f]);return{selectedValue:o,selectValue:(0,i.useCallback)((e=>{if(!d({value:e,tabValues:r}))throw new Error(`Can't select invalid tab value=${e}`);l(e),c(e),k(e)}),[c,k,r]),tabValues:r}}var k=n(2466),f=n(2389);const b="tabList__CuJ",g="tabItem_LNqP";function v(e){let{className:t,block:n,selectedValue:o,selectValue:l,tabValues:s}=e;const u=[],{blockElementScrollPositionUntilNextRender:c}=(0,k.o5)(),p=e=>{const t=e.currentTarget,n=u.indexOf(t),a=s[n].value;a!==o&&(c(t),l(a))},d=e=>{var t;let n=null;switch(e.key){case"Enter":p(e);break;case"ArrowRight":{const t=u.indexOf(e.currentTarget)+1;n=u[t]??u[0];break}case"ArrowLeft":{const t=u.indexOf(e.currentTarget)-1;n=u[t]??u[u.length-1];break}}null==(t=n)||t.focus()};return i.createElement("ul",{role:"tablist","aria-orientation":"horizontal",className:(0,r.Z)("tabs",{"tabs--block":n},t)},s.map((e=>{let{value:t,label:n,attributes:l}=e;return i.createElement("li",(0,a.Z)({role:"tab",tabIndex:o===t?0:-1,"aria-selected":o===t,key:t,ref:e=>u.push(e),onKeyDown:d,onClick:p},l,{className:(0,r.Z)("tabs__item",g,null==l?void 0:l.className,{"tabs__item--active":o===t})}),n??t)})))}function y(e){let{lazy:t,children:n,selectedValue:a}=e;const r=(Array.isArray(n)?n:[n]).filter(Boolean);if(t){const e=r.find((e=>e.props.value===a));return e?(0,i.cloneElement)(e,{className:"margin-top--md"}):null}return i.createElement("div",{className:"margin-top--md"},r.map(((e,t)=>(0,i.cloneElement)(e,{key:t,hidden:e.props.value!==a}))))}function N(e){const t=h(e);return i.createElement("div",{className:(0,r.Z)("tabs-container",b)},i.createElement(v,(0,a.Z)({},e,t)),i.createElement(y,(0,a.Z)({},e,t)))}function w(e){const t=(0,f.Z)();return i.createElement(N,(0,a.Z)({key:String(t)},e))}},4548:(e,t,n)=>{n.r(t),n.d(t,{assets:()=>c,contentTitle:()=>s,default:()=>m,frontMatter:()=>l,metadata:()=>u,toc:()=>p});var a=n(7462),i=(n(7294),n(3905)),r=n(4866),o=n(5162);const l={id:"channel_token_auth",title:"Channel JWT authorization"},s=void 0,u={unversionedId:"server/channel_token_auth",id:"server/channel_token_auth",title:"Channel JWT authorization",description:"In the chapter about channel permissions we mentioned that to subscribe on a channel client can provide subscription token. This chapter has more information about the subscription token mechanism in Centrifugo.",source:"@site/docs/server/channel_token_auth.md",sourceDirName:"server",slug:"/server/channel_token_auth",permalink:"/docs/server/channel_token_auth",draft:!1,editUrl:"https://github.com/centrifugal/centrifugal.dev/edit/main/docs/server/channel_token_auth.md",tags:[],version:"current",frontMatter:{id:"channel_token_auth",title:"Channel JWT authorization"},sidebar:"Guides",previous:{title:"Channel permission model",permalink:"/docs/server/channel_permissions"},next:{title:"Server-side subscriptions",permalink:"/docs/server/server_subs"}},c={},p=[{value:"Subscription JWT claims",id:"subscription-jwt-claims",level:2},{value:"sub",id:"sub",level:3},{value:"channel",id:"channel",level:3},{value:"info",id:"info",level:3},{value:"b64info",id:"b64info",level:3},{value:"exp",id:"exp",level:3},{value:"expire_at",id:"expire_at",level:3},{value:"aud",id:"aud",level:3},{value:"iss",id:"iss",level:3},{value:"iat",id:"iat",level:3},{value:"jti",id:"jti",level:3},{value:"override",id:"override",level:3},{value:"Example",id:"example",level:2},{value:"gensubtoken cli command",id:"gensubtoken-cli-command",level:2},{value:"Separate subscription token config",id:"separate-subscription-token-config",level:2}],d={toc:p};function m(e){let{components:t,...l}=e;return(0,i.kt)("wrapper",(0,a.Z)({},d,l,{components:t,mdxType:"MDXLayout"}),(0,i.kt)("p",null,"In the chapter about ",(0,i.kt)("a",{parentName:"p",href:"/docs/server/channel_permissions"},"channel permissions")," we mentioned that to subscribe on a channel client can provide subscription token. This chapter has more information about the subscription token mechanism in Centrifugo."),(0,i.kt)("p",null,"Subscription token is also JWT. Very similar to ",(0,i.kt)("a",{parentName:"p",href:"/docs/server/authentication"},"connection token"),", but with specific custom claims."),(0,i.kt)("p",null,"Valid subscription token passed to Centrifugo in subscribe request will tell Centrifugo that subscription must be accepted."),(0,i.kt)("p",null,(0,i.kt)("img",{src:n(841).Z,width:"3070",height:"1173"})),(0,i.kt)("p",null,"See more info about working with subscription tokens on the client side in ",(0,i.kt)("a",{parentName:"p",href:"/docs/transports/client_api#subscription-token"},"client SDK spec"),"."),(0,i.kt)("admonition",{type:"tip"},(0,i.kt)("p",{parentName:"admonition"},"Connection token and subscription token are both JWT and both can be generated with any JWT library.")),(0,i.kt)("admonition",{type:"tip"},(0,i.kt)("p",{parentName:"admonition"},"Even when authorizing a subscription to a channel with a subscription JWT you should still set a proper connection JWT for a client as it provides user authentication details to Centrifugo.")),(0,i.kt)("admonition",{type:"tip"},(0,i.kt)("p",{parentName:"admonition"},"Just like connection JWT using subscription JWT with a reasonable expiration time may help you have a good level of security in channels and still survive massive reconnect scenario \u2013 when many clients resubscribe alltogether.")),(0,i.kt)("p",null,"Supported JWT algorithms for private subscription tokens match algorithms to create connection JWT. The same HMAC secret key, RSA, and ECDSA public keys set for authentication tokens are re-used to check subscription JWT."),(0,i.kt)("h2",{id:"subscription-jwt-claims"},"Subscription JWT claims"),(0,i.kt)("p",null,"For subscription JWT Centrifugo uses some standard claims defined in ",(0,i.kt)("a",{parentName:"p",href:"https://datatracker.ietf.org/doc/html/rfc7519"},"rfc7519"),", also some custom Centrifugo-specific."),(0,i.kt)("h3",{id:"sub"},"sub"),(0,i.kt)("p",null,"This is a standard JWT claim which must contain an ID of the current application user (",(0,i.kt)("strong",{parentName:"p"},"as string"),"). "),(0,i.kt)("p",null,"The value must match a user in connection JWT \u2013 since it's the same real-time connection. The missing claim will mean that token issued for anonymous user (i.e. with empty user ID)."),(0,i.kt)("h3",{id:"channel"},"channel"),(0,i.kt)("p",null,"Required. Channel that client tries to subscribe to with this token (",(0,i.kt)("strong",{parentName:"p"},"string"),")."),(0,i.kt)("h3",{id:"info"},"info"),(0,i.kt)("p",null,"Optional. Additional information for connection inside this channel (",(0,i.kt)("strong",{parentName:"p"},"valid JSON"),")."),(0,i.kt)("h3",{id:"b64info"},"b64info"),(0,i.kt)("p",null,"Optional. Additional information for connection inside this channel in base64 format (",(0,i.kt)("strong",{parentName:"p"},"string"),"). Will be decoded by Centrifugo to raw bytes."),(0,i.kt)("h3",{id:"exp"},"exp"),(0,i.kt)("p",null,"Optional. This is a standard JWT claim that allows setting private channel subscription token expiration time (a UNIX timestamp in the future, in seconds, as integer) and configures subscription expiration time."),(0,i.kt)("p",null,"At the moment if the subscription expires client connection will be closed and the client will try to reconnect. In most cases, you don't need this and should prefer using the expiration of the connection JWT to deactivate the connection (see ",(0,i.kt)("a",{parentName:"p",href:"/docs/server/authentication"},"authentication"),"). But if you need more granular per-channel control this may fit your needs."),(0,i.kt)("p",null,"Once ",(0,i.kt)("inlineCode",{parentName:"p"},"exp")," is set in token every subscription token must be periodically refreshed. This refresh workflow happens on the client side. Refer to the specific client documentation to see how to refresh subscriptions."),(0,i.kt)("h3",{id:"expire_at"},"expire_at"),(0,i.kt)("p",null,"Optional. By default, Centrifugo looks on ",(0,i.kt)("inlineCode",{parentName:"p"},"exp")," claim to both check token expiration and configure subscription expiration time. In most cases this is fine, but there could be situations where you want to decouple subscription token expiration check with subscription expiration time. As soon as the ",(0,i.kt)("inlineCode",{parentName:"p"},"expire_at")," claim is provided (set) in subscription JWT Centrifugo relies on it for setting subscription expiration time (JWT expiration still checked over ",(0,i.kt)("inlineCode",{parentName:"p"},"exp")," though)."),(0,i.kt)("p",null,(0,i.kt)("inlineCode",{parentName:"p"},"expire_at")," is a UNIX timestamp seconds when the subscription should expire."),(0,i.kt)("ul",null,(0,i.kt)("li",{parentName:"ul"},"Set it to the future time for expiring subscription at some point"),(0,i.kt)("li",{parentName:"ul"},"Set it to ",(0,i.kt)("inlineCode",{parentName:"li"},"0")," to disable subscription expiration (but still check token ",(0,i.kt)("inlineCode",{parentName:"li"},"exp")," claim). This allows implementing a one-time subscription token. ")),(0,i.kt)("h3",{id:"aud"},"aud"),(0,i.kt)("p",null,"By default, Centrifugo does not check JWT audience (",(0,i.kt)("a",{parentName:"p",href:"https://datatracker.ietf.org/doc/html/rfc7519#section-4.1.3"},"rfc7519 aud")," claim). But if you set ",(0,i.kt)("inlineCode",{parentName:"p"},"token_audience")," option as described in ",(0,i.kt)("a",{parentName:"p",href:"/docs/server/authentication#aud"},"client authentication")," then audience for subscription JWT will also be checked."),(0,i.kt)("h3",{id:"iss"},"iss"),(0,i.kt)("p",null,"By default, Centrifugo does not check JWT issuer (",(0,i.kt)("a",{parentName:"p",href:"https://datatracker.ietf.org/doc/html/rfc7519#section-4.1.1"},"rfc7519 iss")," claim). But if you set ",(0,i.kt)("inlineCode",{parentName:"p"},"token_issuer")," option as described in ",(0,i.kt)("a",{parentName:"p",href:"/docs/server/authentication#iss"},"client authentication")," then issuer for subscription JWT will also be checked."),(0,i.kt)("h3",{id:"iat"},"iat"),(0,i.kt)("p",null,"This is a UNIX time when token was issued (seconds). See ",(0,i.kt)("a",{parentName:"p",href:"https://datatracker.ietf.org/doc/html/rfc7519#section-4.1.6"},"definition in RFC"),". This claim is optional but can be useful together with ",(0,i.kt)("a",{parentName:"p",href:"/docs/pro/token_revocation"},"Centrifugo PRO token revocation features"),"."),(0,i.kt)("h3",{id:"jti"},"jti"),(0,i.kt)("p",null,"This is a token unique ID. See ",(0,i.kt)("a",{parentName:"p",href:"https://datatracker.ietf.org/doc/html/rfc7519#section-4.1.7"},"definition in RFC"),". This claim is optional but can be useful together with ",(0,i.kt)("a",{parentName:"p",href:"/docs/pro/token_revocation"},"Centrifugo PRO token revocation features"),"."),(0,i.kt)("h3",{id:"override"},"override"),(0,i.kt)("p",null,"One more claim is ",(0,i.kt)("inlineCode",{parentName:"p"},"override"),". This is an object which allows overriding channel options for the particular channel subscriber which comes with subscription token."),(0,i.kt)("table",null,(0,i.kt)("thead",{parentName:"table"},(0,i.kt)("tr",{parentName:"thead"},(0,i.kt)("th",{parentName:"tr",align:null},"Field"),(0,i.kt)("th",{parentName:"tr",align:null},"Type"),(0,i.kt)("th",{parentName:"tr",align:null},"Optional"),(0,i.kt)("th",{parentName:"tr",align:null},"Description"))),(0,i.kt)("tbody",{parentName:"table"},(0,i.kt)("tr",{parentName:"tbody"},(0,i.kt)("td",{parentName:"tr",align:null},"presence"),(0,i.kt)("td",{parentName:"tr",align:null},"BoolValue"),(0,i.kt)("td",{parentName:"tr",align:null},"yes"),(0,i.kt)("td",{parentName:"tr",align:null},"override ",(0,i.kt)("inlineCode",{parentName:"td"},"presence")," channel option")),(0,i.kt)("tr",{parentName:"tbody"},(0,i.kt)("td",{parentName:"tr",align:null},"join_leave"),(0,i.kt)("td",{parentName:"tr",align:null},"BoolValue"),(0,i.kt)("td",{parentName:"tr",align:null},"yes"),(0,i.kt)("td",{parentName:"tr",align:null},"override ",(0,i.kt)("inlineCode",{parentName:"td"},"join_leave")," channel option")),(0,i.kt)("tr",{parentName:"tbody"},(0,i.kt)("td",{parentName:"tr",align:null},"force_push_join_leave"),(0,i.kt)("td",{parentName:"tr",align:null},"BoolValue"),(0,i.kt)("td",{parentName:"tr",align:null},"yes"),(0,i.kt)("td",{parentName:"tr",align:null},"override ",(0,i.kt)("inlineCode",{parentName:"td"},"force_push_join_leave")," channel option")),(0,i.kt)("tr",{parentName:"tbody"},(0,i.kt)("td",{parentName:"tr",align:null},"force_recovery"),(0,i.kt)("td",{parentName:"tr",align:null},"BoolValue"),(0,i.kt)("td",{parentName:"tr",align:null},"yes"),(0,i.kt)("td",{parentName:"tr",align:null},"override ",(0,i.kt)("inlineCode",{parentName:"td"},"force_recovery")," channel option")),(0,i.kt)("tr",{parentName:"tbody"},(0,i.kt)("td",{parentName:"tr",align:null},"force_positioning"),(0,i.kt)("td",{parentName:"tr",align:null},"BoolValue"),(0,i.kt)("td",{parentName:"tr",align:null},"yes"),(0,i.kt)("td",{parentName:"tr",align:null},"override ",(0,i.kt)("inlineCode",{parentName:"td"},"force_positioning")," channel option")))),(0,i.kt)("p",null,(0,i.kt)("inlineCode",{parentName:"p"},"BoolValue")," is an object like this:"),(0,i.kt)("pre",null,(0,i.kt)("code",{parentName:"pre",className:"language-json"},'{\n  "value": true/false\n}\n')),(0,i.kt)("p",null,"So for example, you want to turn off emitting a presence information for a particular subscriber in a channel:"),(0,i.kt)("pre",null,(0,i.kt)("code",{parentName:"pre",className:"language-json"},'{\n    ...\n    "override": {\n        "presence": {\n            "value": false\n        }\n    }\n}\n')),(0,i.kt)("h2",{id:"example"},"Example"),(0,i.kt)("p",null,"So to generate a subscription token you can use something like this in Python (assuming user ID is ",(0,i.kt)("inlineCode",{parentName:"p"},"42")," and the channel is ",(0,i.kt)("inlineCode",{parentName:"p"},"gossips"),"):"),(0,i.kt)(r.Z,{className:"unique-tabs",defaultValue:"python",values:[{label:"Python",value:"python"},{label:"NodeJS",value:"node"}],mdxType:"Tabs"},(0,i.kt)(o.Z,{value:"python",mdxType:"TabItem"},(0,i.kt)("pre",null,(0,i.kt)("code",{parentName:"pre",className:"language-python"},'import jwt\nimport time\n\nclaims = {"sub": "42", "channel": "$gossips", "exp": int(time.time()) + 3600}\ntoken = jwt.encode(claims, "secret", algorithm="HS256").decode()\nprint(token)\n'))),(0,i.kt)(o.Z,{value:"node",mdxType:"TabItem"},(0,i.kt)("pre",null,(0,i.kt)("code",{parentName:"pre",className:"language-javascript"},"const jose = require('jose')\n\n(async function main() {\n  const secret = new TextEncoder().encode('secret')\n  const alg = 'HS256'\n\n  const token = await new jose.SignJWT({ sub: '42', channel: '$gossips' })\n    .setProtectedHeader({ alg })\n    .setExpirationTime('1h')\n    .sign(secret)\n\n  console.log(token);\n})();\n")))),(0,i.kt)("p",null,"Where ",(0,i.kt)("inlineCode",{parentName:"p"},'"secret"')," is the ",(0,i.kt)("inlineCode",{parentName:"p"},"token_hmac_secret_key")," from Centrifugo configuration (we use HMAC tokens in this example which relies on a shared secret key, for RSA or ECDSA tokens you need to use a private key known only by your backend)."),(0,i.kt)("h2",{id:"gensubtoken-cli-command"},"gensubtoken cli command"),(0,i.kt)("p",null,"During development you can quickly generate valid subscription token using Centrifugo ",(0,i.kt)("inlineCode",{parentName:"p"},"gensubtoken")," cli command."),(0,i.kt)("pre",null,(0,i.kt)("code",{parentName:"pre"},"./centrifugo gensubtoken -u 123722 -s channel\n")),(0,i.kt)("p",null,"You should see an output like this:"),(0,i.kt)("pre",null,(0,i.kt)("code",{parentName:"pre"},'HMAC SHA-256 JWT for user "123722" and channel "channel" with expiration TTL 168h0m0s:\neyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM3MjIiLCJleHAiOjE2NTU0NDg0MzgsImNoYW5uZWwiOiJjaGFubmVsIn0.JyRI3ovNV-abV8VxCmZCD556o2F2mNL1UoU58gNR-uI\n')),(0,i.kt)("p",null,"But in real app subscription JWT must be generated by your application backend."),(0,i.kt)("h2",{id:"separate-subscription-token-config"},"Separate subscription token config"),(0,i.kt)("p",null,"When ",(0,i.kt)("inlineCode",{parentName:"p"},"separate_subscription_token_config")," boolean option is ",(0,i.kt)("inlineCode",{parentName:"p"},"true")," Centrifugo does not look at general token options at all when verifying subscription tokens and uses config options starting from ",(0,i.kt)("inlineCode",{parentName:"p"},"subscription_token_")," prefix instead. "),(0,i.kt)("p",null,"Here is an example how to use JWKS for connection tokens, but have HMAC-based verification for subscription tokens:"),(0,i.kt)("pre",null,(0,i.kt)("code",{parentName:"pre",className:"language-json",metastring:'title="config.json"',title:'"config.json"'},'{\n  "token_jwks_public_endpoint": "https://example.com/openid-connect/certs",\n  "separate_subscription_token_config": true,\n  "subscription_token_hmac_secret_key": "separate_secret_which_must_be_strong"\n}\n')),(0,i.kt)("p",null,"All the options which are available for connection token configuration may be re-used for a separate subscription token configuration \u2013 just prefix them with ",(0,i.kt)("inlineCode",{parentName:"p"},"subscription_token_")," instead of ",(0,i.kt)("inlineCode",{parentName:"p"},"token_"),"."))}m.isMDXComponent=!0},841:(e,t,n)=>{n.d(t,{Z:()=>a});const a=n.p+"assets/images/subscription_token-248bd644ebec79ef16717be683bcb6c1.png"}}]);