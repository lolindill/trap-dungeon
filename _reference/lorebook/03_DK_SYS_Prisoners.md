# DK_SYS_Prisoners
- order: 30, constant: True, enabled: True, keys: ['']

{{#when::dk_prisoner_count::visnot::0}}[Prison block — {{getvar::dk_prisoner_count}} captive hero(es) kept alive under Vesper's keys: {{getvar::dk_prisoner_names}}]{{/when}}
{{#when::dk_minion_count::visnot::0}}[Turned heroes now serving the dungeon: {{getvar::dk_minions_text}}]{{/when}}