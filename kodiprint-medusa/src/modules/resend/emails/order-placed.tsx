import {
  Body,
  Column,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Img,
  Link,
  Preview,
  Row,
  Section,
  Tailwind,
  Text,
} from "@react-email/components"
import { BigNumberValue, CustomerDTO, OrderDTO } from "@medusajs/framework/types"

// Logo hosted publicly — update this URL when you have a production domain
const KODIPRINT_LOGO_URL = "https://kodiprint.com/kodiprint-logo-vit.png"

// Storefront URL used to resolve relative image paths into absolute URLs
// so email clients (Gmail, Outlook, etc.) can actually load them.
const STOREFRONT_URL = process.env.STOREFRONT_URL || "http://localhost:8000"

function toAbsoluteUrl(url: string | null | undefined): string {
  if (!url) return ""
  if (url.startsWith("http://") || url.startsWith("https://")) return url
  if (url.startsWith("/")) return `${STOREFRONT_URL}${url}`
  return url
}

type PersonalizationEntry = {
  key: string
  label: string
  value: string
}

type ItemMetadata = {
  is_company_order?: boolean
  logo_url?: string
  logo_preview_url?: string
  logo_original_name?: string
  print_mode?: string
  names_list?: string[]
  variant_thumbnail?: string
  forening_name?: string
  personalization?: PersonalizationEntry[]
  personalization_name?: string
  personalization_engraving?: string
}

type InlineImages = {
  [itemId: string]: {
    product_thumbnail_cid?: string
    logo_preview_cid?: string
  }
}

type OrderPlacedEmailProps = {
  order: OrderDTO & {
    customer: CustomerDTO
  }
  inline_images?: InlineImages
  email_banner?: {
    body: string
    title: string
    url: string
  }
}

function OrderPlacedEmailComponent({ order, email_banner, inline_images }: OrderPlacedEmailProps) {
  const shouldDisplayBanner = email_banner && "title" in email_banner

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
        <Preview>Tack för din beställning hos Kodiprint</Preview>
        <Body className="bg-white my-10 mx-auto w-full max-w-2xl">
          {/* Header with logo */}
          <Section className="bg-[#0a1628] px-6 py-5 text-center">
            <Img
              src={KODIPRINT_LOGO_URL}
              alt="Kodiprint"
              height="40"
              className="mx-auto"
            />
          </Section>

          {/* Thank You Message */}
          <Container className="p-6">
            <Heading className="text-2xl font-bold text-center text-gray-800">
              Tack för din beställning, {order.customer?.first_name || order.shipping_address?.first_name}!
            </Heading>
            <Text className="text-center text-gray-600 mt-2">
              Vi behandlar din order och meddelar dig när den skickas.
            </Text>
            <Text className="text-center text-gray-400 text-sm mt-1">
              Ordernummer: #{order.display_id}
            </Text>
          </Container>

          {/* Promotional Banner */}
          {shouldDisplayBanner && (
            <Container
              className="mb-4 rounded-lg p-7"
              style={{
                background: "linear-gradient(to right, #3b82f6, #4f46e5)",
              }}
            >
              <Section>
                <Row>
                  <Column align="left">
                    <Heading className="text-white text-xl font-semibold">
                      {email_banner.title}
                    </Heading>
                    <Text className="text-white mt-2">{email_banner.body}</Text>
                  </Column>
                  <Column align="right">
                    <Link href={email_banner.url} className="font-semibold px-2 text-white underline">
                      Handla nu
                    </Link>
                  </Column>
                </Row>
              </Section>
            </Container>
          )}

          {/* Order Items */}
          <Container className="px-6">
            <Heading className="text-xl font-semibold text-gray-800 mb-4">
              Dina produkter
            </Heading>

            {order.items?.map((item) => {
              const meta = (item.metadata || {}) as ItemMetadata
              const isCompanyOrder = !!meta.is_company_order
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
              const logoPreview = meta.logo_preview_url || meta.logo_url
              const inlineImage = inline_images?.[String(item.id)]
              const productImageSrc = inlineImage?.product_thumbnail_cid
                ? `cid:${inlineImage.product_thumbnail_cid}`
                : toAbsoluteUrl(meta.variant_thumbnail || item.thumbnail)
              const printPreviewSrc = inlineImage?.logo_preview_cid
                ? `cid:${inlineImage.logo_preview_cid}`
                : toAbsoluteUrl(logoPreview)

              return (
                <Section key={item.id} className="border-b border-gray-200 py-4">
                  <Row>
                    <Column className="w-1/3">
                      <Img
                        src={productImageSrc}
                        alt={item.product_title ?? ""}
                        className="rounded-lg"
                        width="100%"
                      />
                    </Column>
                    <Column className="w-2/3 pl-4">
                      <Text className="text-lg font-semibold text-gray-800 m-0">
                        {item.product_title}
                      </Text>
                      <Text className="text-gray-600 m-0">{item.variant_title}</Text>
                      <Text className="text-gray-500 text-sm m-0">Antal: {item.quantity}</Text>
                      <Text className="text-gray-800 mt-2 font-bold m-0">
                        {formatPrice(item.total)}
                      </Text>
                    </Column>
                  </Row>

                  {/* Company order: show uploaded logo */}
                  {isCompanyOrder && logoPreview && (
                    <Section className="mt-3 bg-gray-50 rounded-lg p-3">
                      <Text className="font-semibold text-gray-700 m-0 mb-2 text-sm">
                        Uppladdad tryckbild
                      </Text>
                      <Img
                        src={printPreviewSrc}
                        alt="Tryckbild"
                        width="120"
                        className="rounded"
                      />
                      {meta.logo_original_name && (
                        <Text className="text-gray-500 text-xs m-0 mt-1">
                          {meta.logo_original_name}
                        </Text>
                      )}
                    </Section>
                  )}

                  {/* Company order: show names list */}
                  {isCompanyOrder && hasNames && (
                    <Section className="mt-3 bg-gray-50 rounded-lg p-3">
                      <Text className="font-semibold text-gray-700 m-0 mb-1 text-sm">
                        Namnlista ({meta.names_list!.length} st)
                      </Text>
                      <Text className="text-gray-600 text-sm m-0">
                        {meta.names_list!.join(", ")}
                      </Text>
                    </Section>
                  )}

                  {/* Personalization */}
                  {hasPersonalization && (
                    <Section className="mt-3 bg-gray-50 rounded-lg p-3">
                      <Text className="font-semibold text-gray-700 m-0 mb-1 text-sm">
                        Personalisering
                      </Text>
                      {displayPersonalization.map((entry, idx) => (
                        <Text key={`${entry.key}-${idx}`} className="text-gray-600 text-sm m-0">
                          {entry.label}: {entry.value}
                        </Text>
                      ))}
                    </Section>
                  )}

                  {/* Förening */}
                  {meta.forening_name && (
                    <Text className="text-sm text-blue-600 mt-2 m-0">
                      Förening: {meta.forening_name}
                    </Text>
                  )}
                </Section>
              )
            })}

            {/* Order Summary */}
            <Section className="mt-8">
              <Heading className="text-xl font-semibold text-gray-800 mb-4">
                Ordersammanfattning
              </Heading>
              <Row className="text-gray-600">
                <Column className="w-1/2">
                  <Text className="m-0">Delsumma</Text>
                </Column>
                <Column className="w-1/2 text-right">
                  <Text className="m-0">
                    {formatPrice(order.item_total)}
                  </Text>
                </Column>
              </Row>
              {order.shipping_methods?.map((method) => (
                <Row className="text-gray-600" key={method.id}>
                  <Column className="w-1/2">
                    <Text className="m-0">Frakt ({method.name})</Text>
                  </Column>
                  <Column className="w-1/2 text-right">
                    <Text className="m-0">{formatPrice(method.total)}</Text>
                  </Column>
                </Row>
              ))}
              <Row className="text-gray-600">
                <Column className="w-1/2">
                  <Text className="m-0">Moms</Text>
                </Column>
                <Column className="w-1/2 text-right">
                  <Text className="m-0">{formatPrice(order.tax_total || 0)}</Text>
                </Column>
              </Row>
              <Row className="border-t border-gray-200 mt-4 text-gray-800 font-bold">
                <Column className="w-1/2">
                  <Text>Totalt</Text>
                </Column>
                <Column className="w-1/2 text-right">
                  <Text>{formatPrice(order.total)}</Text>
                </Column>
              </Row>
            </Section>

            {/* Shipping Address */}
            {order.shipping_address && (
              <Section className="mt-8">
                <Heading className="text-xl font-semibold text-gray-800 mb-4">
                  Leveransadress
                </Heading>
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
          </Container>

          {/* Footer */}
          <Section className="bg-gray-50 p-6 mt-10">
            <Text className="text-center text-gray-500 text-sm">
              Har du frågor? Svara på detta mejl eller kontakta oss på hej@kodiprint.com
            </Text>
            <Text className="text-center text-gray-400 text-xs mt-4">
              &copy; {new Date().getFullYear()} Kodiprint. Alla rättigheter förbehållna.
            </Text>
          </Section>
        </Body>
      </Html>
    </Tailwind>
  )
}

export const orderPlacedEmail = (props: OrderPlacedEmailProps) => (
  <OrderPlacedEmailComponent {...props} />
)

// --- Mock data for React Email preview ---
// Shows a mixed order: one company/print item + one regular private item
const mockOrder = {
  order: {
    id: "order_TEST",
    display_id: 1042,
    email: "erik@example.se",
    currency_code: "sek",
    total: 12268,
    subtotal: 12199,
    discount_total: 0,
    shipping_total: 69,
    tax_total: 2453.6,
    item_subtotal: 12199,
    item_total: 12199,
    item_tax_total: 2439.8,
    customer_id: "cus_01",
    items: [
      {
        id: "ordli_01",
        thumbnail: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/sweatshirt-vintage-front.png",
        product_title: "Sportflaska Profilering",
        variant_title: "Svart / 750ml",
        quantity: 100,
        total: 11900,
        unit_price: 119,
        metadata: {
          is_company_order: true,
          forening_name: "Boden IK",
          logo_url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/sweatshirt-vintage-front.png",
          logo_preview_url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/sweatshirt-vintage-front.png",
          logo_original_name: "boden-ik-logo.svg",
          print_mode: "screen",
          names_list: ["Erik Svensson", "Anna Lindberg", "Karl Johansson", "Maria Bergström", "Lars Nilsson"],
        },
      },
      {
        id: "ordli_02",
        thumbnail: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/tee-black-front.png",
        product_title: "Ölglas",
        variant_title: "500ml",
        quantity: 1,
        total: 299,
        unit_price: 299,
        metadata: {
          personalization_name: "Erik",
          personalization_engraving: "Bästa pappa 2025",
        },
      },
    ],
    shipping_address: {
      first_name: "Erik",
      last_name: "Svensson",
      company: "",
      address_1: "Björkvägen 8",
      address_2: "",
      city: "Luleå",
      country_code: "se",
      postal_code: "97234",
      phone: "073-9876543",
    },
    shipping_methods: [
      {
        id: "ordsm_01",
        name: "PostNord Hemleverans",
        total: 69,
      },
    ],
    customer: {
      first_name: "Erik",
      last_name: "Svensson",
      email: "erik@example.se",
    },
  },
}
// @ts-ignore
export default () => <OrderPlacedEmailComponent {...mockOrder} />
