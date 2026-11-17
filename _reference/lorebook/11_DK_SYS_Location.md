# DK_SYS_Location
- order: 35, constant: True, enabled: True, keys: ['__dk_lua_only_Location__']

{{#when::dk_loc_name::visnot::-}}
[Location — {{getvar::dk_loc_name}}]
{{getvar::dk_loc_text}}
{{/when}}
