import React from 'react';
import CodeBlock from '@theme/CodeBlock';

const backendUrl = 'https://centrifugal.fly.dev';

export default class LicenseManager extends React.Component {
    constructor() {
        super();
        this.state = {
            stagingProviderKey: '',
            stagingKey: '',
            developerProviderKey: '',
            developerName: '',
            developerKey: '',
        };
    }

    async issueLicense(key, type, name = null) {
        const body = { license: key, type };
        if (name) body.name = name;

        const res = await fetch(`${backendUrl}/centrifugo/license/issue`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(body)
        });

        if (!res.ok) {
            throw new Error(`Unexpected status code ${res.status}`);
        }

        const data = await res.json();
        if (data.error) {
            throw new Error(data.error);
        }
        return data.license;
    }

    handleStagingSubmit = async () => {
        if (!this.state.stagingProviderKey) {
            alert("Provide a license key");
            return;
        }

        try {
            const license = await this.issueLicense(this.state.stagingProviderKey, 'staging');
            this.setState({ stagingKey: license, stagingProviderKey: '' });
        } catch (error) {
            alert(`Error issuing staging license: ${error.message}`);
        }
    }

    handleDeveloperSubmit = async () => {
        if (!this.state.developerProviderKey) {
            alert("Provide a license key");
            return;
        }
        if (!this.state.developerName) {
            alert("Provide a developer name");
            return;
        }

        try {
            const license = await this.issueLicense(this.state.developerProviderKey, 'developer', this.state.developerName);
            this.setState({ developerKey: license, developerProviderKey: '', developerName: '' });
        } catch (error) {
            alert(`Error issuing developer license: ${error.message}`);
        }
    }

    handleInputChange = (field) => (e) => {
        this.setState({ [field]: e.target.value });
    }

    renderKeyIssueForm({
                           title,
                           description,
                           providerKeyValue,
                           providerKeyField,
                           nameValue = '',
                           nameField = '',
                           keyPlaceholder = '',
                           showNameInput = false,
                           onSubmit,
                           resultKey
                       }) {
        const sectionStyle = {
            width: '100%',
            border: "1px solid #ccc",
            borderRadius: '5px',
            padding: "25px",
            marginTop: title.includes('organization') ? '20px' : '0'
        };

        const inputStyle = {
            backgroundColor: '#230808',
            color: '#ccc',
            width: '100%',
            height: '3em',
            border: "1px solid #ccc",
            padding: "5px",
            fontSize: '1em',
            borderRadius: '5px'
        };

        const buttonStyle = {
            background: '#FC6459',
            height: 50,
            border: 'none',
            textAlign: 'center',
            cursor: 'pointer',
            textTransform: 'uppercase',
            outline: 'none',
            overflow: 'hidden',
            position: 'relative',
            color: '#fff',
            fontWeight: 700,
            fontSize: 15,
            padding: '17px 17px',
            marginTop: 10,
            borderRadius: '5px'
        };

        return (
            <div style={sectionStyle}>
                <h2>{title}</h2>
                <p>{description}</p>

                <input
                    onChange={this.handleInputChange(providerKeyField)}
                    value={providerKeyValue}
                    placeholder={keyPlaceholder}
                    style={inputStyle}
                />

                {showNameInput && (
                    <input
                        onChange={this.handleInputChange(nameField)}
                        value={nameValue}
                        placeholder="Write the name of the developer here..."
                        style={{
                            ...inputStyle,
                            marginTop: '10px'
                        }}
                    />
                )}

                <button onClick={onSubmit} style={buttonStyle}>
                    Submit
                </button>

                {this.state[resultKey] && (
                    <div style={{ marginTop: '10px' }}>
                        <CodeBlock language="text">
                            {this.state[resultKey]}
                        </CodeBlock>
                    </div>
                )}
            </div>
        );
    }

    render() {
        return (
            <div>
                {this.renderKeyIssueForm({
                    title: "Issue the staging license key (for staging or test environments)",
                    description: "This is a separate key that may be used for staging or test environments. It references the production key.",
                    providerKeyValue: this.state.stagingProviderKey,
                    providerKeyField: 'stagingProviderKey',
                    keyPlaceholder: "Paste the production license key received from Centrifugal Labs here...",
                    onSubmit: this.handleStagingSubmit,
                    resultKey: 'stagingKey'
                })}

                {this.renderKeyIssueForm({
                    title: "Issue the key for a specific organization developer",
                    description: "This key is issued for six months. Centrifugo PRO will not start with such a key after six months. The developer key must be derived from the staging license key (see above).",
                    providerKeyValue: this.state.developerProviderKey,
                    providerKeyField: 'developerProviderKey',
                    nameValue: this.state.developerName,
                    nameField: 'developerName',
                    keyPlaceholder: "Paste the staging license key here...",
                    showNameInput: true,
                    onSubmit: this.handleDeveloperSubmit,
                    resultKey: 'developerKey'
                })}
            </div>
        );
    }
}
