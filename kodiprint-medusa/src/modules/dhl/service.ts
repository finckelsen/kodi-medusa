import {
  CalculatedShippingOptionPrice,
  CalculateShippingOptionPriceDTO,
  CreateFulfillmentResult,
  FulfillmentDTO,
  FulfillmentItemDTO,
  FulfillmentOption,
  FulfillmentOrderDTO,
} from "@medusajs/framework/types"
import {
  AbstractFulfillmentProviderService,
} from "@medusajs/framework/utils"
import { DhlClient } from "./client"
import { DhlProviderOptions } from "./types"

type InjectedDependencies = {
  logger: any
}

const DEFAULT_SERVICE_POINT_PRODUCT_CODE = "103"
const DEFAULT_HOME_DELIVERY_PRODUCT_CODE = "401"
const DEFAULT_SERVICE_POINT_BASE_AMOUNT = 59
const DEFAULT_HOME_DELIVERY_BASE_AMOUNT = 89
const DEFAULT_BUSINESS_BASE_AMOUNT = 149
const DEFAULT_DIMENSIONS_CM = {
  width: 20,
  height: 10,
  length: 20,
}

class DhlFulfillmentService extends AbstractFulfillmentProviderService {
  static identifier = "dhl"

  protected logger_: any
  protected options_: DhlProviderOptions
  protected client_: DhlClient

  constructor({ logger }: InjectedDependencies, options: DhlProviderOptions) {
    super()
    this.logger_ = logger
    this.options_ = options
    this.client_ = new DhlClient(options)
  }

  async getFulfillmentOptions(): Promise<FulfillmentOption[]> {
    const options: FulfillmentOption[] = [
      {
        id: "dhl-service-point",
        name: "DHL Service Point",
        product_code:
          this.options_.service_point_product_code ||
          DEFAULT_SERVICE_POINT_PRODUCT_CODE,
      },
      {
        id: "dhl-home-delivery",
        name: "DHL Hemleverans",
        product_code:
          this.options_.home_delivery_product_code ||
          DEFAULT_HOME_DELIVERY_PRODUCT_CODE,
      },
    ]

    if (this.options_.business_product_code?.trim()) {
      options.push({
        id: "dhl-business-delivery",
        name: "DHL Företagsleverans",
        product_code: this.options_.business_product_code,
      })
    }

    return options
  }

  async validateFulfillmentData(
    optionData: Record<string, unknown>,
    data: Record<string, unknown>,
    context: any
  ): Promise<any> {
    const deliveryType = String(optionData.delivery_type || "")
    const requiresServicePoint =
      Boolean(optionData.requires_service_point) ||
      deliveryType === "service_point"

    if (requiresServicePoint && !data.service_point_id) {
      throw new Error("Du måste välja ett DHL-ombud för denna leveransmetod.")
    }

    let productCode =
      String(data.product_code || optionData.product_code || "").trim()

    if (!productCode) {
      if (deliveryType === "service_point") {
        productCode =
          this.options_.service_point_product_code ||
          DEFAULT_SERVICE_POINT_PRODUCT_CODE
      } else if (deliveryType === "home_delivery") {
        productCode =
          this.options_.home_delivery_product_code ||
          DEFAULT_HOME_DELIVERY_PRODUCT_CODE
      } else if (deliveryType === "business_delivery") {
        productCode = this.options_.business_product_code || ""
      }
    }

    if (!productCode) {
      throw new Error("DHL-produktkod saknas för den valda leveransmetoden.")
    }

    const shippingAddress = context?.cart?.shipping_address

    if (
      deliveryType === "home_delivery" &&
      this.options_.home_delivery_endpoint &&
      this.options_.customer_number?.trim() &&
      this.options_.api_key?.trim() &&
      shippingAddress?.postal_code &&
      shippingAddress?.city
    ) {
      const validation = await this.client_.validateHomeDeliveryAddress({
        postalCode: shippingAddress.postal_code,
        cityName: shippingAddress.city,
      })

      productCode = validation.productCode || productCode
    }

    return {
      ...data,
      carrier: "dhl",
      delivery_type: deliveryType,
      product_code: productCode,
    }
  }

  async validateOption(data: Record<string, unknown>): Promise<boolean> {
    return Boolean(data)
  }

  async canCalculate(): Promise<boolean> {
    return true
  }

  async calculatePrice(
    optionData: CalculateShippingOptionPriceDTO["optionData"],
    data: CalculateShippingOptionPriceDTO["data"],
    context: CalculateShippingOptionPriceDTO["context"]
  ): Promise<CalculatedShippingOptionPrice> {
    void data

    const deliveryType = String(optionData.delivery_type || "")
    const baseAmount = Number(
      optionData.base_amount ??
        (deliveryType === "service_point"
          ? DEFAULT_SERVICE_POINT_BASE_AMOUNT
          : deliveryType === "home_delivery"
            ? DEFAULT_HOME_DELIVERY_BASE_AMOUNT
            : DEFAULT_BUSINESS_BASE_AMOUNT)
    )
    const freeShippingThreshold = Number(optionData.free_shipping_threshold || 0)
    const cart = context.cart as any
    const itemTotal =
      typeof cart?.item_total === "number"
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

    const qualifiesForFreeShipping =
      freeShippingThreshold > 0 &&
      deliveryType !== "business_delivery" &&
      itemTotal >= freeShippingThreshold

    return {
      calculated_amount: qualifiesForFreeShipping ? 0 : baseAmount,
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
        this.logger_.warn("DHL: No shipping address found, creating fulfillment without booking")
        return { data: {}, labels: [] }
      }

      const totalNumberOfPieces = Math.max(
        1,
        items.reduce((sum, item) => sum + (item.quantity || 1), 0)
      )

      let totalWeightGrams = 0
      let totalVolume = 0

      for (const item of items) {
        const quantity = item.quantity || 1
        const metadata = (item as any)?.metadata || {}
        const variant = (item as any)?.variant || {}

        const weightGrams =
          Number(variant?.weight) ||
          Number(metadata?.weight_grams) ||
          500

        const width =
          Number(metadata?.width_cm) || DEFAULT_DIMENSIONS_CM.width
        const height =
          Number(metadata?.height_cm) || DEFAULT_DIMENSIONS_CM.height
        const length =
          Number(metadata?.length_cm) || DEFAULT_DIMENSIONS_CM.length

        totalWeightGrams += weightGrams * quantity
        totalVolume += (width * height * length * quantity) / 1_000_000
      }

      if (!totalWeightGrams) {
        totalWeightGrams = 500
      }

      if (!totalVolume) {
        totalVolume =
          (DEFAULT_DIMENSIONS_CM.width *
            DEFAULT_DIMENSIONS_CM.height *
            DEFAULT_DIMENSIONS_CM.length) /
          1_000_000
      }

      const averagePieceWeightKg = Number(
        (totalWeightGrams / 1000 / totalNumberOfPieces).toFixed(3)
      )
      const shippingDate = new Date().toISOString().slice(0, 10)

      const shipmentResult = await this.client_.createShipment({
        productCode: String(data.product_code || ""),
        shippingDate,
        consignee: {
          name: `${shippingAddress.first_name || ""} ${shippingAddress.last_name || ""}`.trim(),
          address: {
            street: shippingAddress.address_1 || "",
            postalCode: shippingAddress.postal_code || "",
            city: shippingAddress.city || "",
            countryCode: shippingAddress.country_code?.toUpperCase() || "SE",
          },
          phone: shippingAddress.phone || "",
          email: (order as any)?.email || "",
        },
        accessPoint: data.service_point_id
          ? {
              id: String(data.service_point_id),
              name: String(data.service_point_name || ""),
              address: {
                street: String(data.service_point_street || ""),
                postalCode: String(data.service_point_postal_code || ""),
                city: String(data.service_point_city || ""),
                countryCode: String(
                  data.service_point_country_code || "SE"
                ).toUpperCase(),
              },
            }
          : undefined,
        totalNumberOfPieces,
        totalWeight: Number((totalWeightGrams / 1000).toFixed(3)),
        totalVolume: Number(totalVolume.toFixed(3)),
        pieces: [
          {
            numberOfPieces: totalNumberOfPieces,
            weight: averagePieceWeightKg,
            width: DEFAULT_DIMENSIONS_CM.width,
            height: DEFAULT_DIMENSIONS_CM.height,
            length: DEFAULT_DIMENSIONS_CM.length,
            volume: Number((totalVolume / totalNumberOfPieces).toFixed(3)),
            packageType: "PKT",
          },
        ],
      })

      return {
        data: {
          ...shipmentResult.raw,
          carrier: "dhl",
          product_code: data.product_code,
          service_point_id: data.service_point_id,
          service_point_name: data.service_point_name,
          shipment_id: shipmentResult.shipmentId,
          tracking_numbers: shipmentResult.trackingNumbers,
          routing_code: shipmentResult.routingCode,
        },
        labels: [],
      }
    } catch (error: any) {
      this.logger_.error(`DHL createFulfillment failed: ${error?.message || error}`)
      throw error
    }
  }
}

export default DhlFulfillmentService
