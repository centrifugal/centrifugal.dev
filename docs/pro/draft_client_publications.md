---
description: "Centrifugo PRO ephemeral client publications enable schema-validated messaging with server-side tag extraction, bypassing backend proxy for lower latency."
id: client_publications
title: Ephemeral client publications
sidebar_label: Ephemeral publications
---

Centrifugo PRO provides schema validation for client publications, enabling ephemeral messaging: client publications can pass through Centrifugo directly without involving backend proxy logic, reducing backend load and delivery latency. Normally the backend is required because it may validate and store messages in the main database, but for certain types of messages — such as typing notifications in a chat room — backend involvement adds unnecessary overhead. Centrifugo PRO offers an efficient way to address that.

## Overview

The feature consists of three parts which together provide a ground for ephemeral client publications:

* **Validation layer** - validate client publications based on JSON schema
* **Tag extraction** - attach tags to publications using JSON path or CEL rules
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
      "definition": "{\"type\":\"object\",\"properties\":{},\"additionalProperties\": false}"
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

## Tag extraction

Centrifugo PRO can attach [tags](../server/channels.md) to client publications, extracted from the publication data or the connection context at publish time — without a backend round-trip. This lets subscribers and server-side consumers filter or route on values derived from the message.

Tag rules are configured in `client_publication.tags` — a list of extraction rules. Each rule sets one tag from either a JSON **path** into the publication data, or a **CEL** expression, and may be applied conditionally. Tag extraction only **adds tags** — it does not modify the publication `data`, which is broadcast unchanged (after schema validation).

### Tag field options

| Field  | Type     | Description                                                                                                             |
|--------|----------|-----------------------------------------------------------------------------------------------------------------------|
| `key`  | `string` | Name of the tag to set.                                                                                               |
| `path` | `string` | JSON path into the publication data (dot notation, e.g. `user.name`, `metadata.room_id`). Set either `path` or `cel`, not both. |
| `cel`  | `string` | [CEL](./cel_expressions.md) expression computing the value, e.g. `data.emoji`. Set either `cel` or `path`, not both.  |
| `if`   | `string` | Optional CEL condition — the tag is set only when it evaluates to `true`, e.g. `schema_name == 'reaction'`.          |

Both `cel` and `if` expressions have access to these variables:

* `data` (object) - the publication data sent by the client
* `timestamp_ms` (int) - current server timestamp in milliseconds
* `schema_name` (string) - name of the matched schema (empty if no schemas configured)
* `user` (string) - user ID from connection credentials
* `client` (string) - client ID (unique connection identifier)
* `meta` (object) - connection metadata
* `vars` (object) - [channel pattern](./channel_patterns.md) variables

### Example

```json title="config.json"
{
  "channel": {
    "namespaces": [
      {
        "name": "reactions",
        "publication_data_format": "json",
        "client_publication": {
          "schemas": ["reaction"],
          "tags": [
            { "key": "emoji", "path": "emoji" },
            { "key": "user", "cel": "user" },
            { "key": "priority", "cel": "'high'", "if": "data.urgent == true" }
          ]
        },
        "allow_publish_for_subscriber": true
      }
    ]
  }
}
```

Or in YAML for better readability:

```yaml title="config.yaml"
channel:
  namespaces:
    - name: reactions
      publication_data_format: json
      client_publication:
        schemas: [reaction]
        tags:
          - key: emoji
            path: emoji
          - key: user
            cel: user
          - key: priority
            cel: "'high'"
            if: data.urgent == true
      allow_publish_for_subscriber: true
```

Tag rules are compiled and validated at startup, so a malformed `path` / `cel` / `if` fails fast rather than at publish time.

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
* You're using tags to provide the necessary metadata alongside publications

:::

## Complete example

Here's a comprehensive example combining all features:

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
          "tags": [
            { "key": "room", "cel": "vars.room_id" },
            { "key": "emoji", "path": "emoji" },
            { "key": "user", "cel": "user" }
          ],
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
        tags:
          - key: room
            cel: vars.room_id
          - key: emoji
            path: emoji
          - key: user
            cel: user
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

* Publications are validated **before** tag extraction and broadcast
* If validation fails, the client receives an error and the publication is rejected
* Multiple schemas act as an OR condition - data must match at least one schema
* Schema names must reference schemas defined in the top-level `schemas` array
* The matched schema name is available to tag rules via the `schema_name` variable

### Tag extraction

* Tags are extracted **after** schema validation (if configured)
* Each rule sets one tag from a JSON `path` or a `cel` expression, optionally gated by an `if` condition
* The original publication `data` is broadcast **unchanged** — tag extraction only adds tags, it does not transform the data
* Extracted tags are attached to the publication

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

**Tag rule validation:**
* Each tag rule must set exactly one of `path` or `cel`
* `cel` and `if` expressions are compiled at startup to validate syntax
* Invalid expressions cause startup failure with descriptive error messages

### Bottom line

Generally speaking, all the existing namespace options like recovery/positioning, delta compression, and channel batching controls will also apply to namespaces with ephemeral client publications. Then it depends on the specific use case whether you would like to apply those or not.

## See also

* [Channel patterns](./channel_patterns.md) - use pattern variables in publication tags
* [Operation rate limiting](./rate_limiting.md) - rate limit ephemeral publications from client
