# RL Tutor — Reinforcement Learning Teaching Assistant

A small end-to-end web application based on the Lab 5 notebook.

## Project structure

```text
rl-tutor/
├── server.py
├── backend.py
├── requirements.txt
├── .env.example
├── .gitignore
├── README.md
├── rl_context.md
└── frontend/
    ├── index.html
    ├── style.css
    └── script.js
```

## How the application works

```text
Browser
   ↓
HTML/CSS/JavaScript GUI
   ↓  POST /ask
FastAPI (server.py)
   ↓
RL Tutor logic (backend.py)
   ↓
Qwen model
   ↓
JSON response
   ↓
Browser
```

`rl_context.md` supplies the RL teaching instructions used by the model.

## Running locally

1. Create a virtual environment.
2. Install `requirements.txt`.
3. Copy `.env.example` to `.env`.
4. Add your real `HF_TOKEN` to `.env`.
5. Run:

```bash
uvicorn server:app --host 0.0.0.0 --port 8000
```

Open `http://localhost:8000`.

For deployment, the hosting platform provides `PORT` automatically.

## Render/Railway configuration

Build command:

```bash
pip install -r requirements.txt
```

Start command:

```bash
uvicorn server:app --host 0.0.0.0 --port $PORT
```

Environment variables:

```text
HF_TOKEN=your_real_token
MODEL_NAME=Qwen/Qwen2.5-1.5B-Instruct
INFERENCE_MODE=api
```

Do NOT put the real token in GitHub.

## Important note about the original Colab notebook

The original Lab 5 notebook used a Colab T4 GPU and could run Qwen locally.
This deployment version defaults to `INFERENCE_MODE=api`, so the hosting
server does not need to load the full local model into its own memory.

The original notebook and Cloudflare tunnel can still be kept as development/
demonstration material, but they are not required for the deployed application.

## Security

- `.env` is ignored by Git.
- Never commit `HF_TOKEN`.
- Never put the token in `frontend/script.js`.
- Rotate/revoke a token if it is accidentally exposed.

## Health check

After deployment, visit:

```text
https://YOUR-APP-URL/health
```

A working service returns:

```json
{"status":"ok"}
```
