const ORGANIZATION_JSON_LD = {
  "@context": "https://schema.org",
  "@type": "LocalBusiness",
  name: "VisualDesign",
  url: "https://visualdesignmoz.com",
  logo: "https://visualdesignmoz.com/icons/icon-512x512.png",
  image: "https://visualdesignmoz.com/icons/icon-512x512.png",
  telephone: "+258825288318",
  address: {
    "@type": "PostalAddress",
    streetAddress: "Av. Karl Marx, 177",
    addressLocality: "Maputo",
    addressCountry: "MZ",
  },
};

export function OrganizationJsonLd() {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(ORGANIZATION_JSON_LD) }}
    />
  );
}
