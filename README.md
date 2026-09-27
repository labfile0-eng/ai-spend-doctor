# AI Spend Doctor

**Check your Claude and OpenAI API costs.** Open your API usage or cost CSV and see spend spikes and cost patterns worth investigating. Free, no signup, no API key. The file stays on your device.

**Try it:** https://aispenddoctor.com/ · **Demo:** https://aispenddoctor.com/#demo

## What it shows

- **Daily spikes:** days when spend was more than 3 times a typical day in the file. An observation with a next step, not a diagnosis.
- **Cache share:** how much input was read from the prompt cache, when the file has cache data.
- **Batch share:** how much spend used batch or flex prices, when the file has a batch or service tier column.
- **Top-tier share:** how much went to the most expensive models.
- **Model price scenarios:** what an older Claude model's spend would be at the current model's list prices, including about 30% more tokens on Claude's newer tokenizer. Estimates, not confirmed savings.

Every check is marked Checked, Partly checked or Not available. Missing data is never shown as 0%. Reported costs (from your file) and estimated costs (from tokens and list prices) are kept apart, and unknown models are never given a made-up price.

Supported columns, the method and the price list with sources: https://aispenddoctor.com/csv-formats/

Tested on synthetic files that follow the official Anthropic and OpenAI usage and cost API formats. Real dashboard exports have not been verified yet; if yours is misread, please send the header row only to hello@aispenddoctor.com.

## Privacy

The page reads your file with JavaScript on your own machine. It sends nothing about the file anywhere, stores nothing and has no analytics. Inspect `engine.js` for parsing and calculations, `app.js` for the browser interface, and `index.html` for the page.

## Development and verification

The site is static and has no production dependencies or build step. Use Node.js 22 or newer to run the regression suite:

```sh
npm test
```

No dependency installation is required. GitHub Actions runs the same suite on pull requests and on `main`.

Preview the complete site over HTTP (including the two JavaScript files):

```sh
python3 -m http.server 8766 --bind 127.0.0.1
```

Open `http://127.0.0.1:8766/#demo`. The checks are based on synthetic fixtures; real dashboard-export compatibility still needs validation. See `docs/browser-checks.md` for manual browser checks and `launch/README.md` for the first-user pilot.

Malformed numeric fields are never silently replaced by zero. Valid reported costs survive invalid token fields, but those token fields do not contribute to token-derived checks. Cost-only cache inference requires both input and cached-input line items for the same model, day and tier and is explicitly labelled as an estimate. Partial data stays partial even when coverage exceeds 95%.

© 2026 Valeriy Danilov. All rights reserved. See LICENSE.
