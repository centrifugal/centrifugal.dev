"use strict";(self.webpackChunkcentrifugal_dev=self.webpackChunkcentrifugal_dev||[]).push([[9878],{3905:(e,n,t)=>{t.d(n,{Zo:()=>c,kt:()=>d});var a=t(7294);function r(e,n,t){return n in e?Object.defineProperty(e,n,{value:t,enumerable:!0,configurable:!0,writable:!0}):e[n]=t,e}function i(e,n){var t=Object.keys(e);if(Object.getOwnPropertySymbols){var a=Object.getOwnPropertySymbols(e);n&&(a=a.filter((function(n){return Object.getOwnPropertyDescriptor(e,n).enumerable}))),t.push.apply(t,a)}return t}function s(e){for(var n=1;n<arguments.length;n++){var t=null!=arguments[n]?arguments[n]:{};n%2?i(Object(t),!0).forEach((function(n){r(e,n,t[n])})):Object.getOwnPropertyDescriptors?Object.defineProperties(e,Object.getOwnPropertyDescriptors(t)):i(Object(t)).forEach((function(n){Object.defineProperty(e,n,Object.getOwnPropertyDescriptor(t,n))}))}return e}function o(e,n){if(null==e)return{};var t,a,r=function(e,n){if(null==e)return{};var t,a,r={},i=Object.keys(e);for(a=0;a<i.length;a++)t=i[a],n.indexOf(t)>=0||(r[t]=e[t]);return r}(e,n);if(Object.getOwnPropertySymbols){var i=Object.getOwnPropertySymbols(e);for(a=0;a<i.length;a++)t=i[a],n.indexOf(t)>=0||Object.prototype.propertyIsEnumerable.call(e,t)&&(r[t]=e[t])}return r}var l=a.createContext({}),p=function(e){var n=a.useContext(l),t=n;return e&&(t="function"==typeof e?e(n):s(s({},n),e)),t},c=function(e){var n=p(e.components);return a.createElement(l.Provider,{value:n},e.children)},u={inlineCode:"code",wrapper:function(e){var n=e.children;return a.createElement(a.Fragment,{},n)}},m=a.forwardRef((function(e,n){var t=e.components,r=e.mdxType,i=e.originalType,l=e.parentName,c=o(e,["components","mdxType","originalType","parentName"]),m=p(t),d=r,h=m["".concat(l,".").concat(d)]||m[d]||u[d]||i;return t?a.createElement(h,s(s({ref:n},c),{},{components:t})):a.createElement(h,s({ref:n},c))}));function d(e,n){var t=arguments,r=n&&n.mdxType;if("string"==typeof e||r){var i=t.length,s=new Array(i);s[0]=m;var o={};for(var l in n)hasOwnProperty.call(n,l)&&(o[l]=n[l]);o.originalType=e,o.mdxType="string"==typeof e?e:r,s[1]=o;for(var p=2;p<i;p++)s[p]=t[p];return a.createElement.apply(null,s)}return a.createElement.apply(null,t)}m.displayName="MDXCreateElement"},6596:(e,n,t)=>{t.r(n),t.d(n,{assets:()=>l,contentTitle:()=>s,default:()=>u,frontMatter:()=>i,metadata:()=>o,toc:()=>p});var a=t(7462),r=(t(7294),t(3905));const i={id:"cel_expressions",sidebar_label:"CEL expressions",title:"CEL expressions"},s=void 0,o={unversionedId:"pro/cel_expressions",id:"pro/cel_expressions",title:"CEL expressions",description:"Centrifugo PRO supports CEL expressions (Common Expression Language) for checking channel operation permissions.",source:"@site/docs/pro/cel_expressions.md",sourceDirName:"pro",slug:"/pro/cel_expressions",permalink:"/docs/pro/cel_expressions",draft:!1,editUrl:"https://github.com/centrifugal/centrifugal.dev/edit/main/docs/pro/cel_expressions.md",tags:[],version:"current",frontMatter:{id:"cel_expressions",sidebar_label:"CEL expressions",title:"CEL expressions"},sidebar:"Pro",previous:{title:"Channel patterns",permalink:"/docs/pro/channel_patterns"},next:{title:"Faster performance",permalink:"/docs/pro/performance"}},l={},p=[{value:"subscribe_cel",id:"subscribe_cel",level:2},{value:"Expression variables",id:"expression-variables",level:3},{value:"publish_cel",id:"publish_cel",level:2},{value:"history_cel",id:"history_cel",level:2},{value:"presence_cel",id:"presence_cel",level:2}],c={toc:p};function u(e){let{components:n,...t}=e;return(0,r.kt)("wrapper",(0,a.Z)({},c,t,{components:n,mdxType:"MDXLayout"}),(0,r.kt)("p",null,"Centrifugo PRO supports ",(0,r.kt)("a",{parentName:"p",href:"https://opensource.google/projects/cel"},"CEL expressions")," (Common Expression Language) for checking channel operation permissions."),(0,r.kt)("p",null,"CEL expressions provide a developer-friendly, fast and secure way to evaluate some conditions predefined in the configuration. They are used in some Google services (ex. Firebase), in Envoy RBAC configuration, etc."),(0,r.kt)("p",null,"For Centrifugo this is a flexible mechanism which can help to avoid using subscription tokens or using subscribe proxy in some cases. This means you can avoid sending an additional HTTP request to the backend for a channel subscription attempt. As the result less resources may be used and smaller latencies may be achieved in the system. This is a way to introduce efficient channel permission mechanics when Centrifugo built-in rules are not enough."),(0,r.kt)("p",null,"Some good links which may help you dive into CEL expressions are:"),(0,r.kt)("ul",null,(0,r.kt)("li",{parentName:"ul"},(0,r.kt)("a",{parentName:"li",href:"https://github.com/google/cel-spec/blob/master/doc/intro.md"},"CEL introduction")),(0,r.kt)("li",{parentName:"ul"},(0,r.kt)("a",{parentName:"li",href:"https://github.com/google/cel-spec/blob/master/doc/langdef.md"},"CEL language definition")),(0,r.kt)("li",{parentName:"ul"},(0,r.kt)("a",{parentName:"li",href:"https://cloud.google.com/asset-inventory/docs/monitoring-asset-changes-with-condition#using_cel"},"Docs of Google asset inventory")," which also uses CEL")),(0,r.kt)("p",null,"Below we will explore some basic expressions and show how they can be used in Centrifugo."),(0,r.kt)("h2",{id:"subscribe_cel"},"subscribe_cel"),(0,r.kt)("p",null,"We suppose that the main operation for which developers may use CEL expressions in Centrifugo is a subscribe operation. Let's look at it in detail."),(0,r.kt)("p",null,"It's possible to configure ",(0,r.kt)("inlineCode",{parentName:"p"},"subscribe_cel")," for a channel namespace (",(0,r.kt)("inlineCode",{parentName:"p"},"subscribe_cel")," is just an additional namespace ",(0,r.kt)("a",{parentName:"p",href:"/docs/server/channels#channel-options"},"channel option"),", with same rules applied). This expression should be a valid CEL expression."),(0,r.kt)("pre",null,(0,r.kt)("code",{parentName:"pre",className:"language-json",metastring:'title="config.json"',title:'"config.json"'},'{\n    "namespaces": [\n        {\n            "name": "admin",\n            "subscribe_cel": "\'admin\' in meta.roles"\n        }\n    ]\n}\n')),(0,r.kt)("p",null,"In the example we are using custom ",(0,r.kt)("inlineCode",{parentName:"p"},"meta")," information (must be an object) attached to the connection. As mentioned before in the doc this meta may be attached to the connection:"),(0,r.kt)("ul",null,(0,r.kt)("li",{parentName:"ul"},"when set in the ",(0,r.kt)("a",{parentName:"li",href:"/docs/server/proxy#connect-proxy"},"connect proxy")," result"),(0,r.kt)("li",{parentName:"ul"},"or provided in JWT as ",(0,r.kt)("a",{parentName:"li",href:"/docs/server/authentication#meta"},"meta")," claim")),(0,r.kt)("p",null,"An expression is evaluated for every subscription attempt to a channel in a namespace. So if ",(0,r.kt)("inlineCode",{parentName:"p"},"meta")," attached to the connection is sth like this:"),(0,r.kt)("pre",null,(0,r.kt)("code",{parentName:"pre",className:"language-json"},'{\n    "roles": ["admin"]\n}\n')),(0,r.kt)("p",null,"\u2013 then for every channel in the ",(0,r.kt)("inlineCode",{parentName:"p"},"admin")," namespace defined above expression will be evaluated to ",(0,r.kt)("inlineCode",{parentName:"p"},"True")," and subscription will be accepted by Centrifugo."),(0,r.kt)("admonition",{type:"tip"},(0,r.kt)("p",{parentName:"admonition"},(0,r.kt)("inlineCode",{parentName:"p"},"meta")," must be JSON object (any ",(0,r.kt)("inlineCode",{parentName:"p"},"{}"),") for CEL expressions to work.")),(0,r.kt)("h3",{id:"expression-variables"},"Expression variables"),(0,r.kt)("p",null,"Inside the expression developers can use some variables which are injected by Centrifugo to the CEL runtime. "),(0,r.kt)("p",null,"Information about current ",(0,r.kt)("inlineCode",{parentName:"p"},"user")," ID, ",(0,r.kt)("inlineCode",{parentName:"p"},"meta")," information attached to the connection, all the variables defined in matched ",(0,r.kt)("a",{parentName:"p",href:"/docs/pro/channel_patterns"},"channel pattern")," will be available for CEL expression evaluation."),(0,r.kt)("p",null,"Say client with user ID ",(0,r.kt)("inlineCode",{parentName:"p"},"123")," subscribes to a channel ",(0,r.kt)("inlineCode",{parentName:"p"},"/users/4")," which matched the ",(0,r.kt)("a",{parentName:"p",href:"/docs/pro/channel_patterns"},"channel pattern")," ",(0,r.kt)("inlineCode",{parentName:"p"},"/users/:user"),":"),(0,r.kt)("table",null,(0,r.kt)("thead",{parentName:"table"},(0,r.kt)("tr",{parentName:"thead"},(0,r.kt)("th",{parentName:"tr",align:null},"Variable"),(0,r.kt)("th",{parentName:"tr",align:null},"Type"),(0,r.kt)("th",{parentName:"tr",align:null},"Example"),(0,r.kt)("th",{parentName:"tr",align:null},"Description"))),(0,r.kt)("tbody",{parentName:"table"},(0,r.kt)("tr",{parentName:"tbody"},(0,r.kt)("td",{parentName:"tr",align:null},"subscribed"),(0,r.kt)("td",{parentName:"tr",align:null},(0,r.kt)("inlineCode",{parentName:"td"},"bool")),(0,r.kt)("td",{parentName:"tr",align:null},(0,r.kt)("inlineCode",{parentName:"td"},"false")),(0,r.kt)("td",{parentName:"tr",align:null},"Whether client is subscribed to channel, always ",(0,r.kt)("inlineCode",{parentName:"td"},"false")," for ",(0,r.kt)("inlineCode",{parentName:"td"},"subscribe")," operation")),(0,r.kt)("tr",{parentName:"tbody"},(0,r.kt)("td",{parentName:"tr",align:null},"user"),(0,r.kt)("td",{parentName:"tr",align:null},(0,r.kt)("inlineCode",{parentName:"td"},"string")),(0,r.kt)("td",{parentName:"tr",align:null},(0,r.kt)("inlineCode",{parentName:"td"},'"123"')),(0,r.kt)("td",{parentName:"tr",align:null},"Current authenticated user ID (known from from JWT or connect proxy result)")),(0,r.kt)("tr",{parentName:"tbody"},(0,r.kt)("td",{parentName:"tr",align:null},"meta"),(0,r.kt)("td",{parentName:"tr",align:null},(0,r.kt)("inlineCode",{parentName:"td"},"map[string]any")),(0,r.kt)("td",{parentName:"tr",align:null},(0,r.kt)("inlineCode",{parentName:"td"},'{"roles": ["admin"]}')),(0,r.kt)("td",{parentName:"tr",align:null},"Meta information attached to the connection by the apllication backend (in JWT or over connect proxy result)")),(0,r.kt)("tr",{parentName:"tbody"},(0,r.kt)("td",{parentName:"tr",align:null},"channel"),(0,r.kt)("td",{parentName:"tr",align:null},(0,r.kt)("inlineCode",{parentName:"td"},"string")),(0,r.kt)("td",{parentName:"tr",align:null},(0,r.kt)("inlineCode",{parentName:"td"},'"/users/4"')),(0,r.kt)("td",{parentName:"tr",align:null},"Channel client tries to subscribe")),(0,r.kt)("tr",{parentName:"tbody"},(0,r.kt)("td",{parentName:"tr",align:null},"vars"),(0,r.kt)("td",{parentName:"tr",align:null},(0,r.kt)("inlineCode",{parentName:"td"},"map[string]string")),(0,r.kt)("td",{parentName:"tr",align:null},(0,r.kt)("inlineCode",{parentName:"td"},'{"user": "4"}')),(0,r.kt)("td",{parentName:"tr",align:null},"Extracted variables from the matched channel pattern. It's empty in case of using channels without variables.")))),(0,r.kt)("p",null,"In this case, to allow admin to subscribe on any user's channel or allow non-admin user to subscribe only on its own channel, you may construct an expression like this:"),(0,r.kt)("pre",null,(0,r.kt)("code",{parentName:"pre",className:"language-json"},'{\n    ...\n    "subscribe_cel": "vars.user == user or \'admin\' in meta.roles"\n}\n')),(0,r.kt)("p",null,"Let's look at one more example. Say client with user ID ",(0,r.kt)("inlineCode",{parentName:"p"},"123")," subscribes to a channel ",(0,r.kt)("inlineCode",{parentName:"p"},"/example.com/users/4")," which matched the ",(0,r.kt)("a",{parentName:"p",href:"/docs/pro/channel_patterns"},"channel pattern")," ",(0,r.kt)("inlineCode",{parentName:"p"},"/:tenant/users/:user"),". The permission check may be transformed into sth like this (assuming ",(0,r.kt)("inlineCode",{parentName:"p"},"meta")," information has information about current connection tenant):"),(0,r.kt)("pre",null,(0,r.kt)("code",{parentName:"pre",className:"language-json"},'{\n    "namespaces": [\n        {\n            "name": "/:tenant/users/:user",\n            "subscribe_cel": "vars.tenant == meta.tenant && (vars.user == user or \'admin\' in meta.roles)"\n        }\n    ]\n}\n')),(0,r.kt)("h2",{id:"publish_cel"},"publish_cel"),(0,r.kt)("p",null,"CEL expression to check permissions to publish into a channel. ",(0,r.kt)("a",{parentName:"p",href:"#expression-variables"},"Same expression variables")," are available."),(0,r.kt)("h2",{id:"history_cel"},"history_cel"),(0,r.kt)("p",null,"CEL expression to check permissions for channel history. ",(0,r.kt)("a",{parentName:"p",href:"#expression-variables"},"Same expression variables")," are available."),(0,r.kt)("h2",{id:"presence_cel"},"presence_cel"),(0,r.kt)("p",null,"CEL expression to check permissions for channel presence. ",(0,r.kt)("a",{parentName:"p",href:"#expression-variables"},"Same expression variables")," are available."))}u.isMDXComponent=!0}}]);