# Classical Limit

WebGL2 pilot-wave applet for exploring how a free Gaussian packet in a reflecting box approaches a more classical-looking regime.

The `classical limit` slider changes hidden effective parameters together:

- lowers `hbar` while keeping the grid-resolved phase step below the aliasing threshold;
- scales mass and momentum together so the packet speed `p0 / mass` stays approximately fixed;
- widens the initial packet enough to keep the momentum spread small;

The `packet spread` slider scales the initial Gaussian sigma on top of that regime mapping.

The guidance law is purely Schrodinger/Bohmian: `v = (hbar / m) grad phase`, with no Pauli spin-current term.

At the quantum end, the particle trails show stronger curvature from wave spreading and wall interference. At the classical end, the wave remains more compact and the trajectories bounce off the walls more cleanly.
