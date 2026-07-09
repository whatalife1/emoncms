# EmonCMS Monitor - PKT Timezone Fix

## Overview
This is a complete backup of the EmonCMS Monitor application with all PKT (Pakistan Standard Time, UTC+5) timezone fixes applied.

## What's Fixed
- All date/time calculations now use PKT (UTC+5)
- "Today" kWh values correctly based on PKT midnight
- Solar predictions use PKT for sunrise/sunset
- Billing cycles (25th to 26th) follow PKT
- Graphs display data aligned to PKT
- All users worldwide see the same data

## File Structure
- css/ - All stylesheets
- js/  - All JavaScript (modified files: 00-config.js, 09-poll.js, 10b-solar-base-b.js, 14-solar-today.js, 16-reports-core.js, 17-reports-ui.js, 19b-graphs-ui.js, 19c-graphs-data.js)
- index.html - Main page with PKT indicator

## Key PKT Helpers (in 00-config.js)
- `getPktNow()` - Current time in PKT
- `formatPktTime()` - Format timestamp in PKT
- `getPktTodayStart()` - Today's midnight in PKT
- `isPktToday()` - Check if timestamp is today in PKT
- `getPktBillingRange()` - Billing cycle range in PKT

## Usage
- Serve the folder via any web server
- Open index.html in a browser
- All times and dates will be in PKT

---
**Backup created: 20260709_134910**
**Timezone: Asia/Karachi (UTC+5)**
