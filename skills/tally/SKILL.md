---
name: tally
description: Read-only roll-up of every boatyard effort across projects, and what each one needs from the human right now. Use when it is unclear which efforts are live or parked, such as "what are my stewards doing", "what is the boatyard up to", "which efforts need me" or "which efforts are ready to resume", or when several stewards are running and cannot be told apart.
---

# Tally

One screen that answers one question: **across every project, which efforts are open, and what does each need from the human right now?** This skill reads the trackers through `bdi`, and each live effort's decisions topic on commy. It never posts or writes, and it never starts a steward.

## What an effort is

An effort is a top bead carrying `effort_slug` metadata, and everything that bead depends on, followed transitively across trackers. Parent links put nothing in an effort, so a child bead with a slug of its own is an effort of its own. Two beads in one project that share a slug are one effort, and the shorter id is its top bead. An effort bead that another effort depends on is part of that effort, and is not listed on its own.

An effort is open while its top bead is unfinished. Its steward is whoever holds a live claim on the top bead, because a steward claims it as it binds and the claim's lease stays live while the steward runs, on whichever machine.

## Steps

1. **List the efforts.** Run `efforts`, the script beside this file in the skill's base directory. It prints one JSON line per open effort:

   | Field | Holds |
   |---|---|
   | `project`, `top`, `slug` | Where the effort lives, its top bead, and its slug. `also` lists other beads sharing the slug. |
   | `steward` | The holder of the top bead's claim while its lease is live, or `null` where no live steward holds it. |
   | `ready` | How many beads in the effort are ready to work. A gate and a question labelled `human` are not counted. |
   | `gates` | The open gates in the effort, which wait on a merge or another outside event. |
   | `asks` | The open questions labelled `human` in the effort, each with its id and title. |
   | `restart` | The `sign-on` line that starts a steward on the top bead in its project's checkout. |

   A project `bdi` could not read is named on stderr, so say its efforts are missing from the tally. The parked efforts that are ready to resume are the lines with no steward and some ready work:

   ```bash
   <base directory>/efforts | jq -c 'select(.steward == null and .ready > 0)'
   ```
2. **Read each live effort's decisions topic.** For an effort with a steward, `read_thread` the `#<channel>/<slug>-decisions` topic in its project's channel. The latest unresolved item is an open ask, alongside the effort's `asks`. A parked effort's new steward reads its decisions topic as it starts, so skip those.
3. **Roll up, the efforts that need the human first.** Give one line per effort:
   - ⚫ **Parked with ready work.** No steward, and `ready` above zero. Give its `restart` line.
   - 🔴 **Waiting on you.** It has an open question or an unresolved decisions item.
   - 🟡 **Waiting on a merge.** No ready work, and open gates. A merge is usually a review only the human can move.
   - 🟢 **Running clean.** A steward, and none of the above.
   - ⚪ **Parked with nothing ready.** No steward, and nothing to start one for yet. It waits on a date, a status of `blocked`, or work in another effort.

## Output

A compact list, most urgent first:

```
⚫ ex-8w3 · shipwright/mast-step     · parked, 3 ready: sign-on --as independent --cwd '/srv/yard/shipwright' --label 'mast-step' '/boatyard:steward ex-8w3'
🔴 ex-4k2 · shipwright/hull-survey   · waiting on you: choose the survey window
🔴 ex-9q7 · chandlery/stock-sync     · waiting on you: ex-9q7.4, which supplier feed to trust
🟡 ex-3m1 · shipwright/rigging-rules · waiting on 2 merges
🟢 ex-7d5 · chandlery/price-feed     · running clean
⚪ ex-2c6 · chandlery/winter-refit   · parked, nothing ready
```

Keep each to one line: the top bead's id, the project and slug, and what the effort needs. Name a question bead by its id and title. Where an effort has several asks, give the count and name one. The human reads this to decide where to spend attention, then opens the decisions topic or the question bead, or runs the restart line.

## Caveats

- **"Running clean" means no open ask and nothing parked. It is not proof of progress.** An effort can still have a pull request in review with nobody on it. Where liveness matters, judge it by recent work product, such as a post, a commit or a bead update. Never judge it by commy's presence, which can report a live seat as offline.
- **The steward check reads only the claim on the top bead.** A steward hands its claim back while a worker checks the evidence for the effort's outcome, so for that short while the effort reads as parked with nothing ready.
- **A waiting merge is usually healthy rather than stalled.** A day is the mechanism working, and a fortnight means the review it waits on has been forgotten. The gate's bead says how long it has waited.

## When not to use it

- To check a single effort you already know, read its decisions topic and its tree in `bdi` directly.
- For detail about the workers within one effort, read that effort's working topics. That is the steward's job, not this roll-up's.
