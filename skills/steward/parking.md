# Parking an effort

**Parking stops an effort part-way, on purpose, so that a fresh steward can resume it cold.** The human parks before a reboot, so every seat on the machine may park at once, and the pause may last minutes or weeks. You also park to wait for a scheduled run, once nothing else in the effort can move until the run is due. Leave the effort where the wake ritual can rebuild it from beads and commy alone, then go:

1. **Say so in the coordination topic**: "parking `<top-bead>`".
2. **Stand down each worker that is working.** Post `stand down: parking. Push your work in progress to your branch and name the branch in your note.` to its working topic, mentioning it. It notes where it got to on its bead, hands back the bead it sits on, and closes its berth. Wait for each sign-off. A worker that has not signed off by the time you finish ends with your berth, and the resuming steward treats it as a seat that died.
3. **Leave each worker that sleeps on the human as it is.** It recorded where it got to on its bead before it slept. Closing your berth ends its seat, and the resuming steward hands its bead back as *Reconstruct* step 6 says. Parking is the one time you close your berth over a sleeping worker.
4. **Record what a resuming steward needs.** File any discovered work as a bead, as *Track discovered work* says. Write everything else that is only in your head as a note on the top bead, such as which capped bead goes next or what the human told you in your berth. It goes in a note, not the description, because the top bead's description changes only when the effort's outcome does:

   ```bash
   bd note <top-bead> "Parked: <what a resuming steward needs>"
   ```
5. **Hand on your watches.** Two kinds of wait outlive you: every wait on the human, and the check of a scheduled run you park to wait for. A wait on the human is an open `human` bead, a filed action or an open gate labelled `human-move` in the effort. The bead that checks a run waits on a timer gate, as push-gate state 7 says. Your host's instructions name who watches a parked effort's waits, and where to tell them. Send them one message, naming each bead and the top bead, each written as `<project>:<id>`. Leave the human no reminder of a run, because the watcher starts a steward once the gate closes and the check goes ready. Where your host names no watcher, say in the coordination topic which waits nobody watches. A check still goes ready, tally shows the effort with no live steward, and a person starts one.
6. **Let go of the effort.** `unwatch` every bead that beady-eye's `watching` still lists, then release your claim on the top bead and clear your berth and session from it:

   ```bash
   bd update <top-bead> --unset-metadata agent_pane --unset-metadata agent_session
   bd unclaim <top-bead>
   ```
7. **Do what your host asks of a session that is ending**, then close your berth with a bare `berth close`.

A steward resumes the effort through the wake ritual, as on any fresh start, and reads your note in `bd show <top-bead>` at *Reconstruct* step 3.
