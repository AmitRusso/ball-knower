"""Wikidata SPARQL client (CC0 data)."""

import urllib.parse
from dataclasses import dataclass, field
from typing import Any

from . import http

ENDPOINT = "https://query.wikidata.org/sparql"
ENTITY_PREFIX = "http://www.wikidata.org/entity/"
ENWIKI = "https://en.wikipedia.org/wiki/"

PREFIXES = """PREFIX wd: <http://www.wikidata.org/entity/>
PREFIX wdt: <http://www.wikidata.org/prop/direct/>
PREFIX p: <http://www.wikidata.org/prop/>
PREFIX ps: <http://www.wikidata.org/prop/statement/>
PREFIX pq: <http://www.wikidata.org/prop/qualifier/>
PREFIX wikibase: <http://wikiba.se/ontology#>
PREFIX bd: <http://www.bigdata.com/rdf#>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
PREFIX skos: <http://www.w3.org/2004/02/skos/core#>
PREFIX schema: <http://schema.org/>
PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>
"""

_NUMERIC = {
    "http://www.w3.org/2001/XMLSchema#integer",
    "http://www.w3.org/2001/XMLSchema#decimal",
    "http://www.w3.org/2001/XMLSchema#double",
}


def _value(binding: dict[str, str]) -> Any:
    v = binding["value"]
    if binding["type"] == "uri" and v.startswith(ENTITY_PREFIX):
        return v[len(ENTITY_PREFIX) :]
    if binding.get("datatype") in _NUMERIC:
        n = float(v)
        return int(n) if n.is_integer() else n
    return v


def sparql(query: str) -> list[dict[str, Any]]:
    """Run a query; each row maps variable name -> QID / number / string."""
    res = http.fetch_json(
        ENDPOINT,
        data={"query": PREFIXES + query},
        headers={"Accept": "application/sparql-results+json"},
    )
    return [{k: _value(b) for k, b in row.items()} for row in res["results"]["bindings"]]


@dataclass
class Item:
    qid: str
    label: str
    aliases: list[str] = field(default_factory=list)
    sitelinks: int = 0
    born: int | None = None
    enwiki: str | None = None  # English Wikipedia article title


DESCRIBE_BATCH = 250


def describe(qids: list[str]) -> dict[str, Item]:
    """Label, aliases, sitelink count, birth year and enwiki title for each QID.
    English first; many items now carry only a language-neutral ("mul") label."""
    out: dict[str, Item] = {}
    unique = sorted(set(qids))
    for i in range(0, len(unique), DESCRIBE_BATCH):
        chunk = unique[i : i + DESCRIBE_BATCH]
        values = " ".join(f"wd:{q}" for q in chunk)
        rows = sparql(f"""
SELECT ?item ?label ?links ?born ?article WHERE {{
  VALUES ?item {{ {values} }}
  OPTIONAL {{ ?item rdfs:label ?en FILTER(LANG(?en) = "en") }}
  OPTIONAL {{ ?item rdfs:label ?mul FILTER(LANG(?mul) = "mul") }}
  BIND(COALESCE(?en, ?mul) AS ?label)
  OPTIONAL {{ ?item wikibase:sitelinks ?links }}
  OPTIONAL {{ ?item wdt:P569 ?born }}
  OPTIONAL {{ ?article schema:about ?item ; schema:isPartOf <https://en.wikipedia.org/> }}
}}""")
        for r in rows:
            q = r["item"]
            item = out.get(q) or Item(qid=q, label=r.get("label") or q)
            item.sitelinks = max(item.sitelinks, int(r.get("links") or 0))
            born = r.get("born")
            if born and item.born is None and born[:4].isdigit():
                item.born = int(born[:4])
            article = r.get("article")
            if article and article.startswith(ENWIKI):
                item.enwiki = urllib.parse.unquote(article[len(ENWIKI) :])
            out[q] = item
        alias_rows = sparql(f"""
SELECT ?item ?alias WHERE {{
  VALUES ?item {{ {values} }}
  ?item skos:altLabel ?alias FILTER(LANG(?alias) IN ("en", "mul"))
}}""")
        for r in alias_rows:
            item = out.get(r["item"])
            if item and r["alias"] not in item.aliases:
                item.aliases.append(r["alias"])
    for item in out.values():
        item.aliases.sort()
    return out
