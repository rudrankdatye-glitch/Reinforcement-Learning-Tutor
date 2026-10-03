from pathlib import Path
import logging
import os

from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger("rl-tutor")

INFERENCE_MODE = os.environ.get("INFERENCE_MODE", "api").strip().lower()
# IMPORTANT: in "api" mode this must be a model that an Inference Provider serves.
# Qwen/Qwen2.5-1.5B-Instruct is NOT served, so keep it for "local" mode only.
MODEL_NAME = os.environ.get("MODEL_NAME", "meta-llama/Llama-3.1-8B-Instruct")
CONTEXT_PATH = Path(__file__).parent / "rl_context.md"


def load_context() -> str:
    return CONTEXT_PATH.read_text(encoding="utf-8")


def _normalize_history(history):
    """Accept [[user, bot], ...] or [{"role":..., "content":...}, ...]."""
    msgs = []
    for item in history or []:
        if isinstance(item, dict) and "role" in item and "content" in item:
            msgs.append({"role": item["role"], "content": str(item["content"])})
        elif isinstance(item, (list, tuple)) and len(item) == 2:
            msgs.append({"role": "user", "content": str(item[0])})
            msgs.append({"role": "assistant", "content": str(item[1])})
        else:
            logger.warning("Skipping malformed history item: %r", item)
    return msgs


def build_messages(history, question):
    messages = [{"role": "system", "content": load_context()}]
    messages.extend(_normalize_history(history))
    messages.append({"role": "user", "content": question})
    return messages


_local_pipe = None
_api_client = None


def _get_local_pipe():
    global _local_pipe
    if _local_pipe is None:
        from transformers import pipeline
        import torch

        _local_pipe = pipeline(
            "text-generation",
            model=MODEL_NAME,
            dtype=torch.float16,
            device_map="auto",
        )
    return _local_pipe


def _get_api_client():
    global _api_client
    if _api_client is None:
        from huggingface_hub import InferenceClient

        token = os.environ.get("HF_TOKEN")
        if not token:
            raise RuntimeError("HF_TOKEN is not set in the environment.")
        _api_client = InferenceClient(token=token)
    return _api_client


def generate_reply(history, question) -> str:
    messages = build_messages(history, question)

    if INFERENCE_MODE == "api":
        client = _get_api_client()
        completion = client.chat_completion(
            model=MODEL_NAME,
            messages=messages,
            max_tokens=500,
            temperature=0.6,
        )
        return completion.choices[0].message.content

    if INFERENCE_MODE == "local":
        pipe = _get_local_pipe()
        from transformers import GenerationConfig

        gen_config = GenerationConfig(max_new_tokens=500, do_sample=True, temperature=0.6)
        out = pipe(messages, generation_config=gen_config)
        return out[0]["generated_text"][-1]["content"]

    raise ValueError(f"Unsupported INFERENCE_MODE={INFERENCE_MODE!r}. Use 'api' or 'local'.")
