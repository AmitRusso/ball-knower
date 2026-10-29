"""Rarity priors from popularity (docs/04-content-pipeline.md, "Rarity priors")."""

ALPHA = 0.8


def priors(views: dict[str, int], alpha: float = ALPHA) -> dict[str, float]:
    """prior(a) = views(a)^α / Σ views^α. An answer with no article/views counts as 1 view."""
    weights = {k: max(v, 1) ** alpha for k, v in views.items()}
    total = sum(weights.values())
    return {k: round(w / total, 6) for k, w in weights.items()}
