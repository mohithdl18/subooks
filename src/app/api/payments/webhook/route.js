import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { getDb } from "@/lib/mongodb";

// export const runtime = "nodejs";

export async function POST(request) {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ success: false, message: "Webhook is not configured." }, { status: 503 });
  try {
    const raw = await request.text();
    const signature = request.headers.get("x-razorpay-signature") || "";
    const expected = crypto.createHmac("sha256", secret).update(raw).digest("hex");
    const a = Buffer.from(signature, "hex"), b = Buffer.from(expected, "hex");
    if (!signature || a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      return NextResponse.json({ success: false, message: "Invalid webhook signature." }, { status: 400 });
    }
    const event = JSON.parse(raw);
    const payment = event?.payload?.payment?.entity;
    if (payment?.order_id && payment?.id) {
      await (await getDb()).collection("payment_orders").updateOne(
        { razorpay_order_id: payment.order_id, status: { $ne: "confirmed" } },
        { $set: { lastWebhookEvent: event.event || "unknown", lastWebhookPaymentId: payment.id,
          lastWebhookPaymentStatus: payment.status || "unknown", lastWebhookAt: new Date() } }
      );
    }
    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Razorpay webhook failed:", error);
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
