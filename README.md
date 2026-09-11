# Edge Computing and Cloud Continuum: Web App Showcase

This repository contains a small suite of interactive web apps that demonstrate concepts related to edge computing and the cloud continuum.

## Projects

1. **Pillars of Edge Computing and Cloud Continuum**
   - Path: `Pillars of Edge Computing and Cloud Continuum/`
   - Focus: Interactive explanations for latency, bandwidth, data sovereignty and privacy, and offline resilience.

2. **Autonomous Driving 3D**
   - Path: `Autonomous Driving 3d/`
   - Focus: 3D simulation and interaction patterns inspired by edge-assisted autonomous systems.

3. **Remote Patient Monitoring (Healthcare)**
   - Path: `Remote Patient Monitoring (Healthcare)/`
   - Focus: Patient telemetry simulation and dashboard-style UI behavior.

4. **Smart Irrigation**
   - Path: `Smart Irrigation/`
   - Focus: Sensor-informed irrigation logic and monitoring ideas.

## Launcher Page

A cover/launcher page is provided at the repository root:

- `index.html`

This page lets users quickly choose and open any of the four projects.

## Run Locally

Because these are static web apps, you can run them with a simple static server.

### Option A: VS Code Live Server

1. Install the Live Server extension.
2. Open `index.html`.
3. Click **Go Live**.

### Option B: Python HTTP Server

From the repository root, run:

```bash
python -m http.server 8000
```

Then open:

- `http://localhost:8000/`

## Deploy to GitHub Pages

This repository includes a GitHub Actions workflow:

- `.github/workflows/deploy-pages.yml`

### One-time setup

1. Open repository **Settings** on GitHub.
2. Go to **Pages**.
3. Set source/build to **GitHub Actions** (if not already set).

### Deploy

Push to the `main` branch:

```bash
git add .
git commit -m "Update project showcase"
git push origin main
```

After the workflow succeeds, your site is available at:

- `https://jookie262.github.io/edge-computing-cloud-continuum/`

## Repository Structure

```text
.
|-- .github/
|   `-- workflows/
|       `-- deploy-pages.yml
|-- Autonomous Driving 3d/
|-- Pillars of Edge Computing and Cloud Continuum/
|-- Remote Patient Monitoring (Healthcare)/
|-- Smart Irrigation/
|-- index.html
`-- README.md
```

## License

Add your preferred license here (for example: MIT).
