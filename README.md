# SafeCircle

SafeCircle is a lightweight family check-in and emergency contact app built as a single-page web app with no dependencies.

## Features

- Save emergency contacts locally in the browser
- Record check-ins with a status level, message, and location
- Trigger quick "I'm Safe" and "Need Help" updates
- Store a simple emergency plan with a meeting point and backup instructions
- Copy a summary you can paste into a text message or group chat

## Run

Because the app is static, you can open `index.html` directly in a browser.

If you prefer serving it locally with Python:

```bash
python -m http.server 8080
```

Then open `http://localhost:8080`.

## Data storage

All data is stored in `localStorage` on the current device and browser. Nothing is sent to a server.
