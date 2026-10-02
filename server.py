import os
from pathlib import Path
import logging

from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from backend import generate_reply

app = FastAPI(title="RL Teaching Assistant")

FRONTEND_DIR = Path(__file__).parent / "frontend"


class AskRequest(BaseModel):
    question: str = Field(min_length=1, max_length=4000)
    history: list = Field(default_factory=list)


@app.post("/ask")
def ask(req: AskRequest):
    try:
        reply = generate_reply(req.history, req.question)
        return {"reply": reply}
   except Exception as exc:
    logging.exception("Error while generating RL Tutor reply")
    raise HTTPException(
        status_code=500,
        detail="The model could not generate a response. Check the server logs.",
    ) from exc


@app.get("/health")
def health():
    return {"status": "ok"}


# API routes are declared before the frontend mount.
app.mount("/", StaticFiles(directory=FRONTEND_DIR, html=True), name="frontend")


if __name__ == "__main__":
    import uvicorn

    port = int(os.environ.get("PORT", os.environ.get("BACKEND_PORT", "8000")))
    uvicorn.run(app, host="0.0.0.0", port=port)
