import { type Metadata } from "next";

import { FlowBuilder } from "~/components/app/flow-builder";

export const metadata: Metadata = {
  title: "Flow Builder | GradeGuru",
  description: "Visual flow builder powered by React Flow and shadcn/ui.",
};

export default function AppPage() {
  return <FlowBuilder />;
}
