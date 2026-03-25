const fs = require("fs");
const fsp = require("fs/promises");
const http = require("http");
const path = require("path");

loadDotEnv();

const PORT = Number(process.env.PORT || 3000);
const RESEND_API_KEY = process.env.RESEND_API_KEY || "";
const FROM_EMAIL = process.env.FROM_EMAIL || "";
const PUBLIC_DIR = __dirname;

const MIME_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".webmanifest": "application/manifest+json; charset=utf-8",
};

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === "POST" && req.url === "/api/send-email") {
      await handleSendEmail(req, res);
      return;
    }

    if (req.method !== "GET" && req.method !== "HEAD") {
      sendJson(res, 405, { error: "Method not allowed." });
      return;
    }

    await serveStatic(req, res);
  } catch (error) {
    console.error(error);
    sendJson(res, 500, { error: "Internal server error." });
  }
});

server.listen(PORT, () => {
  console.log(`SafeCircle running at http://localhost:${PORT}`);
});

async function handleSendEmail(req, res) {
  if (!RESEND_API_KEY || !FROM_EMAIL) {
    sendJson(res, 500, { error: "Server email settings are missing." });
    return;
  }

  const body = await readJsonBody(req);
  const recipients = Array.isArray(body.recipients) ? body.recipients.filter(isEmailAddress) : [];
  const subject = typeof body.subject === "string" ? body.subject.trim() : "";
  const message = typeof body.message === "string" ? body.message.trim() : "";

  if (recipients.length === 0) {
    sendJson(res, 400, { error: "At least one valid recipient email is required." });
    return;
  }

  if (!subject || !message) {
    sendJson(res, 400, { error: "Email subject and message are required." });
    return;
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: FROM_EMAIL,
      to: recipients,
      subject,
      text: message,
    }),
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    sendJson(res, response.status, {
      error: payload.message || "The email provider rejected the request.",
    });
    return;
  }

  sendJson(res, 200, { ok: true, id: payload.id || null });
}

async function serveStatic(req, res) {
  const rawUrl = req.url === "/" ? "/index.html" : req.url;
  const decodedPath = decodeURIComponent(rawUrl.split("?")[0]);
  const normalizedPath = path.normalize(decodedPath).replace(/^(\.\.(\/|\\|$))+/, "");
  const filePath = path.join(PUBLIC_DIR, normalizedPath);

  if (!filePath.startsWith(PUBLIC_DIR)) {
    sendJson(res, 403, { error: "Forbidden." });
    return;
  }

  try {
    const data = await fsp.readFile(filePath);
    const extension = path.extname(filePath).toLowerCase();
    res.writeHead(200, { "Content-Type": MIME_TYPES[extension] || "application/octet-stream" });
    if (req.method === "HEAD") {
      res.end();
      return;
    }
    res.end(data);
  } catch {
    sendJson(res, 404, { error: "Not found." });
  }
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
      if (raw.length > 1_000_000) {
        reject(new Error("Request body too large."));
      }
    });
    req.on("end", () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        reject(new Error("Invalid JSON."));
      }
    });
    req.on("error", reject);
  });
}

function isEmailAddress(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function loadDotEnv() {
  const envPath = path.join(__dirname, ".env");
  try {
    const raw = fs.readFileSync(envPath, "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) {
        continue;
      }
      const separatorIndex = trimmed.indexOf("=");
      if (separatorIndex === -1) {
        continue;
      }
      const key = trimmed.slice(0, separatorIndex).trim();
      const value = trimmed.slice(separatorIndex + 1).trim().replace(/^"|"$/g, "");
      if (key && !(key in process.env)) {
        process.env[key] = value;
      }
    }
  } catch {
    // Ignore missing .env files when the host injects environment variables.
  }
}
