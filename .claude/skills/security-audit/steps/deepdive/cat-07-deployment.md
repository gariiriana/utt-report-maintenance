# Deep Dive #7 — Deployment Posture

**Category.** `deployment`.

**OWASP tags.**
- ASVS: V14 (Configuration), V10 (Malicious Code), V12 (Files &
  Resources).
- API Top 10: `API8:2023`.

**Baseline CWEs:** 276, 284, 732, 749, 829, 1035.

---

## Invariants

1. Dockerfiles drop root (`USER <nonroot>` near the end).
2. Base images are pinned to a specific tag (`image:1.2.3`) — no `:latest`.
3. `HEALTHCHECK` directive present.
4. No debug ports (`6060`, `9229`, `5005`) exposed in production images.
5. `.dockerignore` excludes `.git`, `.env*`, test fixtures.
6. Kubernetes: no `privileged: true`; no `hostNetwork: true`; no RBAC
   rules with `*` verb + `*` resource; pod securityContext drops capabilities.
7. Terraform: no `0.0.0.0/0` SG ingress on non-public services;
   S3/GCS/ABS buckets not public unless intentional; all storage
   encrypted-at-rest; IAM roles use least-privilege (no `*` actions).
8. GitHub Actions: no `pull_request_target` + checkout of PR head (RCE
   classic); actions pinned to SHA; `permissions:` block set; secrets
   not passed to fork runs.
9. NPM `postinstall` scripts reviewed for supply-chain exposure.

## Detection patterns

### Dockerfile

Cross-ref Phase 4 `hadolint.sarif` — most of these land there. Augment
with:

```
FROM .+:latest
USER\s+root                              (after midway)
EXPOSE\s+(6060|9229|5005|5858)
^RUN\s+.*(curl|wget).*\|\s*(sh|bash)    (pipe-to-shell install without verification)
```

For Dockerfiles missing `USER` entirely → **HIGH** / CWE-276.

### Kubernetes

Grep all `*.yaml` / `*.yml` under `profile.deployment.k8s.manifests` for:

```
privileged\s*:\s*true
hostNetwork\s*:\s*true
hostPID\s*:\s*true
allowPrivilegeEscalation\s*:\s*true
runAsUser\s*:\s*0
runAsNonRoot\s*:\s*false
automountServiceAccountToken\s*:\s*true   (if NOT actually needed)
```

RBAC wildcard:
```
verbs\s*:\s*\[\s*"\*"\s*\]
resources\s*:\s*\[\s*"\*"\s*\]
```

→ **HIGH** / CWE-732.

### Terraform

For each `*.tf` file:

- Security groups with `cidr_blocks = ["0.0.0.0/0"]` on non-public
  resources → **HIGH** / CWE-284.
- S3 buckets with `acl = "public-read"` or without `server_side_encryption_configuration` → **HIGH** / CWE-311.
- IAM with `Action = "*"` or `Resource = "*"` → **HIGH** / CWE-284.

Cross-ref Phase 4 `checkov.sarif` / `trivy config` output.

### GitHub Actions

For each `.github/workflows/*.yml`:

- `pull_request_target` + `actions/checkout@v* with: ref: ${{ github.event.pull_request.head.sha }}` → **CRITICAL** / CWE-829.
- `uses: some/action@main` or `@v1` (unpinned) → **MEDIUM** / CWE-829.
  Should be `@<sha>`.
- Missing `permissions:` block at workflow or job level → **MEDIUM** /
  CWE-1035 (over-permissive GITHUB_TOKEN).
- `secrets:` referenced inside a job that runs on `pull_request` from
  forks → **HIGH** / CWE-200.

Cross-ref zizmor output if installed.

### Dependency postinstall / preinstall

Grep `package.json` for `postinstall`/`preinstall` that execute
downloaded scripts. → **MEDIUM** / CWE-829. Suggest: pin SHA, verify
signature.

### .dockerignore hygiene

If Dockerfile exists but `.dockerignore` is absent or doesn't ignore
`.git` / `.env` / `node_modules` → **MEDIUM** / CWE-200 (risk of context
leak).

### AWS Lambda Function URL `AuthType = NONE`

A Lambda Function URL with no auth is a public, AWS-domain-trusted
(`*.lambda-url.*.on.aws`) HTTP endpoint reachable by anyone. Actively
abused as a C2 / malware relay (HazyBeacon campaign, Qualys 2026-06-02)
because the `*.on.aws` host inherits AWS-domain reputation. Detect across
all four IaC dialects.

SAM / CloudFormation (`*.yaml` / `*.yml` / `*.json` with `AWS::Lambda::Url`):
```
AWS::Lambda::Url
AuthType\s*:\s*(?:"|')?NONE
```
A `AWS::Lambda::Url` resource whose `AuthType` is `NONE` → **CRITICAL** /
CWE-306 / A07:2025. Cross-ref Phase 4 `checkov.sarif` rule `CKV_AWS_258`.

CDK (TS/Py construct):
```
FunctionUrlAuthType\.NONE
addFunctionUrl\(
```
`FunctionUrlAuthType.NONE` (or a synthesized template carrying
`AuthType: NONE`) → **CRITICAL** / CWE-306 / A07:2025.

Serverless Framework (`serverless.yml` — `url: true` enables a Function
URL; without an `authorizer:` it defaults to `NONE`):
```
^\s*url\s*:\s*true\s*$
```
A function with `url: true` and **no** sibling `authorizer:` / `cors`
auth block → **CRITICAL** / CWE-306 / A07:2025. If an `authorizer:` is
present nearby, downgrade (see FP notes).

Terraform / OpenTofu (`*.tf`):
```
authorization_type\s*=\s*"NONE"
```
`aws_lambda_function_url` with `authorization_type = "NONE"` → **CRITICAL**
/ CWE-306 / A07:2025. Also flag an over-broad invoke policy:
`aws_lambda_permission` with `principal = "*"` → **HIGH** / CWE-862 /
A01:2025.

*Static-only:* whether the URL is currently live / reachable from the
internet is **out of scope: flag location, defer to human**. Emit at the
config location regardless.

### Kyverno CEL SSRF + admission-webhook misconfig

Two related admission-control surfaces: the Kyverno CEL-SSRF class, and
generic admission-webhook hygiene.

**Kyverno CEL `http.*` SSRF (CVE-2026-4789 class).** Unrestricted CEL
`http.Get` / `http.Post` in Kyverno policies let a namespace-scoped user
reach internal endpoints (e.g. `169.254.169.254` IMDS) from the admission
controller. Verify the exact CVE/affected-version range on NVD
(reported as Kyverno `1.16.0`–`1.17.1`) before pinning a version claim —
do not assert the range from this file alone. Grep Kyverno policy YAML
(`kind:` of `ClusterPolicy` / `Policy` / `*ValidatingPolicy` /
`*DeletingPolicy`):
```
http\.(?:Get|Post)\(
```
`http.Get(` / `http.Post(` inside a Kyverno CEL expression → **HIGH**
(escalate to **CRITICAL** if the cluster's Kyverno chart version is in the
NVD-confirmed affected range) / CWE-918 / A01:2025. Confirming the
running chart version is **out of scope: flag location (the policy +
`Chart.yaml` / Helm values), defer to human** for live-version
confirmation.

**Generic admission-webhook weaknesses.** For each
`ValidatingWebhookConfiguration` / `MutatingWebhookConfiguration`
(`*webhookconfiguration*.{yaml,yml}` or any manifest with that `kind:`):
```
failurePolicy\s*:\s*Ignore
namespaceSelector\s*:\s*\{\s*\}
apiGroups\s*:\s*\[?\s*(?:"|')?\*
resources\s*:\s*\[?\s*(?:"|')?\*
operations\s*:\s*\[?\s*(?:"|')?\*
```
- `failurePolicy: Ignore` on a security-relevant webhook (lets requests
  through when the webhook is down) → **HIGH** / CWE-732 / A02:2025.
- Missing `namespaceSelector` (matches every namespace incl. `kube-system`)
  or an empty selector `{}` → **MEDIUM** / CWE-732 / A02:2025.
- Overly broad `rules` (`apiGroups` / `resources` / `operations` = `*`) →
  **MEDIUM** / CWE-732 / A02:2025.

### Native-sidecar securityContext (k8s 1.33 GA)

Native sidecars are `initContainers[]` entries with
`restartPolicy: Always` (GA in Kubernetes 1.33). They run the full pod
lifecycle, so they need the **same** securityContext scrutiny as
`spec.containers[]` — but greps that only walk `containers[]` silently
miss a privileged sidecar. First locate native sidecars:
```
restartPolicy\s*:\s*Always
```
A `restartPolicy: Always` appearing under `initContainers:` marks a native
sidecar — apply every escape-enabler check below to that block as well. A
native sidecar with **no** `securityContext` (inherits pod defaults; not
hardened) → **MEDIUM** / CWE-276 / A02:2025.

**Escape enablers (anywhere in a pod spec — `containers[]`,
`initContainers[]` native sidecars, or pod-level):**
```
privileged\s*:\s*true
host(?:PID|IPC|Network)\s*:\s*true
allowPrivilegeEscalation\s*:\s*true
-\s*SYS_ADMIN\b
type\s*:\s*Unconfined
path\s*:\s*/var/run/docker\.sock
/var/run/docker\.sock
```
- `privileged: true` (incl. on a sidecar) → **CRITICAL** / CWE-250 /
  A02:2025.
- `hostPID` / `hostIPC` / `hostNetwork: true` → **HIGH** / CWE-276 /
  A02:2025.
- `capabilities.add` containing `SYS_ADMIN` (matched via `- SYS_ADMIN`
  list item) → **HIGH** / CWE-250 / A02:2025.
- `seccompProfile.type: Unconfined` → **HIGH** / CWE-276 / A02:2025.
- `hostPath` mount of `/var/run/docker.sock` (Docker-socket escape) →
  **CRITICAL** / CWE-250 / A02:2025.

Cross-ref Phase 4 `kube-linter` / `trivy config` — but the
`initContainers` native-sidecar case is the net-new parse the scanners'
container-only walkers can miss.

### OIDC workload-identity trust breadth + IMDSv1

**OIDC trust-policy breadth.** A GitHub-Actions / cloud OIDC trust policy
keyed only on `aud` (no `sub` condition) or with a wildcard `sub`
(`repo:org/*`) can be assumed by repos / refs it was never meant for
(org-wide impersonation). In IAM trust JSON or
`aws_iam_role.assume_role_policy` HCL (`*.tf` / `*.json`):
```
token\.actions\.githubusercontent\.com:sub
repo:[^/\s"']+/\*
```
- A `...githubusercontent.com:sub` condition whose value contains `*`
  (esp. `repo:org/*`) → **CRITICAL** / CWE-287 / A07:2025.
- A trust policy that asserts `...githubusercontent.com:aud` but has **no**
  `...:sub` condition at all → **HIGH** / CWE-862 / A01:2025. (Detect by
  presence of the `aud` audience condition without any `sub` line in the
  same statement; flag for human confirmation.)

For GCP, `google_iam_workload_identity_pool_provider` with **no**
`attribute_condition` constraining `assertion.repository` → **HIGH** /
CWE-862 / A01:2025.

**IMDSv1 allowed (SSRF-to-credential enabler).** EC2 instances /
launch templates that allow IMDSv1 turn any in-instance SSRF into
credential theft. In `*.tf` (`aws_instance` / `aws_launch_template` /
`aws_launch_configuration`):
```
http_tokens\s*=\s*"optional"
```
`metadata_options { http_tokens = "optional" }` → **HIGH** / CWE-918 /
A01:2025. **Absence** is also a finding: a launch template / instance
with a `metadata_options` block that does **not** set
`http_tokens = "required"` defaults to IMDSv1-allowed — flag at **MEDIUM**
/ CWE-918. In CloudFormation `LaunchTemplate` `MetadataOptions`:
```
HttpTokens\s*:\s*(?:"|')?optional
```
`HttpTokens: optional` (or `MetadataOptions` present without
`HttpTokens: required`) → **HIGH** / CWE-918 / A01:2025. Cross-ref
Phase 4 `checkov` `CKV_AWS_79` / Trivy CFN `MetadataOptions` propagation.

*Static-only:* whether the OIDC role is *actually assumable* by an
attacker, and whether IMDS is *reachable at runtime*, are **out of scope:
flag location, defer to human**.

## False-positive notes

- **Intentionally-public endpoints** (health checks, public API docs)
  may have 0.0.0.0/0 ingress. Cross-ref `profile.trust_zones` — if the
  SG is attached to a resource in a `public` trust zone, it's fine.
- **Build jobs** may use `permissions: write-all` legitimately. Flag at
  LOW only if it's on the default workflow that runs on forked PRs.
- **Debug images** (Dockerfile.dev, Dockerfile.debug) may legitimately
  expose debug ports. Only flag if the image is tagged `prod` /
  `release` / referenced by a production compose / k8s manifest.
- **Lambda Function URL with an authorizer.** Serverless `url: true` with
  a sibling `authorizer:` (or `authType: AWS_IAM`) is authenticated —
  downgrade to INFO. Only `AuthType: NONE` / `authorization_type =
  "NONE"` / `url: true` with no authorizer is the finding.
- **Intentionally-public Function URLs** (a deliberately anonymous webhook
  receiver) exist. Flag at HIGH not CRITICAL if a comment / adjacent WAF
  or `aws_wafv2_web_acl_association` indicates intent; note the decision
  for human review rather than suppressing.
- **Kyverno `http.*` in a report-only / non-affected version** — if the
  policy is `validationFailureAction: Audit` and the chart is outside the
  NVD-confirmed affected range, downgrade to MEDIUM. Version confirmation
  is deferred to a human.
- **Webhook `failurePolicy: Ignore` on a non-security mutating webhook**
  (e.g. a defaulting/labelling webhook) is often intentional for
  availability — flag at LOW with a note rather than HIGH.
- **Native sidecars with a hardened `securityContext`** (drops caps,
  `runAsNonRoot: true`, no privileged) are fine — only the *missing* or
  *privileged* securityContext on a `restartPolicy: Always` initContainer
  is the finding.
- **`hostNetwork` / `hostPID` on CNI / monitoring / node-agent DaemonSets**
  (Calico, Cilium, node-exporter) is expected. Cross-ref the workload
  kind/name; flag at LOW for known infra agents.
- **OIDC wildcard `sub` scoped to a single trusted org with branch
  protection** is a calculated risk some teams accept. Flag and defer the
  accept/reject decision to a human rather than auto-suppressing.
- **IMDSv2 already required** elsewhere via account-level default
  (`aws_ec2_instance_metadata_defaults`) — the per-resource `optional`
  may be overridden. This is **out of scope: flag location, defer to
  human** for account-default confirmation.

## Output

`phase-05-deployment-<partition>.jsonl`.
