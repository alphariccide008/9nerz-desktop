import { Fragment } from "react";
import { colors } from "../../lib/theme";

// http(s):// and bare www. links → clickable, trailing punctuation trimmed.
const URL_RE = /(https?:\/\/[^\s<]+[^\s<.,:;"'!?)\]}]|www\.[^\s<]+[^\s<.,:;"'!?)\]}])/gi;

export function Linkified({ text, className }: { text: string; className?: string }) {
  const parts = text.split(URL_RE);
  return (
    <span className={className ?? "text-[13px] leading-5"}>
      {parts.map((part, i) => {
        if (i % 2 === 1) {
          const href = part.startsWith("http") ? part : `https://${part}`;
          return (
            <a
              key={i}
              onClick={(e) => {
                e.preventDefault();
                if (window.nerz?.openExternal) window.nerz.openExternal(href);
                else window.open(href, "_blank", "noopener,noreferrer");
              }}
              href={href}
              style={{ color: colors.teal, textDecoration: "underline", cursor: "pointer" }}
            >
              {part}
            </a>
          );
        }
        return <Fragment key={i}>{part}</Fragment>;
      })}
    </span>
  );
}
