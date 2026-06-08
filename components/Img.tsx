import { proxied } from "@/lib/img";

type Props = {
  src?: string | null;
  alt?: string;
  className?: string;
  sizes?: string;
};

/**
 * Plain <img> that routes through our image proxy. We avoid next/image so we
 * don't have to whitelist remote hosts and so the proxy fully controls
 * caching / referer / protocol.
 */
export default function Img({ src, alt = "", className = "" }: Props) {
  const url = proxied(src);
  if (!url) {
    return <div className={`bg-paper-2 ${className}`} aria-hidden />;
  }
  // eslint-disable-next-line @next/next/no-img-element
  return (
    <img
      src={url}
      alt={alt}
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      className={className}
    />
  );
}
