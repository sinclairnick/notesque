export const BEAM_TESTS = `---
title: Beam Stress Test
&main:
  clef: treble
---
// 1. Explicit Beam Groups (Sticky Duration Check)
&main {
  // Simple 8th notes (first specifies, others inherit)
  =(C/8 D E F)
  // Simple 16th notes
  =(G/16 A B C+)
  // Mixed durations (should handle rhythm correctly)
  =(C/8 D/16 E/16 F/8)
}

// 2. Large Group
&main {
  =(C/16 D E F G A B C+)
}

// 3. Beams with Rests (if supported)
&main {
  =(C/8 _/8 D/8 _/16 E/16)
}

// 4. Nested Beams / Complex Grouping
&main {
  =(C/8 D/16 =(E/32 F/32) G/16)
}

// 5. Beams with Chords
&main {
  =([C E]/8 [D F] [E G] [F A])
}
`;

export const CHORD_TESTS = `---
title: Chord Stress Test
&main:
  clef: treble
---
// 1. Basic Triads
&main {
  [C E G] [D F A] [E G B]
}

// 2. Inversions and Spacing
&main {
  [C E G C+] [E G C+ E+] [G C+ E+ G+]
  [C/4 E/5 G/5] 
}

// 3. Chords with Accidentals
&main {
  [C# E# G#] [Db Fb Ab] [B## D# F##]
}

// 4. Chords with Durations (Sticky)
&main {
  [C E G]/2 [C E G]/4 [C E G]/8. [C E G]/1
}

// 5. Chords with Articulations/Dynamics (Inline)
&main {
  st([C E G]) 
  ac([C E G]) 
  ff([C E G])
  // Tie chord
  [C E G] ^ [C E G]
}
`;

export const RHYTHM_TESTS = `---
title: Rhythm & Tie Stress Test
&main:
  clef: treble
---
// 1. Dotted notes sticking
&main {
  C/4. D E F
  C/2.. 
}

// 2. Ties (Token based)
&main {
  // Simple tie
  C/4 ^ C/4
  // Tie across barline
  C/1 ^ C/4
  // Chord ties
  [C E G] ^ [C E G]
}

// 3. Syncopation
&main {
  _/8 C/4 C/4 C/4 C/8
}

// 4. Slurs (Inline function)
&main {
  slur(C D E F)
  slur(G A B)
}
`;

export const DYNAMICS_TESTS = `---
title: Dynamics Stress Test
&main:
  clef: treble
---
// 1. Single Dynamics
&main {
  p(C) mp(D) mf(E) f(F)
}

// 2. Group Dynamics (First note only)
&main {
  p(C/8 D E F) f(G A B C+)
}

// 3. Hairpins (Inline function)
&main {
  cresc(C D E F)
  decresc(G F E D)
  cresc(C D) decresc(E F)
}
`;

export const BASICS_TESTS = `---
title: Basics Stress Test
&main:
  clef: treble
---
// 1. Notes & Accidentals
&main {
  C D E F G A B
  C# Db E# Fb G## Abb
}

// 2. Octaves
&main {
  C3 D3 C4 D4 C5 D5
  C+ C++ C- C--
}

// 3. Fingerings
&main {
  fingering(1, C) fingering(2, D) 
  // Shorthand if parser supports it (TODO verify)
  // C-1 D-2
}

// 4. Articulations
&main {
  st(C) tn(D) ac(E) mc(F) fm(G) tr(A)
}
`;

export const CONTEXT_TESTS = `---
title: Context Change Stress Test
&part1:
  clef: treble
&part2:
  clef: bass
key: C
time: 4/4
---
// 1. Initial State (C Major, 4/4)
&part1 { C D E F }
&part2 { C D E F }

// 2. Key Change (G Major)
---
key: G
---
&part1 { G A B C+ }
&part2 { G A B C }

// 3. Time Change (3/4)
---
time: 3/4
---
&part1 { C D E }
&part2 { C D E }

// 4. Key + Time Change (F Major, 6/8)
---
key: F
time: 6/8
---
&part1 { C/8 D E F G A }
&part2 { C/8 D E F G A }
`;

export const GRACE_TESTS = `---
title: Grace Note Stress Test
&main:
  clef: treble
---
// 1. Single Grace Notes
&main {
  \`C D \`E F \`G A
}

// 2. Grace Notes with Accidentals/Octaves
&main {
  \`C# D \`Eb F \`G+ A
}

// 3. Multiple Grace Notes (not officially supported by parser per note, but let's see)
// Currently 'GRACE' token consumes only ONE note.
// So \`C \`D E would be two grace notes then E.
&main {
  \`C \`D E
}
`;

export const FINGERING_TESTS = `---
title: Fingering Stress Test
&main:
  clef: treble
---
// 1. Standard Fingering (@1-5)
&main {
  C@1 D@2 E@3 F@4 G@5
}

// 2. Fingering with Duration/Accidentals
&main {
  C#@1 D/8@2 E+@5
}

// 3. Function-style Fingering
// (If parser supports finger(1, C))
&main {
  finger(1, C) finger(5, G)
}
`;
