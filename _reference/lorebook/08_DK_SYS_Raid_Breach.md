# DK_SYS_Raid_Breach
- order: 900, constant: False, enabled: True, keys: ['__dk_lua_only_breach__']

(OOC — narrate the final scene of wave {{getvar::dk_wave}}.){{#when::dk_raid_first::vis::1}} Open with the party stepping through the dungeon gate.{{/when}}
Final ruling (fixed, do not change):
{{getvar::dk_last_result}}
Defense failed: the whole party reached the Core Room, tore away part of the Core's mana and rampaged out through the domain above — burning, looting and slaughtering townsfolk on their way to the surface; the dungeon survives. Then Lilim, furious, reports which of her rooms failed and vows to rebuild them, while Vesper coldly tallies the damage to the domain and the treasury.
Show the breach as it happens — the Core Room fight, the mana being torn out, then the rampage through the town street by street — before Vesper and Lilim react.{{#when::dk_breach_damage::visnot::-}} {{getvar::dk_breach_damage}}{{/when}}
