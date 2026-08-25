# PioPio CSS reference audit

The supplied references total roughly 6.9 MB and more than 70,000 CSS rules. They are treated as visual references, not runtime dependencies, to avoid selector collisions, unused payload, third-party asset coupling, and proprietary icon/font reuse.

## Sources reviewed

| Source | Purpose | Used in PioPio |
|---|---|---|
| Timesheet booking `styles.css` | Bootstrap-based booking widget | No; isolated product domain |
| Omnichat platform `styles.css` | Chat/online-sales widget and KV icon font | Tokens only; no vendor font |
| Retail management v3 `styles-VTGMPW6I.css` | Core management UI and Inter font | Typography and management control behavior |
| KShip onboarding CSS | Shipping onboarding screens | No; route not implemented |
| Shipping price CSS | Shipping quote controls | Neutral/control patterns only |
| Chart widget CSS | Chart and BI Bootstrap variables | Font and spacing conventions |
| BI analysis widget CSS | Report/analysis widgets | Font, table and neutral conventions |
| KV Icon Kit CSS | Proprietary icon font mapping | No; PioPio uses Lucide icons |
| Intro.js CSS | Guided onboarding overlay | No; onboarding not implemented |
| Finance vendor CSS | Vue/vendor controls | No; prevents framework collisions |
| Finance onboarding CSS | Finance onboarding | No; route not implemented |
| Pay register CSS | Payment registration | No; route not implemented |
| Pay checkout CSS | Payment checkout | No; route not implemented |
| POS Online CSS | Complete design-token scale | Primary source for normalized tokens |
| Google Inter variable CSS | Inter variable font | Typography reference |
| Google Inter 400–700 CSS | Inter static weights | Current runtime font request |
| Freshchat widget CSS files | Third-party chat widget | No; support uses PioPio-owned UI |

## Normalized PioPio tokens

- Font stack: `Inter, Roboto, Helvetica, Arial, sans-serif`
- Body: `14px / 20px`
- Primary: `#0070f4`; hover/deep: `#004392`; selected: `#e6f1fe`
- Text: `#15171a`; secondary: `#525d6a`; muted: `#85909d`
- Border: `#e1e3e6`; page surface: `#f5f6f7`; white surface: `#fff`
- Success: `#00b63e`; warning: `#ff8800`; danger: `#ff0000`
- Spacing scale: `2, 4, 8, 16, 24, 48px`
- Radius scale: `6, 8, 16px`, plus full pill
- Standard control height: `48px`
- Popup elevation: `0 8px 10px rgba(0,0,0,.12), 0 4px 16px rgba(0,0,0,.12)`

The runtime implementation lives in `app/reference-theme.css` and intentionally sits after legacy styles so the normalized tokens win without importing any third-party bundle.
