# DK_SYS_Heroes
- order: 25, constant: True, enabled: True, keys: ['']

{{#when::dk_party_on::vis::1}}
[Heroes — the Guild's current party; ranks, traits and statuses come from the system]
{{getvar::dk_heroes_text}}
{{/when}}{{#when::dk_gender_rule::vis::female}}
All heroes in this party are women.{{/when}}{{#when::dk_gender_rule::vis::male}}
All heroes in this party are men.{{/when}}
