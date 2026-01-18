export const GOD_EXAMPLE = `---
title: The Rosetta Stone
composer: Test Suite
time: 4/4
key: C major
tempo: 120
&right:
  clef: treble
&left:
  clef: bass
---
// Part 1: Basics, Durations, and Articulations
&right {
  // Simple notes and durations
  C/4 D/8 E/16 F/32 G/1
  // Dotted notes
  A/4. B/8. C+/2..
  // Articulations on single notes
  st(C) tn(D) ac(E) mc(F) fm(G) tr(A)
}
&left {
  // Rests matching above
  _/4 _/8 _/16 _/32 _/1
  _/4. _/8. _/2..
  C/4 D/4 E/4 F/4 G/4 A/4
}

// Part 2: Dynamics and Hairpins
&right {
  // Inline dynamics
  p(C D E F) f(G A B C+)
  // Hairpins via annotation
  C D E F { cresc(1-4) }
  G F E D { decresc(1-4) }
  // Mixed
  mp(C) mf(D)
}
&left {
  // Chords
  [C E G]/2 [D F A]/2
  // Chord with articulations
  st([C E G])
  // Dynamic on chord
  ff([C E G])
}

// Part 3: Grouping and Beams
&right {
  // Beams
  =(C D E F)
  =(C/8 D/16 E/16)
  // Nested groups (if supported, otherwise complex sequence)
  =(C D =(E F)) 
}
&left {
  // Clef change (if supported mid-stream, otherwise just notes)
  C D E F
}

// Part 4: Advanced Syntax
&right {
  // Octaves and Accidentals
  C# Db E## Fbb G+ A- B++ C--
  // Slurs and Ties
  C D E F { slur(1-4) }
  C ^ C
  // Manual text and fingering
  C { text("hello") } D { finger(1) }
}
&left {
  // Syncopation / weird durations
  C/8 _/8 C/4 _/4 C/2
}
`;
