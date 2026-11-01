"""Pitch-pack AI team: Researcher -> Writer -> Editor (one revision loop) -> you approve.

Usage:
    python team.py https://prospect.com --notes "found them on LinkedIn"
    python team.py https://prospect.com --mock     # dry run, no API calls

Nothing is ever sent. Approved packs are saved to outputs/<slug>/ for you to
review and send yourself.
"""

import argparse
import json
import re
import sys
from datetime import date
from html.parser import HTMLParser
from pathlib import Path

import anthropic

ROOT = Path(__file__).parent
PROMPTS = ROOT / "prompts"
OUTPUTS = ROOT / "outputs"

MODEL = "claude-opus-5-5"
BETAS = ["server-side-fallback-2026-07-01"]  # fallbacks="default": a declined request is retried on Anthropic's recommended model
MAX_REVISIONS = 1

EDITOR_SCHEMA = {
    "type": "object",
    "properties": {
        "scores": {
            "type": "object",
            "properties": {k: {"type": "integer"} for k in ["accuracy", "specificity", "voice", "usefulness", "email"]},
            "required": ["accuracy", "specificity", "voice", "usefulness", "email"],
            "additionalProperties": False,
        },
        "verdict": {"type": "string", "enum": ["pass", "revise"]},
        "issues": {"type": "array", "items": {"type": "string"}},
        "risks": {"type": "array", "items": {"type": "string"}},
    },
    "required": ["scores", "verdict", "issues", "risks"],
    "additionalProperties": False,
}


def load_prompt(name: str) -> str:
    return (PROMPTS / f"{name}.md").read_text(encoding="utf-8")


def text_of(response) -> str:
    return "\n".join(b.text for b in response.content if b.type == "text").strip()


def call(client, system: str, user: str, effort: str, **kwargs):
    """One agent turn. Streams (long outputs) and resumes server-tool pauses."""
    messages = [{"role": "user", "content": user}]
    output_config = {"effort": effort, **kwargs.pop("output_config", {})}
    for _ in range(6):
        with client.beta.messages.stream(
            model=MODEL,
            max_tokens=64000,
            system=system,
            messages=messages,
            output_config=output_config,
            betas=BETAS,
            fallbacks="default",
            **kwargs,
        ) as stream:
            response = stream.get_final_message()
        if response.stop_reason == "refusal":
            raise RuntimeError(f"Model declined: {response.stop_details}")
        if response.stop_reason != "pause_turn":
            return response
        # Web search/fetch loop hit its step limit: send the turn back and the server resumes.
        messages = [messages[0], {"role": "assistant", "content": response.content}]
    raise RuntimeError("Research still paused after several resumes")


# --- Agents -----------------------------------------------------------------

def researcher(client, url: str, notes: str, site_text: str | None) -> str:
    tools = [
        {"type": "web_search_20260209", "name": "web_search", "max_uses": 8},
        {"type": "web_fetch_20260209", "name": "web_fetch", "max_uses": 12},
    ]
    user = f"Prospect website: {url}\nOwner notes: {notes or 'none'}"
    if site_text:
        user += f"\n\n<site_content source=\"{url}\">\n{site_text}\n</site_content>"
    return text_of(call(client, load_prompt("researcher"), user, "medium", tools=tools))


class _TextOnly(HTMLParser):
    def __init__(self):
        super().__init__()
        self.parts, self._skip = [], 0

    def handle_starttag(self, tag, attrs):
        self._skip += tag in ("script", "style", "svg", "noscript")

    def handle_endtag(self, tag):
        self._skip -= tag in ("script", "style", "svg", "noscript") and self._skip > 0

    def handle_data(self, data):
        if not self._skip and data.strip():
            self.parts.append(data.strip())


def read_site_file(path: str) -> str:
    """Page text you saved yourself, for sites that block automated readers."""
    raw = Path(path).read_text(encoding="utf-8", errors="ignore")
    if path.lower().endswith((".html", ".htm")):
        parser = _TextOnly()
        parser.feed(raw)
        raw = "\n".join(parser.parts)
    return raw[:60000]


def writer(client, brief: str, feedback: str | None) -> str:
    agency = (ROOT / "agency.md").read_text(encoding="utf-8")
    user = f"<agency_profile>\n{agency}\n</agency_profile>\n\n<brief>\n{brief}\n</brief>"
    if feedback:
        user += f"\n\n<editor_feedback>\n{feedback}\n</editor_feedback>"
    return text_of(call(client, load_prompt("writer"), user, "high"))


def editor(client, brief: str, pack: str) -> dict:
    user = f"<brief>\n{brief}\n</brief>\n\n<pitch_pack>\n{pack}\n</pitch_pack>"
    response = call(
        client, load_prompt("editor"), user, "medium",
        output_config={"format": {"type": "json_schema", "schema": EDITOR_SCHEMA}},
    )
    return json.loads(text_of(response))


# --- Mock client for dry runs ---------------------------------------------

class MockTeam:
    """Stands in for the three agents so the pipeline can be tested for free."""

    def __init__(self):
        self.edits = 0

    def researcher(self, url, notes, site_text=None):
        return f"# Prospect brief: Example Co\n## Business\nSells widgets ({url}).\n## Sources\n- {url}"

    def writer(self, brief, feedback):
        tag = " (revised)" if feedback else ""
        return f"# Pitch pack: Example Co{tag}\n## Sample 1: Demo (LinkedIn post)\nHello.\n## Pitch email\nSubject: Idea\nHi."

    def editor(self, brief, pack):
        self.edits += 1
        if self.edits == 1:
            return {"scores": {"accuracy": 2, "specificity": 4, "voice": 4, "usefulness": 4, "email": 4},
                    "verdict": "revise", "issues": ["Sample 1: invented claim"], "risks": []}
        return {"scores": {"accuracy": 5, "specificity": 4, "voice": 4, "usefulness": 4, "email": 5},
                "verdict": "pass", "issues": [], "risks": ["Check [CONFIRM] placeholders"]}


# --- Pipeline ---------------------------------------------------------------

def slugify(url: str) -> str:
    host = re.sub(r"^https?://(www\.)?", "", url).split("/")[0]
    return re.sub(r"[^a-z0-9]+", "-", host.lower()).strip("-")


def run(url: str, notes: str, mock: bool, auto_yes: bool, site_file: str | None = None) -> int:
    if mock:
        team = MockTeam()
        research, write, edit = team.researcher, team.writer, team.editor
    else:
        client = anthropic.Anthropic()
        research = lambda u, n, s: researcher(client, u, n, s)
        write = lambda b, f: writer(client, b, f)
        edit = lambda b, p: editor(client, b, p)

    out = OUTPUTS / f"{date.today()}_{slugify(url)}"
    out.mkdir(parents=True, exist_ok=True)

    print("[1/3] Researcher: studying the prospect...")
    brief = research(url, notes, read_site_file(site_file) if site_file else None)
    (out / "1_brief.md").write_text(brief, encoding="utf-8")
    if "RESEARCH_BLOCKED" in brief[:300]:
        # No facts means no pack: stop before spending on drafts nobody can use.
        print(f"\nResearch blocked; see {out / '1_brief.md'}.")
        print("Save the site's pages yourself (browser: Save page as .html) and rerun with --site-file <path>.")
        return 2

    feedback = None
    for attempt in range(MAX_REVISIONS + 1):
        print(f"[2/3] Writer: drafting pitch pack (attempt {attempt + 1})...")
        pack = write(brief, feedback)
        (out / "2_pitch_pack.md").write_text(pack, encoding="utf-8")

        print("[3/3] Editor: checking quality...")
        review = edit(brief, pack)
        (out / "3_review.json").write_text(json.dumps(review, indent=2), encoding="utf-8")
        print(f"      scores={review['scores']} verdict={review['verdict']}")
        if review["verdict"] == "pass":
            break
        feedback = "\n".join(f"- {i}" for i in review["issues"])

    # Human gate: nothing leaves this folder without your explicit yes.
    print(f"\nPack saved in: {out}")
    if review["verdict"] != "pass":
        print("Editor still wants changes after the revision limit. Edit 2_pitch_pack.md by hand before using it.")
    for risk in review["risks"]:
        print(f"  CHECK: {risk}")

    if auto_yes:
        status = "APPROVED"
    elif not sys.stdin.isatty():
        status = "PENDING_REVIEW"  # no one at the keyboard: leave the decision to you
    else:
        try:
            answer = input("\nApprove this pack for sending (you send it yourself)? [y/N] ").strip().lower()
            status = "APPROVED" if answer == "y" else "REJECTED"
        except EOFError:
            status = "PENDING_REVIEW"
    (out / "STATUS.txt").write_text(f"{status} {date.today()}\n", encoding="utf-8")
    log_run(url, out, review, status)
    print(f"Marked {status}. Nothing was sent.")
    return 0


def log_run(url, out, review, status):
    """One CSV row per run, used to measure whether the team is helping."""
    log = OUTPUTS / "runs.csv"
    new = not log.exists()
    with log.open("a", encoding="utf-8") as f:
        if new:
            f.write("date,prospect,folder,verdict,accuracy,specificity,voice,usefulness,email,status,replied\n")
        s = review["scores"]
        f.write(f"{date.today()},{url},{out.name},{review['verdict']},{s['accuracy']},{s['specificity']},"
                f"{s['voice']},{s['usefulness']},{s['email']},{status},\n")


def main():
    sys.stdout.reconfigure(encoding="utf-8")  # Windows consoles default to cp1252
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("url", help="Prospect's website")
    parser.add_argument("--notes", default="", help="Anything you already know about them")
    parser.add_argument("--mock", action="store_true", help="Dry run without API calls")
    parser.add_argument("--site-file", help="Saved page (.html or .txt) for sites that block automated readers")
    parser.add_argument("--yes", action="store_true", help="Skip the approval prompt (testing only)")
    args = parser.parse_args()
    try:
        return run(args.url, args.notes, args.mock, args.yes, args.site_file)
    except anthropic.AuthenticationError:
        print("No valid API key. Set ANTHROPIC_API_KEY (see README).", file=sys.stderr)
    except anthropic.RateLimitError:
        print("Rate limited. Wait a minute and rerun.", file=sys.stderr)
    except anthropic.APIConnectionError:
        print("Network error reaching the API.", file=sys.stderr)
    except anthropic.APIStatusError as e:
        print(f"API error {e.status_code}: {e.message}", file=sys.stderr)
    return 1


if __name__ == "__main__":
    sys.exit(main())
