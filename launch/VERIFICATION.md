# Preview validation — 2026-09-13

- 70 Node unit/service/launcher/package tests passed.
- Browser acceptance passed: original canvas behavior, current work, independent journeys, CI records, detail-panel resizing, and automatic source evolution.
- Automatic evolution exercised additions, removal of a selected/focused task, regrouping, dependency replacement and a new journey without clicking Refresh; malformed cycles retained an explicitly stale snapshot.
- A clean allowlisted export installed using `npm ci --ignore-scripts` with a separate cache. Its actual fictional demo rendered in Chrome; its initialized empty project also rendered, with a preexisting business file unchanged.
- The companion skill passed frontmatter validation. Its written scenarios were reviewed; no claim of automatic multi-agent evaluation is made.
- Public visuals were generated only from a temporary copy of the fictional Wayfarer demo, not a real project. Four portrait social cards and an 18.76-second silent MP4 are included; the longer storyboard is a script for a narrated edit.
- Public export excludes original Git history, local configuration, runtime state, private screenshots and internal planning/verification documents. Export validates an explicit file inventory and refuses symlinks and nested repository destinations.

Verified environment: macOS, Node.js 25 (declared minimum 22), installed Chrome. Node 22 itself and other operating systems still need separate compatibility runs. Viewer startup needs write access to its tool directory for local runtime state. No npm registry publication or hosted demo is claimed.

## README images

`node scripts/capture-readme.mjs` captures an English presentation of the fictional demo. `--zh-CN` captures its Chinese counterpart. Both use a temporary demo copy and the real graph renderer. The English capture translates browser responses for this image only; it does not add an application language setting. It checks visible DOM text and canvas labels for untranslated Chinese. Status, dependency and progress data are unchanged.
