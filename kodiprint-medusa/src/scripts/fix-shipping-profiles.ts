import { ExecArgs } from "@medusajs/framework/types"
import {
  ContainerRegistrationKeys,
  Modules,
} from "@medusajs/framework/utils"

export default async function fixShippingProfiles({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const fulfillmentService = container.resolve(Modules.FULFILLMENT)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const link = container.resolve(ContainerRegistrationKeys.LINK)

  // Get the default shipping profile
  const profiles = await fulfillmentService.listShippingProfiles({ type: "default" })
  if (profiles.length === 0) {
    logger.error("No default shipping profile found.")
    return
  }
  const profile = profiles[0]
  logger.info(`Default shipping profile: ${profile.id} (${profile.name})`)

  // Get all products and their shipping profile links
  const { data: products } = await query.graph({
    entity: "product",
    fields: ["id", "title", "shipping_profile.*"],
  })

  const unlinked = products.filter((p: any) => !p.shipping_profile)
  logger.info(`Found ${unlinked.length} products without shipping profile (of ${products.length} total)`)

  if (unlinked.length === 0) {
    logger.info("All products already have shipping profiles.")
    return
  }

  // Link each unlinked product to the default shipping profile
  for (const product of unlinked) {
    await link.create({
      [Modules.PRODUCT]: { product_id: product.id },
      [Modules.FULFILLMENT]: { shipping_profile_id: profile.id },
    })
    logger.info(`Linked "${product.title}" to ${profile.name}`)
  }

  logger.info(`Fixed ${unlinked.length} products!`)
}
