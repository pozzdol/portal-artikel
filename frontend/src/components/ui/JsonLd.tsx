type JsonLdProps = {
  data: Record<string, unknown>;
};

/** Renders a JSON-LD `<script>` tag, escaping `<` so it can't close the tag early. */
export function JsonLd({ data }: JsonLdProps) {
  const json = JSON.stringify(data).replace(/</g, '\\u003c');
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: json }}
    />
  );
}
