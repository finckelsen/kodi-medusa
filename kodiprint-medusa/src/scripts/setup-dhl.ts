import { ExecArgs } from "@medusajs/framework/types"
import {
  ContainerRegistrationKeys,
  Modules,
} from "@medusajs/framework/utils"
import {
  createShippingOptionsWorkflow,
  createShippingProfilesWorkflow,
  updateShippingOptionsWorkflow,
} from "@medusajs/medusa/core-flows"

const DHL_FULFILLMENT_SET_NAME = "DHL Leverans"
const DEFAULT_FREE_SHIPPING_THRESHOLD = 500

type ShippingOptionInput = {
  name: string
  type: {
    label: string
    description: string
    code: string
  }
  data: Record<string, unknown>
  price_type: "calculated"
}

const getFreeShippingThreshold = () => {
  const raw = process.env.DHL_FREE_SHIPPING_THRESHOLD?.trim()

  if (!raw) {
    return DEFAULT_FREE_SHIPPING_THRESHOLD
  }

  const parsed = Number(raw)
  return Number.isFinite(parsed) ? parsed : DEFAULT_FREE_SHIPPING_THRESHOLD
}

const getBaseAmount = (envKey: string, fallback: number) => {
  const raw = process.env[envKey]?.trim()

  if (!raw) {
    return fallback
  }

  const parsed = Number(raw)
  return Number.isFinite(parsed) ? parsed : fallback
}

const buildDesiredOptions = (): ShippingOptionInput[] => {
  const threshold = getFreeShippingThreshold()
  const options: ShippingOptionInput[] = [
    {
      name: "DHL Service Point",
      price_type: "calculated",
      type: {
        label: "DHL Service Point",
        description: "Leverans till DHL-ombud eller paketbox.",
        code: "dhl_service_point",
      },
      data: {
        carrier: "dhl",
        audience: "consumer",
        delivery_type: "service_point",
        requires_service_point: true,
        base_amount: getBaseAmount("DHL_SERVICE_POINT_BASE_AMOUNT", 59),
        free_shipping_threshold: threshold,
        product_code: process.env.DHL_SERVICE_POINT_PRODUCT_CODE || "103",
      },
    },
    {
      name: "DHL Hemleverans",
      price_type: "calculated",
      type: {
        label: "DHL Hemleverans",
        description: "Hemleverans med DHL för privatkunder.",
        code: "dhl_home_delivery",
      },
      data: {
        carrier: "dhl",
        audience: "consumer",
        delivery_type: "home_delivery",
        base_amount: getBaseAmount("DHL_HOME_DELIVERY_BASE_AMOUNT", 89),
        free_shipping_threshold: threshold,
        product_code: process.env.DHL_HOME_DELIVERY_PRODUCT_CODE || "401",
      },
    },
  ]

  const businessProductCode = process.env.DHL_BUSINESS_PRODUCT_CODE?.trim()

  if (businessProductCode) {
    options.push({
      name: "DHL Företagsleverans",
      price_type: "calculated",
      type: {
        label: "DHL Företagsleverans",
        description: "Leverans till företagsadress för större eller tyngre beställningar.",
        code: "dhl_business_delivery",
      },
      data: {
        carrier: "dhl",
        audience: "company",
        delivery_type: "business_delivery",
        base_amount: getBaseAmount("DHL_BUSINESS_BASE_AMOUNT", 149),
        product_code: businessProductCode,
      },
    })
  }

  return options
}

export default async function setupDhlShipping({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const link = container.resolve(ContainerRegistrationKeys.LINK)
  const fulfillmentService = container.resolve(Modules.FULFILLMENT)
  const stockLocationService = container.resolve(Modules.STOCK_LOCATION)
  const regionService = container.resolve(Modules.REGION)

  logger.info("Setting up DHL shipping options...")

  const stockLocations = await stockLocationService.listStockLocations({})
  if (stockLocations.length === 0) {
    logger.error("No stock location found. Run seed or setup-fulfillment first.")
    return
  }

  const stockLocation = stockLocations[0]

  try {
    await link.create({
      [Modules.STOCK_LOCATION]: {
        stock_location_id: stockLocation.id,
      },
      [Modules.FULFILLMENT]: {
        fulfillment_provider_id: "dhl_dhl",
      },
    })
  } catch {
    logger.info("DHL fulfillment provider already linked to stock location.")
  }

  const regions = await regionService.listRegions({
    name: "Sverige",
  })

  if (regions.length === 0) {
    logger.error("No 'Sverige' region found. Run seed first.")
    return
  }

  const shippingProfiles = await fulfillmentService.listShippingProfiles({
    type: "default",
  })

  let shippingProfile = shippingProfiles[0]

  if (!shippingProfile) {
    const { result } = await createShippingProfilesWorkflow(container).run({
      input: {
        data: [
          {
            name: "Default Shipping Profile",
            type: "default",
          },
        ],
      },
    })

    shippingProfile = result[0]
  }

  let fulfillmentSet: any
  const existingSets = await fulfillmentService.listFulfillmentSets({
    name: DHL_FULFILLMENT_SET_NAME,
  })

  if (existingSets.length > 0) {
    fulfillmentSet = existingSets[0]

    if (!fulfillmentSet.service_zones?.length) {
      fulfillmentSet = await fulfillmentService.retrieveFulfillmentSet(
        fulfillmentSet.id,
        { relations: ["service_zones"] }
      )
    }
  } else {
    fulfillmentSet = await fulfillmentService.createFulfillmentSets({
      name: DHL_FULFILLMENT_SET_NAME,
      type: "shipping",
      service_zones: [
        {
          name: "Sverige (DHL)",
          geo_zones: [
            {
              country_code: "se",
              type: "country",
            },
          ],
        },
      ],
    })
  }

  try {
    await link.create({
      [Modules.STOCK_LOCATION]: {
        stock_location_id: stockLocation.id,
      },
      [Modules.FULFILLMENT]: {
        fulfillment_set_id: fulfillmentSet.id,
      },
    })
  } catch {
    logger.info("DHL fulfillment set already linked to stock location.")
  }

  const serviceZoneId = fulfillmentSet.service_zones?.[0]?.id

  if (!serviceZoneId) {
    logger.error("No DHL service zone found. Shipping options were not created.")
    return
  }

  const desiredOptions = buildDesiredOptions()

  if (!process.env.DHL_BUSINESS_PRODUCT_CODE?.trim()) {
    logger.info(
      "Skipping DHL Företagsleverans until DHL_BUSINESS_PRODUCT_CODE is configured."
    )
  }

  const existingOptions = (await fulfillmentService.listShippingOptions({})) as Array<{
    id: string
    name: string
    provider_id?: string | null
  }>

  const existingByName = new Map(existingOptions.map((option) => [option.name, option]))

  const baseRules = [
    {
      attribute: "enabled_in_store" as const,
      value: "true",
      operator: "eq" as const,
    },
    {
      attribute: "is_return" as const,
      value: "false",
      operator: "eq" as const,
    },
  ]

  const optionsToCreate = desiredOptions
    .filter((option) => !existingByName.has(option.name))
    .map((option) => ({
      ...option,
      provider_id: "dhl_dhl",
      service_zone_id: serviceZoneId,
      shipping_profile_id: shippingProfile.id,
      rules: baseRules,
    }))

  if (optionsToCreate.length > 0) {
    await createShippingOptionsWorkflow(container).run({
      input: optionsToCreate,
    })
  }

  const optionsToUpdate = desiredOptions
    .filter((option) => existingByName.has(option.name))
    .map((option) => ({
      id: existingByName.get(option.name)!.id,
      name: option.name,
      type: option.type,
      data: option.data,
      price_type: option.price_type,
      provider_id: "dhl_dhl",
      service_zone_id: serviceZoneId,
      shipping_profile_id: shippingProfile.id,
      rules: baseRules,
    }))

  if (optionsToUpdate.length > 0) {
    await updateShippingOptionsWorkflow(container).run({
      input: optionsToUpdate,
    })
  }

  logger.info("DHL shipping options are ready in Medusa.")
  logger.info("  - DHL Service Point (calculated price in DHL provider, DHL API for ombud/booking)")
  logger.info("  - DHL Hemleverans (calculated price in DHL provider, DHL API for booking)")

  if (process.env.DHL_BUSINESS_PRODUCT_CODE?.trim()) {
    logger.info("  - DHL Företagsleverans (calculated price in DHL provider, DHL API for booking)")
  }

  if (optionsToCreate.length > 0) {
    logger.info(`Created ${optionsToCreate.length} DHL option(s).`)
  }

  if (optionsToUpdate.length > 0) {
    logger.info(
      `Updated ${optionsToUpdate.length} existing DHL option(s) to provider-managed calculated pricing.`
    )
  }
}
