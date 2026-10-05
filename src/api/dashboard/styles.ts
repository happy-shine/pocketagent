// Stylesheet for the dashboard. Plain CSS in a string; it must not contain backticks.
export const DASHBOARD_CSS = `
:root{--sans:-apple-system,BlinkMacSystemFont,"SF Pro Text","PingFang SC","Hiragino Sans GB","Segoe UI","Microsoft YaHei",sans-serif;--mono:"SF Mono",ui-monospace,"JetBrains Mono",Menlo,Consolas,monospace;
  --bg:#F4F3EF;--surface:#FFFFFF;--surface-2:#FAF9F6;--sunken:#F1EFEA;--hover:rgba(27,26,23,.045);--line:#E7E4DD;--line-2:#D7D3CA;--ink:#1B1A17;--ink-2:#55524B;--ink-3:#8E897F;--ink-4:#BAB5AB;
  --brand:#E8641B;--brand-ink:#B5480C;--brand-soft:#FDEEE3;
  --ok:#17834A;--ok-soft:#E4F3EA;--warn:#946000;--warn-soft:#FBF0D3;--warn-dot:#E0A01A;--err:#C93434;--err-soft:#FBE8E6;--run:#2160D8;--run-soft:#E6EEFC;--mute-soft:#EFEDE8;
  --e-claude:#D97757;--e-codex:#0F9D76;--e-agy:#3F7FEA;--e-grok:#57534B;
  --term:#17160F;--term-ink:#D9D6CC;--term-dim:#8C887C;
  --sh-1:0 1px 2px rgba(27,26,23,.05);--sh-2:0 1px 2px rgba(27,26,23,.04),0 8px 24px -6px rgba(27,26,23,.10);--sh-3:0 24px 60px -12px rgba(27,26,23,.30),0 0 0 1px rgba(27,26,23,.06);
  color-scheme:light}
[data-theme=dark]{--bg:#111110;--surface:#191918;--surface-2:#1E1E1C;--sunken:#141413;--hover:rgba(255,255,255,.05);--line:#2A2927;--line-2:#3A3835;--ink:#EDECE7;--ink-2:#B4B1A9;--ink-3:#7F7C75;--ink-4:#5C5A55;
  --brand:#F0782F;--brand-ink:#FF9D60;--brand-soft:rgba(240,120,47,.15);
  --ok:#47C584;--ok-soft:rgba(71,197,132,.13);--warn:#E8AE45;--warn-soft:rgba(232,174,69,.13);--warn-dot:#E8AE45;--err:#F26B6B;--err-soft:rgba(242,107,107,.13);--run:#6E9DF3;--run-soft:rgba(110,157,243,.14);--mute-soft:rgba(255,255,255,.06);
  --e-grok:#B4B1A9;--term:#0B0B0A;
  --sh-1:0 1px 2px rgba(0,0,0,.35);--sh-2:0 1px 2px rgba(0,0,0,.3),0 8px 24px -6px rgba(0,0,0,.5);--sh-3:0 30px 70px -10px rgba(0,0,0,.75),0 0 0 1px rgba(255,255,255,.07);
  color-scheme:dark}
*{box-sizing:border-box}
html,body{margin:0;height:100%}
body{background:var(--bg);color:var(--ink);font:13px/1.5 var(--sans);-webkit-font-smoothing:antialiased;overflow:hidden}
a{color:inherit;text-decoration:none;cursor:pointer}
button{font-family:inherit;color:inherit}
svg.i{width:16px;height:16px;flex:none;fill:none;stroke:currentColor;stroke-width:1.75;stroke-linecap:round;stroke-linejoin:round}
::selection{background:var(--brand-soft)}
*::-webkit-scrollbar{width:10px;height:10px}
*::-webkit-scrollbar-thumb{background:var(--line-2);border-radius:10px;border:3px solid transparent;background-clip:content-box}
*::-webkit-scrollbar-track{background:transparent}

/* shell */
#app{display:grid;grid-template-columns:224px minmax(0,1fr);height:100vh}
.side{display:flex;flex-direction:column;padding:12px 10px 10px;min-height:0;overflow:hidden}
.brand{display:flex;align-items:center;gap:10px;padding:4px 8px 12px}
.logo{width:28px;height:28px;border-radius:8px;background:var(--brand);display:grid;place-items:center;color:#fff;box-shadow:inset 0 -2px 0 rgba(0,0,0,.14);flex:none}
.logo .i{width:17px;height:17px;stroke-width:2}
.bn{font-weight:650;font-size:13.5px;letter-spacing:-.01em;line-height:1.2}
.bs{font:11px var(--mono);color:var(--ink-3)}
.sbtn{display:flex;align-items:center;gap:8px;height:30px;padding:0 6px 0 9px;border:1px solid var(--line);background:var(--surface);border-radius:7px;color:var(--ink-3);font:12.5px var(--sans);margin:0 2px 6px;box-shadow:var(--sh-1);cursor:pointer;text-align:left}
.sbtn:hover{border-color:var(--line-2)}
.sbtn .i{width:14px;height:14px}
.sbtn .kbd{margin-left:auto}
.nav{overflow:auto;min-height:0;flex:1}
.ng{margin-top:10px}
.ng-t{font-size:11px;font-weight:600;color:var(--ink-3);padding:4px 10px;letter-spacing:.04em}
.ni{display:flex;align-items:center;gap:9px;height:30px;padding:0 8px 0 10px;border-radius:7px;color:var(--ink-2);font-weight:500;margin:1px 0;user-select:none}
.ni:hover{background:var(--hover);color:var(--ink)}
.ni .i{width:16px;height:16px;color:var(--ink-3)}
.ni.on{background:var(--surface);color:var(--ink);box-shadow:var(--sh-1),0 0 0 1px var(--line)}
.ni.on .i{color:var(--brand)}
.ni span:not(.nb){white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.nb{margin-left:auto;display:inline-flex;align-items:center;gap:4px;height:18px;min-width:18px;justify-content:center;padding:0 6px;border-radius:999px;font-size:11px;font-weight:600;font-variant-numeric:tabular-nums}
.nb.err{background:var(--err-soft);color:var(--err)}
.nb.warn{background:var(--warn-soft);color:var(--warn)}
.nb.run{background:var(--run-soft);color:var(--run)}
.nb.run::before{content:"";width:6px;height:6px;border-radius:50%;background:currentColor;animation:blink 1.4s ease-in-out infinite}
.nb.dirty{background:var(--brand-soft);color:var(--brand-ink)}
@keyframes blink{50%{opacity:.25}}
.side-foot{padding:10px 6px 0;border-top:1px solid var(--line);margin-top:8px}
.hl{display:flex;align-items:center;gap:7px;font-size:12.5px;font-weight:550;padding:0 4px}
.hl .muted{font-weight:400}
.hs{font:11px var(--mono);color:var(--ink-3);padding:2px 4px 10px 18px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.fr{display:flex;gap:6px}
.fr .seg{flex:1;display:flex}
.fr .seg button{flex:1;justify-content:center;padding:0 6px}
.fr .seg .i{width:14px;height:14px}

.main{margin:8px 8px 8px 0;background:var(--surface);border:1px solid var(--line);border-radius:12px;display:flex;flex-direction:column;min-width:0;min-height:0;overflow:hidden;position:relative;box-shadow:var(--sh-1)}
.top{height:48px;flex:none;display:flex;align-items:center;gap:12px;padding:0 14px 0 22px;border-bottom:1px solid var(--line)}
.crumb{display:flex;gap:7px;align-items:center;color:var(--ink-3);font-size:13px;min-width:0;white-space:nowrap}
.crumb b{color:var(--ink);font-weight:600;overflow:hidden;text-overflow:ellipsis}
.crumb i{font-style:normal;color:var(--ink-4)}
.top-r{margin-left:auto;display:flex;align-items:center;gap:6px;flex:none}
.sync{font-size:12px;color:var(--ink-3);display:flex;align-items:center;gap:7px;padding:4px 8px;border-radius:6px;cursor:pointer;border:0;background:transparent}
.sync:hover{background:var(--hover)}
.body{flex:1;min-height:0;overflow:hidden;position:relative}
.page{padding:22px 28px 40px;height:100%;overflow:auto}
.page.fill{display:flex;flex-direction:column;padding-bottom:22px}
.page.narrow>*{max-width:980px}
.ph{display:flex;align-items:flex-end;gap:16px;margin-bottom:18px}
.ph h1{font-size:20px;font-weight:650;letter-spacing:-.015em;margin:0;line-height:1.3}
.ph p{margin:3px 0 0;color:var(--ink-3);font-size:13px;max-width:760px}
.ph .act{margin-left:auto;display:flex;gap:8px;flex:none}

/* components */
.btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;height:30px;padding:0 12px;border-radius:7px;border:1px solid transparent;font:500 12.5px/1 var(--sans);color:var(--ink);background:transparent;cursor:pointer;white-space:nowrap;flex:none;transition:background .12s,border-color .12s,opacity .12s}
.btn .i{width:15px;height:15px}
.btn.primary{background:var(--ink);color:var(--surface);box-shadow:var(--sh-1)}
.btn.primary:hover{opacity:.88}
.btn.outline{background:var(--surface);border-color:var(--line-2);box-shadow:var(--sh-1)}
.btn.outline:hover{background:var(--surface-2);border-color:var(--ink-4)}
.btn.ghost{color:var(--ink-2)}
.btn.ghost:hover{background:var(--hover);color:var(--ink)}
.btn.brand{background:var(--brand);color:#fff;box-shadow:inset 0 -1px 0 rgba(0,0,0,.15)}
.btn.brand:hover{filter:brightness(1.05)}
.btn.danger{color:var(--err)}
.btn.danger:hover{background:var(--err-soft);color:var(--err)}
.btn.outline.danger{border-color:color-mix(in srgb,var(--err) 30%,var(--line-2))}
.btn.primary.danger{background:var(--err);color:#fff}
.btn.sm{height:26px;padding:0 9px;font-size:12px;border-radius:6px}
.btn.sm .i{width:14px;height:14px}
.btn.xs{height:22px;padding:0 6px;font-size:11.5px;border-radius:5px}
.btn.xs .i{width:13px;height:13px}
.btn.icon{width:30px;padding:0}.btn.icon.sm{width:26px}.btn.icon.xs{width:22px}
.btn[disabled]{opacity:.42;pointer-events:none}
.kbd{display:inline-flex;align-items:center;height:18px;padding:0 5px;border-radius:4px;border:1px solid var(--line-2);border-bottom-width:2px;font:500 10.5px/1 var(--mono);color:var(--ink-3);background:var(--surface)}
.dot{width:7px;height:7px;border-radius:50%;background:var(--ink-4);display:inline-block;flex:none}
.dot.ok{background:var(--ok)}.dot.err{background:var(--err)}.dot.warn{background:var(--warn-dot)}.dot.run{background:var(--run)}
.dot.pulse{box-shadow:0 0 0 3px color-mix(in srgb,var(--ok) 20%,transparent)}
.dot.err.pulse{box-shadow:0 0 0 3px color-mix(in srgb,var(--err) 20%,transparent)}
.pill{display:inline-flex;align-items:center;gap:5px;height:20px;padding:0 7px 0 6px;border-radius:999px;font-size:11.5px;font-weight:560;background:var(--mute-soft);color:var(--ink-2);white-space:nowrap;flex:none}
.pill::before{content:"";width:6px;height:6px;border-radius:50%;background:currentColor}
.pill.ok{background:var(--ok-soft);color:var(--ok)}.pill.err{background:var(--err-soft);color:var(--err)}.pill.warn{background:var(--warn-soft);color:var(--warn)}.pill.run{background:var(--run-soft);color:var(--run)}.pill.brand{background:var(--brand-soft);color:var(--brand-ink)}
.pill.silent::before{background:transparent;box-shadow:inset 0 0 0 1.5px currentColor}
.pill.run::before{animation:blink 1.4s infinite}
.pill.nodot::before{display:none}
.pill.nodot{padding:0 7px}
.chip{display:inline-flex;align-items:center;gap:4px;height:20px;padding:0 7px;border-radius:5px;background:var(--sunken);border:1px solid var(--line);font-size:11.5px;color:var(--ink-2);white-space:nowrap;flex:none;max-width:100%;overflow:hidden;text-overflow:ellipsis}
.chip .i{width:12px;height:12px}
.chip.sm{height:17px;font-size:10.5px;padding:0 5px}
.eng{display:inline-flex;align-items:center;gap:5px;font-size:12px;font-weight:560;color:var(--ink-2);white-space:nowrap;flex:none}
.eng::before{content:"";width:8px;height:8px;border-radius:2.5px;background:var(--ec,var(--ink-4))}
.eng.claude{--ec:var(--e-claude)}.eng.codex{--ec:var(--e-codex)}.eng.agy{--ec:var(--e-agy)}.eng.grok{--ec:var(--e-grok)}
.chn{width:16px;height:16px;flex:none}
.mono{font-family:var(--mono);font-size:11.5px}
.muted{color:var(--ink-3)}
.tnum{font-variant-numeric:tabular-nums}
.ell{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0}
.input,.app-input{display:flex;align-items:center;gap:7px;height:30px;padding:0 10px;border:1px solid var(--line-2);border-radius:7px;background:var(--surface);color:var(--ink);font:12.5px var(--sans);min-width:0;box-shadow:var(--sh-1);outline:none;width:100%}
.input .i{width:14px;height:14px;color:var(--ink-3)}
.input input{border:0;outline:0;background:transparent;font:inherit;color:inherit;flex:1;min-width:0;height:100%;padding:0}
.input:focus-within,.app-input:focus{border-color:var(--brand);box-shadow:0 0 0 3px color-mix(in srgb,var(--brand) 18%,transparent)}
.input.sm{height:28px}
input.app-input::placeholder,textarea.app-input::placeholder,.input input::placeholder{color:var(--ink-4)}
select.app-input{appearance:none;-webkit-appearance:none;padding-right:28px;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 24 24' fill='none' stroke='%238E897F' stroke-width='3' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 10px center;cursor:pointer}
select.app-input.sm{height:28px;font-size:12px}
textarea.app-input{height:auto;min-height:80px;padding:8px 10px;line-height:1.55;resize:vertical;display:block}
textarea.code,input.code{font:12px/1.65 var(--mono)}
input.app-input[type=number]{font-variant-numeric:tabular-nums}
.seg{display:inline-flex;padding:2px;gap:2px;background:var(--sunken);border:1px solid var(--line);border-radius:8px;flex:none}
.seg button{border:0;background:transparent;height:24px;padding:0 10px;border-radius:6px;font:500 12px var(--sans);color:var(--ink-2);display:inline-flex;align-items:center;gap:6px;cursor:pointer;white-space:nowrap}
.seg button:hover{color:var(--ink)}
.seg button i{font-style:normal;font-size:11px;color:var(--ink-3);font-variant-numeric:tabular-nums}
.seg button.on{background:var(--surface);color:var(--ink);box-shadow:var(--sh-1),0 0 0 1px var(--line)}
.seg button.err i{color:var(--err);font-weight:600}
.seg button.warn i{color:var(--warn);font-weight:600}
.seg.sm button{height:22px;padding:0 8px;font-size:11.5px}
.seg.full{display:flex}
.seg.full button{flex:1;justify-content:center}
.sw{width:28px;height:16px;border-radius:999px;background:var(--line-2);position:relative;flex:none;display:inline-block;cursor:pointer;border:0;padding:0;transition:background .15s}
.sw::after{content:"";position:absolute;top:2px;left:2px;width:12px;height:12px;border-radius:50%;background:#fff;box-shadow:0 1px 2px rgba(0,0,0,.25);transition:left .15s}
.sw.on{background:var(--brand)}.sw.on::after{left:14px}
.card{background:var(--surface);border:1px solid var(--line);border-radius:10px;min-width:0}
.card-h{display:flex;align-items:center;gap:8px;padding:11px 14px;border-bottom:1px solid var(--line)}
.card-h h3{margin:0;font-size:13px;font-weight:600}
.card-h .r{margin-left:auto;display:flex;gap:6px;align-items:center}
.card-b{padding:14px 16px}
.sec-h{display:flex;align-items:center;gap:8px;margin:0 0 10px}
.sec-h h3{margin:0;font-size:13px;font-weight:600}
.sec-h p{margin:0;color:var(--ink-3);font-size:12px}
.sec-h .r{margin-left:auto;display:flex;gap:8px;align-items:center}
.sec{margin-bottom:26px}
.cnt{display:inline-flex;align-items:center;justify-content:center;min-width:18px;height:18px;padding:0 5px;border-radius:999px;background:var(--sunken);border:1px solid var(--line);font-size:11px;color:var(--ink-2);font-weight:600}
.lbl{font-size:12px;font-weight:550;color:var(--ink-2);margin-bottom:6px;display:flex;align-items:center;gap:6px}
.lbl .muted{font-weight:400}
.hint{font-size:11.5px;color:var(--ink-3);margin-top:5px;line-height:1.5}
.fld{margin-bottom:14px;min-width:0}
.fld.mod .lbl::after{content:attr(data-mod);font-size:10.5px;font-weight:600;color:var(--brand-ink);background:var(--brand-soft);padding:0 5px;border-radius:4px;line-height:16px}
.fld.mod .app-input{border-color:color-mix(in srgb,var(--brand) 55%,var(--line-2))}
.g2{display:grid;grid-template-columns:1fr 1fr;gap:0 12px}
.g3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:0 12px}
.g4{display:grid;grid-template-columns:repeat(4,1fr);gap:0 12px}
.unit{display:flex}
.unit .app-input{border-radius:7px 0 0 7px}
.unit span{display:flex;align-items:center;padding:0 10px;border:1px solid var(--line-2);border-left:0;border-radius:0 7px 7px 0;background:var(--sunken);color:var(--ink-3);font-size:12px;white-space:nowrap}
.tabs{display:flex;gap:18px;border-bottom:1px solid var(--line)}
.tabs a{padding:8px 0 9px;font-size:12.5px;font-weight:550;color:var(--ink-3);display:flex;gap:6px;align-items:center;margin-bottom:-1px}
.tabs a:hover{color:var(--ink)}
.tabs a i{font-style:normal;font-size:11px;color:var(--ink-3);font-weight:500}
.tabs a.on{color:var(--ink);box-shadow:inset 0 -2px 0 var(--ink)}
.spin{width:14px;height:14px;border-radius:50%;border:2px solid var(--run-soft);border-top-color:var(--run);animation:spin .8s linear infinite;flex:none;display:inline-block}
@keyframes spin{to{transform:rotate(360deg)}}
.av{width:28px;height:28px;border-radius:50%;display:grid;place-items:center;font-size:12px;font-weight:650;color:#fff;flex:none;background:hsl(var(--h,200) 45% 52%)}
.av.bot{border-radius:8px;background:var(--brand)}
.av.bot .i{width:16px;height:16px;stroke-width:2}
.empty{padding:40px 20px;text-align:center;color:var(--ink-3);font-size:13px}
.empty b{display:block;color:var(--ink-2);font-size:13.5px;margin-bottom:4px;font-weight:600}
.empty .btn{margin-top:12px}
.empty-s{font-size:12px;color:var(--ink-3)}
.tags{display:flex;flex-wrap:wrap;gap:5px;padding:4px 5px;border:1px solid var(--line-2);border-radius:7px;min-height:32px;align-items:center;background:var(--surface)}
.tags:focus-within{border-color:var(--brand);box-shadow:0 0 0 3px color-mix(in srgb,var(--brand) 18%,transparent)}
.tags .chip{background:var(--surface-2);font-family:var(--mono);font-size:11px}
.tags .chip button{border:0;background:transparent;color:var(--ink-4);cursor:pointer;padding:0 0 0 2px;font-size:13px;line-height:1}
.tags .chip button:hover{color:var(--err)}
.tags input{border:0;outline:0;background:transparent;font:12px var(--mono);color:var(--ink);flex:1;min-width:120px;height:22px}
.kv{display:grid;grid-template-columns:76px minmax(0,1fr);gap:7px 10px;margin:0;font-size:12.5px}
.kv dt{color:var(--ink-3)}
.kv dd{margin:0;display:flex;align-items:center;gap:6px;min-width:0;flex-wrap:wrap}
.kv .i{width:13px;height:13px;color:var(--ink-3)}
.copy{border:0;background:transparent;color:var(--ink-3);cursor:pointer;padding:2px;border-radius:4px;display:inline-flex}
.copy:hover{color:var(--ink);background:var(--hover)}
.copy .i{width:13px;height:13px}
.errbox,.note{border-radius:7px;padding:8px 10px;font-size:12px;display:flex;gap:8px;margin-bottom:10px;line-height:1.5}
.errbox{background:var(--err-soft);color:var(--err)}
.note{background:var(--sunken);color:var(--ink-2);border:1px solid var(--line)}
.note.warn{background:var(--warn-soft);color:var(--warn);border-color:transparent}
.errbox .i,.note .i{width:14px;height:14px;margin-top:2px}
.st-ic{width:18px;height:18px;border-radius:50%;display:grid;place-items:center;flex:none}
.st-ic .i{width:11px;height:11px;stroke-width:2.6}
.st-ic.ok{background:var(--ok-soft);color:var(--ok)}.st-ic.err{background:var(--err-soft);color:var(--err)}.st-ic.warn{background:var(--warn-soft);color:var(--warn)}.st-ic.mute{background:var(--mute-soft);color:var(--ink-3)}.st-ic.q{box-shadow:inset 0 0 0 1.5px var(--ink-4)}

/* markdown */
.md{font-size:13px;line-height:1.65;color:var(--ink);overflow-wrap:anywhere}
.md h1,.md h2,.md h3,.md h4,.md h5,.md h6{margin:10px 0 4px;font-weight:650;line-height:1.35}
.md h1{font-size:16px}.md h2{font-size:15px}.md h3{font-size:14px}.md h4,.md h5,.md h6{font-size:13px}
.md>:first-child{margin-top:0}
.md p{margin:4px 0}
.md strong{font-weight:620}
.md code{font:12px var(--mono);background:var(--sunken);border:1px solid var(--line);border-radius:4px;padding:0 4px}
.md pre{background:var(--sunken);border:1px solid var(--line);border-radius:7px;padding:10px 12px;overflow:auto;margin:6px 0}
.md pre code{border:0;padding:0;background:none;font-size:12px;line-height:1.55}
.md blockquote{margin:6px 0;padding:2px 10px;border-left:3px solid var(--line-2);color:var(--ink-2)}
.md a{color:var(--run);text-decoration:underline;text-underline-offset:2px}
.md hr{border:0;border-top:1px solid var(--line);margin:10px 0}
.md table{border-collapse:collapse;margin:6px 0;font-size:12.5px;display:block;overflow:auto}
.md th,.md td{border:1px solid var(--line);padding:4px 8px;text-align:left}
.md th{background:var(--sunken);font-weight:600}
.md-list{margin:4px 0}
.md-li{display:flex;gap:7px;margin:2px 0}
.md-marker{color:var(--ink-3);flex:none;min-width:10px}
.md-small{font-size:11.5px;color:var(--ink-3)}
.md .tg{white-space:pre-wrap}
.md .tg blockquote{white-space:pre-wrap}
.md .spoiler{background:var(--ink-4);color:transparent;border-radius:3px;transition:color .2s}
.md .spoiler:hover{color:inherit;background:var(--sunken)}
.idt{font-family:var(--mono);font-size:.92em}
pre.raw{font:12px/1.6 var(--mono);white-space:pre-wrap;word-break:break-word;margin:0;color:var(--ink-2)}

/* overview */
.attn{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:12px;margin-bottom:22px}
.ac{display:flex;gap:12px;padding:13px 14px;border:1px solid var(--line);border-radius:10px;background:var(--surface);position:relative;overflow:hidden;align-items:flex-start}
.ac::before{content:"";position:absolute;left:0;top:0;bottom:0;width:3px;background:var(--c)}
.ac.warn{--c:var(--warn-dot);--cs:var(--warn-soft);--ci:var(--warn)}.ac.err{--c:var(--err);--cs:var(--err-soft);--ci:var(--err)}
.ac-ic{width:30px;height:30px;border-radius:8px;background:var(--cs);color:var(--ci);display:grid;place-items:center;flex:none}
.ac-b{flex:1;min-width:0}
.ac-k{font-size:11.5px;color:var(--ci);font-weight:600}
.ac-t{font-size:13px;font-weight:600;margin:1px 0 2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ac-d{font-size:12px;color:var(--ink-2);overflow:hidden;text-overflow:ellipsis;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}
.ac-a{display:flex;gap:6px;margin-top:10px;align-items:center}
.allok{display:flex;align-items:center;gap:10px;padding:12px 14px;border:1px solid var(--line);border-radius:10px;margin-bottom:22px;color:var(--ink-2)}
.allok .st-ic{width:22px;height:22px}
.code6{font:600 13px var(--mono);letter-spacing:.12em;background:var(--sunken);border:1px solid var(--line);border-radius:5px;padding:1px 6px}
.stats{display:grid;grid-template-columns:repeat(4,1fr);border:1px solid var(--line);border-radius:10px;margin-bottom:22px}
.st{padding:13px 16px;min-width:0}
.st+.st{border-left:1px solid var(--line)}
.st-l{font-size:12px;color:var(--ink-3)}
.st-v{font-size:24px;font-weight:650;letter-spacing:-.02em;margin:3px 0 1px;font-variant-numeric:tabular-nums;display:flex;align-items:baseline;gap:6px}
.st-v small{font-size:13px;font-weight:500;color:var(--ink-3);letter-spacing:0}
.st-s{font-size:12px;color:var(--ink-3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ovg{display:grid;grid-template-columns:minmax(0,1fr) 372px;gap:16px;align-items:start}
.ovr{display:flex;flex-direction:column;gap:16px;min-width:0}
.cr{display:flex;align-items:center;gap:11px;padding:10px 14px;border-top:1px solid var(--line)}
.cr:hover{background:var(--surface-2)}
.cr:first-child{border-top:0}
.cr-b{flex:1;min-width:0}
.cr-t{display:flex;align-items:center;gap:8px;font-size:13px;min-width:0}
.cr-t b{font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.cr-p{font-size:12.5px;color:var(--ink-2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:1px;min-height:19px}
.cr-p .who{color:var(--ink-3)}
.cr-time{font-size:12px;color:var(--ink-3);flex:none;align-self:flex-start;padding-top:1px}
.up{display:grid;grid-template-columns:62px 10px minmax(0,1fr);gap:0 10px;padding:8px 14px;align-items:start}
.up:hover{background:var(--surface-2)}
.up-t{font-size:12px;color:var(--ink-2);font-variant-numeric:tabular-nums;text-align:right;padding-top:1px}
.up-t small{display:block;font-size:11px;color:var(--ink-3)}
.up-l{position:relative;height:100%;display:flex;justify-content:center;padding-top:6px}
.up-l::after{content:"";position:absolute;top:16px;bottom:-12px;width:1px;background:var(--line)}
.up:last-child .up-l::after{display:none}
.up-n{font-size:12.5px;font-weight:550;min-width:0}
.up-n b{font-weight:550;display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.up-n span{display:block;font-size:11.5px;color:var(--ink-3);font-weight:400;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.br{display:flex;align-items:center;gap:10px;padding:8px 14px;border-top:1px solid var(--line)}
.br:first-child{border-top:0}
.br:hover{background:var(--surface-2)}
.br b{font-weight:600;font-size:12.5px}
.br .r{margin-left:auto;display:flex;align-items:center;gap:8px}
.egrid{display:grid;grid-template-columns:1fr 1fr}
.et{padding:10px 14px;border-top:1px solid var(--line)}
.et:nth-child(odd){border-right:1px solid var(--line)}
.et:nth-child(-n+2){border-top:0}
.et .eng{font-size:12.5px;color:var(--ink)}
.et div{font-size:11.5px;color:var(--ink-3);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}

/* sessions */
.ses{display:grid;grid-template-columns:316px minmax(0,1fr) 296px;height:100%}
.ses.norail{grid-template-columns:316px minmax(0,1fr)}
.sl{border-right:1px solid var(--line);display:flex;flex-direction:column;min-height:0;background:var(--surface-2)}
.sl-h{padding:14px 14px 10px;display:flex;align-items:center;gap:8px}
.sl-h h2{margin:0;font-size:15px;font-weight:650}
.sl-f{padding:0 14px 10px;display:flex;flex-direction:column;gap:8px;border-bottom:1px solid var(--line)}
.sl-f .row{display:flex;gap:6px;align-items:center}
.sl-items{flex:1;overflow:auto;padding:4px 8px 10px}
.sl-g{font-size:11px;font-weight:600;color:var(--ink-3);padding:10px 8px 4px;letter-spacing:.04em}
.si{display:grid;grid-template-columns:18px minmax(0,1fr) auto;gap:2px 9px;padding:9px 10px;border-radius:8px;align-items:start;margin-bottom:1px}
.si:hover{background:var(--hover)}
.si .chn{margin-top:1px}
.si-t{font-size:13px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;display:flex;align-items:center;gap:6px;min-width:0}
.si-t .id{font:500 12px var(--mono);color:var(--ink-2)}
.si-time{font-size:11.5px;color:var(--ink-3);white-space:nowrap}
.si-m{grid-column:2/4;display:flex;align-items:center;gap:7px;font-size:11.5px;color:var(--ink-3);white-space:nowrap;overflow:hidden;min-width:0}
.si-m .eng{font-size:11.5px}
.si.on{background:var(--surface);box-shadow:var(--sh-1),0 0 0 1px var(--line)}
.si .ns{margin-left:auto;font-size:11px}
.sl-foot{border-top:1px solid var(--line);padding:9px 16px;font-size:11.5px;color:var(--ink-3);display:flex;align-items:center;gap:6px}
.sl-foot .i{width:13px;height:13px}
.sl-foot a:hover{color:var(--ink)}
.conv{display:flex;flex-direction:column;min-width:0;min-height:0}
.cvh{padding:14px 22px 0;border-bottom:1px solid var(--line)}
.cvh-1{display:flex;align-items:center;gap:9px;min-width:0}
.cvh-1 h2{margin:0;font-size:16px;font-weight:650;letter-spacing:-.01em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.cvh-1 .chn{width:20px;height:20px}
.cvh-1 .r{margin-left:auto;display:flex;gap:6px;flex:none}
.cvh-2{font-size:12px;color:var(--ink-3);margin:3px 0 12px 29px;display:flex;align-items:center;gap:6px;flex-wrap:wrap}
.sess{display:flex;gap:6px;align-items:center;padding-bottom:12px;flex-wrap:wrap}
.sb{display:inline-flex;align-items:center;gap:7px;height:28px;padding:0 10px;border-radius:7px;border:1px solid var(--line);background:var(--surface);font-size:12px;font-weight:550;color:var(--ink-2);white-space:nowrap;cursor:pointer}
.sb:hover{border-color:var(--line-2);color:var(--ink)}
.sb .muted{font-weight:400}
.sb.on{border-color:var(--ink);color:var(--ink);box-shadow:0 0 0 1px var(--ink)}
.sb .i{width:13px;height:13px}
.menu-wrap{position:relative;display:inline-flex}
.menu{position:absolute;top:calc(100% + 4px);left:0;z-index:40;min-width:220px;max-height:340px;overflow:auto;background:var(--surface);border:1px solid var(--line);border-radius:10px;box-shadow:var(--sh-3);padding:4px}
.menu.right{left:auto;right:0}
.menu a,.menu button{display:flex;align-items:center;gap:8px;width:100%;padding:7px 10px;border-radius:6px;font-size:12.5px;border:0;background:transparent;cursor:pointer;text-align:left;color:var(--ink)}
.menu a:hover,.menu button:hover{background:var(--hover)}
.menu .i{width:14px;height:14px;color:var(--ink-3)}
.menu .danger{color:var(--err)}
.menu .danger .i{color:var(--err)}
.menu .sep{height:1px;background:var(--line);margin:4px 0}
.msgs{flex:1;overflow:auto;padding:6px 22px 20px;display:flex;flex-direction:column;gap:16px}
.day{display:flex;align-items:center;gap:10px;font-size:11.5px;color:var(--ink-3);margin-top:8px}
.day::before,.day::after{content:"";flex:1;height:1px;background:var(--line)}
.sys{display:flex;justify-content:center}
.sys span{display:inline-flex;align-items:center;gap:6px;font-size:11.5px;color:var(--ink-2);background:var(--sunken);border:1px solid var(--line);border-radius:999px;padding:3px 10px}
.sys .i{width:13px;height:13px;color:var(--ink-3)}
.msg{display:flex;gap:11px;max-width:820px}
.mb{flex:1;min-width:0}
.mh{display:flex;align-items:center;gap:8px;font-size:12px;color:var(--ink-3);margin-bottom:3px}
.mh b{color:var(--ink);font-size:12.5px;font-weight:600}
.reply{display:flex;align-items:center;gap:6px;font-size:11.5px;color:var(--ink-3);border-left:2px solid var(--line-2);padding:1px 0 1px 8px;margin:2px 0 5px;min-width:0}
.reply .i{width:12px;height:12px;flex:none}
.reply span{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.mt{font-size:13px;line-height:1.6;white-space:pre-wrap;overflow-wrap:anywhere}
.msg.a .mbody{background:var(--surface-2);border:1px solid var(--line);border-radius:4px 10px 10px 10px;padding:9px 13px}
.comp{border-top:1px solid var(--line);padding:10px 22px 12px;display:flex;gap:8px;align-items:center}
.comp .app-input{flex:1;height:34px}
.rail{border-left:1px solid var(--line);overflow:auto;background:var(--surface)}
.rs{padding:12px 18px;border-bottom:1px solid var(--line)}
.rs-h{display:flex;align-items:center;gap:7px;font-size:12px;font-weight:600;color:var(--ink);margin-bottom:9px}
.rs-h .r{margin-left:auto;display:flex;gap:4px;align-items:center}
.rs-h .muted{font-weight:400}
.fl{display:flex;align-items:center;gap:8px;padding:5px 8px;border-radius:6px;font-size:12.5px;margin:0 -8px;min-width:0}
.fl:hover{background:var(--hover)}
.fl .i{width:14px;height:14px;color:var(--ink-3)}
.fl b{font-weight:400;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0}
.fl span{margin-left:auto;font-size:11.5px;color:var(--ink-3);flex:none}
.rel{display:flex;align-items:center;gap:8px;padding:8px 10px;border:1px solid var(--line);border-radius:8px;font-size:12.5px;margin-bottom:6px;min-width:0}
.rel:hover{border-color:var(--line-2);background:var(--surface-2)}
.rel .i{width:14px;height:14px;color:var(--ink-3)}
.rel b{font-weight:600;display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.rel .r{margin-left:auto}

/* tables */
.tb{display:flex;gap:8px;align-items:center;margin-bottom:14px;flex-wrap:wrap}
.tb .input{width:240px}
.tb select.app-input{width:auto;min-width:140px}
.tb .tz{margin-left:auto;font-size:12px;color:var(--ink-3);display:flex;align-items:center;gap:6px}
.tb .tz .i{width:14px;height:14px}
.split{display:grid;grid-template-columns:minmax(0,1fr) 460px;gap:16px;flex:1;min-height:0}
.tbl{overflow:auto;min-height:0}
.th,.tr{display:grid;gap:12px;align-items:center;padding:0 12px 0 14px}
.th{height:36px;font-size:11.5px;color:var(--ink-3);font-weight:550;border-bottom:1px solid var(--line);position:sticky;top:0;background:var(--surface);z-index:1}
.tr{min-height:58px;border-bottom:1px solid var(--line);position:relative;cursor:pointer;padding-top:6px;padding-bottom:6px}
.tr:hover{background:var(--surface-2)}
.tr:last-child{border-bottom:0}
.tr.sel{background:var(--brand-soft)}
.tr.sel::before{content:"";position:absolute;left:0;top:0;bottom:0;width:3px;background:var(--brand)}
.tr.off{color:var(--ink-3)}
.cron-t .th,.cron-t .tr{grid-template-columns:40px minmax(0,1.7fr) minmax(0,1fr) 112px minmax(0,1.15fr)}
.c2{display:flex;flex-direction:column;min-width:0;gap:1px}
.c2 b{font-size:13px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.c2>span{font-size:11.5px;color:var(--ink-3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;display:flex;align-items:center;gap:5px}
.c2>span.l1{color:var(--ink-2);gap:7px}
.c2 .chn{width:13px;height:13px}
.c2 .pause{color:var(--warn)}
.c2 .pause .i{width:12px;height:12px}
.tr.off .c2 b{color:var(--ink-2)}
.det{display:flex;flex-direction:column;min-height:0;overflow:hidden}
.det-h{padding:14px 16px 0}
.det-t{display:flex;align-items:center;gap:8px;min-width:0}
.det-t h2{margin:0;font-size:15px;font-weight:650;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.det-t .r{margin-left:auto;display:flex;align-items:center;gap:7px;font-size:12px;color:var(--ink-2);flex:none}
.det-m{font-size:12px;color:var(--ink-3);margin:4px 0 12px;display:flex;align-items:center;gap:6px;flex-wrap:wrap}
.det-m .chn{width:13px;height:13px}
.det-a{display:flex;gap:6px;margin-bottom:12px;align-items:center}
.det-b{padding:14px 16px;overflow:auto;flex:1}
.strip-row{display:flex;align-items:center;gap:10px;font-size:11.5px;color:var(--ink-3);margin-bottom:12px}
.strip{display:flex;gap:3px}
.strip i{width:13px;height:18px;border-radius:3px;background:var(--line);cursor:pointer}
.strip i.ok{background:var(--ok)}.strip i.err{background:var(--err)}.strip i.silent{background:var(--ink-4)}.strip i.skipped{background:var(--line-2)}.strip i.e{background:transparent;box-shadow:inset 0 0 0 1px var(--line);cursor:default}
.strip i.cur{outline:2px solid var(--ink);outline-offset:1px}
.run{border:1px solid var(--line);border-radius:8px;margin-bottom:6px}
.run-h{display:flex;align-items:center;gap:9px;padding:8px 10px;font-size:12.5px;cursor:pointer}
.run-h:hover{background:var(--surface-2)}
.run-h b{font:600 12px var(--mono);color:var(--ink-2)}
.run-h .r{margin-left:auto;font:12px var(--mono);color:var(--ink-3)}
.run.sel{border-color:var(--line-2);box-shadow:var(--sh-2)}
.run-x{border-top:1px solid var(--line);padding:10px 12px}
.out-l{font-size:11px;font-weight:600;color:var(--ink-3);letter-spacing:.04em;margin-bottom:6px;display:flex;align-items:center;gap:4px}
.out-l .r{margin-left:auto;display:flex;gap:4px}
.prompt-box{background:var(--sunken);border:1px solid var(--line);border-radius:8px;padding:12px 14px}

/* jobs */
.job{border:1px solid var(--line);border-radius:10px;margin-bottom:16px;overflow:hidden}
.jh{display:flex;align-items:center;gap:12px;padding:14px 16px}
.jt{flex:1;min-width:0}
.jt b{font-size:14px;font-weight:620;display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.jt b .n{font:600 12.5px var(--mono);color:var(--ink-3);margin-right:4px}
.jt div{font-size:12px;color:var(--ink-3);display:flex;align-items:center;gap:6px;margin-top:2px;flex-wrap:wrap}
.jt .chn{width:13px;height:13px}
.jclock{text-align:right;margin-right:6px}
.jclock div{font:600 20px var(--mono);letter-spacing:-.01em;color:var(--run)}
.jclock.q div{color:var(--ink-3)}
.jclock span{font-size:11.5px;color:var(--ink-3)}
.jcmd{font:12px var(--mono);color:var(--ink-2);background:var(--sunken);border-top:1px solid var(--line);border-bottom:1px solid var(--line);padding:8px 16px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.jcmd .p{color:var(--ink-4);margin-right:6px}
.term{background:var(--term);color:var(--term-ink);font:11.5px/1.65 var(--mono);padding:10px 16px;height:240px;overflow:auto;position:relative;white-space:pre-wrap;word-break:break-all;margin:0}
.term-wrap{position:relative}
.term-bar{position:absolute;right:14px;top:8px;display:flex;gap:6px;z-index:1}
.term-bar button,.term-bar span{font:500 10.5px var(--sans);color:#B9B5A8;background:rgba(40,40,36,.9);border:1px solid rgba(255,255,255,.1);border-radius:5px;padding:2px 7px;display:flex;align-items:center;gap:5px;cursor:pointer}
.term-bar i{width:6px;height:6px;border-radius:50%;background:#7FD49B;animation:blink 1.4s infinite}
.term-bar .off i{background:#8C887C;animation:none}
.jthen{display:flex;align-items:center;gap:8px;padding:10px 16px;font-size:12.5px;color:var(--ink-2);flex-wrap:wrap}
.jthen .i{width:14px;height:14px;color:var(--brand)}
.jthen b{font-weight:600;color:var(--ink)}
.jthen .r{margin-left:auto;font-size:12px;color:var(--ink-3)}
.jl .th,.jl .tr{grid-template-columns:22px minmax(0,2fr) minmax(0,1.2fr) 86px 104px 110px 86px}
.jl .tr{min-height:52px}
.jl-x{grid-column:1/-1;padding:0 0 12px;cursor:default}
.jl-x .term{height:220px;border-radius:8px}
.cb{font-size:12px;display:flex;align-items:center;gap:5px;color:var(--ink-2);white-space:nowrap}
.cb .i{width:13px;height:13px}
.cb.ok .i{color:var(--ok)}.cb.err{color:var(--err)}.cb.mute{color:var(--ink-3)}.cb.wait{color:var(--run)}
.jmeta{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px 16px;font-size:12px;margin:12px 0}
.jmeta div span{display:block;color:var(--ink-3);font-size:11.5px}
.jmeta div b{font-weight:500;overflow-wrap:anywhere}

/* bots */
.bots{display:grid;grid-template-columns:minmax(0,1fr);gap:16px;align-items:start}
.bots.open{grid-template-columns:minmax(0,1fr) 470px}
.bgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:14px;align-content:start}
.bc-h{display:flex;align-items:center;gap:11px;padding:14px 16px 12px}
.bc-h .chn{width:30px;height:30px}
.bc-h b{font-size:14px;font-weight:620;display:block;line-height:1.3}
.bc-h span{font-size:12px;color:var(--ink-3)}
.bc-h .pill{margin-left:auto;align-self:flex-start}
.bc-b{padding:0 16px 12px;display:grid;grid-template-columns:64px minmax(0,1fr);gap:7px 10px;font-size:12.5px;margin:0}
.bc-b dt{color:var(--ink-3)}
.bc-b dd{margin:0;display:flex;align-items:center;gap:6px;flex-wrap:wrap;min-width:0}
.bc-f{border-top:1px solid var(--line);padding:8px 10px;display:flex;gap:4px}
.bc-f .r{margin-left:auto}
.bc.sel{border-color:var(--ink);box-shadow:0 0 0 1px var(--ink)}
.drawer{display:flex;flex-direction:column;position:sticky;top:0;max-height:calc(100vh - 140px);overflow:hidden}
.dr-h{padding:14px 18px;border-bottom:1px solid var(--line);display:flex;align-items:center;gap:10px}
.dr-h h2{margin:0;font-size:15px;font-weight:650;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.dr-h .r{margin-left:auto;display:flex;gap:4px}
.dr-b{padding:16px 18px;overflow:auto;flex:1}
.dr-s{font-size:11px;font-weight:650;color:var(--ink-3);letter-spacing:.06em;margin:4px 0 10px}
.dr-s~.dr-s{margin-top:18px;padding-top:16px;border-top:1px solid var(--line)}
.dr-f{border-top:1px solid var(--line);padding:10px 18px;display:flex;gap:8px;align-items:center}
.dr-f .muted{font-size:12px}
.dr-f .r{margin-left:auto;display:flex;gap:8px}
.rc{display:grid;grid-template-columns:1fr 1fr;gap:6px}
.rco{border:1px solid var(--line);border-radius:8px;padding:8px 10px;display:flex;gap:8px;align-items:flex-start;cursor:pointer;background:var(--surface);text-align:left;font:inherit}
.rco:hover{border-color:var(--line-2)}
.rco>i{width:14px;height:14px;border-radius:50%;border:1.5px solid var(--line-2);flex:none;margin-top:2px}
.rco b{font-size:12.5px;font-weight:600;display:block}
.rco span{font-size:11.5px;color:var(--ink-3);line-height:1.4;display:block}
.rco.on{border-color:var(--brand);background:var(--brand-soft)}
.rco.on>i{border:4px solid var(--brand)}
.gl{border:1px solid var(--line);border-radius:8px;max-height:260px;overflow:auto}
.gl-r{display:flex;align-items:center;gap:9px;padding:6px 10px;font-size:12.5px;border-top:1px solid var(--line);min-width:0}
.gl-r:first-child{border-top:0}
.gl-r .mono{color:var(--ink-2)}
.gl-r .r{margin-left:auto;display:flex;gap:6px;align-items:center}
.gl-add{display:flex;gap:6px;margin-top:8px}

/* engines */
.etiles{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}
.etile{border:1px solid var(--line);border-radius:10px;padding:12px 14px;position:relative;cursor:pointer;background:var(--surface);text-align:left;font:inherit;color:inherit}
.etile:hover{border-color:var(--line-2)}
.etile .eng{font-size:13.5px;color:var(--ink);font-weight:620}
.etile .eng::before{width:10px;height:10px;border-radius:3px}
.etile p{margin:4px 0 8px;font-size:11.5px;color:var(--ink-3);line-height:1.45}
.etile .meta{display:flex;align-items:center;gap:6px;font-size:11.5px;color:var(--ink-2)}
.etile .rad{position:absolute;right:12px;top:12px;width:16px;height:16px;border-radius:50%;border:1.5px solid var(--line-2)}
.etile.on{border-color:var(--brand);box-shadow:0 0 0 1px var(--brand);background:var(--brand-soft)}
.etile.on .rad{border:5px solid var(--brand)}
.acc{border:1px solid var(--line);border-radius:10px;overflow:hidden}
.acc-r{display:flex;align-items:center;gap:12px;padding:12px 16px;border-top:1px solid var(--line);cursor:pointer;min-width:0}
.acc-r:hover{background:var(--surface-2)}
.acc>.acc-r:first-child{border-top:0}
.acc-r .eng{font-size:13px;color:var(--ink);width:150px}
.acc-r .sum{font-size:12px;color:var(--ink-3);display:flex;gap:6px;align-items:center;flex-wrap:wrap;min-width:0}
.acc-r .sum .mono{color:var(--ink-2)}
.acc-r .chev{margin-left:auto;color:var(--ink-3);display:flex}
.acc-r.open{background:var(--surface-2)}
.acc-x{padding:14px 16px 4px 28px;border-top:1px solid var(--line)}
.dirty{position:absolute;left:50%;bottom:20px;transform:translateX(-50%);display:flex;align-items:center;gap:12px;background:#1B1A17;color:#EDECE7;border-radius:12px;padding:8px 8px 8px 16px;box-shadow:var(--sh-3);font-size:12.5px;white-space:nowrap;z-index:30}
[data-theme=dark] .dirty{background:#2A2927;border:1px solid #3A3835}
.dirty .dot{background:var(--brand)}
.dirty .muted{color:#9A968C;max-width:320px;overflow:hidden;text-overflow:ellipsis}
.dirty .btn.ghost{color:#D6D3CA}
.dirty .btn.ghost:hover{background:rgba(255,255,255,.08);color:#fff}
.dirty .btn.brand .kbd{background:rgba(0,0,0,.18);border-color:rgba(0,0,0,.2);color:#fff}
.diffpop{position:absolute;left:50%;bottom:74px;transform:translateX(-50%);width:min(620px,calc(100% - 40px));background:var(--surface);border:1px solid var(--line);border-radius:12px;box-shadow:var(--sh-3);z-index:30;overflow:hidden;max-height:50vh;display:flex;flex-direction:column}
.diffpop h4{margin:0;padding:10px 14px;font-size:12px;border-bottom:1px solid var(--line);display:flex;align-items:center}
.diffpop h4 span{margin-left:auto;font-weight:400;color:var(--ink-3)}
.diffpop .dl{overflow:auto}
.df{display:grid;grid-template-columns:220px minmax(0,1fr);gap:10px;padding:7px 14px;font-size:12px;border-top:1px solid var(--line);align-items:baseline}
.df:first-child{border-top:0}
.df .k{font-family:var(--mono);font-size:11.5px;color:var(--ink-2);overflow-wrap:anywhere}
.df del,.df ins{text-decoration:none;border-radius:3px;padding:0 4px;font-family:var(--mono);font-size:11.5px;overflow-wrap:anywhere}
.df del{color:var(--err);background:var(--err-soft)}
.df ins{color:var(--ok);background:var(--ok-soft)}

/* security */
.prs{display:grid;grid-template-columns:repeat(auto-fill,minmax(360px,1fr));gap:14px}
.pr{border:1px solid var(--line);border-radius:12px;padding:16px 18px;display:grid;grid-template-columns:minmax(0,1fr) auto;gap:12px;background:var(--surface)}
.pr-who{display:flex;align-items:center;gap:10px;min-width:0}
.pr-who b{font-size:14px;font-weight:620;display:block}
.pr-who span{font-size:12px;color:var(--ink-3)}
.pr-code{font:600 26px var(--mono);letter-spacing:.2em;margin:12px 0 4px}
.pr-meta{font-size:12px;color:var(--ink-3);display:flex;gap:6px;align-items:center;flex-wrap:wrap}
.pr-meta .chn{width:13px;height:13px}
.exp{grid-column:1/3;display:flex;align-items:center;gap:10px;font-size:11.5px;color:var(--ink-3)}
.exp .bar{flex:1;height:4px;border-radius:2px;background:var(--sunken);overflow:hidden}
.exp .bar i{display:block;height:100%;background:var(--warn-dot);border-radius:2px;transition:width 1s linear}
.pol .th,.pol .tr{grid-template-columns:minmax(0,1.5fr) 1fr 1fr 1fr 110px 70px}
.pol .tr{min-height:50px}
.legend{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-top:14px}
.legend div{font-size:12px;color:var(--ink-2);border:1px solid var(--line);border-radius:8px;padding:9px 11px;line-height:1.45}
.legend b{display:flex;align-items:center;gap:6px;font-size:12.5px;margin-bottom:4px;color:var(--ink)}

/* skills */
.sk{display:grid;grid-template-columns:300px minmax(0,1fr);height:100%}
.sk-l{border-right:1px solid var(--line);background:var(--surface-2);padding:14px 10px;overflow:auto}
.sk-i{padding:10px;border-radius:8px;margin-bottom:2px;display:block}
.sk-i:hover{background:var(--hover)}
.sk-i b{font:600 13px var(--mono);display:flex;align-items:center;gap:6px}
.sk-i p{margin:3px 0 6px;font-size:12px;color:var(--ink-3);line-height:1.45;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.sk-i.on{background:var(--surface);box-shadow:var(--sh-1),0 0 0 1px var(--line)}
.sync4{display:flex;gap:4px;flex-wrap:wrap}
.sync4 span{display:inline-flex;align-items:center;gap:4px;font-size:11px;color:var(--ink-2);height:20px;padding:0 6px;border-radius:5px;border:1px solid var(--line);background:var(--surface)}
.sync4 span::before{content:"";width:6px;height:6px;border-radius:50%;background:var(--ok)}
.sync4 span.no{color:var(--warn);border-color:color-mix(in srgb,var(--warn-dot) 40%,var(--line));background:var(--warn-soft)}
.sync4 span.no::before{background:var(--warn-dot)}
.sk-r{display:flex;flex-direction:column;min-width:0;min-height:0}
.sk-h{padding:16px 24px 14px;border-bottom:1px solid var(--line)}
.sk-h .t{display:flex;align-items:center;gap:10px}
.sk-h h2{margin:0;font:650 16px var(--mono)}
.sk-h .t .r{margin-left:auto;display:flex;gap:8px}
.sk-meta{display:flex;gap:8px;margin-top:10px;font-size:12px;color:var(--ink-3);align-items:center;flex-wrap:wrap}
.sk-ed{flex:1;min-height:0;display:flex;flex-direction:column;padding:14px 24px 18px}
.sk-ed textarea{flex:1;min-height:200px;resize:none;font:12.5px/1.7 var(--mono);padding:12px 14px}

/* yaml */
.yaml{display:flex;flex-direction:column;flex:1;min-height:0;border:1px solid var(--line);border-radius:10px;overflow:hidden}
.yaml-bar{display:flex;align-items:center;gap:8px;padding:8px 12px;border-bottom:1px solid var(--line);font-size:12px;color:var(--ink-3);background:var(--surface-2)}
.yaml textarea{flex:1;border:0;border-radius:0;box-shadow:none;resize:none;font:12.5px/1.7 var(--mono);padding:12px 16px}
.yaml textarea:focus{box-shadow:none}

/* modal, toast, palette */
.scrim{position:fixed;inset:0;background:rgba(20,18,14,.35);z-index:60;display:flex;align-items:flex-start;justify-content:center;padding:8vh 20px 20px;animation:fade .12s ease-out}
[data-theme=dark] .scrim{background:rgba(0,0,0,.55)}
@keyframes fade{from{opacity:0}}
.modal{background:var(--surface);border:1px solid var(--line);border-radius:14px;box-shadow:var(--sh-3);width:min(520px,100%);max-height:84vh;display:flex;flex-direction:column;overflow:hidden;animation:pop .14s ease-out}
.modal.lg{width:min(760px,100%)}
.modal.xl{width:min(1000px,100%);height:80vh}
@keyframes pop{from{transform:translateY(6px) scale(.99);opacity:0}}
.mo-h{display:flex;align-items:center;gap:10px;padding:14px 18px;border-bottom:1px solid var(--line)}
.mo-h h2{margin:0;font-size:15px;font-weight:650;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.mo-h .sub{font-size:12px;color:var(--ink-3);font-family:var(--mono);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.mo-h .r{margin-left:auto;display:flex;gap:4px}
.mo-b{padding:16px 18px;overflow:auto;flex:1;min-height:0}
.mo-b.flush{padding:0;display:flex;flex-direction:column}
.mo-f{display:flex;gap:8px;justify-content:flex-end;align-items:center;padding:12px 18px;border-top:1px solid var(--line)}
.mo-f .l{margin-right:auto;font-size:12px;color:var(--ink-3);display:flex;align-items:center;gap:6px}
.check{display:flex;align-items:center;gap:8px;font-size:12.5px;color:var(--ink-2);cursor:pointer}
.check input{accent-color:var(--brand);width:14px;height:14px}
.fpv{display:grid;grid-template-columns:240px minmax(0,1fr);flex:1;min-height:0}
.fpv-l{border-right:1px solid var(--line);overflow:auto;padding:6px 8px;background:var(--surface-2)}
.fpv-l .fl{margin:0}
.fpv-l .fl.on{background:var(--surface);box-shadow:var(--sh-1),0 0 0 1px var(--line)}
.fpv-r{display:flex;flex-direction:column;min-width:0;min-height:0}
.fpv-h{display:flex;align-items:center;gap:8px;padding:8px 14px;border-bottom:1px solid var(--line);font-size:12px}
.fpv-h b{font:600 12px var(--mono)}
.fpv-h .r{margin-left:auto;display:flex;gap:4px}
.fpv pre{flex:1;margin:0;overflow:auto;padding:12px 16px;font:12px/1.6 var(--mono);white-space:pre-wrap;word-break:break-word;color:var(--ink-2)}
.fpv .md{flex:1;overflow:auto;padding:14px 18px}
.toasts{position:fixed;right:18px;bottom:18px;z-index:80;display:flex;flex-direction:column;gap:8px;align-items:flex-end}
.toast{display:flex;gap:10px;align-items:flex-start;max-width:420px;background:var(--surface);border:1px solid var(--line);border-radius:10px;box-shadow:var(--sh-3);padding:10px 14px;font-size:12.5px;animation:pop .14s ease-out;transition:opacity .25s}
.toast .st-ic{margin-top:1px}
.toast ul{margin:4px 0 0;padding-left:16px;color:var(--ink-2)}
.pal{width:min(640px,100%);background:var(--surface);border:1px solid var(--line);border-radius:14px;box-shadow:var(--sh-3);overflow:hidden;animation:pop .12s ease-out;display:flex;flex-direction:column;max-height:70vh}
.pal-in{display:flex;align-items:center;gap:10px;padding:12px 16px;border-bottom:1px solid var(--line)}
.pal-in .i{width:18px;height:18px;color:var(--ink-3)}
.pal-in input{flex:1;border:0;outline:0;background:transparent;font:15px var(--sans);color:var(--ink)}
.pal-list{overflow:auto;padding-bottom:6px}
.pal-g{font-size:11px;font-weight:650;letter-spacing:.05em;color:var(--ink-3);padding:10px 16px 4px}
.pal-i{display:flex;align-items:center;gap:10px;padding:8px 12px;margin:0 6px;border-radius:8px;font-size:13px;cursor:pointer;min-width:0}
.pal-i .i{width:15px;height:15px;color:var(--ink-3)}
.pal-i .chn{width:15px;height:15px}
.pal-i .t{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0}
.pal-i .muted{font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0}
.pal-i .r{margin-left:auto;display:flex;gap:6px;align-items:center;flex:none}
.pal-i.on{background:var(--hover);box-shadow:inset 0 0 0 1px var(--line)}
.pal-i mark{background:none;color:var(--brand-ink);font-weight:650}
.pal-f{display:flex;gap:14px;padding:9px 16px;border-top:1px solid var(--line);font-size:11.5px;color:var(--ink-3);align-items:center}
.pal-f .r{margin-left:auto}
.offline{display:flex;align-items:center;gap:8px;background:var(--err-soft);color:var(--err);padding:8px 22px;font-size:12.5px;border-bottom:1px solid var(--line)}

@media (max-width:1280px){
  .ses{grid-template-columns:280px minmax(0,1fr)}
  .ses .rail{display:none}
  .ses.showrail{grid-template-columns:280px minmax(0,1fr) 296px}
  .ses.showrail .rail{display:block}
  .split{grid-template-columns:minmax(0,1fr) 400px}
  .ovg{grid-template-columns:minmax(0,1fr) 320px}
  .jl .th,.jl .tr{grid-template-columns:22px minmax(0,2fr) minmax(0,1.2fr) 80px 96px 96px}
  .jl .th>:nth-child(7),.jl .tr>:nth-child(7){display:none}
}
@media (max-width:1040px){
  #app{grid-template-columns:60px minmax(0,1fr)}
  .side{padding:12px 8px}
  .bn,.bs,.sbtn span,.sbtn .kbd,.ng-t,.ni span:not(.nb),.hs,.hl span:not(.dot),.side-foot .fr{display:none}
  .brand{justify-content:center;padding:4px 0 12px}
  .sbtn{justify-content:center;padding:0}
  .ni{justify-content:center;padding:0;position:relative}
  .ni .nb{position:absolute;top:-2px;right:-2px;height:14px;min-width:14px;padding:0 3px;font-size:9.5px}
  .ni .nb.run::before{display:none}
  .hl{justify-content:center}
  .split{grid-template-columns:minmax(0,1fr)}
  .stats{grid-template-columns:repeat(2,1fr)}
  .st:nth-child(3){border-left:0}
  .st:nth-child(n+3){border-top:1px solid var(--line)}
  .ovg{grid-template-columns:minmax(0,1fr)}
  .etiles{grid-template-columns:repeat(2,minmax(0,1fr))}
  .bots.open{grid-template-columns:minmax(0,1fr)}
  .g3,.g4{grid-template-columns:1fr 1fr}
  .legend{grid-template-columns:1fr 1fr}
}
`;
