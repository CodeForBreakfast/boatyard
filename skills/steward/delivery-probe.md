# Probing a repo that says nothing about delivery

Read this only where neither the repo's `CLAUDE.md` nor the `CLAUDE.local.md` beside it says how work lands there. Probe **both** endpoints:

```bash
DEFAULT=$(gh api "repos/$OWNER/$REPO" --jq .default_branch)
gh api "repos/$OWNER/$REPO/rules/branches/$DEFAULT" --jq '[.[].type] | index("pull_request")'
gh api "repos/$OWNER/$REPO/branches/$DEFAULT" --jq .protected
```

- **A `pull_request` rule means pull requests.** This answer is definitive.
- **No such rule, but `.protected` is `true`, also means pull requests.** Something restricts the branch that the rules endpoint cannot see.
- **Neither, or the calls fail, or the remote is not GitHub, means direct delivery.** A worker commits and pushes, its bead closes when the work lands, and you start the next one. Most efforts are like this, so don't add ceremony to them.

The rules endpoint returns only rules from rulesets, so a branch under classic protection shows no rules. `.protected` reflects classic protection only, so a branch governed by a ruleset can report `false` and still refuse every push. Trusting either one alone misreads real repos in both directions.

Where neither endpoint answers, guess direct. A wrong direct guess is loud and cheap, because the push is rejected and the worker reports it. A wrong pull-request guess throttles an effort silently.

Either way, get a policy written into that repo, so the next steward reads it rather than probing.
