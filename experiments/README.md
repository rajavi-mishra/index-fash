# Experiments

Prototypes that aren't wired into the shipped ingest pipeline
(`scripts/ingest/`) or the dashboard yet. This is where the README's roadmap
items ("own the visual signal", "a Cultural Index") get spiked before they're
worth the commitment of a real source adapter.

Each subfolder is self-contained: its own README, its own `data/` (gitignored
except for seed/sample files), runnable on its own via `tsx`. Nothing here is
imported by `src/` or `scripts/ingest/`.

- [`dua-lipa-bags/`](./dua-lipa-bags/) — visual analysis of one celebrity's bag
  choices: brand, "how weird is this bag", and a sentiment read per photo.
