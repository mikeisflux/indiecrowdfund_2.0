import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { JsonLd } from "@/components/json-ld";

describe("JsonLd", () => {
  it("renders a script tag with type application/ld+json", () => {
    const data = {
      "@context": "https://schema.org",
      "@type": "Organization",
      name: "Test Org",
    };

    const { container } = render(<JsonLd data={data} />);
    const script = container.querySelector('script[type="application/ld+json"]');
    expect(script).not.toBeNull();
    expect(JSON.parse(script!.innerHTML)).toEqual(data);
  });

  it("serializes complex nested data", () => {
    const data = {
      "@context": "https://schema.org",
      "@type": "Product",
      name: "Test Product",
      offers: {
        "@type": "Offer",
        price: "9.99",
        priceCurrency: "USD",
      },
    };

    const { container } = render(<JsonLd data={data} />);
    const script = container.querySelector('script[type="application/ld+json"]');
    const parsed = JSON.parse(script!.innerHTML);
    expect(parsed.offers.price).toBe("9.99");
  });
});
