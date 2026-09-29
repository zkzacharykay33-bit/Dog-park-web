# Field Guide — Dog Park Website (React)

React + Vite website for the dog park app. Uses the Supabase backend you already set up.

Pages: Home (best park right now, busy times, nearby parks, upcoming events), Map (Google Map with live dog counts, check in/out), Events (browse, filter, RSVP, host), My Dogs (profiles, photos, privacy).

## Put it online from an iPad (no terminal needed)

### 1. Upload the code to GitHub
1. Unzip the download in the Files app.
2. On github.com, create a new repository called `dog-park-web`.
3. Tap **uploading an existing file** and upload the four root files: `package.json`, `vite.config.js`, `index.html`, `README.md`. Commit.
4. Tap **Add file → Create new file**, type `src/keep.txt` as the name, type anything, and commit. (This creates the `src` folder.)
5. Open the `src` folder, tap **Add file → Upload files**, and upload every file from the unzipped `src` folder. Commit.

### 2. Deploy on Vercel (free)
1. Go to vercel.com and sign up with your GitHub account.
2. **Add New → Project**, pick `dog-park-web`. Vercel detects Vite automatically.
3. Before deploying, open **Environment Variables** and add:

| Name | Value |
|---|---|
| `VITE_SUPABASE_URL` | Supabase → Project Settings → API → Project URL |
| `VITE_SUPABASE_ANON_KEY` | Same page → anon public key |
| `VITE_GOOGLE_MAPS_KEY` | A Google key with **Maps JavaScript API** enabled |
| `VITE_TEST_MODE` | `true` while testing (check in from anywhere) |

4. Tap **Deploy**. You'll get a link like `https://dog-park-web.vercel.app`.

### 3. Finish the connections
- **Supabase → Authentication → URL Configuration:** set Site URL to your Vercel link so confirmation emails point to your site.
- **Google Cloud → Credentials:** restrict the Maps key to Websites → `https://your-link.vercel.app/*`.
- **Map style (before launch):** the map uses Google's demo Map ID. In Google Cloud → Map Management, create a Map ID and replace `DEMO_MAP_ID` in `src/MapPage.jsx`.

### Making changes
Edit or upload a file on GitHub and commit. Vercel rebuilds and updates the site automatically in about a minute. After changing environment variables, redeploy from the Vercel dashboard.

## Files
- `src/App.jsx` — sign-in check, top/bottom navigation, pages
- `src/useParkData.js` — location, nearby parks, live updates, check in/out
- `src/Home.jsx`, `src/MapPage.jsx`, `src/Events.jsx`, `src/Dogs.jsx` — the four tabs
- `src/Login.jsx` — sign in / create account
- `src/ParkParts.jsx` — check-in button, crowd label, busy-times chart
- `src/styles.css` — Field Guide colors, fonts, and layout

The data logic in `useParkData.js` and `format.js` carries straight over to the React Native app later.
