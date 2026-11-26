# Finishing an effort

**Before the top bead closes, account for every open bead the effort filed outside its tree.** Gather every bead filed during the effort, in any project. Your coordination topic and each working topic name the beads that seats raised, and the topics you opened in other projects' channels name what their desks filed for you. Write each as `<project>:<id>`, and list those still open that the top bead's tree does not reach:

```bash
reached=$(bdi --json --all <project>:<top-bead> | jq -r '.trees[].nodes[] | "\(.project):\(.id)"' | sort -u)
for b in <project>:<id> ...; do
  grep -qxF "$b" <<<"$reached" && continue
  bdi --json --all "$b" | jq -r --arg b "$b" '[.trees[].nodes[] | select("\(.project):\(.id)" == $b and .status != "closed")][0] // empty | "\($b) \(.status) \(.title)"'
done
```

Settle each bead it prints. Where the effort's outcome needs it, wire it in as *Track discovered work* says and push it onto a seat, so the top bead waits on it. Otherwise nobody owns it, and your wrap-up names it.

**The effort ends when the top bead closes, and you never close it on your own say-so.** Whoever closes it has seen the evidence that its outcome is true. Once every open bead the effort filed is settled, and nothing the top bead depends on is still open, start no worker on the top bead. File a bead to check that evidence instead, and make the top bead depend on it:

```bash
e=$(bd create --silent --title "Check the evidence that <top-bead> is true" --description "<the evidence the top bead names>")
bd dep add <top-bead> "$e"
```

Start a worker on that bead, and brief it to close the bead with what it saw, then close the top bead. bd refuses to close a bead claimed by anyone else, so release your claim with `bd unclaim <top-bead>` before you start that worker. Its berth lands on the evidence bead, so yours stays on the top bead. Where only the human can see the evidence, closing the top bead is their action, and you release the claim before you hand it to them.

When the top bead has closed:

1. Post a short wrap-up to the coordination topic. Name each bead the effort left with no owner, as `<project>:<id>` with its title, and say that nobody owns it. The human then decides whether it becomes an effort.
2. Make sure every effort bead reflects reality.
3. Strike your line in `#<project>/boatyard` with `✓`.
4. Clear your berth and session from the top bead with `bd update <top-bead> --unset-metadata agent_pane --unset-metadata agent_session`, if it still names you. `unwatch` every bead that beady-eye's `watching` still lists.
5. Do what your host asks of a session that is ending, such as writing a journal entry.
6. Close your berth with a bare `berth close`, as your last act. Closing it also closes every berth you opened: the bead viewer, and any worker still open. So close only when no worker is asleep on an answer. Between events, sleep with your berth open, just as a worker does.
