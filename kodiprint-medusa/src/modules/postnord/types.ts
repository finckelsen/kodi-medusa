export interface PostNordProviderOptions {
  api_key: string
  customer_number: string
  issuer_code: string
  api_base_url: string
  sender_postal_code: string
  sender_city: string
  sender_country: string
  sender_name: string
  sender_address: string
}

export interface PostNordServicePoint {
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

export interface PostNordShipmentRequest {
  serviceCode: string
  consignee: {
    name: string
    address: {
      streetName: string
      postalCode: string
      city: string
      countryCode: string
    }
    phone?: string
    email?: string
  }
  servicePointId?: string
  totalWeight: number // grams
}

export interface PostNordShipmentResponse {
  shipmentId: string
  trackingNumber: string
  labelUrl: string | null
}

export interface PostNordTrackingEvent {
  eventTime: string
  eventDescription: string
  location: string
  status: string
}
