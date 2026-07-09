// Generates copy-pasteable backend token-signing snippets (one per language)
// and a client connect/subscribe snippet, from the current claim inputs. The
// backend snippets read the secret from an environment variable rather than the
// test secret — production secrets must never be hard-coded.
//
// User-controlled values (sub, channel) are ESCAPED into each target language's
// string literal, never interpolated raw:
//   js()  — JSON.stringify; a JSON string is a valid literal in JS/Python/Go/Java.
//   php() — single-quoted PHP literal (double-quoted PHP interpolates `$`, so a
//           channel like `$secret:room` would otherwise splice in a variable).

const js = (v) => JSON.stringify(String(v));
const php = (v) => "'" + String(v).replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'";

export const LANGS = [
  { id: 'python', label: 'Python' },
  { id: 'node', label: 'Node.js' },
  { id: 'go', label: 'Go' },
  { id: 'php', label: 'PHP' },
  { id: 'java', label: 'Java' },
];

// opts: { type: 'connection'|'subscription', sub, channel, ttlSec }
export function backendCode(lang, opts) {
  const sub = opts.sub || '';
  const ttl = opts.ttlSec;
  const isSub = opts.type === 'subscription';
  const ch = opts.channel || '';

  switch (lang) {
    case 'python':
      return `import jwt  # pip install pyjwt
import os, time

claims = {
    "sub": ${js(sub)},${isSub ? `\n    "channel": ${js(ch)},` : ''}
    "exp": int(time.time()) + ${ttl},
}
# read the secret from your config / environment, never hard-code it:
secret = os.environ["CENTRIFUGO_TOKEN_HMAC_SECRET_KEY"]
token = jwt.encode(claims, secret, algorithm="HS256")
print(token)`;
    case 'node': {
      const span = ttl % 86400 === 0 ? `${ttl / 86400}d` : ttl % 3600 === 0 ? `${ttl / 3600}h` : ttl % 60 === 0 ? `${ttl / 60}m` : `${ttl}s`;
      return `import { SignJWT } from "jose"; // npm i jose

// read the secret from your config / environment, never hard-code it:
const secret = new TextEncoder().encode(process.env.CENTRIFUGO_TOKEN_HMAC_SECRET_KEY);
const token = await new SignJWT(${isSub ? `{ channel: ${js(ch)} }` : '{}'})
  .setProtectedHeader({ alg: "HS256" })
  .setSubject(${js(sub)})
  .setExpirationTime("${span}")
  .sign(secret);
console.log(token);`;
    }
    case 'go':
      return `import (
    "fmt"
    "os"
    "time"
    "github.com/golang-jwt/jwt/v5"
)

claims := jwt.MapClaims{
    "sub": ${js(sub)},${isSub ? `\n    "channel": ${js(ch)},` : ''}
    "exp": time.Now().Unix() + ${ttl},
}
// read the secret from your config / environment, never hard-code it:
secret := []byte(os.Getenv("CENTRIFUGO_TOKEN_HMAC_SECRET_KEY"))
token, err := jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString(secret)
if err != nil {
    panic(err)
}
fmt.Println(token)`;
    case 'php':
      return `use Firebase\\JWT\\JWT; // composer require firebase/php-jwt

$claims = [
    "sub" => ${php(sub)},${isSub ? `\n    "channel" => ${php(ch)},` : ''}
    "exp" => time() + ${ttl},
];
// read the secret from your config / environment, never hard-code it:
$secret = getenv("CENTRIFUGO_TOKEN_HMAC_SECRET_KEY");
$token = JWT::encode($claims, $secret, "HS256");
echo $token;`;
    case 'java':
      return `import com.auth0.jwt.JWT;                  // dependency: com.auth0:java-jwt
import com.auth0.jwt.algorithms.Algorithm;
import java.util.Date;

// read the secret from your config / environment, never hard-code it:
String secret = System.getenv("CENTRIFUGO_TOKEN_HMAC_SECRET_KEY");
String token = JWT.create()
    .withSubject(${js(sub)})${isSub ? `\n    .withClaim("channel", ${js(ch)})` : ''}
    .withExpiresAt(new Date(System.currentTimeMillis() + ${ttl}000L))
    .sign(Algorithm.HMAC256(secret));
System.out.println(token);`;
    default:
      return '';
  }
}

// The browser client that consumes the token.
export function clientCode(opts) {
  if (opts.type === 'subscription') {
    return `import { Centrifuge } from "centrifuge"; // npm i centrifuge

const centrifuge = new Centrifuge("ws://localhost:8000/connection/websocket", {
  token: "<connection token>",
});

const sub = centrifuge.newSubscription(${js(opts.channel || 'chat:index')}, {
  token: "<subscription token>",
  // production: load a fresh token from your backend on (re)subscribe
  // getToken: async (ctx) => (await fetch(\`/centrifugo/subscription_token?channel=\${encodeURIComponent(ctx.channel)}\`)).text(),
});
sub.on("publication", (ctx) => console.log(ctx.data));
sub.subscribe();
centrifuge.connect();`;
  }
  return `import { Centrifuge } from "centrifuge"; // npm i centrifuge

const centrifuge = new Centrifuge("ws://localhost:8000/connection/websocket", {
  token: "<connection token>",
  // production: load a fresh token from your backend on (re)connect
  // getToken: async () => (await fetch("/centrifugo/connection_token")).text(),
});
centrifuge.on("connected", (ctx) => console.log("connected", ctx));
centrifuge.connect();`;
}
