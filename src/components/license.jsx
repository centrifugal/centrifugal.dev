import React from 'react';
import CodeBlock from '@theme/CodeBlock';

const backendUrl = 'https://centrifugal.fly.dev';

export default class LicenseInput extends React.Component {
    constructor() {
        super();
        this.state = {
            providerKey: '',
            centrifugalKey: '',
        };
    }

    async exchangeLicense(key) {
        const res = await fetch(`${backendUrl}/centrifugo/license/exchange/${this.props.providerName}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ license: key })
        });

        if (!res.ok) {
            throw new Error(`Unexpected status code ${res.status}`);
        }

        const data = await res.json();
        if (data.error) {
            throw new Error(data.error);
        }
        this.setState({ centrifugalKey: data.license, providerKey: '' });
    }

    handleSubmit = async () => {
        if (!this.state.providerKey) {
            alert("Provide a license key received in the purchase confirmation on email");
            return;
        }

        try {
            const license = await this.exchangeLicense(this.state.providerKey);
            this.setState({ centrifugalKey: data.license, providerKey: '' });
        } catch (error) {
            alert(`Error issuing staging license: ${error.message}`);
        }
    }

    handleInputChange = (e) => {
        this.setState({ providerKey: e.target.value });
    }

    render() {
        const { providerHuman = 'the provider' } = this.props;

        const styles = {
            input: {
                backgroundColor: '#230808',
                color: '#ccc',
                width: '100%',
                height: '3em',
                border: "1px solid #ccc",
                padding: "5px",
                fontSize: '1em',
                borderRadius: '5px'
            },
            button: {
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
            },
            result: {
                marginTop: '10px'
            }
        };

        return (
            <div>
                <input
                    onChange={this.handleInputChange}
                    value={this.state.providerKey}
                    placeholder={`Paste the key received from ${providerHuman} here...`}
                    style={styles.input}
                />
                <button onClick={this.handleSubmit} style={styles.button}>
                    Exchange
                </button>
                {this.state.centrifugalKey && (
                    <div style={styles.result}>
                        <CodeBlock language="text">
                            {this.state.centrifugalKey}
                        </CodeBlock>
                    </div>
                )}
            </div>
        );
    }
}
