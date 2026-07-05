// 웹문서 구매버튼 클릭 귀속 추적 (자율 성장 엔진 E1 — 측정).
//   /go/{product_id}?u={어필리에이트URL} → 클릭을 Supabase web_doc_clicks에 기록 후 302 리다이렉트.
//   자체 도메인이라 "웹문서가 실제로 유발한 클릭"을 알 수 있는 유일한 신호.
//   sales(product_id) + web_doc_clicks(product_id) 시간창 조인 = 웹문서 귀속 매출.
//
// Cloudflare Pages Function. 필요 env(Pages 프로젝트 설정 → 환경변수):
//   SUPABASE_URL, SUPABASE_SERVICE_KEY
//   (env 없으면 로깅만 조용히 스킵하고 리다이렉트는 정상 — 무중단)

export async function onRequestGet(context) {
  const { request, params, env } = context;
  const url = new URL(request.url);
  const productId = params.id || null;
  const rawTarget = url.searchParams.get('u');

  // 리다이렉트 목적지 검증 — http(s)만 허용, 없으면 홈으로.
  //   searchParams.get()이 이미 1회 디코드하므로 추가 decodeURIComponent 금지(URL 내 %xx 손상 방지).
  let dest = new URL('/', url.origin).toString();
  try {
    if (rawTarget) {
      const p = new URL(rawTarget);
      if (p.protocol === 'https:' || p.protocol === 'http:') dest = rawTarget;
    }
  } catch (e) { /* fallback: 홈 */ }

  // 클릭 로깅 (논블로킹 — 리다이렉트 지연 없음)
  if (env && env.SUPABASE_URL && env.SUPABASE_SERVICE_KEY) {
    const referer = request.headers.get('referer') || null;
    let slug = null;
    try { if (referer) slug = new URL(referer).pathname; } catch (e) { /* ignore */ }
    const row = {
      product_id: productId,
      slug,
      channel: 'web_doc',
      referer,
      ua: request.headers.get('user-agent') || null,
      country: request.headers.get('cf-ipcountry') || null,
      ip: request.headers.get('cf-connecting-ip') || null,  // 내부(대표/개발) 테스트 클릭 제외용
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

  return Response.redirect(dest, 302);
}
