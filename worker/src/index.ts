export interface Env {
  GEMINI_API_KEY: string;
  ALLOWED_ORIGINS: string; // comma-separated
}

function resolveOrigin(request: Request, allowedOrigins: string): string {
  const requestOrigin = request.headers.get('Origin') ?? '';
  const allowed = (allowedOrigins || '').split(',').map((o) => o.trim());
  return allowed.includes(requestOrigin) ? requestOrigin : allowed[0] ?? '*';
}

interface EditRequest {
  photoBase64: string;
  photoMime: string;
  tileBase64: string;
  tileMime: string;
  surface: 'floor' | 'wall';
  tileName?: string;
}

// Gemini's image-generation model — codename "nano banana". If Google renames
// or deprecates this model id, this is the one line to update.
const MODEL = 'gemini-2.5-flash-image';

function corsHeaders(origin: string): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    Vary: 'Origin',
  };
}

function json(data: unknown, status: number, origin: string): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
  });
}

function buildPrompt(surface: 'floor' | 'wall', tileName?: string): string {
  const label = tileName ? `"${tileName}"` : 'the reference material';
  const target = surface === 'floor' ? 'floor' : 'wall surfaces';
  const others = surface === 'floor' ? 'walls, ceiling' : 'floor, ceiling';
  return (
    `Replace only the ${target} in the first image with the tile material shown in the second image (${label}). ` +
    `Keep the room's camera angle, perspective, furniture, doors, lighting, and shadows exactly the same. ` +
    `Do not change the ${others} or anything else in the scene. ` +
    `The new ${target} should look photorealistic: the tile pattern correctly scaled, following the surface's ` +
    `perspective, with natural reflections and shading consistent with the room's existing light.`
  );
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const origin = resolveOrigin(request, env.ALLOWED_ORIGINS);

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders(origin) });
    }
    if (request.method !== 'POST') {
      return json({ error: 'Method not allowed' }, 405, origin);
    }
    if (!env.GEMINI_API_KEY) {
      return json({ error: 'Server is missing GEMINI_API_KEY' }, 500, origin);
    }

    let body: EditRequest;
    try {
      body = await request.json();
    } catch {
      return json({ error: 'Invalid JSON body' }, 400, origin);
    }

    const { photoBase64, photoMime, tileBase64, tileMime, surface, tileName } = body;
    if (!photoBase64 || !tileBase64 || (surface !== 'floor' && surface !== 'wall')) {
      return json({ error: 'photoBase64, tileBase64 and surface ("floor" | "wall") are required' }, 400, origin);
    }

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${env.GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: buildPrompt(surface, tileName) },
                { inlineData: { mimeType: photoMime || 'image/jpeg', data: photoBase64 } },
                { inlineData: { mimeType: tileMime || 'image/webp', data: tileBase64 } },
              ],
            },
          ],
        }),
      }
    );

    if (!geminiRes.ok) {
      const detail = await geminiRes.text();
      return json({ error: 'Gemini API request failed', status: geminiRes.status, detail }, 502, origin);
    }

    const data = (await geminiRes.json()) as {
      candidates?: { content?: { parts?: { inlineData?: { mimeType: string; data: string } }[] } }[];
    };
    const parts = data.candidates?.[0]?.content?.parts ?? [];
    const imagePart = parts.find((p) => p.inlineData?.data);

    if (!imagePart?.inlineData) {
      return json({ error: 'Gemini did not return an image', detail: data }, 502, origin);
    }

    return json({ mimeType: imagePart.inlineData.mimeType, data: imagePart.inlineData.data }, 200, origin);
  },
};
