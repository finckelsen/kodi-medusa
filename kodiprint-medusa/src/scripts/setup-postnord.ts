import { ExecArgs } from "@medusajs/framework/types"
import {
  ContainerRegistrationKeys,
  Modules,
} from "@medusajs/framework/utils"
import {
  createShippingOptionsWorkflow,
  createShippingProfilesWorkflow,
} from "@medusajs/medusa/core-flows"

export default async function setupPostNordShipping({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const link = container.resolve(ContainerRegistrationKeys.LINK)
  const fulfillmentService = container.resolve(Modules.FULFILLMENT)
  const stockLocationService = container.resolve(Modules.STOCK_LOCATION)

  logger.info("Setting up PostNord shipping...")

  // Get existing stock location
  const stockLocations = await stockLocationService.listStockLocations({})
  if (stockLocations.length === 0) {
    logger.error("No stock location found. Run seed script first.")
    return
  }
  const stockLocation = stockLocations[0]

  // Link stock location to PostNord fulfillment provider
  try {
    await link.create({
      [Modules.STOCK_LOCATION]: {
        stock_location_id: stockLocation.id,
      },
      [Modules.FULFILLMENT]: {
        fulfillment_provider_id: "postnord_postnord",
      },
    })
    logger.info("Linked stock location to PostNord provider")
  } catch (e: any) {
    logger.info("PostNord provider link already exists")
  }

  // Get or create shipping profile
  const shippingProfiles = await fulfillmentService.listShippingProfiles({
    type: "default",
  })
  let shippingProfile = shippingProfiles.length ? shippingProfiles[0] : null

  if (!shippingProfile) {
    const { result: shippingProfileResult } =
      await createShippingProfilesWorkflow(container).run({
        input: {
          data: [
            {
              name: "Default Shipping Profile",
              type: "default",
            },
          ],
        },
      })
    shippingProfile = shippingProfileResult[0]
  }

  // Create or reuse PostNord fulfillment set with Sweden service zone
  let fulfillmentSet: any
  const existingSets = await fulfillmentService.listFulfillmentSets({
    name: "PostNord Leverans",
  })

  if (existingSets.length > 0) {
    fulfillmentSet = existingSets[0]
    logger.info(`Reusing existing fulfillment set: ${fulfillmentSet.id}`)

    // Ensure service zones are loaded
    if (!fulfillmentSet.service_zones?.length) {
      const fullSet = await fulfillmentService.retrieveFulfillmentSet(
        fulfillmentSet.id,
        { relations: ["service_zones"] }
      )
      fulfillmentSet = fullSet
    }
  } else {
    fulfillmentSet = await fulfillmentService.createFulfillmentSets({
      name: "PostNord Leverans",
      type: "shipping",
      service_zones: [
        {
          name: "Sverige (PostNord)",
          geo_zones: [
            {
              country_code: "se",
              type: "country",
            },
          ],
        },
      ],
    })
    logger.info(`Created fulfillment set: ${fulfillmentSet.id}`)
  }

  // Link fulfillment set to stock location
  try {
    await link.create({
      [Modules.STOCK_LOCATION]: {
        stock_location_id: stockLocation.id,
      },
      [Modules.FULFILLMENT]: {
        fulfillment_set_id: fulfillmentSet.id,
      },
    })
  } catch (e: any) {
    logger.info("Fulfillment set link already exists")
  }

  const serviceZoneId = fulfillmentSet.service_zones[0].id

  // Create PostNord shipping options
  await createShippingOptionsWorkflow(container).run({
    input: [
      {
        name: "PostNord Hemleverans",
        price_type: "calculated",
        provider_id: "postnord_postnord",
        service_zone_id: serviceZoneId,
        shipping_profile_id: shippingProfile.id,
        type: {
          label: "PostNord Hemleverans",
          description: "Hemleverans med PostNord MyPack Home. Leverans inom 1-3 arbetsdagar.",
          code: "postnord_home",
        },
        data: {
          service_code: "17",
        },
        rules: [
          {
            attribute: "enabled_in_store",
            value: "true",
            operator: "eq",
          },
          {
            attribute: "is_return",
            value: "false",
            operator: "eq",
          },
        ],
      },
      {
        name: "PostNord Ombud",
        price_type: "calculated",
        provider_id: "postnord_postnord",
        service_zone_id: serviceZoneId,
        shipping_profile_id: shippingProfile.id,
        type: {
          label: "PostNord Ombud",
          description: "Hämta ditt paket på närmaste PostNord-ombud. Leverans inom 1-3 arbetsdagar.",
          code: "postnord_collect",
        },
        data: {
          service_code: "19",
        },
        rules: [
          {
            attribute: "enabled_in_store",
            value: "true",
            operator: "eq",
          },
          {
            attribute: "is_return",
            value: "false",
            operator: "eq",
          },
        ],
      },
    ],
  })

  logger.info("PostNord shipping options created!")
  logger.info("  - PostNord Hemleverans (MyPack Home, service code 17)")
  logger.info("  - PostNord Ombud (MyPack Collect, service code 19)")
  logger.info("PostNord setup complete!")
}
