var e=`/* Next is not part of this site, but some published examples are written for it. These are honest shims:
   they render the same DOM a Next page would, so the demo shows the component rather than a build error. */
import React from "react";

export function Image({ src, alt, width, height, fill, priority, className, style, ...rest }: any) {
  const s = fill ? { position: "absolute" as const, inset: 0, width: "100%", height: "100%", ...style } : style;
  return <img src={typeof src === "string" ? src : src?.src} alt={alt ?? ""} width={width} height={height}
              className={className} style={s} {...rest} />;
}
export default Image;
`;export{e as default};