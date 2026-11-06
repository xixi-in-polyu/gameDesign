import { get, put } from '@vercel/blob';

const characterPalettes = {
  yueling: new Set(['#24232A','#383E53','#295254','#57877B','#AD4939','#B78458','#EDB980','#F3DCAF']),
  linsi: new Set(['#24232A','#3C3B46','#4D5C62','#708087','#A54B2D','#956C43','#E5AD75','#E4D2AE']),
};

const jsonHeaders = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'private, no-store',
  'X-Content-Type-Options': 'nosniff',
};

function reply(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: jsonHeaders });
}

function pathname(character) {
  return `artbook/shared-sprites/${character}.json`;
}

function validatePixels(character, encoded) {
  if (typeof encoded !== 'string' || encoded.length > 30000) throw new Error('像素数据格式无效');
  const pixels = Buffer.from(encoded, 'base64');
  if (pixels.length !== 64 * 64 * 4) throw new Error('像素数据必须严格为 64 × 64 RGBA');
  const allowed = characterPalettes[character];
  const used = new Set();
  for (let index = 0; index < pixels.length; index += 4) {
    const alpha = pixels[index + 3];
    if (alpha !== 0 && alpha !== 255) throw new Error('Alpha 只能为 0 或 255');
    if (alpha === 255) {
      const hex = `#${[pixels[index], pixels[index + 1], pixels[index + 2]].map(value => value.toString(16).padStart(2, '0')).join('').toUpperCase()}`;
      if (!allowed.has(hex)) throw new Error(`包含色板外颜色 ${hex}`);
      used.add(hex);
    }
  }
  if (used.size > 8) throw new Error('不透明颜色不能超过 8 种');
  return { pixels: pixels.toString('base64'), colorCount: used.size };
}

export default async function handler(request) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return reply({ error: '尚未连接 Vercel Blob 存储' }, 503);
  const url = new URL(request.url);

  if (request.method === 'GET') {
    const character = url.searchParams.get('character');
    if (!characterPalettes[character]) return reply({ error: '未知角色' }, 400);
    const result = await get(pathname(character), { access: 'private' });
    if (!result || result.statusCode !== 200) return reply({ error: '尚无共享版本' }, 404);
    const record = JSON.parse(await new Response(result.stream).text());
    return reply(record);
  }

  if (request.method === 'POST') {
    try {
      const body = await request.json();
      if (!characterPalettes[body.character]) return reply({ error: '未知角色' }, 400);
      const checked = validatePixels(body.character, body.pixels);
      const record = { version: 1, character: body.character, pixels: checked.pixels, colorCount: checked.colorCount, updatedAt: new Date().toISOString() };
      await put(pathname(body.character), JSON.stringify(record), {
        access: 'private',
        allowOverwrite: true,
        contentType: 'application/json',
        cacheControlMaxAge: 60,
      });
      return reply(record);
    } catch (error) {
      return reply({ error: error instanceof Error ? error.message : '发布失败' }, 400);
    }
  }

  return new Response(null, { status: 405, headers: { Allow: 'GET, POST' } });
}
