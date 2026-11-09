# Christianity's Problems: Evidence Deck

Static site, no server needed. Open `index.html` in a browser.

## Files
- `index.html`: the site. Reads content from `cards.js` and `translations.js`.
- `cards.js`: the English content. Edit cards here.
- `translations.json`: translation store (source of truth, includes change hashes).
- `translations.js`: generated from `translations.json`. Never edit by hand.
- `translate.js`: Node script that calls Gemini to translate new or changed cards.

## Add or update a language
Never paste your API key into a file. Pass it through the environment:

```bash
export GEMINI_API_KEY="your-new-key"
node translate.js de ja ar        # only missing or changed cards are translated
node translate.js de --force      # retranslate everything for German
node translate.js --list          # show what is current or stale
node translate.js --rebuild       # rebuild translations.js without any API call
```

Optional: `GEMINI_MODEL=<model id>` to override the default (`gemini-3.8-flash`). A 404 means the model name is wrong or not available to your key.

The script saves after every card, so a crash or rate limit loses nothing. It checks that the HTML tags and digits in each translated body match the English, and retries if they do not.

Languages in the menu are built from whatever is in `translations.js`. Arabic, Hebrew, Persian, Urdu and a few others switch to right-to-left automatically.

## Notes

- `translations.json` and `translations.js` are currently empty to prevent data loss while the English text is being finalized. Run the script to generate them.
- If you ever put these files in git, add `.env` to `.gitignore` and keep keys out of the repo.

