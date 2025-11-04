import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components"

interface ProjectUpdateEmailProps {
  recipientName: string
  projectTitle: string
  updateTitle: string
  updateContent: string
  projectUrl: string
  backersOnly: boolean
}

export default function ProjectUpdateEmail({
  recipientName,
  projectTitle,
  updateTitle,
  updateContent,
  projectUrl,
  backersOnly,
}: ProjectUpdateEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>New update from {projectTitle}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>📢 Project Update</Heading>
          <Text style={text}>Hi {recipientName},</Text>
          <Text style={text}>
            The creator of <strong>{projectTitle}</strong> has posted a new update!
          </Text>
          {backersOnly && (
            <div style={badge}>
              <Text style={badgeText}>Backers Only</Text>
            </div>
          )}
          <Section style={updateBox}>
            <Heading style={h2}>{updateTitle}</Heading>
            <Text style={updateContent}>{updateContent}</Text>
          </Section>
          <Section style={buttonContainer}>
            <Button style={button} href={projectUrl}>
              Read Full Update
            </Button>
          </Section>
          <Text style={footer}>
            © 2025 Indiecrowdfund. All rights reserved.
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

const main = {
  backgroundColor: "#f6f9fc",
  fontFamily:
    '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Ubuntu,sans-serif',
}

const container = {
  backgroundColor: "#ffffff",
  margin: "0 auto",
  padding: "20px 0 48px",
  marginBottom: "64px",
}

const h1 = {
  color: "#333",
  fontSize: "24px",
  fontWeight: "bold",
  margin: "40px 0",
  padding: "0",
  textAlign: "center" as const,
}

const h2 = {
  color: "#333",
  fontSize: "20px",
  fontWeight: "bold",
  margin: "0 0 16px 0",
}

const text = {
  color: "#333",
  fontSize: "16px",
  lineHeight: "26px",
  padding: "0 40px",
}

const badge = {
  backgroundColor: "#FFD700",
  borderRadius: "4px",
  padding: "4px 12px",
  margin: "16px 40px",
  display: "inline-block",
}

const badgeText = {
  color: "#000",
  fontSize: "12px",
  fontWeight: "bold",
  margin: "0",
}

const updateBox = {
  backgroundColor: "#f8f9fa",
  borderRadius: "8px",
  padding: "24px",
  margin: "24px 40px",
}

const updateContent = {
  color: "#555",
  fontSize: "14px",
  lineHeight: "24px",
  margin: "0",
}

const buttonContainer = {
  padding: "27px 0 27px",
  textAlign: "center" as const,
}

const button = {
  backgroundColor: "#000",
  borderRadius: "5px",
  color: "#fff",
  fontSize: "16px",
  fontWeight: "bold",
  textDecoration: "none",
  textAlign: "center" as const,
  display: "block",
  padding: "12px 20px",
}

const footer = {
  color: "#8898aa",
  fontSize: "12px",
  lineHeight: "16px",
  padding: "0 40px",
  marginTop: "40px",
}
