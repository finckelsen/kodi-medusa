import {
  AbstractFulfillmentProviderService,
  Modules,
} from "@medusajs/framework/utils"
import {
  CalculatedShippingOptionPrice,
  CalculateShippingOptionPriceDTO,
  CreateFulfillmentResult,
  FulfillmentDTO,
  FulfillmentItemDTO,
  FulfillmentOption,
  FulfillmentOrderDTO,
} from "@medusajs/framework/types"
import { PostNordClient } from "./client"
import { PostNordProviderOptions } from "./types"

type InjectedDependencies = {
  logger: any
}

const DEFAULT_FREE_SHIPPING_THRESHOLD = 500

const getFreeShippingThreshold = () => {
  const configuredThreshold = process.env.POSTNORD_FREE_SHIPPING_THRESHOLD

  if (!configuredThreshold?.trim()) {
    return DEFAULT_FREE_SHIPPING_THRESHOLD
  }

  const parsedThreshold = Number(configuredThreshold)

  return Number.isFinite(parsedThreshold)
    ? parsedThreshold
    : DEFAULT_FREE_SHIPPING_THRESHOLD
}

class PostNordFulfillmentService extends AbstractFulfillmentProviderService {
  static identifier = "postnord"

  protected logger_: any
  protected options_: PostNordProviderOptions
  protected client_: PostNordClient

  constructor({ logger }: InjectedDependencies, options: PostNordProviderOptions) {
    super()
    this.logger_ = logger
    this.options_ = options
    this.client_ = new PostNordClient(options)
  }

  async getFulfillmentOptions(): Promise<FulfillmentOption[]> {
    return [
      {
        id: "postnord-mypack-home",
        name: "PostNord Hemleverans",
        service_code: "17",
      },
      {
        id: "postnord-mypack-collect",
        name: "PostNord Ombud",
        service_code: "19",
      },
    ]
  }

  async validateFulfillmentData(
    optionData: Record<string, unknown>,
    data: Record<string, unknown>,
    context: any
  ): Promise<any> {
    const serviceCode = optionData.service_code as string

    // MyPack Collect requires a service point
    if (serviceCode === "19" && !data.service_point_id) {
      throw new Error("Du måste välja ett PostNord-ombud för denna leveransmetod.")
    }

    return {
      ...data,
      service_code: serviceCode,
    }
  }

  async validateOption(data: Record<string, unknown>): Promise<boolean> {
    return true
  }

  async canCalculate(data: any): Promise<boolean> {
    return true
  }

  async calculatePrice(
    optionData: CalculateShippingOptionPriceDTO["optionData"],
    data: CalculateShippingOptionPriceDTO["data"],
    context: CalculateShippingOptionPriceDTO["context"]
  ): Promise<CalculatedShippingOptionPrice> {
    const freeShippingThreshold = getFreeShippingThreshold()
    const cart = context.cart
    const itemTotal = typeof cart?.item_total === "number"
      ? cart.item_total
      : Array.isArray(cart?.items)
        ? cart.items.reduce((sum, item: any) => {
            const lineTotal =
              typeof item?.subtotal === "number"
                ? item.subtotal
                : typeof item?.total === "number"
                  ? item.total
                  : typeof item?.unit_price === "number"
                    ? item.unit_price * (item.quantity ?? 1)
                    : 0

            return sum + lineTotal
          }, 0)
        : 0

    if (itemTotal >= freeShippingThreshold) {
      return {
        calculated_amount: 0,
        is_calculated_price_tax_inclusive: true,
      }
    }

    // Weight-based pricing aligned with PostNord agreement.
    // Prices are in SEK main currency units to match the rest of this storefront.

    let totalWeight = 0
    if (cart?.items) {
      for (const item of cart.items) {
        const variant = item.variant as any
        const weight = variant?.weight || 500 // default 500g
        totalWeight += weight * item.quantity
      }
    }

    // Default to 500g if no weight info
    if (totalWeight === 0) {
      totalWeight = 500
    }

    const serviceCode = optionData.service_code as string
    let price: number

    if (serviceCode === "19") {
      // MyPack Collect (ombud) - cheaper
      if (totalWeight <= 1000) {
        price = 49
      } else if (totalWeight <= 3000) {
        price = 59
      } else if (totalWeight <= 5000) {
        price = 69
      } else if (totalWeight <= 10000) {
        price = 89
      } else {
        price = 119
      }
    } else {
      // MyPack Home (hemleverans) - more expensive
      if (totalWeight <= 1000) {
        price = 69
      } else if (totalWeight <= 3000) {
        price = 79
      } else if (totalWeight <= 5000) {
        price = 99
      } else if (totalWeight <= 10000) {
        price = 119
      } else {
        price = 149
      }
    }

    return {
      calculated_amount: price,
      is_calculated_price_tax_inclusive: true,
    }
  }

  async createFulfillment(
    data: Record<string, unknown>,
    items: Partial<Omit<FulfillmentItemDTO, "fulfillment">>[],
    order: Partial<FulfillmentOrderDTO> | undefined,
    fulfillment: Partial<Omit<FulfillmentDTO, "provider_id" | "data" | "items">>
  ): Promise<CreateFulfillmentResult> {
    try {
      const shippingAddress = order?.shipping_address as any

      if (!shippingAddress) {
        this.logger_.warn("PostNord: No shipping address found, creating fulfillment without booking")
        return { data: {}, labels: [] }
      }

      // Calculate total weight from items
      let totalWeight = 0
      for (const item of items) {
        const quantity = item.quantity || 1
        totalWeight += 500 * quantity // default 500g per item
      }

      const shipmentResult = await this.client_.createShipment({
        serviceCode: (data.service_code as string) || "17",
        consignee: {
          name: `${shippingAddress.first_name || ""} ${shippingAddress.last_name || ""}`.trim(),
          address: {
            streetName: shippingAddress.address_1 || "",
            postalCode: shippingAddress.postal_code || "",
            city: shippingAddress.city || "",
            countryCode: shippingAddress.country_code?.toUpperCase() || "SE",
          },
          phone: shippingAddress.phone || "",
          email: (order as any)?.email || "",
        },
        servicePointId: data.service_point_id as string | undefined,
        totalWeight: totalWeight || 500,
      })

      return {
        data: {
          ...shipmentResult,
          service_code: data.service_code,
          service_point_id: data.service_point_id,
        },
        labels: [],
      }
    } catch (error) {
      this.logger_.error(`PostNord fulfillment creation failed: ${error}`)
      return {
        data: {
          error: String(error),
          service_code: data.service_code,
        },
        labels: [],
      }
    }
  }

  async cancelFulfillment(data: Record<string, unknown>): Promise<any> {
    // PostNord doesn't have a cancel API in basic integration
    this.logger_.info(`PostNord: Canceling fulfillment ${data.shipmentId || "unknown"}`)
    return {}
  }

  async createReturnFulfillment(
    fulfillment: Record<string, unknown>
  ): Promise<CreateFulfillmentResult> {
    return { data: {}, labels: [] }
  }

  async getFulfillmentDocuments(data: Record<string, unknown>): Promise<never[]> {
    return []
  }

  async getReturnDocuments(data: Record<string, unknown>): Promise<never[]> {
    return []
  }

  async getShipmentDocuments(data: Record<string, unknown>): Promise<never[]> {
    return []
  }

  async retrieveDocuments(
    fulfillmentData: Record<string, unknown>,
    documentType: string
  ): Promise<void> {
    return
  }
}

export default PostNordFulfillmentService
