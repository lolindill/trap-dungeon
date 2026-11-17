# DK_SYS_Mode
- order: 10, constant: True, enabled: True, keys: ['']

@@depth 0
[DUNGEON SYSTEM]
{{#when::dk_mode::vis::estate}}
ESTATE MANAGEMENT, day {{getvar::dk_day}}: the last invasion is over and the books are not yet settled; {{user}} is dealing with the prisoners, the staff and the domain above the dungeon. No invasion. Heroes appear only when the system sends them.
{{/when}}{{#when::dk_mode::vis::build}}
CONSTRUCTION mode: {{user}} is installing and upgrading traps with Lilim's goblin crew; new traps stay unrated until construction ends. No heroes yet.
{{/when}}{{#when::dk_mode::vis::prep}}
PREPARATION for wave {{getvar::dk_prep_wave}}: Lilim is reviewing the dungeon (Vesper only checks the bill); the Guild's party of three is {{#when::dk_heroes_ready::vis::1}}known (see [Heroes]) but not inside yet{{:else}}not revealed yet{{/when}}.
{{/when}}{{#when::dk_mode::vis::raid}}
INVASION, wave {{getvar::dk_wave}}: the party is at {{#when::dk_floor::vis::0}}the entrance{{:else}}floor {{getvar::dk_floor}}{{/when}}, {{getvar::dk_alive}}/3 standing. Only the system's 〔DK-RAID〕 rulings decide who passes, falls or flees.
{{/when}}{{#when::dk_mode::vis::result}}
SETTLEMENT: wave {{getvar::dk_wave}} is over.{{#when::dk_await::vis::0}} {{getvar::dk_settle}}{{/when}}
{{/when}}{{#when::dk_mode::vis::debt}}
COLLECTION DAY after wave {{getvar::dk_wave}}: Eleonora von Goldreich is here in person to collect an installment. Only the system's 〔DK-DEBT〕 ruling decides what was paid.
{{/when}}
MP {{getvar::dk_points}} · waves {{getvar::dk_wave}} · notoriety {{getvar::dk_fame}}/10 · prisoners {{getvar::dk_prisoner_count}}{{#when::dk_aura::visnot::-}} · {{getvar::dk_aura}}{{/when}}
{{#when::dk_moods::visnot::-}}Moods — {{getvar::dk_moods}}{{/when}}
{{#when::dk_debt_line::visnot::-}}{{getvar::dk_debt_line}}{{/when}}
{{#when::dk_domain_line::visnot::-}}{{getvar::dk_domain_line}}{{/when}}
