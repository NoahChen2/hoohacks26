import { environmentFragment } from '../avatar/paintedArt.js';
// Presentation only: worlds and rank effects never change reward calculations.
export const WORLD_ART = {
 cultivation: { title: 'The thread ascends', subtitle: 'From a single stitch to an eternal legacy.', kicker: 'The artisan’s path', ornament: 'Clouds · jade · starlight', accent: '#70d4b3', dark: '#102f32', light: '#ecf4ec', chapter: 'Ascension', flavor: ['Every great tapestry begins with a loose thread.', 'A steady needle. An awakened purpose.', 'Silk bends to a patient hand.', 'Weave a little sunlight into the ordinary.', 'Carve your craft into something enduring.', 'Let your work become a source of light.', 'A constellation, connected one stitch at a time.', 'A thread without end. A legacy without limits.'] },
 garden: { title: 'Let your craft bloom', subtitle: 'Small stitches. Wild growth. A little everyday magic.', kicker: 'A maker’s enchanted garden', ornament: 'Petals · fireflies · moonlight', accent: '#d5e59a', dark: '#263c2c', light: '#f1f5e8', chapter: 'Bloom', flavor: ['Plant one small stitch and see what grows.', 'A copper bud, full of possibility.', 'New leaves reach for the morning light.', 'Your ideas are coming into flower.', 'Protect the little things that make a forest.', 'Carry a pocketful of sunshine.', 'Some creations only bloom beneath the stars.', 'Rooted in craft. Crowned by the seasons.'] },
 fantasy: { title: 'Forge your own legend', subtitle: 'The finest treasures are the ones you remake.', kicker: 'The artisan’s campaign', ornament: 'Runes · crystals · astral sparks', accent: '#d5b6ff', dark: '#302143', light: '#f3edf8', chapter: 'Legend', flavor: ['Every legend starts at the workbench.', 'Craft your first piece of lasting armor.', 'Follow the silver arrow toward new possibilities.', 'A hammer, a spark, a maker’s signature.', 'Guard the emerald heart of your craft.', 'Enchant the ordinary with extraordinary care.', 'Forge with the fire of distant stars.', 'An artifact worthy of a thousand stories.'] },
 runway: { title: 'Made for the spotlight', subtitle: 'Rework the ordinary. Create your signature.', kicker: 'The ReThread atelier', ornament: 'Silk · pearls · camera flashes', accent: '#ffd1b9', dark: '#482733', light: '#fcf0ec', chapter: 'Collection', flavor: ['One stitch. The start of a signature.', 'Your seams tell a story of their own.', 'A clean cut. A fresh perspective.', 'Let your silhouette speak for itself.', 'Welcome to your very own atelier.', 'Every detail deserves its moment in the light.', 'A collection written in the stars.', 'Trends pass. Your signature endures.'] },
 cyber: { title: 'Rewrite the fabric', subtitle: 'Old material. New possibilities. Infinite iterations.', kicker: 'Maker network // online', ornament: 'Circuits · signals · neon trails', accent: '#7de9ff', dark: '#102938', light: '#eaf3f8', chapter: 'Protocol', flavor: ['Even a loose wire can start a connection.', 'Close the circuit. Begin the next iteration.', 'Your signal is reaching further.', 'A new protocol for a better-made world.', 'Build a matrix from what others leave behind.', 'Power the next idea from within.', 'Every maker is a node in something bigger.', 'An infinite loop of reinvention.'] },
};

// Each tier has a literal visual reference to its title, rather than a shared glyph.
const thread = '<path d="M30 69c-17-30 35-39 29-13S91 90 89 52M39 76l36-45-7 18"/>';
const needle = '<path d="m39 80 33-48q11-13 6 0L46 83ZM71 36l-4 8M43 78c-22-6-17-27-3-26"/>';
const star = '<path d="m60 27 8 23 24 2-19 15 6 24-19-14-20 14 7-24-19-15 24-2Z"/>';
const flower = '<path d="M60 52C25 20 24 61 48 62 14 83 55 101 60 74c9 31 49 8 14-12 30-4 19-43-14-10Z"/><circle cx="60" cy="63" r="8"/>';
const sprout = '<path d="M60 91V51M60 68C31 69 29 43 29 43s31-2 31 25ZM60 55c-1-26 28-28 28-28s1 28-28 28Z"/>';
const gem = '<path d="m60 29 26 22-9 30H43l-9-30ZM34 51h52M60 29 47 51l13 30 13-30Z"/>';
const crown = '<path d="m31 50 14 11 15-27 15 27 14-11-7 34H38ZM40 76h40"/>';
const sun = '<circle cx="60" cy="59" r="17"/><path d="M60 26v9m0 48v9M27 59h9m48 0h9M36 35l7 7m34 34 7 7m0-48-7 7M43 76l-7 7"/>';
const moon = '<path d="M76 31a30 30 0 1 0 10 44 27 27 0 0 1-10-44Z"/><path d="m82 37 3 7 8 2-8 3-3 7-3-7-7-3 7-2Z"/>';
const orbit = '<ellipse cx="60" cy="60" rx="34" ry="13" transform="rotate(-32 60 60)"/><circle cx="60" cy="60" r="22"/><circle cx="88" cy="42" r="4"/>';
const infinity = '<path d="M60 60C25 15 14 94 49 70l22-20c35-25 24 55-11 10Z"/>';
const hanger = '<path d="M55 41c-3-13 17-14 14-1-1 5-9 5-9 13L30 75q-4 6 4 6h52q8 0 4-6L60 53"/>';
const scissors = '<circle cx="42" cy="76" r="10"/><circle cx="78" cy="76" r="10"/><path d="m48 68 28-37M72 68 44 31"/>';
const circuit = '<path d="M44 42h32v36H44ZM32 49h12m-12 20h12m32-20h12M76 69h12M51 30v12m18-12v12M51 78v12m18-12v12M53 51h14v18H53Z"/><circle cx="30" cy="49" r="3"/><circle cx="90" cy="69" r="3"/>';
export const RANK_MOTIFS = {
 cultivation: [thread,needle,'<path d="M33 39c18-12 36 12 54 0v40c-18 12-36-12-54 0ZM33 51c18-12 36 12 54 0m-54 14c18-12 36 12 54 0"/>',sun,gem,'<path d="M43 85h34M49 85V57h22v28M40 57h40L60 38Z"/>'+sun,star,infinity],
 garden: ['<path d="M60 85C33 67 41 42 60 33c20 10 26 35 0 52ZM60 85V50"/>','<path d="M60 87V64c-29 2-29-26-16-31l16 13 16-13c14 6 13 33-16 31Z"/>',sprout,flower,'<path d="M58 92 64 28M61 44 43 34m18 20L36 42m24 23L33 55m26 21L38 70m24-26 19-10M61 54l25-12M60 65l27-10M59 76l24-6"/>',sun,moon,crown+sprout],
 fantasy: [needle,'<path d="M60 28 85 39v28L60 89 35 67V39ZM60 40v34M46 55h28"/>','<path d="m34 86 49-53M66 33h17v17M35 43q45 5 42 42M35 43l42 42"/>','<path d="m38 78 33-34m-9-13 22 23-10 10-23-22ZM30 80l9 9"/>',gem,star,orbit+'<path d="m40 79 34-36m-8-9 15 15"/>',crown+gem],
 runway: [needle,'<path d="M45 29v60m30-60v60M50 37l20 8m-20 5 20 8m-20 5 20 8m-20 5 20 8"/>',scissors,'<path d="M50 32h20l-5 20 21 34H34l21-34ZM50 32l-10 9m30-9 10 9M55 52h10"/>',hanger,flower,star+'<circle cx="30" cy="33" r="3"/><circle cx="91" cy="85" r="3"/>',crown+hanger],
 cyber: [thread,circuit,'<path d="M34 82V67m17 15V53m17 29V40m17 42V27"/><path d="M28 43q14-17 31-17M29 53q10-12 22-12"/>','<path d="M37 29h36l13 13v48H37ZM73 29v16h13M48 58l8 8-8 8m15 0h12"/>',circuit+gem,sun+'<circle cx="60" cy="59" r="7"/>',orbit,infinity+'<path d="M27 36h16m34 48h16"/>'],
};

export function worldScenery(theme) { return environmentFragment(theme,400,200,'class="world-scenery painted-world-scenery" aria-hidden="true"'); }

export function worldAtmosphere(theme,tier=0) {
 const symbols={cultivation:'✧',garden:'❧',fantasy:'✦',runway:'✧',cyber:'+'};
 return `<div class="world-atmosphere" aria-hidden="true">${Array.from({length:6+tier},(_,i)=>`<span class="world-particle" style="--particle-x:${8+(i*29)%87}%;--particle-y:${12+(i*37)%77}%;--particle-delay:${-i*1.7}s;--particle-duration:${9+i%5*2}s;--particle-size:${9+i%3*5}px">${symbols[theme]||'✦'}</span>`).join('')}<span class="world-light-trail"></span></div>`;
}
