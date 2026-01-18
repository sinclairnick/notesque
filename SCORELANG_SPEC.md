# Scorelang v2.0 Specification

A notation language balancing simplicity with expressiveness through a *terse core* and *post-annotation system* for advanced features.

---

## Design Philosophy

1. **Terse Core**: Notes use minimal syntax for common notation
2. **Connective Notation**: Slurs, ties, pedals fill spaces *between* notes
3. **Unified Functions**: Modifiers work inline `fn(notes)` or by index `fn(range)`
4. **Stave-Bound**: All notes belong to declared staves

---

## 1. File Structure

### 1.1 Stave Declarations

```scorelang
---
&right:
  clef: treble
&left:
  clef: bass
---
```

### 1.2 Multi-Voice Staves

Use `+` to add voices to a stave:

```scorelang
---
&right+soprano:
  clef: treble
&right+alto:
  clef: treble
---
```

### 1.3 Context Blocks

```scorelang
---
tempo: 120
key: Dm
time: 3/4
octave: 4
---
```

| Key | Type | Description |
|-----|------|-------------|
| `tempo` | number | BPM |
| `key` | string | Key signature |
| `time` | string | Time signature |
| `octave` | number | Default octave (0-8) |
| `section` | string | Section marker |
| `ottava` | number | 8 or -8 for 8va/8vb lines |

---

## 2. Core Note Syntax

```
<pitch><accidental?><octave?|modifier?><duration?><articulations?>
```

### 2.1 Pitch & Accidentals

- Pitch: `A B C D E F G` (uppercase only)
- Accidentals: `#` `##` `b` `bb`

### 2.2 Octave

- Absolute: `C4`, `A5`
- Relative: `C+` (+1), `C++` (+2), `C-` (-1), `C--` (-2)

### 2.3 Duration

- `/1` whole, `/2` half, `/4` quarter (default), `/8` eighth, `/16`, `/32`
- Dotted: `/4.` or just `.` for dotted quarter

### 2.4 Fingerings

`C@1` `E@3` `G@5` (per-note only)

---

## 3. Connective Notation

Whitespace required between notes. Connectives fill that space:

| Syntax | Meaning |
|--------|---------|
| `A~B~C` | Slur (legato) |
| `A^A` | Tie |
| `A_B_C` | Pedal sustain |

```scorelang
&right{ C~D~E~F G A^A B }  // slurred C-D-E-F, tied A
&left{ C_E_G C }            // pedal through C-E-G
```

---

## 4. Special Elements

### 4.1 Rests

`_` (inherits duration context) or `_/2` (explicit)

### 4.2 Chords

`[C E G]` or `[C E G]/2`

### 4.3 Grace Notes

- Acciaccatura: `` `G C `` (grace G before C)
- Appoggiatura: ``` ``D E ``` (two backticks)

### 4.4 Beaming

`=(A B C D)` forces beam grouping

---

## 5. Modifier Functions

All modifiers use **function syntax** and work in both places:

| Location | Syntax | Description |
|----------|--------|-------------|
| **Inline** (in notes) | `fn(notes)` | Applied to wrapped notes |
| **Annotation** (in `{}`) | `fn(range)` | Applied by index |

### Equivalent Examples

```scorelang
// These are equivalent:
&right { p(C D E) F G }
&right { C D E F G } { p(1-3) }

// Mix and match:
&right { cresc(C D) E F } { p(3-4) }
```

### Standard Library

All function parameters are **text** or **number** types only.

#### Dynamics

| Function | Example |
|----------|--------|
| `p`, `pp`, `ppp` | `p(C D)` / `p(1-2)` |
| `mp`, `mf` | `mf(C D)` / `mf(1-2)` |
| `f`, `ff`, `fff` | `f(C D)` / `f(1-2)` |
| `cresc` | `cresc(C D E)` / `cresc(1-3)` |
| `decresc` | `decresc(C D)` / `decresc(1-2)` |

#### Articulations

| Function | Example |
|----------|--------|
| `st` | `st(C D)` / `st(1-2)` |
| `tn` | `tn(C)` / `tn(1)` |
| `ac` | `ac(C D)` / `ac(1-2)` |
| `mc` | `mc(C)` / `mc(1)` |
| `fm` | `fm(C)` / `fm(1)` |
| `tr` | `tr(C D)` / `tr(1-2)` |

#### Connectives

| Function | Shorthand | Example |
|----------|-----------|--------|
| `tie` | `A^B` | `tie(1-2)` |
| `slur` | `A~B~C` | `slur(1-3)` |
| `pedal` | `A_B_C` | `pedal(1-3)` |

#### Note Properties

| Function | Shorthand | Example |
|----------|-----------|--------|
| `oct` | `C4` | `oct(1-4, 5)` |
| `oct_up` | `C+` | `oct_up(1-4)` or `oct_up(1-4, 2)` |
| `oct_down` | `C-` | `oct_down(1-4)` or `oct_down(1-4, 2)` |
| `dur` | `C/8` | `dur(1-4, 8)` |
| `dot` | `C.` | `dot(1-2)` |
| `sharp` | `C#` | `sharp(1-3)` |
| `flat` | `Cb` | `flat(1-3)` |
| `finger` | `C@1` | `finger(1, 3)` |

#### Grouping

| Function | Shorthand | Example |
|----------|-----------|--------|
| `beam` | `=(A B C)` | `beam(1-4)` |
| `tuplet` | — | `tuplet(1-3, 3, 2)` |
| `grace` | `` `G `` | `grace(1)` |

#### Annotations (function-only)

| Function | Example |
|----------|--------|
| `text` | `text(1, "rit.")` |
| `8va` | `8va(1-8)` |
| `8vb` | `8vb(1-8)` |

---

## 6. Lyrics

Dedicated lyrics voice:

```scorelang
---
&melody:
  clef: treble
&melody+lyrics:
  type: lyrics
---

&melody { C D E F G }
&melody+lyrics { "Hel-" "lo" "my" "dear" "friend" }
```

---

## 7. Repeats & Navigation

Via context:

```scorelang
---
repeat: start
---
&right{ C D E F }
---
repeat: end
volta: 1
---
&right{ G A }
---
volta: 2
---
&right{ B C+ }
```

---

## 8. Comments

```scorelang
// single line
/* multi-line */
```

---

## 9. Complete Example

```scorelang
---
&right:
  clef: treble
&left:
  clef: bass
---

---
tempo: 100
key: C
time: 4/4
section: "Intro"
---

&right { C~D~E~F/8 G A B C+ } {
  cresc(1-4)
  text(5, "più mosso")
}

&left {
  C-/1
}

---
section: "Verse"
---

&right { =(C D E F) G^G A B }
&left { C-_E-_G- C-/1 }
```

---

## 10. Validation

1. Staves must be declared before use
2. Beat counts should match time signature (warning)
3. Balanced brackets: `[]` `()` `=()`
4. Annotation indices must be valid
5. Fingerings: 1-5 only
