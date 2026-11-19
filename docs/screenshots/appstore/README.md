# App Store screenshots (raw)

Raw iPhone 17 Pro Max simulator captures, 1320 × 2868 px (the 6.9-inch iPhone size App Store Connect takes as is), status bar fixed at 9:41 with full signal and battery.
Taken 2026-11-19 on the iOS 26.4 simulator from the development client against the sample data of `apps/mobile/src/features/dev/scenarios.ts`
(`typical`: day 11 of a 28–29 day cycle; `energy` for the charts), dates relative to the capture day, 19 Nov 2026. They are unframed: no device frame, no caption.

`ios/<number>-<screen>-<light|dark>.png`

| File | Screen | Link used |
| --- | --- | --- |
| 01-today | Today: cycle dial, estimate cards, Log today | `sanguine://today?scroll=top` |
| 02-calendar | Calendar with fertile-window band, ovulation ring, estimates, day bar | `sanguine://calendar?day=<today>&sheet=closed` |
| 03-calendar-day | Calendar with the day sheet open | `sanguine://calendar?day=<today>&sheet=small&scroll=top` |
| 04-log | Log sheet | `sanguine://log` |
| 05-insights-cycle | Insights, This cycle: estimates and how they were worked out | `sanguine://insights?tab=this-cycle` |
| 06-insights-charts | Insights, Charts (energy sample, three cycles) | `sanguine://insights?tab=charts` |
| 07-insights-history | Insights, History | `sanguine://insights?tab=history` |
| 08-settings-appearance | Settings, Appearance | `sanguine://settings/appearance` |

Not here: Android (the emulator is not run on this machine), iPad, the 6.5- and 6.1-inch iPhone sizes, onboarding, and the splash. 06 shows only the first chart cards on a screen that scrolls; take it again once Insights accepts a `scroll` anchor (as Today does).
Shots 01–03 and 05 are the strongest. The captures show a sample data set, not a person's data.
