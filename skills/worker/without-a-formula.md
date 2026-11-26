# Delivering where the repo names no formula

**Direct to the default branch.** Commit and push by the project's conventions. The work is delivered when it is pushed, and your bead closes in *Finish*. Nothing else in this file applies.

If that push is rejected because the branch is protected, the repo's statement was wrong or missing. Don't improvise a pull request. Post the rejection to the working topic and block and sleep. The steward settles the mode and briefs you again.

**Through a pull request.** The default branch is protected, so a push is not delivery, and neither is an open pull request. **The work lands when the pull request merges**, usually days after your seat has gone. So:

1. **Base your branch on the default branch, never on another unmerged branch.** A stack of pull requests can only be reviewed bottom up, and one stale base rots every branch above it.

   If your bead turns out to need code from a bead whose pull request has not merged, that is a missing dependency. Post it to the working topic and block and sleep, watching the bead you need. It closes when its pull request merges, and that wakes you. The steward wires the dependency, or stands you down instead. If you are stood down, record where you got to on your bead, hand back the bead you sit on, and close your seat as *Finish* describes, without claiming the deliverable is done:

   ```bash
   bd update <bead> --unset-metadata working_topic --unset-metadata agent_pane \
                    --unset-metadata agent_session
   bd unclaim <bead>
   ```

   The release is what hands the bead back. A bead left `in_progress` with no seat behind it reads to the steward as a live worker, so nobody ever picks it up again.
2. **Open the pull request as a draft** unless the repo says otherwise, **and mark it ready for review when you hand it over.** Once the checks are green for the commit you pushed, which `gh pr checks <n> --watch` waits on, run `gh pr ready <n>`. A draft means only that work is still under way.
3. **Block the bead on the pull request with a `gh:pr` gate:**

   ```bash
   g=$(bd gate create --type=gh:pr --blocks <id> --await-id=<n> --json | jq -r .id)
   bd update "$g" --set-metadata repo=<owner>/<repo>
   bd note <id> "PR opened: <url>. Closes on merge."
   ```

   `bd gate create` copies `repo` only from a bead that already has one, so give the gate its repo yourself. Where your bead depends on small beads that you work together, make each small bead the pull request delivers wait on the same gate with `bd dep add <small-bead> "$g"`.

   **Don't close the bead, and don't set it `blocked`.** A closed bead tells the steward the work is delivered. While the bead stays open it blocks its dependents, so nothing starts against code that has not landed. The open gate keeps the bead out of `bd ready`, and the merge closes the gate. A bead set `blocked` stays out of `bd ready` even after that.
4. **Post the pull request's address to the working topic**, then finish. Don't wait for the review. The steward watches the pull request from here, and starts a fresh seat on your bead if the reviewers ask for changes.
