# Pitch-Pack AI Team

A team of three AI agents, built on Claude Opus 5.5, that helps win content clients. Give it a prospect's website and it returns a **pitch pack**: a researched brief, three sample pieces written in the prospect's own voice, and a short personal pitch email. **You approve and send everything yourself.**

## Why this use case

You do client content work and want new clients, with 1–3 hours a week to spare. Sending prospects free, specific samples ("here's a post we'd write for you") is one of the strongest cold pitches a content agency can make. It's also slow to do by hand, which makes it a good first job for an AI team:

- **One clear input and output:** a URL goes in, a pack comes out.
- **Easy to judge:** you can tell in two minutes whether a pack is good.
- **Low risk:** nothing goes out without you.
- **Measurable:** packs sent → replies → calls → clients.

## The team

| Agent | Owns | Input | Output | Effort |
|---|---|---|---|---|
| **Researcher** | Facts about the prospect | URL + your notes | `1_brief.md`: business, audience, voice, gaps, 3 opportunities, sources | medium; web search + fetch |
| **Writer** | Drafting | Brief + `agency.md` (+ editor feedback) | `2_pitch_pack.md`: 3 samples, pitch email, `[CONFIRM]` list | high |
| **Editor** | Quality gate | Brief + pack | `3_review.json`: 5 scores, pass/revise, issues, risks | medium; JSON schema |
| **You** | Final decision | Pack + risks | Approve/reject; you send it | n/a |

Each agent stays in its own lane. The Researcher never writes content, the Writer never invents facts (anything it's unsure of becomes `[CONFIRM: …]`), and the Editor scores the pack but doesn't rewrite it. Prompts are in [prompts/](prompts/).

## Workflow

```
URL ─► Researcher ─► brief ─► Writer ─► pack ─► Editor ─┬─ pass ──────────► YOU approve? ─► you send it
                                 ▲                        │
                                 └── issues (max 1 loop) ─┘ still failing ─► YOU edit by hand
```

Every step writes its output to `outputs/<date>_<prospect>/`, so you can see exactly where something went wrong.

## Tool stack (version 1)

| Tool | Why |
|---|---|
| Claude Opus 5.5 via the API (`team.py`) | Runs all three agents. Uses built-in web search/fetch, so there are no scraping tools to maintain. |
| `agency.md` | Your single source of truth. Agents only claim what's in it. |
| `outputs/` folders | Your knowledge base: every brief and pack, kept. |
| `outputs/runs.csv` | Your tracker. Fill in the `replied` column by hand. |
| Your normal email | Sending stays manual on purpose. |

You don't need a task manager, database or automation tool yet. Add one only when a manual step starts to hurt.

## Setup (about 10 minutes)

1. Get an API key at console.anthropic.com and set it in your own terminal. Don't paste it into chat or into files.
   ```powershell
   setx ANTHROPIC_API_KEY "your-key"
   ```
   Open a new terminal afterwards so the key is picked up.
2. Install the SDK:
   ```bash
   python -m venv .venv
   ```
   ```bash
   .venv\Scripts\python -m pip install -r requirements.txt
   ```
3. Fill in [agency.md](agency.md).
4. Do a free dry run:
   ```bash
   .venv\Scripts\python team.py https://example.com --mock
   ```
5. Do a real run:
   ```bash
   .venv\Scripts\python team.py https://prospect-site.com --notes "manufacturer, no blog"
   ```

**Some sites block automated readers** (demo sites, sites with `robots.txt` set to `Disallow: /`). The Researcher then stops with `RESEARCH_BLOCKED` before any money is spent on drafts. To get round it, open the site in your browser, use **Save page as… (.html)**, and rerun:
```bash
.venv\Scripts\python team.py https://site.com --site-file saved-sites\site.html
```

Cost: roughly $0.30–1.50 per pack, depending on how much research is done. Check the Console's usage page after your first few runs.

## QA plan

**Checkpoints:** the Editor's gate (automatic), then your approval (always). Before sending, resolve every `[CONFIRM]` and every CHECK line.

**Common failure modes to watch:**
- Invented facts (stats, clients, quotes). The Editor is told to fail these, but you check too.
- Generic samples that could fit any company. That shows up as a low specificity score.
- Wrong voice: samples sound like you instead of the prospect.
- Thin research when a site is small or blocks fetching. The brief will say "Unknown"; skip that prospect or add notes.

**Before launch:** run 3 prospects you already know well. Compare each brief against what you know, and count the errors. Launch only if there are zero invented facts.

**Is it helping?** Track these in `runs.csv`:
- Minutes you spend per pack (target: under 15, versus about 90 by hand).
- Packs sent per week.
- Reply rate (target: above 10%).
- Calls booked, then clients won.

## 7-day launch plan (about 20–30 minutes a day)

| Day | Do |
|---|---|
| 1 | Setup steps 1–4. Fill in `agency.md` honestly. |
| 2 | Run on 2 prospects you know well. Read every brief and note any errors. |
| 3 | Fix what failed by editing one prompt at a time in `prompts/`. Rerun the same 2 prospects. |
| 4 | List 10 real target prospects (one niche works best). |
| 5 | Run 3 of them. Edit, approve and **send 3 pitches** yourself. |
| 6 | Run and send 3 more. Log your time per pack in `runs.csv`. |
| 7 | Review: what scores are you getting, how much editing did you do, any replies? Pick one improvement for week 2. |

**Week 2 ideas, only if week 1 worked:** batch mode (many URLs at once), a follow-up email agent, or reusing the same team to produce ongoing content for clients you win.

## START HERE FIRST

1. Set your `ANTHROPIC_API_KEY` (setup step 1).
2. Fill in `agency.md`.
3. Run `team.py` on **one prospect you already know well**, and read the brief before anything else.
