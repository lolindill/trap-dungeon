# DK_SYS_Debt
- order: 900, constant: False, enabled: True, keys: ['__dk_lua_only_Debt__']

### intro
(OOC — narrate a sudden arrival in the dungeon; Vesper and Lilim are present.)
Eleonora von Goldreich, heiress of House Goldreich, sweeps in with a gilded contract: the previous master borrowed 3,000 MP to raise the Core, and the debt now passes to {{user}}. An installment is due every three waves (the first after wave {{getvar::dk_due_wave}}, at least {{getvar::dk_due_min}} MP, rising with each installment), with interest; three missed payments and the dungeon — and {{user}} — become Goldreich property. Play her grand entrance as a theatrical romcom ojou-sama (oh~hohoho, flustered denials) and the staff's reactions.
### visit
(OOC — narrate collection day after wave {{getvar::dk_wave}}: Eleonora von Goldreich has come in person to collect. Vesper, keeper of the treasury, handles the negotiation; Lilim heckles from the side.)
What happened, in order (fixed outcomes):
{{getvar::dk_debt_lines}}
Eleonora is {{getvar::dk_e_word}} toward {{user}}, and right now she is {{getvar::dk_pat_word}}. Play her as a theatrical romcom ojou-sama — haughty laughter, flustered denials, hopeless at intimidation — and keep numbers out of the prose except what she reads from her ledger. Play each listed event as it happens in the room — the handover, the payment counted coin by coin, any entertainment in full — before her verdict.
### quest_ok
- Her commission ({{getvar::dk_act_target}}) was fulfilled; she grudgingly strikes {{getvar::dk_act_result}} MP off the debt.
### quest_fail
- Her commission ({{getvar::dk_act_target}}) was failed, and she makes a scene about it.
### ent_ok
- ★ ENTERTAINMENT: {{user}} entertains Eleonora {{random::with a candlelit dinner in the Core Room::in a private bath::with a tour that ends in the guest bed::with a dance that gets far too close::by letting her inspect the Master personally}} — it works far too well; flushed and glowing, she cuts this installment by a quarter.
### ent_fail
- ENTERTAINMENT: {{user}} tries to entertain her, but it backfires — {{random::she trips into the fountain::Lilim ruins the mood::she declares it vulgar and storms off for a minute::the wine is cheap and she notices::Vesper's cold smile scares her off}}.
### hand
- Handed over as payment: {{getvar::dk_act_target}}, credited {{getvar::dk_act_result}} MP. {{random::Eleonora inspects the captive like livestock::Her guards haul them off in chains::She fans herself and pretends not to look::Lilim waves goodbye mockingly}}.
### pay
- Paid {{getvar::dk_act_result}} MP in mana crystals.
### extra
- Paid {{getvar::dk_act_result}} MP beyond the installment — she is visibly pleased and pretends otherwise.
### ontime
- Verdict: the installment is paid in full and on time. {{random::She huffs that it is only natural::She stamps the ledger with a little flourish::She lingers far longer than she needs to}}.
### ext
- Verdict: short by {{getvar::dk_act_result}} MP — she grants an extension, with a surcharge on the next installment and a long lecture.
### forgive
- ★ Verdict: short again — and Eleonora quietly covers it from her own purse, red to the ears, swearing it is "a loan, nothing more".
### late
- ★ Verdict: LATE PAYMENT ({{getvar::dk_act_result}}). The debt grows by a tenth, and she enforces the contract's penalty clause on {{user}} in person: {{random::a humiliating collateral appraisal of the debtor's body in front of the staff::the debtor made to serve her as a butler — and more — for the night::a lewd penalty game she obviously made up on the spot::the debtor bent over her lap for a spanking, ledger in hand::a contract signature taken with lips and tongue}}.
### seize
- Seized as collateral: {{getvar::dk_act_target}} (credited {{getvar::dk_act_result}} MP), dragged off by Goldreich guards.
### newquest
- New commission accepted: {{getvar::dk_act_target}}.
### noquest
- {{user}} declines her new commission; she sniffs.
