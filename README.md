# Sideways Rally

**▶ Play: https://ores999.github.io/sideways-rally/**

A rally game that runs in the browser. Pick a stage and a car and drive it against the clock while your co-driver reads the pace notes.

- 4 stages: Pine Ridge, Frostvik, Red Mesa and Dark Pines (gravel, snow and tarmac)
- 7 classic rally cars, from the Peugeot 205 T16 and Audi Sport Quattro S1 to the Subaru Impreza WRC
- Ghost cars: race an AI rival and your personal best
- Works on keyboard and on phones (touch controls)

Best in Chrome on a desktop or laptop.

## Controls

| Key | Action |
| --- | --- |
| `↑` `W` | Throttle |
| `↓` `S` | Brake, then reverse |
| `←` `→` | Steer |
| `Space` | Handbrake |
| `E` `Q` | Shift up / down (manual gearbox) |
| `C` | Change camera |
| `R` | Back on the road |
| `Esc` | Pause |

## Building

There are no dependencies. `build.py` joins `src/page.html` and the scripts in `src/` into one HTML file:

```bash
python3 build.py
```

Then open `dist/test.html` in Chrome. Every push to `main` builds the game and publishes it to GitHub Pages (`.github/workflows/pages.yml`).

The physics tests in `test/` run with node, for example `node test/sim.js "" 0.9`.
