"use strict";(self.webpackChunkcentrifugal_dev=self.webpackChunkcentrifugal_dev||[]).push([[8695],{36392:(e,n,t)=>{t.r(n),t.d(n,{assets:()=>c,contentTitle:()=>i,default:()=>h,frontMatter:()=>s,metadata:()=>r,toc:()=>l});var o=t(85893),a=t(11151);const s={id:"outbox_cdc",sidebar_label:"Broadcast: outbox and CDC",title:"Broadcast using transactional outbox and CDC"},i=void 0,r={id:"tutorial/outbox_cdc",title:"Broadcast using transactional outbox and CDC",description:"Some of you may notice one potential issue which could prevent event delivery to users when publishing messages to Centrifugo API. Since we do this after a transaction and via a network call (in our case, using HTTP), it means the broadcast API call may return an error.",source:"@site/docs/tutorial/outbox_cdc.md",sourceDirName:"tutorial",slug:"/tutorial/outbox_cdc",permalink:"/docs/tutorial/outbox_cdc",draft:!1,unlisted:!1,editUrl:"https://github.com/centrifugal/centrifugal.dev/edit/main/docs/tutorial/outbox_cdc.md",tags:[],version:"current",frontMatter:{id:"outbox_cdc",sidebar_label:"Broadcast: outbox and CDC",title:"Broadcast using transactional outbox and CDC"},sidebar:"Tutorial",previous:{title:"Missed messages recovery",permalink:"/docs/tutorial/recovery"},next:{title:"Scale to 100k room members",permalink:"/docs/tutorial/scale"}},c={},l=[{value:"Transactional outbox for publishing events",id:"transactional-outbox-for-publishing-events",level:2},{value:"Using Kafka Connect for CDC",id:"using-kafka-connect-for-cdc",level:2},{value:"Solving CDC latency",id:"solving-cdc-latency",level:2}];function d(e){const n={a:"a",code:"code",h2:"h2",li:"li",p:"p",pre:"pre",ul:"ul",...(0,a.a)(),...e.components};return(0,o.jsxs)(o.Fragment,{children:[(0,o.jsx)(n.p,{children:"Some of you may notice one potential issue which could prevent event delivery to users when publishing messages to Centrifugo API. Since we do this after a transaction and via a network call (in our case, using HTTP), it means the broadcast API call may return an error."}),"\n",(0,o.jsx)(n.p,{children:"There are real-time applications that can tolerate the loss of real-time messages. In normal conditions, the number of such errors should be small, and in most cases, they can be addressed by adding retries. Moreover, publishing directly over the Centrifugo API usually allows achieving the best delivery latency."}),"\n",(0,o.jsx)(n.p,{children:"But what if you don't want to think about retries and consider message loss unacceptable at this stage? Here, we will demonstrate how to broadcast in a different way \u2014 asynchronously and transactionally."}),"\n",(0,o.jsx)(n.h2,{id:"transactional-outbox-for-publishing-events",children:"Transactional outbox for publishing events"}),"\n",(0,o.jsxs)(n.p,{children:["The first approach involves using the ",(0,o.jsx)(n.a,{href:"https://microservices.io/patterns/data/transactional-outbox.html",children:"Transactional outbox"})," pattern. When you make database changes, you open a transaction, make the required changes, and write an event into a special outbox table. This event will be written to the outbox table only if the transaction is successfully committed. Then, a separate process reads the outbox table and sends events to the external system \u2014 in our case, to Centrifugo."]}),"\n",(0,o.jsxs)(n.p,{children:["You can implement this approach yourself to publish events to Centrifugo. However, here we will showcase Centrifugo's built-in feature to ",(0,o.jsx)(n.a,{href:"/docs/server/consumers#postgresql-outbox-consumer",children:"consume the PostgreSQL outbox table"}),"."]}),"\n",(0,o.jsx)(n.p,{children:"All you need to do is create an outbox table in a predefined format (expected by Centrifugo) and point Centrifugo to it."}),"\n",(0,o.jsx)(n.p,{children:"Moreover, to reduce the latency of outbox processing, Centrifugo supports parallel processing of the outbox table using a configured partition number. Additionally, Centrifugo can be configured to use the PostgreSQL LISTEN/NOTIFY mechanism, significantly reducing the latency of event processing."}),"\n",(0,o.jsxs)(n.p,{children:["First of all, let's create the Outbox model inside ",(0,o.jsx)(n.code,{children:"chat"})," Django app which describes the required outbox table:"]}),"\n",(0,o.jsx)(n.pre,{children:(0,o.jsx)(n.code,{className:"language-python",children:'class Outbox(models.Model):\n    method = models.TextField(default="publish")\n    payload = models.JSONField()\n    partition = models.BigIntegerField(default=0)\n    created_at = models.DateTimeField(auto_now_add=True)\n'})}),"\n",(0,o.jsx)(n.p,{children:"And make migrations to create it in PostgreSQL:"}),"\n",(0,o.jsx)(n.pre,{children:(0,o.jsx)(n.code,{className:"language-bash",children:"docker compose exec backend python manage.py makemigrations\ndocker compose exec backend python manage.py migrate\n"})}),"\n",(0,o.jsx)(n.p,{children:"Now, instead of using Centrifugo HTTP API after successful commit, you can create Outbox instance with the required broadcast method and payload:"}),"\n",(0,o.jsx)(n.pre,{children:(0,o.jsx)(n.code,{className:"language-python",children:"# In outbox case we can set partition for parallel processing, but\n# it must be in predefined range and match Centrifugo PostgreSQL\n# consumer configuration.\npartition = hash(room_id)%settings.CENTRIFUGO_OUTBOX_PARTITIONS\n# Creating outbox object inside transaction will guarantee that Centrifugo will\n# process the command at some point. In normal conditions \u2013 almost instantly.\nOutbox.objects.create(method='broadcast', payload=broadcast_payload, partition=partition)\n"})}),"\n",(0,o.jsx)(n.p,{children:"Also, add the following to Centrifugo configuration:"}),"\n",(0,o.jsx)(n.pre,{children:(0,o.jsx)(n.code,{className:"language-json",children:'{\n  ...\n  "consumers": [\n    {\n      "name": "postgresql",\n      "type": "postgresql",\n      "postgresql": {\n        "dsn": "postgresql://grandchat:grandchat@db:5432/grandchat",\n        "outbox_table_name": "chat_outbox",\n        "num_partitions": 1,\n        "partition_select_limit": 100,\n        "partition_poll_interval": "300ms",\n        "partition_notification_channel": "centrifugo_partition_change"\n      }\n    }\n  ]\n}\n'})}),"\n",(0,o.jsx)(n.p,{children:"That's it! Now if you save some model and write an event to outbox table insde transaction \u2013 you don't need to worry - an event will be delivered to Centrifugo."}),"\n",(0,o.jsxs)(n.p,{children:["But, if you take a look at the configuration above you will see it has option ",(0,o.jsx)(n.code,{children:'"partition_poll_interval": "300ms"'}),". This means the outbox approach may add delay for the real-time message. It's possible to reduce this polling interval \u2013 but this would mean increasing number of queries to PostgreSQL database. We can do slightly better."]}),"\n",(0,o.jsx)(n.p,{children:"Centrifugo supports LISTEN/NOTIFY mechanism of PostgreSQL to be notified about new data in the outbox table. To enable it you need first create a trigger in PostgreSQL:"}),"\n",(0,o.jsx)(n.pre,{children:(0,o.jsx)(n.code,{className:"language-sql",children:"CREATE OR REPLACE FUNCTION centrifugo_notify_partition_change()\nRETURNS TRIGGER AS $$\nBEGIN\n    PERFORM pg_notify('centrifugo_partition_change', NEW.partition::text);\n    RETURN NEW;\nEND;\n$$ LANGUAGE plpgsql;\n\nCREATE OR REPLACE TRIGGER centrifugo_notify_partition_trigger\nAFTER INSERT ON chat_outbox\nFOR EACH ROW\nEXECUTE FUNCTION centrifugo_notify_partition_change();\n"})}),"\n",(0,o.jsx)(n.p,{children:"To do this you can connect to PostgreSQL with this command:"}),"\n",(0,o.jsx)(n.pre,{children:(0,o.jsx)(n.code,{children:"docker compose exec db psql postgresql://grandchat:grandchat@localhost:5432/grandchat\n"})}),"\n",(0,o.jsxs)(n.p,{children:["And then update consumer config \u2013 add ",(0,o.jsx)(n.code,{children:'"partition_notification_channel"'})," option to it:"]}),"\n",(0,o.jsx)(n.pre,{children:(0,o.jsx)(n.code,{className:"language-json",children:'{\n  ...\n  "consumers": [\n    {\n      "name": "postgresql",\n      ...\n      "postgresql": {\n        ...\n        "partition_poll_interval": "300ms",\n        "partition_notification_channel": "centrifugo_partition_change"\n      }\n    }\n  ]\n}\n'})}),"\n",(0,o.jsx)(n.p,{children:"After doing that restart everything \u2013 and enjoy instant event delivery!"}),"\n",(0,o.jsx)(n.h2,{id:"using-kafka-connect-for-cdc",children:"Using Kafka Connect for CDC"}),"\n",(0,o.jsxs)(n.p,{children:["Let's also look at another approach - usually known as CDC - Change Data Capture (you can learn more about it from ",(0,o.jsx)(n.a,{href:"https://www.confluent.io/learn/change-data-capture/",children:"this post"}),", for example). We will use Kafka Connect with Debezium connector to read updates from PostgreSQL WAL and translate them to Kafka. Then we will use built-in Centrifugo possibility to ",(0,o.jsx)(n.a,{href:"/docs/server/consumers#kafka-consumer",children:"consume Kafka topics"}),"."]}),"\n",(0,o.jsx)(n.p,{children:"The CDC approach with reading WAL has an advantage that in most cases it comes with a very low overhead for the database. In the outbox shown case above we constantly polling PostgreSQL for changes, which may be less effective for the database."}),"\n",(0,o.jsxs)(n.p,{children:["To configure CDC flow we must first configure PostgreSQL to use logical replication. To do this let's update ",(0,o.jsx)(n.code,{children:"db"})," service in ",(0,o.jsx)(n.code,{children:"docker-compose.yml"}),":"]}),"\n",(0,o.jsx)(n.pre,{children:(0,o.jsx)(n.code,{className:"language-yaml",metastring:'title="docker-compose.yml"',children:'db:\n  image: postgres:15\n  volumes:\n    - ./postgres_data:/var/lib/postgresql/data/\n  healthcheck:\n    test: [ "CMD", "pg_isready", "-U", "grandchat" ]\n    interval: 1s\n    timeout: 5s\n    retries: 10\n  environment:\n    - POSTGRES_USER=grandchat\n    - POSTGRES_PASSWORD=grandchat\n    - POSTGRES_DB=grandchat\n  expose:\n    - 5432\n  ports:\n    - 5432:5432\n  command: ["postgres", "-c", "wal_level=logical", "-c", "wal_writer_delay=10ms"]\n'})}),"\n",(0,o.jsxs)(n.p,{children:["Note \u2013 added ",(0,o.jsx)(n.code,{children:"command"})," field where ",(0,o.jsx)(n.code,{children:"postgres"})," is launched with ",(0,o.jsx)(n.code,{children:"wal_level=logical"})," option. We also tune ",(0,o.jsx)(n.code,{children:"wal_writer_delay"})," to be faster."]}),"\n",(0,o.jsxs)(n.p,{children:["Then let's add Kafka Connect and Kafka itself to our ",(0,o.jsx)(n.code,{children:"docker-compose.yml"}),":"]}),"\n",(0,o.jsx)(n.pre,{children:(0,o.jsx)(n.code,{className:"language-yaml",metastring:'title="docker-compose.yml"',children:'zookeeper:\n  image: confluentinc/cp-zookeeper:latest\n  environment:\n    ZOOKEEPER_CLIENT_PORT: 2181\n    ZOOKEEPER_TICK_TIME: 2000\n\nkafka:\n  image: confluentinc/cp-kafka:latest\n  depends_on:\n    - zookeeper\n  ports:\n    - "29092:29092"\n  expose:\n    - 9092\n  healthcheck:\n    test: ["CMD", "kafka-topics", "--list", "--bootstrap-server", "localhost:9092"]\n    interval: 2s\n    timeout: 5s\n    retries: 10\n  environment:\n    KAFKA_BROKER_ID: 1\n    KAFKA_ZOOKEEPER_CONNECT: zookeeper:2181\n    KAFKA_ADVERTISED_LISTENERS: PLAINTEXT://kafka:9092,PLAINTEXT_HOST://localhost:29092\n    KAFKA_LISTENER_SECURITY_PROTOCOL_MAP: PLAINTEXT:PLAINTEXT,PLAINTEXT_HOST:PLAINTEXT\n    KAFKA_INTER_BROKER_LISTENER_NAME: PLAINTEXT\n    KAFKA_OFFSETS_TOPIC_REPLICATION_FACTOR: 1\n    KAFKA_TRANSACTION_STATE_LOG_MIN_ISR: 1\n    KAFKA_TRANSACTION_STATE_LOG_REPLICATION_FACTOR: 1\n    KAFKA_MAX_REQUEST_SIZE: "10485760"  # max.request.size\n    KAFKA_MESSAGE_MAX_BYTES: "10485760" # message.max.bytes\n    KAFKA_MAX_PARTITION_FETCH_BYTES: "10485760" # max.partition.fetch.bytes\n\nconnect:\n  image: debezium/connect:latest\n  depends_on:\n    db:\n      condition: service_healthy\n    kafka:\n      condition: service_healthy\n  ports:\n    - "8083:8083"\n  environment:\n    BOOTSTRAP_SERVERS: kafka:9092\n    GROUP_ID: 1\n    CONFIG_STORAGE_TOPIC: connect_configs\n    OFFSET_STORAGE_TOPIC: connect_offsets\n    STATUS_STORAGE_TOPIC: connect_statuses\n'})}),"\n",(0,o.jsx)(n.p,{children:"Kafka uses Zookeeper, so we added it here too. Next, we need to configure Debezium to use PostgreSQL plugin:"}),"\n",(0,o.jsx)(n.pre,{children:(0,o.jsx)(n.code,{className:"language-json",metastring:'title="debezium/debezium-config.json"',children:'{\n    "name": "grandchat-connector",\n    "config": {\n        "connector.class": "io.debezium.connector.postgresql.PostgresConnector",\n        "database.hostname": "db",\n        "database.port": "5432",\n        "database.user": "grandchat",\n        "database.password": "grandchat",\n        "database.dbname": "grandchat",\n        "database.server.name": "db",\n        "table.include.list": "public.chat_cdc",\n        "database.history.kafka.bootstrap.servers": "kafka:9092",\n        "database.history.kafka.topic": "schema-changes.chat_cdc",\n        "plugin.name": "pgoutput",\n        "tasks.max": "1",\n        "producer.override.max.request.size": "10485760",\n        "topic.creation.default.cleanup.policy": "delete",\n        "topic.creation.default.partitions": "8",\n        "topic.creation.default.replication.factor": "1",\n        "topic.creation.default.retention.ms": "604800000",\n        "topic.creation.enable": "true",\n        "topic.prefix": "postgres",\n        "key.converter": "org.apache.kafka.connect.json.JsonConverter",\n        "value.converter": "org.apache.kafka.connect.json.JsonConverter",\n        "key.converter.schemas.enable": "false",\n        "value.converter.schemas.enable": "false",\n        "poll.interval.ms": "100",\n        "transforms": "extractContent",\n        "transforms.extractContent.type": "org.apache.kafka.connect.transforms.ExtractField$Value",\n        "transforms.extractContent.field": "after",\n        "message.key.columns": "public.chat_cdc:partition",\n        "snapshot.mode": "never"\n    }\n}\n'})}),"\n",(0,o.jsxs)(n.p,{children:["And we should add one more image to ",(0,o.jsx)(n.code,{children:"docker-compose.yml"})," to apply this configuration on start:"]}),"\n",(0,o.jsx)(n.pre,{children:(0,o.jsx)(n.code,{className:"language-yaml",metastring:'title="docker-compose.yml"',children:"connect-config-loader:\n  image: appropriate/curl:latest\n  depends_on:\n    - connect\n  volumes:\n    - ./debezium/debezium-config.json:/debezium-config.json\n  command: >\n    /bin/sh -c \"\n      echo 'Waiting for Kafka Connect to start...';\n      while ! curl -f http://connect:8083/connectors; do sleep 1; done;\n      echo 'Kafka Connect is up, posting configuration';\n      curl -X DELETE -H 'Content-Type: application/json' http://connect:8083/connectors/chat-connector;\n      curl -X POST -H 'Content-Type: application/json' -v --data @/debezium-config.json http://connect:8083/connectors;\n      echo 'Configuration posted';\n    \"\n"})}),"\n",(0,o.jsx)(n.p,{children:"Here we recreate Kafka Connect configuration on every start of Docker compose, in real life you won't do this - you will create configuration once and update it only if needed. But for development we want to apply changes in file automatically without the need to use REST API of Kafka Connect manually."}),"\n",(0,o.jsx)(n.p,{children:"Next step here is configure Centrifugo to consume Kafka topic:"}),"\n",(0,o.jsx)(n.pre,{children:(0,o.jsx)(n.code,{className:"language-json",children:'  ...\n  "consumers": [\n    {\n      "name": "my_kafka_consumer",\n      "type": "kafka",\n      "kafka": {\n        "brokers": ["kafka:9092"],\n        "topics": ["postgres.public.chat_cdc"],\n        "consumer_group": "centrifugo"\n      }\n    }\n  ]\n}\n'})}),"\n",(0,o.jsxs)(n.p,{children:["We will also create new model in Django called ",(0,o.jsx)(n.code,{children:"CDC"}),", it will be used for CDC process:"]}),"\n",(0,o.jsx)(n.pre,{children:(0,o.jsx)(n.code,{className:"language-python",children:'# While the CDC model here is the same as Outbox it has different partition field semantics,\n# also in outbox case we remove processed messages from DB, while in CDC don\'t. So to not\n# mess up with different semantics when switching between broadcast modes of the example app\n# we created two separated models here. \nclass CDC(models.Model):\n    method = models.TextField(default="publish")\n    payload = models.JSONField()\n    partition = models.BigIntegerField(default=0)\n    created_at = models.DateTimeField(auto_now_add=True)\n\n'})}),"\n",(0,o.jsx)(n.p,{children:"And use it like this:"}),"\n",(0,o.jsx)(n.pre,{children:(0,o.jsx)(n.code,{className:"language-python",children:"# In cdc case Debezium will use this field for setting Kafka partition.\n# We should not prepare proper partition ourselves in this case.\npartition = hash(room_id)\n# Creating outbox object inside transaction will guarantee that Centrifugo will\n# process the command at some point. In normal conditions \u2013 almost instantly. In this\n# app Debezium will perform CDC and send outbox events to Kafka, event will be then\n# consumed by Centrifugo. The advantages here is that Debezium reads WAL changes and\n# has a negligible overhead on database performance. And most efficient partitioning.\n# The trade-off is that more hops add more real-time event delivery latency. May be\n# still instant enough though.\nCDC.objects.create(method='broadcast', payload=broadcast_payload, partition=partition)\n"})}),"\n",(0,o.jsx)(n.p,{children:"It seems very similar to what we had with Outbox model, please take a look at comments in the code snippets above to be aware of the difference in the model semantics."}),"\n",(0,o.jsx)(n.p,{children:"That's how it is possible to use CDC to stream events to Centrifugo. This approach may come with larger delivery latency but it has some important benefits over transactional outbox approach shown above:"}),"\n",(0,o.jsxs)(n.ul,{children:["\n",(0,o.jsx)(n.li,{children:"it may provide better throughput as we are not limited in predefined number of partitions which is expected to be not very large. Here we can rely on Kafka native partitioning which is more scalable than reading SQL table concurrently by partition"}),"\n",(0,o.jsx)(n.li,{children:"since we are reading WAL here - the load on the database (PostgreSQL) should be mostly negligible. While in outbox case we are constantly polling tables and removing processed rows."}),"\n"]}),"\n",(0,o.jsx)(n.p,{children:"But we can eliminate latency downside to take best of two worlds."}),"\n",(0,o.jsx)(n.h2,{id:"solving-cdc-latency",children:"Solving CDC latency"}),"\n",(0,o.jsx)(n.p,{children:"To minimize latency in the case of CDC but still ensure reliable event delivery, we can employ a combined approach: broadcasting using the HTTP API upon a successful transaction and saving the Outbox/CDC model as well. Why does this work? Because we use an idempotency key when publishing to Centrifugo. As a result, the second message will be rejected by Centrifugo and will not reach subscribers."}),"\n",(0,o.jsx)(n.p,{children:"Moreover, on the client side we are using techniques to deal with duplicate messages \u2013 we are accurately updating state to prevent duplicate messages in a room, for counters we send the current number of members in a room instead of incrementing/decrementing one by one upon receiving the event. In other words, we ensure idempotent message processing on the client side."}),"\n",(0,o.jsx)(n.p,{children:"Another technique that helps us distinguish duplicate or outdated messages is using incremental versioning of the room. Each event we send related to the room includes a room version. On the client side, this enables us to compare the current state room version with the event room version and discard processing non-actual messages. This approach addresses the issue of late message delivery, avoiding unnecessary work and UI updates."}),"\n",(0,o.jsx)(n.p,{children:"In the next chapter, we will examine some actual numbers to illustrate how this combined approach works as expected."})]})}function h(e={}){const{wrapper:n}={...(0,a.a)(),...e.components};return n?(0,o.jsx)(n,{...e,children:(0,o.jsx)(d,{...e})}):d(e)}},11151:(e,n,t)=>{t.d(n,{Z:()=>r,a:()=>i});var o=t(67294);const a={},s=o.createContext(a);function i(e){const n=o.useContext(s);return o.useMemo((function(){return"function"==typeof e?e(n):{...n,...e}}),[n,e])}function r(e){let n;return n=e.disableParentContext?"function"==typeof e.components?e.components(a):e.components||a:i(e.components),o.createElement(s.Provider,{value:n},e.children)}}}]);