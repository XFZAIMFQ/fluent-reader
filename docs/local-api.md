# Local subscription API

Fluent Reader can answer subscription status queries from local scripts and
applications. Enable **Local API** in **Settings → Preferences**. The switch is
off by default and keeps its state across restarts. When off, Fluent Reader does
not listen on the API port.

The API listens on `127.0.0.1:39124` while enabled and the app is running. Copy
the access token from the same settings section. Treat it as a secret. Resetting
the token invalidates existing clients. The API only reads subscription status;
it does not add subscriptions. Continue using `fluentreader://subscribe` to open
the subscription form.

## Check subscriptions

```http
POST http://127.0.0.1:39124/v1/subscriptions/check
Authorization: Bearer YOUR_TOKEN
Content-Type: application/json

{"urls":["https://example.com/feed.xml"]}
```

The response preserves the order of the requested URLs:

```json
{"results":[{"subscribed":true,"view":"pictures"}]}
```

`view` is present only when subscribed. It can be `articles`, `social`,
`pictures`, or `videos`. The lookup includes hidden and private subscriptions.
URLs are parsed and serialized with the standard URL parser before comparison;
redirects are not followed and query parameters are not discarded. Send between
1 and 50 HTTP or HTTPS feed URLs per request. Each URL must be at most 8192
characters and must not include credentials.

An unauthorized request returns `401`; an invalid request returns `400`; and
subscriptions that are not loaded yet return `503`. If the app or API is off,
the connection fails. Treat these cases as **unknown**, not unsubscribed. If
another application occupies the port, the settings page reports a start error.

The API does not grant cross-origin access to ordinary web pages. A Tampermonkey
script can use `GM_xmlhttpRequest` with `@connect 127.0.0.1`:

```js
// @grant GM_xmlhttpRequest
// @connect 127.0.0.1

GM_xmlhttpRequest({
    method: "POST",
    url: "http://127.0.0.1:39124/v1/subscriptions/check",
    headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
    },
    data: JSON.stringify({ urls: [feedUrl] }),
    onload: response => {
        if (response.status === 200) {
            const { results } = JSON.parse(response.responseText)
            console.log(results[0])
        }
    },
})
```
