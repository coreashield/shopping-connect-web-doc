// 웹문서 구매버튼 클릭 귀속 추적 (자율 성장 엔진 E1 — 측정).
//   /go/{product_id}?u={어필리에이트URL} → 클릭을 Supabase web_doc_clicks에 기록 후 302 리다이렉트.
//   자체 도메인이라 "웹문서가 실제로 유발한 클릭"을 알 수 있는 유일한 신호.
//   sales(product_id) + web_doc_clicks(product_id) 시간창 조인 = 웹문서 귀속 매출.
//
// 2026-10-03 보안·정책 보강:
//   1) 목적지 화이트리스트 — 예전엔 u= 에 아무 http(s) 주소나 받아 오픈 리다이렉트였다
//      (?u=https://example.com → 302). 스팸·피싱 우회 주소로 쓰이면 도메인 신뢰도가 깎인다.
//   2) 봇은 제휴링크로 보내지 않는다 — 9월 해외 위장 UA 클릭 9,176건이 naver.me 로 그대로 넘어갔다.
//      브랜드커넥트 정책 "인위적 클릭 금지" 위험. 판정은 라이브 repo tools/webdoc_real_clicks.js
//      (isRealKrClick)와 같은 기준이라, 여기서 막는 클릭은 원래 보고서 집계에서도 빠지던 것이다.
//      막힌 클릭도 channel='web_doc_blocked:<사유>' 로 기록해 규모는 계속 본다.
//   3) 해외 체류 한국인을 위해 해외 접속은 바로 막지 않고 "버튼을 눌러 이동" 중간 페이지를 준다
//      (링크를 href 로 두지 않아 단순 수집 봇은 따라가지 못한다).
//
// Cloudflare Pages Function. 필요 env(Pages 프로젝트 설정 → 환경변수):
//   SUPABASE_URL, SUPABASE_SERVICE_KEY
//   (env 없으면 로깅만 조용히 스킵하고 리다이렉트는 정상 — 무중단)

// 발행기가 넣는 제휴링크는 naver.me(상품)·pkgtour.naver.com(여행)뿐. 네이버 쇼핑 계열만 허용.
const ALLOWED_HOSTS = [/^naver\.me$/, /^([a-z0-9-]+\.)*naver\.com$/];

// 라이브 repo tools/webdoc_real_clicks.js 와 같은 지문 (바꾸면 둘 다 고친다)
const DC_IP = [
  /^43\.(12[89]|1[3-8]\d|19[01])\./, // Tencent 43.128.0.0/10
  /^101\.3[2-9]\./,                  // Tencent 101.32.0.0/13
  /^129\.226\./, /^150\.109\./, /^49\.51\./,
];
const BOT_UA = [/iPhone OS 13_2_3/, /^curl\//i, /bot|spider|crawl|headless|python|wget|scrapy|httpclient|okhttp|go-http/i];

// 클라우드·호스팅 ASN — 사람이 쇼핑하는 회선이 아니다 (request.cf.asn, 전 요금제 제공)
const DC_ASN = new Set([
  132203, 45090,          // Tencent
  45102, 37963,           // Alibaba
  16509, 14618,           // AWS
  396982,                 // Google Cloud
  8075,                   // Microsoft Azure
  14061,                  // DigitalOcean
  16276,                  // OVH
  24940,                  // Hetzner
  31898,                  // Oracle Cloud
  63949,                  // Linode/Akamai
  20473,                  // Vultr
  51167,                  // Contabo
  9009,                   // M247
  136907,                 // Huawei Cloud
]);

function blockReason({ ua, ip, asn, country }) {
  if (!ua) return 'no_ua';
  if (BOT_UA.some((re) => re.test(ua))) return 'bot_ua';
  if (ip && DC_IP.some((re) => re.test(ip))) return 'dc_ip';
  if (asn && DC_ASN.has(asn)) return 'dc_asn';
  if (country !== 'KR') return 'geo';
  return null;
}

function isAllowedDest(raw) {
  try {
    const p = new URL(raw);
    if (p.protocol !== 'https:' && p.protocol !== 'http:') return false;
    return ALLOWED_HOSTS.some((re) => re.test(p.hostname.toLowerCase()));
  } catch (e) {
    return false;
  }
}

const escapeHtml = (s) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// 해외 접속용 중간 페이지 — 목적지는 data 속성에만 두고 버튼 클릭(JS)으로만 이동
function interstitial(dest, home) {
  const d = escapeHtml(dest);
  const body = `<!doctype html><html lang="ko"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow">
<title>판매 페이지로 이동</title>
<style>body{font-family:system-ui,sans-serif;max-width:420px;margin:15vh auto;padding:0 16px;text-align:center;color:#222;background:#fff}
button{font-size:17px;padding:14px 28px;border:0;border-radius:8px;background:#03c75a;color:#fff;cursor:pointer}
p{color:#666;font-size:14px;line-height:1.6}a{color:#666}</style></head><body>
<h1 style="font-size:20px">네이버 판매 페이지로 이동합니다</h1>
<p>해외에서 접속하셨습니다. 아래 버튼을 누르면 판매 페이지가 열립니다.</p>
<button id="go" data-dest="${d}">판매 페이지 열기</button>
<p><a href="${escapeHtml(home)}">쇼핑로그로 돌아가기</a></p>
<script>document.getElementById('go').onclick=function(){location.href=this.dataset.dest};</script>
</body></html>`;
  return new Response(body, {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'X-Robots-Tag': 'noindex, nofollow', 'Cache-Control': 'no-store' },
  });
}

export async function onRequestGet(context) {
  const { request, params, env } = context;
  const url = new URL(request.url);
  const home = new URL('/', url.origin).toString();
  const productId = params.id || null;
  const rawTarget = url.searchParams.get('u');

  // 리다이렉트 목적지 검증 — 네이버 제휴 도메인만, 아니면 홈으로.
  //   searchParams.get()이 이미 1회 디코드하므로 추가 decodeURIComponent 금지(URL 내 %xx 손상 방지).
  const validDest = rawTarget && isAllowedDest(rawTarget);
  const dest = validDest ? rawTarget : home;

  const ua = request.headers.get('user-agent') || '';
  const ip = request.headers.get('cf-connecting-ip') || null;
  const country = request.headers.get('cf-ipcountry') || null;
  const asn = request.cf && request.cf.asn ? Number(request.cf.asn) : null;
  const reason = !validDest ? 'bad_dest' : blockReason({ ua, ip, asn, country });

  // 클릭 로깅 (논블로킹 — 리다이렉트 지연 없음)
  if (env && env.SUPABASE_URL && env.SUPABASE_SERVICE_KEY) {
    const referer = request.headers.get('referer') || null;
    let slug = null;
    try { if (referer) slug = new URL(referer).pathname; } catch (e) { /* ignore */ }
    // 10/5: 어느 버튼이었는지(card/sticky/table/pick/body…) — 우리 링크에만 붙인 pos 를 slug 뒤에 '#pos' 로.
    //   표 구조를 안 바꾸려고 slug 에 붙인다. 집계는 split('#'). 제휴 URL(u=)은 손대지 않는다.
    const pos = (url.searchParams.get('pos') || '').replace(/[^a-z0-9_-]/gi, '').slice(0, 20);
    if (slug && pos) slug = `${slug}#${pos}`;
    const row = {
      product_id: productId,
      slug,
      channel: reason ? `web_doc_blocked:${reason}` : 'web_doc',
      referer,
      ua: ua || null,
      country,
      ip,  // 내부(대표/개발) 테스트 클릭 제외용
    };
    const logPromise = fetch(`${env.SUPABASE_URL}/rest/v1/web_doc_clicks`, {
      method: 'POST',
      headers: {
        apikey: env.SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify(row),
    }).catch(() => {});
    context.waitUntil(logPromise);
  }

  if (reason === 'geo') return interstitial(dest, home);   // 해외 체류 한국인은 버튼으로 이동 가능
  if (reason) return Response.redirect(home, 302);          // 봇·데이터센터·잘못된 목적지 → 제휴링크로 보내지 않음
  return Response.redirect(dest, 302);
}
