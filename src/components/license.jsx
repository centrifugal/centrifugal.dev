import React from 'react';
import CodeBlock from '@theme/CodeBlock';

export default class LicenseInput extends React.Component {
    constructor() {
        super();
        this.onChange = this.onChange.bind(this);
        this.onClick = this.onClick.bind(this);
        this.state = {
            providerKey: '',
            centrifugalKey: '',
        };
    }

    async exchangeLicense(key) {
        const res = await fetch('https://centrifugal.fly.dev/centrifugo/license/exchange/' + this.props.providerName + '?license=' + key);
        if (!res.ok) {
            // Any other error thrown will result into token refresh re-attempts.
            throw new Error(`Unexpected status code ${res.status}`);
        }
        const data = await res.json();
        this.setState({ centrifugalKey: data.license, providerKey: '' });
    }

    onClick(e) {
        if (!this.state.providerKey) {
            alert("Provide a license key received in the purchase confirmation on email");
            return;
        }
        this.exchangeLicense(this.state.providerKey);
    }

    onChange(e) {
        this.setState({ providerKey: e.target.value });
    }

    render() {
        const buttonStyle = {
            'background': '#FC6459',
            'height': 50,
            'border': 'none',
            'textAlign': 'center',
            'cursor': 'pointer',
            'textTransform': 'uppercase',
            'outline': 'none',
            'overflow': 'hidden',
            'position': 'relative',
            'color': '#fff',
            'fontWeight': 700,
            'fontSize': 15,
            'padding': '17px 17px',
            'marginTop': 10,
            'borderRadius': '5px'
        }

        const placeholder = 'Paste the key received from ' + this.props.providerHuman + ' here...';

        return (
            <div>
                <input
                    onChange={this.onChange}
                    value={this.state.providerKey}
                    placeholder={placeholder}
                    style={{
                        backgroundColor: '#230808',
                        color: '#ccc',
                        width: '100%',
                        height: '3em',
                        border: "1px solid #ccc",
                        padding: "5px",
                        fontSize: '1em',
                        borderRadius: '5px'
                    }}>
                </input>
                <button onClick={this.onClick} style={buttonStyle}>Exchange</button>
                {this.state.centrifugalKey &&
                    <div style={{ marginTop: '10px' }}>
                        <CodeBlock language="text">
                            {this.state.centrifugalKey}
                        </CodeBlock>
                    </div>
                }
            </div>
        );
    }
}
