"""Offline tests: no network, no writes outside tmp_path."""

import datetime as dt

import pytest

from bk import filters, priors, schedule, templates, tiers
from bk.pools import clean_aliases


# ── tiers ────────────────────────────────────────────────────────────────────
def test_tiers_come_from_scoring_ts():
    ts = tiers.tiers()
    assert [t.id for t in ts][0] == "BALL_KNOWER"
    assert ts[-1].max_share == 1.0
    assert tiers.tier_for_share(0.0).id == "BALL_KNOWER"
    assert tiers.tier_for_share(0.9).id == "BENCH_WARMER"


def test_expected_yards_is_prior_weighted():
    rare, common = tiers.tier_for_share(0.005), tiers.tier_for_share(0.5)
    assert tiers.expected_yards([0.5, 0.5]) == common.yards
    assert tiers.expected_yards([0.005]) == pytest.approx(0.005 * rare.yards)


# ── priors ───────────────────────────────────────────────────────────────────
def test_priors_sum_to_one_and_keep_order():
    p = priors.priors({"a": 10_000, "b": 100, "c": 0})
    assert sum(p.values()) == pytest.approx(1, abs=1e-5)
    assert p["a"] > p["b"] > p["c"] > 0


def test_priors_alpha_flattens_the_head():
    flat = priors.priors({"a": 10_000, "b": 100}, alpha=0.8)
    raw = priors.priors({"a": 10_000, "b": 100}, alpha=1.0)
    assert flat["a"] < raw["a"]


# ── filters ──────────────────────────────────────────────────────────────────
def test_reject_reasons():
    good = [0.3] + [0.005] * 4 + [0.68 / 5] * 5
    assert filters.reject_reasons(good) == []
    assert any("answers" in r for r in filters.reject_reasons([0.5, 0.5]))
    assert any("obvious" in r for r in filters.reject_reasons([0.1] * 9 + [0.005] * 2))
    assert any("deep cut" in r for r in filters.reject_reasons([0.2] * 5))


def test_overlap_uses_the_smaller_list():
    assert filters.overlap({"a", "b"}, {"a", "b", "c", "d"}) == 1.0
    assert filters.overlap({"a"}, set()) == 0.0


@pytest.mark.parametrize(
    ("changes", "generated", "day", "hit"),
    [
        (["06-01..06-25"], "2026-10-28", "2026-11-20", False),
        (["06-01..06-25"], "2026-05-20", "2026-07-01", True),  # Finals played in between
        (["06-01..06-25"], "2026-06-10", "2026-06-11", True),  # generated mid-Finals
        (["12-20..01-10"], "2026-12-01", "2027-01-05", True),  # window wraps the year
        ([], "2026-01-01", "2027-01-01", False),
    ],
)
def test_volatile_between(changes, generated, day, hit):
    got = filters.volatile_between(changes, dt.date.fromisoformat(generated), dt.date.fromisoformat(day))
    assert bool(got) is hit


# ── templates ────────────────────────────────────────────────────────────────
def test_render_dotted_placeholders():
    assert templates.render("won {{t.phrase}} ({{n}})", {"t": {"phrase": "2 titles"}, "n": 2}) == "won 2 titles (2)"
    with pytest.raises(KeyError):
        templates.render("{{missing}}", {})


def test_expand_grid_filter_and_events():
    t = templates.Template(
        id="t", league="NBA", pool="p", text="{{x.n}}", query="Q {{x.n}}",
        params={"x": [{"qid": "A", "n": 1}, {"qid": "B", "n": 3}]},
        answer_filter="titles >= x.n",
    )  # fmt: skip
    rows = [
        {"item": "Q1", "titles": 5, "event": "e1"},
        {"item": "Q2", "titles": 1, "event": "e2"},
        {"event": "e3"},  # a final won by a defunct team: counts as an event, not an answer
    ]
    seen = []
    out = templates.expand(t, lambda q: seen.append(q) or rows)
    assert seen == ["Q 1", "Q 3"]
    assert [(c["key"], c["answers"], c["events"]) for c in out] == [
        ("t:A", ["Q1", "Q2"], 3),
        ("t:B", ["Q1"], 3),
    ]


def test_expand_group_by_with_label_override():
    t = templates.Template(
        id="g", league="SOCCER", pool="p", text="", query="q", group_by=["a", "b"], labels={"C1": "Real Madrid"}
    )
    rows = [
        {"item": "P1", "a": "C1", "b": "C2", "bLabel": "Barcelona"},
        {"item": "P2", "a": "C1", "b": "C2"},
        {"item": "P3", "a": "C1", "b": "C3"},
    ]
    out = templates.expand(t, lambda q: rows)
    assert out[0]["key"] == "g:C1+C2"
    assert out[0]["ctx"]["a"]["label"] == "Real Madrid"
    assert out[0]["ctx"]["b"]["label"] == "Barcelona"
    assert out[0]["answers"] == ["P1", "P2"]


def test_shipped_templates_load_and_render():
    loaded = templates.load_all()
    assert len(loaded) >= 10
    leagues = {t.league for t in loaded}
    assert {"NFL", "NBA", "MLB", "NHL", "SOCCER", "OLYMPICS"} <= leagues
    shared = templates.shared_context()
    for t in loaded:
        for ctx in templates.grid(t.params):
            assert "{{" not in templates.render(t.query, {**shared, **ctx})


def test_franchise_values_cover_every_league():
    f = templates.shared_context()["franchises"]
    assert f["NBA"].count("(wd:") >= 30 and f["NFL"].count("(wd:") >= 32


# ── pools ────────────────────────────────────────────────────────────────────
def test_clean_aliases():
    got = clean_aliases("LeBron James", ["LeBron James", "King James", "LBJ", "23", "x (y)", "LBJ"], ["The Chosen One"], ["lbj"])
    assert got == ["King James", "The Chosen One"]


# ── schedule ─────────────────────────────────────────────────────────────────
def _p(key, league, answers, template=None, wildcard=False, yards=60.0):
    return {
        "key": key, "template": template or key, "league": league, "wildcard": wildcard,
        "answers": [{"qid": a} for a in answers], "expected_yards": yards,
        "changes": [], "generated": "2026-10-01",
    }  # fmt: skip


def test_valid_hole_rules():
    hole = [
        _p("a", "NBA", "12"), _p("b", "NBA", "34"), _p("c", "NFL", "56"),
        _p("d", "MLB", "78"), _p("e", "OLYMPICS", "9", wildcard=True),
    ]  # fmt: skip
    assert schedule.valid_hole(hole)
    assert not schedule.valid_hole(hole[:4] + [_p("f", "NBA", "x")])  # 3 from one league
    assert not schedule.valid_hole(hole[:4] + [_p("f", "NHL", "12")])  # overlaps a
    assert schedule.valid_hole(hole[:4] + [_p("f", "NHL", "z", template="a")])  # repeats are only penalized


def test_pick_and_eligibility():
    approved = [
        _p("nba1", "NBA", ["n1"]), _p("nba2", "NBA", ["n2"]), _p("nfl1", "NFL", ["f1"]),
        _p("mlb1", "MLB", ["m1"]), _p("nhl1", "NHL", ["h1"]), _p("oly", "OLYMPICS", ["o1"], wildcard=True),
    ]  # fmt: skip
    day = dt.date(2026, 11, 1)
    sched = {"base": schedule.DEFAULT_BASE, "holes": []}
    hole = schedule.pick(day, schedule.eligible(day, approved, sched), 60)
    assert hole and len(hole) == 5 and schedule.valid_hole(hole)
    assert any(p["wildcard"] for p in hole)
    # Once scheduled, a prompt is not eligible again within a year.
    sched["holes"].append({"date": "2026-11-01", "hole_no": 218, "prompts": [p["key"] for p in hole]})
    later = schedule.eligible(dt.date(2027, 6, 1), approved, sched)
    assert not {p["key"] for p in hole} & {p["key"] for p in later}


def test_hole_numbers_follow_the_date():
    sched = {"base": schedule.DEFAULT_BASE, "holes": []}
    assert schedule.hole_no(sched, dt.date(2026, 10, 28)) == 214
    assert schedule.hole_no(sched, dt.date(2026, 11, 27)) == 244
