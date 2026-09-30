---
name: tally
description: Read-only roll-up of every live boatyard effort across projects, and what each one needs from the human right now. Use when it is unclear which efforts are live, such as "what are my stewards doing", "what is the boatyard up to" or "which efforts need me", or when several stewards are running and cannot be told apart.
---

# Tally

One screen that answers one question: **across every project, which efforts are live, and what does each need from the human right now?** Each steward drives one effort and surfaces its asks in that effort's own decisions topic. This skill gathers those scattered surfaces into one ranked list. It reads commy and never posts.

## Where the index lives

Each project channel has a **`boatyard` topic**, `#<project>/boatyard`, which is the index of that project's efforts. Each steward keeps one line there for its effort. It posts the line when it binds and strikes it with `✓` when the anchor finishes. A steward with a seat in another project also posts a pointer line in that project's index. Beads are not the source here, because each project's tracker is separate and cannot be queried with the others.

A live line carries the anchor bead's id, the effort's home topic `#<project>/<effort>`, and one line saying what the effort is. The effort's ask queue is `#<project>/<effort>-decisions`, which follows from the home topic.

Efforts started by the system boatyard replaces are indexed the same way, in a `fleet` topic in each project channel. Read those topics too, until the last such effort closes.

## Steps

1. **Read every index.** Run `list_channels`, then `read_thread` the `boatyard` topic and the `fleet` topic in each channel. A channel without one of those topics returns nothing for it, so skip it.
   - **Read only the lines shaped as index lines,** `<anchor-id> · #<project>/<effort> · <what>`. An index topic can carry other posts, such as an effort's own coordination when its slug is the topic's name.
   - **Key on the anchor id across channels, not per channel.** A pointer line in a foreign project repeats an anchor its home channel already lists.
   - **Take the latest line per anchor id and ignore the earlier ones.** A steward whose seat cannot use `edit_message` restates its line by posting a new one, so one anchor can appear several times, and only the last is current.
   - Of those latest lines, the ones without `✓` are the live set.
2. **Read each live effort's ask queue.** For each live line, `read_thread` its `#<project>/<effort>-decisions` topic. The latest unresolved item is what that effort needs from the human. An empty or fully answered queue means it runs unblocked.
3. **Roll up, the efforts that need the human first.** Give one line per effort. Lead with efforts that have an open ask. Then list any whose line carries a `⏳ capped` suffix, because those wait on a merge, which is usually a review only the human can move. The efforts running clean come last.

## Output

A compact list, most urgent first:

```
🔴 ex-4k2 · #shipwright/hull-survey   · waiting on you: choose the survey window
🔴 ex-9q7 · #chandlery/stock-sync     · waiting on you: supply the supplier API key
🟡 ex-3m1 · #shipwright/rigging-rules · ⏳ capped: 2 PRs awaiting merge in sail-loft
🟢 ex-7d5 · #chandlery/price-feed     · running clean (last worker checkpoint 20m ago)
```

Keep each to one line: the anchor id, the effort's topic, and either the open ask or "running clean". The human reads this to decide where to spend attention, then opens the relevant decisions topic to act.

## Caveats

- **The index sees only stewards that registered.** An effort whose steward never bound will not appear, so say the list may not be complete rather than implying that it is.
- **"Running clean" means no open ask and not capped. It is not proof of progress, and it does not mean nothing is outstanding.** An effort below its cap can still have a pull request in review with nobody on it, and the index line does not show that. Where liveness matters, judge it by recent work product in the effort's topics, such as a post, a commit or a bead update. Never judge it by commy's presence, which can report a live seat as offline.
- **A green line is not proof of a live steward.** The index says an effort was registered, not that anything still drives it. A steward whose berth died leaves its line unstruck and its ask queue empty, which shows as `🟢 running clean`, the healthiest-looking state in the roll-up.
- **A capped effort is usually healthy rather than stalled.** It has reached its limit of unmerged pull requests in a repo and waits for one to land, so report it as waiting on a merge. Its steward still starts seats to rebase or rework those pull requests, so worker activity on a capped effort is normal. Say how long it has been capped if the line tells you. A day is the mechanism working, and a fortnight means the review it waits on has been forgotten, yet the two look the same in the index.
- **A line struck with `✓` is a finished effort,** kept for a glance. It is not live.
- **`berth list` is no substitute.** It shows berth states only in the yard it runs in, while the index and decisions topics cover every project and machine.

## When not to use it

- To check a single effort you already know, read its decisions topic directly.
- For detail about the workers within one effort, read that effort's working topics. That is the steward's job, not this roll-up's.
