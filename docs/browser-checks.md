# Browser verification

Serve the repository over HTTP with the README command. Use only synthetic CSVs. The automated suite tests the same `engine.js` loaded by the page.

- Open `/#demo`: synthetic-data badge, dollar total, spend spike and model scenario appear.
- Open Copy the result: the preview contains the demo label and coverage, with no confirmed-overpayment claim.
- Follow Check my own CSV and Check a file now: the chooser is visible and keyboard focused.
- Load `tests/fixtures/partial.csv`: only $100 is included; invalid and unpriced rows are disclosed. Copy preview keeps the incomplete-total warning.
- Load `tests/fixtures/input-only.csv`: Cache share and Batch share are unavailable, not 0%.
- Load `tests/fixtures/invalid.csv`: a readable error appears; no invented estimate.
- Load the same file twice; use browser Back and Forward; switch dollars/cents for a generic amount column.
- Use a 375px viewport: no horizontal overflow; inspect the expanded coverage table and copy preview. Restore the normal viewport afterward.
- Check developer logs for errors and static resource failures. Verify that file contents are not sent over the network. The code has no telemetry, storage or file-upload endpoint.

## Scope

This checklist does not establish compatibility with unobserved provider dashboards. Actual anonymized export headers and example rows are still needed to verify those formats. Daily Watch is not present in this repository and remains Coming soon.
