# AI clothing upcycling studio (Step 4)

## Running

Requires Node 22+ (tested with Node 24). Install dependencies with `npm install`.

- `npm run dev`: Vite serves the application and `/api/analyze` using a server-only plugin.
- `npm run build && npm start`: Node serves `dist` and the same endpoint, default port 3000. Set `PORT` to override.
- `npm run preview`: includes the same endpoint for local build verification.

Copy `.env.example` to `.env.local`. Leave `GEMINI_API_KEY` and `OPENAI_API_KEY` empty for demo mode. For live analysis, set `GEMINI_API_KEY` (Gemini API free tier; the same key powers the photo scan), or set `OPENAI_API_KEY` and `OPENAI_VISION_MODEL` to a vision-capable model supporting Responses structured outputs. Gemini is used when both are set. Restart the server after changing environment variables. Neither variable should ever have a `VITE_` prefix. A key without a model produces an explicit configuration error, rather than selecting a model silently.

This needs a Node server; uploading only `dist` to static hosting will not provide `/api/analyze`. This endpoint is not a serverless deployment adapter.

## Behavior

`/studio` is linked from Explore. JPEG, PNG, and WebP uploads have a 5 MiB file limit, browser decode check, object-URL preview, replace and remove controls. Changing the image, condition, or material invalidates previous results and cancels a pending request. Photos and analyses are not persisted. The server uses `store: false` for the OpenAI request. On the Gemini free tier Google may use submitted photos to improve its products.

`POST /api/analyze` accepts JSON: `{imageDataUrl, condition, material, preferences: {aesthetics, skill, tools}}`. The server bounds the request, validates MIME and signature, validates user input, and uses the configured Gemini or OpenAI model server-side (Gemini answers are trimmed to the schema's length limits before validation). The Zod schema requires three complete projects with instructions and safety notes. The response envelope is `{mode, notice, analysis}`. Difficulty and machine/no-tool mismatches are also rejected. Failed, refused, truncated, or invalid model output returns an error; it never silently becomes demo output.

The browser shows a photo/material uncertainty notice, loading, retryable errors, a garment summary, and three selectable projects with detail dialogs. Dynamic content is HTML escaped. File URLs are revoked when replaced or removed. User-reported material is distinct from a visual estimate; the schema deliberately excludes “High” fabric confidence.

When neither key is set, deterministic examples are tailored to saved aesthetic and tool preferences. They are labeled **DEMO MODE**, show no inferred colors/type, and explicitly state the photo was not analyzed. Needle-and-thread users receive hand-sewing examples; users without sewing tools get reversible no-cut/no-sew ideas. These may not suit the uploaded garment, and the UI says so. Advanced users can still receive accessible beginner examples.

## Checks and limits

Build and lint pass. Automated tests cover upload limits/signatures, request validation, honest deterministic demo output, personalization, exact-three response schemas, server-only live request configuration, mocked provider failures/refusals/incomplete output, skill/tool mismatches, HTTP behavior, and secret-safe errors. Browser checks cover actual demo endpoint upload, preview, replacement/removal, loading, project details, error/retry, and mobile layout. Desktop/mobile rendered results were inspected. Live OpenAI analysis was tested with a mocked client, not a paid live request.

Server sessions do not retain uploads. Deployment authentication, usage quotas, and saved generated projects are outside Step 4.

Implementation follows official OpenAI documentation:
- [Image inputs](https://developers.openai.com/api/docs/guides/images-vision)
- [Structured outputs and Zod](https://developers.openai.com/api/docs/guides/structured-outputs)
