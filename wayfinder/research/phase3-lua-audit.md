# Phase 3 Lua Mechanics Audit (Monsters, Expeditions, Situations/Crises, Album & Endings)

**Source of Truth:** Audited directly from `_reference/dungeon_keeper.lua`, `_reference/default_variables.txt`, `_reference/lorebook/16_DK_SYS_Ending.md`, `app/src/data/assetManifest.ts`, and `app/src/components/GalleryModal.tsx`.  
**Scope:** Exact schemas, constants, formulas, probability tables, patch overrides (`v1.6.0`–`v1.15.2`), and asset cross-checks needed to design and implement Phase 3 UI/UX systems in the standalone React app.

---

## 1. Monster Roster & Raising System

### 1.1 Roster Schema & 28 Lineages (`CFG.MOB`, `X.MOB_LINES`)
* **Line Count (`X.MOB_ORDER`):** `18` lineages added in `v1.12.2` (`L13943–13962`) + `10` added in `v1.14.1` (`L14607–14619`) = **28 lineages × 3 star forms = 84 unit forms**.
* **Data Structure per Lineage:** `{ icon, {★1_ko, ★2_ko, ★3_ko}, {★1_en, ★2_en, ★3_en}, roleTag, evoCond ("kills"|"fed"), tier (1|2|3) }`
* **Egg Draw Weights (`L13963–13967`):** `CFG.MOB.EGG_W = { 4, 2, 1 }` (Tier 1/2/3). Rare/expedition eggs multiply by `CFG.MOB.EGG_RARE = { 1, 2, 3 }`, yielding effective weights `4 : 4 : 3`.
* **Preferred Floor (`X.MOB_PREF`, `L14621–14632`):** If deployed on a floor whose traps carry the matching tag, floor DC gains an extra `+1` (`🏠 선호 층`), subject to `CFG.FSLOT.CAP = 3`.
* **Female Humanoid Breeding (`X.MOB_FEM`, `L14622`):** Only these 8 lineages (`lamia, harpy, spider, plant, demon, snow, siren, fox`) can breed with **male** prisoners.

| # | Key | Tier | ★1 / ★2 / ★3 (KO) | Role (`OCC_ACT`) | ★3 Gate | Pref Tag (`X.MOB_PREF`) | `X.MOB_FEM` |
|:-:|:---|:-:|:---|:---|:---|:---|:---:|
| 1 | `beast` | 1 | 던전 늑대 / 그림자 늑대 / 지옥견 | `phys` | `kills >= 3` | — | — |
| 2 | `slime` | 1 | 점액 괴물 / 점액 군체 / 슬라임 퀸 | `bind` | `fed >= 2` | `bind` | — |
| 3 | `tentacle` | 1 | 촉수 덩굴 / 촉수 군락 / 심연의 촉수 | `bind` | `fed >= 2` | `bind` | — |
| 4 | `mimic` | 1 | 미믹 / 그레이터 미믹 / 미믹 킹 | `bind` | `fed >= 2` | — | — |
| 5 | `plant` | 1 | 맨드레이크 / 알라우네 / 알라우네 퀸 | `bind` | `fed >= 2` | `bind` | Yes |
| 6 | `orc` | 1 | 오크 전사 / 오크 광전사 / 오크 대족장 | `phys` | `kills >= 3` | — | — |
| 7 | `lizard` | 1 | 리자드맨 / 리자드맨 전사 / 드래고뉴트 | `phys` | `kills >= 3` | — | — |
| 8 | `bug` | 1 | 킬러 비 / 군대벌 / 여왕벌 | `bind` | `fed >= 2` | `bind` | — |
| 9 | `mush` | 1 | 포자 버섯 / 버섯 인간 / 균사 군주 | `mind` | `fed >= 2` | `mind` | — |
| 10 | `golem` | 2 | 클레이 골렘 / 아이언 골렘 / 미스릴 골렘 | `phys` | `kills >= 3` | — | — |
| 11 | `harpy` | 2 | 하피 / 하피 사냥꾼 / 하피 퀸 | `phys` | `kills >= 3` | — | Yes |
| 12 | `lamia` | 2 | 라미아 / 라미아 무희 / 라미아 퀸 | `mind` | `fed >= 2` | `mind` | Yes |
| 13 | `spider` | 2 | 거대 거미 / 아라크네 / 아라크네 여왕 | `bind` | `fed >= 2` | `bind` | Yes |
| 14 | `minotaur` | 2 | 미노타우로스 / 미노타우로스 투사 / 미궁의 왕 | `phys` | `kills >= 3` | — | — |
| 15 | `chimera` | 2 | 코카트리스 / 바실리스크 / 키메라 | `phys` | `kills >= 3` | — | — |
| 16 | `elemental` | 2 | 윌 오 위스프 / 정령 / 정령왕 | `mind` | `kills >= 3` | `fire` | — |
| 17 | `were` | 2 | 늑대인간 / 웨어울프 전사 / 달의 군주 | `phys` | `kills >= 3` | — | — |
| 18 | `fox` | 2 | 여우불 / 요호 / 구미호 | `mind` | `fed >= 2` | `mind` | Yes |
| 19 | `oni` | 2 | 소오니 / 붉은 오니 / 오니 왕 | `phys` | `kills >= 3` | — | — |
| 20 | `snow` | 2 | 눈 정령 / 설녀 / 빙설의 여왕 | `ice` | `fed >= 2` | `ice` | Yes |
| 21 | `siren` | 2 | 세이렌 / 바다의 가희 / 심해의 여왕 | `water` | `fed >= 2` | `water` | Yes |
| 22 | `centaur` | 2 | 켄타우로스 / 켄타우로스 궁기병 / 초원의 왕 | `phys` | `kills >= 3` | — | — |
| 23 | `troll` | 2 | 동굴 트롤 / 바위 트롤 / 트롤 왕 | `phys` | `kills >= 3` | — | — |
| 24 | `darkelf` | 3 | 다크엘프 척후 / 다크엘프 마검사 / 다크엘프 여사제장 | `mind` | `kills >= 3` | — | — |
| 25 | `demon` | 3 | 임프 / 몽마 / 마계 귀족 | `mind` | `fed >= 2` | `mind` | Yes |
| 26 | `vampire` | 3 | 뱀파이어 배트 / 뱀파이어 / 진조 | `mind` | `fed >= 2` | — | — |
| 27 | `dragon` | 3 | 드레이크 / 와이번 / 드래곤 | `phys` | `kills >= 3` | `fire` | — |
| 28 | `mare` | 3 | 그림자 말 / 나이트메어 / 몽마의 군마 | `mind` | `fed >= 2` | `mind` | — |

### 1.2 Pen Capacity, Overcrowding & Hatching (`X.mobCap`, `X.mobTick`, `X.mobCrowd`)
* **Pen Capacity (`L13774, L13789`):** `cap = CFG.MOB.CAP0 (3) + CFG.MOB.CAP_PEN (2) * fac("beastpen")`.
* **Building Beast Pen (`L13847–13848`):** Each upgraded level of `beastpen` grants 1 new ★1 monster (`X.mobPick()`).
* **Eggs (`CFG.MOB.HATCH = 1`, `L13793, L13850–13853, L14675–14684`):**
  * Sources: `mpreg` affliction birth (`1–2` eggs on expiration, v1.15.2 fix removes erroneous +30 MP guard-birth leak `L15442–15453`), Prisoner/Monster Breeding, Expedition loots/events (`X.mobPick(true)`).
  * Hatches at `wave >= egg.w` **only if `#mobs < cap`**. Otherwise stays queued in `mob_eggs`.
  * Legacy guard migration (`X.guardMig`, `L15457–15467`): Old `"마물 새끼"` (random ★1) and `"촉수 수호자"` (`tentacle` ★2) guards convert into `mobs` (or eggs if `#mobs >= cap + 2`).
* **Overcrowding (`X.mobCrowd`, `L14646–14663`):** Runs once per wave at Estate entry (`over = #mobs - cap`). For `1..over`, picks a random monster: **`20%`** chance to die (`+1 exp_parts`), **`80%`** injured (`inj = w + 1`).

### 1.3 Growth, Actions & Breeding (`L13829–13918`, `L14686–14753`, `L15471–15497`)
* **Evolution Thresholds (`CFG.MOB.XP = { 10, 25 }`):**
  * ★1 -> ★2: `xp >= 10`.
  * ★2 -> ★3: `xp >= 25` **AND** (`kills >= 3` for `"kills"` lineages OR `fed >= 2` for `"fed"` lineages).
  * Raid XP (`L13875`): `+3` per killed hero (`XP_KILL=3`), `+2` per captured hero (`XP_CAP=2`).
* **Management Actions (Estate phase):**
  * **Feed Prisoner (`mfeed_`, `1 AP`):** Consumes a prisoner (`!job && !fexh && !legend`); grants `min(10, 4 + gradeIndex(grade))` XP and `fed += 1`.
  * **Absorb Monster (`mabs_`, `1 AP`):** Consumes an idle (undeployed) monster; grants `floor(target.xp / 2) + 2` XP and `fed += 1`.
  * **Force Evolution (`mevo_`, `0 AP`, `L14687–14698`):** Available when `st < 3` and `xp >= need * 0.8`. Costs `50 * st` MP; **`15%`** failure kills the monster (`+1 exp_parts`), otherwise promotes `st + 1` and floors `xp = max(xp, need)`.
  * **Breed (`mbrd_`, `1 AP`, `MAX = 2/wave`, `#mobs + #eggs < cap + 2`, `L14701–14740`):** Monster must be undeployed and healthy (`!mobHurt`); sets `mob.tired = w + 1`.
    * *With Prisoner:* Eligible if `!legend && !dying && !brd && stamina >= 30 && (gender ~= "male" || X.MOB_FEM[mob.ln])`. Success probability: `max(0.20, 0.50 + 0.10 * st - resist / 400)`.
      * On fail: prisoner `stamina -5`.
      * On success (`B+` -> egg inherits `xp = 5`; `S+` -> inherits `traits[1]`):
        * **Female prisoner:** `p.brd = { ln, w = w+2, xp, tr }`, `stamina -15`, `resist -5`, `corr +5`. Births `1–2` eggs in `w+2`.
        * **Male prisoner (`X.MOB_FEM` only):** Monster lays `1` egg immediately for `w+1`, prisoner `stamina -10`, `resist -3`.
    * *With Another Monster:* Eligible idle healthy mob. Always lays `1` egg for `w+1` with `xp = floor((m.xp + o.xp)/4)`. If different lineage, **`15%`** chance (`VAR = 0.15`) to gain Variant bloodline tag (`⟨other_★1의 피⟩`, `+5 XP`, `1.5×` sale price), `50%` chance to adopt partner's lineage.
  * **Dispose (`mdisp_`, Estate or Build phase, `L15472–15484`):**
    * **Sell:** `+ (30 * st) * (var ? 1.5 : 1)` MP.
    * **Butcher:** `+1 exp_parts` and `+10` town `food`.

### 1.4 Floor Deployment, Injury, Link Combos & Upkeep
* **Floor Combat Slots (`CFG.FSLOT`, `L12730–12768`):** Max **`N = 2`** combatants per trap floor (monsters or captive fighters `!job`).
  * **Floor DC Bonus (`X.newGain`, capped at `CFG.FSLOT.CAP = 3`):**
    * Each Monster: `+st` (★1..★3) + `+1` if floor has `X.MOB_PREF[m.ln]` trap tag (`L14628–14630`).
    * Each Captive Fighter: `+2` if `grade >= B` (`gradeIndex >= 3`), else `+1` (`+1` betrayal risk if `resist >= 60`: `random < resist/150` after floor clear `L12828`?).
    * Expedition Parts buff (`fbuff`): `+1` (`PART_W = 3` waves).
    * Landmarks: `lab` (`마도 연구소`) `+1` on up to `2` toggled floors (`LAB_N = 2`); `cmd` (`마왕군 사령부`) `+1` on floors with a deployed dungeon guard.
* **Raid Hazard & Recovery (`L13877–13881`, `L15471`, `L15024`, `L15454`):**
  * If any hero passes the floor (`alive > 0`), each deployed monster rolls death: `p_die = max(0.02, 0.10 + 0.05 * (alive - 1) - 0.05 * (st - 1))`. If it survives, `m.inj = w + 1` (recovers when `wave >= inj`). `spa >= 3` heals all `m.inj = nil` at settlement (`L15454`).
  * `X.OCC_ACT` (`L15195`) injects exact combat behavior descriptions (`phys, bind, mind, fire, ice, water`) into AI narration prompts without altering DC.
* **Floor Links (`CFG.LINK`, `L12736–12798`):** Adjacent occupied floors match 12 `(tagA, tagB)` pairs (or `captive fighter -> any`), adding a `-1` (`B`) or `-2` (`A`, both floors >= grade `B`) penalty to heroes caught (`narrow`, `ail > 0`, or `aroused`) on the prior floor (`LINK_MAX = 3` links active, max `-2/floor`, `-3/raid`; `mage/scout` `35%` dodge).
* **Upkeep (`CFG.UPKEEP`, `L14518–14555`):** Default ON in `Hard` mode (toggleable `dk_cfg_upkeep`). Free `<= W5`, half `W6–W10`. Capped at **`25%`** of trailing 3-wave avg income (`MIN = 10` MP).
  * Monster component = `sum(st * 2)` MP (`×0.75` if `farmland > 0` or `granary > 0`).
  * Arrears: unpaid shortfall raises arrear level `1..3`, prisoner `+3 resist`, and at arrears `>= 2` up to 2 mobs/wave risk escaping (`★1` undeployed `20%`) or starving (`ar >= 3`, `10%`).

---

## 2. Expeditions (`CFG.EXP2`, `CFG.EXP3`, `CFG.EXR`, `X.EXEV`, `X.AFTER`)

### 2.1 Unlock, Crew & Trip Lengths (`L12258–12324`, `L15062–15077`)
* **Gate:** Unlocks at **Wave 3** (`UNLOCK_W = 3`). Max **`1`** active expedition at a time (`1 AP` to launch in `estate`; blocked during active Holy Crusade `cr` or if toggled off).
* **Crew Limits & Eligibility:** Max **`3`** prisoners (`4` with Town Lv6 Landmark `hq`). Eligible if `!legend && !dying && resist <= 40 && stamina >= 50`.
* **5 Lengths (`CFG.EXP2.LEN` + `CFG.EXP3`):**

| Index | Key | Name (KO) | Days | Cost (MP) | Depth | Prerequisites & Special Rules |
|:-:|:---|:---|:-:|:-:|:-:|:---|
| 1 | `short` | 🥾 단거리 | 2 | 15 | 3 | Unlocked W3. Safe food/pop/parts. |
| 2 | `mid` | 🐎 중거리 | 3 | 30 | 5 | Guaranteed `village` node on depth 5 (`60%` extra on 3–4). |
| 3 | `long` | ⚔ 장거리 | 5 | 50 | 7 | Requires `town.lv >= 3` & `crew >= 2`. `fort` added to pool. `village` (3–4) + `city` (7, `50%` on 5–6). |
| 4 | `grand` | 🏰 원정 대장정 | 7 | 80 | 9 | `v1.15.0`: `W12+`, `town.lv >= 3`, `crew >= 3`, `long` cleared once. Day `4+` deals `5` stamina fatigue/day. Unlocks `DEEP` events & relic shards (`depth >= 8`). |
| 5 | `abyss` | 🌑 심연 원정 | 10 | 120 | 12 | `v1.15.0`: `W20+`, `town.lv >= 3`, `crew >= 3`, `grand` cleared once. Day `4+` deals `8` stamina fatigue/day + **`3%`/day** chance entire party vanishes (`LOST=0.03`). |

### 2.2 Daily Loop, Combat & Flee Formulas (`L12262–12552`)
* Runs in dedicated **`exped`** phase (`MODE_KO.exped`, after `msettle`) with **`3 AP/day`** (`CFG.EXP2.AP = 3`).
* **Actions per Day:**
  * `mv1..3`: Advance `pos + 1` along 1 of 3 region choices per depth (`DMG.move = 5` stamina, ambush risk `region.ambush`, `ENC_P = 70%` encounter roll, `ST_P = 25%` region ailment).
  * `atk` / `def`: Resolve active encounter.
    * **Crew Power (`L12328–12329, L14278`):** `sum(1 + gradeIndex + stamina/25 - ailmentCount) + min(2, gear) + drill*2`.
    * **Diff (`L12346`):** `enc.d + pos * 1.5 + 2`.
    * **Win Chance (`L12347`):** `clamp(0.55 + (crewPower - diff) * 0.04, 0.15, 0.92)`.
    * **Damage (`DMG`):** Attack win `5` / fail `14`; Defend win `3` / fail `8`; Ambush `12`; Arrival raid fail `16`; Home forced march `8`.
  * `scout`: Reveal next depth encounters / loot; triggers `SHARD = 30%` relic shard find when `pos >= 8`; increments `af.scout`.
  * `camp`: Rest (`+10` base, `+15` `CAMP_MIN` when stamina low, `+10` `hq`, `+5` `REST` end-day).
  * `v1..v3` / `c1..c3`: Destination actions upon first arrival (`village` / `city`).
  * `home`: Early extract (`stamina` penalty `8` per active ailment on settlement return).
  * `Auto-Progress` (`exAutoDay`): Uses `exRecommend` and pauses on `exStop` (`all stamina < 30`, any `< 35`, arrival at destination, or fork with only `ambush >= 0.30` nodes).
* **Daily Flee Check (`X.exFlee`, `L12330–12338`):**
  * Zero (`0`) if prisoner title starts with `broken`, `tamed`, or `pleasure-trained` (`SAFE_TITLE`).
  * Otherwise: `max(0, resist * 0.0012 * (loyal ? 0.3 : 1) - (marks.obey or 0)*0.01 + (isDest ? 0.03 : 0) - (hq ? 0.02 + (len==3 ? 0.01 : 0) : 0))`.
* **Deaths, Notoriety & Relic Shards:**
  * Any crew hitting `stamina <= 0` dies (`prisonLog`, `lost=true`, triggers `leak` aftermath).
  * **`notor >= 3` (`NOTOR_RETAL = 3`):** Adds `{ k="hero_up", v=1 }` to next wave's `raidmods` (via `v2`) and triggers `revenge` aftermath (`v1.15.0`).
  * **Relic Shards (`L15162`):** Every `3` shards collected automatically grants `1` unclaimed `X.RELICS` item (`shield, chalice, crown, lens`).
  * **High Haul Bonus (`L15165`):** Successful return with `mp >= 150` grants Eleonora `+2` affection (`affBy`).

### 2.3 Regions (`13`), Encounters (`10`), Arrivals (`6`) & Events (`16 + 6`)
* **Regions (`CFG.EXR`, `L12266–12277`, `L14157–14159`):**
  * **Pool (`9`):** `forest` (ambush `0.12`, ail `fall`), `ruin` (`0.18`, `fall`), `swamp` (`0.18`, `drug`), `canyon` (`0.30`, `fall`), `mine` (`0.18`, `cramp`), `abbey` (`0.15`, `exposed`), `road` (`0.10`, `exposed`), `hotspring` (`0.10`, `exposed`, v1.13.0), `market` (`0.15`, `drug`, v1.13.0).
  * **Long-Only Pool (`1`):** `fort` (`0.30`, `gear`).
  * **Fixed Nodes (`3`):** `out` (start depth 0, `0.08`), `village` (`0.05`, arrival `v1..v3`), `city` (`0.10`, arrival `c1..c3`).
  * **Ailments (`CFG.EXP2.ST`):** `burn`, `fall`, `cramp`, `gear`, `drug`, `exposed` (each gives `-1` `exPower` and `-8` stamina on return).
* **Encounters (`CFG.EXP2.ENC`, `8` + `2` v1.13.0):** `patrol (d6)`, `party (d9)`, `caravan (d5)`, `ruin (d7)`, `refugee (d3, +20 pop)`, `nest (d8, +1 egg)`, `militia (d8)`, `scout (d10, +1 intel)`, plus `witch (d8, +1 intel, +40 MP)`, `bounty (d9, +80 MP, +1 gear)`.
* **Destination Arrival Choices (`CFG.EXP2.ARR`, `L12288–12290`):**
  * `village`: `v1` Trade (`+100 MP, +2 renown`), `v2` Raid (`d11, notor+2, +170 MP, +20 food`), `v3` Lure (`+25 pop, +2 approval`).
  * `city`: `c1` Sack (`d15, notor+3, +320 MP`), `c2` Intel (`+2 intel, +60 MP`), `c3` Renown (`+5 renown, +5 fear, +40 MP`).
* **Random Events (`X.EXEV`, `L14163, L14180–14280, L15080–15110`):** Trigger chance `P_MV = 35%`, `P_SCOUT = 25%`, `P_CAMP (morning) = 30%`; plus at `depth >= 8`, `35%` chance (`~morning`) to draw 1 of 6 `DEEP` events.
  * *Morning/Camp-only (`3`):* `quarrel`, `whisper`, `campfire`.
  * *Road/Scout (`13`):* `merchant`, `spring`, `shrine`, `wounded`, `toll`, `storm`, `beast`, `board`, `slaver`, `chest`, `home`, `stash`, `scout`.
  * *Deep (`6`, `depth >= 8`):* `tomb` (shard), `nest` (2 eggs +80 MP or -18 dmg), `vault` (supply sabotage / +100 MP +1 intel), `deserter` (+20 pop/+10 stam or +1 gear), `pilgrim` (Wrath+10 + Grade A priestess/priest or -12 dmg), `rift` (40% S~SS mage captive or -20 dmg; or seal for shard).
* **8 Expedition Aftereffects (`X.AFTER`, `L15137–15187`):** Applied at expedition end for `1–2` waves (`clamp(mod, -2, +2)`): `supply` (all heroes `-1`), `scout` (F1–F2 heroes `-1`), `revenge` (all `+1`, from `notor>=3`), `leak` (all `+1`, from flee/lost/wipe), `desecrate` (`priest/cleric/paladin -1`, `+10 Wrath`), `merchant` (`+10%` income flavor), `hunter` (monsters floor `-1`), `royal` (all `+1`, `grand/abyss` win).

---

## 3. Situations, Town Crises, Threats & Endgame Systems

### 3.1 Realm Situations (`25`), Hero Bonds (`7`) & Stories (`8`)
* **Activation Schedule (`CFG.REALM` v1.14.0 `L14329` overridden by v1.15.2 `L15380–15406`):**
  * Unlocks at `W10`. Active caps: `W10–19` rolls `1` card (`P1 = 90%`), `W20–29` wants `1 + (P2=50% -> 2)`, `W30+` wants `2 + (P3=30% -> 3)`.
  * Cooldown: `COOL = 5` waves (`L15380`). Individual card cap `+3` (`CAP=3`); combined `(realm + bond + prep)` capped at `TOTAL_CAP = +5` (`L14468`). Casual mode or `h` setting halves positive realm penalties (`ceil(v/2)`).
  * Duration (`d[3]`): overridden in v1.15.2 (`L15381`) so `festival`, `plague`, `leak` last **`2` waves** and all others **`1` wave** (note: `alliance` retains duration `3` in `R.alliance` description/def if loop runs after, though `L15381` sets `d[3]=1` for everything except `festival/plague/leak`!).
* **25 Situation Cards:**
  * *Initial 8 (`L14330–14338`):* `iseg` (cheat hero +2 all floors; ctr `intel 2`), `leak` (stale 3w+ floor +2; ctr `150 MP`), `academy` (party -1 grade, +1 per alive ally max +2), `disarm` (rogue/ranger/disarmer/scout +2 on empty slot floors), `tamer` (+2 on ★1 mob floor / +1 on ★2+, 30% steal ★1 mob), `chosen` (1 hero +2 all floors; halved if shrine/torture Lv2+), `festival` (all +1, rewards `1.5×`), `overload` (2 random floors +2; ctr `100 MP`).
  * *Added 17 (`L14756–14773`):* `saint` (+2 lewd/mind; half if corr>=60 prisoner), `revenge` (+2 for comrade or -2 if prisoner deployed), `alliance` (all +1; ctr `intel 1`), `princess` (allies +1, princess +2; capture +300 MP), `regress` (+3 on 2w+ unchanged floor), `charm` (+2 lewd/bind; half if lewdmart Lv2+), `bounty` (-120 MP cure if breached; ctr `1 AP`), `purify` (+2 lewd/mind/mutate; ctr `1 AP` requires `shrine>=1`), `spy` (+2 random floor; ctr `1 AP`), `plague` (+1 mob floor, 10% mob die; ctr `1 AP`), `tax` (`1.5×` upkeep or 100 MP; ctr `1` prisoner tribute), `riot` (+1 deep floors 5F+ if >=3 high-resist prisoners), `exile` (1 hero +3, others -1), `knightess` (female knight +2 lewd/mind), `mass` (all +1; ctr `intel 1`), `broadcast` (all +1; defend for +2 fame +3 fear), `gacha` (random tag +2 per hero; ctr `intel 1`).
* **7 Bonds (`X.BONDS`, `L14376–14378`):** `lovers, siblings, mentor, friends, rivals, knight, fiance` (`bondP` = 0% `<W5`, 30% `W5+`, 60% `W15+`, 80% `W25+`, ±3 cap).
* **8 Hero Stories (`X.STORIES`, `L14380–14388`):** `revenge, family, merc, honor, last, curse, oracle (W20+), promise` (`25%` `<W15`, `45%` `W15+` on B+ hero).

### 3.2 Settlement Crises (`16`) & Location Explore Events (`20`)
* **Settlement Crises (`CFG.TOWN.SEV`, `L3020, L3215–3239, L7153–7180`):**
  * Rolls at `msettle` with **`P = 0.70`**, **`CD = 4`** waves per crisis ID (`slast` applies `0.2×` weight penalty to last 2 triggered), weighted by severity distance (`X.SEV_DIST`). Must choose one of 2 options before leaving `msettle`.
  * **12 Condition-Gated (`L3215–3239`):** `famine` (food<25), `unrest` (app<30), `smuggler` (order<30), `fire` (housing<25, `w=2`), `plague` (housing<25 & pop>=100, `w=2`), `envoy` (renown>=60), `caravan` (renown>=50 & app>=60), `harvest` (app>=70 & food>=50), `migrants` (pop>=90% cap or housing>=70), `pilgrims` (fear>=50 or shrine>=1), `bumper` (food>=60 & farmland>=2), `militia` (order>=70 & app>=60).
  * **4 Always-Eligible Filler (`w=0.6`, `L7153–7158`):** `bards`, `peddler`, `rumor`, `storm`.
* **Location Explore Events (`CFG.EVENTS`, `20` events, `L2429–2500`):** Triggered via Estate Explore (`1 AP`) across 9 `loc` values (`square: 3, inn: 2, market: 2, brothel: 2, smithy: 2, spy: 2, shrine: 2, manor: 2, annex: 1, office: 2`).

### 3.3 4 Major Crises, Legendary EPICs & Relics (`CFG.CRISIS`, `CFG.EPIC`, `L9378–9655, L13977`)
* **4 Major Crises (`CFG.CRISIS`):**
  1. **Holy Crusade (`c.cr`, `FROM = 25`):** `wrath` gauge (`WRATH_SHOW = 15`) shifts `+6` per hero kill/capture (`KILL`), `+4` on 3+ consecutive kill waves (`STREAK_N=3`), `-6` cool per wave (`COOL=6`) or `-12` (`COOL0=12`) on zero kills; `+5` on executions (`EXEC`); `+10` on pilgrimage desecration. Reaching `100` schedules a **3-wave gauntlet** (`CR_GAP = 2`, `CR_CD = 12`): Crusaders (`SS/SSS`), Wave 3 led by EPIC **Grand Master Paladin** (`gm`, Sanctum ability `d20+13 vs DC` -> `+2` allies or `-1` resolve). Victory yields Title `성전 분쇄자`, `fame = MAX`, and 1 Relic (`X.RELICS`).
  2. **Legendary Nemesis (`c.leg`, `FROM = 25`):** `v1.12.3` (`L13977`) raised trigger chance to **`LEG_P0 = 8% + 3%/wave + 8% if nemesis queued`**, max **`50%`** (`LEG_MAX = 0.50`). Escaped `A+` heroes are stored in `nemesis` (max 3) with per-floor signatures (`sigs`). Returns as EPIC (`kind="nem"`) with **Memory (`+3` on unchanged floors)** and **Adaptation** (`adapt[p]`, loses weakness after taking a hit from that inclination).
  3. **Royal Army Siege (`c.siege`):** Unlocks `W20+` when `town.lv >= 4` or (`lv >= 3` & `total fac >= 12`). Chance `3%` + bonuses (`+6%` fame>=7, `+6%` order<40, `+8%` per annexed war rival, `+4%` nobreach>=5; cap `35%`, `CD = 8`). Runs **3-day Bo3 `d20 + siegeDef >= 20 + floor(w/2) + day*2`** at `msettle`. Win: `+50+5w MP`, `+2` fame, Grade A Royal Knight-Captain captive, Title `성읍의 수호자`. Loss: `-15%` pop (`×0.5` casual), `-10` order, `-1` random facility level.
  4. **Prison Jailbreak (`c.jail`):** When `>= 3` prisoners have `resist >= 60`, **`15%`** roll (`7.5%` if a prisoner is assigned `trusty`). Next `msettle`: `d20 + 3*watch + 2*guards + floor(fear/10) + (trusty?5:0)` vs `15 + 2 * #high_resist`. Fail frees instigators & promotes them into `nemesis`; Success adds `+5` fear and `-10` resist.
* **4 Relics (`X.RELICS`, `L9485`):** `shield` (`1F DC +1`), `chalice` (`+2 fear` per raid), `crown` (`+10%` base estate income), `lens` (`+1 intel` per party). Earned by beating Crusade Wave 3, defeating Legendary Nemesis, or exchanging 3 Expedition Shards.

### 3.4 Towns Lv 6–7, Landmarks, Endgame War, Wonders, Rank Trials, Guild Prep & Grit
* **Town Lv 6–7 & 3 Landmarks (`CFG.LM`, `L12920–12965`):**
  * Lv5->6 (`왕도`, `cost 1600, fac 20, pop 1600`): unlocks `hq` (원정대 본부, `600 MP`, crew `4`, camp `+25`, flee `-2%p`). Daily upkeep `40 MP`.
  * Lv6->7 (`마도`, `cost 2600, fac 26, pop 2400`): unlocks `lab` (마도 연구소, `900 MP`, `+1 DC` on 2 floors) & `cmd` (마왕군 사령부, `900 MP`, `+1 DC` on guard floors). Daily upkeep `80 MP`.
* **Rival Territory War (`CFG.WAR`, `L9657–9753`):** Unlocks `W12+, lv >= 3` (or post-ending). 3 rivals (`paladin`, `merchant`, `witch`). `Scout` (1 AP), `Raid` (`2 AP`, Bo3 `d20 + warPower vs def`), `Annex` (`2 AP`, requires 2 raid wins, `def + 5`). Annexed grant `30 + 10*lv - 10` MP/settle + passive bonus (and `+8%` Siege chance each).
* **3 Great Wonders (`CFG.WONDER`, `L9659`):** `spire` (`1000 MP`, guild scout delay `-1`), `temple` (`2500 MP`, `+3 fear, +3 lust` per raid), `gold` (`5000 MP`, `+15%` ransom/sale price).
* **Post-Ending Rank Trials (`CFG.RANK`, `L9660, L9754–9778`):** Cycles 4 trials every `5` waves (`wipe3`, `jobs5`, `annex1`, `epic`), awarding titles `마왕 서열 1..N`.
* **Guild Counter-Gear Prep (`CFG.GPREP`, `v1.15.2 L15409–15439`):** Starting `W10`, `gprep.lv` (`0..5`) increases on wipes (`+1`) or `>=3` waves with same dungeon signature (`+1`), decreases on breach (`-1`) or layout change (`-1`). Grants heroes `+1`/`+2` against top 1–3 most-used dungeon trap tags (`PREP_TBL`).
* **High-Grade Resolve / Grit (`CFG.GRIT`, `v1.15.2 L15499–15538`):** `SS = 3`, `SSS = 4`, `EPIC = 5` resolve points. Killing hit consumes `2` resolve, capture consumes `1` resolve, keeping the hero `alive` (wounded/severe) instead of dropping.

---

## 4. Album Unlock System & Asset Cross-Check

### 4.1 Categories & Subcategories (`X.ALB_CATS`, `X.ALB_SUBS`, `L6877–6879, L13056–13058`)
7 top-level categories in `album` state ledger (`{ [key]: unlockedWave }`):

| Cat | Label (KO) | Subcategories (`X.ALB_SUBS`) |
|:-:|:---|:---|
| `P` | 인물 (Officers) | `V` (베스퍼), `L` (릴림), `E` (엘레오노라) |
| `D` | 상환일 (Debt) | `intro, ontime, extra, newquest, quest_ok, quest_fail, ent_ok, ent_fail, ext, forgive, prepay, seize, hand, hand_m, late, late2` |
| `T` | 영지 (Estate) | `act` (행동), `fac` (시설), `evt` (행사), `sev` (사건), `ex` (둘러보기), `town` (영지 단계), plus `cr` (위기), `war` (전쟁) |
| `J` | 감옥 (Prison) | `train`, `shame`, `fear`, `soft`, `use`, `dark`, `fate`, `job`, `mark`, `pr`, plus `raid` (침입 CG & EPIC 포획) |
| `N` | 엔딩 (Endings) | `end` (엔딩), `go` (게임오버), `rank` (서열전) |
| `S` | 시작·요청 (Cards) | `open` (시작), `sd` (요청 카드 `dk_base_*`), `fl` (층 배치 `dk_fl_*`) |
| `X` | 원정 (Expedition) | `road` (길), `fight` (전투), `camp` (야영), `arrive` (도착), `region` (지역) |

### 4.2 4 Unlock Triggers, Aliases & Male Variants
1. **Opening (`greetApply`, `L5973`):** Unlocks `dk_open_1..3` on game start.
2. **Journal Line Hook (`X.line -> X.artFromLine`, `L6671–6710, L9639, L12036–12043`):** Immediately adds unlocked CG + officer stage portraits (`dk_pt_{v|l|e}_{n}`) to `album`. If prisoner involved is `male` (`L.male = true`) and `X.MALE_OK[baseKey]` exists, substitutes `_m` key (`L6670`).
3. **Narration Card Pickers (`X.artKey`, `reqArtKeys`, `pickArt`, `exArtPick`):** Unlocks debt (`X.DEBT_ORDER`), raid stamps (`dk_base_raid_*`), `raid_cg` (`dk_raid_climax`, `dk_raid_crest`, `dk_raid_slime`, `dk_epic_captive` + `_m`), endings (`dk_end_*` / `dk_go_*`), and expedition cards (`dk_exd_*`, `dk_exr_*`).
4. **Dynamic Runtime Checks (`X.albOpen`, `L6890–6897`):** Automatically opens `dk_pt_{v|l|e}[_{2..5}]` when `X.stage >= n` and `dk_town_{lv}` when `town.lv >= lv`.
* **Aliases (`X.ART_ALT`, `L5936–5937`):** `dk_stage_v3 <-> dk_int_v5`, `dk_stage_l3 <-> dk_int_l5`, `dk_stage_e3 <-> dk_int_e5`, `dk_int_e10 <-> dk_end_dowry`, `dk_end_bankrupt <-> dk_go_bankrupt`.
* **In-Narration Illustration Prompt Injection (`X.anchorText`, `L6752–6758`):** When art triggers on a Day/Debt/End narration post, Lua injects `[Illustration] ... <X.ART_ANCHOR[key]> ...` as guiding beat context.

### 4.3 Audit vs `app/src/data/assetManifest.ts` & `GalleryModal.tsx`
* **Asset Count Discrepancy Verified:**
  * `app/src/data/assetManifest.ts` bundles **`348`** `SCENE_ASSETS` keys.
  * `_reference/dungeon_keeper.lua` references `357` distinct `dk_*` literal art keys (`368` before stripping dynamic/state variable prefixes).
  * **10 keys in Lua patterns absent from `SCENE_ASSETS`:** `dk_act_granary`, `dk_base_load`, `dk_base_raid_` (dynamic concatenation prefix), `dk_fac_torture`, `dk_fl_fighter`, `dk_stage_e` (dynamic prefix), `dk_stage_e3` (aliased to `dk_int_e5`), `dk_stage_l` (prefix), `dk_stage_v` (prefix), `dk_war_raid`.
  * **1 key in `SCENE_ASSETS` absent from Lua `X.ALB`:** `dk_fl_display` (present in TS manifest; Lua `v1.9.1` uses `dk_fl_fighter` / `dk_fl_monster` / `dk_fl_link`).
  * **Expansion Regions Without Art Keys:** `hotspring` and `market` (`v1.13.0`) do not define `dk_exr_hotspring` or `dk_exr_market` in `X.ALB` or `SCENE_ASSETS`.
* **Standalone Phase 1 Gap (`GalleryModal.tsx`):** Currently displays a flat grid of all 348 bundled `SCENE_ASSETS` plus `NPC_ASSETS` unconditionally unlocked, without `P/D/T/J/N/S/X` category tabs, dynamic `albOpen` status, `_m` grouping, or persistence.

---

## 5. 5 Canonical Endings & 5 Game Overs

### 5.1 5 Canonical Endings (`X.ENDS`, `_reference/lorebook/16_DK_SYS_Ending.md`)
All non-bankrupt endings set `endings[key] = wave`, zero `debt` (except `prosperity`), transition into **Infinite / Endless Mode** (`Rank Trials`), and trigger `〔DK-END〕` narration (`L2225–2233`).

| # | Key | Title (KO) | Condition | Lorebook Section | Debt / Post-Ending Behavior |
|:-:|:---|:---|:---|:---|:---|
| 1 | `romance` | 연애 | `debt <= 0` (via `pay` or `finishDebt`) with `dk_aff_e >= 90` (`payoffEnding`, `L2218–2224`) | `romance` | `debt.ended = "romance"`, `debt = 0`; Eleonora stays as lover & partner; Endless mode continues. |
| 2 | `romance_dowry` | 지참금 | Trigger `E10` (`이 계약서를 찢어 버려`) at **Eleonora Stage 5**, `debt <= 600` (`L1844–1880` note: shared debt-relief cap logic applies) | `romance_dowry` | Calls `X.endGame(id, "romance", "romance_dowry")`; sets `art_end = "romance_dowry"` -> unlocks `dk_end_dowry` (`X.ART_ALT` <-> `dk_int_e10`); Endless mode. |
| 3 | `liberation` | 해방 | `debt <= 0` with `dk_aff_e < 90` | `liberation` | `debt.ended = "liberation"`, `debt = 0`; Free from Goldreich; Endless mode continues. |
| 4 | `prosperity` | 번영 | Upgrade Town to **Level 5** (`X.townUp`, `L2427`) | `prosperity` | **Does NOT clear `debt`** (`L2228`); unlocks `prosperity` ending while Debt cycle continues alongside Lv6–7 Town expansion & Endless mode. |
| 5 | `bankrupt` | 파산 | Reach **`lates >= 3`** during a Debt Settlement (`finishDebt`, overridden `L3437–3439`) | `bankrupt` / `go_bankrupt` | Sets `debt.ended = "bankrupt"`, `debt = 0`, AND calls `X.enterOver("bankrupt")` -> **enters Game Over (`mode = "over"`)** (`dk_end_bankrupt` <-> `dk_go_bankrupt`). |

### 5.2 5 Game Overs (`X.goKo`, `X.flagOver`, `X.enterOver`, `L3408–3460, L8671–8690`)
`flagOver(id, key)` queues `go_pending` (resolved at `confirmResult` or `msConfirm`). `enterOver` sets `mode = "over"`, logs `endings["go_"..key] = wave`, and offers **Rewind (`go_rewind` to `autosave` wave start)**, Load Slot, or Reset.

| # | Key | Title (KO) | Exact Trigger Condition | Protection / Casual Grace (`L8674–8689`) |
|:-:|:---|:---|:---|:---|
| 1 | `ruin` | 폐허의 영주 | Estate `msettle`: `town.pop <= 0` | Casual grace (`1/run`): restores `pop = max(pop, 15)`. |
| 2 | `famine` | 버려진 땅 | Estate `msettle`: `town.famine >= 3` (`food <= 0` for 3 consecutive waves) | Casual grace (`1/run`): resets `famine = 0`, `food = max(food, 30)`. |
| 3 | `riot` | 단두대의 마왕 | Estate `msettle`: `town.riot >= 3` (`approval <= 10 && order <= 10` for 3 consecutive waves) | Casual grace (`1/run`): resets `riot = 0`, `approval +15`, `order +15`. |
| 4 | `core` | 코어 파괴 | Dungeon breached with `dk_points <= 0` (`mp0 <= 0`) | **Vault Guard:** If Estate Vault `v.mp >= 50` (`CFG.ECON.CORE`), spends `50` vault MP to restore Core `+50` MP and prevents Game Over (`L8674–8677`). Casual grace: `+50` MP. |
| 5 | `bankrupt` | 파산 | Debt `lates >= 3` (`X.endGame("bankrupt")`) | Rewindable via wave-start `autosave`. |

---

## 6. Graduation Recommendations (Fog of War -> Phase 3 Tickets)

The Lua audit removes specification ambiguity for **two** major Fog of War areas in `wayfinder/MAP.md`, which are ready to graduate into concrete decision tickets:

1. **Graduate `Phase 3 Detailed UX & Balancing` into two scoped decision tickets:**
   * **`08-decide-phase3-monsters-expeditions`:** Decide UI/UX, state slices, balancing toggles, and AI narration integration for the **28-Monster Pen & Floor Deployment Board** (slots, links, breeding/evolution/disposal, upkeep toggle) and the **Expedition Mini-Map & `exped` Phase** (crew picker, 5 lengths, 13 regions, 22 events, auto-progress stop controls, relic shards, aftermath).
   * **`09-decide-phase3-crises-endgame`:** Decide UI/UX and difficulty/visibility controls for **Realm Situations (`25`) / Bonds / Stories**, **Settlement Crises (`16`) & Location Explore Events (`20`)**, **4 Major Crises** (Crusade wrath bar, Nemesis tracking, Siege Bo3, Jailbreak), **Rival War / Wonders / Town Lv6–7 Landmarks**, and **Guild Prep + High-Grade Grit**.
2. **Graduate `Gallery Unlock Persistence vs Sandbox Mode` into one decision ticket:**
   * **`10-decide-gallery-unlock-endings`:** Decide **`GalleryModal.tsx` Unlock Persistence vs Sandbox / Spoiler-Free Toggle** (tracking the 7-category `album` ledger across `localStorage` meta-save vs per-run, reconciling the `348` bundled `SCENE_ASSETS` vs `357` Lua keys, and `_m` variant filtering) + **Ending / Game Over Modal & Post-Ending Infinite (`Rank Trials`) + Wave-Start Rewind UX**.
3. **Keep in `## Not yet specified` (out of Ticket 06 scope):**
   * **Audio & Feedback Polish** (SFX/chiptune design needs separate implementation/UX research, not in Lua source).
   * **Distribution Packaging** (PWA / Electron / Tauri / static hosting pipeline).
