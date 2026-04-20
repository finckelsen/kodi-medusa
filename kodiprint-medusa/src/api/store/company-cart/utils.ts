import { Modules } from "@medusajs/framework/utils"

type CartScope = {
  resolve: (key: string) => any
}

type CartShippingMethod = {
  id: string
  data?: Record<string, unknown> | null
}

type CompanyCart = {
  id: string
  shipping_methods?: CartShippingMethod[] | null
}

export const syncCompanyShippingMethod = async (
  scope: CartScope,
  cartId: string
) => {
  const cartModule = scope.resolve(Modules.CART)

  const cart = (await cartModule.retrieveCart(cartId, {
    relations: ["shipping_methods"],
  })) as CompanyCart | null

  if (!cart) {
    throw new Error(`Cart ${cartId} hittades inte.`)
  }

  const existingCompanyShippingIds = (cart.shipping_methods ?? [])
    .filter((method) => method.data?.company_shipping === true)
    .map((method) => method.id)

  // Company carts now use regular shipping options in checkout.
  // Keep this endpoint as a legacy cleanup step so older carts don't
  // keep a stale hardcoded shipping method attached.
  if (existingCompanyShippingIds.length > 0) {
    await cartModule.deleteShippingMethods(existingCompanyShippingIds)
    return true
  }

  return false
}
