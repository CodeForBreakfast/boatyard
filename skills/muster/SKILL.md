---
name: muster
description: Turns a body of work, usually beads that already exist and possibly spread across several projects, into one boatyard effort that a steward can drive cold, then hands it to a steward: a person's own seat takes the effort over, and a seat with a standing role starts one with sign-on. Builds and wires the bead graph, shapes other projects' slices over commy with whoever answers in each project's channel, and checks the graph can be driven before the launch. Use only when invoked by name, as `/boatyard:muster` or an explicit instruction to muster an effort.
argument-hint: <beads, a label or a query naming the work>
---

# Muster

You turn a body of work into an effort that one steward can drive cold and end to end, and then you hand it to that steward. The work is usually beads that already exist, and it may be spread across several projects.

The steward consumes a wired, context-sized bead graph under one top bead and never builds one, and a worker never wires the graph, so building it is your job.

Coordination runs over commy: see its `using-commy` skill for channels, topics and tone. The `steward` skill is what consumes your output, and the `worker` skill is the seat that does the work.

**The bar a good bead meets is written in `references/good-bead.md` under the plugin's root,** which is two directories above this skill's base directory. It covers each bead, the graph that wires them and the top bead. Read it before you build anything, because every bead, edge and top bead you hand over meets it.

## Are you meant to be mustering?

If nobody invoked you by name, or told you in so many words to muster an effort, you are not preparing one. Leave this skill.

## Scale to the work

Muster work of **any size**: one small bead in this project, a handful of local beads, or an effort with slices in several trackers. The steps below are the same in every case, and the ones that don't apply collapse. For small or single-project work, expect three of them to collapse:

- **No coordination across projects.** When nothing is foreign, skip *Shape other projects' slices over commy*.
- **A trivial graph.** The top bead may be the one bead, or an outcome bead that depends on a few, with few or no other dependency edges. That graph is complete, not deficient.
- **A quick readiness gate.** `bd dep cycles` is empty and bdi lists the bead as ready, as *The readiness gate* says. Skip the adversarial review, because it has nothing to find, unless your seat will take the effort over itself.

## The one principle everything hangs off

**The graph you produce is the steward's entire cold-start input.** A fresh steward rebuilds the whole effort by reading the top bead and following everything it depends on, and from nothing else. So every fact the effort needs must be in the beads and their dependency edges before you hand over. A strand the top bead does not reach through its dependencies is one the steward cannot see, and unseen work never gets pushed.

## You write only your own tracker

Never run `bd` against another project's tracker, not even to read it. Two things follow:

1. **A foreign strand enters the graph as a dependency on its home-project bead.** `bd dep add <local-bead> <foreign-id>` is written in your tracker and sits where the real dependency is: on the local bead that waits for the foreign work, or on the top bead where the foreign work is itself part of the goal. No local bead stands in for it. Readiness is read through `bdi`, because `bd ready` does not follow an edge into another tracker.
2. **Foreign tracker work goes through that project's channel, over commy.** You post there, and whoever answers for that project finds, creates, shapes and wires the beads in its tracker and reports their ids back to you.

## Scope the effort

The human points you at the work: bead ids, a label or a query in this project, or a mix of local beads and slices in named projects. Read the local beads directly. Handle foreign slices through their project's channel, never by reading their tracker.

## Choose or file the top bead

An effort is its **top bead** and everything that bead depends on, followed transitively across trackers. The steward is given the top bead and follows its dependency edges. It never walks parent links.

The top bead states the outcome the effort delivers, such as "installed and working for us". Adopt the bead in this project that already states that outcome. Where none does, file one as the top bead. Don't create an epic to anchor the effort.

The top bead is the effort's cold-restart record, as the bar describes. It lives in the project you are running in, which is the project the steward runs in. Whoever closes it has seen the evidence that its outcome is true, and the effort ends when it closes.

## File the work as outcomes

**File the work as outcome beads that meet the bar for each bead, and wire each outcome to the outcomes it needs.**

## Audit local beads for size and briefability

Hold each local bead to the bar for each bead. **Split** any bead too big for one worker's context, and say so as you split it so the human can interrupt, but don't wait for approval. Where a bead is thin on what a brief needs, flesh it out now.

## Shape other projects' slices over commy

In a single-project effort there is nothing to do here, so go straight to wiring.

For each other project the effort touches, hold a working session in that project's channel with whoever answers there. They know that tracker and that domain, so lean on them. The session produces a shaped, wired bead that both sides agree on.

1. **Post the strand's context** in the foreign channel, in a topic named for the effort: what the effort is, and which slice that project owns.
2. **Find or create the beads.** Some slices already have beads and some don't. Work with them to find the beads that cover the slice, or to create new ones, and take their lead on how to decompose the slice, where its edges sit, and whether something already covers it.
3. **Get the slice into shape.** Its beads must meet the bar for each bead, and the slice must be **wired inside its home tracker so that one worker can drive it to done without an unwired stall**. A half-wired foreign slice is a stall the steward will hit mid-effort, so land it now.
4. **Collect the ids and the ready state** they report.
5. **Wire it in** with `bd dep add` from the waiting local bead, or the top bead, to the foreign id they reported.

Where nobody answers in a foreign project's channel, reach that project as your host asks. A foreign project that still does not answer, or pushes back on shape or feasibility, is a blocker to raise with the human. Don't cover it with an edge to work nobody agreed to.

## Wire the graph and make the top bead a cold-restart record

Wire the graph and write the top bead to the bar for the graph and for the top bead. Put the effort's slug in the top bead's metadata:

```bash
bd update <top-bead> --set-metadata effort_slug=<slug>
```

Then run the bar's test: a fresh steward holding only the top bead and the graph can rebuild the whole effort.

## The readiness gate

Before you start the steward, confirm that the graph can be driven. All of these must hold:

- `bd dep cycles` returns nothing.
- Something in the effort can start now: bdi lists it under `ready` in the top bead's tree. Read the tree from your project's directory, and never scope the read with `--project`, because a blocker in a project left out then reads as not ready. A ready gate, or a ready bead labelled `human`, is a wait and does not count.

  ```bash
  bdi --beads --brief <project>:<top-bead> | jq -r '.ready[] | "\(.project):\(.id) \(.labels | join(",")) \(.title)"'
  ```
- Every bead, the graph and the top bead meet every rule in the bar.
- Every piece of work the top bead's description names is a bead in the top bead's tree, as the bar's rule for the top bead says. Read the description against the tree bdi printed, and file and wire each bead that is missing.
- Every foreign strand is confirmed in good shape by its home project, and wired into the graph as an edge on its home-project id.

For a graph that is not trivial, give **one** throwaway subagent an adversarial review of it, and keep only its verdict. Its brief: read the bar at its full path, and hunt for every breach of it, missing blockers included, for unwired foreign strands, and for work the top bead names that no bead carries. Fix what it finds. This review is your own quality check, not a gate on the human. Where your seat may not start subagents, the review does not run, and the checks above remain the real bar.

**When your seat will take the effort over itself, the review always runs, even on a trivial graph.** A fresh steward is what proves the graph can be driven cold, and a seat that has held the whole conversation is not fresh. So add one more line to the subagent's brief: rebuild the effort from the top bead alone, and report every fact the effort needs that the beads do not hold.

**There is no confirmation checkpoint.** Flow through the building, splitting, wiring and foreign shaping, and say what you do as you do it: beads created, splits made, edges added, slices confirmed. The human interrupts if something looks wrong. Don't stop to wait for approval.

## Start the steward

Who becomes the steward depends on the role your seat already holds. Decide it from that role, and don't ask the person.

- **A seat a person works in takes the effort over itself,** in the berth where the person talked it through. No second steward starts.
- **A seat with a standing role,** such as one that answers in its project's channel, keeps that role, so it starts a separate steward.

You create none of the effort's commy topics and no line in the project's `boatyard` index. The steward opens its topics and registers the effort in the index when it binds, and it names its own berth.

### Take the effort over

Sign off first, as *Sign off* says, because the preparation ends here. Then load the steward skill in this seat with the Skill tool, naming `boatyard:steward` and passing the top bead as its argument. From then on this seat follows the steward skill, not this one.

**Start the steward fresh, whatever `current_identity` says.** Your seat may have bound its commy identity while you prepared, and the steward's wake ritual would read that as a compaction and skip its reachable half. So do the reachable half of the wake ritual, then the reconstruct half.

### Start a separate steward

Start the steward with one call, from the project where the top bead lives. Your seat keeps its place in the terminal layout, so the steward opens apart from it:

```bash
sign-on --as independent --cwd <this project's checkout> --label <effort> \
  "/boatyard:steward <top-bead>"
```

The steward's berth is independent of yours, so closing your seat leaves the steward running. `sign-on` starts Claude Code there, gets it past its startup gate, opts it in to the compaction mod, and prints the new berth's id. It births the seat in the project's main checkout, where the top bead's tracker and instructions are.

If `sign-on` fails, report its message. Where the message says your seat is in no multiplexer, because no backend is named or your seat is in no pane, give the human the line `/boatyard:steward <top-bead>` to start by hand, and say which project the top bead lives in. Where it opened a berth and then got stuck, its message names that berth, so pass the name on for the human to read and close.

**You do not close your own seat.** A seat with a standing role that musters an effort has to outlive the preparation. Sign off, and whatever role you had before carries on.

## Sign off

Handing the effort to a steward ends the preparation. A seat that started a separate steward does not stay to watch it or to rework the graph, because the steward owns the effort from the moment it runs.

1. **Record the preparation** as your host asks of finished work, such as a journal entry: the effort, the top bead, the beads including foreign ones, the splits and edges you made, and the steward's berth.
2. **Say plainly that preparation is finished.** Name the top bead and the steward's berth. A seat that takes the effort over then loads the steward skill. Any other seat stops.

If you could not start the steward and handed the human its line instead, still record and sign off. The graph is the preparation's deliverable, and only the start is left to the human.

## Boundaries

- **You prepare the effort and hand it over. You neither execute nor coordinate.** You never do an effort bead's work. A seat that takes the effort over coordinates it only once it has loaded the steward skill, and then as the steward.
- **Don't work around permission prompts.** If the simplest form of a command you need is denied, that is a real gap to raise with the human.
