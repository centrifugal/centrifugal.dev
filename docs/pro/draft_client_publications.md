---
id: client_publications
title: Ephemeral client publications
sidebar_label: Ephemeral publications
---

Centrifugo PRO provides schema validation for client publications, enabling ephemeral messaging: client publications can pass through Centrifugo directly without involving backend proxy logic, reducing backend load and delivery latency. Normally the backend is required because it may validate and store messages in the main database, but for certain types of messages—such as typing notifications in a chat room—backend involvement adds unnecessary overhead. Centrifugo PRO offers an efficient way to address that.

## Overview

The feature consists of three parts which together provide a ground for ephemeral client publications:

* **Validation layer** - validate client publications based on JSON schema
* **Transformation layer** - transform publication data and generate tags using jq or JavaScript engines
* **Bandwidth optimization** - optionally exclude client info from publications to reduce message size

## Configuration

### Defining schemas

Schemas are defined at the top level of Centrifugo configuration. Centrifugo supports two types of schemas:

* **JSON Schema** (`jsonschema_draft_2020_12`) - Validates publication data against JSON Schema Draft 2020-12
* **Empty Binary** (`empty_binary`) - Only allows empty binary data (useful for presence-like signals)

:::info Security Default

For JSON schemas, Centrifugo automatically sets `"additionalProperties": false` on object-type schemas unless explicitly specified otherwise. This prevents clients from injecting unexpected fields into validated data.

:::

#### JSON Schema (default)

The `type` field is optional and defaults to `jsonschema_draft_2020_12`. You can define schemas directly in your configuration file:

```json title="config.json"
{
  "schemas": [
    {
      "name": "chat_message",
      "type": "jsonschema_draft_2020_12",
      "definition": "{\"type\":\"object\",\"properties\":{\"text\":{\"type\":\"string\",\"maxLength\":500}},\"required\":[\"text\"]}"
    }
  ]
}
```

For better readability in YAML, use multiline strings:

```yaml title="config.yaml"
schemas:
  - name: chat_message
    type: jsonschema_draft_2020_12  # Optional, this is the default
    definition: |
      {
        "type": "object",
        "properties": {
          "text": {"type": "string", "maxLength": 500},
          "mentions": {"type": "array", "items": {"type": "string"}}
        },
        "required": ["text"]
      }
```

#### Empty Binary Schema

The `empty_binary` schema type validates that publication data is empty. This is useful for presence-like signals where the fact of publication itself carries meaning (e.g., "user is typing"):

```json title="config.json"
{
  "schemas": [
    {
      "name": "typing_indicator",
      "type": "empty_binary"
    }
  ]
}
```

```yaml title="config.yaml"
schemas:
  - name: typing_indicator
    type: empty_binary
```

:::note

Empty binary schemas don't require a `definition` field since they only validate that data is empty (0 bytes).

:::

#### Schema from file

For complex schemas, you can reference external JSON schema files. This provides better readability, IDE support, and easier maintenance:

**Create a schema file:**

```json title="schemas/chat_message.json"
{
  "type": "object",
  "properties": {
    "text": {
      "type": "string",
      "maxLength": 500,
      "minLength": 1
    },
    "mentions": {
      "type": "array",
      "items": {"type": "string"}
    },
    "metadata": {
      "type": "object",
      "properties": {
        "timestamp": {"type": "integer"}
      }
    }
  },
  "required": ["text"]
}
```

**Reference it in your config:**

```json title="config.json"
{
  "schemas": [
    {
      "name": "chat_message",
      "definition": "./schemas/chat_message.json"
    },
    {
      "name": "reaction",
      "definition": "./schemas/reaction.json"
    }
  ]
}
```

Or in YAML:

```yaml title="config.yaml"
schemas:
  - name: chat_message
    definition: ./schemas/chat_message.json
  - name: reaction
    definition: ./schemas/reaction.json
  - name: typing
    definition: ./schemas/typing.json
```

:::tip Benefits of schema files

- **Better IDE support** - Syntax highlighting, validation, and autocomplete
- **Easier testing** - Validate schema files independently
- **Cleaner diffs** - Track schema changes separately in version control
- **Reusability** - Share schemas across environments or services

:::

:::info

`"additionalProperties": false` is automatically added to object schemas for security. You can explicitly set `"additionalProperties": true` in your schema file if you need to allow extra fields.

:::

### Applying schemas to channels

Use `client_publication.schemas` in channel or namespace configuration to apply validation:

```json title="config.json"
{
  "schemas": [
    {
      "name": "typing",
      "definition": "{\"type\":\"object\",\"properties\":{},\"additionalProperties\": false]}"
    }
  ],
  "channel": {
    "namespaces": [
      {
        "name": "typings",
        "publication_data_format": "json",
        "client_publication": {
          "schemas": ["typing"]
        },
        "allow_publish_for_subscriber": true
      }
    ]
  }
}
```

:::important Schema Type Compatibility

Schemas must be compatible with the channel's `publication_data_format` setting:

* **JSON schemas** (`jsonschema_draft_2020_12`) require `publication_data_format: "json"`
* **Empty binary schemas** (`empty_binary`) require `publication_data_format: "binary"` to be set

Centrifugo validates this configuration at startup and will reject incompatible combinations.

:::

### Multiple schemas

When multiple schemas are configured, the publication data must match **at least one** of them. This allows supporting different message types in the same channel:

```json
{
  "schemas": [
    {
      "name": "typing",
      "definition": "{\"type\":\"object\",\"properties\":{\"is_typing\":{\"type\":\"boolean\"}},\"required\":[\"is_typing\"]}"
    },
    {
      "name": "reaction",
      "definition": "{\"type\":\"object\",\"properties\":{\"emoji\":{\"type\":\"string\",\"enum\":[\"👍\",\"👎\",\"❤️\",\"😂\",\"😮\",\"😢\",\"😡\"]}},\"required\":[\"emoji\"],\"additionalProperties\":false}"
    }
  ],
  "channel": {
    "namespaces": [
      {
        "name": "ephemeral",
        "publication_data_format": "json",
        "client_publication": {
          "schemas": ["typing", "reaction"]
        },
        "allow_publish_for_subscriber": true
      }
    ]
  }
}
```

:::note

All schemas referenced in `client_publication.schemas` must have the same type (either all `jsonschema_draft_2020_12` or all `empty_binary`) since they share the same `publication_data_format` setting.

:::

## Publication transformations

Publication transformations allow you to modify publication data, extract tags, and generate idempotency keys using either jq or JavaScript programs. Transformations are executed server-side and compiled at startup for optimal performance.

### Transformation engines

Centrifugo PRO supports two transformation engines:

* **jq** - JSON query language, ideal for data manipulation and filtering
* **js** - JavaScript (via goja runtime), provides familiar syntax and flexibility

Both engines receive the same input context and must return a consistent output format.

### Configuration

Transformations are configured in the `client_publication.transform` section:

```json title="config.json"
{
  "channel": {
    "namespaces": [
      {
        "name": "chat",
        "client_publication": {
          "transform": {
            "enabled": true,
            "engine": "jq",
            "jq": {
              "program": "{data: .data, tags: {user: .user}}"
            }
          }
        }
      }
    ]
  }
}
```

Or in YAML for better readability:

```yaml title="config.yaml"
channel:
  namespaces:
    - name: chat
      client_publication:
        transform:
          enabled: true
          engine: jq  # or "js"
          jq:
            program: |
              {
                data: .data,
                tags: {user: .user, priority: "high"}
              }
```

### Input context

Transform programs receive an input object with the following variables:

* `data` (object) - The publication data sent by the client (always available)
* `timestamp_ms` (int) - Current server timestamp in milliseconds
* `user` (string) - User ID from connection credentials
* `client` (string) - Client ID (unique connection identifier)
* `meta` (object) - Connection metadata
* `vars` (object) - Channel pattern variables (requires [channel patterns](./channel_patterns.md))
* `schema_name` (string) - Name of the matched schema (empty if no schemas configured)

:::note
Only `data` is guaranteed to be present. Other variables depend on the context where the transformation is used.
:::

### Output format

Transform programs must return an object with optional fields:

* `data` (object) - Transformed publication data (optional)
* `tags` (object) - Key-value pairs for publication tags (optional)
* `idempotency_key` (string) - Deduplication key (optional)

All fields are optional - you can return only the ones you need.

### Using jq

jq provides powerful JSON manipulation capabilities with a concise syntax.

**Basic transformation:**

```yaml
transform:
  enabled: true
  engine: jq
  jq:
    program: |
      {
        data: {
          message: .data.text,
          user: .user,
          timestamp: .timestamp_ms
        },
        tags: {
          room: .vars.room_id,
          priority: (if .data.urgent == true then "high" else "normal" end)
        },
        idempotency_key: (.user + ":" + (.timestamp_ms | tostring))
      }
```

**Data restructuring:**

```yaml
transform:
  enabled: true
  engine: jq
  jq:
    program: |
      {
        data: (
          .data
          | .author = {id: .user_id, name: .user_name}
          | del(.user_id, .user_name)
        ),
        tags: {source: "client"}
      }
```

### Using JavaScript

JavaScript provides familiar syntax and can handle complex logic.

**Basic transformation:**

```yaml
transform:
  enabled: true
  engine: js
  js:
    program: |
      (function(input) {
        return {
          data: {
            message: input.data.text,
            user: input.user,
            timestamp: input.timestamp_ms
          },
          tags: {
            room: input.vars.room_id,
            priority: input.data.urgent === true ? "high" : "normal"
          },
          idempotency_key: input.user + ":" + input.timestamp_ms
        };
      })
```

**Data restructuring:**

```yaml
transform:
  enabled: true
  engine: js
  js:
    program: |
      (function(input) {
        var data = input.data;
        return {
          data: {
            author: {
              id: data.user_id,
              name: data.user_name
            },
            content: data.content,
            metadata: data.metadata
          },
          tags: {
            source: "client"
          }
        };
      })
```

### Loading programs from files

For complex transformations, you can load programs from external files:

**Create program files:**

```jq title="transforms/chat.jq"
{
  data: {
    message: .data.text,
    author: .user,
    timestamp: .timestamp_ms
  },
  tags: {
    room: .vars.room_id,
    priority: (if .data.urgent == true then "high" else "normal" end)
  },
  idempotency_key: (.user + ":" + (.timestamp_ms | tostring))
}
```

```javascript title="transforms/chat.js"
(function(input) {
  return {
    data: {
      message: input.data.text,
      author: input.user,
      timestamp: input.timestamp_ms
    },
    tags: {
      room: input.vars.room_id,
      priority: input.data.urgent === true ? "high" : "normal"
    },
    idempotency_key: input.user + ":" + input.timestamp_ms
  };
})
```

**Reference in configuration:**

```json title="config.json"
{
  "channel": {
    "namespaces": [
      {
        "name": "chat",
        "client_publication": {
          "transform": {
            "enabled": true,
            "engine": "jq",
            "jq": {
              "program": "./transforms/chat.jq"
            }
          }
        }
      }
    ]
  }
}
```

```yaml title="config.yaml"
channel:
  namespaces:
    - name: chat
      client_publication:
        transform:
          enabled: true
          engine: jq
          jq:
            program: ./transforms/chat.jq
```

:::tip Benefits of program files

- **Better IDE support** - Syntax highlighting and validation
- **Easier testing** - Test programs independently
- **Cleaner config** - Keep configuration files focused
- **Reusability** - Share programs across namespaces

:::

### Integration with schemas

Transformations work seamlessly with schema validation. The matched schema name is available in the transformation context.

**With schema validation:**

```yaml
channel:
  namespaces:
    - name: chat
      client_publication:
        schemas: ["chat_message"]  # Validate before transformation
        transform:
          enabled: true
          engine: jq
          jq:
            program: |
              {
                data: .data,
                tags: {
                  validated_schema: .schema_name,
                  user: .user
                }
              }
```

### Performance considerations

* **Compilation** - Programs are compiled once at startup and validated for correctness
* **Runtime** - Only program execution happens per publication
* **Engine choice** - Both jq and JavaScript have similar performance characteristics:
  - jq: ~10,000 ns/op for typical transformations
  - JavaScript: ~8,000 ns/op for typical transformations
* **Minimal overhead** - Simple transformations add negligible latency

:::info Benchmark results

Internal benchmarks show:
- Full transformation (data + tags + idempotency key): ~8-10μs per publication
- Minimal transformation (data only): ~1-2μs per publication

These are measured on modern hardware and represent worst-case scenarios. Actual performance may be better.

:::

### Complete transformation examples

**Multi-tenant chat with data enrichment:**

```yaml
channel:
  patterns: true
  namespaces:
    - name: tenant_chat
      pattern: /tenants/:tenant_id/rooms/:room_id/messages
      client_publication:
        schemas: ["chat_message"]
        transform:
          enabled: true
          engine: jq
          jq:
            program: |
              {
                data: {
                  message: .data.text,
                  author: {
                    id: .user,
                    role: .meta.role
                  },
                  room: .vars.room_id,
                  timestamp: .timestamp_ms
                },
                tags: {
                  tenant: .vars.tenant_id,
                  room: .vars.room_id,
                  priority: (if .meta.premium == true then "high" else "normal" end)
                },
                idempotency_key: (.vars.tenant_id + ":" + .user + ":" + (.timestamp_ms | tostring))
              }
        allow_publish_for_subscriber: true
```

**Reaction system with deduplication:**

```yaml
channel:
  namespaces:
    - name: reactions
      client_publication:
        schemas: ["reaction"]
        transform:
          enabled: true
          engine: js
          js:
            program: |
              (function(input) {
                var data = input.data;
                return {
                  data: {
                    emoji: data.emoji,
                    message_id: data.message_id,
                    user_id: input.user
                  },
                  tags: {
                    emoji_type: data.emoji,
                    user: input.user
                  },
                  idempotency_key: input.user + ":" + data.message_id + ":" + data.emoji
                };
              })
        allow_publish_for_subscriber: true
```

## Excluding client info

By default, Centrifugo includes client information in publications. For bandwidth optimization or privacy reasons, you can exclude this information:

```json title="config.json"
{
  "channel": {
    "without_namespace": {
      "client_publication": {
        "exclude_client_info": true
      },
      "allow_publish_for_subscriber": true
    }
  }
}
```

This prevents the `info` field from being included in publications.

:::tip

Use this option when:
* You want to reduce bandwidth usage
* Client identity is not needed by subscribers
* You're using transformations to provide necessary metadata in publication data or tags

:::

## Complete example

Here's a comprehensive example combining all features with transformations:

```json title="config.json"
{
  "schemas": [
    {
      "name": "reaction",
      "type": "jsonschema_draft_2020_12",
      "definition": "{\"type\":\"object\",\"properties\":{\"emoji\":{\"type\":\"string\"},\"message_id\":{\"type\":\"string\"}},\"required\":[\"emoji\",\"message_id\"],\"additionalProperties\":false}"
    }
  ],
  "channel": {
    "patterns": true,
    "namespaces": [
      {
        "name": "room_chat_reactions",
        "pattern": "/rooms/:room_id/reactions",
        "publication_data_format": "json",
        "client_publication": {
          "schemas": ["reaction"],
          "transform": {
            "enabled": true,
            "engine": "jq",
            "jq": {
              "program": "{data: {emoji: .data.emoji, message_id: .data.message_id, user_id: .user}, tags: {room: .vars.room_id, user: .user}, idempotency_key: (.user + \":\" + .data.message_id + \":\" + .data.emoji)}"
            }
          },
          "exclude_client_info": true
        },
        "allow_publish_for_subscriber": true
      }
    ]
  }
}
```

Or in YAML for better readability:

```yaml title="config.yaml"
schemas:
  - name: reaction
    definition: |
      {
        "type": "object",
        "properties": {
          "emoji": {"type": "string"},
          "message_id": {"type": "string"}
        },
        "required": ["emoji", "message_id"]
      }

channel:
  patterns: true
  namespaces:
    - name: room_chat_reactions
      pattern: /rooms/:room_id/reactions
      publication_data_format: json
      client_publication:
        schemas: [reaction]
        transform:
          enabled: true
          engine: jq
          jq:
            program: |
              {
                data: {
                  emoji: .data.emoji,
                  message_id: .data.message_id,
                  user_id: .user
                },
                tags: {
                  room: .vars.room_id,
                  user: .user
                },
                idempotency_key: (.user + ":" + .data.message_id + ":" + .data.emoji)
              }
        exclude_client_info: true
      allow_publish_for_subscriber: true
```

### Example with Empty Binary Schema

Here's an example using `empty_binary` schema for a typing indicator:

```json title="config.json"
{
  "schemas": [
    {
      "name": "typing",
      "type": "empty_binary"
    }
  ],
  "channel": {
    "patterns": true,
    "namespaces": [
      {
        "name": "room_typing",
        "pattern": "/rooms/:room_id/typing",
        "publication_data_format": "binary",
        "client_publication": {
          "schemas": ["typing"],
          "exclude_client_info": true
        },
        "allow_publish_for_subscriber": true
      }
    ]
  }
}
```

## Behavior

### Schema validation

* Publications are validated **before** transformation and broadcast
* If validation fails, the client receives an error and the publication is rejected
* Multiple schemas act as an OR condition - data must match at least one schema
* Schema names must reference schemas defined in the top-level `schemas` array
* The matched schema name is available to transformations via `schema_name` variable

### Transformation execution

* Transformations are executed **after** schema validation (if configured)
* Transform programs are compiled and validated at Centrifugo startup
* If transformation fails, the client receives an error and the publication is rejected
* Transformation output replaces the original publication data
* Tags generated in transformations are attached to publications

### Configuration validation

Centrifugo validates configurations at startup:

**Schema validation:**
* Schema `type` defaults to `jsonschema_draft_2020_12` if not specified
* JSON schemas (`jsonschema_draft_2020_12`) must have a `definition` field
* Empty binary schemas (`empty_binary`) must not have a `definition` field
* Schema type must be compatible with channel's `publication_data_format`:
  * `jsonschema_draft_2020_12` requires `publication_data_format: "json"`
  * `empty_binary` requires `publication_data_format: "binary"`
* All schemas referenced in `client_publication.schemas` must exist

**Transformation validation:**
* Transform programs are compiled at startup to validate syntax
* Program `engine` must be either `jq` or `js`
* Program `program` field can be inline code or a file path
* If file path is used, file must exist and be readable
* Invalid programs cause startup failure with descriptive error messages

### Bottom line

Generally speaking all the existing namespace options like recovery/positioning, delta compression, channel batching controls will apply to namespaces with ephemeral client publications also. Then it depends on the specific use case whether you would like to apply those or not.

## See also

* [Channel patterns](./channel_patterns.md) - use pattern variables in publication tags
* [Operation rate limiting](./rate_limiting.md) - rate limit ephemeral publications from client
