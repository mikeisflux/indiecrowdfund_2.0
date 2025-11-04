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

interface ProjectLaunchedEmailProps {
  creatorName: string
  projectTitle: string
  projectUrl: string
  dashboardUrl: string
}

export default function ProjectLaunchedEmail({
  creatorName,
  projectTitle,
  projectUrl,
  dashboardUrl,
}: ProjectLaunchedEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>Your project {projectTitle} is now live!</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>🎉 Your Project is Live!</Heading>
          <Text style={text}>Hi {creatorName},</Text>
          <Text style={text}>
            Congratulations! <strong>{projectTitle}</strong> is now live on
            Indiecrowdfund!
          </Text>
          <Text style={text}>
            Your project is now visible to thousands of potential backers. Here's
            what you should do next:
          </Text>
          <ul style={list}>
            <li>Share your project on social media</li>
            <li>Email your friends and followers</li>
            <li>Monitor your dashboard for updates</li>
            <li>Engage with your backers</li>
          </ul>
          <Section style={buttonContainer}>
            <Button style={button} href={dashboardUrl}>
              View Dashboard
            </Button>
            <Button style={buttonSecondary} href={projectUrl}>
              View Public Page
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

const text = {
  color: "#333",
  fontSize: "16px",
  lineHeight: "26px",
  padding: "0 40px",
}

const list = {
  color: "#333",
  fontSize: "16px",
  lineHeight: "26px",
  padding: "0 40px",
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
  display: "inline-block",
  padding: "12px 20px",
  margin: "0 10px",
}

const buttonSecondary = {
  backgroundColor: "#fff",
  border: "1px solid #000",
  borderRadius: "5px",
  color: "#000",
  fontSize: "16px",
  fontWeight: "bold",
  textDecoration: "none",
  textAlign: "center" as const,
  display: "inline-block",
  padding: "12px 20px",
  margin: "0 10px",
}

const footer = {
  color: "#8898aa",
  fontSize: "12px",
  lineHeight: "16px",
  padding: "0 40px",
  marginTop: "40px",
}
