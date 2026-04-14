export async function GET() {
  return Response.json(
    { error: "OAuth not supported" },
    { status: 404 }
  );
}
