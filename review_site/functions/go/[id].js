// 구매 버튼 /go/{product_id}/?pos= — 제휴링크는 URL 로 받지 않고 DB(product_pages)에서 찾는다(오픈 리다이렉트 불가).
//   봇·데이터센터 판정은 shopping-log 본체 functions/go/[id].js 와 같은 기준(바꾸면 둘 다 고친다).
//   클릭은 web_doc_clicks 에 channel='review' / 'review_blocked:<사유>' 로 기록.
import { sb } from '../../lib/db.js';

const DC_IP = [/^43\.(12[89]|1[3-8]\d|19[01])\./, /^101\.3[2-9]\./, /^129\.226\./, /^150\.109\./, /^49\.51\./];
const BOT_UA = [/iPhone OS 13_2_3/, /^curl\//i, /bot|spider|crawl|headless|python|wget|scrapy|httpclient|okhttp|go-http/i];
const DC_ASN = new Set([132203, 45090, 45102, 37963, 16509, 14618, 396982, 8075, 14061, 16276, 24940, 31898, 63949, 20473, 51167, 9009, 136907]);
const ALLOWED = [/^naver\.me$/, /^([a-z0-9-]+\.)*naver\.com$/];

function blockReason({ ua, ip, asn, country }) {
  if (!ua) return 'no_ua';
  if (BOT_UA.some((re) => re.test(ua))) return 'bot_ua';
  if (ip && DC_IP.some((re) => re.test(ip))) return 'dc_ip';
  if (asn && DC_ASN.has(asn)) return 'dc_asn';
  if (country !== 'KR') return 'geo';
  return null;
}

const esc = (s) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export async function onRequestGet(context) {
  const { request, params, env } = context;
  const url = new URL(request.url);
  const home = `${url.origin}/`;
  const id = String(params.id || '').replace(/[^\d]/g, '');
  let dest = null;
  try {
    const rows = id ? await sb(env, `product_pages?product_id=eq.${id}&published=eq.true&select=affiliate_link&limit=1`) : [];
    const link = rows[0]?.affiliate_link;
    if (link && ALLOWED.some((re) => re.test(new URL(link).hostname))) dest = link;
  } catch (e) { /* DB 장애 → 홈 */ }

  const ua = request.headers.get('user-agent') || '';
  const ip = request.headers.get('cf-connecting-ip') || null;
  const country = request.headers.get('cf-ipcountry') || null;
  const asn = request.cf?.asn ? Number(request.cf.asn) : null;
  const reason = !dest ? 'bad_dest' : blockReason({ ua, ip, asn, country });

  const referer = request.headers.get('referer') || null;
  let slug = null;
  try { if (referer) slug = new URL(referer).pathname; } catch (e) { /* ignore */ }
  const pos = (url.searchParams.get('pos') || '').replace(/[^a-z0-9_-]/gi, '').slice(0, 20);
  if (slug && pos) slug = `${slug}#${pos}`;
  context.waitUntil(fetch(`${env.SUPABASE_URL}/rest/v1/web_doc_clicks`, {
    method: 'POST',
    headers: { apikey: env.SUPABASE_SERVICE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify({ product_id: id || null, slug: slug ? `review:${slug}` : 'review:', channel: reason ? `review_blocked:${reason}` : 'review', referer, ua: ua || null, country, ip }),
  }).catch(() => {}));

  const noStore = { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow' };
  if (reason === 'geo') {
    return new Response(`<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>판매 페이지로 이동</title>
<style>body{font-family:system-ui,sans-serif;max-width:420px;margin:15vh auto;padding:0 16px;text-align:center;color:#222}button{font-size:17px;padding:14px 28px;border:0;border-radius:10px;background:#03c75a;color:#fff}p{color:#666;font-size:14px}</style></head>
<body><h1 style="font-size:20px">네이버 판매 페이지로 이동합니다</h1><p>해외에서 접속하셨습니다. 버튼을 누르면 판매 페이지가 열립니다.</p>
<button id="go" data-dest="${esc(dest)}">판매 페이지 열기</button><p><a href="${home}">돌아가기</a></p>
<script>document.getElementById('go').onclick=function(){location.href=this.dataset.dest}</script></body></html>`, { headers: { 'Content-Type': 'text/html; charset=utf-8', ...noStore } });
  }
  return new Response(null, { status: 302, headers: { Location: reason ? home : dest, ...noStore } });
}
