import logging
import os
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from backend import generate_reply, MODEL_NAME, INFERENCE_MODE

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("rl-tutor")

app = FastAPI(title="RL Teaching Assistant")

FRONTEND_DIR = Path(__file__).parent / "frontend"


class AskRequest(BaseModel):
    question: str = Field(min_length=1, max_length=4000)
    history: list = Field(default_factory=list)


@app.post("/ask")
def ask(req: AskRequest):
    try:
        return {"reply": generate_reply(req.history, req.question)}
    except Exception as exc:
        # This line is what puts the REAL error into the Render logs.
        logger.exception("generate_reply failed (mode=%s, model=%s)", INFERENCE_MODE, MODEL_NAME)
        raise HTTPException(
            status_code=500,
            detail=f"{type(exc).__name__}: {str(exc)[:300]}",
        ) from exc


@app.get("/health")
def health():
    return {
        "status": "ok",
        "mode": INFERENCE_MODE,
        "model": MODEL_NAME,
        "hf_token_set": bool(os.environ.get("HF_TOKEN")),
    }


app.mount("/", StaticFiles(directory=FRONTEND_DIR, html=True), name="frontend")


if __name__ == "__main__":
    import uvicorn

    port = int(os.environ.get("PORT", os.environ.get("BACKEND_PORT", "8000")))
    uvicorn.run(app, host="0.0.0.0", port=port)
