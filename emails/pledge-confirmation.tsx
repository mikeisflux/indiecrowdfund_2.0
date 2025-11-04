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

interface PledgeConfirmationEmailProps {
  backerName: string
  projectTitle: string
  amount: string
  rewardTitle?: string
  projectUrl: string
}

export default function PledgeConfirmationEmail({
  backerName,
  projectTitle,
  amount,
  rewardTitle,
  projectUrl,
}: PledgeConfirmationEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>Your pledge to {projectTitle} is confirmed!</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>Thank You for Your Support!</Heading>
          <Text style={text}>Hi {backerName},</Text>
          <Text style={text}>
            Your pledge of <strong>{amount}</strong> to{" "}
            <strong>{projectTitle}</strong> has been confirmed!
          </Text>
          {rewardTitle && (
            <Text style={text}>
              You've selected the reward: <strong>{rewardTitle}</strong>
            </Text>
          )}
          <Text style={text}>
            You'll receive updates from the creator as the project progresses.
            Thank you for helping bring this project to life!
          </Text>
          <Section style={buttonContainer}>
            <Button style={button} href={projectUrl}>
              View Project
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
