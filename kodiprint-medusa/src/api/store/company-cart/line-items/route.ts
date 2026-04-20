import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"
import { addToCartWorkflowId } from "@medusajs/core-flows"

import { syncCompanyShippingMethod } from "../utils"

type CompanyCartAddBody = {
  cart_id?: string
  variant_id?: string
  quantity?: number
  unit_price?: number
  metadata?: Record<string, unknown>
}

export async function POST(
  req: MedusaRequest<CompanyCartAddBody>,
  res: MedusaResponse
) {
  try {
    const body = (req.body || {}) as CompanyCartAddBody
    const cartId = body.cart_id?.trim()
    const variantId = body.variant_id?.trim()
    const quantity = Number(body.quantity ?? 1)
    const unitPrice = Number(body.unit_price)

    if (!cartId || !variantId) {
      res.status(400).json({
        success: false,
        error: "cart_id och variant_id är obligatoriska.",
      })
      return
    }

    if (!Number.isFinite(unitPrice) || unitPrice < 0) {
      res.status(400).json({
        success: false,
        error: "unit_price måste vara ett giltigt pris.",
      })
      return
    }

    if (!Number.isFinite(quantity) || quantity < 1) {
      res.status(400).json({
        success: false,
        error: "quantity måste vara minst 1.",
      })
      return
    }

    const workflowEngine = req.scope.resolve(Modules.WORKFLOW_ENGINE)

    await workflowEngine.run(addToCartWorkflowId, {
      input: {
        cart_id: cartId,
        items: [
          {
            variant_id: variantId,
            quantity,
            unit_price: unitPrice,
            is_tax_inclusive: false,
            is_discountable: false,
            metadata: body.metadata || {},
          },
        ],
      },
    })

    const applied = await syncCompanyShippingMethod(req.scope, cartId)

    res.status(200).json({ success: true, applied })
  } catch (error: any) {
    console.error("Company cart add error:", error)
    res.status(500).json({
      success: false,
      error: error?.message || "Kunde inte lägga till företagsprodukten i varukorgen.",
    })
  }
}
