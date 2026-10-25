import { PageSkeleton } from "@/components/skeleton";

export default function Loading() {
  return <PageSkeleton filter stat={5} list={4} />;
}
