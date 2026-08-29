# Proteus Mass Production Tracker (43-inch TV Display & Real-Time Admin Panel)

A high-visibility, real-time production tracking system purpose-designed for displaying on a **43-inch LED TV** with **zero scrolling**, ultra-bold typography, and instant WebSocket updates from the **Admin Management Console**.

---

## 3 Core Production Stages Tracked

1. **Assembly** — Mechanical & Sub-Assembly Build (Today Target & Current Count, Completion %, Remaining Units).
2. **FT (Functional Testing)** — Automated QA & Electrical Diagnostics (Today Target & Current Count, Completion %, Remaining Units).
3. **DLC (Device Life Cycle)** — Final Calibration, Burn-In & Pack-Out (Today Target & Current Count, Completion %, Remaining Units).

---

## How to Run

### Option 1: One-Click Startup (Recommended)
Double-click `start.bat` in the project root directory.

### Option 2: Command Line
```bash
# Add portable node to path (if not globally installed)
$env:PATH = "$PWD\tools\node;" + $env:PATH

# Start backend server (serves TV dashboard & Admin panel on Port 5000)
cd server
node server.js
```

---

## Access URLs

| Interface | URL | Purpose |
| :--- | :--- | :--- |
| **43" TV Display** | `http://localhost:5000/` or `http://<IP>:5000/` | Main fullscreen zero-scroll factory dashboard |
| **Admin Control Panel** | `http://localhost:5000/#admin` or `http://<IP>:5000/admin` | Operator/Supervisor console to adjust targets & counts |

---

## 43-inch TV Display Features

- **Zero-Scroll Viewport**: Calibrated to fit 100% of viewport height (`100vh`) on 1080p / 4K displays.
- **Ultra-Legible Typography**: Sized using responsive `clamp()` units for effortless reading from 10–25+ feet away.
- **High-Contrast Dark Theme**: Deep industrial dark aesthetic with glowing accents (Cyan for Assembly, Emerald for FT, Amber for DLC).
- **Sub-50ms WebSocket Synchronization**: Updates made from any Admin phone/tablet/PC reflect instantly on the TV screen without page reloading.
- **Built-in Clock & Shift Tracker**: Real-time 24h clock, live status pulse, and shift designation.
- **Keypad & Barcode Scanner Hotkeys**:
  - `1` or `A` — Increment Assembly count by +1
  - `2` or `F` — Increment FT count by +1
  - `3` or `D` — Increment DLC count by +1
  - `M` — Open Admin Panel
  - `F11` — Toggle Fullscreen

---

## Admin Panel Features

- **Quick-Tap Station Buttons**: `-1`, `+1`, `+5`, `+10` for fast floor updates.
- **Direct Numerical Input**: Set specific Target or Current counts with instant save.
- **Shift Management**: Switch active shift (Day, Evening, Night).
- **Shift / Daily Reset Modal**: Safely reset counts to 0 at the start of a shift while retaining daily targets.
- **Live Audit Trail**: Chronological log of recent count updates and station activity.
- **Data Persistence**: All counts and targets automatically persist to `server/data/production_data.json` across server restarts.
