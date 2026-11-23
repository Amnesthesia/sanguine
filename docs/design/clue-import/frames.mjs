// Source of every Clue import frame: writes frames/*.html (plain HTML and CSS, no scripts, no network).
// Run from the repo root: node docs/design/clue-import/frames.mjs (render.mjs runs it first, then takes the PNGs).
// Styles follow docs/superpowers/specs/2026-11-18-glass-design-language.md and the Settings frames in
// docs/design/glass-redesign/frames/. Text sizes are multiplied by --t so the 150% frame is the same markup.
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const out = join(dirname(fileURLToPath(import.meta.url)), 'frames');

const css = `
body{margin:0;background:#fff}
.phone{--t:1;width:440px;min-height:956px;position:relative;box-sizing:border-box;overflow:hidden;font-family:-apple-system,BlinkMacSystemFont,'SF Pro Text','Segoe UI',Roboto,sans-serif;background:var(--bg);color:var(--ink);
--bg:#FFFFFF;--ink:#1F1A1C;--sec:#6B6165;--line:#E4E4E6;--accent:#BC4560;--soft:#F4DCE0;--onsoft:#A3354F;--card:#FFFFFF;--cardRing:0 0 0 1px rgba(31,26,28,0.04),0 2px 6px rgba(31,26,28,0.04),0 12px 32px rgba(31,26,28,0.08);
--fieldRing:0 0 0 1px rgba(31,26,28,0.07),0 1px 3px rgba(31,26,28,0.05);--s2:#F3F3F4;--fill:rgba(188,69,96,0.96);--fillShadow:inset 0 1px 0 rgba(255,255,255,0.45),0 6px 16px rgba(188,69,96,0.32);
--cauBg:rgba(185,116,30,0.10);--cauInk:#5E3A0C;--cauIcon:#8A5512;--ok:#3E7D5A;--err:#B8324A;--chev:#8E8387;--onGlass:#4A4246;--dim:rgba(31,26,28,0.38);--kb:#D1D3D9;
--glass:linear-gradient(180deg,rgba(255,255,255,0.50) 0%,rgba(255,255,255,0.22) 42%,rgba(255,255,255,0.30) 100%);--glassFx:blur(18px) saturate(200%) brightness(1.04);--rim:rgba(255,255,255,0.6);
--glassShadow:0 10px 30px rgba(31,26,28,0.14),inset 0 1px 0 rgba(255,255,255,0.95),inset 0 -1px 0 rgba(255,255,255,0.35);--backBg:rgba(255,255,255,0.5);--backShadow:inset 0 1px 0 rgba(255,255,255,0.9),0 2px 6px rgba(31,26,28,0.08);
--sheet:rgba(250,249,250,0.98);--sheetShadow:0 -6px 30px rgba(31,26,28,0.22),inset 0 1px 0 rgba(255,255,255,0.95)}
.dark{--bg:#000000;--ink:#F4EEEF;--sec:#B3A8AC;--line:#3A3A3C;--accent:#D4607A;--soft:#3A1F27;--onsoft:#E8869A;--card:#1C1C1E;--cardRing:0 0 0 1px #3A3A3C;--fieldRing:0 0 0 1px #3A3A3C;--s2:#2C2C2E;
--fill:#BB546B;--fillShadow:inset 0 1px 0 rgba(255,255,255,0.18),0 6px 16px rgba(0,0,0,0.4);--cauBg:rgba(217,160,84,0.10);--cauInk:#D9A054;--cauIcon:#D9A054;--ok:#6FB68C;--err:#D9607A;--onGlass:#CFC6CA;--dim:rgba(0,0,0,0.55);--kb:#2B2B2D;
--glass:linear-gradient(180deg,rgba(70,62,66,0.55) 0%,rgba(30,26,28,0.38) 42%,rgba(40,35,38,0.45) 100%);--glassFx:blur(18px) saturate(180%);--rim:rgba(255,255,255,0.12);
--glassShadow:0 10px 30px rgba(0,0,0,0.35),inset 0 1px 0 rgba(255,255,255,0.12),inset 0 -1px 0 rgba(255,255,255,0.12);--backBg:rgba(255,255,255,0.10);--backShadow:inset 0 1px 0 rgba(255,255,255,0.12);
--sheet:rgba(28,28,30,0.98);--sheetShadow:0 -6px 30px rgba(0,0,0,0.5),inset 0 1px 0 rgba(255,255,255,0.10)}
.big{--t:1.5}
.fixed{height:956px}
main{padding:82px 16px 40px;display:flex;flex-direction:column;gap:16px}
p,h1,h2,h3,ol{margin:0}
.body{font-size:calc(15px*var(--t));line-height:calc(21px*var(--t))}
.sec{font-size:calc(13px*var(--t));line-height:calc(18px*var(--t));color:var(--sec)}
.lead{font-size:calc(15px*var(--t));line-height:calc(21px*var(--t));color:var(--sec);margin:0 4px}
.h{font-size:calc(17px*var(--t));line-height:calc(22px*var(--t));font-weight:600}
.label{font-size:calc(11px*var(--t));line-height:calc(14px*var(--t));font-weight:600;letter-spacing:0.4px;text-transform:uppercase;color:var(--sec)}
.card{border-radius:24px;background:var(--card);box-shadow:var(--cardRing);padding:16px;display:flex;flex-direction:column;gap:12px}
.steps{list-style:none;padding:0;display:flex;flex-direction:column;gap:16px}
.steps>li{display:flex;gap:12px;align-items:flex-start}
.num{width:calc(30px*var(--t));height:calc(30px*var(--t));flex-shrink:0;border-radius:50%;background:var(--soft);color:var(--onsoft);font-weight:700;font-size:calc(15px*var(--t));display:flex;align-items:center;justify-content:center}
.col{flex:1;min-width:0;display:flex;flex-direction:column;gap:8px}
.crumbs{display:flex;flex-wrap:wrap;align-items:center;gap:6px;margin-top:2px}
.chip{display:inline-flex;align-items:center;gap:6px;min-height:32px;box-sizing:border-box;padding:5px 12px;border-radius:16px;background:var(--s2);font-size:calc(14px*var(--t));line-height:calc(18px*var(--t));font-weight:500;color:var(--ink)}
.inset{border-radius:16px;background:var(--s2);padding:10px 12px;display:flex;gap:10px;align-items:center}
.mono{font-family:ui-monospace,'SF Mono',Menlo,monospace;letter-spacing:1px;font-size:calc(16px*var(--t));line-height:calc(21px*var(--t))}
.primary{width:100%;min-height:52px;border-radius:26px;border:0;background:var(--fill);color:#FFFFFF;font-size:calc(17px*var(--t));line-height:calc(22px*var(--t));font-weight:600;font-family:inherit;display:flex;align-items:center;justify-content:center;gap:8px;padding:8px 20px;box-shadow:var(--fillShadow)}
.primary[aria-disabled=true]{opacity:0.4;box-shadow:none}
.secondary{min-height:48px;padding:8px 20px;border:0;border-radius:24px;background:var(--card);box-shadow:var(--cardRing);color:var(--ink);font-size:calc(15px*var(--t));line-height:calc(20px*var(--t));font-weight:500;font-family:inherit;display:flex;align-items:center;justify-content:center;gap:8px}
.caution{border-radius:18px;background:var(--cauBg);padding:12px 14px;display:flex;gap:10px;align-items:flex-start;color:var(--cauInk)}
.caution .body{font-size:calc(14px*var(--t));line-height:calc(20px*var(--t))}
.chev{flex-shrink:0}
header.bar{position:absolute;top:10px;left:10px;right:10px;border-radius:30px;padding:8px;background:var(--glass);backdrop-filter:var(--glassFx);-webkit-backdrop-filter:var(--glassFx);border:1px solid var(--rim);box-shadow:var(--glassShadow);display:flex;align-items:center;gap:6px}
header.bar .back{width:44px;height:44px;flex-shrink:0;border-radius:22px;border:1px solid var(--rim);background:var(--backBg);box-shadow:var(--backShadow);color:var(--ink);font-size:22px;padding:0}
header.bar h1{flex:1;text-align:center;font-size:calc(17px*var(--t));line-height:calc(22px*var(--t));font-weight:600;white-space:nowrap}
.rows{border-radius:26px;background:var(--card);box-shadow:var(--cardRing);overflow:hidden}
.row{min-height:56px;box-sizing:border-box;padding:11px 16px;display:flex;align-items:center;gap:12px}
.row+.row{border-top:1px solid var(--line)}
.row .t{font-size:calc(16px*var(--t));line-height:calc(21px*var(--t))}
.switch{position:relative;width:51px;height:31px;flex-shrink:0;border-radius:16px;border:0;padding:0;background:var(--line)}
.switch[aria-checked=true]{background:#BC4560}
.switch span{position:absolute;top:2px;left:2px;width:27px;height:27px;border-radius:14px;background:#FFFFFF;box-shadow:0 2px 5px rgba(31,26,28,0.22)}
.switch[aria-checked=true] span{left:22px}
.pills{display:flex;flex-wrap:wrap;gap:8px}
.pill{min-width:56px;min-height:44px;padding:0 16px;border-radius:22px;font-size:calc(15px*var(--t));font-family:inherit;background:var(--card);box-shadow:var(--fieldRing);border:1.5px solid transparent;color:var(--ink)}
.pill[aria-pressed=true]{background:var(--soft);border-color:var(--accent);color:var(--onsoft);font-weight:600;box-shadow:none}
.scrim{position:absolute;inset:0;background:var(--dim)}
.sheet{position:absolute;left:0;right:0;bottom:336px;border-radius:34px 34px 0 0;background:var(--sheet);backdrop-filter:blur(30px) saturate(180%);-webkit-backdrop-filter:blur(30px) saturate(180%);box-shadow:var(--sheetShadow);padding:8px 16px 20px;box-sizing:border-box;display:flex;flex-direction:column;gap:14px}
.grab{width:36px;height:5px;border-radius:3px;background:rgba(120,120,128,0.36);align-self:center}
.field{display:flex;align-items:center;min-height:52px;box-sizing:border-box;border-radius:18px;background:var(--card);box-shadow:var(--fieldRing);border:1.5px solid transparent;padding:0 4px 0 16px}
.field[aria-invalid=true]{border-color:var(--err);box-shadow:none}
.field input{flex:1;min-width:0;border:0;background:none;font:inherit;font-size:calc(17px*var(--t));color:var(--ink);outline:none;padding:0}
.field input::placeholder{color:var(--sec)}
.eye{width:44px;height:44px;flex-shrink:0;border:0;border-radius:22px;background:none;display:flex;align-items:center;justify-content:center;padding:0}
.err{display:flex;gap:8px;align-items:flex-start;color:var(--err);font-size:calc(14px*var(--t));line-height:calc(20px*var(--t))}
.kb{position:absolute;left:0;right:0;bottom:0;height:336px;background:var(--kb);display:flex;align-items:center;justify-content:center;color:var(--sec);font-size:13px}
`;

const line = (c, w = 1.7) => `fill="none" stroke="${c}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"`;
const icon = {
  lock: (c) => `<svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true" style="flex-shrink:0"><rect x="4" y="9.5" width="14" height="10" rx="3" ${line(c)}/><path d="M7.5 9.5V7A3.5 3.5 0 0 1 14.5 7V9.5" ${line(c)}/></svg>`,
  folder: (c) => `<svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><path d="M2.5 5.5A1.5 1.5 0 0 1 4 4H7.2L8.8 5.8H14A1.5 1.5 0 0 1 15.5 7.3V13A1.5 1.5 0 0 1 14 14.5H4A1.5 1.5 0 0 1 2.5 13Z" ${line(c)}/></svg>`,
  chev: `<svg class="chev" width="7" height="12" viewBox="0 0 8 14" aria-hidden="true"><path d="M1.5 1.5L6.5 7L1.5 12.5" ${line('var(--chev)', 1.8)}/></svg>`,
  key: (c) => `<svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true" style="flex-shrink:0"><circle cx="6.5" cy="10" r="3.6" ${line(c, 1.6)}/><path d="M10.1 10H17.5M15 10V12.8M17.5 10V12" ${line(c, 1.6)}/></svg>`,
  mail: (c) => `<svg width="16" height="16" viewBox="0 0 18 18" aria-hidden="true"><rect x="2" y="4" width="14" height="10.5" rx="2" ${line(c, 1.6)}/><path d="M2.6 5L9 10L15.4 5" ${line(c, 1.6)}/></svg>`,
  save: (c) => `<svg width="16" height="16" viewBox="0 0 20 20" aria-hidden="true"><path d="M10 2.5V12.5M6.5 9L10 12.5L13.5 9M3 13V16A1.5 1.5 0 0 0 4.5 17.5H15.5A1.5 1.5 0 0 0 17 16V13" ${line(c, 1.6)}/></svg>`,
  file: (c) => `<svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true" style="flex-shrink:0"><path d="M5 2.5H11.5L15.5 6.5V17.5H5Z" ${line(c, 1.6)}/><path d="M11.5 2.5V6.5H15.5M9 6V7M9 9V10M9 12V13" ${line(c, 1.6)}/></svg>`,
  eye: (c, off) => `<svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true"><path d="M2 11C4.4 6.6 7.4 4.6 11 4.6S17.6 6.6 20 11C17.6 15.4 14.6 17.4 11 17.4S4.4 15.4 2 11Z" ${line(c, 1.6)}/><circle cx="11" cy="11" r="3" ${line(c, 1.6)}/>${off ? `<path d="M3.5 3.5L18.5 18.5" ${line(c, 1.6)}/>` : ''}</svg>`,
  check: (c) => `<svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true" style="flex-shrink:0"><circle cx="12" cy="12" r="10" ${line(c, 1.7)}/><path d="M7.5 12.5L10.5 15.2L16.5 8.8" ${line(c, 1.9)}/></svg>`,
  info: (c) => `<svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true" style="flex-shrink:0;margin-top:1px"><circle cx="9" cy="9" r="7.5" fill="none" stroke="${c}" stroke-width="1.5"/><path d="M9 5.2V9.8M9 12.4V12.6" stroke="${c}" stroke-width="1.7" stroke-linecap="round"/></svg>`,
};

const toolbar = (title) => `<!-- navigation layer: glass toolbar (D-096): round back button, centred title -->
  <header class="bar"><button type="button" class="back" aria-label="Back">‹</button><h1>${title}</h1><span aria-hidden="true" style="width:44px;flex-shrink:0"></span></header>`;

const step = (n, title, body, extra) => `<li class="card" style="flex-direction:row;gap:12px"><span class="num" aria-hidden="true">${n}</span><div class="col"><h2 class="h"><span class="sr" style="position:absolute;left:-9999px">Step ${n}: </span>${title}</h2><p class="body">${body}</p>${extra}</div></li>`;
const crumbs = (items) => `<p class="crumbs" aria-label="Where to tap: ${items.map((i) => i.replace(/<[^>]+>/g, '')).join(', then ')}">${items.map((i, n) => n ? `<span style="display:inline-flex;align-items:center;gap:6px">${icon.chev}<span class="chip">${i}</span></span>` : `<span class="chip">${i}</span>`).join('')}</p>`;

/** The guide (Settings > Privacy and data > Import from Clue). `panel` is the result or error panel shown above the steps. */
const guide = (panel = '') => `<main>
    ${panel}
    <p class="lead">Bring your Clue history into Sanguine in four steps. Steps 1 to 3 happen in Clue and your email; step 4 is here.</p>
    <ol class="steps" aria-label="Steps">
      ${step(1, 'Ask Clue for your data', 'In Clue, open More, then Settings, then Download my data.', crumbs(['More', 'Settings', 'Download my data']))}
      ${step(2, 'Note the password', 'Clue shows a password. Write it down or leave that screen open: you type it in step 4. If Clue says your data was already sent, the same password is still on that screen.',
        `<div class="inset">${icon.key('var(--sec)')}<span style="display:flex;flex-direction:column;gap:2px;min-width:0"><span class="sec">Clue's password, for step 4</span><span class="mono" aria-hidden="true">•••• •••• ••••</span></span></div>`)}
      ${step(3, 'Save the file from Clue\'s email', 'Clue emails you a link. Open it on this phone within 72 hours and save the file to Files.',
        crumbs([`${icon.mail('var(--ink)')}Email from Clue`, 'Open the link', `${icon.save('var(--ink)')}Save to Files`])
        + `<div class="inset">${icon.file('var(--sec)')}<span style="display:flex;flex-direction:column;gap:2px;min-width:0"><span class="sec">The file name starts with</span><span class="body" style="overflow-wrap:anywhere">ClueDataDownload</span></span></div>`)}
      ${step(4, 'Choose the file here', 'Sanguine asks for the password, then shows what came across.',
        `<button type="button" class="primary">${icon.folder('#FFFFFF')}Choose the Clue file</button><p class="sec">Days you already logged in Sanguine keep your own entry.</p>`)}
    </ol>
    <p class="sec" style="margin:0 4px">Unzipped it on a computer? Choose measurements.json from the folder instead. It needs no password.</p>
    <article class="card" style="flex-direction:row;align-items:flex-start">${icon.lock('var(--accent)')}<p class="body" style="flex:1">The file is read on this phone. Nothing is sent anywhere, and the password is not kept.</p></article>
  </main>
  ${toolbar('Import from Clue')}`;

const result = `<section role="status" aria-live="polite" class="card" aria-labelledby="res-title">
      <div style="display:flex;gap:10px;align-items:center">${icon.check('var(--ok)')}<h2 id="res-title" class="h">Imported 1,284 records</h2></div>
      <p class="body">Kept your own entry on 6 days where Clue had something different.</p>
      <p class="body">Switched on in Tracking, so they show when you log: bloating, cravings, headache, tender breasts.</p>
      <div style="border-top:1px solid var(--line);padding-top:12px;display:flex;flex-direction:column;gap:8px">
        <h3 class="label">Not imported</h3>
        <ul style="margin:0;padding:0;list-style:none;display:flex;flex-direction:column;gap:4px" class="body">
          <li style="display:flex;justify-content:space-between;gap:12px"><span>Weight</span><span style="color:var(--sec)">× 2</span></li>
          <li style="display:flex;justify-content:space-between;gap:12px"><span>Ovulation test</span><span style="color:var(--sec)">× 3</span></li>
        </ul>
        <p class="sec">These stay in your Clue file.</p>
      </div>
    </section>`;

const cannotOpen = `<div role="alert" class="caution">${icon.info('var(--cauIcon)')}<span style="flex:1;display:flex;flex-direction:column;gap:10px">
      <span class="body" style="font-weight:600">Sanguine cannot open this zip</span>
      <span class="body">Clue locked it with a kind of encryption this app cannot read. On a computer, unzip it with the password, get the file measurements.json onto this phone (by email, for example) and choose it here.</span>
      <button type="button" class="secondary" style="align-self:flex-start;min-height:44px">${icon.file('var(--ink)')}Choose measurements.json</button>
    </span></div>`;

/** The password sheet over the guide, above the system keyboard. */
const sheet = (wrong) => `<div class="scrim" aria-hidden="true"></div>
  <!-- navigation layer: sheet at its form detent, lifted above the keyboard -->
  <section class="sheet" role="dialog" aria-modal="true" aria-labelledby="pw-title" aria-describedby="pw-body">
    <span class="grab" aria-hidden="true"></span>
    <h2 id="pw-title" class="h" style="text-align:center">Type Clue's password</h2>
    <div class="inset" style="padding:8px 12px;background:var(--card);box-shadow:var(--fieldRing)">${icon.file('var(--sec)')}<span class="sec" style="overflow-wrap:anywhere">ClueDataDownload-1798.zip</span></div>
    <p id="pw-body" class="body" style="color:var(--sec)">The one Clue showed on its Download my data screen. You can paste it.</p>
    <label style="display:flex;flex-direction:column;gap:6px">
      <span class="sec" style="margin:0 4px">Password</span>
      <span class="field" aria-invalid="${wrong}"><input ${wrong ? 'type="text" value="Tq8m-V2rL-p4xD" aria-invalid="true" aria-describedby="pw-err"' : 'type="password" placeholder="Paste or type the password"'} autocomplete="off" autocapitalize="none" spellcheck="false" aria-label="Clue's password"><button type="button" class="eye" aria-label="${wrong ? 'Hide password' : 'Show password'}">${icon.eye('var(--sec)', wrong)}</button></span>
    </label>
    ${wrong ? `<p id="pw-err" class="err" role="alert">${icon.info('var(--err)')}<span>That password does not open this file. Compare it with the one on Clue's Download my data screen; capitals count.</span></p>` : ''}
    <div style="display:flex;gap:10px">
      <button type="button" class="secondary" style="flex:1;min-height:52px;border-radius:26px">Cancel</button>
      <button type="button" class="primary" style="flex:1" ${wrong ? '' : 'aria-disabled="true"'}>Open</button>
    </div>
  </section>
  <div class="kb" aria-hidden="true">[System keyboard]</div>`;

const sw = (label, desc, on) => `<div class="row"><span style="flex:1;min-width:0;display:flex;flex-direction:column;gap:2px"><span class="t">${label}</span><span class="sec">${desc}</span></span><button type="button" role="switch" class="switch" aria-checked="${on}" aria-label="${label}"><span></span></button></div>`;
const health = `<main>
    <p class="lead">Choose what to share with Apple Health. Nothing is switched on until you ask, and each type is its own choice.</p>
    <section aria-label="Data types" class="rows">
      ${sw('Period flow', 'Read and write. Sanguine imports periods you logged in Apple Health and writes the ones you log here, so both stay in step.', true)}
      ${sw('Basal body temperature', 'Read and write. Morning temperatures are imported and written in °C.', true)}
      ${sw('Ovulation tests', 'Read and write. Test results are imported and written.', false)}
    </section>
    <p class="sec" style="margin:0 4px">Switching a type off stops syncing. Entries already imported stay in Sanguine.</p>
    <section aria-labelledby="since" style="display:flex;flex-direction:column;gap:8px">
      <h2 id="since" class="sec" style="margin:0 4px;font-weight:600">Import from</h2>
      <div role="group" aria-label="Import from" class="pills">
        <button type="button" class="pill" aria-pressed="false">30 days</button><button type="button" class="pill" aria-pressed="false">1 year</button><button type="button" class="pill" aria-pressed="false">2 years</button><button type="button" class="pill" aria-pressed="true">All history</button>
      </div>
      <p class="sec" style="margin:0 4px">Applies the next time you switch a type on.</p>
      <div class="inset" style="align-items:flex-start;margin-top:4px">${icon.info('var(--sec)')}<p class="sec" style="color:var(--ink)">Coming from Flo or Natural Cycles? Both can share their data with Apple Health. Choose All history and it comes across from there.</p></div>
    </section>
    <p class="sec" style="margin:0 4px">Anything written to Apple Health is governed by its privacy rules and is visible to other apps you have allowed.</p>
  </main>
  ${toolbar('Health sync')}`;

export const frames = [
  ['Guide-Light', 'Import from Clue: the guide, light', '', guide()],
  ['Guide-Dark', 'Import from Clue: the guide, dark', 'dark', guide()],
  ['Guide-Light-150', 'Import from Clue: the guide, light, text at 150%', 'big', guide()],
  ['Password-Sheet-Empty', 'Import from Clue: password sheet, empty (Open not yet available)', 'fixed', `<div inert aria-hidden="true">${guide()}</div>${sheet(false)}`],
  ['Password-Sheet-Wrong', 'Import from Clue: password sheet, wrong password, shown in plain text', 'fixed', `<div inert aria-hidden="true">${guide()}</div>${sheet(true)}`],
  ['Result', 'Import from Clue: after an import, the result panel', 'fixed', guide(result)],
  ['Cannot-Open', 'Import from Clue: the zip uses an encryption the app cannot open', 'fixed', guide(cannotOpen)],
  ['Health-All-History', 'Settings: Health sync, the All history window (rows trimmed to three)', '', health],
];

mkdirSync(out, { recursive: true });
for (const [file, title, cls, body] of frames) {
  writeFileSync(join(out, `${file}.html`), `<!doctype html>
<html lang="en-AU">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<style>${css}</style>
</head>
<body>
<div class="phone ${cls}">
  ${body}
</div>
</body>
</html>
`);
}
