# AI Spend Doctor

**Check your Claude, OpenAI and OpenRouter API costs without uploading your CSV.** Open your API usage or cost CSV and see spend spikes and cost patterns worth investigating. The file is read on your device and never leaves it: the page's Content Security Policy (`connect-src 'none'`) blocks outgoing connections, and the check works offline after the page has loaded. Free, no signup, no API key.

**[Open the free checkup](https://aispenddoctor.com/)** · **[Try the synthetic demo](https://aispenddoctor.com/#demo)** · [CSV formats and method](https://aispenddoctor.com/csv-formats/)

![AI Spend Doctor — live website](https://github.com/user-attachments/assets/9c88808b-48df-4784-8b88-8385245698d9)

## Start in three steps

1. Export a supported API usage or cost CSV from Claude, OpenAI or OpenRouter.
2. Open it in [AI Spend Doctor](https://aispenddoctor.com/). The file is processed locally.
3. Review findings and the checks marked complete, partial or unavailable.

No file handy? The [demo](https://aispenddoctor.com/#demo) uses synthetic data and needs no account.

[Claude export guide](https://aispenddoctor.com/how-to-export-claude-api-usage-csv/) · [OpenAI export guide](https://aispenddoctor.com/how-to-export-openai-api-usage-csv/) · [OpenRouter export guide](https://aispenddoctor.com/how-to-export-openrouter-activity-csv/)

## What it shows

- **Daily spikes:** days when spend was more than 3 times a typical day in the file. An observation with a next step, not a diagnosis.
- **Cache share:** how much input was read from the prompt cache, when the file has cache data.
- **Batch share:** how much spend used batch or flex prices, when the file has a batch or service tier column.
- **Top-tier share:** how much went to the most expensive models.
- **Model price scenarios:** what an older Claude model's spend would be at the comparison model's list prices, including about 30% more tokens on Claude's newer tokenizer. Estimates, not confirmed savings.

Every check is marked Checked, Partly checked or Not available. Missing data is never shown as 0%. Reported costs (from your file) and estimated costs (from tokens and list prices) are kept apart, and unknown models are never given a made-up price.

Supported columns, the method and the price list with sources: https://aispenddoctor.com/csv-formats/

Tested on synthetic files that follow the official Anthropic and OpenAI usage and cost API formats. Real dashboard exports have not been verified yet; if yours is misread, please send the header row only to hello@aispenddoctor.com.

Model-price scenarios are estimates, not guaranteed savings. Prices were last checked on 27 September 2026. Daily Watch is planned and is not currently available.

## Privacy

The page reads your file with JavaScript on your own machine. It sends nothing about the file anywhere, stores nothing and has no analytics. The source is available for inspection: `engine.js` reads the file and does the calculations, `app.js` draws the page.

© 2026 Valeriy Danilov. All rights reserved. See LICENSE.
