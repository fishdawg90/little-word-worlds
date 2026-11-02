# Little Word Worlds

A bilingual picture game for little hands, using the original 52 animal illustrations, English Sage recordings, Italian Fable recordings and six Brava variations. The existing multi-finger touch controls, four/six-card layouts, listening gate, five-second repeat and question rotation are shared across packs.

Play: https://fishdawg90.github.io/little-word-worlds/

Animals: https://fishdawg90.github.io/little-word-worlds/game.html?pack=animals

## Import packs directly into the game

Open the game homepage and choose **Import a pack**, then select a finished `.pack.json` exported by Pack Studio. The file and embedded media are validated and saved in IndexedDB; a new card appears in the chooser. No OpenAI key or generation calls are needed to import or play. Duplicate IDs and existing vocabulary/aliases are rejected. Pack content, media and whitelisted authoring settings are stored; API keys and unknown credential fields are excluded.

Imported packs stay in that browser on that device and are not uploaded to GitHub. To play on another device, import the file there too. A `game.html?local=PACK-ID` link only works after that pack has been imported into the receiving browser. Keep the original pack file because clearing browser data removes saved packs. To make a pack available to everyone, use the repository import workflow below and publish it.

## Use Pack Studio online

Open https://fishdawg90.github.io/little-word-worlds-studio/ from a modern desktop, tablet or phone browser. Its source is in the separate public repository https://github.com/fishdawg90/little-word-worlds-studio. Enter your own API key for that tab; it is sent directly to OpenAI and never stored in GitHub, drafts or exports. Drafts do not sync between devices: save a draft file and reopen it on the other device.

## Run on your computer

Install Node.js 22 or newer. Double-click `studio/Start-Pack-Studio.cmd` on Windows. It installs the small `ws` dependency on first launch, starts a loopback-only helper and opens the HTML interface at http://127.0.0.1:8777. Keep the helper window open. If the browser opens before the helper is ready, reload the page.

On macOS/Linux, run `npm install` and `npm run studio`, then visit the address above. The game is at http://127.0.0.1:8777/index.html.

Opening the studio HTML directly shows launcher instructions: API operations use the local helper to avoid browser file-origin restrictions. No hosted server is needed for the game or authoring tool.

## Create a pack

1. Enter an OpenAI project API key in Pack Studio (or set `OPENAI_API_KEY` before starting the helper). It stays in memory, is sent only to OpenAI through the loopback helper and is excluded from every saved draft and export.
2. Enter a topic, 4–52 items, a new pack ID and bilingual titles. Suggest the vocabulary, then edit names, full questions and aliases. A language model proposes the list; human review of translations, image recognition and pronunciation is still useful.
3. Edit the default gouache/watercolour image prompt if desired. `{item}` is replaced by the English word. Listen to English/Italian voice previews and choose voices separately. Previews and all generation calls use your API balance.
4. Generate missing media. Each item gets one WebP picture and two audio files. Generation is sequential and pauses on errors. Finished media survives in the browser draft; you can also save a draft JSON to disk and reopen it later. A stopped request can still finish and be billed. No automatic retry repeats a charge.
5. Keep the phone unlocked and the studio visible. Screen-awake mode is enabled by default where supported; manually locking the phone can still suspend generation. New requests wait until the page is visible again. Returning after a reload recovers your saved draft, but you must re-enter the API key and explicitly resume missing assets. Failed API requests are not automatically repeated.
6. Preview the generated assets and transcripts. Clear an item's media to regenerate it. Changing an item's fields clears its media; changing global settings applies to subsequent requests. Each asset records its actual generation settings.
7. ZIP creation and an automatic download attempt are enabled by default after every asset completes. If blocked by the browser, tap **Download finished ZIP**. Attach the ZIP to Codex to publish it. Plain JSON export is also available for the game importer. Exports contain all media and no API key.

The studio refreshes the deployed catalogue before suggesting, generating or exporting. If the live catalogue is unavailable it labels the bundled snapshot and allows loading a newer `packs/catalog.json`. Exact normalized names, IDs and stored aliases are rejected across both languages; model instructions also exclude synonyms. This is not a semantic guarantee against every possible synonym. The importer performs the same checks against the repository's current catalogue before writing anything, so a stale authoring snapshot cannot overwrite or duplicate a known entry.

Speech defaults to `gpt-realtime-2.1-mini`, with 24 kHz WAV output and transcripts for review. Realtime is instructed to read exactly the supplied question; listen to ensure it does so. The compatibility option `gpt-4o-mini-tts` exports MP3 and includes Fable. OpenAI currently schedules the legacy Speech API's shutdown for 6 January 2027. Your existing recordings keep working regardless. Model access, pricing and voice availability depend on your API project. Image defaults are `gpt-image-2.5-flare`, 1024px, low quality; both the model and quality are editable.

## Import and publish

### Extend a pack

Pack Studio can load a published pack directly or open an exported JSON/ZIP. **Suggest extra vocabulary** appends words, keeps original items protected, and avoids duplicates across the list and other packs. **Generate missing images & voices** only makes missing assets. Packs support up to 200 words, with up to 52 suggestions per batch. Authoring prompts and settings are stored in `pack.authoring`; each item's `generation` records the actual image/audio settings. Unknown credentials or settings fields are filtered out during import. The original Animals illustration prompt is unavailable; known voice settings are preserved, and Fruit & Vegetables includes recovered original generation settings.

To publish an extended pack while preserving its link:

```powershell
node tools/import-pack.mjs C:/path/to/extended.pack.json --update
```

The update requires matching source-pack metadata and verifies that every current original word, question and media file is unchanged. New words can be appended; stale extensions missing someone else's published additions are rejected. The previous directory is backed up under ignored `test-output/pack-backups`. Browser imports accept marked extensions too, replacing a previous local copy or offering a local extension of a published pack. Local extensions stay on that device until published.

```powershell
node tools/import-pack.mjs C:/path/to/fruit.pack.json
npm test
npm run package
git add packs downloads
git commit -m "Add fruit vocabulary pack"
git push
```

The importer validates IDs, collisions, media filenames, base64, file signatures and size before extraction, refuses existing directories, and updates `packs/catalog.json`. New packs reuse the existing Brava recordings. After publishing, their link is `game.html?pack=PACK-ID`. A different activity can have another HTML entry point while reusing or extending `shared/game.js` and `shared/styles.css`.

GitHub Pages serves this repository's root from the `main` branch. All paths are relative, including media, so project-site hosting works. The downloaded studio ZIP includes a current catalogue snapshot, game, sample artwork, HTML, helper and importer. Run `npm run package` whenever packs change to refresh the download. Authoring source is public but API keys are never embedded. Network access is needed for generation and first-time npm installation.

The hosted game does not currently have an offline cache. Existing assets are ordinary static files; playing it makes no OpenAI requests.

## Verification

`npm test` checks catalogue/media integrity, touch and audio sequencing with a simulated DOM, collision rules, import round trips and malformed bundles. Live paid generation needs your API key and was not used as part of development verification.

Official API documentation: [images](https://developers.openai.com/api/docs/guides/image-generation), [speech](https://developers.openai.com/api/docs/guides/text-to-speech), [Realtime](https://developers.openai.com/api/docs/guides/realtime-conversations).
