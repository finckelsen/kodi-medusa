import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"

const INTERNAL_API_SECRET = process.env.INTERNAL_API_SECRET

interface ChangePasswordRequest {
  email: string
  newPassword: string
  customerId: string
}

export async function POST(
  req: MedusaRequest<ChangePasswordRequest>,
  res: MedusaResponse
) {
  try {
    // Verify internal API secret — only the storefront may call this endpoint
    const secret = req.headers["x-internal-secret"]
    if (!INTERNAL_API_SECRET || secret !== INTERNAL_API_SECRET) {
      return res.status(401).json({
        success: false,
        error: "Unauthorized",
      })
    }

    const { email, newPassword, customerId } = req.body

    if (!email || !newPassword || !customerId) {
      return res.status(400).json({
        success: false,
        error: "Email, newPassword och customerId krävs",
      })
    }

    const authModuleService = req.scope.resolve(Modules.AUTH)

    // Find and delete existing auth identity for this email
    const existingIdentities = await authModuleService.listAuthIdentities({
      provider_identities: {
        entity_id: email,
      },
    })

    if (existingIdentities.length > 0) {
      for (const identity of existingIdentities) {
        await authModuleService.deleteAuthIdentities([identity.id])
      }
    }

    // Register with new password via HTTP (this handles proper password hashing)
    const baseUrl = `http://localhost:${process.env.PORT || 9000}`
    const registerResponse = await fetch(`${baseUrl}/auth/customer/emailpass/register`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, password: newPassword }),
    })

    if (!registerResponse.ok) {
      const errorData = await registerResponse.json()
      return res.status(500).json({
        success: false,
        error: errorData.message || "Kunde inte registrera nytt lösenord",
      })
    }

    // Link the new auth identity to the customer
    const newIdentities = await authModuleService.listAuthIdentities({
      provider_identities: {
        entity_id: email,
      },
    })

    if (newIdentities.length > 0) {
      await authModuleService.updateAuthIdentities([
        {
          id: newIdentities[0].id,
          app_metadata: {
            customer_id: customerId,
          },
        },
      ])
    }

    return res.json({
      success: true,
      message: "Lösenord uppdaterat",
    })
  } catch (error: any) {
    console.error("Change password error:", error)
    return res.status(500).json({
      success: false,
      error: error.message || "Ett serverfel uppstod",
    })
  }
}
