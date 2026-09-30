# Capability lexicon — the vocabulary that makes severity computable

**Why this file exists.** A 2026-03-15 audit filed this, verbatim, in a
CONFIRMED finding's own description:

> "…build-output bypasses that if the deck UUID is known. **Combined with H1**,
> an attacker can identify published decks and access output directly."

`H1` was a **HIGH in the same report**, and it supplied exactly the capability
(`knows:any_deck_id`) that this finding's mitigation ("if the UUID is known")
assumed nobody had. The finding was filed **MEDIUM**. It went unremediated for
96 days, was downgraded to LOW at the next baseline, and the sibling endpoint was
affirmatively described as "well-defended (INFO)".

Chain **detection** was not the failure — the chain was written down in prose.
Chain **arithmetic** was. Nothing in the methodology gave that sentence power
over the rating.

This lexicon is that power. Findings declare what an attacker must **already
hold** (`preconditions`) and what the finding **grants** (`postconditions`).
`scripts/compose-attack-paths.py` composes them into attack paths from attacker
personas and recomputes severity over the path. Severity becomes a **computed**
function; `severity_asserted` is retained only as the analyst's opinion.

If two findings tag the same capability with different strings, the chain
silently breaks. Hence: one vocabulary, written down here.

---

## 1. Grammar

```
<verb>:<scope>_<object>
```

- **verb** — what the attacker can newly do. Closed set (§2).
- **scope** — whose data. Closed set (§3). Omit only when scope is meaningless
  (`escalates:admin`).
- **object** — a `snake_case` noun. Prefer a canonical `profile.data_model`
  entity id, lowercased (`Deck` → `deck`), optionally suffixed with the facet
  (`_id`, `_content`, `_metadata`, `_pii`, `_token`).

Examples:

| Capability | Meaning |
|---|---|
| `knows:any_deck_id` | The attacker can enumerate identifiers of decks they do not own. |
| `reads:any_deck_content` | The attacker can read the body of any deck. |
| `reads:own_invoice_pdf` | The attacker can read their own invoices (usually a *precondition*, not a finding). |
| `writes:any_user_role` | The attacker can modify any user's role. |
| `reads:cross_tenant_file` | The attacker can read a file belonging to another tenant. |
| `escalates:admin` | The attacker gains an administrative principal. |
| `bypasses:rate_limit` | The attacker is no longer throttled. |
| `impersonates:any_user` | The attacker acts as an arbitrary user. |
| `denies:any_attribution_processing` | The attacker stops a process from completing for principals other than themselves. |
| `corrupts:any_ledger_record` | The attacker makes a record other principals rely on silently wrong. |

## 2. Verbs (closed set)

`knows` · `reads` · `writes` · `deletes` · `executes` · `escalates` ·
`impersonates` · `bypasses` · `authenticates` · `denies` · `corrupts`

`knows` is the enumeration/discovery verb and is the single most under-tagged
capability in real audits — it is exactly what `H1` granted and exactly what
`M6` needed. **A finding that leaks identifiers grants `knows:`; tag it.**

`denies` and `corrupts` (v2.6) are the **availability** and **integrity**
verbs, and they exist because the first nine are all confidentiality verbs.
Every one of them describes the attacker learning or changing something *they*
can see. A calibrated run missed a HIGH in which an uncapped provisioning call
lets a developer mint over 500 empty instances that displace every real one
from a downstream fixed-size 500-row scan — an estate-wide **silent
attribution stop**. Nothing is disclosed, nothing errors, and with no verb for
it the chain composed to nothing and was never rated. See
[`../steps/deepdive/lens-availability-integrity.md`](../steps/deepdive/lens-availability-integrity.md).

Discriminator, because they are easy to confuse:

- **`denies:`** — the operation **stops**. Work is not done; rows are not
  processed; the request never completes for the victim.
- **`corrupts:`** — the operation **completes with the wrong answer**. A
  record downstream systems trust is silently incomplete. This is worse than
  `denies:` in almost every case: a stopped process gets noticed, a wrong
  number gets used.

Both take the normal `<scope>_<object>` tail. Prefer an object naming the
*process or record damaged* (`_processing`, `_record`, `_ledger`,
`_attribution`), not the row the attacker created — the row is the
`writes:` postcondition of the *other* half of the chain.

Synonyms are normalised by `compose-attack-paths.py` (`read`→`reads`,
`list`/`enumerate`/`discover`→`knows`, `modify`→`writes`, `rce`→`executes`,
`privesc`→`escalates`, …) but write the canonical form. `denies` and
`corrupts` have **no synonym entries yet** — `deny`, `starve`, `exhaust`,
`truncate` and `corrupt` will not normalise, so writing the canonical form is
not a style preference here, it is the difference between a chain and an
orphan.

## 3. Scopes (closed set)

`any` · `own` · `other` · `cross_tenant` · `self`

**Containment rule (implemented, not aspirational):** a postcondition with scope
`any` satisfies a precondition for the same verb+object at *any* scope —
`reads:any_deck_content` satisfies `reads:own_deck_content`. No other implication
is assumed.

## 4. Personas and crown jewels

`compose-attack-paths.py` starts a path from each **persona** — an attacker's
starting capability set — and asks what is reachable.

Phase 0 §0.14 derives these for the project and writes them into
`phase-00-profile.json` under `capability_lexicon`:

```jsonc
{
  "capability_lexicon": {
    "personas": {
      "anonymous":            [],
      "external_link_holder": ["external:link_holder"],   // any share/2FA/capability-URL mechanism (§0.11d)
      "lowest_tier_user":     ["authenticated", "role:reader"],
      "authenticated_user":   ["authenticated"]
    },
    "unprivileged": ["anonymous", "external_link_holder", "lowest_tier_user"],
    "crown_jewels": ["reads:any_user_pii", "reads:any_deck_content", "escalates:admin"]
  }
}
```

**Personas.** Always include `anonymous`. Add one persona per externally-obtainable
credential class: share-link holders, trial/guest accounts, and — critically —
**the lowest tier an outsider can self-provision**. If first SSO login
auto-provisions a role, that role is `lowest_tier_user` and it is *unprivileged*,
regardless of how the org describes it internally.

**Crown jewels.** Derive by rule, not taste:
- `reads:any_<e>_content` and `writes:any_<e>` for every `data_model` entity with
  non-empty `owner_cols` **or** `pii_cols`, excluding `public_resources`.
- `reads:any_user_pii` whenever `profile.pii.detected`.
- `reads:cross_tenant_<x>` whenever a tenant/org column exists.
- `escalates:admin` always.
- **`corrupts:any_<e>_record` for every entity that is a system of record for a
  process outside its own service** — billing, attribution, reconciliation,
  audit, compliance export, usage metering. The test is not "is this data
  sensitive" but "does something outside this codebase act on it as if it were
  true". Every crown jewel above is a confidentiality jewel; a report whose
  jewel list has no integrity entry cannot rate an integrity chain above the
  severity its individual legs were asserted at, which is precisely how the
  silent-attribution-stop HIGH went unrated.

**R3 is the rule that does the work:** any path from an *unprivileged* persona
that reaches a crown jewel is **CRITICAL**, regardless of how its parts were
rated individually.

## 5. What each finding must declare

Findings in the access-control categories (`auth`, `idor`, `token_scope`,
`collection_scope`) **must** carry both fields; `postconditions` must be
non-empty (a finding that grants nothing is not a finding). Other categories
should carry them whenever the finding is chainable.

```jsonc
{
  "preconditions":  ["authenticated"],            // [] means anonymous-reachable
  "postconditions": ["knows:any_deck_id", "reads:any_deck_metadata"]
}
```

Rules of thumb:

- **`preconditions` = the mitigation you were about to write in prose.** If you
  catch yourself writing "only exploitable if the attacker knows the UUID",
  that is `preconditions: ["knows:any_<entity>_id"]`. Write it in the field, not
  the sentence — R1 then checks whether another finding *supplies* it, and if so
  the mitigation is **undischarged** and cannot lower severity.
- **`postconditions` = what the attacker walks away with**, not what the code
  does wrong. An unscoped list endpoint grants `knows:any_<e>_id` **and**
  `reads:any_<e>_metadata` — two capabilities, both worth tagging, because the
  first is what chains.
- **Empty `preconditions` is a strong claim** — it means anonymous. Use
  `["authenticated"]` when a login is genuinely required.

## 6. Orphan capabilities are reported, not swallowed

If a `precondition` matches no `postcondition` and no persona, and if a
`postcondition` feeds nothing, `compose-attack-paths.py` prints it under
**ORPHAN CAPABILITIES**. That is the drift alarm: it means either the vocabulary
slipped, or a real prerequisite is undocumented. Fix the tag or add the finding —
do not ignore the list.

## 7. Honest scope

This makes chaining *checkable*; it does not make it *complete*. The composer
can only compose what was tagged, and a capability nobody wrote down joins
nothing. Its value is that the failure is now **loud** (orphan list, R2 prose
regex catching untagged chains named in text) rather than silent — and that a
tagged chain can no longer be out-voted by an analyst's instinct.
