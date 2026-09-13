import WebflowPage from "../src/components/WebflowPage";
import { getWebflowPageProps } from "../src/lib/webflow-files";

export const config = {
  unstable_runtimeJS: false,
};

export default function PricingPage(props) {
  return <WebflowPage {...props} />;
}

export async function getStaticProps() {
  return getWebflowPageProps("pricing.html");
}
