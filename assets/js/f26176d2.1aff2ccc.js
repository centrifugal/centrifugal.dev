"use strict";(self.webpackChunkcentrifugal_dev=self.webpackChunkcentrifugal_dev||[]).push([[3468],{3335:(e,n,t)=>{t.r(n),t.d(n,{assets:()=>c,contentTitle:()=>r,default:()=>d,frontMatter:()=>s,metadata:()=>a,toc:()=>l});var o=t(85893),i=t(11151);const s={title:"Centrifugo integration with Django \u2013 building a basic chat application",tags:["centrifugo","tutorial","django"],description:"In this tutorial, we are integrating Django with Centrifugo to make a basic chat application. We are using Centrifugo proxy feature to proxy WebSocket connection events to a Django backend.",author:"Alexander Emelin",authorTitle:"Ex-Pythonista",authorImageURL:"https://github.com/FZambia.png",image:"/img/django_tutorial.jpg",hide_table_of_contents:!1},r=void 0,a={permalink:"/blog/2021/11/04/integrating-with-django-building-chat-application",editUrl:"https://github.com/centrifugal/centrifugal.dev/edit/main/blog/2021-11-04-integrating-with-django-building-chat-application.md",source:"@site/blog/2021-11-04-integrating-with-django-building-chat-application.md",title:"Centrifugo integration with Django \u2013 building a basic chat application",description:"In this tutorial, we are integrating Django with Centrifugo to make a basic chat application. We are using Centrifugo proxy feature to proxy WebSocket connection events to a Django backend.",date:"2021-11-04T00:00:00.000Z",tags:[{label:"centrifugo",permalink:"/blog/tags/centrifugo"},{label:"tutorial",permalink:"/blog/tags/tutorial"},{label:"django",permalink:"/blog/tags/django"}],readingTime:15.69,hasTruncateMarker:!0,authors:[{name:"Alexander Emelin",title:"Ex-Pythonista",imageURL:"https://github.com/FZambia.png"}],frontMatter:{title:"Centrifugo integration with Django \u2013 building a basic chat application",tags:["centrifugo","tutorial","django"],description:"In this tutorial, we are integrating Django with Centrifugo to make a basic chat application. We are using Centrifugo proxy feature to proxy WebSocket connection events to a Django backend.",author:"Alexander Emelin",authorTitle:"Ex-Pythonista",authorImageURL:"https://github.com/FZambia.png",image:"/img/django_tutorial.jpg",hide_table_of_contents:!1},unlisted:!1,prevItem:{title:"Building a multi-room chat application with Laravel and Centrifugo",permalink:"/blog/2021/12/14/laravel-multi-room-chat-tutorial"},nextItem:{title:"Centrifugo integration with NodeJS tutorial",permalink:"/blog/2021/10/18/integrating-with-nodejs"}},c={authorsImageUrls:[void 0]},l=[{value:"Why integrate Django with Centrifugo",id:"why-integrate-django-with-centrifugo",level:2},{value:"Prerequisites",id:"prerequisites",level:2},{value:"Creating a project",id:"creating-a-project",level:2},{value:"Creating the chat app",id:"creating-the-chat-app",level:2},{value:"Add the index view",id:"add-the-index-view",level:2},{value:"Add the room view",id:"add-the-room-view",level:2},{value:"Starting Centrifugo server",id:"starting-centrifugo-server",level:2},{value:"Adding Nginx",id:"adding-nginx",level:2},{value:"Implementing proxy handlers",id:"implementing-proxy-handlers",level:2},{value:"What could be improved",id:"what-could-be-improved",level:2},{value:"Tutorial source code with docker-compose",id:"tutorial-source-code-with-docker-compose",level:2},{value:"Conclusion",id:"conclusion",level:2}];function h(e){const n={a:"a",admonition:"admonition",code:"code",h2:"h2",img:"img",li:"li",ol:"ol",p:"p",pre:"pre",ul:"ul",...(0,i.a)(),...e.components};return(0,o.jsxs)(o.Fragment,{children:[(0,o.jsx)(n.p,{children:(0,o.jsx)(n.img,{alt:"Centrifuge",src:t(28995).Z+"",width:"1500",height:"500"})}),"\n",(0,o.jsxs)(n.p,{children:["In this tutorial, we will create a basic chat server using the ",(0,o.jsx)(n.a,{href:"https://www.djangoproject.com/",children:"Django framework"})," and ",(0,o.jsx)(n.a,{href:"https://centrifugal.dev/",children:"Centrifugo"}),". Our chat application will have two pages:"]}),"\n",(0,o.jsxs)(n.ol,{children:["\n",(0,o.jsx)(n.li,{children:"A page that lets you type the name of a chat room to join."}),"\n",(0,o.jsx)(n.li,{children:"A room view that lets you see messages posted in a chat room you joined."}),"\n"]}),"\n",(0,o.jsx)(n.p,{children:"The room view will use a WebSocket to communicate with the Django server (with help from Centrifugo) and listen for any messages that are published to the room channel."}),"\n",(0,o.jsx)(n.admonition,{type:"caution",children:(0,o.jsxs)(n.p,{children:["This tutorial was written for Centrifugo v3. We recently released ",(0,o.jsx)(n.a,{href:"/blog/2022/07/19/centrifugo-v4-released",children:"Centrifugo v4"})," which makes some parts of this tutorial obsolete. The core concepts are similar though \u2013 so this can still be used as a Centrifugo learning step."]})}),"\n",(0,o.jsx)(n.p,{children:"The result will look like this:"}),"\n",(0,o.jsx)(n.p,{children:(0,o.jsx)(n.img,{alt:"demo",src:t(25390).Z+"",width:"1280",height:"844"})}),"\n",(0,o.jsx)(n.admonition,{type:"tip",children:(0,o.jsxs)(n.p,{children:["Some of you will notice that this tutorial looks very similar to ",(0,o.jsx)(n.a,{href:"https://channels.readthedocs.io/en/stable/tutorial/index.html",children:"Chat app tutorial of Django Channels"}),". This is intentional to let Pythonistas already familiar with Django Channels feel how Centrifugo compares to Channels in terms of the integration process."]})}),"\n",(0,o.jsx)(n.h2,{id:"why-integrate-django-with-centrifugo",children:"Why integrate Django with Centrifugo"}),"\n",(0,o.jsx)(n.p,{children:"Why would Django developers want to integrate a project with Centrifugo for real-time messaging functionality? This is a good question especially since there is a popular Django Channels project which solves the same task."}),"\n",(0,o.jsx)(n.p,{children:"I found several points which could be a good motivation:"}),"\n",(0,o.jsxs)(n.ul,{children:["\n",(0,o.jsx)(n.li,{children:"Centrifugo is fast and scales well. We have an optimized Redis Engine with client-side sharding and Redis Cluster support. Centrifugo can also scale with KeyDB, Nats, or Tarantool. So it's possible to handle millions of connections distributed over different server nodes."}),"\n",(0,o.jsx)(n.li,{children:"Centrifugo provides a variety of features out-of-the-box \u2013 some of them are unique, especially for real-time servers that scale to many nodes. Check out our doc!"}),"\n",(0,o.jsx)(n.li,{children:"With Centrifugo you don't need to rewrite the existing application to introduce real-time messaging features to your users."}),"\n",(0,o.jsx)(n.li,{children:"Centrifugo works as a separate service \u2013 so can be a universal tool in the developer's pocket, can migrate from one project to another, no matter what programming language or framework is used for business logic."}),"\n"]}),"\n",(0,o.jsx)(n.h2,{id:"prerequisites",children:"Prerequisites"}),"\n",(0,o.jsxs)(n.p,{children:["We assume that you are already familiar with basic Django concepts. If not take a look at the official ",(0,o.jsx)(n.a,{href:"https://docs.djangoproject.com/en/stable/intro/tutorial01/",children:"Django tutorial"})," first and then come back to this tutorial."]}),"\n",(0,o.jsxs)(n.p,{children:["Also, make sure you read a bit about Centrifugo \u2013 ",(0,o.jsx)(n.a,{href:"https://centrifugal.dev/docs/getting-started/introduction",children:"introduction"})," and ",(0,o.jsx)(n.a,{href:"https://centrifugal.dev/docs/getting-started/quickstart",children:"quickstart tutorial"}),"."]}),"\n",(0,o.jsxs)(n.p,{children:["We also assume that you have ",(0,o.jsx)(n.a,{href:"https://docs.djangoproject.com/en/stable/intro/install/",children:"Django installed"})," already."]}),"\n",(0,o.jsx)(n.p,{children:"One possible way to quickly install Django locally is to create virtualenv, activate it, and install Django:"}),"\n",(0,o.jsx)(n.pre,{children:(0,o.jsx)(n.code,{className:"language-bash",children:"python3 -m venv env\n. env/bin/activate\npip install django\n"})}),"\n",(0,o.jsxs)(n.p,{children:["Alos, make sure you have Centrifugo v3 ",(0,o.jsx)(n.a,{href:"/docs/getting-started/installation",children:"installed"})," already."]}),"\n",(0,o.jsxs)(n.p,{children:["This tutorial also uses Docker to run Redis. We use Redis as a Centrifugo engine \u2013 this allows us to have a scalable solution in the end. Using Redis is optional actually, Centrifugo uses a Memory engine by default (but it does not allow scaling Centrifugo nodes). We will also run Nginx with Docker to serve the entire app. ",(0,o.jsx)(n.a,{href:"https://www.docker.com/get-started",children:"Install Docker"})," from its official website but I am sure you already have one."]}),"\n",(0,o.jsx)(n.h2,{id:"creating-a-project",children:"Creating a project"}),"\n",(0,o.jsx)(n.p,{children:"First, let's create a Django project."}),"\n",(0,o.jsxs)(n.p,{children:["From the command line, ",(0,o.jsx)(n.code,{children:"cd"})," into a directory where you\u2019d like to store your code, then run the following command:"]}),"\n",(0,o.jsx)(n.pre,{children:(0,o.jsx)(n.code,{className:"language-bash",children:"django-admin startproject mysite\n"})}),"\n",(0,o.jsx)(n.p,{children:"This will create a mysite directory in your current directory with the following contents:"}),"\n",(0,o.jsx)(n.pre,{children:(0,o.jsx)(n.code,{children:"\u276f tree mysite\nmysite\n\u251c\u2500\u2500 manage.py\n\u2514\u2500\u2500 mysite\n    \u251c\u2500\u2500 __init__.py\n    \u251c\u2500\u2500 asgi.py\n    \u251c\u2500\u2500 settings.py\n    \u251c\u2500\u2500 urls.py\n    \u2514\u2500\u2500 wsgi.py\n"})}),"\n",(0,o.jsx)(n.h2,{id:"creating-the-chat-app",children:"Creating the chat app"}),"\n",(0,o.jsxs)(n.p,{children:["We will put the code for the chat server inside ",(0,o.jsx)(n.code,{children:"chat"})," app."]}),"\n",(0,o.jsxs)(n.p,{children:["Make sure you\u2019re in the same directory as ",(0,o.jsx)(n.code,{children:"manage.py"})," and type this command:"]}),"\n",(0,o.jsx)(n.pre,{children:(0,o.jsx)(n.code,{className:"language-bash",children:"python3 manage.py startapp chat\n"})}),"\n",(0,o.jsx)(n.p,{children:"That\u2019ll create a directory chat, which is laid out like this:"}),"\n",(0,o.jsx)(n.pre,{children:(0,o.jsx)(n.code,{children:"\u276f tree chat\nchat\n\u251c\u2500\u2500 __init__.py\n\u251c\u2500\u2500 admin.py\n\u251c\u2500\u2500 apps.py\n\u251c\u2500\u2500 migrations\n\u2502   \u2514\u2500\u2500 __init__.py\n\u251c\u2500\u2500 models.py\n\u251c\u2500\u2500 tests.py\n\u2514\u2500\u2500 views.py\n"})}),"\n",(0,o.jsxs)(n.p,{children:["For this tutorial, we will only be working with ",(0,o.jsx)(n.code,{children:"chat/views.py"})," and ",(0,o.jsx)(n.code,{children:"chat/__init__.py"}),". Feel free to remove all other files from the chat directory."]}),"\n",(0,o.jsx)(n.p,{children:"After removing unnecessary files, the chat directory should look like this:"}),"\n",(0,o.jsx)(n.pre,{children:(0,o.jsx)(n.code,{children:"\u276f tree chat\nchat\n\u251c\u2500\u2500 __init__.py\n\u2514\u2500\u2500 views.py\n"})}),"\n",(0,o.jsxs)(n.p,{children:["We need to tell our project that the chat app is installed. Edit the ",(0,o.jsx)(n.code,{children:"mysite/settings.py"})," file and add 'chat' to the ",(0,o.jsx)(n.code,{children:"INSTALLED_APPS"})," setting. It\u2019ll look like this:"]}),"\n",(0,o.jsx)(n.pre,{children:(0,o.jsx)(n.code,{className:"language-python",children:"# mysite/settings.py\nINSTALLED_APPS = [\n    'chat',\n    'django.contrib.admin',\n    'django.contrib.auth',\n    'django.contrib.contenttypes',\n    'django.contrib.sessions',\n    'django.contrib.messages',\n    'django.contrib.staticfiles',\n]\n"})}),"\n",(0,o.jsx)(n.h2,{id:"add-the-index-view",children:"Add the index view"}),"\n",(0,o.jsx)(n.p,{children:"We will now create the first view, an index view that lets you type the name of a chat room to join."}),"\n",(0,o.jsxs)(n.p,{children:["Create a templates directory in your chat directory. Within the templates directory, you have just created, create another directory called ",(0,o.jsx)(n.code,{children:"chat"}),", and within that create a file called ",(0,o.jsx)(n.code,{children:"index.html"})," to hold the template for the index view."]}),"\n",(0,o.jsx)(n.p,{children:"Your chat directory should now look like this:"}),"\n",(0,o.jsx)(n.pre,{children:(0,o.jsx)(n.code,{children:"\u276f tree chat\nchat\n\u251c\u2500\u2500 __init__.py\n\u251c\u2500\u2500 templates\n\u2502   \u2514\u2500\u2500 chat\n\u2502       \u2514\u2500\u2500 index.html\n\u2514\u2500\u2500 views.py\n"})}),"\n",(0,o.jsx)(n.p,{children:"Put the following code in chat/templates/chat/index.html:"}),"\n",(0,o.jsx)(n.pre,{children:(0,o.jsx)(n.code,{className:"language-html",metastring:'title="chat/templates/chat/index.html"',children:'<!DOCTYPE html>\n<html>\n\n<head>\n    <meta charset="utf-8" />\n    <title>Select a chat room</title>\n</head>\n\n<body>\n    <div class="center">\n        <div class="input-wrapper">\n            <input type="text" id="room-name-input" />\n        </div>\n        <div class="input-help">\n            Type a room name to <a id="room-name-submit" href="#">JOIN</a>\n        </div>\n    </div>\n    <script>\n        const nameInput = document.querySelector(\'#room-name-input\');\n        const nameSubmit = document.querySelector(\'#room-name-submit\');\n        nameInput.focus();\n        nameInput.onkeyup = function (e) {\n            if (e.keyCode === 13) {  // enter, return\n                nameSubmit.click();\n            }\n        };\n        nameSubmit.onclick = function (e) {\n            e.preventDefault();\n            var roomName = nameInput.value;\n            if (!roomName) {\n                return;\n            }\n            window.location.pathname = \'/chat/room/\' + roomName + \'/\';\n        };\n    <\/script>\n</body>\n\n</html>\n'})}),"\n",(0,o.jsxs)(n.p,{children:["Create the view function for the room view. Put the following code in ",(0,o.jsx)(n.code,{children:"chat/views.py"}),":"]}),"\n",(0,o.jsx)(n.pre,{children:(0,o.jsx)(n.code,{className:"language-python",metastring:'title="chat/views.py"',children:"from django.shortcuts import render\n\ndef index(request):\n    return render(request, 'chat/index.html')\n"})}),"\n",(0,o.jsx)(n.p,{children:"To call the view, we need to map it to a URL - and for this, we need a URLconf."}),"\n",(0,o.jsxs)(n.p,{children:["To create a URLconf in the chat directory, create a file called ",(0,o.jsx)(n.code,{children:"urls.py"}),". Your app directory should now look like this:"]}),"\n",(0,o.jsx)(n.pre,{children:(0,o.jsx)(n.code,{children:"\u276f tree chat\nchat\n\u251c\u2500\u2500 __init__.py\n\u251c\u2500\u2500 templates\n\u2502   \u2514\u2500\u2500 chat\n\u2502       \u2514\u2500\u2500 index.html\n\u2514\u2500\u2500 views.py\n\u2514\u2500\u2500 urls.py\n"})}),"\n",(0,o.jsxs)(n.p,{children:["In the ",(0,o.jsx)(n.code,{children:"chat/urls.py"})," file include the following code:"]}),"\n",(0,o.jsx)(n.pre,{children:(0,o.jsx)(n.code,{className:"language-python",metastring:'title="chat/urls.py"',children:"from django.urls import path\n\nfrom . import views\n\nurlpatterns = [\n    path('', views.index, name='index'),\n]\n"})}),"\n",(0,o.jsxs)(n.p,{children:["The next step is to point the root URLconf at the ",(0,o.jsx)(n.code,{children:"chat.urls"})," module. In ",(0,o.jsx)(n.code,{children:"mysite/urls.py"}),", add an import for ",(0,o.jsx)(n.code,{children:"django.conf.urls.include"})," and insert an include() in the urlpatterns list, so you have:"]}),"\n",(0,o.jsx)(n.pre,{children:(0,o.jsx)(n.code,{className:"language-python",metastring:'title="mysite/urls.py"',children:"from django.conf.urls import include\nfrom django.urls import path\nfrom django.contrib import admin\n\nurlpatterns = [\n    path('chat/', include('chat.urls')),\n    path('admin/', admin.site.urls),\n]\n"})}),"\n",(0,o.jsx)(n.p,{children:"Let\u2019s verify that the index view works. Run the following command:"}),"\n",(0,o.jsx)(n.pre,{children:(0,o.jsx)(n.code,{className:"language-bash",children:"python3 manage.py runserver\n"})}),"\n",(0,o.jsx)(n.p,{children:"You\u2019ll see the following output on the command line:"}),"\n",(0,o.jsx)(n.pre,{children:(0,o.jsx)(n.code,{children:"Watching for file changes with StatReloader\nPerforming system checks...\n\nSystem check identified no issues (0 silenced).\n\nYou have 18 unapplied migration(s). Your project may not work properly until you apply the migrations for app(s): admin, auth, contenttypes, sessions.\nRun 'python manage.py migrate' to apply them.\nOctober 21, 2020 - 18:49:39\nDjango version 3.1.2, using settings 'mysite.settings'\nStarting development server at http://localhost:8000/\nQuit the server with CONTROL-C.\n"})}),"\n",(0,o.jsxs)(n.p,{children:["Go to ",(0,o.jsx)(n.a,{href:"http://localhost:8000/chat/",children:"http://localhost:8000/chat/"})," in your browser and you should see the a text input to provide a room name."]}),"\n",(0,o.jsxs)(n.p,{children:['Type in "lobby" as the room name and press Enter. You should be redirected to the room view at ',(0,o.jsx)(n.a,{href:"http://localhost:8000/chat/room/lobby/",children:"http://localhost:8000/chat/room/lobby/"}),' but we haven\u2019t written the room view yet, so you\u2019ll get a "Page not found" error page.']}),"\n",(0,o.jsx)(n.p,{children:"Go to the terminal where you ran the runserver command and press Control-C to stop the server."}),"\n",(0,o.jsx)(n.h2,{id:"add-the-room-view",children:"Add the room view"}),"\n",(0,o.jsx)(n.p,{children:"We will now create the second view, a room view that lets you see messages posted in a particular chat room."}),"\n",(0,o.jsxs)(n.p,{children:["Create a new file ",(0,o.jsx)(n.code,{children:"chat/templates/chat/room.html"}),". Your app directory should now look like this:"]}),"\n",(0,o.jsx)(n.pre,{children:(0,o.jsx)(n.code,{children:"chat\n\u251c\u2500\u2500 __init__.py\n\u251c\u2500\u2500 templates\n\u2502   \u2514\u2500\u2500 chat\n\u2502       \u251c\u2500\u2500 index.html\n\u2502       \u2514\u2500\u2500 room.html\n\u251c\u2500\u2500 urls.py\n\u2514\u2500\u2500 views.py\n"})}),"\n",(0,o.jsxs)(n.p,{children:["Create the view template for the room view in ",(0,o.jsx)(n.code,{children:"chat/templates/chat/room.html"}),":"]}),"\n",(0,o.jsx)(n.pre,{children:(0,o.jsx)(n.code,{className:"language-html",metastring:'title="chat/templates/chat/room.html"',children:'<!DOCTYPE html>\n<html>\n\n<head>\n    <meta charset="utf-8" />\n    <title>Chat Room</title>\n    <script src="https://cdn.jsdelivr.net/gh/centrifugal/centrifuge-js@2.8.3/dist/centrifuge.min.js"><\/script>\n</head>\n\n<body>\n    <ul id="chat-thread" class="chat-thread"></ul>\n    <div class="chat-message">\n        <input id="chat-message-input" class="chat-message-input" type="text" autocomplete="off" autofocus />\n    </div>\n    {{ room_name|json_script:"room-name" }}\n    <script>\n        const roomName = JSON.parse(document.getElementById(\'room-name\').textContent);\n        const chatThread = document.querySelector(\'#chat-thread\');\n        const messageInput = document.querySelector(\'#chat-message-input\');\n\n        const centrifuge = new Centrifuge("ws://" + window.location.host + "/connection/websocket");\n\n        centrifuge.on(\'connect\', function (ctx) {\n            console.log("connected", ctx);\n        });\n\n        centrifuge.on(\'disconnect\', function (ctx) {\n            console.log("disconnected", ctx);\n        });\n\n        const sub = centrifuge.subscribe(\'rooms:\' + roomName, function (ctx) {\n            const chatNewThread = document.createElement(\'li\');\n            const chatNewMessage = document.createTextNode(ctx.data.message);\n            chatNewThread.appendChild(chatNewMessage);\n            chatThread.appendChild(chatNewThread);\n            chatThread.scrollTop = chatThread.scrollHeight;\n        });\n\n        centrifuge.connect();\n\n        messageInput.focus();\n        messageInput.onkeyup = function (e) {\n            if (e.keyCode === 13) {  // enter, return\n                e.preventDefault();\n                const message = messageInput.value;\n                if (!message) {\n                    return;\n                }\n                sub.publish({ \'message\': message });\n                messageInput.value = \'\';\n            }\n        };\n    <\/script>\n</body>\n\n</html>\n'})}),"\n",(0,o.jsxs)(n.p,{children:["Create the view function for the room view in ",(0,o.jsx)(n.code,{children:"chat/views.py"}),":"]}),"\n",(0,o.jsx)(n.pre,{children:(0,o.jsx)(n.code,{className:"language-python",metastring:'title="chat/views.py"',children:"from django.shortcuts import render\n\n\ndef index(request):\n    return render(request, 'chat/index.html')\n\n\ndef room(request, room_name):\n    return render(request, 'chat/room.html', {\n        'room_name': room_name\n    })\n"})}),"\n",(0,o.jsxs)(n.p,{children:["Create the route for the room view in ",(0,o.jsx)(n.code,{children:"chat/urls.py"}),":"]}),"\n",(0,o.jsx)(n.pre,{children:(0,o.jsx)(n.code,{className:"language-python",children:"# chat/urls.py\nfrom django.urls import path, re_path\n\nfrom . import views\n\nurlpatterns = [\n    path('', views.index, name='index'),\n    re_path('room/(?P<room_name>[A-z0-9_-]+)/', views.room, name='room'),\n]\n"})}),"\n",(0,o.jsx)(n.p,{children:"Start the development server:"}),"\n",(0,o.jsx)(n.pre,{children:(0,o.jsx)(n.code,{children:"python3 manage.py runserver\n"})}),"\n",(0,o.jsxs)(n.p,{children:["Go to ",(0,o.jsx)(n.a,{href:"http://localhost:8000/chat/",children:"http://localhost:8000/chat/"})," in your browser and to see the index page."]}),"\n",(0,o.jsxs)(n.p,{children:['Type in "lobby" as the room name and press enter. You should be redirected to the room page at ',(0,o.jsx)(n.a,{href:"http://localhost:8000/chat/lobby/",children:"http://localhost:8000/chat/lobby/"})," which now displays an empty chat log."]}),"\n",(0,o.jsx)(n.p,{children:'Type the message "hello" and press Enter. Nothing happens! In particular, the message does not appear in the chat log. Why?'}),"\n",(0,o.jsxs)(n.p,{children:["The room view is trying to open a WebSocket connection with Centrifugo using the URL ",(0,o.jsx)(n.code,{children:"ws://localhost:8000/connection/websocket"})," but we haven\u2019t started Centrifugo to accept WebSocket connections yet. If you open your browser\u2019s JavaScript console, you should see an error that looks like this:"]}),"\n",(0,o.jsx)(n.pre,{children:(0,o.jsx)(n.code,{children:"WebSocket connection to 'ws://localhost:8000/connection/websocket' failed\n"})}),"\n",(0,o.jsx)(n.p,{children:"And since port 8000 has already been allocated we will start Centrifugo at a different port actually."}),"\n",(0,o.jsx)(n.h2,{id:"starting-centrifugo-server",children:"Starting Centrifugo server"}),"\n",(0,o.jsx)(n.p,{children:"As promised we will use Centrifugo with Redis engine. So first thing to do before running Centrifugo is to start Redis:"}),"\n",(0,o.jsx)(n.pre,{children:(0,o.jsx)(n.code,{className:"language-bash",children:"docker run -it --rm -p 6379:6379 redis:6\n"})}),"\n",(0,o.jsx)(n.p,{children:"Then create a configuration file for Centrifugo:"}),"\n",(0,o.jsx)(n.pre,{children:(0,o.jsx)(n.code,{className:"language-json",children:'{\n    "port": 8001,\n    "engine": "redis",\n    "redis_address": "redis://localhost:6379",\n    "allowed_origins": "http://localhost:9000",\n    "proxy_connect_endpoint": "http://localhost:8000/chat/centrifugo/connect/",\n    "proxy_publish_endpoint": "http://localhost:8000/chat/centrifugo/publish/",\n    "proxy_subscribe_endpoint": "http://localhost:8000/chat/centrifugo/subscribe/",\n    "proxy_http_headers": ["Cookie"],\n    "namespaces": [\n        {\n            "name": "rooms",\n            "publish": true,\n            "proxy_publish": true,\n            "proxy_subscribe": true\n        }\n    ]\n}\n'})}),"\n",(0,o.jsx)(n.p,{children:"And run Centrifugo with it like this:"}),"\n",(0,o.jsx)(n.pre,{children:(0,o.jsx)(n.code,{className:"language-bash",children:"centrifugo -c config.json\n"})}),"\n",(0,o.jsx)(n.p,{children:"Let's describe some options we used here:"}),"\n",(0,o.jsxs)(n.ul,{children:["\n",(0,o.jsxs)(n.li,{children:[(0,o.jsx)(n.code,{children:"port"})," - sets the port Centrifugo runs on since we are running everything on localhost we make it different (8001) from the port allocated for the Django server (8000)."]}),"\n",(0,o.jsxs)(n.li,{children:[(0,o.jsx)(n.code,{children:"engine"})," - as promised we are using Redis engine so we can easily scale Centrifigo nodes to handle lots of WebSocket connections"]}),"\n",(0,o.jsxs)(n.li,{children:[(0,o.jsx)(n.code,{children:"redis_address"})," allows setting Redis address"]}),"\n",(0,o.jsxs)(n.li,{children:[(0,o.jsx)(n.code,{children:"allowed_origins"})," - we will connect from ",(0,o.jsx)(n.code,{children:"http://localhost:9000"})," so we need to allow it"]}),"\n",(0,o.jsxs)(n.li,{children:[(0,o.jsx)(n.code,{children:"namespaces"})," \u2013 we are using ",(0,o.jsx)(n.code,{children:"rooms:"})," prefix when subscribing to a channel, i.e. using Centrifugo ",(0,o.jsx)(n.code,{children:"rooms"})," namespace. Here we define this namespace and tell Centrifigo to proxy subscribe and publish events for channels in the namespace."]}),"\n"]}),"\n",(0,o.jsx)(n.admonition,{type:"tip",children:(0,o.jsx)(n.p,{children:"It's a good practice to use different namespaces in Centrifugo for different real-time features as this allows enabling only required options for a specific task."})}),"\n",(0,o.jsxs)(n.p,{children:["Also, config has some options related to ",(0,o.jsx)(n.a,{href:"/docs/server/proxy",children:"Centrifugo proxy feature"}),". This feature allows proxying WebSocket events to the configured endpoints. We will proxy three types of events:"]}),"\n",(0,o.jsxs)(n.ol,{children:["\n",(0,o.jsx)(n.li,{children:"Connect (called when a user establishes WebSocket connection with Centrifugo)"}),"\n",(0,o.jsx)(n.li,{children:"Subscribe (called when a user wants to subscribe on a channel)"}),"\n",(0,o.jsx)(n.li,{children:"Publish (called when a user tries to publish data to a channel)"}),"\n"]}),"\n",(0,o.jsx)(n.h2,{id:"adding-nginx",children:"Adding Nginx"}),"\n",(0,o.jsxs)(n.p,{children:["In Centrifugo config we set endpoints which we will soon implement inside our Django app. You may notice that the allowed origin has a URL with port ",(0,o.jsx)(n.code,{children:"9000"}),". That's because we want to proxy Cookie headers from a persistent connection established with Centrifugo to the Django app and need Centrifugo and Django to share the same origin (so browsers can send Django session cookies to Centrifugo)."]}),"\n",(0,o.jsxs)(n.p,{children:["While not used in this tutorial (we will use fake ",(0,o.jsx)(n.code,{children:"tutorial-user"})," as user ID here) \u2013 this can be useful if you decide to authenticate connections using Django native sessions framework later. To achieve this we should also add Nginx with a configuration like this:"]}),"\n",(0,o.jsx)(n.pre,{children:(0,o.jsx)(n.code,{className:"language-text",metastring:'title="nginx.conf"',children:"events {\n    worker_connections 1024;\n}\n\nerror_log /dev/stdout info;\n\nhttp {\n    access_log /dev/stdout;\n\n    server {\n        listen 9000;\n\n        server_name localhost;\n\n        location / {\n            proxy_pass http://host.docker.internal:8000;\n            proxy_http_version 1.1;\n            proxy_set_header Host $host;\n            proxy_set_header X-Real-IP $remote_addr;\n            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;\n            proxy_set_header X-Forwarded-Proto $scheme;\n        }\n\n        location /connection/websocket {\n            proxy_pass http://host.docker.internal:8001;\n            proxy_http_version 1.1;\n            proxy_buffering off;\n            keepalive_timeout 65;\n            proxy_read_timeout 60s;\n            proxy_set_header Upgrade $http_upgrade;\n            proxy_set_header Connection 'upgrade';\n            proxy_set_header Host $host;\n            proxy_set_header X-Real-IP $remote_addr;\n            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;\n            proxy_set_header X-Forwarded-Proto $scheme;\n            proxy_cache_bypass $http_upgrade;\n        }\n    }\n}\n"})}),"\n",(0,o.jsxs)(n.p,{children:["Start Nginx (replace the path to ",(0,o.jsx)(n.code,{children:"nginx.conf"})," to yours):"]}),"\n",(0,o.jsx)(n.pre,{children:(0,o.jsx)(n.code,{className:"language-bash",children:"docker run -it --rm -v /path/to/nginx.conf:/etc/nginx/nginx.conf:ro -p 9000:9000 --add-host=host.docker.internal:host-gateway nginx\n"})}),"\n",(0,o.jsxs)(n.p,{children:["Note that we are exposing port 9000 to localhost and use a possibility to use ",(0,o.jsx)(n.code,{children:"host.docker.internal"})," host to communicate from inside Docker network with services which are running on localhost (on the host machine). See ",(0,o.jsx)(n.a,{href:"https://stackoverflow.com/questions/31324981/how-to-access-host-port-from-docker-container",children:"this answer on SO"}),"."]}),"\n",(0,o.jsxs)(n.p,{children:["Open ",(0,o.jsx)(n.a,{href:"http://localhost:9000",children:"http://localhost:9000"}),". Nginx should now properly proxy requests to Django server and to Centrifugo, but we still need to do some things."]}),"\n",(0,o.jsx)(n.h2,{id:"implementing-proxy-handlers",children:"Implementing proxy handlers"}),"\n",(0,o.jsx)(n.p,{children:"Well, now if you try to open a chat page with Nginx, Centrifugo, Django, and Redis running you will notice some errors in Centrifugo logs. That's because Centrifugo tries to proxy WebSocket connect events to Django to authenticate them but we have not created event handlers in Django yet. Let's fix this."}),"\n",(0,o.jsx)(n.p,{children:"Extend chat/urls.py:"}),"\n",(0,o.jsx)(n.pre,{children:(0,o.jsx)(n.code,{className:"language-python",metastring:'title="chat/urls.py"',children:"from django.urls import path, re_path\n\nfrom . import views\n\nurlpatterns = [\n    path('', views.index, name='index'),\n    re_path('room/(?P<room_name>[A-z0-9_-]+)/', views.room, name='room'),\n    path('centrifugo/connect/', views.connect, name='connect'),\n    path('centrifugo/subscribe/', views.subscribe, name='subscribe'),\n    path('centrifugo/publish/', views.publish, name='publish'),\n]\n"})}),"\n",(0,o.jsx)(n.p,{children:"Extend chat/views.py:"}),"\n",(0,o.jsx)(n.pre,{children:(0,o.jsx)(n.code,{className:"language-python",metastring:'title="chat/views.py"',children:"from django.http import JsonResponse\nfrom django.views.decorators.csrf import csrf_exempt\n\n@csrf_exempt\ndef connect(request):\n    # In connect handler we must authenticate connection.\n    # Here we return a fake user ID to Centrifugo to keep tutorial short.\n    # More details about connect result format can be found in proxy docs:\n    # https://centrifugal.dev/docs/server/proxy#connect-proxy\n    logger.debug(request.body)\n    response = {\n        'result': {\n            'user': 'tutorial-user'\n        }\n    }\n    return JsonResponse(response)\n\n@csrf_exempt\ndef publish(request):\n    # In publish handler we can validate publication request initialted by a user.\n    # Here we return an empty object \u2013 thus allowing publication.\n    # More details about publish result format can be found in proxy docs:\n    # https://centrifugal.dev/docs/server/proxy#publish-proxy\n    response = {\n        'result': {}\n    }\n    return JsonResponse(response)\n\n@csrf_exempt\ndef subscribe(request):\n    # In subscribe handler we can validate user subscription request to a channel.\n    # Here we return an empty object \u2013 thus allowing subscription.\n    # More details about subscribe result format can be found in proxy docs:\n    # https://centrifugal.dev/docs/server/proxy#subscribe-proxy\n    response = {\n        'result': {}\n    }\n    return JsonResponse(response)        \n"})}),"\n",(0,o.jsxs)(n.p,{children:[(0,o.jsx)(n.code,{children:"connect"})," view will accept all connections and return user ID as ",(0,o.jsx)(n.code,{children:"tutorial-user"}),". In real app you most probably want to use Django sessions and return real authenticated user ID instead of ",(0,o.jsx)(n.code,{children:"tutorial-user"}),". Since we told Centrifugo to proxy connection ",(0,o.jsx)(n.code,{children:"Cookie"})," headers native Django user authentication will work just fine."]}),"\n",(0,o.jsxs)(n.p,{children:["Restart Django and try the chat app again. You should now successfully connect. Open a browser tab to the room page at ",(0,o.jsx)(n.a,{href:"http://localhost:9000/chat/room/lobby/",children:"http://localhost:9000/chat/room/lobby/"}),". Open a second browser tab to the same room page."]}),"\n",(0,o.jsx)(n.p,{children:'In the second browser tab, type the message "hello" and press Enter. You should now see "hello" echoed in the chat log in both the second browser tab and in the first browser tab.'}),"\n",(0,o.jsx)(n.p,{children:"You now have a basic fully-functional chat server!"}),"\n",(0,o.jsx)(n.h2,{id:"what-could-be-improved",children:"What could be improved"}),"\n",(0,o.jsx)(n.p,{children:"The list is large, but it's fun to do. To name some possible improvements:"}),"\n",(0,o.jsxs)(n.ul,{children:["\n",(0,o.jsxs)(n.li,{children:["Replace ",(0,o.jsx)(n.code,{children:"tutorial-user"})," used here with native Django session framework. We already proxying the ",(0,o.jsx)(n.code,{children:"Cookie"})," header to Django from Centrifugo, so you can reuse native Django authentication. Only allow authenticated users to join rooms."]}),"\n",(0,o.jsxs)(n.li,{children:["Create ",(0,o.jsx)(n.code,{children:"Room"})," model and add users to it \u2013 thus you will be able to check permissions inside subscribe and publish handlers."]}),"\n",(0,o.jsxs)(n.li,{children:["Create ",(0,o.jsx)(n.code,{children:"Message"})," model to display chat history in ",(0,o.jsx)(n.code,{children:"Room"}),"."]}),"\n",(0,o.jsxs)(n.li,{children:["Replace Django devserver with something more suitable for production like ",(0,o.jsx)(n.a,{href:"https://gunicorn.org/",children:"Gunicorn"}),"."]}),"\n",(0,o.jsx)(n.li,{children:"Check out Centrifugo possibilities like presence to display online users."}),"\n",(0,o.jsxs)(n.li,{children:["Use ",(0,o.jsx)(n.a,{href:"https://github.com/centrifugal/cent",children:"cent"})," Centrifugo HTTP API library to publish something to a user on behalf of a server. In this case you can avoid using publish proxy, publish messages to Django over convinient AJAX call - and then call Centrifugo HTTP API to publish message into a channel."]}),"\n",(0,o.jsxs)(n.li,{children:["You can replace connect proxy (which is an HTTP call from Centrifugo to Django on each connect) with JWT authentication. JWT authentication may result in a better application performance (since no additional proxy requests will be issued on connect). It can allow your Django app to handle millions of users on a reasonably small hardware and survive mass reconnects from all those users. More details can be found in ",(0,o.jsx)(n.a,{href:"https://centrifugal.dev/blog/2020/11/12/scaling-websocket",children:"Scaling WebSocket in Go and beyond"})," blog post."]}),"\n",(0,o.jsxs)(n.li,{children:["Instead of using subscribe proxy you can put channel into connect proxy result or into JWT \u2013 thus using ",(0,o.jsx)(n.a,{href:"/docs/server/server_subs",children:"server-side subscriptions"})," and avoid subscribe proxy HTTP call."]}),"\n"]}),"\n",(0,o.jsxs)(n.p,{children:["One more thing I'd like to note is that if you aim to build a chat application like WhatsApp or Telegram where you have a screen with list of chats (which can be pretty long!) you should not create a separate channel for each room. In this case using separate channel per room does not scale well and you better use personal channel for each user to receive all user-related messages. And as soon as message published to a chat you can send message to each participant's channel. In this case, take a look at Centrifugo ",(0,o.jsx)(n.a,{href:"/docs/server/server_api#broadcast",children:"broadcast API"}),"."]}),"\n",(0,o.jsx)(n.h2,{id:"tutorial-source-code-with-docker-compose",children:"Tutorial source code with docker-compose"}),"\n",(0,o.jsxs)(n.p,{children:["The full example which can run by issuing a single ",(0,o.jsx)(n.code,{children:"docker compose up"})," ",(0,o.jsx)(n.a,{href:"https://github.com/centrifugal/examples/tree/master/v3/python_django_chat_tutorial",children:"can be found on Github"}),". It also has some CSS styles so that the chat looks like shown in the beginning."]}),"\n",(0,o.jsx)(n.h2,{id:"conclusion",children:"Conclusion"}),"\n",(0,o.jsx)(n.p,{children:"Here we implemented a basic chat app with Django and Centrifugo."}),"\n",(0,o.jsx)(n.p,{children:"While a chat still requires work to be suitable for production this example can help understand core concepts of Centrifugo - specifically channel namespaces and proxy features."}),"\n",(0,o.jsxs)(n.p,{children:["It's possible to use unidirectional Centrifugo transports instead of bidirectional WebSocket used here \u2013 in this case, you can go without using ",(0,o.jsx)(n.code,{children:"centrifuge-js"})," at all."]}),"\n",(0,o.jsx)(n.p,{children:"Centrifugo scales perfectly if you need to handle more connections \u2013 thanks to Centrifugo built-in PUB/SUB engines."}),"\n",(0,o.jsx)(n.p,{children:"It's also possible to use server-side subscriptions, keep channel history cache, use JWT authentication instead of connect proxy, enable channel presence, and more. All the power of Centrifugo is in your hands."}),"\n",(0,o.jsx)(n.p,{children:"Hope you enjoyed this tutorial. And let the Centrifugal force be with you!"}),"\n",(0,o.jsxs)(n.p,{children:["Join our ",(0,o.jsx)(n.a,{href:"/docs/getting-started/introduction#join-community",children:"community channels"})," in case of any questions left after reading this."]})]})}function d(e={}){const{wrapper:n}={...(0,i.a)(),...e.components};return n?(0,o.jsx)(n,{...e,children:(0,o.jsx)(h,{...e})}):h(e)}},25390:(e,n,t)=>{t.d(n,{Z:()=>o});const o=t.p+"assets/images/django_chat-9972126f452363132e76a62f00213fbf.gif"},28995:(e,n,t)=>{t.d(n,{Z:()=>o});const o=t.p+"assets/images/django_tutorial-e63ff6b91f9433091f3819a9b51758e0.jpg"},11151:(e,n,t)=>{t.d(n,{Z:()=>a,a:()=>r});var o=t(67294);const i={},s=o.createContext(i);function r(e){const n=o.useContext(s);return o.useMemo((function(){return"function"==typeof e?e(n):{...n,...e}}),[n,e])}function a(e){let n;return n=e.disableParentContext?"function"==typeof e.components?e.components(i):e.components||i:r(e.components),o.createElement(s.Provider,{value:n},e.children)}}}]);