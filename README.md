# 📺 Newsroom MIS

Media Information System for newsroom — tracks NLE Editors, News Producers, and Voice Over staff with daily work entry, attendance, shift management, quality scoring, and reporting.

---

## ✨ Features

| Module | Details |
|---|---|
| **Daily Entry** | NLE task logging (type, description, IN/OUT times, weighted points), Producer/VO activity counters |
| **Attendance** | Clock-in/out with geolocation, map links |
| **Breaks** | Lunch & break tracking with duration |
| **Performance Score** | Quality (40%) + Output (30%) + Reliability (20%) + Creativity (10%) |
| **History** | 30-day accordion history with inline task view |
| **Shift Planner** | 7-day grid with CSV/SQL import, image export |
| **Shift Chatbot** | Employee self-service shift-change request flow |
| **Reports** | Today / This Week / This Month / Date Range, Cumulative or Breakup, Excel export |
| **Task Search** | Full-text search across all NLE tasks (admin + employee) |
| **Staff Management** | Add / edit / deactivate employees |
| **Quality & Reliability** | Admin scoring with visual stepper/slider UI |

---

## 🚀 Local Development

### 1. Clone & install

```bash
git clone https://github.com/<your-org>/tj-mis.git
cd tj-mis
npm install
```

### 2. Set environment variables

Copy the example and fill in your Supabase credentials:

```bash
cp .env.example .env
```

Edit `.env`:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

> **Where to find these:** Supabase Dashboard → Project Settings → API

### 3. Run

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173)

---

## 🗄️ Supabase Setup

### Required tables

| Table | Key columns |
|---|---|
| `employees` | `id` (uuid), `emp_code` (text), `name`, `dept`, `is_active` |
| `attendance` | `emp_id` (uuid→employees), `date`, `in_time`, `out_time`, `in_location`, `out_location` |
| `nle_daily_entries` | `emp_id`, `date`, `news_type`, `description`, `start_time`, `end_time`, `manual_mins` |
| `producer_daily` | `emp_id`, `date`, `dept`, + field columns |
| `breaks` | `emp_id`, `date`, `break_type`, `start_time`, `end_time` |
| `quality_errors` | `emp_id`, `date`, `error_key`, `count` |
| `reliability_scores` | `emp_id`, `month` (YYYY-MM), `on_time`, `emergency`, `team_coord`, `night_shift`, `pressure`, `creativity` |
| `shift_entries` | `employee_id` (uuid), `shift_date`, `shift_code`, `remarks` |
| `shift_change_requests` | `employee_id`, `employee_name`, `dept`, `start_date`, `end_date`, `requested_shift`, `reason`, `status` |

### User metadata (Supabase Auth)

Each user must have `app_metadata` set:

```json
{
  "role": "admin",      // or "employee"
  "emp_id": "22001"     // must match employees.emp_code
}
```

Set via Supabase Dashboard → Authentication → Users → Edit user → app_metadata, or via the admin SQL editor:

```sql
UPDATE auth.users
SET raw_app_meta_data = raw_app_meta_data || '{"emp_id":"22001","role":"employee"}'::jsonb
WHERE email = 'employee@tamiljanam.tv';
```

### RLS Policies

Enable Row Level Security on all tables. Minimum policies needed:

```sql
-- Allow authenticated users to read/write their own records
CREATE POLICY "auth_users" ON nle_daily_entries
  USING (auth.role() = 'authenticated');

-- Repeat for each table
```

---

## 🌐 GitHub Pages Deployment

### Step 1 — Enable GitHub Pages

1. Go to your repo → **Settings** → **Pages**
2. Under **Source**, select **GitHub Actions**
3. Save

### Step 2 — Add Secrets

Go to **Settings** → **Secrets and variables** → **Actions** → **New repository secret**

Add both:

| Secret name | Value |
|---|---|
| `VITE_SUPABASE_URL` | `https://your-project.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | `your-anon-key` |

### Step 3 — Update the base URL

In `vite.config.js`, the `base` is set to `/tj-mis/` when `GITHUB_PAGES=true`. If your repo name is different, update the base:

```js
base: isGitHubPages ? '/your-repo-name/' : '/',
```

### Step 4 — Push to main

```bash
git add .
git commit -m "deploy: initial TJ MIS"
git push origin main
```

The **Deploy TJ MIS to GitHub Pages** workflow will run automatically. Check progress under the **Actions** tab.

### Step 5 — Access your app

After the workflow succeeds (~2 minutes), your app is live at:

```
https://<your-github-username>.github.io/tj-mis/
```

### Manual redeploy

Go to **Actions** → **Deploy TJ MIS to GitHub Pages** → **Run workflow**

---

## 🔑 Environment Variables Reference

| Variable | Required | Description |
|---|---|---|
| `VITE_SUPABASE_URL` | ✅ | Your Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | ✅ | Supabase anon/public key |

> ⚠️ Never commit `.env` to git. It is already in `.gitignore`.

---

## 📁 Project Structure

```
tj-mis/
├── .github/
│   └── workflows/
│       └── deploy.yml        # GitHub Actions CI/CD
├── public/
├── src/
│   ├── components/
│   │   ├── AdminPages1.jsx   # Overview, TodayWork, Attendance
│   │   ├── AdminPages2.jsx   # ShiftPlanner, StaffMgmt, ShiftRequests
│   │   ├── AdminPages3.jsx   # Quality, Reliability, Producers, Search, Report
│   │   ├── BreaksTab.jsx
│   │   ├── DailyEntry.jsx
│   │   ├── HistoryTab.jsx
│   │   ├── ScoreTab.jsx
│   │   └── ShiftChatbot.jsx
│   ├── data/
│   │   └── constants.js      # NEWS_TYPES, QUALITY_ITEMS, SHIFT_OPTS …
│   ├── hooks/
│   │   ├── useApp.jsx        # Global state (useReducer)
│   │   ├── useData.js        # All Supabase operations, 50k pagination
│   │   └── useToast.jsx
│   ├── lib/
│   │   ├── supabase.js
│   │   └── utils.js
│   ├── pages/
│   │   ├── AdminDashboard.jsx
│   │   ├── EmployeeDashboard.jsx
│   │   └── LoginPage.jsx
│   ├── App.jsx               # Auth routing
│   ├── index.css             # Full design system
│   └── main.jsx
├── .env                      # Local secrets (git-ignored)
├── .env.example              # Template
├── vite.config.js
└── README.md
```

---

## 🛠 Tech Stack

- **React 19** + Vite 8
- **Supabase** (Auth + Postgres)
- **xlsx** — Excel export
- **html2canvas** — Report image export
- **Inter** + **JetBrains Mono** fonts

---

## 📝 Notes

- **Data limit:** Fetches up to 50,000 rows per table using paginated Supabase queries (1,000 rows/page)
- **Duplicate prevention:** NLE items track `_id` in React state after first INSERT — subsequent saves always UPDATE the same row
- **Theme:** Light by default, dark toggle persists in `localStorage`
- **Admin + Employee view:** Admin users can switch to Employee view via the topbar button and back

---

*Built for Newsroom · © 2026*
