import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

/**
 * Public API endpoint to get a single förening by ID
 * GET /store/foreningar/:id
 */
export async function GET(
  req: MedusaRequest,
  res: MedusaResponse
) {
  try {
    const { id } = req.params
    const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

    let customer: any = null

    if (id.startsWith("cus_")) {
      // Lookup by customer ID
      const { data: customers } = await query.graph({
        entity: "customer",
        fields: ["id", "email", "first_name", "last_name", "metadata"],
        filters: { id },
      })
      customer = customers?.[0]
    } else {
      // Lookup by slug — fetch all föreningar and find by slug
      const { data: customers } = await query.graph({
        entity: "customer",
        fields: ["id", "email", "first_name", "last_name", "metadata"],
        filters: {},
      })
      customer = customers?.find(
        (c: any) => c.metadata?.slug === id && c.metadata?.is_forening
      )
    }

    if (!customer) {
      return res.status(404).json({
        success: false,
        error: "Föreningen hittades inte",
      })
    }

    // Verify this is a förening with completed onboarding
    if (!customer.metadata?.is_forening || !customer.metadata?.onboarding_completed) {
      return res.status(404).json({
        success: false,
        error: "Föreningen hittades inte",
      })
    }

    res.json({
      success: true,
      forening: {
        id: customer.id,
        name: customer.metadata?.foreningsnamn || "Okänd förening",
        slug: customer.metadata?.slug || null,
        logo: customer.metadata?.logo_preview || customer.metadata?.logo || null,
        city: customer.metadata?.ort || null,
        description: customer.metadata?.description || null,
        kickback_percentage: customer.metadata?.kickback_percentage || 25,
        onboarding_completed: customer.metadata?.onboarding_completed || false,
      },
    })
  } catch (error) {
    console.error("Error fetching förening:", error)
    res.status(500).json({
      success: false,
      error: "Could not fetch förening",
    })
  }
}
