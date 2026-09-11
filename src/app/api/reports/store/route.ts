import { NextResponse, type NextRequest } from "next/server";
import { getSessionProfile } from "@/lib/auth";
import { getStoreReport, toCSV } from "@/lib/data";
import { formatPHP } from "@/lib/utils";

export async function GET(request: NextRequest) {
  const session = await getSessionProfile();
  if (!session || !session.profile.store_id) {
    return new NextResponse("Unauthorized", { status: 401 });
  }
  const type = request.nextUrl.searchParams.get("type") === "consignor" ? "consignor" : "product";
  const report = await getStoreReport(session.profile.store_id);
  const rows = type === "consignor" ? report.byConsignor : report.byProduct;

  const csv = toCSV(
    [type === "consignor" ? "Consignor" : "Product", "Units sold", "Gross (PHP)"],
    rows.map((r) => [r.name, r.qtySold, formatPHP(r.gross)]),
  );

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="store-${type}-report.csv"`,
    },
  });
}
