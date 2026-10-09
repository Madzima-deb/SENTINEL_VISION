# Sentinel Vision AI

A full-stack computer-vision monitoring demo for analyzing uploaded images and browser-camera snapshots with Hugging Face object detection.

## Features

- React + Vite responsive dashboard
- Upload JPEG, PNG, or WebP images
- Optional browser-camera preview and frame capture (HTTPS/localhost required)
- Real Hugging Face inference through a server-side Express API
- Person and vehicle summaries, confidence scores, bounding boxes, and detection history
- No Hugging Face token in frontend code
- Server-side file validation and request rate limiting

> This is a standalone GitHub-ready source package based on the Sentinel Vision AI deployment. The hosted AppDeploy version uses AppDeploy's own auth/data SDK; this package replaces those platform-specific APIs with a local Express API so the source can be run and demonstrated independently.

## Requirements

- Node.js 20+
- Hugging Face access token with permission to use Inference Providers
- Internet access for model inference

## Run locally

### 1. Backend

```bash
cd backend
cp .env.example .env
# Edit .env and add your Hugging Face token
npm install
npm run dev
```

### 2. Frontend

In another terminal:

```bash
cd frontend
npm install
npm run dev
```

Open the URL printed by Vite, usually `http://localhost:5173`.

## Configuration

Backend `.env`:

```env
PORT=4000
HF_TOKEN=hf_your_token_here
HF_MODEL_ID=facebook/detr-resnet-50
CLIENT_ORIGIN=http://localhost:5173
```

Never commit `.env` or expose `HF_TOKEN` to browser code.

## API

- `GET /api/health` — backend health
- `GET /api/model/status` — model configuration status (does not reveal token)
- `GET /api/events` — recent detection history
- `DELETE /api/events/:id` — remove a history event
- `POST /api/detect` — multipart form with `image` field

## Model

Default model: `facebook/detr-resnet-50`. Check the current Hugging Face model card, provider availability, license, and inference response format before public or commercial use. Results depend on the model and provider; this is object detection, not identity recognition.

## Camera and privacy

Camera access is requested only after the user presses **Start camera**. The browser may require HTTPS outside localhost. Images are sent to the configured inference provider for analysis; do not upload images unless you have permission to process them. The demo keeps detection metadata in memory only and does not persist image files. Restarting the backend clears history.

## Limitations

- History is in-memory for easy local presentation, so it resets when the backend restarts.
- Authentication and per-user data isolation from the hosted AppDeploy version are not included in this local demo. Add a production authentication layer before exposing this API publicly.
- This project performs image/frame analysis, not continuous background surveillance or facial recognition.
