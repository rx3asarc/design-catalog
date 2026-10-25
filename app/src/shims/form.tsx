import React from "react";
export default function Form({ action, children, ...rest }: any) {
  return <form action={typeof action === "string" ? action : undefined} onSubmit={(e) => e.preventDefault()} {...rest}>{children}</form>;
}
