import { PageSkeleton } from "@/components/skeleton";

export default function Loading() {
  return <PageSkeleton stat={5} list={4} />;
}
