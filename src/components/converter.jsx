import React from 'react';

export default class ConfigConverter extends React.Component {
    constructor() {
        super();
        this.onChange = this.onChange.bind(this);
        this.onClick = this.onClick.bind(this);
        this.state = {
            config: null,
            output: "Here will be configuration for v3",
            logs: "Here will be log of changes made in your config",
        };
    }

    onClick(e) {
        if (!this.state.config) {
            alert("Provide a configuration");
            return;
        }
        let config;
        try {
            config = JSON.parse(this.state.config);
        } catch {
            alert("Invalid JSON");
            return;
        }

        let log = [];
        let notes = [];

        let objectName = function (object) {
            let name = 'config top-level';
            if (object !== undefined) {
                name = 'namespace {' + object.name + '}';
            }
            return name;
        }

        let rename = function (oldKey, newKey, object) {
            notes.push('`' + oldKey + '` renamed to `' + newKey + '`');
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
            notes.push('`' + key + '` removed');
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
            notes.push('`' + key + '` is now required');
            let name = objectName(object);
            if (object === undefined) {
                object = config
            }
            if (object[key] === undefined) {
                object[key] = value;
                log.push('added ' + key + ' to ' + name);
            }
        }

        let toDuration = function (key, object) {
            notes.push('`' + key + '` should be converted to duration');
            let name = objectName(object);
            if (object === undefined) {
                object = config
            }
            if (object[key] !== undefined) {
                let value = object[key];
                if (typeof value === "number") {
                    if (Math.floor(value) === value) {
                        object[key] = object[key] + 's';
                    } else {
                        object[key] = value * 1000 + 'ms';
                    }
                    log.push('updated ' + key + ' to duration value ' + object[key] + ' in ' + name);
                }
            }
        }

        let hasProxy = false;
        for (var m in config) {
            if (m.startsWith("proxy_")) {
                hasProxy = true;
            }
        }
        if (hasProxy && config['proxy_http_headers'] === undefined) {
            let httpHeaders = [
                "Origin",
                "User-Agent",
                "Cookie",
                "Authorization",
                "X-Real-Ip",
                "X-Forwarded-For",
                "X-Request-Id"
            ]
            if (config['proxy_extra_http_headers'] !== undefined) {
                for (var i in config['proxy_extra_http_headers']) {
                    httpHeaders.push(config['proxy_extra_http_headers'][i]);
                }
            }
            config['proxy_http_headers'] = httpHeaders;
            log.push('set list of headers for HTTP proxy (since v3 requires explicit values)');
            remove('proxy_extra_http_headers');
        };

        setIfNotDefined('allowed_origins', []);

        remove('v3_use_offset');
        remove('redis_streams');
        remove('tls_autocert_force_rsa');
        remove('redis_pubsub_num_workers');
        remove('sockjs_disable');

        rename('secret', 'token_hmac_secret_key');
        rename('history_lifetime', 'history_ttl');
        rename('history_recover', 'recover');
        rename('client_presence_ping_interval', 'client_presence_update_interval');
        rename('client_ping_interval', 'websocket_ping_interval');
        rename('client_message_write_timeout', 'websocket_write_timeout');
        rename('client_request_max_size', 'websocket_message_size_limit');
        rename('client_presence_expire_interval', 'presence_ttl');
        rename('memory_history_meta_ttl', 'history_meta_ttl');
        rename('redis_history_meta_ttl', 'history_meta_ttl');
        rename('redis_sequence_ttl', 'history_meta_ttl');
        rename('redis_presence_ttl', 'presence_ttl');

        toDuration('presence_ttl');
        toDuration('websocket_write_timeout');
        toDuration('websocket_ping_interval');
        toDuration('client_presence_update_interval');
        toDuration('history_ttl');
        toDuration('history_meta_ttl');
        toDuration('nats_dial_timeout');
        toDuration('nats_write_timeout');
        toDuration('graphite_interval');
        toDuration('shutdown_timeout');
        toDuration('shutdown_termination_delay');
        toDuration('proxy_connect_timeout');
        toDuration('proxy_refresh_timeout');
        toDuration('proxy_rpc_timeout');
        toDuration('proxy_subscribe_timeout');
        toDuration('proxy_publish_timeout');
        toDuration('client_expired_close_delay');
        toDuration('client_expired_sub_close_delay');
        toDuration('client_stale_close_delay');
        toDuration('client_channel_position_check_delay');
        toDuration('node_info_metrics_aggregate_interval');
        toDuration('websocket_ping_interval');
        toDuration('websocket_write_timeout');
        toDuration('sockjs_heartbeat_delay');
        toDuration('redis_idle_timeout');
        toDuration('redis_connect_timeout');
        toDuration('redis_read_timeout');
        toDuration('redis_write_timeout');

        if (config['namespaces'] !== undefined) {
            let newNamespaces = [];
            for (let namespace of config['namespaces']) {
                rename('history_lifetime', 'history_ttl', namespace);
                toDuration('history_ttl', namespace);
                rename('history_recover', 'recover', namespace);
                newNamespaces.push(namespace);
            }
            config['namespaces'] = newNamespaces;
        }

        if (config['redis_host'] !== undefined && config['redis_port'] !== undefined) {
            let shards = [];
            let hosts = config['redis_host'].toString().split(",");
            let ports = config['redis_port'].toString().split(",");
            if (hosts.length !== ports.length) {
                alert('Sorry, too difficult Redis configuration to automatically convert');
                return;
            }
            for (let i in hosts) {
                let address = hosts[i] + ":" + ports[i];
                shards.push(address);
            }
            config['redis_address'] = shards;
            remove('redis_host');
            remove('redis_port');
            log.push('redis configuration updated, but you should check it manually');
        } else if (config['redis_url'] !== undefined) {
            rename('redis_url', 'redis_address');
        }

        rename('redis_cluster_addrs', 'redis_cluster_address');
        rename('redis_sentinels', 'redis_sentinel_address');
        rename('redis_master_name', 'redis_sentinel_master_name');

        this.setState({ output: JSON.stringify(config, null, '\t') });
        this.setState({ logs: JSON.stringify(log, null, '\t') });

        console.log(notes.join('\n\n'));
    }

    onChange(e) {
        this.setState({ config: e.target.value });
    }

    render() {
        return (
            <div>
                <textarea
                    onChange={this.onChange}
                    placeholder="Paste your Centrifugo v2 JSON config here..."
                    style={{
                        width: '100%',
                        height: '300px',
                        border: "2px solid #ccc",
                    }}>
                </textarea>
                <button onClick={this.onClick}>Convert</button>
                <pre style={{ marginTop: '10px' }}>
                    {this.state.output}
                </pre>
                <pre style={{ marginTop: '10px' }}>
                    {this.state.logs}
                </pre>
            </div>
        );
    }
}
