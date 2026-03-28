# SetTempo — User Guide

SetTempo is a metronome and setlist manager for musicians and bands. Everything works offline — no account, no internet connection required.

---

## Getting Started

### 1. Create an Artist

When you first open the app, go to the **Artists** tab and add your band or artist name. Everything in SetTempo — your songs, sets, and shows — belongs to an artist.

Tap the artist name to select it. The app remembers your selection.

---

## The Metronome

The **Metronome** tab is always accessible, no matter what else you're doing.

### Starting and stopping
Tap the large green **▶** button to start. Tap the red **■** to stop.

### Setting the tempo
- Type a BPM directly into the number field
- Use the **−1 / +1** buttons for fine adjustments
- Use the **−5 / +5** buttons for coarse adjustments
- Or use **TAP TEMPO** — tap it repeatedly in time with your song. The app calculates the average tempo from your taps. Stops listening after 3 seconds of no taps.

### Time signature
Tap any of the preset buttons (4/4, 3/4, 6/8, etc.) to switch instantly.

### Click sounds
Choose between **Beep**, **Woodblock**, and **Cowbell**. Use the **Volume** slider to adjust loudness and the **Pitch** slider to shift all sounds up or down by semitones.

To practice silently, tap **Sound on** to toggle to **Muted** mode — the beat dots still flash so you can follow the tempo visually.

### Song Starter
The Song Starter plays a short count-in click and then stops — useful for giving your band the tempo before a song without the click running throughout.

- Choose how many bars to count in: 1, 2, 4, 8, or 16
- Choose what happens after: **Stop & wait** (click ends, you play) or **Auto-advance** (moves to the next song in your setlist)
- Tap the large orange **▶ Count N bars** button to trigger it

### Gap Click (Practice)
Gap Click alternates between click bars and silent bars — a classic practice technique to test whether you can keep time without the metronome.

- Turn it **ON** and set how many bars to click, then how many bars to stay silent
- The display shows **CLICK** or **SILENT** so you always know which phase you're in
- Gap Click only appears in the Metronome tab, not on stage

---

## Building Your Song Library

Go to **Library → Songs** after selecting an artist.

### Adding songs
Tap **+ Add** to create a song one at a time. Fill in:
- **Title** — the song name
- **BPM** — the tempo (1–300)
- **Time Sig** — e.g. 4/4, 3/4, 6/8
- **Notes** — anything useful: key, capo position, cues, reminders

### Loading a song to the metronome
Tap the **▶** button on any song to instantly load its BPM and time signature into the metronome.

### Searching and filtering
Use the search box to find songs by title. Use the BPM min/max fields to filter by tempo range — useful for finding all your slow songs or all your high-energy ones.

### Grid view
On a desktop or tablet, tap **Grid** to edit your song library as a spreadsheet. Click any cell to edit it, press Tab to move between columns, and press Enter to add a new row. Drag the **⠿** handle to reorder songs. Tap **Save all** when done.

### Importing from a spreadsheet
If you already have your songs in Excel or a CSV file:

1. Tap **Import**
2. Drop your file or tap to browse
3. The app will try to match your column headers automatically
4. If it doesn't match, use the dropdowns to tell it which column is Title, BPM, etc.
5. Review the preview — any problem rows are highlighted in red
6. Choose **Add to library** (keeps existing songs) or **Replace library** (starts fresh)
7. Tap Import

To get the expected format, download the template from the **Settings** tab first.

---

## Building Sets and Setlists

SetTempo organises your live material in layers:

```
Artist
  └── Song Library (all your songs)
  └── Set Library (reusable groups of songs)
  └── Shows
        └── Setlists
              └── Sets (added from your Set Library)
```

### Step 1 — Create Sets

Go to **Library → Sets** and tap **+ New Set**. Give it a name (e.g. "Set 1", "Acoustic Set", "Encore").

Tap the set to open it, then tap **+ Add Song** to build the song order. Drag the **⠿** handle to reorder.

**Overriding a song's tempo for a set:**
Tap **Edit** on any song entry. You can set a local BPM, time signature, or notes that apply only in this set — for example, "we play this one faster live." The app will ask whether to apply the change to this entry only, or update the song globally.

Overridden values show in yellow.

### Step 2 — Create a Show

Go to the **Shows** tab and tap **+ New Show**. Give it a name (e.g. "The Venue — March 2026") and an optional date.

### Step 3 — Create a Setlist

Open a show and tap **+ New Setlist**. Give it a name (e.g. "Main Setlist" or "Backup").

### Step 4 — Add Sets to the Setlist

Open the setlist and tap **+ Add Set**. Pick sets from your Set Library. You can add the same set to multiple shows — if you ever edit the set, all shows using it update automatically.

If you need a show to have its own independent version of a set, choose **Add as local copy** instead.

---

## Performance Mode

When you're ready to take the stage, tap the orange **▶ Perform** button in the header. Choose which setlist to perform.

### What you see
- The **current song name** in large text
- **BPM** in orange and **time signature** below it
- Any **notes** you added (key, capo, cues)
- Your position in the set (e.g. "3 / 11")
- The next song name at the bottom

### Navigating songs
- Tap anywhere on the song area to advance to the next song
- Use the **←** and **→** arrows to go back or forward manually

### Starting songs
- Tap the large orange **▶ N bars** button to play a count-in click, then stop
- Tap the smaller **▶** button to run the metronome continuously throughout the song

### Auto-start
Tap **AUTO** in the top corner to have the metronome start automatically each time you advance to a new song.

### Screen stays on
The screen will not go to sleep while Performance Mode is active.

Tap **✕ Exit** to leave Performance Mode.

---

## Exporting a Setlist

Open a setlist and tap:
- **Print / PDF** — opens a formatted setlist in a new tab and launches the print dialog. Save as PDF from there.
- **HTML** — downloads a standalone HTML file you can open in any browser or send to bandmates.

The exported format looks like a traditional printed setlist:

```
BAND NAME — Venue, March 2026
────────────────────────────────
SET 1
1. Song Title          120 BPM   4/4
2. Another Song         98 BPM   3/4   Capo 2
...
```

---

## Backing Up Your Data

Go to **Settings**.

### Backup
- **Export current artist** — saves just the selected artist's data as a JSON file
- **Export all data** — saves everything

Keep this file somewhere safe (cloud storage, email it to yourself). This is your only backup.

### Restore
- Tap **Select JSON backup file** and pick your backup
- **Merge** adds the backup data alongside what's already there
- **Replace all** wipes everything and restores from the backup

### Moving to a new device
1. Export your data on the old device (Settings → Export all data)
2. Open SetTempo on the new device
3. Go to Settings → Restore, pick Merge, select the file

---

## Installing as an App

SetTempo is a Progressive Web App — you can install it on your device for one-tap access and full offline use, without going through an app store.

- **iPhone/iPad:** Open in Safari → tap the Share button → **Add to Home Screen**
- **Android:** Open in Chrome → tap the menu (⋮) → **Add to Home Screen** or **Install app**
- **Mac/PC:** Open in Chrome or Edge → look for the install icon (⊕) in the address bar

Once installed, it works exactly like a native app, even with no internet connection.

---

## Tips for Live Use

- Build your setlist before the show, not at soundcheck
- Use the Song Starter's **Auto-advance** mode so the app automatically loads the next song after the count-in — one less thing to think about on stage
- Add notes to songs for things you always forget: *"CAPO 3 — count in quietly — full band on bar 2"*
- Export and print your setlist as a backup in case your phone dies
- The screen stays on automatically in Performance Mode, but plug in if it's a long set
