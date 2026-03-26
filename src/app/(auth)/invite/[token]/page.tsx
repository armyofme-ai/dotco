import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { InviteRegistrationForm } from "./invite-form";

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const invitation = await prisma.invitation.findUnique({
    where: { token },
  });

  if (!invitation) {
    return (
      <div className="w-full max-w-sm">
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-bold">Dotco</CardTitle>
            <CardDescription>Invalid Invitation</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-center text-sm text-muted-foreground">
              This invitation link is invalid or has already been used.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (new Date() > invitation.expiresAt) {
    return (
      <div className="w-full max-w-sm">
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-bold">Dotco</CardTitle>
            <CardDescription>Invitation Expired</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-center text-sm text-muted-foreground">
              This invitation has expired. Please ask your team admin for a new
              invitation.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="w-full max-w-sm">
      <InviteRegistrationForm token={token} email={invitation.email} />
    </div>
  );
}
