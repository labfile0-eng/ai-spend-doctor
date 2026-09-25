# AI Spend Doctor

**Is your AI bill healthy?** Drop the usage export from your Claude or OpenAI dashboard and find out in 30 seconds.

- Runs entirely in your browser
- Nothing leaves your computer
- No signup

**Try it:** https://labfile0-eng.github.io/ai-spend-doctor/

## What it checks

- Older model versions that cost more than their current successor of the same tier
- Days when spend jumped far above a normal day
- How much of your input was paid at full price instead of cached
- How much of your spend used batch pricing
- How much of your spend went to top-tier models

Confirmed problems come straight from your file and official list prices. Problems to check show how much money a pattern touches, not a promise of savings.

## Where to get your file

- **Claude:** platform.claude.com, open Cost, pick last month, click export
- **OpenAI:** platform.openai.com/usage, pick last month, click Export, choose cost data

## Privacy

The page is a single HTML file. It reads your file with JavaScript on your own machine and makes no network requests with your data. You can read every line in `index.html`.

© 2026 Valeriy Danilov. All rights reserved. See LICENSE.
