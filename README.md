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

The page reads your file with JavaScript on your own machine. It sends nothing about the file anywhere, stores nothing and has no analytics. The source is available for inspection: `engine.js` reads the file and does the calculations, `app.js` draws the page.

## Tests

Run `npm test` (Node.js 22 or newer, no dependencies). The same tests run on GitHub for every change.

© 2026 Valeriy Danilov. All rights reserved. See LICENSE.
