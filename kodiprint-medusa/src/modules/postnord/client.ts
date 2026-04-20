import {
  PostNordProviderOptions,
  PostNordServicePoint,
  PostNordShipmentRequest,
  PostNordShipmentResponse,
  PostNordTrackingEvent,
} from "./types"

export class PostNordClient {
  private options: PostNordProviderOptions

  constructor(options: PostNordProviderOptions) {
    this.options = options
  }

  /**
   * Find nearby PostNord service points by postal code
   */
  async findServicePoints(params: {
    countryCode: string
    postalCode: string
    city?: string
    streetName?: string
    limit?: number
  }): Promise<PostNordServicePoint[]> {
    const queryParams = new URLSearchParams({
      apikey: this.options.api_key,
      returnType: "json",
      countryCode: params.countryCode,
      postalCode: params.postalCode,
      numberOfServicePoints: String(params.limit || 10),
      context: "optionalservicepoint",
    })

    if (params.city) queryParams.set("city", params.city)
    if (params.streetName) queryParams.set("streetName", params.streetName)

    const url = `${this.options.api_base_url}/rest/businesslocation/v5/servicepoints/nearest/byaddress?${queryParams}`

    const response = await fetch(url)

    if (!response.ok) {
      const text = await response.text()
      throw new Error(`PostNord API error (${response.status}): ${text}`)
    }

    const data = await response.json()
    const servicePoints =
      data?.servicePointInformationResponse?.servicePoints || []

    return servicePoints.map((sp: any) => {
      // Coordinates is an array in the API response
      const coord = Array.isArray(sp.coordinates) ? sp.coordinates[0] : sp.coordinates

      return {
        id: sp.servicePointId,
        name: sp.name,
        address: {
          street: `${sp.deliveryAddress?.streetName || ""} ${sp.deliveryAddress?.streetNumber || ""}`.trim(),
          postal_code: sp.deliveryAddress?.postalCode,
          city: sp.deliveryAddress?.city,
          country_code: sp.deliveryAddress?.countryCode,
        },
        coordinates: coord
          ? {
              lat: parseFloat(coord.northing),
              lng: parseFloat(coord.easting),
            }
          : null,
        opening_hours: (sp.openingHours?.postalServices || []).map((oh: any) => ({
          day: oh.openDay || "",
          from: oh.openTime || "",
          to: oh.closeTime || "",
        })),
      }
    })
  }

  /**
   * Create a PostNord shipment/booking
   */
  async createShipment(
    params: PostNordShipmentRequest
  ): Promise<PostNordShipmentResponse> {
    const shipmentPayload = {
      shipment: {
        service: {
          basicServiceCode: params.serviceCode,
          additionalServiceCode: [],
        },
        parties: {
          sender: {
            name1: this.options.sender_name,
            addressLine1: this.options.sender_address,
            postalCode: this.options.sender_postal_code,
            city: this.options.sender_city,
            countryCode: this.options.sender_country,
          },
          receiver: {
            name1: params.consignee.name,
            addressLine1: params.consignee.address.streetName,
            postalCode: params.consignee.address.postalCode,
            city: params.consignee.address.city,
            countryCode: params.consignee.address.countryCode,
            contact: {
              sms: params.consignee.phone || "",
              email: params.consignee.email || "",
            },
          },
        },
        parcels: [
          {
            weight: {
              value: String(params.totalWeight / 1000), // Convert grams to kg
              unit: "kg",
            },
          },
        ],
        ...(params.servicePointId && {
          deliveryPoint: {
            id: params.servicePointId,
          },
        }),
      },
    }

    const url = `${this.options.api_base_url}/rest/shipment/v3/shipments?apikey=${this.options.api_key}`

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(shipmentPayload),
    })

    if (!response.ok) {
      const text = await response.text()
      throw new Error(`PostNord Shipment API error (${response.status}): ${text}`)
    }

    const data = await response.json()
    const shipment = data?.shipments?.[0]

    return {
      shipmentId: shipment?.shipmentId || "",
      trackingNumber: shipment?.itemId || shipment?.shipmentId || "",
      labelUrl: shipment?.labelUrl || null,
    }
  }

  /**
   * Track a shipment by tracking number
   */
  async trackShipment(trackingNumber: string): Promise<PostNordTrackingEvent[]> {
    const url = `${this.options.api_base_url}/rest/transport/v1/shipment/trackandtrace?apikey=${this.options.api_key}&id=${trackingNumber}&locale=sv`

    const response = await fetch(url)

    if (!response.ok) {
      return []
    }

    const data = await response.json()
    const events =
      data?.TrackingInformationResponse?.shipments?.[0]?.items?.[0]?.events || []

    return events.map((event: any) => ({
      eventTime: event.eventTime,
      eventDescription: event.eventDescription,
      location: event.location?.displayName || "",
      status: event.status || "",
    }))
  }
}
