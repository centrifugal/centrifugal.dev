import React from 'react';

function convert(sourceObj, pathMap) {
    const newConfig = {};
    const log = [];

    function setNestedValue(obj, sourcePath, path, value) {
        const keys = path.split(".");
        let current = obj;

        // Traverse the path, creating intermediate objects as necessary
        for (let i = 0; i < keys.length - 1; i++) {
            const key = keys[i];
            if (!current[key]) {
                current[key] = {};
            }
            current = current[key];
        }

        // Set the final key to the value
        const lastKey = keys[keys.length - 1];
        current[lastKey] = value;

        // Log the action taken
        log.push(`migrate value from "${sourcePath}" to path "${path}"`);
    }

    // Iterate through the pathMap to transfer values
    for (const [sourcePath, destPath] of Object.entries(pathMap)) {
        // Extract value from source object
        const value = sourcePath.split('.').reduce((acc, key) => acc && acc[key], sourceObj);
        // Only set if the value exists in the source object
        if (value !== undefined) {
            setNestedValue(newConfig, sourcePath, destPath, value);
        }
    }

    // Log entries for keys in sourceObj that are not in pathMap
    for (const key in sourceObj) {
        if (!pathMap.hasOwnProperty(key)) {
            log.push(`Source key "${key}" found in source but not present in migration map, not migrated.`);
        }
    }

    // Insert enabled: true/false for consumers.
    if (sourceObj.consumers) {
        newConfig.consumers = sourceObj.consumers.map(consumer => {
            if (!consumer.disabled) {
                log.push(`Inject enabled: true to consumer "${consumer.name}"`);
                return {...consumer, enabled: true};
            }
            if (consumer.disabled) {
                log.push(`Inject enabled: false to consumer "${consumer.name}" because it was disabled`);
                return {...consumer, enabled: false};
            }
            return consumer;
        });
    }

    // Migrate common proxy fields to individual proxies.
    if (newConfig.client && newConfig.client.proxy && newConfig.client.proxy.connect && newConfig.client.proxy.connect.endpoint) {
        newConfig.client.proxy.connect.enabled = true;
        newConfig.client.proxy.connect.http = {}
        if (sourceObj.proxy_http_status_code_transforms) {
            newConfig.client.proxy.connect.http.status_to_code_transforms = sourceObj.proxy_http_status_code_transforms;
            log.push(`migrate value from "proxy_http_status_code_transforms" to path "client.proxy.connect.http.status_to_code_transforms"`);
        }
        if (sourceObj.proxy_grpc_metadata) {
            newConfig.client.proxy.connect.grpc_metadata = sourceObj.proxy_grpc_metadata;
            log.push(`migrate value from "proxy_grpc_metadata" to path "client.proxy.connect.grpc_metadata"`);
        }
        if (sourceObj.proxy_http_headers) {
            newConfig.client.proxy.connect.http_headers = sourceObj.proxy_http_headers;
            log.push(`migrate value from "proxy_http_headers" to path "client.proxy.connect.http_headers"`);
        }
        if (sourceObj.proxy_static_http_headers) {
            newConfig.client.proxy.connect.http.static_headers = sourceObj.proxy_static_http_headers;
            log.push(`migrate value from "proxy_static_http_headers" to path "client.proxy.connect.http.static_headers"`);
        }
        if (sourceObj.proxy_binary_encoding) {
            newConfig.client.proxy.connect.binary_encoding = sourceObj.proxy_binary_encoding;
            log.push(`migrate value from "proxy_binary_encoding" to path "client.proxy.connect.binary_encoding"`);
        }
        if (sourceObj.proxy_include_connection_meta) {
            newConfig.client.proxy.connect.include_connection_meta = sourceObj.proxy_include_connection_meta;
            log.push(`migrate value from "proxy_include_connection_meta" to path "client.proxy.connect.include_connection_meta"`);
        }
        newConfig.client.proxy.connect.grpc = {};
        if (sourceObj.proxy_grpc_compression) {
            newConfig.client.proxy.connect.grpc.compression = sourceObj.proxy_grpc_compression;
            log.push(`migrate value from "proxy_grpc_compression" to path "client.proxy.connect.grpc.compression"`);
        }
        if (sourceObj.proxy_grpc_tls) {
            newConfig.client.proxy.connect.grpc.tls = sourceObj.proxy_grpc_tls;
            log.push(`migrate value from "proxy_grpc_tls" to path "client.proxy.connect.grpc.tls"`);
        }
        if (sourceObj.proxy_grpc_credentials_key) {
            newConfig.client.proxy.connect.grpc.credentials_key = sourceObj.proxy_grpc_credentials_key;
            log.push(`migrate value from "proxy_grpc_credentials_key" to path "client.proxy.connect.grpc.credentials_key"`);
        }
        if (sourceObj.proxy_grpc_credentials_value) {
            newConfig.client.proxy.connect.grpc.credentials_value = sourceObj.proxy_grpc_credentials_value;
            log.push(`migrate value from "proxy_grpc_credentials_value" to path "client.proxy.connect.grpc.credentials_value"`);
        }
    }

    if (newConfig.client && newConfig.client.proxy && newConfig.client.proxy.refresh && newConfig.client.proxy.refresh.endpoint) {
        newConfig.client.proxy.refresh.enabled = true;

        newConfig.client.proxy.refresh.http = {}
        if (sourceObj.proxy_http_status_code_transforms) {
            newConfig.client.proxy.refresh.http.status_to_code_transforms = sourceObj.proxy_http_status_code_transforms;
            log.push(`migrate value from "proxy_http_status_code_transforms" to path "client.proxy.refresh.http.status_to_code_transforms"`);
        }
        if (sourceObj.proxy_grpc_metadata) {
            newConfig.refresh.proxy.connect.grpc_metadata = sourceObj.proxy_grpc_metadata;
            log.push(`migrate value from "proxy_grpc_metadata" to path "client.proxy.refresh.grpc_metadata"`);
        }
        if (sourceObj.proxy_http_headers) {
            newConfig.client.proxy.refresh.http_headers = sourceObj.proxy_http_headers;
            log.push(`migrate value from "proxy_http_headers" to path "client.proxy.refresh.http_headers"`);
        }
        if (sourceObj.proxy_static_http_headers) {
            newConfig.client.proxy.refresh.http.static_headers = sourceObj.proxy_static_http_headers;
            log.push(`migrate value from "proxy_static_http_headers" to path "client.proxy.refresh.http.static_headers"`);
        }
        if (sourceObj.proxy_binary_encoding) {
            newConfig.client.proxy.refresh.binary_encoding = sourceObj.proxy_binary_encoding;
            log.push(`migrate value from "proxy_binary_encoding" to path "client.proxy.refresh.binary_encoding"`);
        }
        if (sourceObj.proxy_include_connection_meta) {
            newConfig.client.proxy.refresh.include_connection_meta = sourceObj.proxy_include_connection_meta;
            log.push(`migrate value from "proxy_include_connection_meta" to path "client.proxy.refresh.include_connection_meta"`);
        }
        newConfig.client.proxy.refresh.grpc = {};
        if (sourceObj.proxy_grpc_compression) {
            newConfig.client.proxy.refresh.grpc.compression = sourceObj.proxy_grpc_compression;
            log.push(`migrate value from "proxy_grpc_compression" to path "client.proxy.refresh.grpc.compression"`);
        }
        if (sourceObj.proxy_grpc_tls) {
            newConfig.client.proxy.refresh.grpc.tls = sourceObj.proxy_grpc_tls;
            log.push(`migrate value from "proxy_grpc_tls" to path "client.proxy.refresh.grpc.tls"`);
        }
        if (sourceObj.proxy_grpc_credentials_key) {
            newConfig.client.proxy.refresh.grpc.credentials_key = sourceObj.proxy_grpc_credentials_key;
            log.push(`migrate value from "proxy_grpc_credentials_key" to path "client.proxy.refresh.grpc.credentials_key"`);
        }
        if (sourceObj.proxy_grpc_credentials_value) {
            newConfig.client.proxy.refresh.grpc.credentials_value = sourceObj.proxy_grpc_credentials_value;
            log.push(`migrate value from "proxy_grpc_credentials_value" to path "client.proxy.refresh.grpc.credentials_value"`);
        }
    }

    if (newConfig.channel && newConfig.channel.proxy && newConfig.channel.proxy.subscribe && newConfig.channel.proxy.subscribe.endpoint) {
        newConfig.client.proxy.subscribe.http = {}
        if (sourceObj.proxy_http_status_code_transforms) {
            newConfig.channel.proxy.subscribe.http.status_to_code_transforms = sourceObj.proxy_http_status_code_transforms;
            log.push(`migrate value from "proxy_http_status_code_transforms" to path "client.proxy.subscribe.http.status_to_code_transforms"`);
        }
        if (sourceObj.proxy_grpc_metadata) {
            newConfig.channel.proxy.subscribe.grpc_metadata = sourceObj.proxy_grpc_metadata;
            log.push(`migrate value from "proxy_grpc_metadata" to path "channel.proxy.subscribe.grpc_metadata"`);
        }
        if (sourceObj.proxy_http_headers) {
            newConfig.channel.proxy.subscribe.http_headers = sourceObj.proxy_http_headers;
            log.push(`migrate value from "proxy_http_headers" to path "channel.proxy.subscribe.http_headers"`);
        }
        if (sourceObj.proxy_static_http_headers) {
            newConfig.channel.proxy.subscribe.http.static_headers = sourceObj.proxy_static_http_headers;
            log.push(`migrate value from "proxy_static_http_headers" to path "channel.proxy.subscribe.http.static_headers"`);
        }
        if (sourceObj.proxy_binary_encoding) {
            newConfig.channel.proxy.subscribe.binary_encoding = sourceObj.proxy_binary_encoding;
            log.push(`migrate value from "proxy_binary_encoding" to path "channel.proxy.subscribe.binary_encoding"`);
        }
        if (sourceObj.proxy_include_connection_meta) {
            newConfig.channel.proxy.subscribe.include_connection_meta = sourceObj.proxy_include_connection_meta;
            log.push(`migrate value from "proxy_include_connection_meta" to path "channel.proxy.subscribe.include_connection_meta"`);
        }
        newConfig.channel.proxy.subscribe.grpc = {};
        if (sourceObj.proxy_grpc_compression) {
            newConfig.channel.proxy.subscribe.grpc.compression = sourceObj.proxy_grpc_compression;
            log.push(`migrate value from "proxy_grpc_compression" to path "channel.proxy.subscribe.grpc.compression"`);
        }
        if (sourceObj.proxy_grpc_tls) {
            newConfig.channel.proxy.subscribe.grpc.tls = sourceObj.proxy_grpc_tls;
            log.push(`migrate value from "proxy_grpc_tls" to path "channel.proxy.subscribe.grpc.tls"`);
        }
        if (sourceObj.proxy_grpc_credentials_key) {
            newConfig.channel.proxy.subscribe.grpc.credentials_key = sourceObj.proxy_grpc_credentials_key;
            log.push(`migrate value from "proxy _grpc_credentials_key" to path "channel.proxy.subscribe.grpc.credentials_key"`);
        }
    }

    if (newConfig.channel && newConfig.channel.proxy && newConfig.channel.proxy.publish && newConfig.channel.proxy.publish.endpoint) {
        newConfig.client.proxy.publish.http = {}
        if (sourceObj.proxy_http_status_code_transforms) {
            newConfig.channel.proxy.publish.http.status_to_code_transforms = sourceObj.proxy_http_status_code_transforms;
            log.push(`migrate value from "proxy_http_status_code_transforms" to path "client.proxy.publish.http.status_to_code_transforms"`);
        }
        if (sourceObj.proxy_grpc_metadata) {
            newConfig.channel.proxy.publish.grpc_metadata = sourceObj.proxy_grpc_metadata;
            log.push(`migrate value from "proxy_grpc_metadata" to path "channel.proxy.publish.grpc_metadata"`);
        }
        if (sourceObj.proxy_http_headers) {
            newConfig.channel.proxy.publish.http_headers = sourceObj.proxy_http_headers;
            log.push(`migrate value from "proxy_http_headers" to path "channel.proxy.publish.http_headers"`);
        }
        if (sourceObj.proxy_static_http_headers) {
            newConfig.channel.proxy.publish.http.static_headers = sourceObj.proxy_static_http_headers;
            log.push(`migrate value from "proxy_static_http_headers" to path "channel.proxy.publish.http.static_headers"`);
        }
        if (sourceObj.proxy_binary_encoding) {
            newConfig.channel.proxy.publish.binary_encoding = sourceObj.proxy_binary_encoding;
            log.push(`migrate value from "proxy_binary_encoding" to path "channel.proxy.publish.binary_encoding"`);
        }
        if (sourceObj.proxy_include_connection_meta) {
            newConfig.channel.proxy.publish.include_connection_meta = sourceObj.proxy_include_connection_meta;
            log.push(`migrate value from "proxy_include_connection_meta" to path "channel.proxy.publish.include_connection_meta"`);
        }
        newConfig.channel.proxy.publish.grpc = {};
        if (sourceObj.proxy_grpc_compression) {
            newConfig.channel.proxy.publish.grpc.compression = sourceObj.proxy_grpc_compression;
            log.push(`migrate value from "proxy_grpc_compression" to path "channel.proxy.publish.grpc.compression"`);
        }
        if (sourceObj.proxy_grpc_tls) {
            newConfig.channel.proxy.publish.grpc.tls = sourceObj.proxy_grpc_tls;
            log.push(`migrate value from "proxy_grpc_tls" to path "channel.proxy.publish.grpc.tls"`);
        }
        if (sourceObj.proxy_grpc_credentials_key) {
            newConfig.channel.proxy.publish.grpc.credentials_key = sourceObj.proxy_grpc_credentials_key;
            log.push(`migrate value from "proxy_grpc_credentials_key" to path "channel.proxy.publish.grpc.credentials_key"`);
        }
        if (sourceObj.proxy_grpc_credentials_value) {
            newConfig.channel.proxy.publish.grpc.credentials_value = sourceObj.proxy_grpc_credentials_value;
            log.push(`migrate value from "proxy_grpc_credentials_value" to path "channel.proxy.publish.grpc.credentials_value"`);
        }
    }

    if (newConfig.channel && newConfig.channel.proxy && newConfig.channel.proxy.sub_refresh && newConfig.channel.proxy.sub_refresh.endpoint) {
        newConfig.client.proxy.sub_refresh.http = {}
        if (sourceObj.proxy_http_status_code_transforms) {
            newConfig.channel.proxy.sub_refresh.http.status_to_code_transforms = sourceObj.proxy_http_status_code_transforms;
            log.push(`migrate value from "proxy_http_status_code_transforms" to path "client.proxy.sub_refresh.http.status_to_code_transforms"`);
        }
        if (sourceObj.proxy_grpc_metadata) {
            newConfig.channel.proxy.sub_refresh.grpc_metadata = sourceObj.proxy_grpc_metadata;
            log.push(`migrate value from "proxy_grpc_metadata" to path "channel.proxy.sub_refresh.grpc_metadata"`);
        }
        if (sourceObj.proxy_http_headers) {
            newConfig.channel.proxy.sub_refresh.http_headers = sourceObj.proxy_http_headers;
            log.push(`migrate value from "proxy_http_headers" to path "channel.proxy.sub_refresh.http_headers"`);
        }
        if (sourceObj.proxy_static_http_headers) {
            newConfig.channel.proxy.sub_refresh.http.static_headers = sourceObj.proxy_static_http_headers;
            log.push(`migrate value from "proxy_static_http_headers" to path "channel.proxy.sub_refresh.http.static_headers"`);
        }
        if (sourceObj.proxy_binary_encoding) {
            newConfig.channel.proxy.sub_refresh.binary_encoding = sourceObj.proxy_binary_encoding;
            log.push(`migrate value from "proxy_binary_encoding" to path "channel.proxy.sub_refresh.binary_encoding"`);
        }
        if (sourceObj.proxy_include_connection_meta) {
            newConfig.channel.proxy.sub_refresh.include_connection_meta = sourceObj.proxy_include_connection_meta;
            log.push(`migrate value from "proxy_include_connection_meta" to path "channel.proxy.sub_refresh.include_connection_meta"`);
        }
        newConfig.channel.proxy.sub_refresh.grpc = {};
        if (sourceObj.proxy_grpc_compression) {
            newConfig.channel.proxy.sub_refresh.grpc.compression = sourceObj.proxy_grpc_compression;
            log.push(`migrate value from "proxy_grpc_compression" to path "channel.proxy.sub_refresh.grpc.compression"`);
        }
        if (sourceObj.proxy_grpc_tls) {
            newConfig.channel.proxy.sub_refresh.grpc.tls = sourceObj.proxy_grpc_tls;
            log.push(`migrate value from "proxy_grpc_tls" to path "channel.proxy.sub_refresh.grpc.tls"`);
        }
        if (sourceObj.proxy_grpc_credentials_key) {
            newConfig.channel.proxy.sub_refresh.grpc.credentials_key = sourceObj.proxy_grpc_credentials_key;
            log.push(`migrate value from "proxy_grpc_credentials_key" to path "channel.proxy.sub_refresh.grpc.credentials_key"`);
        }
        if (sourceObj.proxy_grpc_credentials_value) {
            newConfig.channel.proxy.sub_refresh.grpc.credentials_value = sourceObj.proxy_grpc_credentials_value;
            log.push(`migrate value from "proxy_grpc_credentials_value" to path "channel.proxy.sub_refresh.grpc.credentials_value"`);
        }
    }

    if (newConfig.channel && newConfig.channel.proxy && newConfig.channel.proxy.subscribe_stream && newConfig.channel.proxy.subscribe_stream.endpoint) {
        newConfig.client.proxy.subscribe_stream.http = {}
        if (sourceObj.proxy_grpc_metadata) {
            newConfig.channel.proxy.subscribe_stream.grpc_metadata = sourceObj.proxy_grpc_metadata;
            log.push(`migrate value from "proxy_grpc_metadata" to path "channel.proxy.subscribe_stream.grpc_metadata"`);
        }
        if (sourceObj.proxy_http_headers) {
            newConfig.channel.proxy.subscribe_stream.http_headers = sourceObj.proxy_http_headers;
            log.push(`migrate value from "proxy_http_headers" to path "channel.proxy.subscribe_stream.http_headers"`);
        }
        if (sourceObj.proxy_static_http_headers) {
            newConfig.channel.proxy.subscribe_stream.http.static_headers = sourceObj.proxy_static_http_headers;
            log.push(`migrate value from "proxy_static_http_headers" to path "channel.proxy.subscribe_stream.http.static_headers"`);
        }
        if (sourceObj.proxy_binary_encoding) {
            newConfig.channel.proxy.subscribe_stream.binary_encoding = sourceObj.proxy_binary_encoding;
            log.push(`migrate value from "proxy_binary_encoding" to path "channel.proxy.subscribe_stream.binary_encoding"`);
        }
        if (sourceObj.proxy_include_connection_meta) {
            newConfig.channel.proxy.subscribe_stream.include_connection_meta = sourceObj.proxy_include_connection_meta;
            log.push(`migrate value from "proxy_include_connection_meta" to path "channel.proxy.subscribe_stream.include_connection_meta"`);
        }
        newConfig.channel.proxy.subscribe_stream.grpc = {};
        if (sourceObj.proxy_grpc_compression) {
            newConfig.channel.proxy.subscribe_stream.grpc.compression = sourceObj.proxy_grpc_compression;
            log.push(`migrate value from "proxy_grpc_compression" to path "channel.proxy.subscribe_stream.grpc.compression"`);
        }
        if (sourceObj.proxy_grpc_tls) {
            newConfig.channel.proxy.subscribe_stream.grpc.tls = sourceObj.proxy_grpc_tls;
            log.push(`migrate value from "proxy_grpc_tls" to path "channel.proxy.subscribe_stream.grpc.tls"`);
        }
        if (sourceObj.proxy_grpc_credentials_key) {
            newConfig.channel.proxy.subscribe_stream.grpc.credentials_key = sourceObj.proxy_grpc_credentials_key;
            log.push(`migrate value from "proxy_grpc_credentials_key" to path "channel.proxy.subscribe_stream.grpc.credentials_key"`);
        }
        if (sourceObj.proxy_grpc_credentials_value) {
            newConfig.channel.proxy.subscribe_stream.grpc.credentials_value = sourceObj.proxy_grpc_credentials_value;
            log.push(`migrate value from "proxy_grpc_credentials_value" to path "channel.proxy.subscribe_stream.grpc.credentials_value"`);
        }
    }

    if (newConfig.channel && newConfig.channel.proxy && newConfig.channel.proxy.state && newConfig.channel.proxy.state.endpoint) {
        newConfig.client.proxy.state.http = {}
        if (sourceObj.proxy_grpc_metadata) {
            newConfig.channel.proxy.state.grpc_metadata = sourceObj.proxy_grpc_metadata;
            log.push(`migrate value from "proxy_grpc_metadata" to path "channel.proxy.state.grpc_metadata"`);
        }
        if (sourceObj.proxy_http_headers) {
            newConfig.channel.proxy.state.http_headers = sourceObj.proxy_http_headers;
            log.push(`migrate value from "proxy_http_headers" to path "channel.proxy.state.http_headers"`);
        }
        if (sourceObj.proxy_static_http_headers) {
            newConfig.channel.proxy.state.http.static_headers = sourceObj.proxy_static_http_headers;
            log.push(`migrate value from "proxy_static_http_headers" to path "channel.proxy.state.http.static_headers"`);
        }
        if (sourceObj.proxy_binary_encoding) {
            newConfig.channel.proxy.state.binary_encoding = sourceObj.proxy_binary_encoding;
            log.push(`migrate value from "proxy_binary_encoding" to path "channel.proxy.state.binary_encoding"`);
        }
        if (sourceObj.proxy_include_connection_meta) {
            newConfig.channel.proxy.state.include_connection_meta = sourceObj.proxy_include_connection_meta;
            log.push(`migrate value from "proxy_include_connection_meta" to path "channel.proxy.state.include_connection_meta"`);
        }
        newConfig.channel.proxy.state.grpc = {};
        if (sourceObj.proxy_grpc_compression) {
            newConfig.channel.proxy.state.grpc.compression = sourceObj.proxy_grpc_compression;
            log.push(`migrate value from "proxy_grpc_compression" to path "channel.proxy.state.grpc.compression"`);
        }
        if (sourceObj.proxy_grpc_tls) {
            newConfig.channel.proxy.state.grpc.tls = sourceObj.proxy_grpc_tls;
            log.push(`migrate value from "proxy_grpc_tls" to path "channel.proxy.state.grpc.tls"`);
        }
        if (sourceObj.proxy_grpc_credentials_key) {
            newConfig.channel.proxy.state.grpc.credentials_key = sourceObj.proxy_grpc_credentials_key;
            log.push(`migrate value from "proxy_grpc_credentials_key" to path "channel.proxy.state.grpc.credentials_key"`);
        }
        if (sourceObj.proxy_grpc_credentials_value) {
            newConfig.channel.proxy.state.grpc.credentials_value = sourceObj.proxy_grpc_credentials_value;
            log.push(`migrate value from "proxy_grpc_credentials_value" to path "channel.proxy.state.grpc.credentials_value"`);
        }
    }

    if (newConfig.channel && newConfig.channel.proxy && newConfig.channel.proxy.cache_empty && newConfig.channel.proxy.cache_empty.endpoint) {
        newConfig.client.proxy.cache_empty.http = {}
        if (sourceObj.proxy_grpc_metadata) {
            newConfig.channel.proxy.cache_empty.grpc_metadata = sourceObj.proxy_grpc_metadata;
            log.push(`migrate value from "proxy_grpc_metadata" to path "channel.proxy.cache_empty.grpc_metadata"`);
        }
        if (sourceObj.proxy_http_headers) {
            newConfig.channel.proxy.cache_empty.http_headers = sourceObj.proxy_http_headers;
            log.push(`migrate value from "proxy_http_headers" to path "channel.proxy.cache_empty.http_headers"`);
        }
        if (sourceObj.proxy_static_http_headers) {
            newConfig.channel.proxy.cache_empty.http.static_headers = sourceObj.proxy_static_http_headers;
            log.push(`migrate value from "proxy_static_http_headers" to path "channel.proxy.cache_empty.http.static_headers"`);
        }
        if (sourceObj.proxy_binary_encoding) {
            newConfig.channel.proxy.cache_empty.binary_encoding = sourceObj.proxy_binary_encoding;
            log.push(`migrate value from "proxy_binary_encoding" to path "channel.proxy.cache_empty.binary_encoding"`);
        }
        if (sourceObj.proxy_include_connection_meta) {
            newConfig.channel.proxy.cache_empty.include_connection_meta = sourceObj.proxy_include_connection_meta;
            log.push(`migrate value from "proxy_include_connection_meta" to path "channel.proxy.cache_empty.include_connection_meta"`);
        }
        newConfig.channel.proxy.cache_empty.grpc = {};
        if (sourceObj.proxy_grpc_compression) {
            newConfig.channel.proxy.cache_empty.grpc.compression = sourceObj.proxy_grpc_compression;
            log.push(`migrate value from "proxy_grpc_compression" to path "channel.proxy.cache_empty.grpc.compression"`);
        }
        if (sourceObj.proxy_grpc_tls) {
            newConfig.channel.proxy.cache_empty.grpc.tls = sourceObj.proxy_grpc_tls;
            log.push(`migrate value from "proxy_grpc_tls" to path "channel.proxy.cache_empty.grpc.tls"`);
        }
        if (sourceObj.proxy_grpc_credentials_key) {
            newConfig.channel.proxy.cache_empty.grpc.credentials_key = sourceObj.proxy_grpc_credentials_key;
            log.push(`migrate value from "proxy_grpc_credentials_key" to path "channel.proxy.cache_empty.grpc.credentials_key"`);
        }
        if (sourceObj.proxy_grpc_credentials_value) {
            newConfig.channel.proxy.cache_empty.grpc.credentials_value = sourceObj.proxy_grpc_credentials_value;
            log.push(`migrate value from "proxy_grpc_credentials_value" to path "channel.proxy.cache_empty.grpc.credentials_value"`);
        }
    }

    if (newConfig.rpc && newConfig.rpc.proxy && newConfig.rpc.proxy.endpoint) {
        newConfig.rpc.proxy.http = {}
        if (sourceObj.proxy_http_status_code_transforms) {
            newConfig.rpc.proxy.http.status_to_code_transforms = sourceObj.proxy_http_status_code_transforms;
            log.push(`migrate value from "proxy_http_status_code_transforms" to path "rpc.proxy.http.status_to_code_transforms"`);
        }
        if (sourceObj.proxy_grpc_metadata) {
            newConfig.rpc.proxy.grpc_metadata = sourceObj.proxy_grpc_metadata;
            log.push(`migrate value from "proxy_grpc_metadata" to path "rpc.proxy.grpc_metadata"`);
        }
        if (sourceObj.proxy_http_headers) {
            newConfig.rpc.proxy.http_headers = sourceObj.proxy_http_headers;
            log.push(`migrate value from "proxy_http_headers" to path "rpc.proxy.http_headers"`);
        }
        if (sourceObj.proxy_static_http_headers) {
            newConfig.rpc.proxy.http.static_headers = sourceObj.proxy_static_http_headers;
            log.push(`migrate value from "proxy_static_http_headers" to path "rpc.proxy.http.static_headers"`);
        }
        if (sourceObj.proxy_binary_encoding) {
            newConfig.rpc.proxy.binary_encoding = sourceObj.proxy_binary_encoding;
            log.push(`migrate value from "proxy_binary_encoding" to path "rpc.proxy.binary_encoding"`);
        }
        if (sourceObj.proxy_include_connection_meta) {
            newConfig.rpc.proxy.include_connection_meta = sourceObj.proxy_include_connection_meta;
            log.push(`migrate value from "proxy_include_connection_meta" to path "rpc.proxy.include_connection_meta"`);
        }
        newConfig.rpc.proxy.grpc = {};
        if (sourceObj.proxy_grpc_compression) {
            newConfig.rpc.proxy.grpc.compression = sourceObj.proxy_grpc_compression;
            log.push(`migrate value from "proxy_grpc_compression" to path "rpc.proxy.grpc.compression"`);
        }
        if (sourceObj.proxy_grpc_tls) {
            newConfig.rpc.proxy.grpc.tls = sourceObj.proxy_grpc_tls;
            log.push(`migrate value from "proxy_grpc_tls" to path "rpc.proxy.grpc.tls"`);
        }
        if (sourceObj.proxy_grpc_credentials_key) {
            newConfig.rpc.proxy.grpc.credentials_key = sourceObj.proxy_grpc_credentials_key;
            log.push(`migrate value from "proxy_grpc_credentials_key" to path "rpc.proxy.grpc.credentials_key"`);
        }
        if (sourceObj.proxy_grpc_credentials_value) {
            newConfig.rpc.proxy.grpc.credentials_value = sourceObj.proxy_grpc_credentials_value;
            log.push(`migrate value from "proxy_grpc_credentials_value" to path "rpc.proxy.grpc.credentials_value"`);
        }
    }

    // now proxy fields migrated to corresponding objects and can be removed.
    delete newConfig.proxy_http_status_code_transforms;
    delete newConfig.proxy_grpc_metadata;
    delete newConfig.proxy_http_headers;
    delete newConfig.proxy_static_http_headers;
    delete newConfig.proxy_binary_encoding;
    delete newConfig.proxy_include_connection_meta;
    delete newConfig.proxy_grpc_compression;
    delete newConfig.proxy_grpc_tls;
    delete newConfig.proxy_grpc_credentials_key;
    delete newConfig.proxy_grpc_credentials_value;

    // Let's fix config options to enable proxy inside namespaces array objects.
    if (newConfig.channel && newConfig.channel.namespaces) {
        newConfig.channel.namespaces = newConfig.channel.namespaces.map(namespace => {
            if (namespace.proxy_subscribe) {
                namespace.subscribe_proxy_enabled = true;
                delete namespace.proxy_subscribe;
                log.push(`migrate value from "proxy_subscribe" to path "subscribe_proxy_enabled" in namespace "${namespace.name}"`);
            }
            if (namespace.proxy_publish) {
                namespace.publish_proxy_enabled = true;
                delete namespace.proxy_publish;
                log.push(`migrate value from "proxy_publish" to path "publish_proxy_enabled" in namespace "${namespace.name}"`);
            }
            if (namespace.proxy_sub_refresh) {
                namespace.sub_refresh_proxy_enabled = true;
                delete namespace.proxy_sub_refresh;
                log.push(`migrate value from "proxy_sub_refresh" to path "sub_refresh_proxy_enabled" in namespace "${namespace.name}"`);
            }
            if (namespace.proxy_subscribe_stream) {
                namespace.subscribe_stream_proxy_enabled = true;
                delete namespace.proxy_subscribe_stream;
                log.push(`migrate value from "proxy_subscribe_stream" to path "subscribe_stream_proxy_enabled" in namespace "${namespace.name}"`);
            }
            if (namespace.proxy_subscribe_stream_bidirectional) {
                namespace.subscribe_stream_proxy_bidirectional = true;
                delete namespace.proxy_subscribe_stream_bidirectional;
                log.push(`migrate value from "proxy_subscribe_stream_bidirectional" to path "subscribe_stream_proxy_bidirectional" in namespace "${namespace.name}"`);
            }
            return namespace;
        });
    }

    // Now in each namespace object if namespace name value starts with "/" we need to move this value to "pattern" field,
    // and then for the name set normalized value with "/" replaced to "_" (except first one which must be stripped). And
    // also ":" symbols must be replaced to "".
    if (newConfig.channel && newConfig.channel.namespaces) {
        newConfig.channel.namespaces = newConfig.channel.namespaces.map(namespace => {
            if (namespace.name.startsWith("/")) {
                namespace.pattern = namespace.name;
                namespace.name = namespace.name.replace("/", "").replace(/:/g, "").replace(/\//g, "_");
                log.push(`migrate value from "name" to path "pattern" in namespace "${namespace.name}"`);
            }
            return namespace;
        });
    }

    // Now let's fix "proxies" array of objects.
    // In each object we need to move "static_http_headers" to "http.static_headers" and remove "static_http_headers" (if http object does not exist - let's create it first).
    // Also, in each object we need to move grpc options (like we did above) to grpc object and remove them from the root of the object.
    if (newConfig.proxies) {
        newConfig.proxies = newConfig.proxies.map(proxy => {
            if (!proxy.http) {
                proxy.http = {};
            }
            if (proxy.static_http_headers) {
                proxy.http.static_headers = proxy.static_http_headers;
                delete proxy.static_http_headers;
                log.push(`migrate value from "static_http_headers" to path "http.static_headers" in proxy "${proxy.name}"`);
            }
            if (!proxy.grpc) {
                proxy.grpc = {};
            }
            if (proxy.grpc_compression) {
                proxy.grpc.compression = proxy.grpc_compression;
                log.push(`migrate value from "compression" to path "grpc.compression" in proxy "${proxy.name}"`);
            }
            if (proxy.grpc_tls) {
                proxy.grpc.tls = {
                    enabled: proxy.grpc_tls,
                };
                log.push(`migrate value from "grpc_tls" to path "grpc.tls.enabled" in proxy "${proxy.name}"`);
            }
            if (proxy.grpc_credentials_key) {
                proxy.grpc.credentials_key = proxy.grpc_credentials_key;
                log.push(`migrate value from "credentials_key" to path "grpc.credentials_key" in proxy "${proxy.name}"`);
            }
            if (proxy.grpc_credentials_value) {
                proxy.grpc.credentials_value = proxy.grpc_credentials_value;
                log.push(`migrate value from "credentials_value" to path "grpc.credentials_value" in proxy "${proxy.name}"`);
            }
            return proxy;
        })
    }

    // if there is "prometheus.enabled" set to true and prometheus.channel_namespace_for_transport_messages_sent is true or
    // prometheus.channel_namespace_for_transport_messages_received is true then we need to replace both options to nested object
    // prometheus.channel_namespace_resolution with enabled: true.
    if (newConfig.prometheus && newConfig.prometheus.enabled) {
        if (newConfig.prometheus.channel_namespace_for_transport_messages_sent || newConfig.prometheus.channel_namespace_for_transport_messages_received) {
            newConfig.prometheus.channel_namespace_resolution = {
                enabled: true,
            };
            delete newConfig.prometheus.channel_namespace_for_transport_messages_sent;
            delete newConfig.prometheus.channel_namespace_for_transport_messages_received;
            log.push(`migrate value from "channel_namespace_for_transport_messages_sent" and "channel_namespace_for_transport_messages_received" to path "channel_namespace_resolution" in prometheus`);
        }
    }

    // If database.postgresql.dsn is set then set database.enabled to true.
    if (newConfig.database && newConfig.database.postgresql && newConfig.database.postgresql.dsn) {
        newConfig.database.enabled = true;
        log.push(`set database.enabled to true`);
    }

    return {newConfig, log};
}

// "broker":     ""
// database enabler if dsn was set
// rate limit buckets enablers (when buckets are set)
// rate limit rpc method_override map now
// user_block, token_revoke, etc - redis_address -> redis: {"address": ...}
// redis_tls proper migration
// redis_sentinel_tls proper migration
// rate limits -> method_override is now a map.
const pathMap = {
    "redis_address": "engine.redis.address",
    "redis_prefix": "engine.redis.prefix",
    "redis_connect_timeout": "engine.redis.connect_timeout",
    "redis_io_timeout": "engine.redis.io_timeout",
    "redis_use_lists": "engine.redis.use_lists",
    "redis_db": "engine.redis.db",
    "redis_user": "engine.redis.user",
    "redis_password": "engine.redis.password",
    "redis_client_name": "engine.redis.client_name",
    "redis_force_resp2": "engine.redis.force_resp2",
    "redis_cluster_address": "engine.redis.cluster_address",
    "redis_sentinel_address": "engine.redis.sentinel_address",
    "redis_sentinel_user": "engine.redis.sentinel_user",
    "redis_sentinel_password": "engine.redis.sentinel_password",
    "redis_sentinel_master_name": "engine.redis.sentinel_master_name",
    "redis_sentinel_client_name": "engine.redis.sentinel_client_name",

    "redis_tls": "engine.redis.tls.enabled",
    "redis_tls_key": "engine.redis.tls.key_pem_file",
    "redis_tls_cert": "engine.redis.tls.cert_pem_file",
    "redis_tls_cert_pem": "engine.redis.tls.cert_pem",
    "redis_tls_key_pem": "engine.redis.tls.key_pem",
    "redis_tls_root_ca": "engine.redis.tls.server_ca_pem_file",
    "redis_tls_root_ca_pem": "engine.redis.tls.server_ca_pem",
    "redis_tls_client_ca": "engine.redis.tls.client_ca_pem_file",
    "redis_tls_client_ca_pem": "engine.redis.tls.client_ca_pem",
    "redis_tls_server_name": "engine.redis.tls.server_name",
    "redis_tls_insecure_skip_verify": "engine.redis.tls.insecure_skip_verify",

    "redis_sentinel_tls": "engine.redis.sentinel_tls.enabled",
    "redis_sentinel_tls_key": "engine.redis.sentinel_tls.key_pem_file",
    "redis_sentinel_tls_cert": "engine.redis.sentinel_tls.cert_pem_file",
    "redis_sentinel_tls_cert_pem": "engine.redis.sentinel_tls.cert_pem",
    "redis_sentinel_tls_key_pem": "engine.redis.sentinel_tls.key_pem",
    "redis_sentinel_tls_root_ca": "engine.redis.sentinel_tls.server_ca_pem_file",
    "redis_sentinel_tls_root_ca_pem": "engine.redis.sentinel_tls.server_ca_pem",
    "redis_sentinel_tls_client_ca": "engine.redis.sentinel_tls.client_ca_pem_file",
    "redis_sentinel_tls_client_ca_pem": "engine.redis.sentinel_tls.client_ca_pem",
    "redis_sentinel_tls_server_name": "engine.redis.sentinel_tls.server_name",
    "redis_sentinel_tls_insecure_skip_verify": "engine.redis.sentinel_tls.insecure_skip_verify",

    "name": "node.name",
    "engine": "engine.type",
    "pid_file": "pid_file",

    "opentelemetry": "opentelemetry.enabled",
    "opentelemetry_api": "opentelemetry.api",
    "opentelemetry_consuming": "opentelemetry.consuming",
    "client_insecure": "client.insecure",
    "client_insecure_skip_token_signature_verify": "client.insecure_skip_token_signature_verify",
    "api_insecure": "http_api.insecure",
    "client_user_id_http_header": "client.user_id_http_header",

    "token_hmac_secret_key": "client.token.hmac_secret_key",
    "token_rsa_public_key": "client.token.rsa_public_key",
    "token_ecdsa_public_key": "client.token.ecdsa_public_key",
    "token_jwks_public_endpoint": "client.token.jwks_public_endpoint",
    "token_audience": "client.token.audience",
    "token_audience_regex": "client.token.audience_regex",
    "token_issuer": "client.token.issuer",
    "token_issuer_regex": "client.token.issuer_regex",
    "token_user_id_claim": "client.token.user_id_claim",

    "separate_subscription_token_config": "client.subscription_token.enabled",
    "subscription_token_hmac_secret_key": "client.subscription_token.hmac_secret_key",
    "subscription_token_rsa_public_key": "client.subscription_token.rsa_public_key",
    "subscription_token_ecdsa_public_key": "client.subscription_token.ecdsa_public_key",
    "subscription_token_jwks_public_endpoint": "client.subscription_token.jwks_public_endpoint",
    "subscription_token_audience": "client.subscription_token.audience",
    "subscription_token_audience_regex": "client.subscription_token.audience_regex",
    "subscription_token_issuer": "client.subscription_token.issuer",
    "subscription_token_issuer_regex": "client.subscription_token.issuer_regex",
    "subscription_token_user_id_claim": "client.subscription_token.user_id_claim",

    "allowed_origins": "client.allowed_origins",

    "global_history_meta_ttl": "channel.history_meta_ttl",
    "global_presence_ttl": "redis.presence_ttl",
    "global_redis_presence_user_mapping": "redis.presence_user_mapping",
    "redis_presence_hash_field_ttl": "redis.presence_hash_field_ttl",

    "allowed_delta_types": "channel.without_namespace.allowed_delta_types",
    "delta_publish": "channel.without_namespace.delta_publish",
    "presence": "channel.without_namespace.presence",
    "join_leave": "channel.without_namespace.join_leave",
    "force_push_join_leave": "channel.without_namespace.force_push_join_leave",
    "history_size": "channel.without_namespace.history_size",
    "history_ttl": "channel.without_namespace.history_ttl",
    "history_meta_ttl": "channel.without_namespace.history_meta_ttl",
    "force_positioning": "channel.without_namespace.force_positioning",
    "allow_positioning": "channel.without_namespace.allow_positioning",
    "force_recovery": "channel.without_namespace.force_recovery",
    "allow_recovery": "channel.without_namespace.allow_recovery",
    "force_recovery_mode": "channel.without_namespace.force_recovery_mode",
    "allow_subscribe_for_anonymous": "channel.without_namespace.allow_subscribe_for_anonymous",
    "allow_subscribe_for_client": "channel.without_namespace.allow_subscribe_for_client",
    "allow_publish_for_anonymous": "channel.without_namespace.allow_publish_for_anonymous",
    "allow_publish_for_client": "channel.without_namespace.allow_publish_for_client",
    "allow_publish_for_subscriber": "channel.without_namespace.allow_publish_for_subscriber",
    "allow_presence_for_anonymous": "channel.without_namespace.allow_presence_for_anonymous",
    "allow_presence_for_client": "channel.without_namespace.allow_presence_for_client",
    "allow_presence_for_subscriber": "channel.without_namespace.allow_presence_for_subscriber",
    "allow_history_for_anonymous": "channel.without_namespace.allow_history_for_anonymous",
    "allow_history_for_client": "channel.without_namespace.allow_history_for_client",
    "allow_history_for_subscriber": "channel.without_namespace.allow_history_for_subscriber",
    "allow_user_limited_channels": "channel.without_namespace.allow_user_limited_channels",
    "channel_regex": "channel.without_namespace.channel_regex",
    "proxy_subscribe": "channel.without_namespace.subscribe_proxy_enabled",
    "proxy_publish": "channel.without_namespace.publish_proxy_enabled",
    "proxy_sub_refresh": "channel.without_namespace.sub_refresh_proxy_enabled",
    "proxy_subscribe_stream": "channel.without_namespace.subscribe_stream_proxy_enabled",

    "subscribe_proxy_name": "channel.without_namespace.subscribe_proxy_name",
    "publish_proxy_name": "channel.without_namespace.publish_proxy_name",
    "sub_refresh_proxy_name": "channel.without_namespace.sub_refresh_proxy_name",
    "subscribe_stream_proxy_name": "channel.without_namespace.subscribe_stream_proxy_name",

    "subscribe_cel": "channel.without_namespace.subscribe_cel",
    "publish_cel": "channel.without_namespace.publish_cel",
    "presence_cel": "channel.without_namespace.presence_cel",
    "history_cel": "channel.without_namespace.history_cel",

    "keep_latest_publication": "channel.without_namespace.keep_latest_publication",
    "shared_position_sync": "channel.without_namespace.shared_position_sync",
    "state_events": "channel.without_namespace.state_events",

    "cache_empty_proxy_name": "channel.without_namespace.cache_empty_proxy_name",
    "broker_name": "channel.without_namespace.broker_name",
    "presence_manager_name": "channel.without_namespace.presence_manager_name",

    "node_info_metrics_aggregate_interval": "node.info_metrics_aggregate_interval",

    "allow_anonymous_connect_without_token": "client.allow_anonymous_connect_without_token",
    "disallow_anonymous_connection_tokens": "client.disallow_anonymous_connection_tokens",

    "client_expired_close_delay": "client.expired_close_delay",
    "client_expired_sub_close_delay": "client.expired_sub_close_delay",
    "client_stale_close_delay": "client.stale_close_delay",
    "client_channel_limit": "client.channel_limit",
    "client_queue_max_size": "client.queue_max_size",
    "client_presence_update_interval": "client.presence_update_interval",
    "client_user_connection_limit": "client.user_connection_limit",
    "client_concurrency": "client.concurrency",
    "client_channel_position_check_delay": "client.channel_position_check_delay",
    "client_channel_position_max_time_lag": "client.channel_position_max_time_lag",
    "client_connection_limit": "client.connection_limit",
    "client_connection_rate_limit": "client.connection_rate_limit",
    "client_connect_include_server_time": "client.connect_include_server_time",

    "client_connect_code_to_unidirectional_disconnect.enabled": "client.connect_code_to_unidirectional_disconnect.enabled",
    "client_connect_code_to_unidirectional_disconnect.transforms": "client.connect_code_to_unidirectional_disconnect.transforms",

    "channel_max_length": "channel.max_length",
    "channel_private_prefix": "channel.private_prefix",
    "channel_namespace_boundary": "channel.namespace_boundary",
    "channel_user_boundary": "channel.user_boundary",
    "channel_user_separator": "channel.user_separator",

    "rpc_namespace_boundary": "rpc.namespace_boundary",
    "rpc_ping": "rpc.ping.enabled",
    "rpc_ping_method": "rpc.ping.method",

    "user_subscribe_to_personal": "client.subscribe_to_user_personal_channel.enabled",
    "user_personal_channel_namespace": "client.subscribe_to_user_personal_channel.personal_channel_namespace",
    "user_personal_single_connection": "client.subscribe_to_user_personal_channel.single_connection",

    "debug": "debug.enabled",
    "prometheus": "prometheus.enabled",
    "health": "health.enabled",

    "admin": "admin.enabled",
    "admin_password": "admin.password",
    "admin_secret": "admin.secret",
    "admin_insecure": "admin.insecure",
    "admin_web_path": "admin.web_path",
    "admin_web_proxy_address": "admin.web_proxy_address",

    "websocket_compression": "websocket.compression",
    "websocket_compression_min_size": "websocket.compression_min_size",
    "websocket_compression_level": "websocket.compression_level",
    "websocket_read_buffer_size": "websocket.read_buffer_size",
    "websocket_use_write_buffer_pool": "websocket.use_write_buffer_pool",
    "websocket_write_buffer_size": "websocket.write_buffer_size",
    "websocket_write_timeout": "websocket.write_timeout",
    "websocket_message_size_limit": "websocket.message_size_limit",

    "uni_websocket": "uni_websocket.enabled",
    "uni_websocket_compression": "uni_websocket.compression",
    "uni_websocket_compression_min_size": "uni_websocket.compression_min_size",
    "uni_websocket_compression_level": "uni_websocket.compression_level",
    "uni_websocket_read_buffer_size": "uni_websocket.read_buffer_size",
    "uni_websocket_use_write_buffer_pool": "uni_websocket.use_write_buffer_pool",
    "uni_websocket_write_buffer_size": "uni_websocket.write_buffer_size",
    "uni_websocket_write_timeout": "uni_websocket.write_timeout",
    "uni_websocket_message_size_limit": "uni_websocket.message_size_limit",

    "uni_sse": "uni_sse.enabled",
    "uni_http_stream": "uni_http_stream.enabled",

    "uni_sse_connect_code_to_http_response.enabled": "uni_sse.connect_code_to_http_response.enabled",
    "uni_sse_connect_code_to_http_response.transforms": "uni_sse.connect_code_to_http_response.transforms",
    "uni_http_stream_connect_code_to_http_response.enabled": "uni_http_stream.connect_code_to_http_response.enabled",
    "uni_http_stream_connect_code_to_http_response.transforms": "uni_http_stream.connect_code_to_http_response.transforms",

    "log_level": "log_level",
    "log_file": "log_file",

    "tls": "tls.enabled",
    "tls_key": "tls.key_pem_file",
    "tls_cert": "tls.cert_pem_file",
    "tls_cert_pem": "tls.cert_pem",
    "tls_key_pem": "tls.key_pem",
    "tls_root_ca": "tls.server_ca_pem_file",
    "tls_root_ca_pem": "tls.server_ca_pem",
    "tls_client_ca": "tls.client_ca_pem_file",
    "tls_client_ca_pem": "tls.client_ca_pem",
    "tls_server_name": "tls.server_name",
    "tls_insecure_skip_verify": "tls.insecure_skip_verify",

    "swagger": "swagger.enabled",
    "admin_external": "admin.external",
    "api_external": "http_api.external",
    "address": "address",
    "port": "port",
    "internal_address": "internal_address",
    "internal_port": "internal_port",

    "webtransport": "webtransport.enabled",
    "http3": "http3.enabled",

    "tls_external": "tls_external",

    "connect_proxy_name": "client.connect_proxy_name",
    "refresh_proxy_name": "client.refresh_proxy_name",

    "rpc_proxy_name": "rpc.without_namespace.rpc_proxy_name",

    "proxy_connect_endpoint": "client.proxy.connect.endpoint",
    "proxy_refresh_endpoint": "client.proxy.refresh.endpoint",

    "proxy_subscribe_endpoint": "channel.proxy.subscribe.endpoint",
    "proxy_publish_endpoint": "channel.proxy.publish.endpoint",
    "proxy_sub_refresh_endpoint": "channel.proxy.sub_refresh.endpoint",
    "proxy_subscribe_stream_endpoint": "channel.proxy.subscribe_stream.endpoint",

    "proxy_rpc_endpoint": "rpc.proxy.endpoint",

    "proxy_connect_timeout": "client.proxy.connect.timeout",
    "proxy_refresh_timeout": "client.proxy.refresh.timeout",

    "proxy_subscribe_timeout": "channel.proxy.subscribe.timeout",
    "proxy_publish_timeout": "channel.proxy.publish.timeout",
    "proxy_sub_refresh_timeout": "channel.proxy.sub_refresh.timeout",
    "proxy_subscribe_stream_timeout": "channel.proxy.subscribe_stream.timeout",

    "proxy_rpc_timeout": "rpc.proxy.timeout",

    "proxy_state_endpoint": "channel.proxy.state.endpoint",
    "proxy_state_timeout": "channel.proxy.state.timeout",
    "proxy_cache_empty_endpoint": "channel.proxy.cache_empty.endpoint",
    "proxy_cache_empty_timeout": "channel.proxy.cache_empty.timeout",

    "api_key": "http_api.key",
    "api_error_mode": "http_api.error_mode",

    "uni_http_stream_max_request_body_size": "uni_http_stream.max_request_body_size",
    "uni_sse_max_request_body_size": "uni_sse.max_request_body_size",
    "http_stream_max_request_body_size": "http_stream.max_request_body_size",
    "sse_max_request_body_size": "sse.max_request_body_size",

    "tls_autocert": "tls_autocert.enabled",
    "tls_autocert_host_whitelist": "tls_autocert.host_whitelist",
    "tls_autocert_cache_dir": "tls_autocert.cache_dir",
    "tls_autocert_email": "tls_autocert.email",
    "tls_autocert_server_name": "tls_autocert.server_name",
    "tls_autocert_http": "tls_autocert.http",
    "tls_autocert_http_addr": "tls_autocert.http_addr",

    "grpc_api": "grpc_api.enabled",
    "grpc_api_error_mode": "grpc_api.error_mode",
    "grpc_api_address": "grpc_api.address",
    "grpc_api_port": "grpc_api.port",
    "grpc_api_key": "grpc_api.key",
    "grpc_api_reflection": "grpc_api.reflection",
    "grpc_api_tls": "grpc_api.tls.enabled",
    "grpc_api_tls_key": "grpc_api.tls.key_pem_file",
    "grpc_api_tls_cert": "grpc_api.tls.cert_pem_file",
    "grpc_api_tls_cert_pem": "grpc_api.tls.cert_pem",
    "grpc_api_tls_key_pem": "grpc_api.tls.key_pem",
    "grpc_api_tls_root_ca": "grpc_api.tls.server_ca_pem_file",
    "grpc_api_tls_root_ca_pem": "grpc_api.tls.server_ca_pem",
    "grpc_api_tls_client_ca": "grpc_api.tls.client_ca_pem_file",
    "grpc_api_tls_client_ca_pem": "grpc_api.tls.client_ca_pem",
    "grpc_api_tls_server_name": "grpc_api.tls.server_name",
    "grpc_api_tls_insecure_skip_verify": "grpc_api.tls.insecure_skip_verify",
    "grpc_api_max_receive_message_size": "grpc_api.max_receive_message_size",

    "shutdown_timeout": "shutdown.timeout",

    "graphite": "graphite.enabled",
    "graphite_host": "graphite.host",
    "graphite_port": "graphite.port",
    "graphite_prefix": "graphite.prefix",
    "graphite_interval": "graphite.interval",
    "graphite_tags": "graphite.tags",

    "nats_prefix": "broker.nats.prefix",
    "nats_url": "broker.nats.url",
    "nats_dial_timeout": "broker.nats.dial_timeout",
    "nats_write_timeout": "broker.nats.write_timeout",
    "nats_allow_wildcards": "broker.nats.allow_wildcards",
    "nats_raw_mode.enabled": "broker.nats.raw_mode.enabled",
    "nats_raw_mode.channel_replacements": "broker.nats.raw_mode.channel_replacements",
    "nats_raw_mode.prefix": "broker.nats.raw_mode.prefix",

    "websocket_disable": "websocket.disabled",
    "api_disable": "http_api.disabled",

    "websocket_handler_prefix": "websocket.handler_prefix",
    "webtransport_handler_prefix": "webtransport.handler_prefix",
    "http_stream_handler_prefix": "http_stream.handler_prefix",
    "sse_handler_prefix": "sse.handler_prefix",
    "uni_websocket_handler_prefix": "uni_websocket.handler_prefix",
    "uni_sse_handler_prefix": "uni_sse.handler_prefix",
    "uni_http_stream_handler_prefix": "uni_http_stream.handler_prefix",

    "uni_grpc": "uni_grpc.enabled",
    "uni_grpc_address": "uni_grpc.address",
    "uni_grpc_port": "uni_grpc.port",
    "uni_grpc_max_receive_message_size": "uni_grpc.max_receive_message_size",
    //"uni_grpc_tls_disable":              "uni_grpc.tls_disable",
    "uni_grpc_tls": "uni_grpc.tls.enabled",
    "uni_grpc_tls_key": "uni_grpc.tls.key_pem_file",
    "uni_grpc_tls_cert": "uni_grpc.tls.cert_pem_file",
    "uni_grpc_tls_cert_pem": "uni_grpc.tls.cert_pem",
    "uni_grpc_tls_key_pem": "uni_grpc.tls.key_pem",
    "uni_grpc_tls_root_ca": "uni_grpc.tls.server_ca_pem_file",
    "uni_grpc_tls_root_ca_pem": "uni_grpc.tls.server_ca_pem",
    "uni_grpc_tls_client_ca": "uni_grpc.tls.client_ca_pem_file",
    "uni_grpc_tls_client_ca_pem": "uni_grpc.tls.client_ca_pem",
    "uni_grpc_tls_server_name": "uni_grpc.tls.server_name",
    "uni_grpc_tls_insecure_skip_verify": "uni_grpc.tls.insecure_skip_verify",

    "http_stream": "http_stream.enabled",
    "sse": "sse.enabled",

    "emulation_handler_prefix": "emulation.handler_prefix",
    "emulation_max_request_body_size": "emulation.max_request_body_size",

    "admin_handler_prefix": "admin.handler_prefix",
    "api_handler_prefix": "http_api.handler_prefix",
    "prometheus_handler_prefix": "prometheus.handler_prefix",
    "health_handler_prefix": "health.handler_prefix",
    "swagger_handler_prefix": "swagger.handler_prefix",

    "client_history_max_publication_limit": "client.history_max_publication_limit",
    "client_recovery_max_publication_limit": "client.recovery_max_publication_limit",

    "usage_stats_disable": "usage_stats.disabled",

    "ping_interval": "client.ping_interval",
    "pong_timeout": "client.pong_timeout",

    "namespaces": "channel.namespaces",
    "rpc_namespaces": "rpc.namespaces",

    "proxies": "proxies",

    "enable_unreleased_features": "enable_unreleased_features",

    "consumers": "consumers",

    "license": "license",
    "database.dsn": "database.postgresql.dsn",
    "database.replica_dsn": "database.postgresql.replica_dsn",
    "channel_patterns": "channel.patterns",
    "use_singleflight": "singleflight.enabled",
    "brokers": "brokers",
    "presence_managers": "presence_managers",

    "channel_namespace_for_transport_messages_sent": "prometheus.channel_namespace_for_transport_messages_sent",
    "channel_namespace_for_transport_messages_received": "prometheus.channel_namespace_for_transport_messages_received",

    "client_write_delay": "client.write_delay",
    "client_reply_without_queue": "client.reply_without_queue",
    "client_max_messages_in_frame": "client.max_messages_in_frame",
    "client_queue_initial_cap": "client.queue_initial_cap",

    "cache.enabled": "cache.enabled",
    "cache.engine": "cache.engine",
    "cache.use_redis_from_engine": "cache.use_redis_from_engine",
    "cache.redis": "cache.redis",

    "clickhouse_analytics.enabled": "clickhouse_analytics.enabled",
    "clickhouse_analytics.clickhouse_dsn": "clickhouse_analytics.clickhouse_dsn",
    "clickhouse_analytics.skip_ping_on_start": "clickhouse_analytics.skip_ping_on_start",
    "clickhouse_analytics.skip_schema_initialization": "clickhouse_analytics.skip_schema_initialization",
    "clickhouse_analytics.clickhouse_database": "clickhouse_analytics.clickhouse_database",
    "clickhouse_analytics.clickhouse_cluster": "clickhouse_analytics.clickhouse_cluster",
    "clickhouse_analytics.export_connections": "clickhouse_analytics.export.connections.enabled",
    "clickhouse_analytics.export_subscriptions": "clickhouse_analytics.export.subscriptions.enabled",
    "clickhouse_analytics.export_operations": "clickhouse_analytics.export.operations.enabled",
    "clickhouse_analytics.export_publications": "clickhouse_analytics.export.publications.enabled",
    "clickhouse_analytics.export_notifications": "clickhouse_analytics.export.notifications.enabled",
    "clickhouse_analytics.export_http_headers": "clickhouse_analytics.export.connections.http_headers",
    "clickhouse_analytics.export_grpc_metadata": "clickhouse_analytics.export.connections.grpc_metadata",
    "clickhouse_analytics.connections_max_buffer_size": "clickhouse_analytics.export.connections.max_buffer_size",
    "clickhouse_analytics.operations_max_buffer_size": "clickhouse_analytics.export.operations.max_buffer_size",
    "clickhouse_analytics.publications_max_buffer_size": "clickhouse_analytics.export.publications.max_buffer_size",
    "clickhouse_analytics.subscriptions_max_buffer_size": "clickhouse_analytics.export.subscriptions.max_buffer_size",
    "clickhouse_analytics.notifications_max_buffer_size": "clickhouse_analytics.export.notifications.max_buffer_size",
    "clickhouse_analytics.connections_flush_interval": "clickhouse_analytics.export.connections.flush_interval",
    "clickhouse_analytics.operations_flush_interval": "clickhouse_analytics.export.operations.flush_interval",
    "clickhouse_analytics.publications_flush_interval": "clickhouse_analytics.export.publications.flush_interval",
    "clickhouse_analytics.subscriptions_flush_interval": "clickhouse_analytics.export.subscriptions.flush_interval",
    "clickhouse_analytics.notifications_flush_interval": "clickhouse_analytics.export.notifications.flush_interval",
    "clickhouse_analytics.connections_flush_size": "clickhouse_analytics.export.connections.flush_size",
    "clickhouse_analytics.operations_flush_size": "clickhouse_analytics.export.operations.flush_size",
    "clickhouse_analytics.publications_flush_size": "clickhouse_analytics.export.publications.flush_size",
    "clickhouse_analytics.subscriptions_flush_size": "clickhouse_analytics.export.subscriptions.flush_size",
    "clickhouse_analytics.notifications_flush_size": "clickhouse_analytics.export.notifications.flush_size",
    "clickhouse_analytics.connections_ttl": "clickhouse_analytics.export.connections.ttl",
    "clickhouse_analytics.operations_ttl": "clickhouse_analytics.export.operations.ttl",
    "clickhouse_analytics.publications_ttl": "clickhouse_analytics.export.publications.ttl",
    "clickhouse_analytics.subscriptions_ttl": "clickhouse_analytics.export.subscriptions.ttl",
    "clickhouse_analytics.notifications_ttl": "clickhouse_analytics.export.notifications.ttl",

    "user_tokens_invalidate.enabled": "user_tokens_invalidate.enabled",
    "user_tokens_invalidate.persistence_engine": "user_tokens_invalidate.storage_type",
    "user_tokens_invalidate.redis_address": "user_tokens_invalidate.redis.address",
    "user_block.enabled": "user_block.enabled",
    "user_block.persistence_engine": "user_block.storage_type",
    "user_block.redis_address": "user_block.redis.address",
    "token_revoke.enabled": "token_revoke.enabled",
    "token_revoke.persistence_engine": "token_revoke.storage_type",
    "token_revoke.redis_address": "token_revoke.redis.address",

    "push_notifications.redis_address": "push_notifications.queue.redis.address",
    "push_notifications.use_redis_from_engine": "push_notifications.use_redis_from_engine",
    "push_notifications.enabled_providers": "push_notifications.enabled_providers",
    "push_notifications.dry_run": "push_notifications.dry_run",
    "push_notifications.dry_run_latency": "push_notifications.dry_run_latency",
    "push_notifications.fcm_credentials_file_path": "push_notifications.fcm.credentials_file_path",
    "push_notifications.hms_app_id": "push_notifications.hms.app_id",
    "push_notifications.hms_app_secret": "push_notifications.hms.app_secret",
    "push_notifications.queue_engine": "push_notifications.queue.type",
    "push_notifications.apns_endpoint": "push_notifications.apns.endpoint",
    "push_notifications.apns_bundle_id": "push_notifications.apns.bundle_id",
    "push_notifications.apns_token_auth_key_path": "push_notifications.apns.token_key_file",
    "push_notifications.apns_token_auth_key_pem": "push_notifications.apns.token_key_pem",
    "push_notifications.apns_token_key_id": "push_notifications.apns.token_key_id",
    "push_notifications.apns_token_team_id": "push_notifications.apns.token_team_id",
    "push_notifications.apns_cert_p12_path": "push_notifications.apns.cert_p12_file",
    "push_notifications.apns_cert_p12_b64": "push_notifications.apns.cert_p12_b64",
    "push_notifications.apns_cert_p12_password": "push_notifications.apns.cert_p12_password",
    "push_notifications.enable_client_cancel_push": "push_notifications.enable_client_cancel_push",
    "push_notifications.use_redis_legacy_reclaim": "push_notifications.use_redis_legacy_reclaim",
    "push_notifications.fcm_tokens_batch_size": "push_notifications.fcm.tokens_batch_size",
    "push_notifications.apns_tokens_batch_size": "push_notifications.apns.tokens_batch_size",
    "push_notifications.hms_tokens_batch_size": "push_notifications.hms.tokens_batch_size",
    "push_notifications.database_queue_prefix": "push_notifications.database_queue_prefix",
    "push_notifications.read_from_replica": "push_notifications.read_from_replica",
    "push_notifications.database_scheduler_consumer_concurrency": "push_notifications.database_scheduler_consumer_concurrency",
    "push_notifications.database_fcm_consumer_concurrency": "push_notifications.fcm.database_consumer_concurrency",
    "push_notifications.database_hms_consumer_concurrency": "push_notifications.hms.database_consumer_concurrency",
    "push_notifications.database_apns_consumer_concurrency": "push_notifications.apns.database_consumer_concurrency",

    "client_command_rate_limit.enabled": "client.rate_limit.client_command.enabled",
    "client_command_rate_limit.total.buckets": "client.rate_limit.client_command.total.buckets",
    "client_command_rate_limit.default.buckets": "client.rate_limit.client_command.default.buckets",
    "client_command_rate_limit.connect.buckets": "client.rate_limit.client_command.connect.buckets",
    "client_command_rate_limit.subscribe.buckets": "client.rate_limit.client_command.subscribe.buckets",
    "client_command_rate_limit.publish.buckets": "client.rate_limit.client_command.publish.buckets",
    "client_command_rate_limit.history.buckets": "client.rate_limit.client_command.history.buckets",
    "client_command_rate_limit.presence.buckets": "client.rate_limit.client_command.presence.buckets",
    "client_command_rate_limit.presence_stats.buckets": "client.rate_limit.client_command.presence_stats.buckets",
    "client_command_rate_limit.refresh.buckets": "client.rate_limit.client_command.refresh.buckets",
    "client_command_rate_limit.sub_refresh.buckets": "client.rate_limit.client_command.sub_refresh.buckets",
    "client_command_rate_limit.rpc.buckets": "client.rate_limit.client_command.rpc.buckets",
    "client_command_rate_limit.rpc.method_override": "client.rate_limit.client_command.rpc.method_override",

    "user_command_rate_limit.enabled": "client.rate_limit.user_command.enabled",
    "user_command_rate_limit.total.buckets": "client.rate_limit.user_command.total.buckets",
    "user_command_rate_limit.default.buckets": "client.rate_limit.user_command.default.buckets",
    "user_command_rate_limit.connect.buckets": "client.rate_limit.user_command.connect.buckets",
    "user_command_rate_limit.subscribe.buckets": "client.rate_limit.user_command.subscribe.buckets",
    "user_command_rate_limit.publish.buckets": "client.rate_limit.user_command.publish.buckets",
    "user_command_rate_limit.history.buckets": "client.rate_limit.user_command.history.buckets",
    "user_command_rate_limit.presence.buckets": "client.rate_limit.user_command.presence.buckets",
    "user_command_rate_limit.presence_stats.buckets": "client.rate_limit.user_command.presence_stats.buckets",
    "user_command_rate_limit.refresh.buckets": "client.rate_limit.user_command.refresh.buckets",
    "user_command_rate_limit.sub_refresh.buckets": "client.rate_limit.user_command.sub_refresh.buckets",
    "user_command_rate_limit.rpc.buckets": "client.rate_limit.user_command.rpc.buckets",
    "user_command_rate_limit.rpc.method_override": "client.rate_limit.user_command.rpc.method_override",

    "redis_user_command_rate_limit.enabled": "client.rate_limit.redis_user_command.enabled",
    "redis_user_command_rate_limit.default.buckets": "client.rate_limit.redis_user_command.default.buckets",
    "redis_user_command_rate_limit.connect.buckets": "client.rate_limit.redis_user_command.connect.buckets",
    "redis_user_command_rate_limit.subscribe.buckets": "client.rate_limit.redis_user_command.subscribe.buckets",
    "redis_user_command_rate_limit.publish.buckets": "client.rate_limit.redis_user_command.publish.buckets",
    "redis_user_command_rate_limit.history.buckets": "client.rate_limit.redis_user_command.history.buckets",
    "redis_user_command_rate_limit.presence.buckets": "client.rate_limit.redis_user_command.presence.buckets",
    "redis_user_command_rate_limit.presence_stats.buckets": "client.rate_limit.redis_user_command.presence_stats.buckets",
    "redis_user_command_rate_limit.refresh.buckets": "client.rate_limit.redis_user_command.refresh.buckets",
    "redis_user_command_rate_limit.sub_refresh.buckets": "client.rate_limit.redis_user_command.sub_refresh.buckets",
    "redis_user_command_rate_limit.rpc.buckets": "client.rate_limit.redis_user_command.rpc.buckets",
    "redis_user_command_rate_limit.rpc.method_override": "client.rate_limit.redis_user_command.rpc.method_override",

    "distributed_rate_limit.enabled": "distributed_rate_limit.enabled",
    "distributed_rate_limit.use_redis_from_engine": "distributed_rate_limit.use_redis_from_engine",

    "client_error_limits.enabled": "client.rate_limit.client_error.enabled",
    "client_error_limits.total.buckets": "client.rate_limit.client_error.total.buckets",

    "user_status.enabled": "user_status.enabled",
    "user_status.use_redis_from_engine": "user_status.use_redis_from_engine",
    "user_status.expire_interval": "user_status.expire_interval",
    "user_status.state_regex": "user_status.state_regex",
    "user_status.disable_for_client": "user_status.disable_for_client",

    "state_vacated_event_delay": "state.vacated_event_delay",
    "partitioned_presence.num_partitions": "state.num_presence_partitions",

    "admin_oidc.enabled": "admin.oidc.enabled",
    "admin_oidc.display_name": "admin.oidc.display_name",
    "admin_oidc.discovery_endpoint": "admin.oidc.discovery_endpoint",
    "admin_oidc.issuer": "admin.oidc.issuer",
    "admin_oidc.client_id": "admin.oidc.client_id",
    "admin_oidc.audience": "admin.oidc.audience",
    "admin_oidc.redirect_uri": "admin.oidc.redirect_uri",
    "admin_oidc.extra_scopes": "admin.oidc.extra_scopes",
    "admin_oidc.access_cel": "admin.oidc.access_cel",

    "websocket_compression_prepared_message_cache_size": "websocket.compression_prepared_message_cache_size",
};

export default class ConfigConverter extends React.Component {
    constructor() {
        super();
        this.onChange = this.onChange.bind(this);
        this.onClick = this.onClick.bind(this);
        this.state = {
            config: null,
            output: "Here will be configuration for v6",
            logs: "Here will be log of changes made in your config",
        };
    }

    onClick(e) {
        if (!this.state.config) {
            alert("Provide a configuration");
            return;
        }
        let oldConfig;
        try {
            oldConfig = JSON.parse(this.state.config);
        } catch {
            alert("Invalid JSON");
            return;
        }

        const {newConfig, log} = convert(oldConfig, pathMap);
        console.log(oldConfig);
        console.log(newConfig);
        console.log(log);

        let objectName = function (object) {
            let name = 'config top-level';
            if (object !== undefined) {
                name = 'namespace {' + object.name + '}';
            }
            return name;
        }

        let rename = function (oldKey, newKey, object) {
            let name = objectName(object);
            if (object === undefined) {
                object = config
            }
            if (object[newKey] === undefined && object[oldKey] !== undefined) {
                object[newKey] = object[oldKey];
                delete object[oldKey];
                log.push('renamed ' + oldKey + ' to ' + newKey + ' in ' + name);
            }
        }

        let remove = function (key, object) {
            let name = objectName(object);
            if (object === undefined) {
                object = config
            }
            if (object[key] !== undefined) {
                delete object[key];
                log.push('removed ' + key + ' from ' + name);
            }
        }

        let setIfNotDefined = function (key, value, object) {
            let name = objectName(object);
            if (object === undefined) {
                object = config
            }
            if (object[key] === undefined) {
                object[key] = value;
                log.push('added ' + key + ' to ' + name);
            }
        }

        this.setState({output: JSON.stringify(newConfig, null, '  ')});
        this.setState({logs: JSON.stringify(log, null, '  ')});
    }

    onChange(e) {
        this.setState({config: e.target.value});
    }

    render() {
        return (
            <div>
                <textarea
                    onChange={this.onChange}
                    placeholder="Paste your Centrifugo v5 JSON config here, then press Convert button"
                    style={{
                        width: '100%',
                        height: '300px',
                        border: "2px solid #ccc",
                    }}>
                </textarea>
                <button onClick={this.onClick}>Convert</button>
                <pre style={{marginTop: '10px'}}>
                    {this.state.output}
                </pre>
                <pre style={{marginTop: '10px'}}>
                    {this.state.logs}
                </pre>
            </div>
        );
    }
}
