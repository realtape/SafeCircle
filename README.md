# SafeCircle

SafeCircle is a lightweight family check-in and emergency contact app. The UI runs in the browser, and the backend sends email alerts through the Resend API.

## Features

- Save emergency contacts locally in the browser
- Record check-ins with a status level, message, and location
- Trigger quick "I'm Safe" and "Need Help" updates
- Store a simple emergency plan with a meeting point and backup instructions
- Copy a summary you can paste into a text message or group chat
- Send real email alerts to saved contacts with valid email addresses

## Local setup

1. Copy `.env.example` to `.env`
2. Set these values:

```env
RESEND_API_KEY=your_resend_api_key
FROM_EMAIL=SafeCircle <alerts@yourdomain.com>
```

3. Start the app:

```bash
node server.js
```

4. Open `http://localhost:3000`

## Email behavior

- `Share by Email` sends to every saved contact whose `Phone or Email` field is a valid email address
- Contacts with phone numbers only are ignored by the email sender
- Resend requires a verified sender identity or domain for `FROM_EMAIL`

## Deployment

Because email sending now happens on the backend, this app should be deployed to a Node-compatible host.

Good options:

- Render
- Railway
- Fly.io
- Any VPS or Node-compatible host

Set these environment variables on your host:

- `RESEND_API_KEY`
- `FROM_EMAIL`

Start command:

```bash
node server.js
```

The server uses the host-provided `PORT` when available, otherwise it defaults to `3000`.

## Data storage

- Contacts, plans, and check-in history stay in browser `localStorage`
- Email delivery is the only server-side feature right now
