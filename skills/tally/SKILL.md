---
name: tally
description: Read-only roll-up of every live boatyard effort across projects, and what each one needs from the human right now. Use when it is unclear which efforts are live, such as "what are my stewards doing", "what is the boatyard up to" or "which efforts need me", or when several stewards are running and cannot be told apart.
---

# Tally

One screen that answers one question: **across every project, which efforts are live, and what does each need from the human right now?** An effort's asks sit in two places: its own decisions topic, and question beads labelled `human` in the trackers its work runs in. This skill gathers those scattered surfaces into one ranked list. It reads commy and `bdi`, and never posts or writes.

## Where the index lives

Each project channel has a **`boatyard` topic**, `#<project>/boatyard`, which is the index of that project's efforts. Each steward keeps one line there for its effort. It posts the line when it binds and strikes it with `✓` when the top bead closes. A steward with a seat in another project also posts a pointer line in that project's index. The index lives on commy rather than in the trackers, because no tracker knows which of its beads tops an effort.

A live line carries the top bead's id, the effort's home topic `#<project>/<effort>`, and one line saying what the effort is. The effort's ask queue is `#<project>/<effort>-decisions`, which follows from the home topic.

## Steps

1. **Read every index.** Run `list_channels`, then `read_thread` the `boatyard` topic in each channel. A channel without one returns nothing, so skip it.
   - **Read only the lines shaped as index lines,** `<top-bead-id> · #<project>/<effort> · <what>`. An index topic can carry other posts, such as an effort's own coordination when its slug is the topic's name.
   - **Key on the top bead's id across channels, not per channel.** A pointer line in a foreign project repeats a top bead its home channel already lists.
   - **Take the latest line per top bead and ignore the earlier ones.** A steward whose seat cannot use `edit_message` restates its line by posting a new one, so one top bead can appear several times, and only the last is current.
   - Of those latest lines, the ones without `✓` are the live set.
2. **Check each live effort has a live steward.** A steward names its berth on the top bead as it binds, so the top bead's agent in `bdi` is its steward. Read the effort's tree once, and keep it for the next step:

   ```bash
   bdi --json --all --project <project> <project>:<top-bead> > tree.json
   jq '[.. | objects | select(.id? == "<top-bead>" and has("status"))] | first | .agent' tree.json
   ```

   `null` means no live steward drives the effort, because the berth it named has gone. Nothing moves such an effort, and its asks can sit unrelayed, however healthy its index line looks.
3. **Read each live effort's asks.** An effort has an open ask if either of these holds. It runs unblocked only when neither does.
   - **Its decisions topic.** `read_thread` the `#<project>/<effort>-decisions` topic. The latest unresolved item is an open ask.
   - **Its question beads.** A seat that waits on the human files its question as a bead labelled `human`, and the waiting work depends on that bead. Read every project's unfinished beads once for the whole tally with `bdi --beads --all-projects`, which carries each bead's labels. Then read each effort's tree, whose beads carry no labels, and take the ids in it together with the ids those beads are `blocked_by`. Each `human` bead whose id is in that set is an open ask:

     ```bash
     jq '[.. | objects | select(has("id") and has("status")) | .id, (.blocked_by // [])[]] | unique' tree.json > effort.json
     bdi --beads --all-projects \
       | jq -c --slurpfile effort effort.json \
           '.beads[] | select((.labels | index("human")) and (.id | IN($effort[0][]))) | {project, id, title}'
     ```
4. **Roll up, the efforts that need the human first.** Give one line per effort. Lead with efforts that have no live steward, and give the line that starts one: `/boatyard:steward <top-bead>`, started in the top bead's project. Then the efforts that have an open ask. Then list any whose line carries a `⏳ capped` suffix, because those wait on a merge, which is usually a review only the human can move. The efforts running clean come last.

## Output

A compact list, most urgent first:

```
⚫ ex-8w3 · #shipwright/mast-step     · no live steward: start /boatyard:steward ex-8w3 in shipwright
🔴 ex-4k2 · #shipwright/hull-survey   · waiting on you: choose the survey window
🔴 ex-9q7 · #chandlery/stock-sync     · waiting on you: ex-9q7.4, which supplier feed to trust
🟡 ex-3m1 · #shipwright/rigging-rules · ⏳ capped: 2 PRs awaiting merge in sail-loft
🟢 ex-7d5 · #chandlery/price-feed     · running clean (last worker checkpoint 20m ago)
```

Keep each to one line: the top bead's id, the effort's topic, and either the open ask or "running clean". Name a question bead by its id and title. Where an effort has several asks, give the count and name one. The human reads this to decide where to spend attention, then opens the decisions topic or the question bead to act.

## Caveats

- **The index sees only stewards that registered.** An effort whose steward never bound will not appear, so say the list may not be complete rather than implying that it is.
- **"Running clean" means no open ask and not capped. It is not proof of progress, and it does not mean nothing is outstanding.** An effort below its cap can still have a pull request in review with nobody on it, and the index line does not show that. Where liveness matters, judge it by recent work product in the effort's topics, such as a post, a commit or a bead update. Never judge it by commy's presence, which can report a live seat as offline.
- **The steward check reads only the berth named on the top bead.** A berth that another agent took over, without naming it on a bead, still reads as a live steward.
- **A capped effort is usually healthy rather than stalled.** It has reached its limit of unmerged pull requests in a repo and waits for one to land, so report it as waiting on a merge. Its steward still starts seats to rebase or rework those pull requests, so worker activity on a capped effort is normal. Say how long it has been capped if the line tells you. A day is the mechanism working, and a fortnight means the review it waits on has been forgotten, yet the two look the same in the index.
- **A line struck with `✓` is a finished effort,** kept for a glance. It is not live.
- **`berth list` is no substitute.** It shows berth states only in the yard it runs in, while the index and decisions topics cover every project and machine.

## When not to use it

- To check a single effort you already know, read its decisions topic and its tree in `bdi` directly.
- For detail about the workers within one effort, read that effort's working topics. That is the steward's job, not this roll-up's.
