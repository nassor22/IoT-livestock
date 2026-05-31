Deployment Guide

1) Prepare environment variables
- Copy `.env.example` to `.env` and set real values for `DB_*` and `MQTT_BROKER`.

2) Run locally with Node

Install dependencies and start:

```bash
npm ci
export DB_USER=... DB_PASSWORD=... DB_HOST=... DB_NAME=... DB_PORT=5432 MQTT_BROKER=mqtt://... 
npm start
```

On Windows PowerShell, set env vars like:

```powershell
$env:DB_USER = 'your_user'
$env:DB_PASSWORD = 'your_pass'
$env:MQTT_BROKER = 'mqtt://broker:1883'
npm start
```

3) Run with Docker

Build image:

```bash
docker build -t iot-livestock:latest .
```

Run container (example):

```bash
docker run -d \
  -p 8000:8000 \
  -e DB_HOST=... -e DB_USER=... -e DB_PASSWORD=... -e DB_NAME=... \
  -e MQTT_BROKER=mqtt://broker:1883 \
  --name iot-livestock iot-livestock:latest
```

4) Platform-specific notes
- On Heroku/GCP/Azure, set the same environment variables in their configuration UI.
- Ensure the database is reachable from the deployment and that firewall rules allow MQTT if using an external broker.

5) Healthchecks and logs
- App listens on `PORT`.
- Tail logs with `docker logs -f iot-livestock` or your platform's log viewer.

Render (recommended for backend)
--------------------------------

Render is a good fit for the Node backend because it can run a Docker-based web service with environment variables.

1. In Render dashboard click "New +" → "Web Service" → Connect to GitHub and pick this repository.
2. Choose "Docker" as the environment and ensure the `Dockerfile` path is set to `./Dockerfile`.
3. Set the `Start Command` to `node server.js` (Render will use the Docker CMD by default).
4. Add environment variables (from `.env.example`): `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `MQTT_BROKER`, etc.
5. Set the `PORT` to `8000` (or leave blank — app reads `PORT`).
6. Deploy; Render will build the Docker image and run the service.

Notes:
- If you want Render to build without Docker, you can instead choose "Environment: Node" and set the build and start commands: `npm ci` then `npm start`.
- Ensure your PostgreSQL instance is reachable from Render (use managed DB or allow incoming connections).

Vercel (recommended for frontend)
---------------------------------

Vercel is ideal for serving the static frontend (HTML/CSS/JS). We currently separate frontend and backend: frontend on Vercel, backend on Render.

1. In Vercel, click "New Project" → Import Git Repository → Choose this repo.
2. When prompted for settings, set the root directory to the repository root and use the default static settings. Vercel will detect `vercel.json` and deploy as a static site.
3. In Project Settings → Environment Variables, you can add `NEXT_PUBLIC_API_BASE` or document your backend URL for client-side use. Alternatively rely on CORS and call your Render backend directly from the frontend.
4. Deploy the project. Vercel will publish the frontend to a URL like `https://<project>.vercel.app`.

Optional: Deploy both to Render
--------------------------------

If you prefer a single host, you can deploy both frontend and backend to Render as separate services: one static site (Render has a "Static Site" type) and one web service for the API.

Security notes
--------------
- Never commit real secrets to the repo. Use Render and Vercel dashboards to set secrets.
- Lock down DB access to trusted networks when possible.

Troubleshooting
---------------
- If the frontend cannot reach the backend, check CORS and ensure `CORS_ORIGIN` is set.
- For MQTT, if the broker is not reachable from Render, consider using a cloud MQTT provider with public endpoints or run the MQTT broker on a network-accessible host.

If you want, I can:
- Create a `render.yaml` manifest for Render (I can add it to the repo), or
- Run the `vercel` CLI to deploy from this machine (requires Vercel CLI auth).
