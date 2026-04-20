import { defineRouteConfig } from "@medusajs/admin-sdk"
import { useEffect, useState } from "react"
import { Container, Heading, Table, Badge, Text, Button } from "@medusajs/ui"
import { Buildings } from "@medusajs/icons"

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
    logo_preview?: string
    logo_original?: string
    logo_format?: string
    logo_is_vector?: boolean
    onboarding_completed?: boolean
  }
}

const ForeningarPage = () => {
  const [foreningar, setForeningar] = useState<Forening[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchForeningar = async () => {
      try {
        // Fetch all customers and filter by is_forening metadata
        const response = await fetch("/admin/customers?limit=100", {
          credentials: "include",
        })

        if (!response.ok) {
          throw new Error("Kunde inte hämta föreningar")
        }

        const data = await response.json()

        // Filter customers that are föreningar
        const foreningarList = (data.customers || []).filter(
          (customer: Forening) => customer.metadata?.is_forening === true
        )

        setForeningar(foreningarList)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Ett fel uppstod")
      } finally {
        setLoading(false)
      }
    }

    fetchForeningar()
  }, [])

  if (loading) {
    return (
      <Container className="p-8">
        <div className="flex items-center justify-center h-64">
          <Text className="text-ui-fg-muted">Laddar föreningar...</Text>
        </div>
      </Container>
    )
  }

  if (error) {
    return (
      <Container className="p-8">
        <div className="bg-ui-bg-subtle-hover p-4 rounded-lg">
          <Text className="text-ui-fg-error">{error}</Text>
        </div>
      </Container>
    )
  }

  return (
    <Container className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <Heading level="h1" className="mb-2">Föreningar</Heading>
          <Text className="text-ui-fg-muted">
            {foreningar.length} registrerade föreningar
          </Text>
        </div>
      </div>

      {foreningar.length === 0 ? (
        <div className="bg-ui-bg-subtle p-8 rounded-lg text-center">
          <Buildings className="w-12 h-12 mx-auto mb-4 text-ui-fg-muted" />
          <Text className="text-ui-fg-muted">
            Inga föreningar har registrerat sig ännu.
          </Text>
        </div>
      ) : (
        <div className="bg-ui-bg-base rounded-lg border border-ui-border-base overflow-hidden">
          <Table>
            <Table.Header>
              <Table.Row>
                <Table.HeaderCell>Förening</Table.HeaderCell>
                <Table.HeaderCell>Kontaktperson</Table.HeaderCell>
                <Table.HeaderCell>E-post</Table.HeaderCell>
                <Table.HeaderCell>Ort</Table.HeaderCell>
                <Table.HeaderCell>Status</Table.HeaderCell>
                <Table.HeaderCell>Kickback</Table.HeaderCell>
                <Table.HeaderCell>Registrerad</Table.HeaderCell>
                <Table.HeaderCell></Table.HeaderCell>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {foreningar.map((forening) => (
                <Table.Row key={forening.id} className="hover:bg-ui-bg-subtle">
                  <Table.Cell>
                    <div className="flex items-center gap-3">
                      {forening.metadata?.logo_preview ? (
                        <div className="relative">
                          <img
                            src={forening.metadata.logo_preview}
                            alt=""
                            className="w-10 h-10 rounded object-contain bg-white border border-ui-border-base"
                          />
                          {forening.metadata.logo_is_vector && (
                            <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 rounded-full flex items-center justify-center">
                              <span className="text-white text-[8px] font-bold">V</span>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="w-10 h-10 rounded bg-ui-bg-subtle flex items-center justify-center border border-ui-border-base">
                          <Buildings className="w-5 h-5 text-ui-fg-muted" />
                        </div>
                      )}
                      <div>
                        <Text className="font-medium">
                          {forening.metadata?.foreningsnamn || "Okänd förening"}
                        </Text>
                        {forening.metadata?.organisationsnummer && (
                          <Text className="text-ui-fg-muted text-xs">
                            Org.nr: {forening.metadata.organisationsnummer}
                          </Text>
                        )}
                      </div>
                    </div>
                  </Table.Cell>
                  <Table.Cell>
                    {forening.first_name} {forening.last_name}
                  </Table.Cell>
                  <Table.Cell>
                    <Text className="text-ui-fg-muted">{forening.email}</Text>
                  </Table.Cell>
                  <Table.Cell>
                    {forening.metadata?.ort || "-"}
                  </Table.Cell>
                  <Table.Cell>
                    {forening.metadata?.onboarding_completed ? (
                      <Badge color="green">Aktiv</Badge>
                    ) : (
                      <Badge color="orange">Ej klar</Badge>
                    )}
                  </Table.Cell>
                  <Table.Cell>
                    <Badge color="purple">
                      {forening.metadata?.kickback_percentage || 25}%
                    </Badge>
                  </Table.Cell>
                  <Table.Cell>
                    <Text className="text-ui-fg-muted text-sm">
                      {new Date(forening.created_at).toLocaleDateString("sv-SE")}
                    </Text>
                  </Table.Cell>
                  <Table.Cell>
                    <Button
                      variant="secondary"
                      size="small"
                      onClick={() => {
                        window.location.href = `/app/foreningar/${forening.id}`
                      }}
                    >
                      Visa
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

export const config = defineRouteConfig({
  label: "Föreningar",
  icon: Buildings,
})

export default ForeningarPage
