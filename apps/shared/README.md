# Shared density colors

Free Particle and Classical Limit use the same lookup table and fixed transfer curve from `density-colors.js`. This affects density (|ψ|²) views, profiles and their color bars; phase coloring and Many-Worlds rendering remain separate.

## Adjusting the gradient

- `STOPS` controls the colors and their positions along the bar. Each color is an sRGB triple in the range 0–1. Green extends into the lower-density tail; a broad mint-to-rose transition eases into crimson without brown or yellow. Red occupies more of the middle range while the bright magenta endpoint is preserved.
- `SHOULDER` controls the one fixed density-to-bar transform: `t = D / (D + SHOULDER)`. It does not depend on a packet's peak, width, time, viewport, or zoom. The high end approaches violet smoothly instead of hard-clipping.
- `paintLegend` paints the minimal |ψ|² bar for live scenes and export compositors.

The lookup table interpolates stops in [Oklab](https://bottosson.github.io/posts/oklab/) with shape-preserving cubic slopes. Keep the stops in increasing perceived lightness. Unlike easing each RGB segment to a stop, the continuous lightness progression avoids flat spots that look like rings within the green. All conversion happens once when constructing the table, so the renderers still perform the same inexpensive color lookup.

Edit this canonical file, then run from the repository root:

```sh
node apps/shared/sync-density-colors.mjs
node apps/shared/sync-density-colors.mjs --check
```

The script distributes identical runtime copies into each app so they can still be served and deployed independently. Classical Limit's build also synchronizes them; its check command rejects stale copies.

## Fixed units across the two solvers

The apps use different coordinate units, so the common palette input is `D = normalized probability density × fixed scene area`. These area conversions are constants, independent of the viewport and of packet preparation:

- Free Particle: 100 × 60 nm². Its analytic wave starts with unit peak, so divide raw |ψ|² by the initial Gaussian integral `2πσxσy` before applying the fixed area conversion. This is probability normalization, not automatic color exposure. A wider preparation has a lower density and different colors.
- Classical Limit: 1.6 × 1 box units². Its solver already normalizes the wave, so only the constant area conversion is needed. All free, barrier and disk scenes use it.

A Free Particle packet with σx = 2 nm and σy = 8 nm has initial D_peak ≈ 59.7. Classical Limit's quantum packet with σ = 0.065 has D_peak ≈ 60.3. At the fixed shoulder of 14 these sit near t = 0.81, reaching magenta only around their centers; the surrounding wave crosses red, green and teal. Free Particle's broader σy = 33 nm preparation peaks near D = 14.5, in the soft green transition. Still denser packets can reach violet without changing the scale.

Free Particle's y profile integrates over x; its color input retains a fixed reference x width of √(2π) × 2 nm when converting that marginal back to density units. Profile height may fit its panel, but its colors do not fit the current peak. The analytic solver and its propagation behavior are unchanged.
