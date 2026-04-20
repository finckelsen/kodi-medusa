import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { syncCompanyShippingMethod } from "../utils"

type CompanyCartSyncBody = {
  cart_id?: string
}

export async function POST(
  req: MedusaRequest<CompanyCartSyncBody>,
  res: MedusaResponse
) {
  try {
    const cartId = req.body?.cart_id?.trim()

    if (!cartId) {
      res.status(400).json({
        success: false,
        error: "cart_id är obligatoriskt.",
      })
      return
    }

    const applied = await syncCompanyShippingMethod(req.scope, cartId)

    res.status(200).json({ success: true, applied })
  } catch (error: any) {
    console.error("Company cart sync error:", error)
    res.status(500).json({
      success: false,
      error: error?.message || "Kunde inte uppdatera leveransmetoderna.",
    })
  }
}
