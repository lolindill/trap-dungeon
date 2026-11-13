# Phase 2 Lua Mechanics Audit (`dungeon_keeper.lua`, `default_variables.txt`, `lorebook/`)

> **Ticket:** [01-research-phase2-lua-audit](../tickets/01-research-phase2-lua-audit.md)  
> **Audited Sources:** `_reference/dungeon_keeper.lua` (v1.6.0 base through v1.15.2 patches, 15,542 lines), `_reference/default_variables.txt`, and `_reference/lorebook/{03,11,14,15,17}`.  
> **Note on Patch Layering:** `dungeon_keeper.lua` appends version patches sequentially (overwriting earlier `CFG.*` fields and wrapping `X.*` functions). This audit documents **both** the Phase 2 core definitions and their latest active overrides (up to v1.15.2) so downstream design tickets can decide which patch tier to target.

---

## 1. Day Action Points (`CFG.AP`) & Daily Cycle

### 1.1 Constants & AP Growth
- **Base & Cap (`_reference/dungeon_keeper.lua` L1384, L6984–6999, L8016, L8104):**
  - `CFG.AP = { BASE = 3, CAP = 5 (base) -> 6 (v1.5.1+, L6984), REST_MP = 10, ENTERTAIN = 1 }`
  - **AP Growth (`CFG.APG`, v1.5.1+ L6985):** `WIPES = 5`, `CONV = 5`, `QUESTS = 3`, `MAX = 3`, plus `KILLS = 10` (L8016).
  - **Formula:** `X.apMax(id) = min(CFG.AP.BASE + min(CFG.APG.MAX, X.apGrown(id)), CFG.AP.CAP)`.
  - **7 Growth Paths (`X.apPaths`, L6989–6996 & L8104; any 3 grant +1 AP each up to cap 6):**
    1. `X.stage(id, "V") >= 4` (Vesper Stage 4)
    2. `X.fac(id, "manor") >= 2` (Manor Lv 2)
    3. `town.lv >= 5` (Domain Lv 5)
    4. `apx.wipes >= 5` (5 total party wipes)
    5. `apx.conv >= 5` (5 prisoner conversions: guard/servant/pet/dancer/hire)
    6. `apx.quests >= 3` (3 Eleonora commissions completed)
    7. `kills >= 10` (10 heroes killed)

### 1.2 Turn Transitions (`Night Raid → Day Estate → Management Settle → Debt/Build`)
1. **Night Raid Settlement → Day Start (`confirmResult`, L2338–2344 & L7026–7034):**
   - Exiting `result` clears active party heroes, sets mode to `estate`, and calls `X.newDay(id)`.
   - `X.newDay(id)` (L1620–1624, wrapped L2925, L3969, L5022–5025):
     - Sets `day = dk_wave`.
     - Resets `journal.ap_used = {}`, `journal.lines = {}` (moving any `journal.overflow` lines generated during `debt`/`result`/`msettle` into `lines`).
     - Computes `ap = X.apMax(id) - dk_ent_ap` (deducting `1` if Eleonora was entertained on the preceding collection day), then adds `perks.ap_bonus` if Vesper's `V7` perk is queued (consuming `ap_bonus` and updating both `dk_ap` and `dk_ap_max`).
     - Resets `dk_ent_ap = 0`, `dk_day_closed = 0`.
2. **AP Spending Guard (`X.allowed` / `X.spendAP`, L1662–1668, L2904):**
   - Requires `mode == "estate"`, no pending town `event`, `dk_day_closed == 0`, `dk_ap > 0`, and `!journal.ap_used[key]` (one action per action-key/officer/prisoner per day).
   - Decrements `dk_ap` by `1` and sets `journal.ap_used[key] = true`.
3. **End of Day → Management Settlement (`X.closeDay` L1775–1779, `X.toBuild` L4185–4198):**
   - `X.restMP(id) = dk_ap * 10 * (perkDay("rest2_day") ? 2 : 1)` (L1771–1773).
   - `X.closeDay` sets `dk_ap = 0`, `dk_day_closed = 1`, and awards `restMP` to `dk_points`.
   - `X.toBuild` posts/skips the `〔DK-DAY〕` journal request, runs `settle` if a `pending` raid outcome exists, runs `X.settleEstate(id)` (computing servant/job MP, town food/housing/tax/pop/approval/order/renown, stat decay, debt interest, town news, gameover flags, and rolling a settlement crisis `sevent`), and enters `msettle` mode.
4. **Management Settlement → Debt or Build (`X.msConfirm`, L2345–2349):**
   - After resolving any `sevent` crisis in `msettle`, `X.msConfirm` checks `X.isDue(id)` (`dk_wave >= X.dueWave(debt)`).
   - If due, opens `debt` mode (`X.openDebt(id)`); otherwise transitions to `build` mode for the next wave.

---

## 2. Prisoner Management (`CFG.PRISON`)

### 2.1 Capacity, Capture Stats & Derived Fields
- **Capacity (`X.cap`, L1394, L1619, L5731):**
  - `6 + 2 * fac("annex") + 2 * fac("pens") + (perks.cap_bonus or 0)`.
  - Overflow on capture auto-sells at `CFG.PRISON.OVERFLOW_RATE = 0.8` × ransom.
- **Capture Initialization (`X.capture` L2112–2117, `X.pdef` L3621–3628, L5558, L9386):**
  - Base `resist = CFG.PRISON.RESIST[grade] + (CAP_INJ[cond] or 0)`:
    - Grades: `F=25, D=30, C=40, B=50, A=60, S=70, SS=80, SSS=90, EPIC=100`.
    - Condition: `injured = -10`, `severe = -20`.
    - Trait modifiers: `noble +15`, `pure +25`, `masochist -20`, `ascetic +10`. Clamped `[0, 100]`.
  - Base `corr = (lewd ? 20 : 0) + (aroused ? 15 : 0)`.
  - Extended stats (`X.pdef`): `pleasure = floor(corr * 0.5)`, `terror = floor((100 - resist) * 0.3)`, `shame = 0`, `marks = { obey=0, pleasure=0, terror=0, shame=0 }`.
  - `stamina`: `100` healthy, `80` injured, `60` severe (`stMax = tough ? 120 : 100`).
- **Stamina Regen & Exhaustion Death (L3619, L3853, L11946–11974, L15013–15026):**
  - `DIE_BELOW = 10`, `DIE_P = 0.25` (checked on `pwhip` / `ptool` when post-action `stamina < 10`, L3745).
  - `REGEN` evolved: `15 / 25 (food >= 60)` (L3619) → `7 / 12` (L11946) → `20 / 20` (L15013). Note: when `food < 20` (`foodLo`), base loop skips regen (L3853), though the v1.15.0 `jobSettle` patch adds `10` if `foodLo` plus `CFG.SPA = {5, 10, 20}` from `spa` facility (L15022–15024); `spa` Lv 2 also gives 50%/settlement chance to heal `injured`.
  - `X.staminaSweep` (L11947–11964): on flush, any non-legend prisoner with `stamina <= 0` dies of exhaustion (`exhausted_death`); legend prisoners clamp to `stamina = 1, dying = true` and require `prest` (free rest, `-120` stamina cost = full heal) to reach `stamina >= 20`.

### 2.2 Marks (`CFG.PRISON.MARK`) & Conditioning Actions (`CFG.PACT`)
- **Mark Thresholds (`CFG.PRISON.MARK`, L3618; `X.markCheck`, L3630–3642; `X.markCut`, L8233):**
  - `obey` Lv 1/2/3: `resist <= {50, 25, 5} + markCut + (submissive ? 10 : 0)`
  - `pleasure / terror / shame` Lv 1/2/3: `stat >= {30, 60, 90} - markCut`
  - `markCut = 5 * fac("trainhall")` (updated from `3` in v1.5.13).
- **Interrogation (`X.interroChance`, L1395, L1891–1894, L5733, L8229):**
  - `clamp(0.35 + (100 - resist) * 0.005 + (stage("V") >= 1 ? 0.15 : 0) + 0.15 * fac("spy") + 0.10 * fac("torture") + perks, 0.10, 0.95)` (`CFG.TOWN.SPY` raised from `0.10` to `0.15` at L8229; daily perks: `V3` adds `+0.10` via `interro_day`, `V4` adds `+0.10` via `prison_day`).
  - Success: `resist -5`, `intel +1`; Fail: `resist -3`.
- **Legacy vs Pact Prison Actions (1 AP each, max 1 action/prisoner/day except `prest`):**
  - Legacy actions (`pint`, `ptrain`, `pserve`, `pshow`, `ptort`, L1918–1938 + `X.pextra` L3666–3683): `ptort` lowers `resist` by `10 + random(1..10)`, adds `fear +3`, and has `25%` injury risk (`severe` -> death + `fear +4`), or `+10 corr` for `masochist`.
  - **19 Base Pacts (`CFG.PACT`, L3644–3663):** grouped into `train` (`pcare, ptool, pbind, pdrug, pmilk, pduo`), `shame` (`pwalk, pdisplay, ppair, ppublic`), `fear` (`pwhip, pthreat`), `soft` (`pfeed, ptalk, preward, prest [0 AP]`), `use` (`pwork, pgift, pdress`).
  - **10 Dark Pacts (v1.6+, L5735–5778):** `pbrand, pstarve, ptent, pslime, pcrest, phypno, pcow, pconfess, prename, pduel`.
  - **6 Harsh Pacts (v1.6.5+, L10401–10450, L11976):** `pxtrain, pxshame, pxfear, pxsoft, pxuse, pxdark`. Heavy stamina costs (`25–45`), `resist -18..-30`, `25%` injury chance, and explicit death risk `die` (`5%–11%` base in v1.7.6 L11976, `×2` if `severe`, `+0.10` if post-stamina `< 30`, `+0.25` if `< 15`, capped `0.95`; legend prisoners halve resist drop and cannot die).
  - **Purification (`pcure`, L10885–10906):** `20` MP, requires `shrine` (Lv 1 cures `parasite`, Lv 2 cures `curse`).
  - **Multipliers:** `trainMult = 1 + 0.20 * fac("trainhall")` (L8231), `resMult = trainMult + (fear_verb ? 0.25 * fac("torture") : 0)` (L8232), `×1.5` if prisoner's `kink` matches verb (`CFG.KINKS`, L3540–3553), `×1.25` at `stage("V") >= 2` (for `ptrain`), `×1.2` if paired with bonded partner (`pairs >= 3`, L5336–5339), plus trait modifiers (`pure ×0.5`, `lewd/masochist ×1.5`, `exhibitionist ×1.5 shame`, `cursed ×1.3 pleasure`, `berserker ×0.5 terror`, `sadist /1.5 whip resist`).

### 2.3 Jobs, Conversions & Double Agent
- **Conversions (`X.convertOptions` L1899–1903, `X.convert2` L3816–3829, `X.assignJob` L3795–3814):**
  - **Guard** (cap `3`, requires `resist <= 10` & free trap floor): adds `+1` DC to assigned floor.
  - **Servant** (cap `3`, requires `corr >= 70`): yields `SERVANT_MP` (`F=4, D=6, C=9, B=12, A=16, S=20, SS=25, SSS=30, EPIC=30`, halved if `food < 20`) + `lust +2`/settlement.
  - **Pet** (cap `2`, requires `pleasure >= 3` & `obey >= 2`): `lust +3`, owner (`V`/`L`) `aff +1`/settlement.
  - **Dancer** (cap `2`, requires `shame >= 3` & `pleasure >= 2`, needs `brothel`): `approval +1`, `+10%` of `last_tax` per dancer.
  - **Hired Staff** (cap `3 + fac("manor")`, requires `obey >= 3` or `corr >= 80`): works any unlocked job at `×2` output, costs `-5 MP`/settlement salary.
- **Jobs (`CFG.JOBS`, 25 total entries across L3782–3790, L5342–5350, L9155–9157, L12046–12053; `bait` removed at L13357):**
  - Includes `square, farm, bath, brothel, dairy, arena, barracks, manor` (base 8, outputs `×1.5` in L5341), `toilet, tavern, tasting, bellows, trapbench, decoy, altar, doll` (8 town/facility jobs), `lure` (floor), `trusty` (prison), `showcase, tortdemo, breeder, model, gibbetx` (5 v1.8.0 jobs).
  - **Aptitude (`CFG.APT` & `CFG.APT_MULT = {0.7, 1.0, 1.4}`, L12055–12095):** 1–3 stars from job stats scale MP and town stat yields.
  - **Settlement Risks:** Prisoners with `resist > 40` assigned to jobs have an escape chance of `max(0, (order < 30 ? 0.10 : 0.05) - 0.01 * fac("watch"))` per settlement (L3851). Job-specific accidents/pregnancies/afflictions (`CFG.PEVT`, L12070–12077) trigger in `jobSettle`.
- **Double Agent (`X.moleGo`, L9310–9328):** Requires `obey >= 3`; 1 active mole grants `+intel` and `-1` guild scout level over `CFG.MOLE.RAIDS` raids with per-raid discovery risk.

### 2.4 Ransom, Sale Risks, Auction & Disposal
- **Ransom Formula (`X.ransomCalc`, L5282–5305, L9285–9289, L9746–9751, L11461):**
  - Base `CFG.RANSOM`: `F=5, D=14, C=28, B=49, A=77, S=112, SS=154, SSS=210`.
  - Multipliers (multiplicative):
    - `1 + corr / 200`
    - `1 + sum(marks) * 0.08`
    - `pleasure >= 70` → `×1.15`; `stamina < 30` → `×0.7`; `terror >= 80` → `×0.9`
    - `noble` → `×1.5` (`CFG.PRISON.NOBLE` L1398; fallback `1.3` in code), `rich` → `×1.3`, `severe` → `×0.8` (`CFG.PRISON.SEVERE_MULT` L1398; fallback `0.6`)
    - `dressed` → `×1.2`, `broken` → `×0.7`, `branded` → `×1.05`, `(cow or crest) & lewdmart >= 1` → `×1.2`
    - `virgin & !pure` → `×1.1` (L11461)
    - `renown` estate mod (`+10%` at `>=60`, `+15%` at `>=80`), `1 + 0.05 * fac("market")`, war/wonder bonuses.
    - When `sell ~= false` (actual sale, not debt handover): `stage("V") >= 1` → `×1.10`, `1 + aff_v * 0.001`, active banquet `perks.ransom_up` (`+15%` V10 / `+10%` E11), and buyer multiplier (`X.buyerMult`, `0.5–2.0`, ×1.3 if `marketHot`).
- **Sale Risks (`CFG.SELL_RISK = { cut=0.15, stiff=0.07, escape=0.05, bonus=0.08 }`, L5307–5328, L5791):**
  - `order >= 70` halves `stiff` & `escape`; `market` reduces `cut` by `0.05/lv`; `stage("V") >= 3` scales all 3 risks by `0.75` (`0.5` at `>= 4`); `obey >= 2` or `renamed` sets `escape = 0`.
  - Outcomes: `escape` (`0 MP`, guild alert `+5`), `stiff` (`0.3×`, `renown -1`), `cut` (`0.7×`), `bonus` (`1.2×`), normal (`1.0×`).
- **Auction (`X.auction`, L3772–3781):** Requires `market >= 1`, sells for `1.1 × ransom(sell=true)` with **no sale risks**.
- **Execution / Release (`prisonAct`, L1947–1967):**
  - Execute: `+floor(baseRansom * EXEC_RATE)` MP, `+1` kill, `fame +(FAME.HERO * 2)`, `fear +(6 + 2 * gradeIndex) * (shrine >= 3 ? 1.5 : 1)` (plus `gibbet >= 1` gives `order +3, fear +2`).
  - Release: `mom -1`, `fame -1 pt`, `fear -3`.

---

## 3. Debt System (`CFG.DEBT` & `15_DK_SYS_Debt.md`)

### 3.1 Core Schedule & Formulas (`L1409`, `L2194–2337`, `L8619–8620`)
- **Initial State (`L1640`):** `debt = 3000`, `start = w`, `due = w + 3`, `k = 0`, `step = 0`, `lates = 0`, `patience = 60`, `aff_e = 10`, `relief = 0`, `ext_carry = 0`, `forgive_used = false`.
- **Installment Cadence:** Every `CFG.DEBT.EVERY = 3` waves (`FIRST = 3`).
- **Minimum Due (`X.baseMin` & `X.dueMin`, L2195–2198):**
  - `MIN = { 30, 60, 120, 180, 240, 300, 360 }` indexed by `min(step + 1, 7)`.
  - `dueMin = min(debt, (baseMin + ext_carry) - floor((baseMin + ext_carry) * min(min_cut, 0.25)))`.
  - `min_cut` comes from Eleonora interactions `E3 (-5%)` / `E5 (-10%)`, capped at `MIN_CUT_MAX = 0.25`.
- **Per-Wave Interest (`X.settleEstate`, L3192–3196, L8619–8620):**
  - Charged at each `settleEstate` unless `d.no_interest` (from `E8`): `ceil(debt * rate)` where `rate = (stage("E") >= 1 ? 0.008 : 0.01)` (halved to `0.004 / 0.005` in Casual mode).

### 3.2 Collection Day (`debt` mode, `L2234–2337`)
1. **Previous Commission Check:** If a `quest` was active (`CFG.QUESTS`, 8 types paying `120–210 MP` direct debt reduction + `aff_e +2`; `corrupt70` consumes the highest-grade prisoner with `corr >= 70`), failure causes `patience -10`. Next, 2 random quests are offered (optional; must choose accept 1, accept 2, or decline before finishing).
2. **Entertainment (`X.entertain`, L2256–2263):** Available once per visit before any MP payment (`paid == 0`). Sets `dk_ent_ap = 1` (reduces **next day's** AP by 1!).
   - Success chance: `min(0.95, 0.40 + aff_e / 200 + (stage("E") >= 3 ? 0.15 : 0))`.
   - Success: cuts `v.need` by `25%`, `aff_e +4`. Failure: `aff_e +1`, `patience -5`.
3. **Prisoner Handover (`X.handover`, L2264–2274):** Credits `floor(X.ransom(id, p, false) * (stage("E") >= 2 ? 1.3 : 1.2))` toward both `debt` and `v.paid`.
4. **MP Payment & Prepay (`X.pay`, L2275–2298):**
   - Paying during `estate` (`prepay = true`) or `debt` reduces `debt` 1:1.
   - Extra MP paid beyond `v.need` (or prepaid during the cycle) grants `+1 aff_e` per `100 MP`, capped at `EXTRA_AFF_MAX = 2` per visit/day.
5. **Verdict & Penalties (`X.debtVerdict` & `X.finishDebt`, L2304–2337):**
   - **`ontime` (`short <= 0`):** `patience +6` (cap 100), `lates = max(0, lates - 1)`, `aff_e +1`.
   - **`ext` (Extension: `patience >= 30` and `paid >= 0.5 * need`):** `ext_carry = floor(short * 1.2)`, `patience -20`, `aff_e -3`.
   - **`forgive` (Eleonora `stage("E") >= 4` and `!forgive_used`, once per game):** `forgive_used = true`, `ext_carry = short` (no 20% surcharge), `patience -10`.
   - **`late`:** `lates +1`, `debt = floor(debt * 1.10)` (+10% penalty), `patience -30`, and **seizes** the highest-ransom prisoner (credited at `1.0×` `ransom(sell=false)`).
   - **Endings:** `lates >= 3` → `bankrupt` (`-20 MP`/settlement upkeep forever in endless mode). `debt <= 0` → `romance` if `aff_e >= 90` (`+30 MP`/settlement Goldreich investment), else `liberation`. `RELIEF_CAP = 1200` caps total debt forgiven via `E7`/`E9`/`E10`.

### 3.3 Additional Loans (`CFG.LOAN`, v1.7.0, L10913–10969)
- Optional post-v1.6 feature: borrow `{50, 100, 200}` MP (up to `max(200, floor(0.70 * netAssets))`) for 1 AP/day.
- Extra debt accrues `3%` interest per wave (vs `1%/0.8%` on original debt), adds `ceil(extra * 0.10)` to `dueMin`, and repayments pay down `extra` first.

---

## 4. Town & Estate Facilities (`CFG.TOWN` & `CFG.ECON`)

### 4.1 Town State, Growth, Tax & Game-Over Triggers (`L1411–1425`, `L3017–3214`, `L8601–8665`, `L12920–12990`)
- **Town Stats (initial):** `lv = 1`, `pop = 60`, `approval = 50`, `order = 60`, `housing = 50`, `food = 40`, `renown = 20`, `policy = "normal"`, `guard = 0`, `famine = 0`, `riot = 0`.
- **Domain Levels (`LV_COST`, `LV_REQ` total facility levels, `LV_POP`, `TAX`, `POP_CAP`, `ECON.BASE`, `LV_UPKEEP`):**
  - **Lv 1 (Outpost):** Pop cap `200`, Tax `25`, Base Income `30` (v1.5.16 `CFG.ECON.BASE`)
  - **Lv 2 (Village):** Upgrade `200 MP / 2 fac / 120 pop`; Pop cap `450`, Tax `50`, Base `60`
  - **Lv 3 (Town):** Upgrade `450 MP / 5 fac / 300 pop`; Pop cap `800`, Tax `85`, Base `100`
  - **Lv 4 (Walled Town):** Upgrade `700 MP / 9 fac / 600 pop`; Pop cap `1300`, Tax `130`, Base `150`
  - **Lv 5 (Domain Capital):** Upgrade `1100 MP / 14 fac / 1000 pop`; Pop cap `2000`, Tax `180`, Base `220`
  - **Lv 6–7 (Royal Seat / Demon Capital, v1.9.0 L12920–12990):** Upgrades `1600 / 2600 MP`, req `20 / 26 fac`, pop `1600 / 2400`; Pop caps `2800 / 3600`, Tax `230 / 290`, Base `280 / 350`, **Daily Upkeep `-40 / -80 MP`**, Threat `+1 / +2`, unlocks 3 Landmarks (`hq` 600 MP, `lab` 900 MP, `cmd` 900 MP).
  - **Upgrade Celebration Bonus (L8637):** `+2 * CFG.ECON.BASE[new_lv]` MP on level-up.
- **Population Cap & Tax Formula (`X.popCap` L3055, `X.tax` L2372–2377 & L3057–3061 & L5533):**
  - `popCap = floor(POP_CAP[lv] * (1 + 0.10 * fac("inn")) * (1 + 0.05 * fac("housing")) * (0.8 + housing / 250))`.
  - `tax = floor(baseTax * policy[1] * (0.4 + 0.6 * pop / popCap) * (1 + 0.15 * fac("inn") + 0.20 * fac("brothel")) * (approval >= 70 ? 1.1 : 1) * (1 + tax_next) * renownMult * (1 + aff_e * 0.001))` + `10 * fac("trade")` (note: `CFG.TOWN.TAX_DIV = 4` in v1.5.16; `POLICY`: `low={0.7, +3 ord, +4 app}`, `normal={1, 0, 0}`, `high={1.4, -4 ord, -5 app}`).
  - **Additional Income (`L3180`, `L8623–8632`):** Population mana `+min(50, 5 * floor(pop / 100))`, `CFG.ECON.BASE[lv]`, plus `Vault` (`25%` of `tax + base` banked up to `150 * lv`, auto-covers `50%` of breach plunder/penalties — `75%` in Casual).
- **Food, Housing, Approval, Order, Renown, Riots & Game Over (`X.settleEstate`, L3153–3213):**
  - **Food:** `prod = 8 + 3 * fac("farmland") + 1 * fac("dairy") + jobFood`; `eat = ceil((pop / popCap) * 10)`. If `food <= 0`: `famine +1`, `pop -5%`, `approval -6`. If `food < 20`: `approval -3`, servant MP halved.
  - **Housing:** `-3` if `pop >= 0.9 * popCap`, `+2 * fac("housing")`. If `housing < 25`: `approval -2`.
  - **Riot Trigger:** If `order < 30` or `approval < 20`, riot chance is `30%` (`50%` if both): sets `tax = 0`, loses `15%` of current MP, `pop -10%`, `renown -10`.
  - **Domain Game Over:** `pop <= 0` (`ruin`), `famine >= 3` consecutive waves (`famine`), or `approval <= 10 && order <= 10` for `3` consecutive waves (`riot`).
- **Estate Modifiers on Dungeon/Raid (`X.estateMods`, L5482–5516, overridden L7281–7312):**
  - **Approval:** `< 40` leaks layouts of `1` (`20–39`) or `2` (`0–19`) floors (`DC -2` on leaked floors); `60–79` gives `first_dc +1`; `80+` gives `intel +1`.
  - **Order:** `< 20` build/upgrade cost `+20%`, `20–39` `+10%`; `60–79` Core capture `5%`, `80+` `10%` (`E.CORE` in L7251), plus `watch >= 3` adds `+10%` Core capture.
  - **Food:** `< 20` **all floors `DC -1`** & servant MP halved (L7301–7303); `60+` guard `DC +1`; `80+` crit room-damage `-25%` (`E.CRIT_SAFE`).
  - **Housing:** `60–79` install/upgrade `-4%`, `80+` `-8%` (`E.HOUSE_CUT` in L7251).
  - **Renown:** `< 20` tax `-20%`; `60–79` ransom `+10%`; `80+` ransom `+15%` & stronger hero `+10%`.
  - **Breach Damage (`X.breachDamage`, L3354–3370, L8661–8665):** Reduced by `breachCut = min(0.5, 0.10 * guard + 0.10 * fac("watch"))`. Kills `max(s, round(pop * 0.08 * k))`, damages approval/order/housing/food/renown, `15% * k` chance to downgrade a facility, `15% * (1-cut)` per survivor to free highest-resist prisoner, and `50%` on full breach to injure Vesper or Lilim for the next day.
- **Settlement Crisis Events (`CFG.TOWN.SEV`, L3215–3239, `70%` chance per settlement, cooldown `4` waves)** and **Estate Actions (`CFG.TOWN.ACTS` + `CFG.EVT`, L3036–3042, L5396–5453, L5801–5819).**

### 4.2 Facilities (`CFG.TOWN.FAC`, max level `min(3, town.lv)`)
| Key | Name | Level Costs (MP) | Prereq | Key Effects |
| :--- | :--- | :--- | :--- | :--- |
| `inn` | Tavern & Inn | `60 / 150 / 300` | — | Tax `+15%/lv`, Pop cap `+10%/lv`, Lv2: `30%` prep intel +1 |
| `market` | Slave Market | `100 / 200 / 350` | — | Ransom/handover `+5%/lv` in `ransomCalc` L5298 (`facInfo` text advertises `+10%/lv`), Cut risk `-5%p/lv`, unlocks `pdress` & `auction` |
| `brothel` | Pleasure Quarter | `100 / 220 / 400` | — | Tax `+20%/lv`, App `+1/lv`, Lust `+2/lv`, Festival app `+6` |
| `smithy` | Smithy | `120 / 250 / 400` | — | Trap install/upgrade/remodel/match `-5%/lv`, Crit room dmg `-10%p/lv`, unlocks `ptool` |
| `spy` | Spy Guild | `80 / 180 / 320` | — | Interrogation `+15%p/lv` (v1.5.13 L8229), Lv2: `20%` prep intel +1 |
| `shrine` | Dark Shrine | `100 / 220 / 380` | — | Fear `+2/lv`, App `-1/lv`, Free `punish`, Lv2: `pcrest/phypno`, Lv3: Exec fear `×1.5` |
| `manor` | Lord's Manor | `150 / 300 / 550` | — | Officer aff `×(1 + 0.30*lv)` (v1.5.13 L8228), Lv2: +1 AP path, Lv3: Order `+3`/settle, Hired cap `+1/lv` |
| `annex` | Prison Annex | `80 / 160 / 280` | — | Prison cap `+2/lv` |
| `housing` | Housing | `80 / 180 / 320` | — | Housing `+2/lv`/settle, Pop cap `+5%/lv` |
| `farmland` | Farmland | `60 / 140 / 260` | — | Food `+3/lv`/settle, farm job slots |
| `bath` | Public Bath | `90 / 200 / 360` | — | App `+2/lv`, V/L aff `+1/lv` (v1.5.13), unlocks `pslime` & `bath` job |
| `watch` | Watchtower | `70 / 160 / 300` | — | Order `+2/lv`, Breach dmg `-10%/lv`, Guard cap `2/lv`, Lv3: Core capture `+10%` |
| `trade` | Trading Post | `100 / 220 / 380` | — | Tax `+10 MP/lv`, Renown `+1`, E aff `+1/lv` (v1.5.13) |
| `workshop` | Arcane Workshop | `150 / 300 / 500` | — | Fix cost `-15%`, Crit downgrade save `25%/lv`, Lv3: All floors `DC +1` |
| `trainhall` | Training Hall | `120 / 250 / 420` | — | Prison act `+20%/lv`, Mark threshold `-5/lv` (v1.5.13), Guard `DC +1` |
| `dairy` | Dairy | `100 / 220 / 380` | — | Food `+1`, unlocks `pmilk` (Lv2: `pcow`) & `dairy` job |
| `arena` | Arena | `120 / 260 / 450` | — | Renown `+2`, Fear `+1`, Lv2: `25%` 1 hero starts injured, unlocks `pduel` |
| `beastpen` | Beast Pen | `120 / 260 / 420` | `dairy >= 1` | Lust `+2/lv`, `20%/lv` Tentacle Guardian, unlocks `ptent` & `breeder` |
| `torture` | Torture Chamber | `100 / 220 / 380` | `trainhall >= 1` | Interro `+10%p/lv`, Fear-verb resist `-25%/lv`, Fear `+2/lv`, unlocks `pconfess` |
| `gibbet` | Gibbet | `80 / 180 / 300` | `watch >= 1` | Exec/Sacrifice `+3 order, +2 fear`, App `-1/lv` |
| `pens` | Slave Pens | `90 / 200 / 340` | `annex >= 1` | Prison cap `+2/lv` |
| `grail` | Blood Grail | `150 / 300 / 500` | `shrine >= 2` | Blood Rite MP `×1.5` (`1.2×` vs `0.8×`), extra `+1` first-room DC |
| `lewdmart` | Lewd Market | `140 / 280 / 450` | `market >= 2` | Cow/Crest ransom `+20%`, Auction fee `0%`, Renown `+1` |
| `reform` | Reformatory | `90 / 200 / 360` | — | Passive resist `-3 / -5 / -8` per settlement (half on job/legend) |
| `spa` | Regen Spa | `200 / 350 / 550` | — | Extra prison stamina `+5 / +10 / +20`, Lv2: `50%` heal injured, Lv3: heal mobs |

---

## 5. Officer Affinity & Perks (`CFG.STAFF`, `X.stage`, `X.perks`)

### 5.1 Affinity Progression, Gifts & Diminishing Returns
- **Thresholds (`CFG.STAFF`, L1401):**
  - Stages `1..4`: `{20, 40, 65, 90}` (for Vesper `V`, Lilim `L`, Eleonora `E`).
  - Stage `5` (Eleonora only): `STAGE_E5 = 100`.
- **Gain Multipliers (`X.affGain`, L8251–8256, L15029):**
  - Base `TIME` (V/L): `1 + random(1..3)` (`2..4`); `VISIT` (E): `0 + random(1..3)` (`1..3`); `GIFT` (`40 MP`): flat `4`.
  - Facility flat bonus (`X.affFlat`, L8250): `+1 * fac("bath")` for V/L; `+1 * fac("trade")` for E.
  - Manor multiplier (`X.affMult`, L8249): `1 + 0.30 * fac("manor")`.
  - Stage decay (`CFG.STAFF.STAGE_GAIN`): originally `{1, 0.75, 0.5, 0.35, 0.25}` (L1401), **buffed in v1.15.0 (L15029)** to `{1, 0.9, 0.75, 0.6, 0.5}`.
- **Automatic Wave Affinity (`X.affBy`, v1.15.0, L15029–15060):**
  - Capped at `CFG.AFFX.CAP = 8` per officer per wave. Triggers include: Vesper (`sell +3`, `exec +3`, `mark +2`, `facility +1`, `townlevel +3`, `5 prison actions/day +1`), Lilim (wipe/S-eval/epic/new trap/breach), Eleonora (income record/expedition/5 clean waves).

### 5.2 Passive Stage & Affinity Perks
> **Important Implementation Note:** In initial v1.4/v1.6 (`L1576` & `L1893`), `V_UPG` (`×0.9` upgrade cost) checked `X.stage(id, "L") >= 1` while `L_INTERRO` (`+15%p`) checked `X.stage(id, "V") >= 1`. In `L5011–5012`, `X.benefits` UI strings were updated to match the actual code!
- **Vesper (`V`, initial aff `0`):**
  - **Affinity scaling (L5301, L5536, L5547):** `order +floor(aff_v / 25)` per settlement; ransom `+0.1% * aff_v`.
  - **Stage 1 (`20`):** Sale price `+10%` (`V_SELL = 0.10`, L5300); Interrogation `+15%p` (`L1893`).
  - **Stage 2 (`40`):** `ptrain` corruption gain `×1.25` (`V_TRAIN = 1.25`, L1922); unlocks `pduo` with Vesper.
  - **Stage 3 (`65`):** `+10 MP` per night raid settlement (`V_INCOME = 10`, L2146); Sale risk `×0.75` (L5312).
  - **Stage 4 (`90`):** Sale risk `×0.50` (L5312); unlocks AP Growth Path `"집사장의 살림"` (counts toward `+1` max AP, L6990).
- **Lilim (`L`, initial aff `0`):**
  - **Affinity scaling (L5643):** First trap floor hero roll `-min(2, floor(aff_l / 40))` (effectively `+1/+2` DC on first room).
  - **Stage 1 (`20`):** Trap upgrade cost `-10%` (`V_UPG = 0.9`, L1576).
  - **Stage 2 (`40`):** `+1` Intel at Prep (`L1998`); `+10%` chance for new traps to upgrade `+1` grade on raid start (`L5702`).
  - **Stage 3 (`65`):** First trap room hero roll `-1` (`L_FIRST = -1`, L2050); unlocks `pduo` with Lilim.
  - **Stage 4 (`90`):** `30%` base chance (`+20%p` with `L7`) to downgrade highest-grade hero in party by 1 rank at Prep (`L1993–1995`); doubles `trapbench` grade-up contribution (`+15%p/worker`, L5703).
- **Eleonora (`E`, initial aff `10`):**
  - **Affinity scaling (L5533):** Domain tax `+0.1% * aff_e`.
  - **Stage 1 (`20`):** Debt interest lowered from `1.0%` to `0.8%` (`RATE_S1 = 0.008`, L3194).
  - **Stage 2 (`40`):** Prisoner handover debt credit `×1.3` (instead of `×1.2`, L2267).
  - **Stage 3 (`65`):** Debt entertainment success `+15%p` (L2260); Auction fee `0%` (L5442).
  - **Stage 4 (`90`):** Once-per-game automatic late-payment forgiveness (`L2308`); `renown +1`/settlement (L5548); qualifies for **Romance Ending** (`aff_e >= 90`, L2201).
  - **Stage 5 (`100`):** Unlocks `E9` (`-15%` debt up to 450 MP, 1/game) & `E10` (Dowry payoff if `debt <= 600` → immediate Romance Ending).

### 5.3 Active Officer Interactions (`CFG.INTERACT`, 1 AP, 1 Officer/Day)
Includes `V1–V10` (with v1.6 `V3↔L3` and `V7` overrides at L5014–5017), `L1–L10` (L5018–5021), and `E1–E12` (L1467–1476, L5820–5826):
- **Vesper:** `V1` (+10 settle MP), `V2` (+2 fear), `V3` (+10%p interro today), `V4` (+10%p interro & +10% train today), `V5` (rest MP ×2 today), `V6` (-20 MP, +6 lust), `V7` (+1 AP next day), `V8` (cd 10 waves: +5 fear, +1 prison cap once), `V9` (all prisoners +5 terror, +2 order), `V10` (+15% sale/auction today).
- **Lilim:** `L1` (30% +1 intel), `L2` (50% duel for +15 settle MP), `L3` (-10% next trap upgrade), `L4` (+4 lust), `L5` (+1 prep intel), `L6` (+6 lust, +1 first-room DC once), `L7` (+20%p ace-downgrade next prep), `L8` (1/game: max intel +1), `L9` (+20%p new-trap +1 grade), `L10` (+1 all-room DC next raid).
- **Eleonora:** `E1` (+5 pat), `E2` (+8 pat), `E3` (-5% next min due), `E4` (+5 pat), `E5` (cd cycle: -10% min due), `E6` (-30 MP, +10 pat), `E7` (cd cycle: -5% debt), `E8` (cd cycle: waive next settlement interest), `E9` (1/game: -15% debt max 450), `E10` (1/game: clear <= 600 debt → Romance Ending), `E11` (+3 renown, +10% sale today), `E12` (guild alert -5).

---

## 6. Prompt & Lorebook Rules (`_reference/lorebook/`)

- **`03_DK_SYS_Prisoners.md`:** Constant prompt injection (order 30) summarizing `[Prison block — N captive hero(es) kept alive under Vesper's keys: ...]` and `[Turned heroes now serving the dungeon: ...]` whenever counts `> 0`.
- **`11_DK_SYS_Location.md`:** Injects `[Location — <dk_loc_name>]\n<dk_loc_text>` (order 35) when the Master is at a non-square location or resolving a town event, including generated `<npc loc="...">` keeper profiles.
- **`14_DK_SYS_DayJournal.md`:** Batch-narrates `dk_day_lines` as one continuous day scene led by Vesper (with Lilim joining for dungeon talk or mockery). Ordinary entries get `>= 1` paragraph; `★` (`star=true`) entries get multi-paragraph full scenes; `TOWN NEWS` entries get short townsfolk reaction vignettes. Must keep system numbers out of prose. `X.journalPost` batches up to `CFG.DAY_MAX = 12` entries (`star` entries first) and appends `<npc>` creation tags for newly built facilities lacking an NPC (`X.npcRequest`, L1739–1744).
- **`15_DK_SYS_Debt.md`:** Defines `### intro` (Eleonora's romcom ojou-sama arrival, `3,000 MP` debt, 3-wave cadence, 3-strike seizure) and `### visit` plus event snippets (`quest_ok/fail`, `ent_ok/fail`, `hand`, `pay`, `extra`, `ontime`, `ext`, `forgive`, `late`, `seize`, `newquest`, `noquest`). Requires playing each event in order before the verdict and keeping numbers out of prose except ledger figures Eleonora reads aloud.
- **`17_DK_ACT_Lines.md`:** Contains 60+ parameterized `### <key>` prompt templates (using `{{getvar::dk_act_target}}`, `{{getvar::dk_act_result}}`, `{{getvar::dk_act_stage}}`, and `{{random::...}}`) for prison actions, officer hangouts/gifts/stages, intimate `int_V1..V10`, `int_L1..L10`, `int_E1..E12`, town acts, and dark/harsh pacts. Also enforced by `X.adlib` (v1.15.2, L15353–15372) which appends non-repeating ad-lib sensory seeds while locking fixed outcomes.
