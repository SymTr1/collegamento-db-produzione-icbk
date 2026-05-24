import { NextRequest, NextResponse } from "next/server";
import { validateApiKey } from "../../../lib/auth";
import { readOnlyQuery } from "../../../lib/db";

/**
 * GET /api/orders
 *
 * Returns a complete table of orders with all related data:
 * products (abbreviations), payments, timeslots, driver, customer, etc.
 *
 * Query params (all optional):
 *   date       — exact delivery date (e.g. 2026-05-24)
 *   from       — start of date range
 *   to         — end of date range
 *   status     — order status (draft, pending, confirmed, delivered, cancelled)
 *   driver     — filter by driver name (partial match)
 *   customer   — filter by customer name (partial match)
 *   limit      — max rows (default 500)
 *   offset     — pagination offset (default 0)
 */
export async function GET(request: NextRequest) {
  const authError = validateApiKey(request);
  if (authError) return authError;

  const params = request.nextUrl.searchParams;
  const date = params.get("date");
  const from = params.get("from");
  const to = params.get("to");
  const status = params.get("status");
  const driver = params.get("driver");
  const customer = params.get("customer");
  const limit = Math.min(parseInt(params.get("limit") || "500"), 2000);
  const offset = parseInt(params.get("offset") || "0");

  // Build WHERE clauses dynamically
  const conditions: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  if (date) {
    conditions.push(`o.delivery_date = $${paramIndex++}`);
    values.push(date);
  }
  if (from) {
    conditions.push(`o.delivery_date >= $${paramIndex++}`);
    values.push(from);
  }
  if (to) {
    conditions.push(`o.delivery_date <= $${paramIndex++}`);
    values.push(to);
  }
  if (status) {
    conditions.push(`o.status = $${paramIndex++}`);
    values.push(status);
  }
  if (driver) {
    conditions.push(`o.driver_name ILIKE $${paramIndex++}`);
    values.push(`%${driver}%`);
  }
  if (customer) {
    conditions.push(`o.customer_name ILIKE $${paramIndex++}`);
    values.push(`%${customer}%`);
  }

  const whereClause =
    conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  // Main query: orders with timeslot
  const ordersSql = `
    SELECT
      o.id AS order_id,
      o.status AS order_status,
      o.customer_id,
      o.customer_name,
      o.delivery_date,
      o.created_at,
      t.name AS timeslot,
      o.total_amount,
      o.driver_id,
      o.driver_name,
      o.shipping_address,
      o.contact_name,
      o.telephone,
      o.delivery_instructions,
      o.internal_note,
      o.fatture_id,
      o.document_type,
      o.last_payment_status,
      o.last_payment_amount,
      o.payment_balance
    FROM orders o
    LEFT JOIN timeslots t ON o.timeslot_id = t.id
    ${whereClause}
    ORDER BY o.delivery_date DESC, o.created_at DESC
    LIMIT $${paramIndex++} OFFSET $${paramIndex++}
  `;
  values.push(limit, offset);

  try {
    const ordersResult = await readOnlyQuery(ordersSql, values);

    if (ordersResult.rows.length === 0) {
      return NextResponse.json({ success: true, count: 0, orders: [] });
    }

    // Get all order IDs for sub-queries
    const orderIds = ordersResult.rows.map(
      (r: { order_id: string }) => r.order_id
    );

    // Fetch products for all orders in one query
    const productsSql = `
      SELECT
        oi.order_id,
        oi.quantity,
        oi.net_price,
        oi.base_price,
        oi.discount_percentage,
        p.id AS product_id,
        p.abbreviation,
        p.name AS product_name
      FROM order_items oi
      LEFT JOIN products p ON oi.product_id = p.id
      WHERE oi.order_id = ANY($1)
      ORDER BY oi.order_id, p.abbreviation
    `;
    const productsResult = await readOnlyQuery(productsSql, [orderIds]);

    // Fetch payments for all orders in one query
    const paymentsSql = `
      SELECT
        order_id,
        status AS payment_status,
        amount,
        user_name AS collected_by,
        date AS payment_date
      FROM payments
      WHERE order_id = ANY($1)
      ORDER BY order_id, date DESC
    `;
    const paymentsResult = await readOnlyQuery(paymentsSql, [orderIds]);

    // Group products by order_id
    const productsByOrder: Record<string, Array<{
      product_id: string;
      abbreviation: string;
      product_name: string;
      quantity: number;
      base_price: number;
      net_price: number;
      discount_percentage: number;
    }>> = {};
    for (const p of productsResult.rows) {
      if (!productsByOrder[p.order_id]) productsByOrder[p.order_id] = [];
      productsByOrder[p.order_id].push({
        product_id: p.product_id,
        abbreviation: p.abbreviation,
        product_name: p.product_name,
        quantity: p.quantity,
        base_price: p.base_price,
        net_price: p.net_price,
        discount_percentage: p.discount_percentage,
      });
    }

    // Group payments by order_id
    const paymentsByOrder: Record<string, Array<{
      payment_status: string;
      amount: string;
      collected_by: string | null;
      payment_date: string;
    }>> = {};
    for (const p of paymentsResult.rows) {
      if (!paymentsByOrder[p.order_id]) paymentsByOrder[p.order_id] = [];
      paymentsByOrder[p.order_id].push({
        payment_status: p.payment_status,
        amount: p.amount,
        collected_by: p.collected_by,
        payment_date: p.payment_date,
      });
    }

    // Compose the final response
    const orders = ordersResult.rows.map((o: Record<string, unknown>) => {
      const products = productsByOrder[o.order_id as string] || [];
      const payments = paymentsByOrder[o.order_id as string] || [];

      return {
        // Ordine
        order_id: o.order_id,
        order_status: o.order_status,

        // Cliente
        customer_id: o.customer_id,
        customer_name: o.customer_name,

        // Date
        delivery_date: o.delivery_date,
        created_at: o.created_at,

        // Prodotti — abbreviazioni unite + dettaglio
        products_summary: products
          .map((p) => `${p.quantity}x ${p.abbreviation}`)
          .join(", "),
        products_detail: products,

        // Consegna
        timeslot: o.timeslot,
        driver_name: o.driver_name,
        shipping_address: o.shipping_address,

        // Contatto
        contact_name: o.contact_name,
        telephone: o.telephone,
        delivery_instructions: o.delivery_instructions,
        internal_note: o.internal_note,

        // Fatturazione
        fatture_id: o.fatture_id,
        document_type: o.document_type,

        // Totali ordine
        total_amount: o.total_amount,

        // Pagamenti
        last_payment_status: o.last_payment_status,
        last_payment_amount: o.last_payment_amount,
        payment_balance: o.payment_balance,
        payments: payments,
      };
    });

    return NextResponse.json({
      success: true,
      count: orders.length,
      orders,
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: `Database error: ${message}` },
      { status: 500 }
    );
  }
}
