# SOLPHA Futures Desk — Marketplace listing (English, ready to paste)

Version covered: 1.0.0 · Drafted 13/11/2026.
Use on: Gumroad, Payhip, Polar/Dodo storefront, CodeCanyon (adapt to Envato's template). Each fenced block is pasted as-is into the matching field. Replace every `[PLACEHOLDER]` before publishing. Keep the disclaimers; do not delete them to "improve conversion".

Rules this text follows (do not break them when editing):
- No promise or implication of profit, win rate or "accuracy". No P&L screenshots.
- It is source code of a tool, **not** a signal service and not investment advice.
- It states what is not included and what the buyer must do.
- No third-party brand is used as a product brand. "Binance" appears only as the name of the public data source. Not affiliated with or endorsed by Binance.

---

## 1. Title (max 70 characters)

Recommended (62 characters):

```
SOLPHA Futures Desk – Crypto Futures Dashboard PWA Source Code
```

Alternatives: `SOLPHA Futures Desk – Multi-Timeframe Futures PWA (Source Code)` (63) · `SOLPHA Futures Desk | Crypto Futures PWA Source Code` (52)

## 2. Short description (about 160 characters; Gumroad summary / Payhip tagline)

```
Source code of an installable PWA that tracks Binance USDT-M futures with multi-timeframe indicators, candle rules, a position-sizing planner, backtest and trade journal.
```

Even shorter (about 90 characters):

```
Self-hosted futures analysis PWA (HTML/CSS/vanilla JS, no build). Source code. Not advice.
```

## 3. Long description

```
SOLPHA Futures Desk — source code

SOLPHA Futures Desk is a static, installable Progressive Web App (plain HTML, CSS and vanilla JavaScript, no build step, no framework, no backend required) that watches Binance USDT-M perpetual futures and presents price data, indicators, rule-based candle conditions and a risk calculator in a dark, branded interface.

You receive the complete, readable source code. You host it yourself, rebrand it for your own use under your license, and decide what to do with it.

IMPORTANT — READ FIRST
- This is software source code. It is NOT investment advice, NOT a trading signal service and NOT a trading bot. It does not place orders and never asks for exchange API keys.
- No profit, win rate or performance is promised or implied. Futures trading is high risk and you can lose your entire capital. The built-in backtest is a small, simplified simulation on recent public data (roughly 30 days) and is not evidence of future results.
- Signals shown by the app are the output of fixed, documented rules applied to public price data. They are not guaranteed to be right and no signals are bundled or sold with this product.
- You must deploy and configure it yourself. Basic web-hosting knowledge is needed; Android/Play Billing setup needs more.
- The user interface language is Vietnamese. Most documentation is also in Vietnamese (see "What is included"). Translating the UI means editing text in the source files.

FEATURES

Market data
- Real-time prices and candles from Binance's public futures WebSocket streams (new routed /market endpoint format required since 23 April 2026), mark price and funding rate every second, with automatic fallback to periodic REST polling and automatic reconnection.
- Tabs for SOL, BTC, ETH and DOGE, plus add any other USDT pair listed on Binance Futures (up to 8). Tick-size-aware number formatting.

Indicators and multi-timeframe view
- EMA 9/21, Bollinger Bands, RSI, ATR and MACD across 5M, 15M, 1H, 4H and 1D.
- Trend "phase" per timeframe and a combined multi-timeframe alignment view, with Bollinger-band touch detection.

Candle rule engine (signals.js, shared by live scan and backtest)
- Long setups A (pullback) and B (breakout after squeeze); Short setups S1, S2, S3; a counter-trend "adjusted short" mode; and a 4H/1H momentum mode.
- Each rule is parameterised in Settings, with per-pair settings. A scan runs automatically on every closed 5-minute candle across all your pairs.

Trade planner
- Three-part entry, stop-loss, take-profit levels and position size from your capital and risk percentage. Positions are skipped when the risk exceeds your configured ATR limit.

Backtest, 30-day optimizer and replay
- Backtest each rule set on about 1,500 real 5M candles, split into Long/Short and by setup, with the most common reasons a setup was rejected.
- "30-day optimize" downloads 30 days of public data in the browser, measures each condition after fees and slippage, shows first-half versus second-half stability, and lets you keep only the conditions that pass your thresholds.
- "Replay" lists every 5M candle around a chosen date and time with the decision and the reason.
- All of this runs locally in the browser. Small samples, simplified assumptions: treat results as an aid to understanding the rules, not as proof.

Trade journal with discipline score
- Daily checklist on five weighted criteria (indicator discipline, correct setup, risk management, split entries, no FOMO), daily grade A-D, monthly summary, longest discipline streak, CSV export and JSON backup/restore. Data is stored locally on the device.

Notifications
- Local notifications through the service worker, a test-notification button, catch-up scan of the last 90 minutes when the app is reopened, and an optional keep-screen-awake mode. Notifications are generated on the device; there is no push server.

PWA and Android
- Web app manifest, service worker with offline fallback, install prompt, maskable icons.
- Pre-configured Trusted Web Activity manifest (twa-manifest.json, Bubblewrap/PWABuilder compatible), Play Store graphic assets and a drafted store listing and policy-answers document to start from.

Google Play Billing backend (optional, for subscriptions)
- A Cloudflare Worker that verifies Google Play subscription purchases with the Google Play Developer API, acknowledges purchases, stores entitlements in Workers KV, and handles Real-time Developer Notifications (Pub/Sub). No npm dependencies. Covered by 39 automated tests.
- A client library (billing.js) for the Digital Goods API / Payment Request flow inside a TWA.
- NOT pre-wired: the supplied app screens do not contain a finished paywall or feature gating. The Worker and client library are provided and documented; connecting them to your own paywall UI is your job.

Quality
- node tests/signals.test.js runs the rule-engine checks; the Worker has its own test suite (39 tests).

REQUIREMENTS
- Static hosting over HTTPS (Cloudflare Pages, Netlify, GitHub Pages or any web server). No build tools needed to run the app.
- A modern browser; installation as an app works best on Chrome (Android and desktop).
- Node.js 18+ only if you want to run the tests or regenerate icons.
- For Android: a Google Play Developer account (Google's current registration fee and testing requirements apply and may change), plus Bubblewrap or PWABuilder.
- For subscriptions: Google Cloud project with a service account, Play Console subscription products, and a Cloudflare account (the free tier is enough for small scale).
- Internet access to Binance public endpoints. Users in regions where Binance blocks access will not receive data. Users' IP addresses are visible to Binance, as on any website that calls its public API.
- You are responsible for checking Binance's current terms for your intended use of public market data, and for the legal and tax rules in your country.

WHAT IS INCLUDED
- Complete app source: index.html, app.js, signals.js, journal.js, billing.js, brand.js, styles.css, solpha-theme.css, service worker, web manifests, icons, privacy and terms page templates (Vietnamese, with English summary of privacy).
- worker/ — Cloudflare Worker source, wrangler.toml, tests and README (Vietnamese).
- Android/TWA configuration, Play graphic assets, store listing draft and policy answers.
- Documentation (Vietnamese): README with rule descriptions, PWA deployment guide, Google Play and monetisation guide, Worker deployment guide.
- Tests for the rule engine and the Worker.
- Licence: Single or Extended (see below).

WHAT IS NOT INCLUDED
- No hosting, no domain, no Google Play account, no exchange account.
- No trading signals, no performance data, no strategy "edge", no guarantee.
- No order execution and no exchange API key handling.
- No 24/7 server-side alerts: the app scans only while it is running. Android may suspend web apps when the screen is off. A scan-and-push server (for example Telegram or Web Push) is not included.
- No finished paywall screens or feature gating (see above).
- No UI translation; the interface is Vietnamese.
- No legal documents tailored to you. Privacy and terms files are templates with placeholders that you must complete and have reviewed.

LICENSES (summary; the full text is in the file LICENSE shipped in the download)
- Single licence: one buyer, one end product (one brand, one domain, one Google Play app). You may modify the code and may charge your own users for that one product. You may not redistribute or resell the source code, publish it, or use it for a second product.
- Extended licence: multiple end products/brands and use for clients (for example as an agency); you may hand a deployed instance to a client. You still may not resell or redistribute the source code as a code product, template or competing marketplace item.
- Support options and updates are described on the purchase page. Support covers installation questions and bugs in the supplied code, not trading advice, strategy tuning or profit questions.

NOT AFFILIATED
SOLPHA Futures Desk is an independent product. It is not affiliated with, sponsored by or endorsed by Binance or Google. Binance and Google Play are trademarks of their owners and are named only to describe compatibility and the data source.

RISK WARNING
Trading cryptocurrency futures carries a high level of risk, including the loss of all capital. Nothing in this product is financial, investment or legal advice. Past or simulated results do not indicate future results. Use only money you can afford to lose and make your own decisions.
```

## 4. Tags / keywords

Gumroad / Payhip tags (pick 5–10):

```
pwa, javascript, source code, crypto, futures, technical analysis, trading journal, backtest, cloudflare workers, google play billing
```

CodeCanyon-style tag list:

```
pwa, progressive web app, javascript, vanilla js, crypto, futures, candlestick, rsi, ema, bollinger bands, atr, macd, backtest, trading journal, trusted web activity, twa, cloudflare worker, service worker, offline, dark theme
```

Do not add tags such as "signals", "profit", "passive income", "best", "bot", "100% accurate".

Suggested category: Gumroad "Software development" / "Programming"; CodeCanyon "JavaScript" or the closest PWA/mobile category (exact category list not confirmed, check the submission form).

## 5. FAQ (8 questions)

```
1. Is this a trading signal service or a bot?
No. It is source code of an analysis dashboard. It shows indicators and applies fixed, documented rules to public price data. It does not execute trades, does not connect to your exchange account and does not ask for API keys. No signals are sold or guaranteed.

2. Will it make me money?
No promise of that is made, and none can be. Futures trading is high risk and you can lose all your capital. The backtest is a small, simplified simulation on about 30 days of data and is not evidence of future results. Buy it for the code and the learning/tooling value, not for expected profit.

3. Do I need a server or a backend?
No for the app itself: it is a static site. You only need a backend (the included Cloudflare Worker) if you want to sell subscriptions through Google Play Billing. The Worker runs on Cloudflare's free tier at small scale.

4. What do I need to publish it on Google Play?
A Google Play Developer account (Google's current fee and testing rules apply), the included TWA configuration, Bubblewrap or PWABuilder to build the package, and for subscriptions the Worker plus Play Console products. A Vietnamese step-by-step guide is included. You must also complete Google's financial-features declaration and privacy forms yourself, and your listing must follow Google Play policy.

5. In which language is the app and documentation?
The app interface and most documentation are in Vietnamese. Code comments are mostly Vietnamese. Variable and file names are in English. Changing the UI language means editing strings in the source files.

6. Does it work with exchanges other than Binance? Can I trade from inside it?
It reads Binance USDT-M futures public data only. Other exchanges would need code changes. There is no trading functionality.

7. What are the limits I should know about?
Alerts work only while the app is running and may be paused by Android when the screen is off; a server for 24/7 alerts is not included. Data may be unavailable in regions where Binance blocks access. Binance can change its endpoints (it did in April 2026), so the data layer may need maintenance. You must check Binance's current terms for your intended use.

8. What is the difference between Single and Extended licence, and what about refunds and updates?
Single: one end product (one brand, one domain, one Play app). Extended: multiple products/brands and client work. Neither allows reselling or redistributing the source code. Because this is a digital download, refunds follow the policy shown on the purchase page: [REFUND POLICY — e.g., refund within 14 days only if the download is corrupted or materially differs from this description, and you have not deployed it]. Updates and support period depend on the option you buy and are listed on the purchase page.
```

## 6. Changelog

```
v1.0.0 (13 Nov 2026) — first public source release
- Multi-pair futures desk (SOL, BTC, ETH, DOGE + custom pairs, up to 8) with realtime WebSocket data (new /market endpoint format) and REST fallback.
- Indicators EMA/BB/RSI/ATR/MACD across 5M, 15M, 1H, 4H, 1D.
- Candle rule engine: Long A/B, Short S1/S2/S3, adjusted short, 4H/1H momentum; per-pair settings.
- Trade planner (3-part entry, SL, TP1/TP2, size from risk).
- Backtest, 30-day optimizer (fees + slippage), replay.
- Trade journal with weighted discipline score, monthly summary, CSV/JSON export.
- Local notifications, catch-up scan, install as PWA.
- Android TWA configuration, Play graphic assets, store listing and policy drafts.
- Cloudflare Worker for Google Play subscription verification (acknowledge, entitlements in KV, RTDN), client library billing.js, 39 automated tests.
- Dark SOLPHA-branded interface (Vietnamese).

Known limitations in 1.0.0: no server-side alerts; Play Billing paywall UI not pre-wired; UI language Vietnamese only.
```

## 7. Gumroad variants (optional, matches PRICING.md)

| Variant name | Short note on the purchase page |
|---|---|
| Single — App only | PWA source + docs. One end product. |
| Single — App + Android & Billing kit | Adds TWA config, Play assets/listing drafts and the Cloudflare Worker + billing.js. One end product. |
| Extended — Full kit | Everything, multiple end products/brands, client work allowed. |
| Add support: 6 months | Email support for installation questions and bugs in the supplied code. Not trading support. |

## 8. Image and video notes

- First image: the real app screenshot (dark UI) with the product name only. No profit figures, no P&L, no exchange logos.
- Show: pair tabs, indicator panel, trade planner (with a clearly sample capital), backtest panel, journal score.
- Overlay text allowed: "Source code", "Self-hosted", "PWA", "Android TWA kit", "Cloudflare Worker". Not allowed: "profit", "win rate", "accurate", "signals".
- Add a caption: "Screenshots show sample data. Not investment advice."
