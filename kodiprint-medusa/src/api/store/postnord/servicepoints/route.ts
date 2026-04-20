import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { PostNordClient } from "../../../../modules/postnord/client"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  try {
    const { postalCode, countryCode, city, streetName, limit } = req.query as {
      postalCode?: string
      countryCode?: string
      city?: string
      streetName?: string
      limit?: string
    }

    if (!postalCode) {
      return res.status(400).json({
        success: false,
        error: "postalCode is required",
      })
    }

    const client = new PostNordClient({
      api_key: process.env.POSTNORD_API_KEY || "",
      customer_number: process.env.POSTNORD_CUSTOMER_NUMBER || "",
      issuer_code: process.env.POSTNORD_ISSUER_CODE || "SE",
      api_base_url: process.env.POSTNORD_API_BASE_URL || "https://atapi2.postnord.com",
      sender_postal_code: process.env.POSTNORD_SENDER_POSTAL_CODE || "",
      sender_city: process.env.POSTNORD_SENDER_CITY || "",
      sender_country: process.env.POSTNORD_SENDER_COUNTRY || "SE",
      sender_name: process.env.POSTNORD_SENDER_NAME || "",
      sender_address: process.env.POSTNORD_SENDER_ADDRESS || "",
    })

    const servicePoints = await client.findServicePoints({
      postalCode,
      countryCode: (countryCode as string) || "SE",
      city: city as string,
      streetName: streetName as string,
      limit: limit ? parseInt(limit as string, 10) : 10,
    })

    res.json({ success: true, service_points: servicePoints })
  } catch (error) {
    console.error("Error fetching PostNord service points:", error)
    res.status(500).json({
      success: false,
      error: "Could not fetch service points",
    })
  }
}
