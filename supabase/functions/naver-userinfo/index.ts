// Supabase Edge Function — Naver OIDC Proxy
// Deploy: supabase functions deploy naver-userinfo --no-verify-jwt
//
// Naver는 표준 OIDC userinfo 응답을 반환하지 않고
// { resultcode, message, response: { id, email, ... } } 형태로 감싸서 반환합니다.
// Supabase Custom Provider가 표준 OIDC 형식을 기대하므로 이 함수가 중간에서 변환합니다.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

serve(async (req: Request) => {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Missing Authorization header' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Naver userinfo API 호출
  const naverRes = await fetch('https://openapi.naver.com/v1/nid/me', {
    headers: { Authorization: authHeader },
  });

  if (!naverRes.ok) {
    return new Response(JSON.stringify({ error: 'Failed to fetch Naver userinfo' }), {
      status: naverRes.status,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const naverData = await naverRes.json();
  const r = naverData.response;

  // 표준 OIDC userinfo 형식으로 변환
  const oidcResponse = {
    sub:            r.id,
    name:           r.name           ?? r.nickname ?? '',
    email:          r.email          ?? '',
    email_verified: true,
    picture:        r.profile_image  ?? r.profileImage ?? '',
    nickname:       r.nickname       ?? '',
    phone_number:   r.mobile         ?? '',
  };

  return new Response(JSON.stringify(oidcResponse), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
});
