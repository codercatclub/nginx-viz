# Sound Files

Place your sound files in this directory with the following names:

- `spawn.mp3` - Plays when a new agent spawns
- `enter.mp3` - Plays when an agent successfully enters the castle (status code 200)
- `reject.mp3` - Plays when an agent is rejected from the castle (status code != 200)
- `ambient.mp3` - Loops continuously as background music

## Sound Requirements

- Format: MP3, OGG, or WAV
- Duration: 
  - spawn, enter, reject: 0.5-2 seconds recommended
  - ambient: Any length (will loop)
- Keep file sizes small for faster loading

## Where to Find Sounds

You can find free sound effects on:
- [Freesound.org](https://freesound.org)
- [OpenGameArt.org](https://opengameart.org)
- [Zapsplat.com](https://www.zapsplat.com)

## Volume Control

The sound system has the following volume controls (can be adjusted in code):
- Master volume: 0.5 (50%)
- Effects volume: 0.7 (70%)
- Ambient volume: 0.3 (30%)

Adjust these in `src/lib/soundPlayer.ts` if needed.
