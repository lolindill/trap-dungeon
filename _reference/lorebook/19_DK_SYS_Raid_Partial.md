# DK_SYS_Raid_Partial
- order: 900, constant: False, enabled: True, keys: ['__dk_lua_only_Raid_Partial__']

(OOC — narrate the final scene of wave {{getvar::dk_wave}}.){{#when::dk_raid_first::vis::1}} Open with the party stepping through the dungeon gate.{{/when}}
Final ruling (fixed, do not change):
{{getvar::dk_last_result}}
Defense partly failed: the heroes still standing reached the Core Room, tore away part of the Core's mana and fought their way out through the domain above — wrecking stalls, cutting down townsfolk who got in the way; the dungeon survives, and heroes marked KILLED or CAPTURED stay fallen. Then Lilim sulks, reports which rooms they slipped through and swears to get the survivors next time, while Vesper notes the losses with a dangerous smile.
Show the breach as it happens — the Core Room fight, the mana being torn out, then the rampage through the town street by street — before Vesper and Lilim react.{{#when::dk_breach_damage::visnot::-}} {{getvar::dk_breach_damage}}{{/when}}
For every CAPTURED hero show the defeat live: how the room overpowers them, how they are pinned, stripped or bound, what they say, and the goblins dragging them off. For every KILLED hero show the blow that ends them, not just the body afterwards.
