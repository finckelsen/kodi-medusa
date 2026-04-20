import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { DhlClient } from "../../../../modules/dhl/client"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  try {
    const { postalCode, countryCode, city, street, limit } = req.query as {
      postalCode?: string
      countryCode?: string
      city?: string
      street?: string
      limit?: string
    }

    if (!postalCode) {
      return res.status(400).json({
        success: false,
        error: "postalCode is required",
      })
    }

    const client = new DhlClient({
      api_key: process.env.DHL_API_KEY || "",
      api_base_url:
        process.env.DHL_API_BASE_URL ||
        "https://test-api.freight-logistics.dhl.com",
      servicepoint_endpoint:
        process.env.DHL_SERVICEPOINT_ENDPOINT ||
        "/servicepointlocatorapi/servicepoint/findnearestservicepoints",
      transport_instruction_endpoint:
        process.env.DHL_TRANSPORT_INSTRUCTION_ENDPOINT ||
        "/transportinstructionapi/v1/transportinstruction/sendtransportinstruction",
      home_delivery_endpoint:
        process.env.DHL_HOME_DELIVERY_ENDPOINT ||
        "/homedeliverylocatorapi/v1/homedeliverylocator/validateadditionalservices",
      customer_number: process.env.DHL_CUSTOMER_NUMBER || "",
      sender_id: process.env.DHL_SENDER_ID || "",
      sender_name: process.env.DHL_SENDER_NAME || "Kodiprint",
      sender_address: process.env.DHL_SENDER_ADDRESS || "",
      sender_postal_code: process.env.DHL_SENDER_POSTAL_CODE || "",
      sender_city: process.env.DHL_SENDER_CITY || "",
      sender_country: process.env.DHL_SENDER_COUNTRY || "SE",
      payer_code: process.env.DHL_PAYER_CODE || "1",
      service_point_product_code:
        process.env.DHL_SERVICE_POINT_PRODUCT_CODE || "103",
      home_delivery_product_code:
        process.env.DHL_HOME_DELIVERY_PRODUCT_CODE || "401",
      business_product_code: process.env.DHL_BUSINESS_PRODUCT_CODE || "",
    })

    const servicePoints = await client.findServicePoints({
      postalCode,
      countryCode: (countryCode as string) || "SE",
      city: city as string,
      street: street as string,
      limit: limit ? parseInt(limit as string, 10) : 10,
    })

    res.json({ success: true, service_points: servicePoints })
  } catch (error) {
    console.error("Error fetching DHL service points:", error)
    res.status(500).json({
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Could not fetch service points",
    })
  }
}
