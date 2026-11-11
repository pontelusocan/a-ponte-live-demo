# Private Circle staging setup

The GitHub backup branch is `backup/live-before-private-circle-2026-11-11` at `be255c6`.

The staging build uses the existing Live photo database and bucket. Migration `0002_members.sql` adds member accounts, sessions, email links, and an optional member reference on submissions. The Worker reads moderation decisions from the existing Admin database through `REVIEW_DB`. Selected photos appear as approved, hidden photos as declined, and other photos as pending. Photos and statuses are visible to their verified owner. Staging photos still follow the existing 90-day retention period, and the counts reflect retained submissions.

Before deploying the staging update, configure a verified Resend sender as `MEMBER_EMAIL_FROM` and a send-only key as the `RESEND_API_KEY` Worker secret. Keep the existing Turnstile secret and configure its staging site key for the build. Use the existing staging Worker and apply the member migration to the Live database before deploying the build.

```powershell
wrangler d1 migrations apply aponte-live-db --remote --config wrangler.staging.jsonc
$env:NEXT_PUBLIC_LIVE_UPLOADS = 'true'
$env:NEXT_PUBLIC_TURNSTILE_SITE_KEY = '<existing staging site key>'
npm run build
wrangler deploy --keep-vars --config wrangler.staging.jsonc
```

Use an authorised test mailbox to check verification, resend, password reset and the photo submission receipt on hosted staging. Use a test photo and confirm its status through the existing Admin review queue. The verification link can reopen a local draft for 24 hours when opened in the same browser profile. Account verification works from another browser after signing in there. The draft itself stays on the device where it was prepared.

The three extra benefit ideas appear only when the staging build flag is set. Publishing the public app requires the separate release review described in the implementation brief.
