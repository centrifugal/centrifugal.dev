"use strict";(self.webpackChunkcentrifugal_dev=self.webpackChunkcentrifugal_dev||[]).push([[8238],{3905:function(e,t,n){n.d(t,{Zo:function(){return p},kt:function(){return f}});var r=n(7294);function i(e,t,n){return t in e?Object.defineProperty(e,t,{value:n,enumerable:!0,configurable:!0,writable:!0}):e[t]=n,e}function o(e,t){var n=Object.keys(e);if(Object.getOwnPropertySymbols){var r=Object.getOwnPropertySymbols(e);t&&(r=r.filter((function(t){return Object.getOwnPropertyDescriptor(e,t).enumerable}))),n.push.apply(n,r)}return n}function a(e){for(var t=1;t<arguments.length;t++){var n=null!=arguments[t]?arguments[t]:{};t%2?o(Object(n),!0).forEach((function(t){i(e,t,n[t])})):Object.getOwnPropertyDescriptors?Object.defineProperties(e,Object.getOwnPropertyDescriptors(n)):o(Object(n)).forEach((function(t){Object.defineProperty(e,t,Object.getOwnPropertyDescriptor(n,t))}))}return e}function l(e,t){if(null==e)return{};var n,r,i=function(e,t){if(null==e)return{};var n,r,i={},o=Object.keys(e);for(r=0;r<o.length;r++)n=o[r],t.indexOf(n)>=0||(i[n]=e[n]);return i}(e,t);if(Object.getOwnPropertySymbols){var o=Object.getOwnPropertySymbols(e);for(r=0;r<o.length;r++)n=o[r],t.indexOf(n)>=0||Object.prototype.propertyIsEnumerable.call(e,n)&&(i[n]=e[n])}return i}var c=r.createContext({}),u=function(e){var t=r.useContext(c),n=t;return e&&(n="function"==typeof e?e(t):a(a({},t),e)),n},p=function(e){var t=u(e.components);return r.createElement(c.Provider,{value:t},e.children)},s={inlineCode:"code",wrapper:function(e){var t=e.children;return r.createElement(r.Fragment,{},t)}},d=r.forwardRef((function(e,t){var n=e.components,i=e.mdxType,o=e.originalType,c=e.parentName,p=l(e,["components","mdxType","originalType","parentName"]),d=u(n),f=i,g=d["".concat(c,".").concat(f)]||d[f]||s[f]||o;return n?r.createElement(g,a(a({ref:t},p),{},{components:n})):r.createElement(g,a({ref:t},p))}));function f(e,t){var n=arguments,i=t&&t.mdxType;if("string"==typeof e||i){var o=n.length,a=new Array(o);a[0]=d;var l={};for(var c in t)hasOwnProperty.call(t,c)&&(l[c]=t[c]);l.originalType=e,l.mdxType="string"==typeof e?e:i,a[1]=l;for(var u=2;u<o;u++)a[u]=n[u];return r.createElement.apply(null,a)}return r.createElement.apply(null,n)}d.displayName="MDXCreateElement"},7700:function(e,t,n){n.r(t),n.d(t,{frontMatter:function(){return l},contentTitle:function(){return c},metadata:function(){return u},toc:function(){return p},default:function(){return d}});var r=n(2122),i=n(9756),o=(n(7294),n(3905)),a=["components"],l={id:"uni_grpc",title:"Unidirectional GRPC",sidebar_label:"GRPC"},c=void 0,u={unversionedId:"transports/uni_grpc",id:"transports/uni_grpc",isDocsHomePage:!1,title:"Unidirectional GRPC",description:"It's possible to connect to GRPC unidirectional stream to consume real-time messages from Centrifugo. In this case you need to generate GRPC code for your language on client-side.",source:"@site/docs/transports/uni_grpc.md",sourceDirName:"transports",slug:"/transports/uni_grpc",permalink:"/docs/transports/uni_grpc",editUrl:"https://github.com/centrifugal/centrifugal.dev/edit/main/docs/transports/uni_grpc.md",version:"current",frontMatter:{id:"uni_grpc",title:"Unidirectional GRPC",sidebar_label:"GRPC"},sidebar:"Transports",previous:{title:"HTTP streaming",permalink:"/docs/transports/uni_http_stream"},next:{title:"Client protocol",permalink:"/docs/transports/client_protocol"}},p=[{value:"Supported data formats",id:"supported-data-formats",children:[]},{value:"Options",id:"options",children:[{value:"uni_grpc",id:"uni_grpc",children:[]},{value:"uni_grpc_port",id:"uni_grpc_port",children:[]},{value:"uni_grpc_address",id:"uni_grpc_address",children:[]},{value:"uni_grpc_max_receive_message_size",id:"uni_grpc_max_receive_message_size",children:[]},{value:"uni_grpc_tls",id:"uni_grpc_tls",children:[]},{value:"uni_grpc_tls_cert",id:"uni_grpc_tls_cert",children:[]},{value:"uni_grpc_tls_key",id:"uni_grpc_tls_key",children:[]}]},{value:"Example",id:"example",children:[]}],s={toc:p};function d(e){var t=e.components,n=(0,i.Z)(e,a);return(0,o.kt)("wrapper",(0,r.Z)({},s,n,{components:t,mdxType:"MDXLayout"}),(0,o.kt)("p",null,"It's possible to connect to GRPC unidirectional stream to consume real-time messages from Centrifugo. In this case you need to generate GRPC code for your language on client-side."),(0,o.kt)("p",null,"Protobuf definitions can be found ",(0,o.kt)("a",{parentName:"p",href:"https://github.com/centrifugal/centrifugo/blob/master/internal/unigrpc/unistream/unistream.proto"},"here"),"."),(0,o.kt)("p",null,"See a Go based example that connects to a server: TODO."),(0,o.kt)("p",null,"GRPC server will start on port ",(0,o.kt)("inlineCode",{parentName:"p"},"11000")," (default)."),(0,o.kt)("h2",{id:"supported-data-formats"},"Supported data formats"),(0,o.kt)("p",null,"JSON and binary."),(0,o.kt)("h2",{id:"options"},"Options"),(0,o.kt)("h3",{id:"uni_grpc"},"uni_grpc"),(0,o.kt)("p",null,"Boolean, default: ",(0,o.kt)("inlineCode",{parentName:"p"},"false"),"."),(0,o.kt)("p",null,"Enables unidirectional GRPC endpoint."),(0,o.kt)("pre",null,(0,o.kt)("code",{parentName:"pre",className:"language-json",metastring:'title="config.json"',title:'"config.json"'},'{\n    ...\n    "uni_grpc": true\n}\n')),(0,o.kt)("h3",{id:"uni_grpc_port"},"uni_grpc_port"),(0,o.kt)("p",null,"String, default ",(0,o.kt)("inlineCode",{parentName:"p"},'"11000"'),"."),(0,o.kt)("p",null,"Port to listen on."),(0,o.kt)("h3",{id:"uni_grpc_address"},"uni_grpc_address"),(0,o.kt)("p",null,"String, default ",(0,o.kt)("inlineCode",{parentName:"p"},'""')," (listen on all interfaces)"),(0,o.kt)("p",null,"Address to bind uni GRPC to."),(0,o.kt)("h3",{id:"uni_grpc_max_receive_message_size"},"uni_grpc_max_receive_message_size"),(0,o.kt)("p",null,"Default: ",(0,o.kt)("inlineCode",{parentName:"p"},"65536")," (64KB)"),(0,o.kt)("p",null,"Maximum allowed size of a first connect message received from GRPC connection in bytes."),(0,o.kt)("h3",{id:"uni_grpc_tls"},"uni_grpc_tls"),(0,o.kt)("p",null,"Boolean, default: ",(0,o.kt)("inlineCode",{parentName:"p"},"false")),(0,o.kt)("p",null,"Enable custom TLS for unidirectional GRPC server."),(0,o.kt)("h3",{id:"uni_grpc_tls_cert"},"uni_grpc_tls_cert"),(0,o.kt)("p",null,"String, default: ",(0,o.kt)("inlineCode",{parentName:"p"},'""'),"."),(0,o.kt)("p",null,"Path to cert file."),(0,o.kt)("h3",{id:"uni_grpc_tls_key"},"uni_grpc_tls_key"),(0,o.kt)("p",null,"String, default: ",(0,o.kt)("inlineCode",{parentName:"p"},'""'),"."),(0,o.kt)("p",null,"Path to key file."),(0,o.kt)("h2",{id:"example"},"Example"),(0,o.kt)("p",null,"Coming soon."))}d.isMDXComponent=!0}}]);