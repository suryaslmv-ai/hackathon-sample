# MediBridge Care — Codex project

A full-stack starter for a healthcare organization platform (not an AI diagnostic product). Includes a polished responsive React UI, Supabase email/password authentication, Google OAuth wiring, password reset, persistent sessions, a Postgres schema with Row Level Security, patient appointment/record previews, and a nearby-hospital Google Maps search that asks permission before using location.

## Requirements

- Node.js 20 LTS or newer
- A Supabase project
- Google OAuth client credentials for Google sign-in
- Optional: Google Maps Platform key if later adding an embedded Places API. Current nearby-hospital flow uses a Maps search URL and does not need a Maps API key.

## Run locally

1. Open this folder in Codex (or VS Code with Codex).
2. Copy `.env.example` to `.env.local`.
3. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` to your own Supabase project URL and anon/publishable key. Never put a Supabase service-role key in a browser app.
4. In a terminal:

   ```bash
   npm install
   npm run dev
   ```

5. Open the local URL printed by Vite.

Without Supabase env values, the UI loads but sign-in actions intentionally display a configuration message. Do not enter real patient data until the deployment and security review are complete.

## Set up Supabase database

Use the Supabase SQL Editor and run `supabase/migrations/202610180001_initial_schema.sql`, or use the Supabase CLI migration workflow. The migration creates profiles, hospitals, doctors, appointments, health records, allergies, medications, vitals, care articles, consent records, and audit logs, plus starter RLS policies and a profile-on-signup trigger.

Before production: review every RLS policy with a security specialist, add server-side audit writes, define verified doctor/hospital admin onboarding, and add secure storage bucket policies for uploaded records. This is a starter schema, not a certified healthcare compliance package.

## Enable Google Sign-In

1. In Supabase Dashboard, open **Authentication → Providers → Google** and enable Google.
2. Create an OAuth client in Google Cloud Console. Add the Supabase callback URL shown in Supabase's Google provider settings to Google's **Authorized redirect URIs**.
3. Paste the Google Client ID and Client Secret into Supabase's Google provider settings and save.
4. In Supabase **Authentication → URL Configuration**, add your local URL (for example `http://localhost:5173`) and production domain to **Redirect URLs**.
5. Keep the app's OAuth redirect URL aligned with your deployed site. This starter uses the current origin (`window.location.origin`).
6. Test in a private/incognito window. The button is wired in code, but OAuth cannot complete until you add your own provider credentials and authorized URLs.

## Authentication troubleshooting

- **Invalid login credentials**: confirm the account exists in this exact Supabase project; check email confirmation status and whether password reset is needed. Accounts in a different Supabase project do not automatically exist here.
- **Google button returns provider not enabled**: enable Google provider and add client credentials in Supabase.
- **Redirect URL not allowed**: add the exact origin in Supabase Authentication → URL Configuration; also add Supabase's callback URL in Google Cloud.
- **Missing Supabase configuration**: check `.env.local` spelling and restart `npm run dev` after editing it.
- Never share passwords, OAuth client secrets, or service-role keys in chat or commit them to source control.

## Current implementation and limits

- Implemented in this starter: frontend UI, email/password sign-in, signup, reset email request, Google OAuth call, auth session listener, sign-out, dashboard reads for appointments and records, geolocation permission request, Google Maps hospital search fallback, SQL schema and initial RLS.
- Not yet implemented: appointment booking creation UI, clinician/admin portals, medical-document upload UX and Storage bucket policies, notifications, verified directory ingestion, end-to-end OAuth test using your credentials, production deployment, independent security review, medical/legal compliance certification.
- Hospital listings and distances are provided by Google Maps after opening the search; this app does not fabricate hospital names or availability.
- For urgent emergencies in India, call 112. The app does not diagnose or prescribe treatment.

## Checks

Run `npm run build` to type-check and produce a production bundle. This source package was generated in the chat environment; dependency installation, Supabase connection, Google OAuth end-to-end, and live database authorization still need to be run and verified in your environment.
