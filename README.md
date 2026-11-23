# Which Table?

An interactive guide to the eight table types across BigQuery and the Lakehouse runtime catalog on Google Cloud.

Pick what you need. The page shows which table types fit, then draws how each engine reads and writes the data.

This is an independent guide. It is not an official Google product.

## Run it locally

No build step and no dependencies.

```bash
python3 -m http.server 8000
# open http://localhost:8000
```

You can also open `index.html` directly in a browser.

## Publish on GitHub Pages

1. Create a public repository and push these files to the `main` branch.
2. In the repository, open **Settings > Pages**.
3. Under **Build and deployment**, set **Source** to **Deploy from a branch**.
4. Select `main` and `/ (root)`, then save.
5. The site appears at `https://<your-user>.github.io/<repository>/` after about a minute.

The empty `.nojekyll` file tells GitHub Pages to serve the files as they are.

## Files

| File | Purpose |
| --- | --- |
| `index.html` | Page structure |
| `styles.css` | Light and dark theme, layout, motion |
| `data.js` | All content: table types, needs, tips and source links |
| `logic.js` | Matching rules and shareable link state |
| `app.js` | Rendering, the animated diagram and events |
| `tests/logic.test.js` | Checks the content and the matching rules |

## Change the content

Edit `data.js` only. Each table type states, in plain words:

- how BigQuery and other engines write and read (`direct`, `via`, `preview`, `none` or `outside`)
- which security rules apply
- how it meets each need (`yes`, `partial` or `no`, with a reason)

Then run the tests:

```bash
node --test
```

The tests fail if a table type has no answer for a need, or gives a "no" without a reason.

## Accuracy

Every statement was checked against the public Google Cloud documentation on 23 November 2026. The date lives in `CHECKED_ON` in `data.js`. Features marked Preview can change, so check again before you update that date.
