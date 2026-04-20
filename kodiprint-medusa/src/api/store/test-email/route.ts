import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import type { INotificationModuleService } from "@medusajs/framework/types"
import { Modules, ContainerRegistrationKeys } from "@medusajs/framework/utils"

/**
 * POST /admin/test-email?template=order-placed
 * POST /admin/test-email?template=internal-order
 *
 * Sends a test email with mock order data. Only for development.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER)
  const notificationService: INotificationModuleService = req.scope.resolve(
    Modules.NOTIFICATION
  )

  const template = (req.query.template as string) || "order-placed"
  const to = (req.query.to as string) || "casper@kodiprint.com"

  const mockOrder = {
    id: "order_TEST",
    display_id: 9999,
    email: to,
    currency_code: "sek",
    total: 11969,
    subtotal: 11900,
    item_total: 11900,
    item_subtotal: 11900,
    tax_total: 2393.8,
    shipping_total: 69,
    discount_total: 0,
    customer_id: null,
    created_at: new Date().toISOString(),
    metadata: {},
    items: [
      {
        id: "item_TEST_01",
        product_title: "Sportflaska Profilering",
        variant_title: "Svart / 750ml",
        thumbnail: "http://localhost:9000/static/1771786550962-Transparent_-_Black_Cap.webp",
        unit_price: 119,
        quantity: 100,
        total: 11900,
        subtotal: 11900,
        tax_total: 2380,
        metadata: {
          is_company_order: true,
          forening_name: "Boden IK",
          forening_id: "for_TEST",
          logo_url: "http://localhost:9000/static/1771786550962-Transparent_-_Black_Cap.webp",
          logo_original_name: "boden-ik-logo.png",
          logo_mime_type: "image/png",
          logo_is_vector: false,
          print_mode: "screen",
          print_settings: {
            y_offset: 0,
            rotation: 0,
            scale: 0.85,
            around: false,
            both_sides: false,
            offset_x: 0,
            offset_y: -5,
          },
          names_list: [
            "Erik Svensson",
            "Anna Lindberg",
            "Karl Johansson",
            "Maria Bergstrom",
            "Lars Nilsson",
          ],
          shipping_speed: "standard",
          variant_thumbnail: "http://localhost:9000/static/1771786550962-Transparent_-_Black_Cap.webp",
          pricing_breakdown: {
            tier_unit_price: 99,
            print_surcharge: 15,
            logo_back_surcharge: 0,
            name_surcharge: 5,
            shipping_fee: 69,
            combined_unit_price: 119,
            line_total_ex_moms: 11900,
            tier_label: "51-100",
            print_mode: "screen",
          },
        },
      },
    ],
    shipping_address: {
      first_name: "Anna",
      last_name: "Lindberg",
      company: "Boden IK",
      address_1: "Storgatan 12",
      address_2: null,
      city: "Boden",
      postal_code: "96132",
      country_code: "se",
      phone: "070-1234567",
    },
    billing_address: {
      first_name: "Anna",
      last_name: "Lindberg",
      company: "Boden IK",
      address_1: "Storgatan 12",
      address_2: null,
      city: "Boden",
      postal_code: "96132",
      country_code: "se",
      phone: "070-1234567",
    },
    shipping_methods: [
      {
        id: "sm_TEST",
        name: "PostNord Hemleverans",
        total: 69,
      },
    ],
    customer: {
      first_name: "Anna",
      last_name: "Lindberg",
      email: to,
    },
  }

  try {
    await notificationService.createNotifications({
      to,
      channel: "email",
      template,
      trigger_type: "test",
      data: { order: mockOrder },
    })

    logger.info(`[test-email] Sent test "${template}" to ${to}`)
    res.json({ success: true, template, to })
  } catch (err) {
    logger.error(`[test-email] Failed:`, err as Error)
    res.status(500).json({
      success: false,
      error: (err as Error).message,
    })
  }
}
