import {
  Body,
  Column,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Img,
  Preview,
  Row,
  Section,
  Tailwind,
  Text,
} from "@react-email/components"
import { BigNumberValue, CustomerDTO, OrderDTO } from "@medusajs/framework/types"

type PrintSettings = {
  y_offset?: number
  rotation?: number
  scale?: number
  around?: boolean
  both_sides?: boolean
  offset_x?: number
  offset_y?: number
}

type PricingBreakdown = {
  tier_unit_price?: number
  print_surcharge?: number
  logo_back_surcharge?: number
  name_surcharge?: number
  shipping_fee?: number
  combined_unit_price?: number
  line_total_ex_moms?: number
  tier_label?: string
  print_mode?: string
}

type PersonalizationEntry = {
  key: string
  label: string
  value: string
}

type ItemMetadata = {
  forening_id?: string
  forening_name?: string
  forening_slug?: string
  variant_thumbnail?: string
  personalization?: PersonalizationEntry[]
  personalization_name?: string
  personalization_engraving?: string
  is_company_order?: boolean
  logo_url?: string
  logo_preview_url?: string
  logo_mime_type?: string
  logo_original_name?: string
  logo_is_vector?: boolean
  print_mode?: string
  print_settings?: PrintSettings
  names_list?: string[]
  shipping_speed?: string
  pricing_breakdown?: PricingBreakdown
}

export type InternalOrderEmailProps = {
  order: OrderDTO & {
    customer: CustomerDTO
  }
}

function printModeLabel(mode?: string): string {
  switch (mode) {
    case "screen": return "Screentryck"
    case "laser": return "Lasergravyr"
    case "dtf": return "DTF-tryck"
    case "sublimation": return "Sublimering"
    case "uv": return "UV-tryck"
    default: return mode || "Ej angiven"
  }
}

function InternalOrderEmailComponent({ order }: InternalOrderEmailProps) {
  const formatter = new Intl.NumberFormat("sv-SE", {
    style: "currency",
    currencyDisplay: "narrowSymbol",
    currency: order.currency_code,
  })

  const formatPrice = (price: BigNumberValue | undefined | null) => {
    if (price == null) return "0,00 kr"

    let numValue: number
    if (typeof price === "number") {
      numValue = price
    } else if (typeof price === "string") {
      numValue = parseFloat(price)
    } else if (typeof price === "object" && "value" in price) {
      numValue = parseFloat(String((price as any).value))
    } else {
      return String(price)
    }

    return formatter.format(numValue)
  }

  return (
    <Tailwind>
      <Html className="font-sans bg-gray-100">
        <Head />
        <Preview>Ny order #{order.display_id} - Kodiprint intern</Preview>
        <Body className="bg-white my-10 mx-auto w-full max-w-2xl">
          {/* Header */}
          <Section className="bg-[#0a1628] text-white px-6 py-4">
            <Row>
              <Column>
                <Text className="text-xl font-bold m-0">Kodiprint - Intern order</Text>
              </Column>
              <Column align="right">
                <Text className="text-sm m-0 opacity-80">Order #{order.display_id}</Text>
              </Column>
            </Row>
          </Section>

          {/* Order Overview */}
          <Container className="p-6">
            <Heading className="text-2xl font-bold text-gray-800 m-0 mb-2">
              Ny order mottagen
            </Heading>
            <Text className="text-gray-500 m-0 text-sm">
              {new Date().toLocaleDateString("sv-SE", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
            </Text>

            {/* Customer Info */}
            <Section className="mt-6 bg-gray-50 rounded-lg p-4">
              <Text className="font-semibold text-gray-800 m-0 mb-2">Kund</Text>
              <Text className="text-gray-600 m-0">
                {order.shipping_address?.first_name} {order.shipping_address?.last_name}
              </Text>
              {order.shipping_address?.company && (
                <Text className="text-gray-600 m-0">{order.shipping_address.company}</Text>
              )}
              <Text className="text-gray-600 m-0">{order.email}</Text>
              {order.shipping_address?.phone && (
                <Text className="text-gray-600 m-0">Tel: {order.shipping_address.phone}</Text>
              )}
            </Section>

            {/* Shipping Address */}
            {order.shipping_address && (
              <Section className="mt-4 bg-gray-50 rounded-lg p-4">
                <Text className="font-semibold text-gray-800 m-0 mb-2">Leveransadress</Text>
                <Text className="text-gray-600 m-0">
                  {order.shipping_address.first_name} {order.shipping_address.last_name}
                </Text>
                {order.shipping_address.company && (
                  <Text className="text-gray-600 m-0">{order.shipping_address.company}</Text>
                )}
                <Text className="text-gray-600 m-0">{order.shipping_address.address_1}</Text>
                {order.shipping_address.address_2 && (
                  <Text className="text-gray-600 m-0">{order.shipping_address.address_2}</Text>
                )}
                <Text className="text-gray-600 m-0">
                  {order.shipping_address.postal_code} {order.shipping_address.city}
                </Text>
              </Section>
            )}

            <Hr className="my-6 border-gray-200" />

            {/* Items with full print details */}
            <Heading className="text-xl font-semibold text-gray-800 mb-4">
              Produkter att producera
            </Heading>

            {order.items?.map((item, index) => {
              const meta = (item.metadata || {}) as ItemMetadata
              const hasLogo = !!meta.logo_url
              const hasNames = meta.names_list && meta.names_list.length > 0
              const personalizationEntries: PersonalizationEntry[] = Array.isArray(meta.personalization)
                ? meta.personalization.filter((p) => p && p.value && p.value.trim().length > 0)
                : []
              const legacyPersonalizationEntries: PersonalizationEntry[] = personalizationEntries.length === 0
                ? [
                    ...(meta.personalization_name
                      ? [{ key: "name", label: "Namn", value: meta.personalization_name }]
                      : []),
                    ...(meta.personalization_engraving
                      ? [{ key: "engraving", label: "Gravyr", value: meta.personalization_engraving }]
                      : []),
                  ]
                : []
              const displayPersonalization =
                personalizationEntries.length > 0 ? personalizationEntries : legacyPersonalizationEntries
              const hasPersonalization = displayPersonalization.length > 0
              const isPrintOrder = meta.is_company_order || hasLogo

              return (
                <Section key={item.id} className="border border-gray-200 rounded-lg p-4 mb-4">
                  {/* Item header */}
                  <Row>
                    <Column className="w-1/4">
                      {meta.variant_thumbnail ? (
                        <Img
                          src={meta.variant_thumbnail}
                          alt={item.product_title ?? ""}
                          className="rounded-lg"
                          width="120"
                        />
                      ) : item.thumbnail ? (
                        <Img
                          src={item.thumbnail}
                          alt={item.product_title ?? ""}
                          className="rounded-lg"
                          width="120"
                        />
                      ) : null}
                    </Column>
                    <Column className="w-3/4 pl-4">
                      <Text className="text-lg font-bold text-gray-800 m-0">
                        {index + 1}. {item.product_title}
                      </Text>
                      <Text className="text-gray-600 m-0">Variant: {item.variant_title}</Text>
                      <Text className="text-gray-800 font-semibold m-0">
                        Antal: {item.quantity} st
                      </Text>
                      <Text className="text-gray-600 text-sm m-0">
                        Summa: {formatPrice(item.total)}
                      </Text>
                    </Column>
                  </Row>

                  {/* Förening */}
                  {meta.forening_name && (
                    <Section className="mt-3 bg-blue-50 rounded p-3">
                      <Text className="font-semibold text-blue-800 m-0 text-sm">
                        Förening: {meta.forening_name}
                      </Text>
                    </Section>
                  )}

                  {/* Print details */}
                  {isPrintOrder && (
                    <Section className="mt-3 bg-amber-50 rounded p-3">
                      <Text className="font-semibold text-amber-800 m-0 mb-2">
                        TRYCKDETALJER
                      </Text>
                      <Text className="text-gray-700 m-0 text-sm">
                        Tryckmetod: {printModeLabel(meta.print_mode)}
                      </Text>
                      {hasLogo && (
                        <>
                          <Text className="text-gray-700 m-0 text-sm">
                            Logofil: {meta.logo_original_name || "Bifogad"}
                            {meta.logo_is_vector ? " (vektor)" : " (raster)"}
                          </Text>
                          <Text className="text-gray-700 m-0 text-sm">
                            Filtyp: {meta.logo_mime_type || "Okänd"}
                          </Text>
                        </>
                      )}
                      {meta.print_settings && (
                        <>
                          <Text className="text-gray-700 m-0 text-sm mt-1">
                            Skala: {Math.round((meta.print_settings.scale || 1) * 100)}%
                            {meta.print_settings.rotation ? ` | Rotation: ${meta.print_settings.rotation}°` : ""}
                          </Text>
                          <Text className="text-gray-700 m-0 text-sm">
                            Position: X={meta.print_settings.offset_x || 0}, Y={meta.print_settings.offset_y || meta.print_settings.y_offset || 0}
                          </Text>
                          {meta.print_settings.around && (
                            <Text className="text-green-700 font-semibold m-0 text-sm">
                              Runt om
                            </Text>
                          )}
                          {meta.print_settings.both_sides && (
                            <Text className="text-green-700 font-semibold m-0 text-sm">
                              Båda sidor
                            </Text>
                          )}
                        </>
                      )}
                      {meta.shipping_speed && (
                        <Text className="text-gray-700 m-0 text-sm mt-1">
                          Leveranstid: {meta.shipping_speed}
                        </Text>
                      )}
                    </Section>
                  )}

                  {/* Names list */}
                  {hasNames && (
                    <Section className="mt-3 bg-purple-50 rounded p-3">
                      <Text className="font-semibold text-purple-800 m-0 mb-1">
                        NAMNLISTA ({meta.names_list!.length} st)
                      </Text>
                      <Text className="text-gray-700 m-0 text-sm whitespace-pre-wrap">
                        {meta.names_list!.join(", ")}
                      </Text>
                      <Text className="text-purple-600 text-xs m-0 mt-1">
                        Fullständig lista bifogad som fil
                      </Text>
                    </Section>
                  )}

                  {/* Personalization */}
                  {hasPersonalization && (
                    <Section className="mt-3 bg-green-50 rounded p-3">
                      <Text className="font-semibold text-green-800 m-0 mb-1">
                        PERSONALISERING
                      </Text>
                      {displayPersonalization.map((entry, idx) => (
                        <Text key={`${entry.key}-${idx}`} className="text-gray-700 m-0 text-sm">
                          {entry.label}: {entry.value}
                        </Text>
                      ))}
                    </Section>
                  )}

                  {/* Pricing breakdown */}
                  {meta.pricing_breakdown && (
                    <Section className="mt-3 bg-gray-50 rounded p-3">
                      <Text className="font-semibold text-gray-800 m-0 mb-1 text-sm">
                        Prisuppdelning
                      </Text>
                      <Text className="text-gray-600 m-0 text-xs">
                        Styckpris (steg {meta.pricing_breakdown.tier_label}): {formatPrice(meta.pricing_breakdown.tier_unit_price || 0)}
                      </Text>
                      {(meta.pricing_breakdown.print_surcharge || 0) > 0 && (
                        <Text className="text-gray-600 m-0 text-xs">
                          Trycktillagg: {formatPrice(meta.pricing_breakdown.print_surcharge || 0)}
                        </Text>
                      )}
                      {(meta.pricing_breakdown.name_surcharge || 0) > 0 && (
                        <Text className="text-gray-600 m-0 text-xs">
                          Namntillagg: {formatPrice(meta.pricing_breakdown.name_surcharge || 0)}
                        </Text>
                      )}
                      {(meta.pricing_breakdown.logo_back_surcharge || 0) > 0 && (
                        <Text className="text-gray-600 m-0 text-xs">
                          Logga baksida: {formatPrice(meta.pricing_breakdown.logo_back_surcharge || 0)}
                        </Text>
                      )}
                    </Section>
                  )}
                </Section>
              )
            })}

            {/* Order Summary */}
            <Section className="mt-6 border-t border-gray-300 pt-4">
              <Heading className="text-lg font-semibold text-gray-800 mb-2">
                Ordersammanfattning
              </Heading>
              <Row>
                <Column className="w-1/2">
                  <Text className="text-gray-600 m-0">Produkter</Text>
                </Column>
                <Column className="w-1/2 text-right">
                  <Text className="text-gray-600 m-0">{formatPrice(order.item_total)}</Text>
                </Column>
              </Row>
              {order.shipping_methods?.map((method) => (
                <Row key={method.id}>
                  <Column className="w-1/2">
                    <Text className="text-gray-600 m-0">Frakt ({method.name})</Text>
                  </Column>
                  <Column className="w-1/2 text-right">
                    <Text className="text-gray-600 m-0">{formatPrice(method.total)}</Text>
                  </Column>
                </Row>
              ))}
              <Row>
                <Column className="w-1/2">
                  <Text className="text-gray-600 m-0">Moms</Text>
                </Column>
                <Column className="w-1/2 text-right">
                  <Text className="text-gray-600 m-0">{formatPrice(order.tax_total || 0)}</Text>
                </Column>
              </Row>
              <Row className="border-t border-gray-200 mt-2">
                <Column className="w-1/2">
                  <Text className="text-gray-800 font-bold">Totalt</Text>
                </Column>
                <Column className="w-1/2 text-right">
                  <Text className="text-gray-800 font-bold">{formatPrice(order.total)}</Text>
                </Column>
              </Row>
            </Section>

            {/* Attachments note */}
            <Section className="mt-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <Text className="font-semibold text-yellow-800 m-0">
                Bifogade filer
              </Text>
              <Text className="text-yellow-700 text-sm m-0 mt-1">
                Logofiler och namnlistor är bifogade i detta mejl. Kontrollera bilagor.
              </Text>
            </Section>
          </Container>

          {/* Footer */}
          <Section className="bg-gray-100 p-4 mt-6">
            <Text className="text-center text-gray-400 text-xs m-0">
              Internt mejl - Kodiprint ordersystem
            </Text>
          </Section>
        </Body>
      </Html>
    </Tailwind>
  )
}

export const internalOrderEmail = (props: InternalOrderEmailProps) => (
  <InternalOrderEmailComponent {...props} />
)

// --- Mock data for React Email preview ---
const mockOrder = {
  order: {
    id: "order_01JSNXDH9BPJWWKVW03B9E9KW8",
    display_id: 1,
    email: "kund@example.com",
    currency_code: "sek",
    total: 34900,
    subtotal: 29900,
    discount_total: 0,
    shipping_total: 5000,
    tax_total: 6980,
    item_subtotal: 29900,
    item_total: 29900,
    item_tax_total: 5980,
    customer_id: "cus_01JSNXD6VQC1YH56E4TGC81NWX",
    items: [
      {
        id: "ordli_01",
        title: "500ml",
        subtitle: "Olglas",
        thumbnail: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/sweatshirt-vintage-front.png",
        variant_id: "variant_01",
        product_id: "prod_01",
        product_title: "Olglas med Boden IK-logga",
        product_description: "Personligt olglas med gravyr",
        product_subtitle: null,
        product_type: null,
        product_type_id: null,
        product_collection: null,
        product_handle: "olglas",
        variant_sku: "OLGLAS-500",
        variant_barcode: null,
        variant_title: "500ml",
        variant_option_values: null,
        requires_shipping: true,
        is_giftcard: false,
        is_discountable: true,
        is_tax_inclusive: false,
        is_custom_price: false,
        metadata: {
          is_company_order: true,
          forening_name: "Boden IK",
          forening_id: "for_01",
          forening_slug: "boden-ik",
          logo_url: "https://example.com/uploads/boden-ik-logo.svg",
          logo_preview_url: "https://example.com/uploads/boden-ik-logo-preview.png",
          logo_mime_type: "image/svg+xml",
          logo_original_name: "boden-ik-logo.svg",
          logo_is_vector: true,
          print_mode: "screen",
          print_settings: {
            y_offset: 0,
            rotation: 0,
            scale: 0.85,
            around: false,
            both_sides: false,
            offset_x: 0,
            offset_y: -5,
          },
          names_list: ["Erik Svensson", "Anna Lindberg", "Karl Johansson", "Maria Bergstrom", "Lars Nilsson"],
          shipping_speed: "standard",
          variant_thumbnail: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/sweatshirt-vintage-front.png",
          pricing_breakdown: {
            tier_unit_price: 12900,
            print_surcharge: 2000,
            logo_back_surcharge: 0,
            name_surcharge: 500,
            shipping_fee: 5000,
            combined_unit_price: 15400,
            line_total_ex_moms: 29900,
            tier_label: "1-10",
            print_mode: "screen",
          },
        },
        raw_compare_at_unit_price: null,
        raw_unit_price: { value: "14950", precision: 20 },
        created_at: new Date(),
        updated_at: new Date(),
        deleted_at: null,
        tax_lines: [],
        adjustments: [],
        compare_at_unit_price: null,
        unit_price: 14950,
        quantity: 5,
        raw_quantity: { value: "5", precision: 20 },
        detail: {
          id: "orditem_01",
          version: 1,
          metadata: null,
          order_id: "order_01JSNXDH9BPJWWKVW03B9E9KW8",
          raw_unit_price: null,
          raw_compare_at_unit_price: null,
          raw_quantity: { value: "5", precision: 20 },
          raw_fulfilled_quantity: { value: "0", precision: 20 },
          raw_delivered_quantity: { value: "0", precision: 20 },
          raw_shipped_quantity: { value: "0", precision: 20 },
          raw_return_requested_quantity: { value: "0", precision: 20 },
          raw_return_received_quantity: { value: "0", precision: 20 },
          raw_return_dismissed_quantity: { value: "0", precision: 20 },
          raw_written_off_quantity: { value: "0", precision: 20 },
          created_at: new Date(),
          updated_at: new Date(),
          deleted_at: null,
          item_id: "ordli_01",
          unit_price: null,
          compare_at_unit_price: null,
          quantity: 5,
          fulfilled_quantity: 0,
          delivered_quantity: 0,
          shipped_quantity: 0,
          return_requested_quantity: 0,
          return_received_quantity: 0,
          return_dismissed_quantity: 0,
          written_off_quantity: 0,
        },
        subtotal: 29900,
        total: 29900,
        original_total: 29900,
        discount_total: 0,
        discount_subtotal: 0,
        discount_tax_total: 0,
        tax_total: 5980,
        original_tax_total: 5980,
        refundable_total_per_unit: 14950,
        refundable_total: 29900,
        fulfilled_total: 0,
        shipped_total: 0,
        return_requested_total: 0,
        return_received_total: 0,
        return_dismissed_total: 0,
        write_off_total: 0,
        raw_subtotal: { value: "29900", precision: 20 },
        raw_total: { value: "29900", precision: 20 },
        raw_original_total: { value: "29900", precision: 20 },
        raw_discount_total: { value: "0", precision: 20 },
        raw_discount_subtotal: { value: "0", precision: 20 },
        raw_discount_tax_total: { value: "0", precision: 20 },
        raw_tax_total: { value: "5980", precision: 20 },
        raw_original_tax_total: { value: "5980", precision: 20 },
        raw_refundable_total_per_unit: { value: "14950", precision: 20 },
        raw_refundable_total: { value: "29900", precision: 20 },
        raw_fulfilled_total: { value: "0", precision: 20 },
        raw_shipped_total: { value: "0", precision: 20 },
        raw_return_requested_total: { value: "0", precision: 20 },
        raw_return_received_total: { value: "0", precision: 20 },
        raw_return_dismissed_total: { value: "0", precision: 20 },
        raw_write_off_total: { value: "0", precision: 20 },
      },
    ],
    shipping_address: {
      id: "caaddr_01",
      customer_id: null,
      company: "Boden IK",
      first_name: "Anna",
      last_name: "Lindberg",
      address_1: "Storgatan 12",
      address_2: "",
      city: "Boden",
      country_code: "se",
      province: "",
      postal_code: "96132",
      phone: "070-1234567",
      metadata: null,
      created_at: "2025-04-25T07:25:48.801Z",
      updated_at: "2025-04-25T07:25:48.801Z",
      deleted_at: null,
    },
    billing_address: {
      id: "caaddr_02",
      customer_id: null,
      company: "Boden IK",
      first_name: "Anna",
      last_name: "Lindberg",
      address_1: "Storgatan 12",
      address_2: "",
      city: "Boden",
      country_code: "se",
      province: "",
      postal_code: "96132",
      phone: "070-1234567",
      metadata: null,
      created_at: "2025-04-25T07:25:48.801Z",
      updated_at: "2025-04-25T07:25:48.801Z",
      deleted_at: null,
    },
    shipping_methods: [
      {
        id: "ordsm_01",
        name: "PostNord MyPack",
        description: null,
        is_tax_inclusive: false,
        is_custom_amount: false,
        shipping_option_id: "so_01",
        data: {},
        metadata: null,
        raw_amount: { value: "5000", precision: 20 },
        created_at: new Date(),
        updated_at: new Date(),
        deleted_at: null,
        tax_lines: [],
        adjustments: [],
        amount: 5000,
        order_id: "order_01JSNXDH9BPJWWKVW03B9E9KW8",
        detail: {
          id: "ordspmv_01",
          version: 1,
          order_id: "order_01JSNXDH9BPJWWKVW03B9E9KW8",
          return_id: null,
          exchange_id: null,
          claim_id: null,
          created_at: new Date(),
          updated_at: new Date(),
          deleted_at: null,
          shipping_method_id: "ordsm_01",
        },
        subtotal: 5000,
        total: 5000,
        original_total: 5000,
        discount_total: 0,
        discount_subtotal: 0,
        discount_tax_total: 0,
        tax_total: 1000,
        original_tax_total: 1000,
        raw_subtotal: { value: "5000", precision: 20 },
        raw_total: { value: "5000", precision: 20 },
        raw_original_total: { value: "5000", precision: 20 },
        raw_discount_total: { value: "0", precision: 20 },
        raw_discount_subtotal: { value: "0", precision: 20 },
        raw_discount_tax_total: { value: "0", precision: 20 },
        raw_tax_total: { value: "1000", precision: 20 },
        raw_original_tax_total: { value: "1000", precision: 20 },
      },
    ],
    customer: {
      id: "cus_01JSNXD6VQC1YH56E4TGC81NWX",
      company_name: null,
      first_name: "Anna",
      last_name: "Lindberg",
      email: "anna@bodenIK.se",
      phone: null,
      has_account: false,
      metadata: null,
      created_by: null,
      created_at: "2025-04-25T07:25:48.791Z",
      updated_at: "2025-04-25T07:25:48.791Z",
      deleted_at: null,
    },
  },
}
// @ts-ignore
export default () => <InternalOrderEmailComponent {...mockOrder} />
