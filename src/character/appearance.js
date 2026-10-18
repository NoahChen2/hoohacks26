// The character's appearance options. Plain JavaScript so the server (photo
// scan schema) can share them; settings.ts re-exports them for the app.
// Skin tones from very light to very deep, as flat cartoon base colours.
export const SKIN_TONES = [
  { id: 'porcelain', label: 'Porcelain', color: '#fbe0cf' },
  { id: 'ivory', label: 'Ivory', color: '#f6d0b1' },
  { id: 'sand', label: 'Sand', color: '#f2bf98' },
  { id: 'honey', label: 'Honey', color: '#e3a676' },
  { id: 'olive', label: 'Olive', color: '#c99a66' },
  { id: 'amber', label: 'Amber', color: '#ba7d4c' },
  { id: 'bronze', label: 'Bronze', color: '#9d6439' },
  { id: 'umber', label: 'Umber', color: '#7d4c2e' },
  { id: 'espresso', label: 'Espresso', color: '#613a25' },
  { id: 'ebony', label: 'Ebony', color: '#48291b' },
];
// Every style has its own canonical mesh; ids match HAIR_STYLE_IDS in canonical.js.
export const HAIR_STYLES = [
  { id: 'crop', label: 'Short crop' },
  { id: 'bob', label: 'Bob' },
  { id: 'long', label: 'Long' },
  { id: 'ponytail', label: 'Ponytail' },
  { id: 'bun', label: 'Top bun' },
  { id: 'curls', label: 'Big curls' },
  { id: 'braids', label: 'Braids' },
  { id: 'mohawk', label: 'Mohawk' },
  { id: 'buzz', label: 'Buzz cut' },
  { id: 'bald', label: 'Bald' },
];
export const HAIR_COLORS = [
  { id: 'black', label: 'Black', color: '#2a2631' },
  { id: 'dark-brown', label: 'Dark brown', color: '#3a2418' },
  { id: 'brown', label: 'Brown', color: '#6b4226' },
  { id: 'auburn', label: 'Auburn', color: '#8c3a26' },
  { id: 'ginger', label: 'Ginger', color: '#cf6a2e' },
  { id: 'blonde', label: 'Blonde', color: '#e6bf62' },
  { id: 'platinum', label: 'Platinum', color: '#efe6cc' },
  { id: 'grey', label: 'Grey', color: '#a19fa8' },
  { id: 'pink', label: 'Pink', color: '#f07fb2' },
  { id: 'teal', label: 'Teal', color: '#2aa8a0' },
];
