import Image from "next/image";

export function BrandMark({
  size = 32,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  return (
    <Image
      src="/brand/tavyra-mark.png"
      alt=""
      width={size}
      height={size}
      priority
      className={`shrink-0 rounded-lg ${className}`}
    />
  );
}
