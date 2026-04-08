import { NextResponse } from "next/server";
import { OwidCovidParser } from "@/lib/services/OwidCovidParser";
import {
  getCachedOwidDocument,
} from "@/lib/services/owidCachedFetch";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function GET() {
  try {
    // Keep this cached for responsiveness; the main dashboard already provides a manual refresh.
    const src = await getCachedOwidDocument();
    const blocks = OwidCovidParser.parseBlocks(src.raw);
    const rows = blocks
      .map((b) => ({
        code: (b.iso_code ?? "").toUpperCase(),
        name: b.location,
        continent: b.continent ?? null,
      }))
      .filter(
        (r) =>
          r.code &&
          !r.code.startsWith("OWID") &&
          /^[A-Z]{3}$/.test(r.code),
      );
    rows.sort((a, b) => a.name.localeCompare(b.name));
    return NextResponse.json({ countries: rows });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    console.error("[api/covid/countries]", message, e);
    return NextResponse.json(
      {
        error: message,
        hint: "Same data download as the main dashboard; retry when your connection is stable.",
      },
      { status: 502 },
    );
  }
}
