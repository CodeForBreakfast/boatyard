# A good bead

This is the bar every bead in an effort meets, together with the graph that wires them and the top bead that heads them. `muster` builds an effort to it, and the steward drives an effort built to it.

## Each bead

- **A bead is an outcome that someone outside the change can observe, wired to the outcomes it needs.**
- **One bead is one worker is one context.** A single worker could finish it without compacting.
- **A bead is briefable.** It has a clear deliverable, a definition of done and stated edges, so the steward can write a complete brief from it when it starts the seat.
- **A definition of done stated only as removals is incomplete.** Deleting the thing meets an all-negative outcome most completely, so a deletion that orphans behaviour passes every clause. On a cleanup or refactor bead, name what must still work after the removals: the behaviour that keeps running, and what still reaches it.

## The graph

- **Every bead in the effort is reachable from the top bead through dependency edges.** A bead that is only a child of something in the effort is outside it. Where an outcome needs a bead's work, the outcome depends on that bead.
- **The graph ends where the effort's outcome is observed, not where the code merges.** Every step between the merge and the evidence is a bead in the effort: each release, each deployment to each host, and any other project's deploy that the evidence relies on.
- **A release belongs to the product, not to the effort.** One release may carry work from several efforts, so never invent a release for one effort, and name no tag. Find the product's open release bead and make it depend on the work it ships, or have one filed as the host's release convention says. Where the release runs through a formula that cannot be poured yet, a plain bead stands in for it.
- **A bead that is true only once something is released or deployed depends on that release or deployment.** A deployment depends on the release it installs, and the release depends on the work it ships. The work never depends on either, and neither is the work's parent. bd blocks a parent's children while the parent is blocked, so either shape deadlocks.
- **An epic is an "and" over the outcomes it depends on.** It leaves out any outcome that a sibling already reaches through its own dependencies. Most efforts need no epic.
- **Wire true blockers only.** Add a dependency only where B cannot start until A's work exists, and prove each one rather than assuming a sequence. An edge that only orders the work is false. Where a pull request cap or a limit settled on the top bead holds work back, the steward chooses what goes next at the time, and an edge would take that choice away. No backward edges and no cycles.
- **Two beads that would collide in one file are not a dependency.** A collision often means the code is badly shaped. Code that is open for extension lets new work sit beside what is there, while several beads that all have to change one place is churn. Consider whether a better structure would let the beads run apart. Where it would, that restructure is work the colliding beads really depend on. Where it would not, leave them parallel.
- **Work built on another bead's unmerged code depends on that bead.** In a repo that takes pull requests, the edge is what stops the second worker branching from an unmerged pull request and building a stack nobody can review. The steward settles each repo's delivery mode itself, so the top bead does not carry it.

## The top bead

The top bead is the effort's cold-restart record.

- **The top bead describes the effort, and nothing else.** Its body holds the outcome, the evidence that shows it is true, why the effort takes this shape, and what has been settled and must not be reopened. The roster, the parentage, the blocking edges, the critical path and each bead's status all live in the graph, and the body restates none of them. A foreign strand's id is the target of its edge, and the body does not repeat it.
- **Every piece of work the top bead's description names is a bead in the graph.** Anything the description says someone has to do, such as a switch, a deploy, a release, a check or a post, is carried by a bead the top bead reaches. A steward staffs the graph, not the prose, so work named only in prose is never done. Where no bead carries it, file one in the project that owns the work and wire it in. The one exception is seeing the evidence that the top bead's own outcome is true, which is part of closing the top bead.
- **The top bead never says how the effort is staffed or delivered.** Staffing is the steward's call at run time. How a repo takes work is in that repo's own instructions.
- **The top bead carries the effort's slug as `effort_slug` in its metadata.** Every commy topic the effort uses is named from it: `#<project>/<effort>`, its `-decisions` topic and each `-<bead>` working topic. A replacement steward has no other way to learn the name, and one that invents a fresh slug posts into topics no worker listens on, and adds a second index line for an effort that already has one.
- **The test:** a fresh steward holding only the top bead and the graph can rebuild the whole effort, in this project and across others. If it cannot, find the missing fact, and check first that it is not a field left unset.
