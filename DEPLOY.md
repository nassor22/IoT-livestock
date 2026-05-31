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
