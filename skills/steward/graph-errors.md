# Errors in an effort's graph

Each line the graph review prints starts with the bead that holds the error, and its project says whose tracker that is. **Fix only what is in your own tracker.** For an error on another project's bead, post the bead and the edge in that project's channel, and edit nothing there.

A question bead or an action you file for one of these is wired and watched like any other: the bead it holds up depends on it.

In your own tracker:

- **`unconfigured` on an id written `<project>:<id>` is a malformed edge.** bd names another project's bead by its bare id. Remove the edge with `bd dep remove <bead> <project>:<id>`, then add it again with `bd dep add <bead> <id>`.
- **`not-held` means no tracker holds the id.** First `bd show` the id. If your tracker holds it, the edge is sound and bdi could not draw it, so leave it. Otherwise the bead was deleted, mistyped or never filed. Point the edge at the bead the waiting bead's description says it waits for, where you can find it. Remove the edge where that work is done or dropped. Where you cannot tell what the edge was for, file a question bead.
- **A gate that lacks its pull request never closes.** Give it what its bead's pull request says is missing, with `bd update <gate> --set-metadata repo=<owner>/<repo>` or `bd update <gate> --await-id <n>`.
- **A cycle means a bead waits on one of its own forebears.** Remove the edge the plan contradicts, where the plan makes clear which edge that is, and file a question bead where it does not.
- **`stale-pane` means a closed bead still names a berth.** Clear it with `bd update <bead> --unset-metadata agent_pane --unset-metadata agent_session`. `orphan-claim` and `stale-claim` mean a seat went dark, which the skill's *Every stall is yours to break* covers.
- **`held-by-unread` or a `tracker` line means a tracker gave bdi no answer.** The edge is not at fault. Read again next wake, and if the same tracker still fails, post in its project's channel.
- **`not-read` means bdi read none of the projects that may hold the id.** Either their trackers failed, or bdi's config states none of their prefixes. The edge is not at fault. Read again next wake. If the line stays, raise the missing prefix with the human as an action, because the configuration bdi reads is theirs.
- **`held-by-several` means two projects share the id's prefix.** The fix is in the configuration bdi reads, not in the graph, so raise it with the human as an action.
