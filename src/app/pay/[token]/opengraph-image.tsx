import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { getPayOrder } from "@/lib/api";
import { formatNaira } from "@/lib/format/money";

export const alt = "PaySafr protected payment";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OpenGraphImage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const order = await getPayOrder(token);
  const font = await readFile(path.join(process.cwd(), "public", "fonts", "halfre.ttf"));
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", padding: 72, flexDirection: "column", justifyContent: "space-between", background: "#112b00", color: "white", fontFamily: "Halfre" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <svg width="48" height="62" viewBox="240 140 540 710"><path fill="#66ff00" d="M359.17 479.213 251.036 369.85 359.17 260.488l108.134-109.362h216.268L575.438 260.488 467.304 369.85z"/><path fill="#fff" d="m483.5 387.5 107.5 108.5-107.5 108.5L376 496z"/><path fill="#66ff00" d="M283.732 840.366H500l108.134-109.362 54.067 54.681 108.133-109.362-54.067-54.681-54.066-54.681-54.067-54.681-108.133 109.362-108.134 109.362z"/></svg>
          <span style={{ fontSize: 44, color: "#66ff00" }}>PaySafr</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
          <div style={{ fontSize: 62, lineHeight: 1.05, maxWidth: 970 }}>{order?.title ?? "Protected payment link"}</div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 24 }}>
            <span style={{ fontSize: 72, color: "#66ff00", fontFamily: "Arial" }}>{order ? formatNaira(order.totalKobo) : "Pay safely"}</span>
            {order ? <span style={{ fontSize: 30, color: "rgba(255,255,255,.72)" }}>for {order.seller.name}</span> : null}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 26, color: "rgba(255,255,255,.8)" }}>Protected by PaySafr</div>
      </div>
    ),
    { ...size, fonts: [{ name: "Halfre", data: Buffer.from(font), style: "normal", weight: 400 }] },
  );
}
