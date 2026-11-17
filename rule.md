# JobBot UI & Architecture Rules

## 1. Strict Zero-Dot Policy (Never Use Dots)
- **No Status Indicator Dots**: Never render circular status dots (e.g. `w-2 h-2 rounded-full`, `w-1.5 h-1.5 rounded-full`, `bg-emerald-500 rounded-full`, `animate-pulse` dots, or `animate-ping` dots).
  - Use proper semantic Lucide SVG icons instead (e.g., `<Check />`, `<Activity />`, `<Clock />`, `<Sparkles />`, `<Loader2 />`).
- **No Bullet Dots (`•`)**: Never use typographical bullet points (`•`) anywhere in text or UI. Use clean dividers such as `/` or `|` or separate badge elements.
- **No Ellipses (`...`)**: Never use `...` in UI text, loading states, toasts, buttons, or modals. Write clean, complete labels (e.g., "Saving" instead of "Saving...", "Verifying Session" instead of "Verifying Session...").

## 2. Verified Status Badge Standard
- **Always Use the Filled Green Verified Badge**: In place of text badges like "Connected" or indicator dots, always use the filled green verified badge:
  ```jsx
  <ScallopBadge connected={true} className="w-4 h-4" />
  ```
- **No Redundant Badges**: Do not render redundant secondary badges (e.g. `[Session Saved & Active]` or text pills like `Connected`) alongside the verified badge. The green scallop verified badge itself is the single source of truth for verified accounts.

## 3. Strict Zero-Emoji Policy
- **No Emojis Anywhere**: Never use unicode emojis (e.g., ✅, ⚠️, 🔒, 🛡️, 🌐, 🚀, ⚡) in the UI, toasts, buttons, headers, modals, or API responses.
- **Always Use Lucide SVG Icons**: Represent concepts visually using clean, vector Lucide icons (`Check`, `AlertCircle`, `Lock`, `ShieldCheck`, `Loader2`, `Globe2`, etc.).

## 4. Platform Authentication & Toggle Protection
- **Genuine Authentication Verification**: A platform is only marked `connected: true` when genuine user authentication session cookies exist (e.g. `SOCK`, `UD`, `__Secure-PassportAuthProxy-BearerToken` for Indeed; `nauk_at` for Naukri; `li_at` for LinkedIn). Anonymous Cloudflare/guest cookies must never mark a platform connected.
- **Toggle Locked When Disconnected**: If a platform is not connected, its enable/disable toggle switch must remain locked and disabled (`cursor-not-allowed`, 40% opacity) with an explicit `<Lock className="w-3.5 h-3.5 text-slate-400" />` icon.
