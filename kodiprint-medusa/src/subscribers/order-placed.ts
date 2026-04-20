import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import type { IOrderModuleService, ICustomerModuleService } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"

export default async function orderPlacedHandler({
  event: { data },
  container,
}: SubscriberArgs<{ id: string }>) {
  const orderId = data.id

  const orderService: IOrderModuleService = container.resolve(Modules.ORDER)
  const customerService: ICustomerModuleService = container.resolve(Modules.CUSTOMER)

  // Retrieve the order with line items
  const order = await orderService.retrieveOrder(orderId, {
    relations: ["items"],
  })

  const foreningId = (order.metadata as Record<string, any>)?.forening_id
  if (!foreningId) {
    return // Not a förening order
  }

  console.log(`[order-placed] Order ${orderId} linked to förening ${foreningId}`)

  // Retrieve the förening customer
  let foreningCustomer
  try {
    foreningCustomer = await customerService.retrieveCustomer(foreningId as string)
  } catch (e) {
    console.error(`[order-placed] Could not find förening customer ${foreningId}:`, e)
    return
  }

  const metadata = (foreningCustomer.metadata as Record<string, any>) || {}
  const existingOrders: any[] = metadata.forening_orders || []

  // Idempotency check — skip if this order_id already exists
  if (existingOrders.some((o: any) => o.order_id === orderId)) {
    console.log(`[order-placed] Order ${orderId} already recorded for förening ${foreningId}, skipping`)
    return
  }

  // Calculate total from order
  const total = order.total ?? 0

  // Calculate kickback
  const kickbackPercentage = metadata.kickback_percentage || 25
  const kickbackAmount = Math.round(Number(total) * kickbackPercentage / 100)

  // Build line items
  const lineItems = (order.items || []).map((item: any) => ({
    title: item.title,
    quantity: item.quantity,
    unit_price: item.unit_price,
    personalization_name: item.metadata?.personalization_name || null,
  }))

  // Build order post
  const orderPost = {
    order_id: orderId,
    display_id: order.display_id,
    total: Number(total),
    kickback_amount: kickbackAmount,
    status: "completed",
    created_at: order.created_at?.toISOString?.() || new Date().toISOString(),
    customer_email: (order.metadata as Record<string, any>)?.customer_email || null,
    line_items: lineItems,
    source: "medusa",
    note: null,
  }

  // Append to forening_orders
  existingOrders.push(orderPost)

  // Update the förening customer metadata
  await customerService.updateCustomers(foreningId as string, {
    metadata: {
      ...metadata,
      forening_orders: existingOrders,
    },
  })

  console.log(`[order-placed] Saved order ${orderId} to förening ${foreningId} (kickback: ${kickbackAmount})`)
}

export const config: SubscriberConfig = {
  event: "order.placed",
}
