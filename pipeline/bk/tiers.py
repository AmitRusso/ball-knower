"""Tier thresholds and yardages, read from src/lib/scoring.ts (the only place they live)."""

import re
from dataclasses import dataclass
from functools import cache

from .paths import SCORING_TS

_TIER = re.compile(r"\{\s*id:\s*'(\w+)'.*?maxShare:\s*([\d.]+),\s*yards:\s*(\d+)\s*\}")


@dataclass(frozen=True)
class Tier:
    id: str
    max_share: float
    yards: int


def parse(source: str) -> list[Tier]:
    block = source.split("export const TIERS", 1)[1].split("] as const", 1)[0]
    tiers = [Tier(m[1], float(m[2]), int(m[3])) for m in _TIER.finditer(block)]
    if not tiers:
        raise ValueError("No tiers found in scoring.ts")
    return tiers


@cache
def tiers() -> list[Tier]:
    return parse(SCORING_TS.read_text(encoding="utf-8"))


def tier_for_share(share: float) -> Tier:
    """Same rule as tierForShare() in scoring.ts."""
    ts = tiers()
    return next((t for t in ts if share < t.max_share), ts[-1])


def expected_yards(priors: list[float]) -> float:
    """Yards per correct shot if picks follow the priors (the blend at zero picks)."""
    return sum(p * tier_for_share(p).yards for p in priors)
