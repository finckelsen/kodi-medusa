import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import type {
  INotificationModuleService,
  ICustomerModuleService,
} from "@medusajs/framework/types"
import { Modules, ContainerRegistrationKeys } from "@medusajs/framework/utils"

export default async function orderEmailsHandler({
  event: { data },
  container,
}: SubscriberArgs<{ id: string }>) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const notificationService: INotificationModuleService = container.resolve(
    Modules.NOTIFICATION
  )
  const query = container.resolve(ContainerRegistrationKeys.QUERY)

  const orderId = data.id

  // Use query.graph to get order with computed totals
  let order: Record<string, any>
  try {
    const { data: orders } = await query.graph({
      entity: "order",
      filters: { id: orderId },
      fields: [
        "id",
        "display_id",
        "email",
        "currency_code",
        "metadata",
        "customer_id",
        "created_at",
        // Computed totals
        "total",
        "subtotal",
        "item_total",
        "item_subtotal",
        "tax_total",
        "shipping_total",
        "discount_total",
        // Items with computed fields
        "items.*",
        "items.total",
        "items.subtotal",
        "items.unit_price",
        "items.quantity",
        "items.tax_total",
        "items.thumbnail",
        "items.metadata",
        "items.product_title",
        "items.variant_title",
        // Addresses
        "shipping_address.*",
        "billing_address.*",
        // Shipping methods with totals
        "shipping_methods.*",
        "shipping_methods.total",
        "shipping_methods.name",
      ],
    })

    if (!orders || orders.length === 0) {
      logger.error(`[order-emails] Order ${orderId} not found via query.graph`)
      return
    }

    order = orders[0]
  } catch (err) {
    logger.error(`[order-emails] Failed to retrieve order ${orderId}`, err as Error)
    return
  }

  // Try to get customer info
  let customer: Record<string, any> | null = null
  if (order.customer_id) {
    try {
      const customerService: ICustomerModuleService = container.resolve(
        Modules.CUSTOMER
      )
      customer = await customerService.retrieveCustomer(order.customer_id)
    } catch {
      // Customer may not exist, continue without
    }
  }

  const orderWithCustomer = {
    ...order,
    customer: customer || {
      first_name: order.shipping_address?.first_name,
      last_name: order.shipping_address?.last_name,
      email: order.email,
    },
  }

  // Serialize through JSON to convert BigNumber objects to plain values
  // (query.graph returns BigNumber objects which React can't render)
  const emailData = JSON.parse(JSON.stringify({ order: orderWithCustomer }))

  // Debug log
  const firstItem = order.items?.[0] as Record<string, any> | undefined
  if (firstItem) {
    logger.info(`[order-emails] Item: total=${firstItem.total}, unit_price=${firstItem.unit_price}, qty=${firstItem.quantity}, thumbnail=${firstItem.thumbnail}`)
    logger.info(`[order-emails] Item metadata: ${JSON.stringify(firstItem.metadata)}`)
  }
  logger.info(`[order-emails] Order #${order.display_id}: total=${order.total}, item_total=${order.item_total}, tax_total=${order.tax_total}, shipping_total=${order.shipping_total}`)

  // 1. Send customer confirmation email
  if (order.email) {
    try {
      await notificationService.createNotifications({
        to: order.email,
        channel: "email",
        template: "order-placed",
        trigger_type: "order.placed",
        resource_id: orderId,
        resource_type: "order",
        data: emailData,
      })
      logger.info(
        `[order-emails] Customer confirmation sent for order #${order.display_id} to ${order.email}`
      )
    } catch (err) {
      logger.error(
        `[order-emails] Failed to send customer email for order ${orderId}`,
        err as Error
      )
    }
  }

  // 2. Send internal order email with attachments
  try {
    await notificationService.createNotifications({
      to: "internal", // Overridden by service.ts to use internal_to
      channel: "email",
      template: "internal-order",
      trigger_type: "order.placed",
      resource_id: orderId,
      resource_type: "order",
      data: emailData,
    })
    logger.info(
      `[order-emails] Internal order email sent for order #${order.display_id}`
    )
  } catch (err) {
    logger.error(
      `[order-emails] Failed to send internal email for order ${orderId}`,
      err as Error
    )
  }
}

export const config: SubscriberConfig = {
  event: "order.placed",
}
