---
title: Experimenting with real-time data compression by simulating a football match events
tags: [centrifugo, websocket, compression]
description: This post shows the potential profit of enabling delta compression in channels and demonstrates the reduction of data transfer in various scenarios, including different Centrifugo protocol formats and using WebSocket permessage-deflate compression.
author: Alexander Emelin
authorTitle: Founder of Centrifugal Labs
authorImageURL: /img/alexander_emelin.jpeg
image: /img/football_match_compression.png
hide_table_of_contents: false
---

<img src="/img/football_match_compression.png" />

Optimizing data transfer over WebSocket connections can significantly reduce bandwidth costs. Compressing data usually leads to memory and CPU resource usage overhead – but in many cases it worth doing anyway since it positively impacts the final bill from the provider (bandwidth cost reduction overweights resource usage increase).

Centrifugo v5.4.0 introduced [delta compression](/docs/server/delta_compression) feature. But before implementing it we wanted a playground which could demonstrate the potential benefit of using delta compression in Centrifugo channels.

This post outlines our approach to estimating the potential profit from implementing delta compression. It demonstrates the reduction in data transfer using once concrete use case across various configurations, including different Centrifugo protocol formats and the additional use of WebSocket permessage-deflate compression. Although these numbers can vary significantly depending on the data, we believe the results are valuable for providing a general understanding of Centrifugo compression options. This information can help Centrifugo users apply these insights to their use cases.

## Experiment Overview

In this experiment, we simulated a football match, sending the entire game state over a WebSocket connection upon every match event. Our compression playground looks like this:

<video width="100%" loop={true} autoPlay="autoplay" muted controls="" src="/img/el_classico.mp4"></video>

It visualizes only the score, but under the hood there are other game changes happen – will be shown below.

We tested various configurations to evaluate the effectiveness of data compression if different cases. In each setup the same game data was sent over the wire. The data then was captured using [WireShark](https://www.wireshark.org/) with the filter:

```
tcp.srcport == 8000 && websocket
```

This is how WebSocket packets look in Wireshark when applying a filter mentioned above:

![wireshark](/img/compression_wireshark.png)

Bytes captured show the entire overhead from packets in the game channel going from server to client (including TCP/IP overhead).

The source code of the experiment may be found on Github as a [Centrifuge library example](https://github.com/centrifugal/centrifuge/tree/master/_examples/compression_playground). You can run it to inspect the exact WebSocket frames in each scenario.

To give reader a general idea about data, we sent 30 publications with the entire football game state, for example here is a first message in a match (2 teams, 11 players):

<details>
<summary>Click to see the data</summary>
<p>

```json
{
   "homeTeam":{
      "name":"Real Madrid",
      "players":[
         {
            "name":"John Doe"
         },
         {
            "name":"Jane Smith"
         },
         {
            "name":"Alex Johnson"
         },
         {
            "name":"Chris Lee"
         },
         {
            "name":"Pat Kim"
         },
         {
            "name":"Sam Morgan"
         },
         {
            "name":"Jamie Brown"
         },
         {
            "name":"Casey Davis"
         },
         {
            "name":"Morgan Garcia"
         },
         {
            "name":"Taylor White"
         },
         {
            "name":"Jordan Martinez"
         }
      ]
   },
   "awayTeam":{
      "name":"Barcelona",
      "players":[
         {
            "name":"Robin Wilson"
         },
         {
            "name":"Drew Taylor",
            "events":[
               {
                  "type":"RED_CARD"
               }
            ]
         },
         {
            "name":"Jessie Bailey"
         },
         {
            "name":"Casey Flores"
         },
         {
            "name":"Jordan Walker"
         },
         {
            "name":"Charlie Green"
         },
         {
            "name":"Alex Adams"
         },
         {
            "name":"Morgan Thompson"
         },
         {
            "name":"Taylor Clark"
         },
         {
            "name":"Jordan Hernandez"
         },
         {
            "name":"Jamie Lewis"
         }
      ]
   }
}
```

</p>
</details>

Then we send intermediary states – someone scores goal, gets yellow card, being subsctituted. And here is the end message in simulation (final scores, final events attached to corresponding players):

<details>
<summary>Click to see the data</summary>
<p>

```json
{
   "homeTeam":{
      "name":"Real Madrid",
      "score":3,
      "players":[
         {
            "name":"John Doe",
            "events":[
               {
                  "type":"YELLOW_CARD",
                  "minute":6
               },
               {
                  "type":"SUBSTITUTE",
                  "minute":39
               }
            ]
         },
         {
            "name":"Jane Smith"
         },
         {
            "name":"Alex Johnson"
         },
         {
            "name":"Chris Lee",
            "events":[
               {
                  "type":"GOAL",
                  "minute":84
               }
            ]
         },
         {
            "name":"Pat Kim"
         },
         {
            "name":"Sam Morgan"
         },
         {
            "name":"Jamie Brown",
            "events":[
               {
                  "type":"SUBSTITUTE",
                  "minute":9
               }
            ]
         },
         {
            "name":"Casey Davis",
            "events":[
               {
                  "type":"YELLOW_CARD",
                  "minute":81
               }
            ]
         },
         {
            "name":"Morgan Garcia",
            "events":[
               {
                  "type":"SUBSTITUTE",
                  "minute":15
               },
               {
                  "type":"GOAL",
                  "minute":30
               },
               {
                  "type":"YELLOW_CARD",
                  "minute":57
               },
               {
                  "type":"GOAL",
                  "minute":62
               },
               {
                  "type":"RED_CARD",
                  "minute":66
               }
            ]
         },
         {
            "name":"Taylor White",
            "events":[
               {
                  "type":"YELLOW_CARD",
                  "minute":18
               },
               {
                  "type":"SUBSTITUTE",
                  "minute":42
               },
               {
                  "type":"SUBSTITUTE",
                  "minute":45
               },
               {
                  "type":"YELLOW_CARD",
                  "minute":69
               },
               {
                  "type":"RED_CARD",
                  "minute":72
               }
            ]
         },
         {
            "name":"Jordan Martinez",
            "events":[
               {
                  "type":"SUBSTITUTE",
                  "minute":21
               },
               {
                  "type":"SUBSTITUTE",
                  "minute":24
               }
            ]
         }
      ]
   },
   "awayTeam":{
      "name":"Barcelona",
      "score":3,
      "players":[
         {
            "name":"Robin Wilson"
         },
         {
            "name":"Drew Taylor",
            "events":[
               {
                  "type":"RED_CARD"
               },
               {
                  "type":"GOAL",
                  "minute":12
               }
            ]
         },
         {
            "name":"Jessie Bailey"
         },
         {
            "name":"Casey Flores",
            "events":[
               {
                  "type":"YELLOW_CARD",
                  "minute":78
               }
            ]
         },
         {
            "name":"Jordan Walker",
            "events":[
               {
                  "type":"SUBSTITUTE",
                  "minute":33
               }
            ]
         },
         {
            "name":"Charlie Green",
            "events":[
               {
                  "type":"GOAL",
                  "minute":51
               },
               {
                  "type":"GOAL",
                  "minute":60
               },
               {
                  "type":"SUBSTITUTE",
                  "minute":75
               }
            ]
         },
         {
            "name":"Alex Adams"
         },
         {
            "name":"Morgan Thompson",
            "events":[
               {
                  "type":"YELLOW_CARD",
                  "minute":27
               },
               {
                  "type":"SUBSTITUTE",
                  "minute":48
               }
            ]
         },
         {
            "name":"Taylor Clark",
            "events":[
               {
                  "type":"SUBSTITUTE",
                  "minute":3
               },
               {
                  "type":"SUBSTITUTE",
                  "minute":87
               }
            ]
         },
         {
            "name":"Jordan Hernandez"
         },
         {
            "name":"Jamie Lewis",
            "events":[
               {
                  "type":"YELLOW_CARD",
                  "minute":36
               },
               {
                  "type":"SUBSTITUTE",
                  "minute":54
               }
            ]
         }
      ]
   }
}
```

</p>
</details>

When we used Protobuf encoding for game state we serialized the data according to this Protobuf schema:

<details>
<summary>Click to see the Protobuf schema for the game state</summary>
<p>

```protobuf
syntax = "proto3";

package centrifugal.centrifuge.examples.compression_playground;

option go_package = "./;apppb";

enum EventType {
  UNKNOWN = 0; // Default value, should not be used
  GOAL = 1;
  YELLOW_CARD = 2;
  RED_CARD = 3;
  SUBSTITUTE = 4;
}

message Event {
  EventType type = 1;
  int32 minute = 2;
}

message Player {
  string name = 1;
  repeated Event events = 2;
}

message Team {
  string name = 1;
  int32 score = 2;
  repeated Player players = 3;
}

message Match {
  int32 id = 1;
  Team home_team = 2;
  Team away_team = 3;
}
```

</p>
</details>

## Results Breakdown

Below are the results of our experiment, comparing different protocols and compression settings:

| Protocol                   | Compression | Delta      | Delay | Bytes sent | Percentage |
|----------------------------|-------------|------------|-------|------------|-----------|
| JSON over JSON             | No          | No         | 0     | 40251      | 100.0 (base)     |
| JSON over JSON             | Yes         | No         | 0     | 15669      | 38.93     |
| JSON over JSON             | No          | Yes        | 0     | 6043       | 15.01     |
| JSON over JSON             | Yes         | Yes        | 0     | 5360       | 13.32     |
| --             | --          | --         | --     | --      | --     |
| JSON over Protobuf         | No          | No         | 0     | 39180      | 97.34     |
| JSON over Protobuf         | Yes         | No         | 0     | 15542      | 38.61     |
| JSON over Protobuf         | No          | Yes        | 0     | 4287       | 10.65     |
| JSON over Protobuf         | Yes         | Yes        | 0     | 4126       | 10.25     |
| --             | --          | --         | --     | --      | --     |
| Protobuf over Protobuf     | No          | No         | 0     | 16562      | 41.15     |
| Protobuf over Protobuf     | Yes         | No         | 0     | 13115      | 32.58     |
| Protobuf over Protobuf     | No          | Yes        | 0     | 4382       | 10.89     |
| Protobuf over Protobuf     | Yes         | Yes        | 0     | 4473       | 11.11     |

## Results analysis

Let's now discuss the results we observed in detail.

### JSON over JSON

In this case we are sending JSON data with football match game state over JSON Centrifugal protocol.

1. JSON over JSON (No Compression, No Delta)
Bytes Sent: 40251
Percentage: 100.0%
Analysis: This is a baseline scenario, with no compression and no delta, results in the highest amount of data being sent. But very straightforward to implement.

2. JSON over JSON (With Compression, No Delta)
Bytes Sent: 15669
Percentage: 38.93%
Analysis: Enabling compression reduces the data size significantly to 38.93% of the original, showcasing the effectiveness of deflate compression. See [how to configure compression](/docs/transports/websocket#websocket_compression) in Centrifugo, note that it comes with CPU and memory overhead which depends on your load profile.

3. JSON over JSON (No Compression, With Delta)
Bytes Sent: 6043
Percentage: 15.01%
Analysis: Using delta compression without deflate compression reduces data size to 15.01% for this use case, only changes are being sent after the initial full payload. See how to enable [delta compression in channels](/docs/server/delta_compression) in Centrifugo. The nice thing about using delta compression instead of deflate compression is that deltas require less and more predictable resource overhead. 

4. JSON over JSON (With Compression and Delta)
Bytes Sent: 5360
Percentage: 13.32%
Analysis: Combining both compression and delta further reduces the data size to 13.32%, achieving the highest efficiency in this category. The benefit is not huge, because we already send small deltas here.

### JSON over Protobuf

In this case we are sending JSON data with football match game state over Protobuf Centrifugal protocol.

5. JSON over Protobuf (No Compression, No Delta)
Bytes Sent: 39180
Percentage: 97.34%
Analysis: Switching to Protobuf encoding of Centrifugo protocol but still sending JSON data slightly reduces the data size to 97.34% of the JSON over JSON baseline. The benefit here comes from the fact Centrifugo does not introduce a lot of its own protocol overhead – Protobuf is more compact. But we still send JSON data as Protobuf payloads – that's why it's generally comparable with a baseline.

6. JSON over Protobuf (With Compression, No Delta)
Bytes Sent: 15542
Percentage: 38.61%
Analysis: Compression with Protobuf encoding brings similar benefits as with JSON, reducing the data size to 38.61%.

7. JSON over Protobuf (No Compression, With Delta)
Bytes Sent: 4287
Percentage: 10.65%
Analysis: Delta compression with Protobuf is effective, reducing data to 10.65%. It's almost x10 reduction in bandwidth compared to the baseline!

8. JSON over Protobuf (With Compression and Delta)
Bytes Sent: 4126
Percentage: 10.25%
Analysis: This combination provides the best results for JSON over Protobuf, reducing data size to 10.25% from the baseline.

### Protobuf over Protobuf

In this case we are sending Protobuf binary data with football match game state over Protobuf Centrifugal protocol.

9. Protobuf over Protobuf (No Compression, No Delta)
Bytes Sent: 16562
Percentage: 41.15%
Analysis: Using Protobuf for both encoding and transmission **without any compression or delta** reduces data size to 41.15%. So you may get the most efficient setup with nice bandwidth reduction. But the cost is more complex data encoding.

10. Protobuf over Protobuf (With Compression, No Delta)
Bytes Sent: 13115
Percentage: 32.58%
Analysis: Compression reduces the data size to 32.58%. Note, that in this case it's not very different from JSON case.  

11. Protobuf over Protobuf (No Compression, With Delta)
Bytes Sent: 4382
Percentage: 10.89%
Analysis: Delta compression is again very effective here, reducing the data size to 10.89%. Again - comparable to JSON case.

12. Protobuf over Protobuf (With Compression and Delta)
Bytes Sent: 4473
Percentage: 11.11%
Analysis: Combining both methods results in a data size of 11.11%. Even more than in JSON case. That's bacause binary data is not compressed very well with deflate algorithm.

## Conclusion

* WebSocket permessage-deflate compression significantly reduces the amount of data transferred over WebSocket connections. While it incurs CPU and memory overhead, it may be still worth using from a total cost perspective.

* Delta compression makes perfect sense for channels where data changes only slightly between publications. In our experiment, it resulted in a tenfold reduction in bandwidth usage.

* Using binary data in combination with the Centrifugo Protobuf protocol provides substantial bandwidth reduction even without deflate or delta compression. However, this comes at the cost of increased data format complexity. An additional benefit of using the Centrifugo Protobuf protocol is its faster marshalling and unmarshalling on the server side compared to the JSON protocol.

For Centrifugo, these results highlighted the potential of implementing delta compression, so we proceeded with it. The benefit depends on the nature of the data being sent – you can achieve even greater savings if you have larger messages that are very similar to each other.
