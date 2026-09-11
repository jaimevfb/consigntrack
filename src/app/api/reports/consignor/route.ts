import { NextResponse, type NextRequest } from "next/server";
import { getSessionProfile } from "@/lib/auth";
import { getConsignorReport, toCSV } from "@/lib/data";
import { formatPHP } from "@/lib/utils";

export async function GET(request: NextRequest) {
  const session = await getSessionProfile();
  if (!session || !session.profile.consignor_id) {
    return new NextResponse("Unauthorized", { status: 401 });
  }
  const type = request.nextUrl.searchParams.get("type") === "store" ? "store" : "product";
  const report = await getConsignorReport(session.profile.consignor_id);
  const rows = type === "store" ? report.byStore : report.byProduct;

  const csv = toCSV(
    [type === "store" ? "Store" : "Product", "Units sold", "Gross (PHP)"],
    rows.map((r) => [r.name, r.qtySold, formatPHP(r.gross)]),
  );

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="consignor-${type}-report.csv"`,
    },
  });
}
