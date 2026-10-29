"""Prompt templates: a parameterized question plus the query that answers it.

A template (pipeline/templates/*.yaml) has:

  id, league, pool       ids; `pool` names a pipeline/pools/*.yaml
  text, short, note      with {{placeholders}}: {{n}}, {{award.name}}, {{teamA.label}}
  query                  SPARQL returning ?item (the answers), with {{placeholders}}
  params                 optional grid: name -> list of values (scalars or mappings)
  group_by               optional: variables whose distinct values each make a prompt;
                         {{var.qid}} / {{var.label}} come from ?var / ?varLabel
  answer_filter          optional Python expression over row variables and params
  changes                optional "MM-DD..MM-DD" windows when the answer list can change
  expect_events          optional count of ?event values a complete answer list needs
                         (award years, finals played); fewer -> flagged as incomplete
  labels                 optional QID -> display name for group_by values
  needs_review_definition, wildcard, max_candidates
"""

import itertools
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import yaml

from .paths import PIPELINE, TEMPLATES

_PLACEHOLDER = re.compile(r"\{\{\s*([\w.]+)\s*\}\}")
WILDCARD_LEAGUES = {"ANY", "OLYMPICS"}


@dataclass
class Template:
    id: str
    league: str
    pool: str
    text: str
    query: str
    note: str = ""
    short: str = ""
    params: dict[str, list[Any]] = field(default_factory=dict)
    group_by: list[str] = field(default_factory=list)
    answer_filter: str | None = None
    changes: list[str] = field(default_factory=list)
    needs_review_definition: bool = False
    warning: str | None = None  # shown on every candidate in review
    wildcard: bool | None = None
    max_candidates: int | None = None
    labels: dict[str, str] = field(default_factory=dict)  # QID -> display name for group_by values
    expect_events: str | None = None  # e.g. "{{award.years}}": flag when ?event finds fewer

    @property
    def is_wildcard(self) -> bool:
        return self.league in WILDCARD_LEAGUES if self.wildcard is None else self.wildcard


def load(path: Path) -> Template:
    raw = yaml.safe_load(path.read_text(encoding="utf-8"))
    if raw.get("id") != path.stem:
        raise ValueError(f"{path.name}: id must match the file name")
    return Template(**raw)


def load_all(only: list[str] | None = None) -> list[Template]:
    out = [load(p) for p in sorted(TEMPLATES.glob("*.yaml"))]
    return [t for t in out if not only or t.id in only]


def lookup(ctx: dict[str, Any], dotted: str) -> Any:
    value: Any = ctx
    for part in dotted.split("."):
        if not isinstance(value, dict) or part not in value:
            raise KeyError(f"No value for {{{{{dotted}}}}}")
        value = value[part]
    return value


def render(text: str, ctx: dict[str, Any]) -> str:
    return _PLACEHOLDER.sub(lambda m: str(lookup(ctx, m[1])), text)


def load_franchises() -> dict[str, Any]:
    return yaml.safe_load((PIPELINE / "franchises.yaml").read_text(encoding="utf-8"))


def shared_context() -> dict[str, Any]:
    """Values every template can use: {{franchises.NBA}} -> SPARQL VALUES pairs
    (?anyTeamItem ?currentFranchise) from pipeline/franchises.yaml."""
    franchises = {}
    for league, spec in load_franchises().items():
        pairs = [(q, q) for q in spec["teams"]] + list((spec.get("former") or {}).items())
        franchises[league] = " ".join(f"(wd:{a} wd:{b})" for a, b in pairs)
    return {"franchises": franchises}


def grid(params: dict[str, list[Any]]) -> list[dict[str, Any]]:
    """Cartesian product of the parameter lists ([{}] when there are none)."""
    names = list(params)
    return [dict(zip(names, combo)) for combo in itertools.product(*(params[n] for n in names))]


def param_key(value: Any) -> str:
    if isinstance(value, dict):
        for k in ("qid", "id", "key"):
            if k in value:
                return str(value[k])
        return ",".join(f"{k}={value[k]}" for k in sorted(value))
    return str(value)


def candidate_key(template_id: str, ctx: dict[str, Any], order: list[str]) -> str:
    parts = [param_key(ctx[name]) for name in order]
    return template_id + (":" + "+".join(parts) if parts else "")


class _Attr(dict):
    """dict with attribute access, so filters can say `award.min` as well as `n`."""

    __getattr__ = dict.__getitem__


def matches_filter(expr: str | None, row: dict[str, Any], ctx: dict[str, Any]) -> bool:
    if not expr:
        return True
    scope = {k: _Attr(v) if isinstance(v, dict) else v for k, v in ctx.items()}
    scope.update(row)
    # Templates are authored in this repo; no builtins keeps a typo from doing harm.
    return bool(eval(expr, {"__builtins__": {}}, scope))  # noqa: S307


def expand(template: Template, run_query, label_for=None) -> list[dict[str, Any]]:
    """[{key, ctx, answers, events}] for every parameter combination / group.

    `run_query(sparql) -> rows` and `label_for(qids) -> {qid: label}` (for
    group_by values without ?varLabel or a `labels` entry) are injected so
    tests can run without the network.
    """
    out: list[dict[str, Any]] = []
    order = list(template.params) + template.group_by
    shared = shared_context()
    for ctx in grid(template.params):
        rows = run_query(render(template.query, {**shared, **ctx}))
        if not template.group_by:
            groups = {(): rows}
        else:
            groups: dict[tuple, list] = {}
            for r in rows:
                groups.setdefault(tuple(r[v] for v in template.group_by), []).append(r)
        missing = {
            q
            for values in groups
            for q in values
            if q not in template.labels
        }
        looked_up = label_for(sorted(missing)) if label_for and missing else {}
        for group_values, group_rows in sorted(groups.items()):
            gctx = dict(ctx)
            for var, qid in zip(template.group_by, group_values):
                label = (
                    template.labels.get(qid)
                    or next((r.get(f"{var}Label") for r in group_rows if r.get(f"{var}Label")), None)
                    or looked_up.get(qid, qid)
                )
                gctx[var] = {"qid": qid, "label": label}
            answers = sorted(
                {
                    r["item"]
                    for r in group_rows
                    if "item" in r and matches_filter(template.answer_filter, r, gctx)
                }
            )
            events = len({r["event"] for r in group_rows if "event" in r})
            out.append(
                {"key": candidate_key(template.id, gctx, order), "ctx": gctx, "answers": answers, "events": events}
            )
    return out
