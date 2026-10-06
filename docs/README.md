# docs

Historical notes. None of this is load-bearing — the working documentation is
the repository `README.md`, and the demo pipeline is `tools/build-demo.sh`.

| File | What it is |
|---|---|
| `01-original-handoff-phases-1-5.md` | The handoff that started this site: design direction, stages 1–5, acceptance criteria. Useful for why the page looks and reads the way it does. |
| `02-flutter-demo-handoff-superseded.md` | Notes written while figuring out how to get the real app into the page. **Superseded** — the answer it reached for is now implemented in `tools/build-demo.sh` and the two workflows. Kept because it records the measurements (raw vs gzipped, engine variant sizes, what Pages does with `.wasm`) that justify the current build. It also contains at least one conclusion that later turned out to be wrong; see the top of that file. |
| `legacy-README-early-draft.md` | An early README. Describes a build step that no longer exists. Superseded by the repository README. |

If you are here looking for how to build, deploy, or regenerate the demo, you
want the repository root, not these files.
