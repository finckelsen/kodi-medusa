export interface DhlProviderOptions {
  api_key?: string
  api_base_url: string
  servicepoint_endpoint?: string
  transport_instruction_endpoint?: string
  home_delivery_endpoint?: string
  customer_number?: string
  sender_id?: string
  sender_name: string
  sender_address: string
  sender_postal_code: string
  sender_city: string
  sender_country: string
  payer_code?: string
  service_point_product_code?: string
  home_delivery_product_code?: string
  business_product_code?: string
}

export interface DhlServicePoint {
  id: string
  name: string
  address: {
    street: string
    postal_code: string
    city: string
    country_code: string
  }
  coordinates: { lat: number; lng: number } | null
  opening_hours: {
    day: string
    from: string
    to: string
  }[]
}

export interface DhlHomeDeliveryValidationResponse {
  customerName?: string
  replyStatus?: number
  replyStatusDescription?: string
  replyText?: string
  productCode?: string
  party?: {
    id?: string
  }
}

export interface DhlShipmentRequest {
  productCode: string
  shippingDate: string
  deliveryInstruction?: string
  pickupInstruction?: string
  consignee: {
    name: string
    address: {
      street: string
      postalCode: string
      city: string
      countryCode: string
    }
    phone?: string
    email?: string
  }
  accessPoint?: {
    id: string
    name?: string
    address?: {
      street: string
      postalCode: string
      city: string
      countryCode: string
    }
  }
  totalNumberOfPieces: number
  totalWeight: number
  totalVolume: number
  pieces: Array<{
    numberOfPieces: number
    weight: number
    width: number
    height: number
    length: number
    volume: number
    packageType?: string
  }>
}

export interface DhlShipmentResponse {
  shipmentId: string
  trackingNumbers: string[]
  routingCode: string | null
  raw: Record<string, unknown>
}
