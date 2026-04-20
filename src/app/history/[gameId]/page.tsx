import { redirect } from "next/navigation";

export default async function HistoryPage({
  params,
}: {
  params: Promise<{ gameId: string }>;
}) {
  const { gameId } = await params;
  redirect(`/play/${gameId}`);
}
