# V4 catalog and publication contract (JSON version 2)

Build with `tools/build-site.py`. The catalog at `.build/site/catalog.json` is
generated, ignored, and never committed. The site and catalog are one artifact
with `build-provenance.json` containing the source SHA, dirty-preview flag, and
SHA-256 of each bundled file. No timestamps or random identifiers enter JSON.

## Selection

`models` retains model metadata, presentation, source links, and `entry_ids`.
Models without recipes are valid. `entries` expands every actual v4 platform,
including blocked entries and reasons. IDs are JSON-encoded four-tuples:
`[model_id, recipe_id, stack, version]`. Duplicate identities fail. Filter
buckets are derived from actual entries; no cartesian product or fictional
hardware/version options are generated. Multiple matches require a recipe
choice rather than overwriting one view.

Each entry retains maturity, scope, workload, optimization intent, deployment
mode, full hardware profile/path/revision, accelerator grouping key, serving
allocation, effective serving overrides, constrained common or leader/worker arguments,
engine resolution, optional notes, and source references. Accelerator grouping
does not erase host/network/profile distinctions. Inventory is per host;
declared GPU allocation is TP × PP × DP per replica, not an inferred cluster
total. A pinned manifest remains authoritative when metadata is incomplete.

Final generated/pinned/overlaid artifacts contain exact UTF-8 source content,
SHA-256, actual Kubernetes kinds, container settings and storage bindings.
Copy/download preserves that content, including placeholders and line endings.
Standalone commands are suppressed: equivalence to these artifacts has not
been established. Missing or malformed required files fail the build.
Legacy config-note pointers remain explicitly unverified rather than being
treated as final deployment truth. Contributor prose is rendered as text.

## Evidence and badges

Only recipe-referenced `run.yaml` → `result.json` records are evidence. Run,
result, recipe, scope, profile path and accelerator identities must match.
Historical profile revisions remain attributed to their original run; they do
not inherit a badge against a corrected current profile. Raw-output provenance
requires a checksum, verified locally when the output is committed. Original
run/result content and metadata remain attached; all normalized
metrics, units, statistics, zero/null values and unfamiliar fields are retained.
No measurements are parsed from display prose or old catalog rows.

Maturity is independent of engine compatibility. A badge requires validated or
production maturity, a resolved selected engine, and applicable evidence with:

- a tested image digest, engine version and original platform/version;
- an explicit `environment.catalog_compatibility` snapshot matching the selected
  entry's `compatibility_signature` exactly;
- a concrete model revision (`--revision`), committed workload inputs, complete
  hardware/profile/revision identity, role arguments, serving configuration,
  parallelism, final container execution settings and storage bindings.

The signature excludes only image/engine identity so an independently proven
equivalent configuration can retain original evidence attribution across stacks
or engine versions. It does not infer equivalence from `accelerator_key`, an
image tag, maturity alone, or a workload label. Missing proof means no badge.
Same engine produces `Validated`; a strictly newer comparable release produces
`Validated on earlier vLLM — vX.Y.Z`. Opaque/incomparable versions cannot inherit.
The UI always qualifies that the selected platform was not necessarily directly
benchmarked. Existing runs are not backfilled with invented matching snapshots.

The current six entries have **no published benchmark evidence or badges**.
The contributor's two original configurations are retained as contributed,
pinned v4 recipes. Original v3 recipes/manifests and the unsupported run/result
remain byte-preserved under each recipe's `raw-manifest/`. They are intake
provenance, not current measurements. Only the operational Docker Hub image
references were fully qualified; runtime configuration remains unchanged.

## Local preview

```sh
python3 -m venv .build/venv
.build/venv/bin/python -m pip install -r tools/requirements.txt -r tools/requirements-dev.txt
PLAYWRIGHT_BROWSERS_PATH=.build/ms-playwright .build/venv/bin/python -m playwright install chromium
.build/venv/bin/python tools/build-site.py
PLAYWRIGHT_BROWSERS_PATH=.build/ms-playwright .build/venv/bin/python -m pytest tests -q
.build/venv/bin/python -m http.server 8000 --directory .build/site
```

Kustomize v5.6.0 must be on PATH for overlay recipes. Preview over HTTP, not
`file://`. Dirty local builds are explicitly labeled and do not invent immutable
source permalinks. CI passes `--require-clean --source-sha "$GITHUB_SHA"`.

## CI and deployment

Fork PR jobs have a read-only token, no secrets/OIDC/Pages permissions, and
checkout credentials disabled. They validate sources, check full manifest
drift, build/test, and upload a downloadable preview (14-day retention). There
is no `pull_request_target` or automatic fork deployment.

Main builds reconstruct from the exact event SHA and upload their own Pages
artifact only after tests. A separate main-only deploy job has Pages/OIDC
permissions, uses the protected `github-pages` environment, and refuses stale
main SHAs. PR cancellation is separate from production concurrency. A failed
build does not upload a production artifact or replace the existing site.

Operator setup: enable GitHub Pages deployment from Actions and protect the
`github-pages` environment as appropriate. Roll back by reverting the offending
change through a reviewed PR and rebuilding main, or dispatching the main-only
workflow at the restored main revision. Never promote a PR preview artifact.
No publication is performed by local build/test commands.
