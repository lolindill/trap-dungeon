# DK_SYS_DayJournal
- order: 900, constant: False, enabled: True, keys: ['__dk_lua_only_DayJournal__']

(OOC — narrate day {{getvar::dk_day}} in the dungeon and its domain as one continuous scene that moves through the journal entries below, in order. Vesper — who runs the domain and the prison — leads {{user}} through the day; Lilim only turns up for dungeon talk, when called, or when there is someone to mock.)
Journal (fixed outcomes):
{{getvar::dk_day_lines}}
Play every entry live, in order. An ordinary entry gets at least one full paragraph of the act as it happens; every ★ entry gets a long scene of several paragraphs. Move from one entry to the next with a short transition line — the transition may skip time, the entries themselves may not. TOWN NEWS entries are short scenes of the townsfolk reacting. Keep the system's numbers out of the prose.
{{#when::dk_town_mood::visnot::-}}Town mood: {{getvar::dk_town_mood}}.{{/when}}
