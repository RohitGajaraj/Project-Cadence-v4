# Flow-mode soundscapes

Looping ambient tracks for Flow mode (OPS-01). The player
(`src/lib/flow/soundscape.ts`) fetches and gaplessly loops one file per preset.
Until a file exists, that preset shows "This sound has no track yet" and stays
silent; the rest of Flow mode (dim, timer, notification quieting) still works.

Generated with **ElevenLabs Sound Effects** (MCP). The set favors soft,
continuous textures (no hard strikes or plucks) so each one soothes rather than
grates. This is an **experimental free-tier set** generated 2026-06-17.

## Current set (free tier, all Sound Effects, 5s, looped)

| Preset    | File            | Vibe                                     | Prompt used |
| --------- | --------------- | ---------------------------------------- | ----------- |
| Ocean     | `ocean.mp3`     | Calm beach waves                         | "Calm ocean waves washing gently onto a sandy beach, slow and rhythmic, soft and soothing, distant and continuous." |
| Monsoon   | `monsoon.mp3`   | Indian monsoon rain + faint temple bells | "Gentle Indian monsoon rain falling steadily, soft and even, faint distant temple bells now and then, peaceful, no thunder." |
| Bansuri   | `bansuri.mp3`   | Soft bamboo-flute texture                | "A soft slow Indian bamboo flute (bansuri) playing long gentle sustained breathy notes, warm and airy, meditative, no percussion." |
| Forest    | `forest.mp3`    | Himalayan dawn forest                    | "Calm Himalayan forest at dawn, gentle birdsong, soft distant mountain stream, light wind in the trees, no sudden sounds." |
| Heartbeat | `heartbeat.mp3` | Bass-rich realistic heartbeat (~75 bpm)  | "Deep bass-rich realistic human heartbeat, strong clear lub-dub thump, about 75 beats per minute, close and warm, steady." |
| Fireplace | `fireplace.mp3` | Cozy crackling fire                      | "A gentle crackling fireplace, warm cozy soft pops and glowing embers, steady and continuous, soothing, no loud snaps." |

The player is generic: change the set by editing `SOUND_PRESETS` and
`presetSrc()` in `src/lib/flow/session.ts`, the `PRESET_LABEL` and default in
`src/components/cadence/FlowWidget.tsx` + `src/hooks/use-flow-mode.tsx`, and
dropping matching `<preset>.mp3` files here.

---

## TODO when on a paid ElevenLabs plan (pick up here)

**Why deferred:** the **Music API (`compose_music`) is paid-only** (free tier
returns HTTP 402 `paid_plan_required`). Sound Effects also cap at **5 seconds**.
So real melodic / cultural *music* could not be generated. When on a paid plan,
do this:

1. Use the MCP tool **`compose_music`** (not `text_to_sound_effects`) for music,
   with a longer `music_length_ms` (try 30000 to 60000). Longer clips loop far
   better for melody than a 5s SFX clip.
2. Generate these presets and audition them:

   | Preset (new/replace) | Intent | Suggested `compose_music` prompt |
   | --- | --- | --- |
   | **Lo-fi raga** (add) | Fun, different mood: downtempo study music | "Mellow lo-fi chillhop infused with a subtle Indian raga, soft sitar and light tabla, warm vinyl texture, relaxed downtempo, no vocals, loops smoothly." |
   | **Bansuri melody** (replace the SFX texture) | A real flute melody, not just a sustained tone | "Soft slow Indian bamboo flute (bansuri) playing a gentle meditative raga melody over a quiet tanpura drone, warm and airy, no percussion, calm." |
   | **Balinese / gamelan calm** (add, optional) | Cultural calm the founder asked about | "Soft, slow Balinese gamelan, gentle shimmering metallophones, meditative and spacious, calm and soothing." Audition carefully: gamelan is metallic-percussive and may "hit hard" like the rejected presets below. |
   | **Tanpura drone, smoother** (optional revisit) | The original idea, done as a long smooth drone | "A long, smooth, sustained Indian tanpura drone, soft and continuous, warm overtones, no sharp plucking, meditative." Use a long music clip so the pluck attack is rare, not every 5s. |

3. Save each as `<preset>.mp3` here, then wire the preset in the three files
   listed above (type, list, label, default).
4. Re-confirm the **commercial license** (below) for the paid tier and fill the
   provenance table.

## Tried and rejected (do not just redo these the same way)

- **Tanpura (SFX) and Singing bowls (SFX)** were generated first and removed: the
  founder found them harsh. Root cause: both are *transient* sounds (plucks /
  strikes) and a 5s SFX loop repeats that attack every 5 seconds, so it "hits"
  over and over. Lesson: on the 5s SFX path, prefer *continuous* textures (water,
  fire, rain, wind, forest); save plucked / struck / melodic instruments for the
  paid Music API with a long clip.

## Licensing gate (read before treating as production assets)

On the ElevenLabs **free tier**, generated audio is typically non-commercial /
attribution-required. These files are committed as an **experimental** set; do
**not** treat them as cleared production assets until the commercial-use terms
are confirmed (likely a paid tier). Record it here.

| File          | Source         | License (confirm) | Added | Date       |
| ------------- | -------------- | ----------------- | ----- | ---------- |
| ocean.mp3     | ElevenLabs SFX | free tier (confirm) |     | 2026-06-17 |
| monsoon.mp3   | ElevenLabs SFX | free tier (confirm) |     | 2026-06-17 |
| bansuri.mp3   | ElevenLabs SFX | free tier (confirm) |     | 2026-06-17 |
| forest.mp3    | ElevenLabs SFX | free tier (confirm) |     | 2026-06-17 |
| heartbeat.mp3 | ElevenLabs SFX | free tier (confirm) |     | 2026-06-17 |
| fireplace.mp3 | ElevenLabs SFX | free tier (confirm) |     | 2026-06-17 |
