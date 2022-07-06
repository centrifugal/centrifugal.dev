import React from 'react';

export default class ConfigConverter extends React.Component {
    constructor() {
        super();
        this.onChange = this.onChange.bind(this);
        this.onClick = this.onClick.bind(this);
        this.state = {
            config: null,
            output: "Here will be configuration for v4",
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

        remove('use_unlimited_history_by_default');
        rename('client_anonymous', 'allow_anonymous_connect_without_token');

        let namespace = config;

        setIfNotDefined('allow_user_limited_channels', true);

        if (namespace['protected'] === true) {
            remove('protected');
        } else {
            setIfNotDefined('allow_subscribe_for_client', true);
            rename('anonymous', 'allow_subscribe_for_anonymous');
        }

        if (namespace['publish'] === true) {
            rename('publish', 'allow_publish_for_client');
            setIfNotDefined('allow_publish_for_anonymous', true);
        }

        if (namespace['presence'] === true) {
            if (namespace['presence_disabled_for_client'] === true) {
                remove('presence_disabled_for_client');
            } else {
                setIfNotDefined('allow_presence_for_subscriber', true);
                setIfNotDefined('allow_presence_for_anonymous', true);
            }
        }

        if (namespace['history_ttl'] !== undefined && namespace['history_size'] !== undefined) {
            if (namespace['history_disabled_for_client'] === true) {
                remove('history_disabled_for_client');
            } else {
                setIfNotDefined('allow_history_for_subscriber', true);
                setIfNotDefined('allow_history_for_anonymous', true);
            }
        }

        if (namespace['position'] === true) {
            rename('position', 'force_positioning');
        } else {
            remove('position');
        }

        if (namespace['recover'] === true) {
            rename('recover', 'force_recovery');
        } else {
            remove('recover');
        }

        if (namespace['join_leave'] === true) {
            setIfNotDefined('force_push_join_leave', true);
        }

        if (config['namespaces'] !== undefined) {
            let newNamespaces = [];
            for (let namespace of config['namespaces']) {

                setIfNotDefined('allow_user_limited_channels', true, namespace);

                if (namespace['protected'] === true) {
                    remove('protected', namespace);
                } else {
                    setIfNotDefined('allow_subscribe_for_client', true, namespace);
                    rename('anonymous', 'allow_subscribe_for_anonymous', namespace);
                }

                if (namespace['publish'] === true) {
                    rename('publish', 'allow_publish_for_client', namespace);
                    setIfNotDefined('allow_publish_for_anonymous', true, namespace);
                }

                if (namespace['presence'] === true) {
                    if (namespace['presence_disabled_for_client'] === true) {
                        remove('presence_disabled_for_client', namespace);
                    } else {
                        setIfNotDefined('allow_presence_for_subscriber', true, namespace);
                        setIfNotDefined('allow_presence_for_anonymous', true, namespace);
                    }
                }

                if (namespace['history_ttl'] !== undefined && namespace['history_size'] !== undefined) {
                    if (namespace['history_disabled_for_client'] === true) {
                        remove('history_disabled_for_client', namespace);
                    } else {
                        setIfNotDefined('allow_history_for_subscriber', true, namespace);
                        setIfNotDefined('allow_history_for_anonymous', true, namespace);
                    }
                }

                if (namespace['position'] === true) {
                    rename('position', 'force_positioning', namespace);
                } else {
                    remove('position', namespace);
                }

                if (namespace['recover'] === true) {
                    rename('recover', 'force_recovery', namespace);
                } else {
                    remove('recover', namespace);
                }

                if (namespace['join_leave'] === true) {
                    setIfNotDefined('force_push_join_leave', true);
                }

                newNamespaces.push(namespace);
            }
            config['namespaces'] = newNamespaces;
        }

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
                    placeholder="Paste your Centrifugo v3 JSON config here..."
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
