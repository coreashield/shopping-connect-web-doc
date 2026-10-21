// Supabase REST 읽기 + Cloudflare 엣지 캐시 헬퍼 (review.shopping-log.com Pages Functions 공용)
//   env: SUPABASE_URL, SUPABASE_SERVICE_KEY (Pages 프로젝트 시크릿)

export async function sb(env, pathAndQuery, { count = false } = {}) {
  const headers = { apikey: env.SUPABASE_SERVICE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}` };
  if (count) headers.Prefer = 'count=exact';
  const r = await fetch(`${env.SUPABASE_URL}/rest/v1/${pathAndQuery}`, { headers });
  if (!r.ok) throw new Error(`supabase ${r.status}`);
  const rows = await r.json();
  if (!count) return rows;
  const total = Number((r.headers.get('content-range') || '').split('/')[1]) || 0;
  return { rows, total };
}

export async function getPage(env, id) {
  const rows = await sb(env, `product_pages?product_id=eq.${encodeURIComponent(id)}&published=eq.true&select=product_id,name,score,review_count,cat_path,data,built_at&limit=1`);
  return rows[0] || null;
}

export const CARD_COLS = 'product_id,name,score,review_count,price:data->price,rating:data->rating,img:data->imgs->0,label:data->label';

// 분류 트리·개수 (빌드 때 정적 파일로 생성)
let catsMemo = null;
export async function getCats(context) {
  if (catsMemo) return catsMemo;
  const r = await context.env.ASSETS.fetch(new URL('/_data/cats.json', context.request.url));
  catsMemo = r.ok ? await r.json() : { total: 0, tree: {} };
  return catsMemo;
}

// GET HTML 응답을 엣지 캐시에 하루 둔다 (데이터는 하루 1회 재생성). ?nocache=1 은 우회.
// 화면 코드를 바꾸면 CACHE_VER 를 올린다 — 엣지 캐시는 배포로 비워지지 않는다(키가 바뀌어야 새로 그림).
const CACHE_VER = '2026102105';

export async function cached(context, render) {
  const url = new URL(context.request.url);
  const key = new URL(url);
  key.searchParams.set('__v', CACHE_VER);
  const request = new Request(key.toString(), { method: 'GET' });
  const cache = caches.default;
  const bypass = url.searchParams.has('nocache');
  if (!bypass) {
    const hit = await cache.match(request);
    if (hit) return hit;
  }
  let res;
  try {
    res = await render();
  } catch (e) {
    return new Response('일시적인 오류입니다. 잠시 후 다시 시도해 주세요.', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Retry-After': '120' } });
  }
  if (res.status === 200 && !bypass) context.waitUntil(cache.put(request, res.clone()));
  return res;
}
