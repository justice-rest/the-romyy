import { Metadata } from "next"
import { InviteContent } from "./invite-content"

export const metadata: Metadata = {
  title: "Join Collaborative Chat - Rōmy",
  description: "Join a collaborative chat session on Rōmy",
}

interface InvitePageProps {
  params: Promise<{ code: string }>
}

export default async function InvitePage({ params }: InvitePageProps) {
  const { code } = await params

  return <InviteContent code={code} />
}
