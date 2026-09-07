import { Injectable } from '@angular/core';

const WORKER_URL = 'https://dugar-ai-tile-proxy.dugarai.workers.dev';

export interface AiEditRequest {
  photo: HTMLImageElement | HTMLCanvasElement;
  tileImg: HTMLImageElement;
  surface: 'floor' | 'wall';
  tileName?: string;
}

@Injectable({ providedIn: 'root' })
export class AiEditService {
  /** Sends the photo + tile reference to the Gemini-backed worker and returns the edited image. */
  async edit(req: AiEditRequest): Promise<HTMLImageElement> {
    const photoData = this.toBase64(req.photo, 'image/jpeg', 0.92);
    const tileData = this.toBase64(req.tileImg, 'image/png');

    const res = await fetch(WORKER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        photoBase64: photoData.base64,
        photoMime: photoData.mime,
        tileBase64: tileData.base64,
        tileMime: tileData.mime,
        surface: req.surface,
        tileName: req.tileName,
      }),
    });

    const text = await res.text();
    let body: { data?: string; mimeType?: string; error?: string; detail?: unknown };
    try {
      body = JSON.parse(text);
    } catch {
      throw new Error(`Unexpected response (${res.status}): ${text.slice(0, 300)}`);
    }

    if (!res.ok || !body.data) {
      throw new Error(this.describeError(res.status, body));
    }

    return this.loadImage(`data:${body.mimeType};base64,${body.data}`);
  }

  private describeError(status: number, body: { error?: string; detail?: unknown }): string {
    const detail = typeof body.detail === 'string' ? body.detail : JSON.stringify(body.detail ?? '');
    if (detail.includes('RESOURCE_EXHAUSTED') || detail.includes('quota') || detail.includes('billing')) {
      return 'The AI image service is out of quota or billing credit. Check the Gemini API billing page.';
    }
    return body.error ? `${body.error} (${status})` : `AI edit failed (${status})`;
  }

  private toBase64(
    img: HTMLImageElement | HTMLCanvasElement,
    mime: string,
    quality?: number
  ): { base64: string; mime: string } {
    const w = 'naturalWidth' in img ? img.naturalWidth : img.width;
    const h = 'naturalHeight' in img ? img.naturalHeight : img.height;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    canvas.getContext('2d')!.drawImage(img, 0, 0, w, h);
    const dataUrl = canvas.toDataURL(mime, quality);
    return { base64: dataUrl.split(',')[1], mime };
  }

  private loadImage(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Failed to load the AI-generated image'));
      img.src = src;
    });
  }
}
