"""
services/ai_provider.py

Abstract AI provider with:
  - MockProvider  – always available, simulates realistic latency + occasional failures
  - OpenRouterProvider – real LLM integration (requires OPENROUTER_API_KEY)

The job worker calls `get_provider().generate(challenge_prompt, user_prompt)`.
"""
from __future__ import annotations
import asyncio
import random
import logging
from abc import ABC, abstractmethod

from config import settings

logger = logging.getLogger(__name__)


# ── Abstract base ──────────────────────────────────────────────────────────────

class AIProvider(ABC):
    @abstractmethod
    async def generate(self, challenge_prompt: str, user_prompt: str) -> str:
        """Return generated text or raise an exception on failure."""


# ── Mock Provider ──────────────────────────────────────────────────────────────

_MOCK_OUTPUTS = [
    (
        "✦ CAMPAIGN CONCEPT: «{user_prompt}» ✦\n\n"
        "Introducing **NEON VOID** — a scent born from the electric chaos of a rain-soaked "
        "Tokyo alleyway at 3 AM. Top notes of liquid chrome and burnt sugar dissolve into a "
        "heart of magnetic iris and synthetic oud. The base? Raw ambition crystallised into "
        "smoky vetiver and cold titanium.\n\n"
        "**Visual Identity**: Holograms that smell. Bottles shaped like fractured cityscapes. "
        "Campaign shot in an abandoned server farm where the only light is bioluminescent Gen-Z tears.\n\n"
        "**Tagline**: *'Smell like the future nobody prepared you for.'*"
    ),
    (
        "✦ CAMPAIGN CONCEPT: «{user_prompt}» ✦\n\n"
        "**GHOST PROTOCOL** — a luxury cyberpunk fragrance for those who exist between systems.\n\n"
        "Opening with hyper-ozone and white tea, evolving through a core of liquid amber and "
        "AI-distilled rose absolute. Drydown: black musk and encrypted sandalwood.\n\n"
        "**Campaign**: AR filter that overlays your face with glitching luxury brand logos. "
        "Limited drop of 777 units — each bottle contains a randomised NFC chip with an "
        "exclusive generative music track.\n\n"
        "**Tagline**: *'Your identity is the password.'*"
    ),
    (
        "✦ CAMPAIGN CONCEPT: «{user_prompt}» ✦\n\n"
        "**SYSTEM ERROR // BEAUTIFUL** — when the algorithm finally breaks and smells incredible.\n\n"
        "A disruptive accord: bergamot corrupted by industrial iron, saffron compiled over "
        "synthetic leather, base code of labdanum and dark patchouli.\n\n"
        "**Campaign**: 60-second ad filmed entirely on security cameras. No influencers. "
        "No models. Just anonymous figures in neon-lit spaces who pause, look directly into "
        "the lens, and disappear.\n\n"
        "**Tagline**: *'Glitch, but make it luxury.'*"
    ),
    (
        "✦ CAMPAIGN CONCEPT: «{user_prompt}» ✦\n\n"
        "**DARKNET DARLING** — haute parfum for the terminally online generation.\n\n"
        "Notes: burned marshmallow and indigo violet on top. Decrypted jasmine and electric "
        "pepper at the core. Base of addictive amber and corrupted cedarwood.\n\n"
        "**Campaign**: A 72-hour livestream in an all-white room. Every purchase unlocks "
        "one pixel of color. The final buyer decides the campaign aesthetic forever.\n\n"
        "**Tagline**: *'You are the limited edition.'*"
    ),
]

_FAILURE_RATE = 0.0   # 0% chance of mock failure (temporary)
_TIMEOUT_RATE = 0.0   # 0% chance of mock timeout (temporary)


class MockProvider(AIProvider):
    async def generate(self, challenge_prompt: str, user_prompt: str) -> str:
        # Simulate realistic processing time (2–6 seconds)
        await asyncio.sleep(random.uniform(2.0, 6.0))

        roll = random.random()
        if roll < _TIMEOUT_RATE:
            raise TimeoutError("Mock provider: generation timed out after 30 s")
        if roll < _TIMEOUT_RATE + _FAILURE_RATE:
            raise RuntimeError("Mock provider: generation service temporarily unavailable")

        template = random.choice(_MOCK_OUTPUTS)
        return template.format(user_prompt=user_prompt)


# ── OpenRouter Provider ────────────────────────────────────────────────────────────

class OpenRouterProvider(AIProvider):
    def __init__(self):
        try:
            from openai import AsyncOpenAI
            self._client = AsyncOpenAI(
                base_url="https://openrouter.ai/api/v1",
                api_key=settings.OPENROUTER_API_KEY,
            )
        except ImportError:
            raise RuntimeError("openai package not installed")

    async def generate(self, challenge_prompt: str, user_prompt: str) -> str:
        system_msg = (
            "You are an AI creative director for luxury brand campaigns. "
            "Generate a vivid, specific, and surprising campaign concept. "
            "Be bold, imaginative, and concrete. Use formatting to make it scannable."
        )
        user_msg = (
            f"Challenge: {challenge_prompt}\n\n"
            f"Contestant's creative direction: {user_prompt}\n\n"
            "Generate a full campaign concept including: concept name, fragrance/product notes "
            "description, campaign visual/experiential idea, and a tagline. Keep it under 300 words."
        )
        response = await self._client.chat.completions.create(
            model=settings.OPENROUTER_MODEL,
            messages=[
                {"role": "system", "content": system_msg},
                {"role": "user", "content": user_msg},
            ],
            max_tokens=400,
            temperature=0.9,
        )
        return response.choices[0].message.content.strip()


# ── Factory ────────────────────────────────────────────────────────────────────

def get_provider() -> AIProvider:
    if settings.AI_PROVIDER == "openrouter" and settings.OPENROUTER_API_KEY:
        logger.info("Using OpenRouter provider (%s)", settings.OPENROUTER_MODEL)
        return OpenRouterProvider()
    logger.info("Using Mock AI provider")
    return MockProvider()
