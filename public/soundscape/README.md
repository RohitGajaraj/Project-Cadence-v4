# Flow-mode soundscapes

Drop the looping ambient tracks for Flow mode (OPS-01) here. The player
(`src/lib/flow/soundscape.ts`) fetches and gaplessly loops one file per preset.
Until a file exists, that preset shows "This sound has no track yet" and stays
silent. The rest of Flow mode (dim, timer, notification quieting) works without
any audio.

## Files to add (exact names)

| Preset    | File            | What works well                          |
| --------- | --------------- | ---------------------------------------- |
| Rain      | `rain.mp3`      | Steady rain, no thunder spikes           |
| Ocean     | `ocean.mp3`     | Slow, even waves                         |
| Forest    | `forest.mp3`    | Birdsong + light wind, no sudden calls   |
| Lo-fi     | `lofi.mp3`      | Calm instrumental loop, no vocals        |
| Heartbeat | `heartbeat.mp3` | Slow, soft heartbeat (~60 bpm)           |

Format: `.mp3` (universal browser support, including Safari). A 1 to 3 minute
clip that loops cleanly is ideal; the player loops it without a gap. Keep each file
roughly 1 to 3 MB so the bundle stays light.

## Where to get them (royalty-free only)

Use only tracks cleared for commercial use. Best sources, no attribution
required:

- Pixabay (pixabay.com/music, pixabay.com/sound-effects) - Pixabay Content License
- Mixkit (mixkit.co/free-stock-music, /free-sound-effects) - Mixkit License
- Uppbeat (uppbeat.io) - free tier, check per-track terms
- Freesound (freesound.org) - filter to CC0 only

Do not commit copyrighted music or anything you cannot point to a license for.

## Record what you used

Fill this in for each file you add, so the licensing is auditable:

| File          | Source URL | License | Added by | Date |
| ------------- | ---------- | ------- | -------- | ---- |
| rain.mp3      |            |         |          |      |
| ocean.mp3     |            |         |          |      |
| forest.mp3    |            |         |          |      |
| lofi.mp3      |            |         |          |      |
| heartbeat.mp3 |            |         |          |      |

Prefer the OGG/MP3 you can audition first. If you want a different set of
presets, edit `SOUND_PRESETS` and `presetSrc()` in `src/lib/flow/session.ts`.
