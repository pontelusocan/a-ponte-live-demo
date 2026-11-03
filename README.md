# A PONTE Live — UI/UX prototype

A PONTE Live is a frontend-only Next.js prototype of an interactive wine experience: a mobile journey that starts from the A PONTE brand film and invites people to discover, browse and share moments around a bottle of A PONTE.

It is a design demonstration. All content is illustrative, and every interaction is simulated in the browser.

## Pages

| Page | What it shows |
| --- | --- |
| `/scan` | The A PONTE brand film, with links to A PONTE Live and the A PONTE website |
| `/live` | Cinematic photo slideshow and a community carousel of cities |
| `/live/moments` | A gallery of sample moments, filterable by country, with photo detail views |
| `/live/share` | The "share your moment" flow: real camera capture (or a photo from the phone), optional city/country detection, the review form and a confirmation screen. Submission is still simulated |

The interface is available in English, French and Portuguese. On desktop the experience is shown inside a phone frame.

## Not implemented

This prototype has no backend. In particular:

- Photo submissions are not uploaded, stored or sent anywhere. The captured photo and form values are prepared in the browser (`src/lib/share/submission.ts`) and discarded when the page closes.
- Location is optional. When the visitor asks for it, their approximate position (rounded to about 1 km) is sent once to BigDataCloud's free reverse-geocoding service to find the city and country; coordinates are not kept.
- There is no moderation of shared moments.
- No email notifications or mailing-list subscriptions are sent.
- No promotional codes or rewards are issued.
- No analytics or tracking are active.

Names, places and gallery entries are sample content, not real customer submissions. The slideshow images on `/live` were created with AI image-generation tools for this demonstration; they do not show real customers.

## Run locally

Requires Node.js 20 or later.

```bash
npm install
npm run dev
```

Then open http://localhost:3000.

## Deployment

Every push to `main` builds a static export and publishes it to GitHub Pages (`.github/workflows/deploy.yml`).

## Credits

City photographs come from Wikimedia Commons under Creative Commons licences. Authors, licences and sources are listed in the app ("Photo credits" on the Discover page) and in `public/cities/CREDITS.md`.

Fonts: Barlow is used under the SIL Open Font License 1.1 (`public/fonts/Barlow-OFL.txt`). New Title is by the Indian Type Foundry and is loaded from [Fontshare](https://www.fontshare.com/fonts/new-title); its font files are not part of this repository.
