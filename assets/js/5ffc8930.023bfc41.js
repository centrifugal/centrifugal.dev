"use strict";(self.webpackChunkcentrifugal_dev=self.webpackChunkcentrifugal_dev||[]).push([[630],{3905:(e,r,t)=>{t.d(r,{Zo:()=>c,kt:()=>f});var n=t(7294);function o(e,r,t){return r in e?Object.defineProperty(e,r,{value:t,enumerable:!0,configurable:!0,writable:!0}):e[r]=t,e}function a(e,r){var t=Object.keys(e);if(Object.getOwnPropertySymbols){var n=Object.getOwnPropertySymbols(e);r&&(n=n.filter((function(r){return Object.getOwnPropertyDescriptor(e,r).enumerable}))),t.push.apply(t,n)}return t}function i(e){for(var r=1;r<arguments.length;r++){var t=null!=arguments[r]?arguments[r]:{};r%2?a(Object(t),!0).forEach((function(r){o(e,r,t[r])})):Object.getOwnPropertyDescriptors?Object.defineProperties(e,Object.getOwnPropertyDescriptors(t)):a(Object(t)).forEach((function(r){Object.defineProperty(e,r,Object.getOwnPropertyDescriptor(t,r))}))}return e}function s(e,r){if(null==e)return{};var t,n,o=function(e,r){if(null==e)return{};var t,n,o={},a=Object.keys(e);for(n=0;n<a.length;n++)t=a[n],r.indexOf(t)>=0||(o[t]=e[t]);return o}(e,r);if(Object.getOwnPropertySymbols){var a=Object.getOwnPropertySymbols(e);for(n=0;n<a.length;n++)t=a[n],r.indexOf(t)>=0||Object.prototype.propertyIsEnumerable.call(e,t)&&(o[t]=e[t])}return o}var p=n.createContext({}),l=function(e){var r=n.useContext(p),t=r;return e&&(t="function"==typeof e?e(r):i(i({},r),e)),t},c=function(e){var r=l(e.components);return n.createElement(p.Provider,{value:r},e.children)},u={inlineCode:"code",wrapper:function(e){var r=e.children;return n.createElement(n.Fragment,{},r)}},d=n.forwardRef((function(e,r){var t=e.components,o=e.mdxType,a=e.originalType,p=e.parentName,c=s(e,["components","mdxType","originalType","parentName"]),d=l(t),f=o,m=d["".concat(p,".").concat(f)]||d[f]||u[f]||a;return t?n.createElement(m,i(i({ref:r},c),{},{components:t})):n.createElement(m,i({ref:r},c))}));function f(e,r){var t=arguments,o=r&&r.mdxType;if("string"==typeof e||o){var a=t.length,i=new Array(a);i[0]=d;var s={};for(var p in r)hasOwnProperty.call(r,p)&&(s[p]=r[p]);s.originalType=e,s.mdxType="string"==typeof e?e:o,i[1]=s;for(var l=2;l<a;l++)i[l]=t[l];return n.createElement.apply(null,i)}return n.createElement.apply(null,t)}d.displayName="MDXCreateElement"},5734:(e,r,t)=>{t.r(r),t.d(r,{assets:()=>p,contentTitle:()=>i,default:()=>u,frontMatter:()=>a,metadata:()=>s,toc:()=>l});var n=t(7462),o=(t(7294),t(3905));const a={id:"performance",title:"Faster performance"},i=void 0,s={unversionedId:"pro/performance",id:"version-4/pro/performance",title:"Faster performance",description:"Centrifugo PRO has performance improvements for several server parts. These improvements can help to reduce tail end-to-end latencies in the application, increase server throughput and/or reduce CPU usage on server machines. Our open-source version has a decent performance by itself, with PRO improvements Cenrifugo steps even further.",source:"@site/versioned_docs/version-4/pro/performance.md",sourceDirName:"pro",slug:"/pro/performance",permalink:"/docs/4/pro/performance",draft:!1,editUrl:"https://github.com/centrifugal/centrifugal.dev/edit/main/versioned_docs/version-4/pro/performance.md",tags:[],version:"4",frontMatter:{id:"performance",title:"Faster performance"},sidebar:"Pro",previous:{title:"CEL expressions",permalink:"/docs/4/pro/cel_expressions"},next:{title:"Singleflight",permalink:"/docs/4/pro/singleflight"}},p={},l=[{value:"Faster HTTP API",id:"faster-http-api",level:2},{value:"Faster GRPC API",id:"faster-grpc-api",level:2},{value:"Faster HTTP proxy",id:"faster-http-proxy",level:2},{value:"Faster GRPC proxy",id:"faster-grpc-proxy",level:2},{value:"Faster JWT decoding",id:"faster-jwt-decoding",level:2},{value:"Faster GRPC unidirectional stream",id:"faster-grpc-unidirectional-stream",level:2},{value:"Examples",id:"examples",level:2},{value:"Publish HTTP API",id:"publish-http-api",level:3},{value:"History HTTP API",id:"history-http-api",level:3}],c={toc:l};function u(e){let{components:r,...t}=e;return(0,o.kt)("wrapper",(0,n.Z)({},c,t,{components:r,mdxType:"MDXLayout"}),(0,o.kt)("img",{src:"/img/logo_animated_fast.svg",width:"100px",height:"100px",align:"left",style:{marginRight:"10px",float:"left"}}),(0,o.kt)("p",null,"Centrifugo PRO has performance improvements for several server parts. These improvements can help to reduce tail end-to-end latencies in the application, increase server throughput and/or reduce CPU usage on server machines. Our open-source version has a decent performance by itself, with PRO improvements Cenrifugo steps even further."),(0,o.kt)("h2",{id:"faster-http-api"},"Faster HTTP API"),(0,o.kt)("p",null,"Centrifugo PRO has an optimized JSON serialization/deserialization for HTTP API."),(0,o.kt)("p",null,"The effect can be noticeable under load. The exact numbers heavily depend on usage scenario. According to our benchmarks you can expect 10-15% more requests/sec for small message publications over HTTP API, and up to several times throughput boost when you are frequently get lots of messages from a history, see a couple of examples below."),(0,o.kt)("h2",{id:"faster-grpc-api"},"Faster GRPC API"),(0,o.kt)("p",null,"Centrifugo PRO has an optimized Protobuf serialization/deserialization for GRPC API. The effect can be noticeable under load. The exact numbers heavily depend on usage scenario."),(0,o.kt)("h2",{id:"faster-http-proxy"},"Faster HTTP proxy"),(0,o.kt)("p",null,"Centrifugo PRO has an optimized JSON serialization/deserialization for HTTP proxy. The effect can be noticeable under load. The exact numbers heavily depend on usage scenario."),(0,o.kt)("h2",{id:"faster-grpc-proxy"},"Faster GRPC proxy"),(0,o.kt)("p",null,"Centrifugo PRO has an optimized Protobuf serialization/deserialization for GRPC API. The effect can be noticeable under load. The exact numbers heavily depend on usage scenario."),(0,o.kt)("h2",{id:"faster-jwt-decoding"},"Faster JWT decoding"),(0,o.kt)("p",null,"Centrifugo PRO has an optimized decoding of JWT claims."),(0,o.kt)("h2",{id:"faster-grpc-unidirectional-stream"},"Faster GRPC unidirectional stream"),(0,o.kt)("p",null,"Centrifugo PRO has an optimized Protobuf deserialization for GRPC unidirectional stream. This only affects deserialization of initial connect command."),(0,o.kt)("h2",{id:"examples"},"Examples"),(0,o.kt)("p",null,"Let's look at quick live comparisons of Centrifugo OSS and Centrifugo PRO regarding HTTP API performance."),(0,o.kt)("h3",{id:"publish-http-api"},"Publish HTTP API"),(0,o.kt)("video",{width:"100%",controls:!0},(0,o.kt)("source",{src:"/img/pro_api_publish_perf.mp4",type:"video/mp4"}),"Sorry, your browser doesn't support embedded video."),(0,o.kt)("p",null,"In this video you can see a 13% speed up for publish operation. But for more complex API calls with larger payloads the difference can be much bigger. See next example that demonstrates this."),(0,o.kt)("h3",{id:"history-http-api"},"History HTTP API"),(0,o.kt)("video",{width:"100%",controls:!0},(0,o.kt)("source",{src:"/img/pro_api_history_perf.mp4",type:"video/mp4"}),"Sorry, your browser doesn't support embedded video."),(0,o.kt)("p",null,"In this video you can see an almost 2x overall speed up while asking 100 messages from Centrifugo history API."))}u.isMDXComponent=!0}}]);