# Painted art and interaction upgrade

The avatar and inventory visuals now use original painted raster artwork generated with the built-in image generation tool. The previous vector character drawing has been removed from the render path. SVG remains a compositor for the illustrated sprites, precise equipment layers, formations, crests and lightweight effects.

## Assets saved in this project

- cultivation-sprites.png, garden-sprites.png, fantasy-sprites.png, runway-sprites.png, cyber-sprites.png: each a transparent 3-column / 2-row atlas. Columns are neutral, wave and celebration; rows are starter and advanced outfits. Each image is 1254 × 1254, with explicit frame clipping to prevent neighboring poses showing through.
- environments.png: a 3-column / 2-row illustrated environment atlas: floating mountain pavilion, moonlit botanical garden, fantasy forge/cathedral, fashion atelier/runway, rainy cyberpunk skyline, celestial ink sky.
- artifacts.png: a transparent 4-column / 4-row painted material atlas. Needle, jade shuttle, silver array, crescent shears; golden spindle, embroidery halo, void needle, crown; thorn staff, crafting staff, couture scissors, holographic needle; silk sash, jade hairpin, ornate frame, spiritual-thread orb.

The website uses these local copies, not files from the generation cache. No provided comic panels, franchise characters, dialogue, logos or watermarks are embedded in the app.

## Generation mode and prompt set

Mode: built-in image_gen; no CLI or API-key fallback. Character and artifact requests used transparent_background=true. Environments used transparent_background=false. Cyberpunk used the first cultivation atlas as a layout/illustration-quality reference.

Shared character prompt specification: one equal 3×2 full-body sprite atlas, same original adult character in every cell, consistent scale and baseline, individually separated with transparent margins. Premium richly detailed Korean manhwa cover illustration, expressive refined faces, beautiful hands, realistic tall adult proportions, dimensional painted fabric and metal, precise ink detail, cel shadows with gradients, and cinematic rim lighting. No flat vectors, polygons, infographic/MBTI people, chibi, 3D dolls, backgrounds, text, logos, watermarks or handheld equipment.

Per-asset character prompts:
- Cultivation: an original celestial tailor, long charcoal hair and pale jade eyes, ivory/blue-jade silk robes, black underlayers, ornate gold sewing details; advanced midnight-jade mantle and celestial-thread embroidery.
- Garden: silver-sage wavy hair and green eyes, botanical sage velvet/ivory petal cape, layered silk and tailored trousers, gold floral brooches; advanced midnight-green velvet, pink/gold blossoms and flowing tulle.
- Fantasy: midnight hair with silver forelock and amethyst eyes, charcoal/plum travel cloak, ivory tunic, leather crafting belts and ornate boots; advanced midnight-violet mantle, engraved antique-gold shoulder details and rich silk lining.
- Runway: contemporary fashion designer with short sable hair, ivory silk blazer, charcoal waistcoat and wide-leg trousers; advanced black/rose-gold sculptural couture coat, organza and metallic embroidery. Explicitly contemporary, not medieval robes or armor.
- Cyberpunk: original cyberpunk fashion character, charcoal technical layers, luminous cyan seam piping, metallic hardware and dimensional leather boots; advanced iridescent black/violet/cyan technical coat and futuristic couture.

Artifact prompt specification: one precise 4×4 transparent atlas in the object order above, each object isolated in its own equal cell. Exquisite dimensional painted steel, translucent carved jade, antique gold, real silk texture, polished highlights, fine embroidery and smooth curves. No line icons, flat shapes, polygon art, labels, backgrounds, frames around cells, existing franchise objects or watermarks.

Environment prompt specification: one equal 3×2 edge-to-edge painted environment atlas, detailed original manhwa/fantasy game-background artwork with atmospheric depth, volumetric light and natural texture. Use the six scenes listed above. No characters, text, logos or gutters.

## Runtime presentation

- Painted sprites replace the body/hair/robe vector drawing. Base/advanced outfit state, selected outfit tint, separate handheld and orbiting materials, hair accessories, auras, formations, frame and title remain connected to inventory.
- Color selection retints cool or dark cloth pixels on demand while retaining painted shading and avoiding warm skin and ivory highlights. Tint results are bounded and cached; no per-frame pixel processing.
- Wave and Celebrate switch to genuinely different face/gesture illustrations. Focus gathers thread light. The character also breathes gently, responds to pointer parallax and can be activated with Enter/Space. Emotes are temporary animation state, never rewards or saved progress.
- Pointer and keyboard interactions create local mist, or branching cyan lightning in Cyberpunk. Effects are short-lived, capped, stop in hidden tabs, and respect Off, pause and reduced motion. They do not block pointer input.
- Illustrated scenery is used by the pavilion, progression banner and studio background. The wardrobe uses translucent atmospheric panels and painted material previews; the existing body/closet/project tools remain available.

See the repository's CHARACTER_SYSTEM.md for equipment and milestone behavior. The new checks are tests/illustration.test.js and npm.cmd run test:illustration; existing progression, avatar and world browser checks remain in place.
