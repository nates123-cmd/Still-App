# Still — Project Context

## What it is
A personal reflection PWA — the third app in a personal OS suite alongside Break (mind enrichment) and Tick (behavioral tracking). Still closes the loop on intentional growth: reflection, insight accumulation, positive habit streaks, and Stoic practice.

**Live URL:** https://nates123-cmd.github.io/Still-App/
**Local dev:** `python3 -m http.server 8080` → http://localhost:8080

---

## File structure
```
index.html    — entire app (~700 lines, HTML + CSS + JS)
sw.js         — service worker (cache name: still-vN, bump on deploy)
manifest.json — PWA manifest
dev-config.js — GITIGNORED — sets Anthropic API key in localStorage for local dev
.gitignore    — ignores dev-config.js
```

---

## Tech stack
- **No build step** — plain HTML/CSS/JS, edit and refresh
- **Model:** `claude-sonnet-4-6`, direct browser fetch with `anthropic-dangerous-direct-browser-access: true`
- **Supabase** — REST API (no SDK), anon key auth, same project as Break
- **Service worker** — cache-first static, network-first for Anthropic + Supabase, bypass on localhost

---

## Supabase config (same project as Break)
```js
SB_URL = 'https://xsmnfcmtbpeaccnyinkr.supabase.co'
SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' // anon key, safe to commit
```

### Tables — run this SQL in Supabase Dashboard → SQL Editor
```sql
create table reflections (
  id uuid primary key default gen_random_uuid(),
  text text not null,
  date date not null default current_date,
  mood text,
  tags text[],
  prompt_used text,
  created_at timestamptz not null default now()
);

create table quick_captures (
  id uuid primary key default gen_random_uuid(),
  text text not null,
  promoted boolean default false,
  dismissed boolean default false,
  created_at timestamptz not null default now()
);

create table insights (
  id uuid primary key default gen_random_uuid(),
  text text not null,
  source_reflection_id uuid,
  pushed_to_break boolean default false,
  created_at timestamptz not null default now()
);

create table habits (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  active boolean default true,
  created_at timestamptz not null default now()
);

create table habit_logs (
  id uuid primary key default gen_random_uuid(),
  habit_id uuid not null references habits(id),
  date date not null default current_date,
  unique(habit_id, date)
);

create table active_challenges (
  id uuid primary key default gen_random_uuid(),
  challenge_key text not null,
  start_date date not null default current_date,
  outcome_note text,
  completed boolean default false,
  created_at timestamptz not null default now()
);

create table challenge_logs (
  id uuid primary key default gen_random_uuid(),
  active_challenge_id uuid not null references active_challenges(id) on delete cascade,
  date date not null default current_date,
  unique(active_challenge_id, date)
);

create table saved_prompts (
  id uuid primary key default gen_random_uuid(),
  prompt_text text not null,
  practice_type text not null check (practice_type in ('morning','evening','premeditatio')),
  pinned boolean default false,
  created_at timestamptz not null default now()
);

-- RLS: enable and allow anon full access for all tables
alter table reflections enable row level security;
alter table quick_captures enable row level security;
alter table insights enable row level security;
alter table habits enable row level security;
alter table habit_logs enable row level security;
alter table active_challenges enable row level security;
alter table challenge_logs enable row level security;
alter table saved_prompts enable row level security;

create policy "anon all" on reflections for all using (true) with check (true);
create policy "anon all" on quick_captures for all using (true) with check (true);
create policy "anon all" on insights for all using (true) with check (true);
create policy "anon all" on habits for all using (true) with check (true);
create policy "anon all" on habit_logs for all using (true) with check (true);
create policy "anon all" on active_challenges for all using (true) with check (true);
create policy "anon all" on challenge_logs for all using (true) with check (true);
create policy "anon all" on saved_prompts for all using (true) with check (true);
```

Cross-app: insights are optionally pushed to Break's `mantras` table (same Supabase project, same anon key).

---

## Screens
| Screen ID | Purpose |
|---|---|
| `home` | Quick capture, habit checklist, active challenge, nav grid |
| `apikey` | API key entry (stored in localStorage) |
| `reflect` | Journal entry with Claude prompts, mood, tags, insight flagging |
| `stoic` | Box breathing ritual + 3 Stoic practice types |
| `insights` | View flagged insights, push to Break's mantras |
| `challenges` | Browse 15 science-based challenges, opt in, track active |
| `pattern` | Claude surfaces observations across recent entries |
| `captures` | Review/promote/dismiss quick captures |
| `habits-manage` | Add/remove habits |
| `prompt-library` | Browse / pin / delete saved Stoic prompts |

---

## Key JS patterns

### `sbFetch(path, opts)`
Wraps Supabase REST fetch with auth headers. Same pattern as Break.

### `callClaude(userPrompt)`
Direct Claude browser fetch. Throws on error. Parses JSON from response.

### Navigation
`navigate(id)` → pushes to `navStack`, calls `onEnter(id)` for data loading.
`goBack()` → pops navStack.
`[data-nav]` and `[data-back]` attributes wired automatically.

### Modal
`showModal(html, afterInsert)` — bottom sheet overlay. `afterInsert` callback fires after DOM insertion (use for setting textarea values, adding event listeners).

### Resurfacing
Runs once per day (tracked in `localStorage['still_resurface_date']`). Fetches captures older than 5 days that are not dismissed/promoted, picks one randomly, shows it on home.

---

## Challenge library
15 challenges are hardcoded in the `CHALLENGES` constant (not fetched from Supabase). Only `active_challenges` (user opt-ins) live in Supabase.

## Stoic practices
3 types in `STOIC_PRACTICES` constant: `evening`, `morning`, `premeditatio`. Each has 3 default prompts. Saved as a reflection with `tags: ['stoic']` and `prompt_used` = practice label.

Per-prompt actions (regenerate / save / pin) are triggered by a 500ms long-press on the prompt header (same pattern as the canvas center long-press). A `•••` glyph hints at it. Pinned prompts (from `saved_prompts` table) fill the visible 3 slots first in order of creation; remaining slots are populated from the practice's default pool. The Prompt Library screen (`prompt-library`) lets you browse, unpin, and delete saved prompts.

---

## CSS design tokens
```css
--bg:      #F5F2EE   /* warm off-white */
--text:    #1C1C1C
--muted:   #6B6560
--accent:  #A89880   /* warm stone */
--card-bg: #EDEBE7
--border:  #D8D4CE
--radius:  14px
```
Same as Break and Tick. Clean, minimal, no gamification.

---

## Deploy workflow
1. Edit `index.html` (and `sw.js`/`manifest.json` if needed)
2. Bump `CACHE_NAME` version in `sw.js` whenever deploying
3. `git add . && git commit -m "..." && git push`
4. GitHub Pages deploys within ~1 minute
