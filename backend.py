from pathlib import Path
import os

from dotenv import load_dotenv

# Load environment variables from .env when running locally.
# Render/Railway can provide the same variables through their Environment settings.
load_dotenv()

INFERENCE_MODE = os.environ.get("INFERENCE_MODE", "api").strip().lower()
MODEL_NAME = os.environ.get("MODEL_NAME", "Qwen/Qwen2.5-1.5B-Instruct")
CONTEXT_PATH = Path(__file__).parent / "rl_context.md"


def load_context() -> str:
    return CONTEXT_PATH.read_text(encoding="utf-8")


def build_messages(history, question):
    system_prompt = load_context()
    messages = [{"role": "system", "content": system_prompt}]

    for user_msg, bot_msg in history:
        messages.append({"role": "user", "content": user_msg})
        messages.append({"role": "assistant", "content": bot_msg})

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
            raise RuntimeError(
                "HF_TOKEN is not configured. Add it to your local .env "
                "or to the deployment platform's environment variables."
            )

        _api_client = InferenceClient(token=token)

    return _api_client


def generate_reply(history, question) -> str:
    messages = build_messages(history, question)

    if INFERENCE_MODE == "api":
        client = _get_api_client()
        completion = client.chat.completions.create(
            model=MODEL_NAME,
            messages=messages,
            max_tokens=500,
            temperature=0.6,
        )
        return completion.choices[0].message.content

    if INFERENCE_MODE == "local":
        pipe = _get_local_pipe()

        from transformers import GenerationConfig

        gen_config = GenerationConfig(
            max_new_tokens=500,
            do_sample=True,
            temperature=0.6,
        )

        out = pipe(messages, generation_config=gen_config)
        return out[0]["generated_text"][-1]["content"]

    raise ValueError(
        f"Unsupported INFERENCE_MODE={INFERENCE_MODE!r}. "
        "Use 'api' or 'local'."
    )
