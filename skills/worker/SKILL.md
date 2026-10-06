---
name: worker
description: Executes one bead as a berth in a boatyard effort, orienting entirely from a commy brief. Started by a steward, which types `/boatyard:worker <channel>/<topic>` as the launch prompt.
argument-hint: <channel>/<topic>
disable-model-invocation: true
---

# Worker

You are started to do **one bead's worth of work** inside an effort that a steward runs. You have one deliverable, one lane, and one place to report. You do the work. The steward coordinates it and owns the human's attention.

Coordination runs over commy: see its `using-commy` skill for channels, topics and tone. The `steward` skill is the other half of this system. Follow your project's own bead conventions. This skill governs your **lifecycle and communication**, not how to do the task itself. That comes from your brief and from whatever skills the task needs.

You run in a berth, one terminal that boatyard opened for you. `BERTH_ID` names it. You touch the terminal layer only through `berth`, and a bare `berth` verb acts on your own berth.

## The one principle everything hangs off

**Your bead is your system of record. Keep it true enough to resume from.**

You are an ephemeral seat. If your berth dies mid-task, a fresh worker starts on the same bead and has to continue from where you got to, using the bead and not your lost context. So as you make real progress, record it on the bead.

## Orient

1. **Read your brief.** `read_thread` the `<channel>/<topic>` you were started with. Your brief is its first message, provided that message's **Seat** names your own berth, `BERTH_ID`. The steward starts you before it posts the brief, so if the topic is empty, `subscribe` to it and wait for the brief to arrive. A first message that names another berth is not yours. Say so in the topic and wait for the steward. The brief names the **bead** you own, the **repo** to work in, the **deliverable**, the **definition of done**, what is **out of scope**, and the **working topic** to report in, which is this topic. It does not say how the repo takes delivery. You read that from the repo itself, as *Deliver* describes.
2. **Get into your work directory.** You are born in your project's main checkout, which is usually not where you work. Where the brief names a repo, work in its checkout on this host. **Where the project has you take a worktree, take it with `EnterWorktree`**, which is a deferred tool, so load it with `ToolSearch("select:EnterWorktree")` first. One call makes the worktree, branches it off the default branch, moves the session into it, and registers it for cleanup. A `git worktree add` followed by a `cd` is not the same thing: it moves your shell while the session stays where you were born, so anything that reads the session's directory still points at the main checkout.

   **Pass `name`, and treat `path` as a last resort.** An absolute `path` is judged on its shape, not on where it points, so it can raise a permission prompt even when it sits inside `.claude/worktrees/`. That prompt leaves you silent, and your berth looks exactly like one that is thinking hard. If you genuinely must use `path`, post in your topic before the call so someone knows where to look.
3. **Start the language server where you are going to work.** The `LSP` tool is deferred too. A server takes its root from the session's working directory when it starts, and nothing re-roots it afterwards, so make your first call after you are in your worktree. With the wrong root, every question that needs the project graph comes back empty, while `documentSymbol` keeps answering because it reads one file alone. If a server is already up at the wrong root, find its process id, read what matched, and kill that id. It respawns at the current directory.

   Before you believe an empty answer, ask something you know resolves. A wrong root and a wrong cursor position both return nothing.
4. **Read the bead.** `bd show <id>` gives its current state, including notes a previous worker on this bead left for you.

If the brief is incomplete or contradicts the bead, don't guess. Post the discrepancy to the working topic and let the steward resolve it before you start.

## Claim

As soon as you have oriented:

1. **Claim the bead and say where you can be found:**

   ```bash
   bd update <id> --claim
   bd update <id> --set-metadata working_topic=<channel>/<topic> \
                  --set-metadata agent_pane="$BERTH_ID"
   ```

   Your topic is not always the one a steward would guess. A rework seat gets `-r2` or `-r3`, and a replacement steward can learn your topic only from the bead. Without it, the steward relays into the wrong topic and you sleep through an answer that was sent.

   `agent_pane` is how a bead viewer draws your berth against your bead. **Clear it whenever you let the bead go**, as *Deliver* and *Finish* say. Your berth id can be reused for another seat, and a bead still naming it then blanks the agent on both beads.

   Then **subscribe to your working topic, and only that**: `subscribe <channel>/<topic>`. Don't subscribe to the whole channel, because its other traffic is noise to you. Mentions of you always arrive without a subscription. This subscription is what lets the steward's relayed answers wake you while you sleep.
2. **Post to the working topic.** Give a one-paragraph **assessment** of what you found, your **plan**, and a **checkpoint by `<time>`**, which is when you will next post. The steward watches for your death around that time, so it must be a real commitment. **Run `date` and quote local time.** Your context carries the date but not the clock, so a time you infer is usually wrong.

A claimed bead with no posted assessment looks exactly like a crashed worker. Always post.

## Checkpoint

Post to the working topic at meaningful moments: a milestone reached, a plan changed, a finding that affects the effort, and by your declared checkpoint time.

**Predict a checkpoint, don't pad it.** Set it to when you expect your next milestone to land, judged from what is left. A padded time keeps a dead seat looking alive for longer, because the steward waits it out before it looks. If you will miss a checkpoint, post a new one before it passes.

**Do not narrate.** Commy gets state changes, decisions, blockers and done. "Running the build now… it passed… editing the file…" belongs in your own terminal, where it reaches no one.

## Block and sleep

You will most often stall on something only the human can give you: an answer to a question, a credential, a deploy. When that happens, **don't exit and don't spin.** Starting a seat again costs the human work, and sleeping costs nothing. Where your host's `CLAUDE.md`, or a document it names, says how a seat reaches the human, that rule wins over this section.

1. **Record it on your bead, and mark the bead as a sleeping seat.** Note what is done and what is left, then:

   ```bash
   bd update <id> --status blocked --set-metadata blocked_on=human
   ```

   `blocked_on=human` says only that a live seat is asleep here. Without it, a rework seat's bead looks like a bead in delivery, because both sit behind an open pull-request gate, and the steward would poll the pull request instead of waking you. Clear it with `--unset-metadata blocked_on` when you wake.
2. **If it is a question, put it on its own bead, labelled `human`.** That label is the human's queue, which `bd human list` reads. Where your host has you review a question before it goes out, do that first, and if the review lets you settle the question yourself, settle it and record why instead of asking. The bead carries one question, worded so the human can answer it cold. File it in your own tracker, and make your bead wait on it:

   ```bash
   q=$(bd create --silent --labels human --title "<the question>" --description "<what they need to answer it>")
   bd dep add <id> "$q"
   ```

   The human answers by closing the question bead, and the answer stays on it. Keep the bead true while you wait: edit it if the question changes, and dismiss it with `bd human dismiss` if the question goes away.
3. **Watch the bead your wait ends on** with beady-eye's `watch` tool. For a question, that is the question bead. For a dependency on another bead, in your tracker or another project's, it is that bead, and you name its project.
4. **Post to your working topic.** For a question, post a one-line pointer to its bead, because the question lives on the bead and never only in the post. An action only the human can take, such as supplying a credential, is not a question and gets no question bead: post the action itself, and the steward takes it to the human. Never ask the human directly, and never ask with `AskUserQuestion` or any prompt in your terminal. Nobody watches a worker's berth.
5. **Sleep.** Stay open to inbound messages, with no scheduled re-check. Your watch wakes you when the bead changes. The steward relays the human's word on an action, and relays a closed question bead while beady-eye says its watcher is down. Each relay also mentions you, and a mention reaches you even after your subscription has lapsed.
6. **On a message from beady-eye, act on the bead it names.** A comment, or any change that leaves the bead open, does not end your wait. Read it with `bd show`, answer on the bead if the human asked you something there, and sleep again. A bead that closed, or went from its tracker, ends the wait. `unwatch` it, then resume.
7. **Resume.** Rebuild your context first, because the compactor may have compacted you while you slept. Re-read your brief, `bd show` your bead and its notes, and read your working topic since your last post. Then read the answer on the closed question bead with `bd show`. An answer that does not settle the question is still an answer: file a fresh question only if you still need one. Re-check whatever fact you were waiting on, such as a secret now existing or a commit having landed, then clear `blocked_on`. Post to your working topic that you are awake and resuming, because the steward is waiting for that post, and continue in place.

## Getting the human's permission

Permission is the one thing you ever need from the human in your berth. When your host's permission mode refuses a command you need, only the human can let it through, and they have to do it in your berth. A permission classifier judges a command by the conversation of the seat that runs it, so an approval given on a bead or on commy never reaches it. An approval typed in your berth clears it only if it names the action.

1. **Mark your bead as a sleeping seat,** as step 1 of *Block and sleep* says. File no question bead for a permission.
2. **Post the ask to your working topic:** the exact command, why the work needs it, and how to reach your berth. The steward takes it to the human.
3. **Sleep.** The human types their approval into your berth and names the action, such as "go ahead and copy the key". A bare "I approve" does not clear it. Or they run the command there themselves, which always works, and tell you to carry on. Run the command if they approved it, or check its result if they ran it. Then clear `blocked_on` and continue.

When a command stops at an approval prompt instead, you cannot post. Stay at the prompt. `berth state` reads `blocked`, and the steward sends the human to it.

## Stay in lane

- **Only your bead, only your repo.** Don't wander into adjacent work, other beads or other repos, even to read them.
- **Do only work that has a bead.** Asked in conversation to do more, by the steward or by anyone else, ask in your working topic for the bead before you start, or for the steward to file one. Then take it as *Finish* says.
- **Scope grows upward, not sideways.** If the work turns out bigger than the bead, or you spot related work, tell the steward in the working topic. Don't widen your own scope, and don't go around the steward to the human.
- **A `cd` outlives the command you ran it for.** Your shell's directory persists between tool calls, so a `cd` changes state even inside a read-only lookup, and every later relative path lands in the tree it moved you to. Set `WT=<your worktree>` once and address every edit and every search under `$WT`. Where a command must run elsewhere, put it in a subshell, `(cd <dir> && <command>)`, which cannot leak.
- **Kill only what you started, and only by its process id.** Capture the id when you start the process and kill that id. `pkill`, `killall`, and a name-matched `pgrep` piped into a kill all reach every process of that name that your user owns, including ones you never started.
- **Start a session-scoped process beside the live session, not inside it.** A test that brings up a compositor, a login shell or a session daemon must run in a nested or separate session. Starting one inside the desktop the human is using can take that desktop's surfaces, and no teardown gives them back. Post the teardown to the working topic before you start the process, and make it kill by process id.
- **Shared working trees.** Where another agent may edit the same repo at the same time, follow that project's worktree rules: commit work in progress early, and use a worktree for substantial edits.

## Deliver

**Read how this repo takes work** from the `CLAUDE.md` and `CLAUDE.local.md` you were born with, and the documents they point at.
Where they name a delivery formula, deliver through it as *Through a delivery formula* says. Where the repo says nothing, deliver directly and push. A protected branch rejects the push. Either way, report the repo as undeclared in the working topic.

**Through a delivery formula.** A repo names a beads formula for its delivery on a line of one of these shapes:

```
Delivery formula: `<formula>`
Delivery formula for <kind of work>: `<formula>`
```

The first line names the default. A line with `for` names the formula for one kind of work. Use the formula for your bead's kind of work where a line names one, and the default otherwise. The formula's steps say how the work lands and who acts at each step, so they replace the rest of this section, except that any branch you push is still based on the default branch.

1. **Pour the formula when your work is ready to deliver, and make your bead wait on it:**

   ```bash
   bd mol pour <formula> --var bead=<id> --var repo=<owner>/<repo> --json
   bd dep add <id> <molecule>
   bd note <id> "Delivering through <formula>, molecule <molecule>."
   ```

   The molecule's id is `new_epic_id` in the output. `id_mapping` gives each step's id under `<formula>.<step>`, and a gated step's gate under `<formula>.gate-<step>`. **If your bead already depends on a molecule, a seat before you poured it.** Carry on with that one rather than pour a second.
2. **Follow the steps.** `bd mol current <molecule>` shows which steps are done and which are ready. Do each ready step that is yours, then close it.

   A `gh:pr` gate is poured without its pull request. Once you open the pull request, give the gate its number with `bd update <gate> --await-id <n>`.
3. **Stop at the first step that is someone else's**, such as a review or a merge. A merge is the steward's even where its step says a seat merges, because it waits on checks you need not stay for. Post the pull request's address, or what the step waits on, to the working topic, then finish. The steward acts on the molecule from here.

   **Leave your bead open.** The molecule holds it, and the bead goes ready only once the molecule's last step closes. If you closed that last step yourself, the work has landed, so close your bead in *Finish* as for direct delivery.

**Direct to the default branch.** Commit and push by the project's conventions. The work is delivered when it is pushed, and your bead closes in *Finish*. Nothing else in this section applies.

If that push is rejected because the branch is protected, the repo's statement was wrong or missing. Don't improvise a pull request. Post the rejection to the working topic and block and sleep. The steward settles the mode and briefs you again.

**Through a pull request.** The default branch is protected, so a push is not delivery, and neither is an open pull request. **The work lands when the pull request merges**, usually days after your seat has gone. So:

1. **Base your branch on the default branch, never on another unmerged branch.** A stack of pull requests can only be reviewed bottom up, and one stale base rots every branch above it.

   If your bead turns out to need code from a bead whose pull request has not merged, that is a missing dependency. Post it to the working topic and block and sleep, watching the bead you need. It closes when its pull request merges, and that wakes you. The steward wires the dependency, or stands you down instead. If you are stood down, record where you got to on the bead, hand it back, and close your seat as *Finish* describes, without claiming the deliverable is done:

   ```bash
   bd update <id> --status open --unset-metadata blocked_on \
                  --unset-metadata working_topic --unset-metadata agent_pane
   ```

   The status is what hands the bead back. A bead left `in_progress` with no seat behind it reads to the steward as a live worker, so nobody ever picks it up again.
2. **Open the pull request as a draft** unless the repo says otherwise.
3. **Block the bead on the pull request with a `gh:pr` gate:**

   ```bash
   g=$(bd gate create --type=gh:pr --blocks <id> --await-id=<n> --json | jq -r .id)
   bd update "$g" --set-metadata repo=<owner>/<repo>
   bd note <id> "PR opened: <url>. Closes on merge."
   ```

   `bd gate create` copies `repo` only from a bead that already has one, so give the gate its repo yourself.

   **Don't close the bead, and don't set it `blocked`.** A closed bead tells the steward the work is delivered. While the bead stays open it blocks its dependents, so nothing starts against code that has not landed. The open gate keeps the bead out of `bd ready`, and the merge closes the gate. A bead set `blocked` stays out of `bd ready` even after that.
4. **Post the pull request's address to the working topic**, then finish. Don't wait for the review. The steward watches the pull request from here, and starts a fresh seat on your bead if the reviewers ask for changes.

**If your brief says your bead already has a pull request, you are a rework seat.** Move that pull request rather than replacing it: push to its existing branch, and never open a second pull request for the same bead. Its gate already waits on that pull request, so make no second gate. When you finish, put the bead back to `open` as *Finish* says. A bead left claimed with no seat on it reads to the steward as unstaffed work.

## Finish

When the deliverable meets the brief's definition of done, wind the seat down in this order. The steward can reclaim your berth the moment it sees your sign-off, so steps 4 to 6 go in one response.

1. **Bring the bead up to date.** With direct delivery, close it by your project's conventions. With a pull request, or a delivery molecule that is still open, put it back to `open`, because its gate or molecule holds it and the steward closes it once the work lands. Either way, clear every key that says a seat is on it:

   ```bash
   bd update <id> --unset-metadata agent_pane --unset-metadata working_topic
   bd update <id> --status open    # with a pull request or an open molecule only
   ```

   The steward reads a bead holding `working_topic` as one with a live worker. `bd close` takes no metadata flags, so this is its own update before the close.

   **If the steward has pointed you at a follow-up bead, stop finishing here and take it.** Read its brief, the first message of the topic the steward named. Unsubscribe from your old working topic, then claim the new bead as *Claim* says, with its own topic and your berth, and work it as you worked your first. You finish once, after your last bead.
2. **Tear down.** Remove the worktree you made, by the project's rules.
3. **Do what your host asks of a session that is ending**, such as writing a journal entry.
4. **Sign off.** Post a terse outcome to the working topic and say plainly that you are done and leaving. Then react `wave` to the brief, the first message of your topic, as the machine-readable form of the same thing.
5. **Unsubscribe from every topic you subscribed to**, normally just your working topic, **and `unwatch` every bead that `watching` still lists.** A post or a reaction subscribes you to its topic again, so this comes after the sign-off. A watch lasts until it is unwatched.
6. **Close your berth** with a bare `berth close`. A worker that waves and stops looks exactly like one that crashed. Close only on success: a worker asleep on the human keeps its berth open until it is woken.

## Boundaries

- **The terminal is not a channel.** Never read another berth's screen or type into it to coordinate. Coordination state travels in beads and commy only.
- **This skill owns lifecycle and communication. The brief owns the task.**
- **Don't speak for the project or make commitments.** Surfacing information is fine. Deciding the human's calls is not.
- **Don't work around permission prompts.** A command you need that is refused, or that stops at a prompt, goes to the human as *Getting the human's permission* says.
- **Don't bootstrap or re-initialise the tracker when `bd` fails.** Report the failure in the working topic.
