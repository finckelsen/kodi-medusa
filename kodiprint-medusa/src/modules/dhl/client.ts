import {
  DhlHomeDeliveryValidationResponse,
  DhlProviderOptions,
  DhlServicePoint,
  DhlShipmentRequest,
  DhlShipmentResponse,
} from "./types"

const DEFAULT_SERVICEPOINT_ENDPOINT =
  "/servicepointlocatorapi/servicepoint/findnearestservicepoints"
const DEFAULT_TRANSPORT_INSTRUCTION_ENDPOINT =
  "/transportinstructionapi/v1/transportinstruction/sendtransportinstruction"
const DEFAULT_HOME_DELIVERY_ENDPOINT =
  "/homedeliverylocatorapi/v1/homedeliverylocator/validateadditionalservices"

type RequestOptions = {
  endpoint?: string
  body: Record<string, unknown>
}

export class DhlClient {
  private options: DhlProviderOptions

  constructor(options: DhlProviderOptions) {
    this.options = options
  }

  private resolveUrl(endpoint: string, fallbackPath: string) {
    const value = endpoint?.trim() || fallbackPath

    if (value.startsWith("http://") || value.startsWith("https://")) {
      return value
    }

    return new URL(value.replace(/^\//, ""), this.options.api_base_url).toString()
  }

  private getHeaders() {
    if (!this.options.api_key?.trim()) {
      throw new Error("DHL_API_KEY saknas i Medusa-backenden.")
    }

    return {
      "client-key": this.options.api_key,
      Accept: "application/json",
      "Content-Type": "application/json",
    }
  }

  private async postJson<T>({
    endpoint,
    body,
  }: RequestOptions & { endpoint: string }): Promise<T> {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: this.getHeaders(),
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      const text = await response.text().catch(() => "")
      throw new Error(`DHL API error (${response.status}): ${text}`)
    }

    return response.json() as Promise<T>
  }

  async findServicePoints(params: {
    countryCode: string
    postalCode: string
    city?: string
    street?: string
    limit?: number
  }): Promise<DhlServicePoint[]> {
    const endpoint = this.resolveUrl(
      this.options.servicepoint_endpoint || "",
      DEFAULT_SERVICEPOINT_ENDPOINT
    )

    const data = await this.postJson<{
      status?: string
      servicePoints?: Array<{
        id: string
        name: string
        street?: string
        cityName?: string
        postalCode?: string
        countryCode?: string
        latitude?: number
        longitude?: number
      }>
    }>({
      endpoint,
      body: {
        address: {
          street: params.street || "",
          cityName: params.city || "",
          postalCode: params.postalCode,
          countryCode: params.countryCode,
        },
        maxNumberOfItems: params.limit || 10,
        serviceTypes: [],
      },
    })

    if (data.status && data.status !== "OK") {
      throw new Error(`DHL Service Point error: ${data.status}`)
    }

    return (data.servicePoints || []).map((servicePoint) => ({
      id: servicePoint.id,
      name: servicePoint.name,
      address: {
        street: servicePoint.street || "",
        postal_code: servicePoint.postalCode || "",
        city: servicePoint.cityName || "",
        country_code: servicePoint.countryCode || "",
      },
      coordinates:
        typeof servicePoint.latitude === "number" &&
        typeof servicePoint.longitude === "number"
          ? {
              lat: servicePoint.latitude,
              lng: servicePoint.longitude,
            }
          : null,
      opening_hours: [],
    }))
  }

  async validateHomeDeliveryAddress(params: {
    postalCode: string
    cityName: string
    additionalServices?: string[]
  }): Promise<DhlHomeDeliveryValidationResponse> {
    if (!this.options.customer_number?.trim()) {
      throw new Error("DHL_CUSTOMER_NUMBER saknas för Home Delivery-validering.")
    }

    const endpoint = this.resolveUrl(
      this.options.home_delivery_endpoint || "",
      DEFAULT_HOME_DELIVERY_ENDPOINT
    )

    const data = await this.postJson<DhlHomeDeliveryValidationResponse>({
      endpoint,
      body: {
        agreementNo: this.options.customer_number,
        postalCode: params.postalCode,
        cityName: params.cityName,
        deliveryType: "Delivery",
        additionalServices: params.additionalServices || [],
      },
    })

    if ((data.replyStatus ?? 0) !== 0 || !data.productCode) {
      throw new Error(
        data.replyText || data.replyStatusDescription || "DHL Home Delivery är inte tillgängligt för adressen."
      )
    }

    return data
  }

  async createShipment(params: DhlShipmentRequest): Promise<DhlShipmentResponse> {
    const endpoint = this.resolveUrl(
      this.options.transport_instruction_endpoint || "",
      DEFAULT_TRANSPORT_INSTRUCTION_ENDPOINT
    )

    const consignorId =
      this.options.sender_id?.trim() || this.options.customer_number?.trim() || ""

    const payload = {
      id: "",
      productCode: params.productCode,
      shippingDate: params.shippingDate,
      deliveryInstruction: params.deliveryInstruction || "",
      pickupInstruction: params.pickupInstruction || "",
      totalNumberOfPieces: params.totalNumberOfPieces,
      totalWeight: params.totalWeight,
      totalVolume: params.totalVolume,
      payerCode: {
        code: this.options.payer_code || "1",
        location: "",
      },
      parties: [
        {
          id: consignorId,
          type: "Consignor",
          name: this.options.sender_name,
          references: [],
          address: {
            street: this.options.sender_address,
            cityName: this.options.sender_city,
            postalCode: this.options.sender_postal_code,
            countryCode: this.options.sender_country,
          },
        },
        {
          type: "Consignee",
          name: params.consignee.name,
          references: [],
          address: {
            street: params.consignee.address.street,
            cityName: params.consignee.address.city,
            postalCode: params.consignee.address.postalCode,
            countryCode: params.consignee.address.countryCode,
          },
          phone: params.consignee.phone || "",
          email: params.consignee.email || "",
        },
        ...(params.accessPoint
          ? [
              {
                id: params.accessPoint.id,
                type: "AccessPoint",
                name: params.accessPoint.name || "",
                address: {
                  street: params.accessPoint.address?.street || "",
                  cityName: params.accessPoint.address?.city || "",
                  postalCode: params.accessPoint.address?.postalCode || "",
                  countryCode: params.accessPoint.address?.countryCode || "SE",
                },
              },
            ]
          : []),
      ],
      pieces: params.pieces.map((piece) => ({
        id: [""],
        packageType: piece.packageType || "PKT",
        numberOfPieces: piece.numberOfPieces,
        weight: piece.weight,
        volume: piece.volume,
        width: piece.width,
        height: piece.height,
        length: piece.length,
      })),
    }

    const data = await this.postJson<{
      status?: string
      transportInstruction?: {
        id?: string
        routingCode?: string
        pieces?: Array<{
          id?: string[]
        }>
      }
    }>({
      endpoint,
      body: payload,
    })

    const transportInstruction = data.transportInstruction || {}
    const trackingNumbers = (transportInstruction.pieces || [])
      .flatMap((piece) => piece.id || [])
      .filter(Boolean)

    return {
      shipmentId: transportInstruction.id || "",
      trackingNumbers,
      routingCode: transportInstruction.routingCode || null,
      raw: data as Record<string, unknown>,
    }
  }
}
