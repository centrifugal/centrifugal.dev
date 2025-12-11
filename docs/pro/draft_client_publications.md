---
id: client_publications
title: Ephemeral client publications
sidebar_label: Ephemeral publications
---

Centrifugo PRO provides schema validation for client publications, enabling ephemeral messaging: client publications can pass through Centrifugo directly without involving backend proxy logic, reducing backend load and delivery latency. Normally the backend is required because it may validate and store messages in the main database, but for certain types of messages—such as typing notifications in a chat room—backend involvement adds unnecessary overhead. Centrifugo PRO offers an efficient way to address that.

## Overview

The feature consists of three parts which together provide a ground for ephemeral client publications:

* **Validation layer** - validate client publications based on JSON schema
* **Bandwidth optimization** - optionally exclude client info from publications to reduce message size
* **Server-side tagging** - attach custom tags to publications that cannot be spoofed by clients

## Configuration

### Defining schemas

Schemas are defined at the top level of Centrifugo configuration using JSON Schema format.

:::info Security Default

For security, Centrifugo automatically sets `"additionalProperties": false` on object-type schemas unless explicitly specified otherwise. This prevents clients from injecting unexpected fields into validated data.

:::

#### Inline schema definition

You can define schemas directly in your configuration file:

```json title="config.json"
{
  "schemas": [
    {
      "name": "chat_message",
      "definition": "{\"type\":\"object\",\"properties\":{\"text\":{\"type\":\"string\",\"maxLength\":500}},\"required\":[\"text\"]}"
    }
  ]
}
```

For better readability in YAML, use multiline strings:

```yaml title="config.yaml"
schemas:
  - name: chat_message
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

Use `client_publication_data_schemas` in channel or namespace configuration to apply validation:

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
        "client_publication_data_schemas": ["typing"],
        "allow_publish_for_subscriber": true
      }
    ]
  }
}
```

### Multiple schemas

When multiple schemas are configured, the publication data must match **at least one** of them. This allows supporting different message types in the same channel:

```json
{
  "channel": {
    "namespaces": [
      {
        "name": "ephemeral",
        "client_publication_data_schemas": ["typing", "reaction"],
        "allow_publish_for_subscriber": true
      }
    ]
  }
}
```

## Client publication tags

Client publication tags allow you to attach server-side metadata to publications that clients cannot forge. This is useful for analytics, routing, or adding contextual information.

### Configuration

Tags are defined as key-value pairs. Tag values can be:

1. **Literal strings** - Used as-is without any processing
2. **CEL expressions** - Wrapped in `${...}` for dynamic values and conditional logic

CEL expressions are **pre-compiled and validated at startup**, ensuring type safety and optimal runtime performance.

```json title="config.json"
{
  "channel": {
    "without_namespace": {
      "client_publication_tags": [
        {"key": "user_id", "value": "${user}"},
        {"key": "client_id", "value": "${client}"},
        {"key": "environment", "value": "production"}
      ]
    }
  }
}
```

### Available CEL variables

CEL expressions in client publication tags have access to the following variables:

* `user` (string) - User ID from connection credentials
* `client` (string) - Client ID (unique connection identifier)
* `timestamp_ms` (int) - Current server timestamp in milliseconds (Unix epoch)
* `meta` (map) - Connection metadata (access nested fields like `meta.tenant_id` or `meta.user.role`)
* `vars` (map) - Channel pattern variables (requires [channel patterns](./channel_patterns.md))

All CEL expressions must return a **string type** and are validated at configuration load time.

### Examples

**Literal strings and simple variables:**

```json
{
  "client_publication_tags": [
    {"key": "user_id", "value": "${user}"},
    {"key": "environment", "value": "production"}
  ]
}
```

**Conditional logic with ternary operator:**

```json
{
  "client_publication_tags": [
    {"key": "tier", "value": "${meta.premium ? 'premium' : 'free'}"},
    {"key": "msg_type", "value": "${vars.room_id == 'chat' ? 'reaction' : 'typing'}"}
  ]
}
```

**String concatenation:**

```json
{
  "client_publication_tags": [
    {"key": "label", "value": "${user + ':' + meta.role}"}
  ]
}
```

**Complex boolean logic:**

```json
{
  "client_publication_tags": [
    {"key": "access", "value": "${meta.role == 'admin' || meta.role == 'moderator' ? 'full' : 'limited'}"}
  ]
}
```

**Multi-tenant with channel patterns:**

```json title="config.json"
{
  "channel": {
    "patterns": true,
    "namespaces": [
      {
        "name": "tenant_chat",
        "pattern": "/tenants/:tenant_id/chat",
        "client_publication_tags": [
          {"key": "tenant", "value": "${vars.tenant_id}"},
          {"key": "user", "value": "${user}"},
          {"key": "region", "value": "${meta.region}"}
        ],
        "allow_publish_for_subscriber": true
      }
    ]
  }
}
```

:::info Performance

CEL expressions are pre-compiled at startup and validated to return string types. At runtime, only the evaluation happens, making the performance impact minimal. Connection metadata is only accessed when CEL expressions reference it.

:::

## Excluding client info

By default, Centrifugo includes client information in publications. For bandwidth optimization or privacy reasons, you can exclude this information:

```json title="config.json"
{
  "channel": {
    "without_namespace": {
      "client_publication_exclude_client_info": true,
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
* You're using client publication tags to provide necessary metadata

:::

## Complete example

Here's a comprehensive example combining all features:

```json title="config.json"
{
  "schemas": [
    {
      "name": "reaction",
      "definition": "{\"type\":\"object\",\"properties\":{\"emoji\":{\"type\":\"string\"},\"message_id\":{\"type\":\"string\"}},\"required\":[\"emoji\",\"message_id\"],\"additionalProperties\":false}"
    }
  ],
  "channel": {
    "patterns": true,
    "namespaces": [
      {
        "name": "room_chat_reactions",
        "pattern": "/rooms/:room_id/reactions",
        "client_publication_data_schemas": ["reaction"],
        "client_publication_tags": [
          {"key": "user_id", "value": "${user}"},
          {"key": "room_id", "value": "${vars.room_id}"}
        ],
        "client_publication_exclude_client_info": true,
        "allow_publish_for_subscriber": true
      }
    ]
  }
}
```

## Behavior

### Schema validation

* Publications are validated **before** being broadcast to subscribers
* If validation fails, the client receives an error and the publication is rejected
* Multiple schemas act as an OR condition - data must match at least one schema
* Schema names must reference schemas defined in the top-level `schemas` array

## See also

* [Channel patterns](./channel_patterns.md) - Use pattern variables in publication tags
* [Operation rate limiting](./rate_limiting.md) - To rate limit ephemeral publications from client
