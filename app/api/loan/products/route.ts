import { NextRequest, NextResponse } from 'next/server';
import { filterLoanProducts, type LoanType } from '@/lib/dummy-loans';

// GET /api/loan/products — 대출 상품 목록 조회
// ?type=담보|전세|신용|사업자  — 유형 필터
// ?bank=kb|shinhan|...       — 은행 코드 필터
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const type = searchParams.get('type') as LoanType | null;
  const bank = searchParams.get('bank') ?? undefined;

  const validTypes: LoanType[] = ['담보', '전세', '신용', '사업자'];
  if (type && !validTypes.includes(type)) {
    return NextResponse.json({ error: '유효하지 않은 대출 유형입니다' }, { status: 400 });
  }

  const products = filterLoanProducts(type ?? undefined, bank);
  return NextResponse.json(products);
}
