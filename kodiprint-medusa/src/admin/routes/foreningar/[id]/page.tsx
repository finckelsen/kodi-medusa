import { useEffect, useState } from "react"
import { useParams } from "react-router-dom"
import { Container, Heading, Table, Badge, Text, Button } from "@medusajs/ui"
import { Buildings, ArrowLeft } from "@medusajs/icons"

type Forening = {
  id: string
  email: string
  first_name: string
  last_name: string
  phone?: string
  created_at: string
  metadata: {
    is_forening?: boolean
    foreningsnamn?: string
    organisationsnummer?: string
    kickback_percentage?: number
    ort?: string
    slug?: string
    logo_preview?: string
    logo_original?: string
    logo_format?: string
    logo_is_vector?: boolean
    onboarding_completed?: boolean
  }
}

type ProductVariant = {
  id: string
  prices?: { amount: number; currency_code: string }[]
}

type Product = {
  id: string
  title: string
  handle: string
  thumbnail?: string
  status: string
  metadata?: {
    forening_slug?: string
    forening_name?: string
    base_product?: string
    supports_personalization?: boolean
  }
  variants?: ProductVariant[]
}

const ForeningDetailPage = () => {
  const { id } = useParams<{ id: string }>()
  const [forening, setForening] = useState<Forening | null>(null)
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [customerRes, productsRes] = await Promise.all([
          fetch(`/admin/customers/${id}`, { credentials: "include" }),
          fetch("/admin/products?limit=100&fields=*variants,*variants.prices", { credentials: "include" }),
        ])

        if (!customerRes.ok) {
          throw new Error("Kunde inte hämta föreningen")
        }

        const customerData = await customerRes.json()
        const foreningData = customerData.customer as Forening

        if (!foreningData.metadata?.is_forening) {
          throw new Error("Denna kund är inte en förening")
        }

        setForening(foreningData)

        if (productsRes.ok) {
          const productsData = await productsRes.json()
          const slug = foreningData.metadata?.slug
          if (slug) {
            const filtered = (productsData.products || []).filter(
              (p: Product) => p.metadata?.forening_slug === slug
            )
            setProducts(filtered)
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Ett fel uppstod")
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [id])

  const formatPrice = (variant?: ProductVariant) => {
    if (!variant?.prices?.length) return "-"
    const price = variant.prices[0]
    return new Intl.NumberFormat("sv-SE", {
      style: "currency",
      currency: price.currency_code,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(price.amount)
  }

  if (loading) {
    return (
      <Container className="p-8">
        <div className="flex items-center justify-center h-64">
          <Text className="text-ui-fg-muted">Laddar förening...</Text>
        </div>
      </Container>
    )
  }

  if (error || !forening) {
    return (
      <Container className="p-8">
        <div className="mb-4">
          <Button
            variant="secondary"
            size="small"
            onClick={() => { window.location.href = "/app/foreningar" }}
          >
            <ArrowLeft /> Tillbaka
          </Button>
        </div>
        <div className="bg-ui-bg-subtle-hover p-4 rounded-lg">
          <Text className="text-ui-fg-error">{error || "Föreningen hittades inte"}</Text>
        </div>
      </Container>
    )
  }

  return (
    <Container className="p-8">
      <div className="mb-6">
        <Button
          variant="secondary"
          size="small"
          onClick={() => { window.location.href = "/app/foreningar" }}
        >
          <ArrowLeft /> Tillbaka till föreningar
        </Button>
      </div>

      <div className="flex items-center gap-4 mb-8">
        {forening.metadata?.logo_preview ? (
          <div className="relative">
            <img
              src={forening.metadata.logo_preview}
              alt=""
              className="w-16 h-16 rounded object-contain bg-white border border-ui-border-base"
            />
            {forening.metadata.logo_is_vector && (
              <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
                <span className="text-white text-[10px] font-bold">V</span>
              </div>
            )}
          </div>
        ) : (
          <div className="w-16 h-16 rounded bg-ui-bg-subtle flex items-center justify-center border border-ui-border-base">
            <Buildings className="w-8 h-8 text-ui-fg-muted" />
          </div>
        )}
        <div>
          <Heading level="h1" className="mb-1">
            {forening.metadata?.foreningsnamn || "Okänd förening"}
          </Heading>
          <div className="flex items-center gap-3">
            {forening.metadata?.ort && (
              <Text className="text-ui-fg-muted">{forening.metadata.ort}</Text>
            )}
            {forening.metadata?.organisationsnummer && (
              <Text className="text-ui-fg-muted text-sm">
                Org.nr: {forening.metadata.organisationsnummer}
              </Text>
            )}
            {forening.metadata?.onboarding_completed ? (
              <Badge color="green">Aktiv</Badge>
            ) : (
              <Badge color="orange">Ej klar</Badge>
            )}
            <Badge color="purple">
              {forening.metadata?.kickback_percentage || 25}% kickback
            </Badge>
          </div>
        </div>
      </div>

      <div className="mb-4">
        <Heading level="h2" className="mb-1">Produkter</Heading>
        <Text className="text-ui-fg-muted">
          {products.length} produkt{products.length !== 1 ? "er" : ""} kopplade till denna förening
        </Text>
      </div>

      {products.length === 0 ? (
        <div className="bg-ui-bg-subtle p-8 rounded-lg text-center">
          <Text className="text-ui-fg-muted">
            Inga produkter hittades för denna förening.
          </Text>
        </div>
      ) : (
        <div className="bg-ui-bg-base rounded-lg border border-ui-border-base overflow-hidden">
          <Table>
            <Table.Header>
              <Table.Row>
                <Table.HeaderCell>Produkt</Table.HeaderCell>
                <Table.HeaderCell>Handle</Table.HeaderCell>
                <Table.HeaderCell>Pris</Table.HeaderCell>
                <Table.HeaderCell>Status</Table.HeaderCell>
                <Table.HeaderCell></Table.HeaderCell>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {products.map((product) => (
                <Table.Row key={product.id} className="hover:bg-ui-bg-subtle">
                  <Table.Cell>
                    <div className="flex items-center gap-3">
                      {product.thumbnail ? (
                        <img
                          src={product.thumbnail}
                          alt=""
                          className="w-10 h-10 rounded object-cover border border-ui-border-base"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded bg-ui-bg-subtle flex items-center justify-center border border-ui-border-base">
                          <Text className="text-ui-fg-muted text-xs">?</Text>
                        </div>
                      )}
                      <Text className="font-medium">{product.title}</Text>
                    </div>
                  </Table.Cell>
                  <Table.Cell>
                    <Text className="text-ui-fg-muted text-sm">{product.handle}</Text>
                  </Table.Cell>
                  <Table.Cell>
                    <Text>{formatPrice(product.variants?.[0])}</Text>
                  </Table.Cell>
                  <Table.Cell>
                    {product.status === "published" ? (
                      <Badge color="green">Publicerad</Badge>
                    ) : (
                      <Badge color="grey">Utkast</Badge>
                    )}
                  </Table.Cell>
                  <Table.Cell>
                    <Button
                      variant="secondary"
                      size="small"
                      onClick={() => {
                        window.location.href = `/app/products/${product.id}`
                      }}
                    >
                      Visa produkt
                    </Button>
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table>
        </div>
      )}
    </Container>
  )
}

export default ForeningDetailPage
