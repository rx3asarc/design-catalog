var e=`import React from "react";
export default function Link({ href, children, ...rest }: any) {
  return <a href={typeof href === "string" ? href : "#"} {...rest}>{children}</a>;
}
`;export{e as default};