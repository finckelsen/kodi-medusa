import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

/**
 * Public API endpoint to list all föreningar
 * GET /store/foreningar
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  try {
    const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

    // Fetch all customers using the query service
    const { data: customers } = await query.graph({
      entity: "customer",
      fields: ["id", "email", "first_name", "last_name", "metadata"],
    })

    // Filter to only approved föreningar
    const foreningar = (customers || [])
      .filter((customer: any) => customer.metadata?.is_forening === true && customer.metadata?.approved === true)
      .map((customer: any) => ({
        id: customer.id,
        name: customer.metadata?.foreningsnamn || "Okänd förening",
        slug: customer.metadata?.slug || null,
        logo: customer.metadata?.logo_preview || customer.metadata?.logo || null,
        city: customer.metadata?.ort || null,
        onboarding_completed: customer.metadata?.onboarding_completed || false,
      }))

    res.json({
      success: true,
      foreningar,
    })
  } catch (error) {
    console.error("Error fetching foreningar:", error)
    res.status(500).json({
      success: false,
      error: "Could not fetch foreningar",
    })
  }
}
